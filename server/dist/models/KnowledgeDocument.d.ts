import mongoose, { Document } from 'mongoose';
export interface IKnowledgeDocument extends Document {
    title: string;
    content: string;
    htmlContent?: string;
    summary?: string;
    tags: string[];
    categories: string[];
    author: string;
    teamId?: string;
    isPublic: boolean;
    categoryTree?: string[];
    price?: number;
    requiredPlan?: 'free' | 'pro' | 'max';
    creditsCost?: number;
    freePreviewPages?: number;
    unlockedBy?: string[];
    viewCount: number;
    likeCount: number;
    createdAt: Date;
    updatedAt: Date;
    embedding?: number[];
    aiTags?: string[];
    relatedDocs?: string[];
}
export declare const KnowledgeDocument: mongoose.Model<IKnowledgeDocument, {}, {}, {}, mongoose.Document<unknown, {}, IKnowledgeDocument, {}, {}> & IKnowledgeDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=KnowledgeDocument.d.ts.map