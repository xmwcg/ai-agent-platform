// server/src/services/conversion-funnel.service.ts
//
// 转化漏斗分析服务：追踪匿名体检 → 注册 → 付费 → 正式报告发布 的全链路转化。
// 复用现有模型：User (注册)、Order (付费)、ProjectGradeReport (报告发布)、
// ApiUsageLog (API调用/evaluate)、ProjectGradeAuditLog (审计事件)。
//
// 挂载：GET /api/ops/funnel → AdminDashboardPage 展示漏斗卡片。

import { User } from "../models/User";
import { Order } from "../models/Order";
import { ProjectGradeReport } from "../models/ProjectGradeReport";
import { ApiUsageLog } from "../models/ApiUsageLog";
import { AttributionSession } from "../models/AttributionSession";

const DAY = 86_400_000;

function startOfDaysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return new Date(d.getTime() - n * DAY);
}

export interface FunnelStage {
  label: string;
  key: string;
  count: number;
  rateFromPrevious: number;
  rateFromTop: number;
}

export interface FunnelResponse {
  period: { from: string; to: string; label: string };
  stages: FunnelStage[];
  summary: {
    totalVisitors: number;
    registeredUsers: number;
    paidUsers: number;
    reportPublishes: number;
    overallConversionRate: number;
    attributedRegistrations: number;     // 从归因会话来的注册数
    attributionRate: number;             // 归因注册 / 总注册
    avgTimeToRegisterMinutes: number;    // 平均从体检到注册的分钟数
  };
}

export async function getConversionFunnel(days: number = 30): Promise<FunnelResponse> {
  const from = startOfDaysAgo(days);
  const now = new Date();
  const periodLabel = days <= 7 ? "最近7天" : days <= 30 ? "最近30天" : `最近${days}天`;

  // Stage 1: unique users calling project-grade evaluate / url-scan APIs
  const evaluateVisitors = await ApiUsageLog.distinct("ownerId", {
    resource: { $in: ["project_grade_evaluate", "project_grade_url_scan"] },
    timestamp: { $gte: from, $lt: now },
  });
  const visitorSet = new Set(evaluateVisitors.map((id: any) => String(id)));
  const visitors = visitorSet.size;

  // Stage 2: registered users in this period
  const registeredUsers = await User.countDocuments({
    createdAt: { $gte: from, $lt: now },
  });

  // Stage 3: users who completed a payment in this period
  const paidOrders = await Order.distinct("userId", {
    status: "paid",
    paidAt: { $gte: from, $lt: now },
  });
  const paidUserSet = new Set(paidOrders.map((id: any) => String(id)));
  const paidUsers = paidUserSet.size;

  // Stage 4: published ProjectGrade reports in this period
  const reportPublishes = await ProjectGradeReport.countDocuments({
    isPublic: true,
    publishedAt: { $gte: from, $lt: now },
  });

  // Lifetime total for summary context
  const allReports = await ProjectGradeReport.countDocuments({ isPublic: true });

  const stages: FunnelStage[] = [
    {
      label: "访问（体检API调用）",
      key: "visitors",
      count: visitors,
      rateFromPrevious: 100,
      rateFromTop: 100,
    },
    {
      label: "注册用户",
      key: "registered",
      count: registeredUsers,
      rateFromPrevious: visitors > 0 ? Number(((registeredUsers / visitors) * 100).toFixed(1)) : 0,
      rateFromTop: visitors > 0 ? Number(((registeredUsers / visitors) * 100).toFixed(1)) : 0,
    },
    {
      label: "付费用户",
      key: "paid",
      count: paidUsers,
      rateFromPrevious: registeredUsers > 0 ? Number(((paidUsers / registeredUsers) * 100).toFixed(1)) : 0,
      rateFromTop: visitors > 0 ? Number(((paidUsers / visitors) * 100).toFixed(1)) : 0,
    },
    {
      label: "正式报告发布",
      key: "report_publish",
      count: reportPublishes,
      rateFromPrevious: paidUsers > 0 ? Number(((reportPublishes / paidUsers) * 100).toFixed(1)) : 0,
      rateFromTop: visitors > 0 ? Number(((reportPublishes / visitors) * 100).toFixed(1)) : 0,
    },
  ];

  // Attribution stats
  const attributedSessions = await AttributionSession.find({
    registeredUserId: { $exists: true },
    registeredAt: { $gte: from, $lt: now },
  }).lean();

  const attributedRegistrations = attributedSessions.length;

  // Average time from evaluation to registration (in minutes)
  let avgTimeToRegisterMinutes = 0;
  if (attributedSessions.length > 0) {
    const totalMinutes = attributedSessions.reduce((sum, s) => {
      const created = new Date(s.createdAt).getTime();
      const registered = new Date(s.registeredAt!).getTime();
      return sum + (registered - created) / 60000;
    }, 0);
    avgTimeToRegisterMinutes = Number((totalMinutes / attributedSessions.length).toFixed(1));
  }

  return {
    period: {
      from: from.toISOString(),
      to: now.toISOString(),
      label: periodLabel,
    },
    stages,
    summary: {
      totalVisitors: visitors,
      registeredUsers,
      paidUsers,
      reportPublishes: allReports,
      overallConversionRate: visitors > 0
        ? Number(((reportPublishes / visitors) * 100).toFixed(1))
        : 0,
      attributedRegistrations,
      attributionRate: registeredUsers > 0
        ? Number(((attributedRegistrations / registeredUsers) * 100).toFixed(1))
        : 0,
      avgTimeToRegisterMinutes,
    },
  };
}