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
exports.UserSkill = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const userSkillSchema = new mongoose_1.Schema({
    skillId: { type: String, required: true, index: true },
    owner: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    division: { type: String, default: 'productivity' },
    color: { type: String, default: '#6366f1' },
    coreMission: { type: String, default: '' },
    criticalRules: { type: [String], default: [] },
    successMetrics: { type: [String], default: [] },
    minRole: { type: String, default: 'none' },
    requireAuth: { type: Boolean, default: true },
    marketable: { type: Boolean, default: false },
    tags: { type: [String], default: [] },
    isPublic: { type: Boolean, default: false },
    kind: { type: String, enum: ['prompt', 'mcp', 'workflow'], default: 'prompt' },
    prompt: { type: mongoose_1.Schema.Types.Mixed },
    mcp: { type: mongoose_1.Schema.Types.Mixed },
    workflow: { type: mongoose_1.Schema.Types.Mixed },
}, { timestamps: true });
userSkillSchema.index({ skillId: 1, owner: 1 }, { unique: true });
exports.UserSkill = mongoose_1.default.model('UserSkill', userSkillSchema);
//# sourceMappingURL=UserSkill.js.map