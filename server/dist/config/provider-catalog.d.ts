export type ProviderCategory = 'domestic' | 'international';
export type ProviderAuthMode = 'bearer' | 'x-api-key' | 'query-key';
export interface ProviderProtocol {
    id: string;
    name: string;
    description: string;
}
export interface ProviderEndpoint {
    id: string;
    name: string;
    region: string;
    baseUrl: string;
    modelListPath: string;
    authMode: ProviderAuthMode;
    extraHeaders?: Record<string, string>;
}
export interface ProviderCatalogEntry {
    id: string;
    name: string;
    category: ProviderCategory;
    protocols: ProviderProtocol[];
    endpoints: ProviderEndpoint[];
    keyFormat: string;
    recommendedModels: string[];
    capabilities: string[];
    supportsModelFetch: boolean;
    officialWebsite: string;
    registrationUrl: string;
    apiKeyGuideUrl: string;
    officialDocsUrl: string;
    apiKeySteps: string[];
    commonErrors: string[];
    reviewedAt: string;
}
export declare const PROVIDER_CATALOG: ProviderCatalogEntry[];
export declare function getProvider(providerId: string): ProviderCatalogEntry | undefined;
export declare function getProviderEndpoint(providerId: string, endpointId?: string): {
    provider: ProviderCatalogEntry;
    endpoint: ProviderEndpoint;
} | undefined;
export declare function publicProviderCatalog(): ProviderCatalogEntry[];
//# sourceMappingURL=provider-catalog.d.ts.map