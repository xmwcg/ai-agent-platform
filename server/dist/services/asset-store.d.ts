/**
 * 可插拔资产存储（转换产物 / 图生图参考图等临时资产）
 *
 * 后端优先级：
 *   1. 腾讯云 COS（对象存储）—— 多实例共享，生产推荐。
 *      需配置：COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET / COS_REGION
 *   2. 本地磁盘 —— 单实例或挂载共享卷时可用，重启不丢。
 *      目录由 ASSET_STORE_DIR 指定，默认 <cwd>/.cache/assets
 *   3. 内存兜底 —— 最差情况（进程级，重启清空）。
 *
 * 取代原先散落的进程级 Map，解决「多实例不可达」「重启丢失」问题。
 */
export interface StoredAsset {
    buf: Buffer;
    ctype: string;
    name?: string;
}
type Backend = 'cos' | 'disk' | 'memory';
export declare function getAssetBackend(): Backend;
export declare function putAsset(id: string, buf: Buffer, ctype: string, name?: string): Promise<void>;
export declare function getAsset(id: string): Promise<StoredAsset | undefined>;
export declare function deleteAsset(id: string): Promise<void>;
export {};
//# sourceMappingURL=asset-store.d.ts.map