/**
 * 对账服务 — 每日自动对账与差异追踪
 *
 * 流程:
 * 1. 下载微信交易账单（每日自动）
 * 2. 与系统订单比对
 * 3. 标记差异 → ReconciliationRecord
 * 4. 自动重试后仍不匹配的进入死信任务并告警
 */
import crypto from "crypto";
import mongoose from "mongoose";
import axios from "axios";
import { Order } from "../models/Order";
import { ReconciliationRecord, IDifference } from "../models/ReconciliationRecord";
import { WebhookEvent } from "../models/WebhookEvent";
import { AppError } from "../lib/http-error";
import { logger } from "../lib/logger";

interface WeChatBillRecord {
  tradeState: string;
  transactionId: string;
  outTradeNo: string;
  totalAmount: number; // 分
  tradeType: string;
  finishTime: string;
  refundAmount?: number;
}

export class ReconciliationService {
  /**
   * 生成对账批次号：日期 YYYYMMDD
   */
  static genBatchId(date?: Date): string {
    const d = date || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `REC-${y}${m}${day}`;
  }

  /**
   * 手动触发对账（管理员用）
   * 参数 date: 对账日期，不传则对昨天
   */
  static async triggerReconciliation(date?: Date) {
    const targetDate = date || new Date(Date.now() - 86400000);
    const batchId = ReconciliationService.genBatchId(targetDate);
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 86400000);

    // 检查是否已有同批对账
    const existing = await ReconciliationRecord.findOne({ batchId });
    if (existing && existing.status !== "pending") {
      logger.info("reconciliation", `批次 ${batchId} 已完成，跳过`);
      return existing;
    }

    const record = await ReconciliationRecord.create({
      batchId,
      provider: "wechat",
      dateRange: { start: startOfDay, end: endOfDay },
      totalSystemOrders: 0,
      totalSystemAmount: 0,
      matchedOrders: 0,
      unmatchedOrders: 0,
      differences: [],
      status: "pending",
      startedAt: new Date(),
    });

