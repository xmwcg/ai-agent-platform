import mongoose, { Document } from 'mongoose';
import type { MediaTaskType } from '../services/media-gen.service';
export interface IMediaTask extends Document {
    taskId: string;
    type: MediaTaskType;
    status: 'completed' | 'processing';
    prompt: string;
    outputUrl: string;
    thumbnailUrl?: string;
    /** 多图结果（如一次生成多张），outputUrl 为主图 */
    images?: string[];
    duration?: number;
    provider: string;
    note: string;
    /** 所属用户（可选，用于按用户隔离历史；匿名任务为空） */
    userId?: string;
    /**
     * BYOK 凭据密文（AES-256-GCM，来自 crypto.ts）。仅当用户使用自带 Key 生成时存在，
     * 供异步轮询 queryTask 时解密并注入厂商请求；明文不落库，DB 泄露也无法还原。
     * 内容为加密后的 JSON：{ secretId?, secretKey }
     */
    byokEnc?: string;
    /** 图生图参考图（base64 或公网 URL），供异步 queryTask 回源生成，24h TTL 内自动清理 */
    imageBase64?: string;
    imageUrl?: string;
    createdAt: Date;
    /** TTL 索引：24 小时后自动删除旧任务 */
    expiresAt: Date;
}
export declare const MediaTask: mongoose.Model<IMediaTask, {}, {}, {}, mongoose.Document<unknown, {}, IMediaTask, {}, {}> & IMediaTask & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=MediaTask.d.ts.map