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
exports.ConsentRecord = void 0;
/**
 * 用户协议同意记录模型
 *
 * 记录每次用户同意/拒绝协议的时间、版本和元信息。
 * 协议更新后需重新征得用户同意。
 */
const mongoose_1 = __importStar(require("mongoose"));
const ConsentRecordSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    consentType: {
        type: String,
        required: true,
        enum: [
            "terms_of_service",
            "privacy_policy",
            "cookie_policy",
            "refund_policy",
            "points_rules",
            "data_processing",
        ],
    },
    version: { type: String, required: true },
    accepted: { type: Boolean, required: true },
    ipAddress: { type: String, required: true },
    userAgent: { type: String, default: "" },
    channel: { type: String, enum: ["web", "wechat", "douyin", "admin"], default: "web" },
    withdrawnAt: { type: Date },
}, { timestamps: true });
ConsentRecordSchema.index({ userId: 1, consentType: 1 });
ConsentRecordSchema.index({ userId: 1, version: 1 });
exports.ConsentRecord = mongoose_1.default.model("ConsentRecord", ConsentRecordSchema);
//# sourceMappingURL=ConsentRecord.js.map