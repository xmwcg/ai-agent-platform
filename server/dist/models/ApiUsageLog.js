"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiUsageLog = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ApiUsageLogSchema = new mongoose_1.Schema({
    keyId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ApiKey', required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    prefix: { type: String, required: true },
    resource: { type: String, default: 'chat' },
    requestId: { type: String },
    modelId: { type: String },
    providerId: { type: String },
    promptBytes: { type: Number },
    replyBytes: { type: Number },
    status: { type: String, enum: ['success', 'quota_exceeded', 'error'], default: 'success' },
    creditsDeducted: { type: Number },
    timestamp: { type: Date, default: Date.now },
}, { timestamps: false });
// 复合索引：按密钥 + 时间查询用量报表
ApiUsageLogSchema.index({ keyId: 1, timestamp: -1 });
ApiUsageLogSchema.index({ ownerId: 1, requestId: 1 }, { unique: true, sparse: true });
ApiUsageLogSchema.index({ ownerId: 1, modelId: 1, timestamp: -1 });
// TTL 索引：90 天后自动清理（控制存储成本）
ApiUsageLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 86400 });
exports.ApiUsageLog = mongoose_1.default.model('ApiUsageLog', ApiUsageLogSchema);
//# sourceMappingURL=ApiUsageLog.js.map