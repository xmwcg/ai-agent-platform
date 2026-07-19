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
exports.TeamAuditLog = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const TeamAuditLogSchema = new mongoose_1.Schema({
    teamId: { type: String, required: true, index: true },
    actorId: { type: String, required: true, index: true },
    action: {
        type: String,
        enum: [
            'team_created',
            'team_deleted',
            'member_joined',
            'member_left',
            'member_removed',
            'role_changed',
            'invite_generated',
            'invite_revoked',
        ],
        required: true,
    },
    targetId: { type: String, default: null },
    detail: { type: mongoose_1.Schema.Types.Mixed, default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });
/** 复合索引：按团队+时间倒序查询 */
TeamAuditLogSchema.index({ teamId: 1, createdAt: -1 });
exports.TeamAuditLog = mongoose_1.default.model('TeamAuditLog', TeamAuditLogSchema);
//# sourceMappingURL=TeamAuditLog.js.map