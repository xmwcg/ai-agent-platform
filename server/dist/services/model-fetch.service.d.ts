export declare function isBlockedNetworkAddress(address: string): boolean;
export interface FetchCatalogModelsInput {
    providerId: string;
    endpointId?: string;
    apiKey: string;
    timeoutMs?: number;
}
/**
 * 只对服务端权威目录中的官方 HTTPS Endpoint 发起模型列表请求。
 * API Key 仅存在于本次调用栈，不落库、不写 Redis、不写日志，也不缓存响应正文。
 */
export declare function fetchCatalogProviderModels(input: FetchCatalogModelsInput): Promise<string[]>;
//# sourceMappingURL=model-fetch.service.d.ts.map