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
exports.SecretAuditLog = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SecretAuditLogSchema = new mongoose_1.Schema({
    secretType: { type: String, default: 'model_config_api_key', index: true },
    ownerId: { type: String, required: true, index: true },
    actorId: { type: String, required: true, index: true },
    targetId: { type: String, required: true, index: true },
    action: {
        type: String,
        enum: ['secret_created', 'secret_updated', 'secret_test', 'secret_deleted'],
        required: true,
    },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: null },
    result: { type: String, enum: ['success', 'failure'], default: 'success' },
    alert: { type: Boolean, default: false },
    detail: { type: mongoose_1.Schema.Types.Mixed, default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });
/** 复合索引：按目标+时间倒序查询某个配置的全部密钥操作 */
SecretAuditLogSchema.index({ targetId: 1, createdAt: -1 });
exports.SecretAuditLog = mongoose_1.default.model('SecretAuditLog', SecretAuditLogSchema);
//# sourceMappingURL=SecretAuditLog.js.map