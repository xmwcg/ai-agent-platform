import { ModelEventType } from '../models/ModelEvent';
declare const router: import("express-serve-static-core").Router;
/** 种子数据：主流厂商模型发布/更新动态（首次访问时幂等写入） */
type SeedModelEvent = {
    modelName: string;
    vendor: string;
    releaseDate: string;
    type: ModelEventType;
    description?: string;
    highlights: string[];
    source: 'seed';
};
export declare const SEED_MODEL_EVENTS: SeedModelEvent[];
export default router;
//# sourceMappingURL=model-calendar.d.ts.map