    try {
      // 1. 查询系统订单（当日已支付）
      const systemOrders = await Order.find({
        paymentStatus: { $in: ["paid", "refunded", "refunding"] },
        paidAt: { $gte: startOfDay, $lt: endOfDay },
      }).lean();

      const systemMap = new Map<string, typeof systemOrders[0]>();
      let totalSystemAmount = 0;
      for (const order of systemOrders) {
        systemMap.set(order.transactionId || order.orderNo, order);
        totalSystemAmount += order.amount;
      }

      record.totalSystemOrders = systemOrders.length;
      record.totalSystemAmount = totalSystemAmount;

      // 2. 尝试下载微信交易账单
      let wechatRecords: WeChatBillRecord[] = [];
      try {
        wechatRecords = await ReconciliationService.downloadWeChatBill(targetDate);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("reconciliation", `下载微信账单失败: ${message}`);
        record.errorMessage = `账单下载失败: ${message}`;
        record.status = "unmatched";
        record.totalWechatOrders = -1;
        record.completedAt = new Date();
        await record.save();
        return record;
      }

      record.totalWechatOrders = wechatRecords.length;
      let totalWechatAmount = 0;
      const wechatMap = new Map<string, WeChatBillRecord>();
      for (const w of wechatRecords) {
        wechatMap.set(w.outTradeNo, w);
        totalWechatAmount += w.totalAmount;
      }
      record.totalWechatAmount = totalWechatAmount;

      // 3. 比对
      const differences: IDifference[] = [];
      let matchedCount = 0;

      // 系统有、微信无
      for (const [key, order] of systemMap) {
        const wechat = wechatMap.get(order.orderNo);
        if (!wechat) {
          differences.push({
            orderNo: order.orderNo,
            type: "missing_in_wechat",
            systemAmount: order.amount,
            systemStatus: order.status,
            resolved: false,
          });
          continue;
        }
        wechatMap.delete(order.orderNo);

        if (wechat.totalAmount !== order.amount) {
          differences.push({
            orderNo: order.orderNo,
            type: "amount_mismatch",
            systemAmount: order.amount,
            wechatAmount: wechat.totalAmount,
            systemStatus: order.status,
            wechatStatus: wechat.tradeState,
            resolved: false,
          });
        } else {
          matchedCount++;
        }
      }

      // 微信有、系统无
      for (const [outTradeNo, wechatRec] of wechatMap) {
        differences.push({
          orderNo: outTradeNo,
          type: "missing_in_system",
          wechatAmount: wechatRec.totalAmount,
          wechatStatus: wechatRec.tradeState,
          resolved: false,
        });
      }

      record.matchedOrders = matchedCount;
      record.unmatchedOrders = differences.length;
      record.differences = differences;
      record.status = differences.length === 0 ? "matched" : "partial";
      record.completedAt = new Date();

      // 若纯部分匹配但有差异，且需要人工处理的标记
      if (differences.length > 0) {
        // 尝试自动重试匹配（通过 webhook event 补全）
        await ReconciliationService.autoRetryUnmatched(differences, batchId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("reconciliation", `对账流程异常: ${message}`);
      record.status = "unmatched";
      record.errorMessage = message;
      record.completedAt = new Date();
    }

    await record.save();

    logger.info("reconciliation", `对账完成: batchId=${batchId} status=${record.status} matched=${record.matchedOrders} unmatched=${record.unmatchedOrders}`);
    return record;
  }

  /**
   * 下载微信交易账单
   * 使用微信 v3 交易账单下载接口
   */
  static async downloadWeChatBill(date: Date): Promise<WeChatBillRecord[]> {
    const mchId = process.env.WECHAT_MCH_ID;
    const apiV3Key = process.env.WECHAT_API_V3_KEY;
    const serialNo = process.env.WECHAT_CERT_SERIAL;
    const privateKey = process.env.WECHAT_PRIVATE_KEY;

    if (!mchId || !apiV3Key || !serialNo || !privateKey) {
      throw new Error("微信支付未完整配置");
    }

    const billDate = date.toISOString().slice(0, 10).replace(/-/g, "");

    // 先申请账单
    const applyUrl = `/v3/bill/tradebill?bill_date=${billDate}&bill_type=ALL`;
    const method = "GET";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString("hex");
    const signStr = `${method}\n${applyUrl}\n${timestamp}\n${nonce}\n\n`;
    const sign = crypto
      .createSign("RSA-SHA256")
      .update(signStr)
      .sign(privateKey, "base64");

    try {
      const applyResp = await axios.get(`https://api.mch.weixin.qq.com${applyUrl}`, {
        headers: {
          Accept: "application/json",
          Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${mchId}",nonce_str="${nonce}",signature="${sign}",timestamp="${timestamp}",serial_no="${serialNo}"`,
        },
        timeout: 15000,
      });

      const downloadUrl = applyResp.data?.download_url;
      if (!downloadUrl) {
        logger.warn("reconciliation", "账单申请成功但无 download_url");
        return [];
      }

      // 下载账单
      const billResp = await axios.get(downloadUrl, {
        responseType: "text",
        timeout: 30000,
      });

      return ReconciliationService.parseWeChatBill(billResp.data);
    } catch (err: any) {
      // 如果当天无交易，微信可能返回 404; 这是正常情况
      if (err.response?.status === 404) {
        logger.info("reconciliation", "当日无微信交易记录");
        return [];
      }
      throw err;
    }
  }

  /**
   * 解析微信账单 CSV
   * 格式：交易时间,公众账号ID,商户号,特殊商户号,设备号,微信订单号,商户订单号,用户标识,交易类型,交易状态,付款银行,货币种类,应结订单金额,代金券金额,微信退款单号,商户退款单号,退款金额,充值券退款金额,退款类型,退款状态,商品名称,商户数据包,手续费,费率,订单金额,申请退款金额,费率备注
   */
  static parseWeChatBill(raw: string): WeChatBillRecord[] {
    const records: WeChatBillRecord[] = [];
    const lines = raw.split("\n").filter((line) => line.trim());
    if (lines.length < 2) return records;

    // 跳过 CSV header
    for (let i = 1; i < lines.length; i++) {
      const fields = lines[i].split(",");
      if (fields.length < 11) continue;

      // 只取支付成功的记录（非退款单独立行）
      const tradeState = (fields[9] || "").trim();
      if (tradeState !== "SUCCESS") continue;

      // 只取支付记录（非退款记录）
      const outTradeNo = (fields[6] || "").trim();
      const transactionId = (fields[5] || "").trim();
      const totalAmount = Math.round(parseFloat((fields[13] || "0").trim().replace(/[^0-9.]/g, "")) * 100);

      if (outTradeNo && transactionId) {
        records.push({
          tradeState,
          transactionId,
          outTradeNo,
          totalAmount,
          tradeType: (fields[8] || "").trim(),
          finishTime: (fields[0] || "").trim(),
          refundAmount: parseFloat((fields[16] || "0").trim().replace(/[^0-9.]/g, "")) * 100,
        });
      }
    }

    return records;
  }

  /**
   * 自动重试：尝试通过 webhook event 补全差异
   */
  static async autoRetryUnmatched(differences: IDifference[], batchId: string) {
    for (const diff of differences) {
      if (diff.type === "missing_in_wechat") {
        // 检查是否有 webhook 事件记录
        const event = await WebhookEvent.findOne({
          orderNo: diff.orderNo,
          status: "processed",
        });
        if (event) {
          diff.resolved = true;
          diff.resolvedAt = new Date();
          diff.resolution = "通过 webhook 事件记录确认";
          logger.info("reconciliation", `差异 ${diff.orderNo} 已通过 webhook 补全`);
        }
      }
    }
  }

  /**
   * 查询对账列表
   */
  static async getReconciliationList(page: number, limit: number) {
    const [records, total] = await Promise.all([
      ReconciliationRecord.find()
        .sort({ batchId: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ReconciliationRecord.countDocuments(),
    ]);
    return { list: records, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * 查询对账详情
   */
  static async getReconciliationDetail(batchId: string) {
    const record = await ReconciliationRecord.findOne({ batchId }).lean();
    if (!record) throw new AppError(404, "对账批次不存在", "RECONCILIATION_NOT_FOUND");
    return record;
  }
}
