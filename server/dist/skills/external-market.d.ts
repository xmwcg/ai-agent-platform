/**
 * 外部技能市场「精选目录」（安全接入方案）
 * ----------------------------------------------------------------
 * 不实时联网、不在服务器执行任意代码；仅把可信的 MCP 服务器配置 /
 * 声明式技能包 / 工作流模板一键加入你自己的平台，连接凭证由用户本地填写。
 *
 * 来源覆盖：官方 MCP Registry、mcp.so、Smithery、Coze 商店、Dify 市场等。
 * 一键安装时：
 *   - kind=mcp      → 写入 MCP 服务器配置（需用户自行补充 env/密钥后连接）
 *   - kind=skill    → 写入用户技能库（prompt 类，走统一 AI 网关）
 *   - kind=link     → 仅跳转外部市场，不下发配置
 *
 * 注：静态目录数据（CATALOG / ExternalMarketEntry / CatalogKind）已抽离至
 *     ./external-market-catalog.ts，本文件只保留校验与获取逻辑。
 */
import { type ExternalMarketEntry } from './external-market-catalog';
export { type ExternalMarketEntry, type CatalogKind } from './external-market-catalog';
/**
 * 开放市场供应链护栏（纯函数，可单测）
 * ----------------------------------------------------------------
 * 即便未来开放用户提交外部 skill / MCP，也须经此校验，杜绝：
 * - command 不在白名单（如 bash / curl 任意执行）；
 * - args 含 shell 元字符或危险 flag（`; | &`\`$()`、`-e`/`--eval`、`rm -rf`）；
 * - officialUrl 为非 http(s) 的非常规协议（如 `javascript:`）。
 * 当前策展目录应全部通过；任何未通过项在 getCatalog 时被过滤，不参与安装。
 */
export declare const ALLOWED_MARKET_COMMANDS: string[];
export interface MarketEntryValidation {
    valid: boolean;
    reasons: string[];
}
export declare function validateExternalMarketEntry(entry: ExternalMarketEntry): MarketEntryValidation;
export declare function getCatalog(): ExternalMarketEntry[];
export declare function getCatalogEntry(id: string): ExternalMarketEntry | undefined;
//# sourceMappingURL=external-market.d.ts.map