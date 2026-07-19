"use strict";
/**
 * 技能协议层（agency-agents 风格）
 * ----------------------------------------------------------------
 * 参考 msitarzewski/agency-agents 的设计哲学：
 *   每个能力 = 一个「具人格 / 清晰交付物 / 可衡量结果」的技能模块。
 * 但与其用纯 Markdown 文件不同，我们在后端落地为「可声明、可插拔、
 * 可上架开放 API 市场」的 TS 模块，便于与你已有的 RBAC、配额网关、
 * 媒体生成、客服 RAG 等服务打通。
 *
 * 一个 Skill 由两部分组成：
 *   1. manifest：声明式元数据（名称 / 描述 / 分类 / 所需权限 / 配额资源 / 入口）
 *   2. invoke：实际执行函数（调用对应 service）
 */
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=types.js.map