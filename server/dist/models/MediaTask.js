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
exports.MediaTask = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const MediaTaskSchema = new mongoose_1.Schema({
    taskId: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true, enum: ['text2img', 'image2image', 'text2video', 'image2video'] },
    status: { type: String, required: true, enum: ['completed', 'processing'], default: 'processing' },
    prompt: { type: String, required: true },
    outputUrl: { type: String, required: true },
    thumbnailUrl: { type: String, default: null },
    images: { type: [String], default: undefined },
    duration: { type: Number, default: null },
    provider: { type: String, required: true },
    note: { type: String, default: '' },
    userId: { type: String, index: true, sparse: true, default: null },
    byokEnc: { type: String, default: null },
    imageBase64: { type: String, default: null },
    imageUrl: { type: String, default: null },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
}, { timestamps: { createdAt: true, updatedAt: false } });
/** TTL 索引：MongoDB 自动清理过期任务 */
MediaTaskSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
exports.MediaTask = mongoose_1.default.model('MediaTask', MediaTaskSchema);
//# sourceMappingURL=MediaTask.js.map