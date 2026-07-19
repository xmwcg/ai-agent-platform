import type { MCPServerConfig } from '../services/mcp.service';
import type { SkillPackage } from './package-types';
export type CatalogKind = 'mcp' | 'skill' | 'link';
export interface ExternalMarketEntry {
    id: string;
    name: string;
    source: string;
    kind: CatalogKind;
    category: string;
    description: string;
    officialUrl?: string;
    /** 安装后给用户的提示（如需要自行填写的密钥） */
    installHint?: string;
    mcpConfig?: MCPServerConfig;
    skillPackage?: SkillPackage;
}
export declare const CATALOG: ExternalMarketEntry[];
//# sourceMappingURL=external-market-catalog.d.ts.map