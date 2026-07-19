/** 本地落盘根目录：与生产静态挂载点一致（index.ts 中 express.static 挂载 /generated → 此目录） */
export declare const LOCAL_STORAGE_DIR: string;
export interface ObjectStorage {
    /** 存储名，便于诊断 */
    name: string;
    /** 是否已配置（用于工厂选择） */
    isConfigured(): boolean;
    /**
     * 写入一个对象，返回可公开访问的 URL。
     * @param key   对象键（可含子目录，如 text2img/xxx.png）
     * @param data  二进制内容
     * @param contentType  MIME 类型
     */
    put(key: string, data: Buffer, contentType: string): Promise<string>;
}
/** 工厂：云存储已配置则优先，否则 LocalStorage 兜底（幂等、单例） */
export declare function getObjectStorage(): ObjectStorage;
export declare function isHttpUrl(s?: string): boolean;
export interface StoreImageInput {
    /** 远程图片 URL（与 base64 二选一） */
    url?: string;
    /** base64 数据（可能带 data: 前缀） */
    base64?: string;
}
export interface StoreImageOptions {
    /** 存储前缀（子目录），如 'text2img' */
    prefix?: string;
    /** 强制扩展名（缺省按内容推断） */
    ext?: string;
}
/**
 * 把一张图片存入对象存储，返回稳定可访问的 URL。
 * - url：下载后落盘；
 * - base64：解码后落盘（data URI 亦可）；
 * - 二者皆非则抛错。
 */
export declare function storeImage(input: StoreImageInput, opts?: StoreImageOptions): Promise<string>;
//# sourceMappingURL=object-storage.d.ts.map