import mongoose, { Schema, Document } from "mongoose";

/**
 * 归因会话：匿名体检 → 注册 的归因桥梁。
 *
 * 每次调用 POST /api/project-grade/evaluate（匿名）时生成一个临时 sessionId，
 * 注册时客户端携带该 sessionId，服务端将其与注册用户关联。
 *
 * TTL 索引 2 小时后自动清理，避免膨胀。
 */
export interface IAttributionSession extends Document {
  sessionId: string;
  source: string;          // 入口来源：demo / landing / embed / direct
  projectKind?: string;    // 体检时的项目类型
  userAgent?: string;      // 用户浏览器 UA
  ip?: string;             // 客户端 IP
  referralCode?: string;   // 如果有推荐码
  registeredUserId?: string; // 注册后回填
  registeredAt?: Date;      // 注册时间
  createdAt: Date;
}

const AttributionSessionSchema = new Schema<IAttributionSession>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    source: { type: String, default: "direct" },
    projectKind: { type: String },
    userAgent: { type: String },
    ip: { type: String },
    referralCode: { type: String },
    registeredUserId: { type: String, index: true },
    registeredAt: { type: Date },
    createdAt: { type: Date, default: Date.now, expires: 7200 }, // TTL 2h
  },
  { timestamps: false }
);

export const AttributionSession = mongoose.model<IAttributionSession>(
  "AttributionSession",
  AttributionSessionSchema
);