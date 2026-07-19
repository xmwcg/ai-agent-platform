"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_MARKET_COMMANDS = void 0;
exports.validateExternalMarketEntry = validateExternalMarketEntry;
exports.getCatalog = getCatalog;
exports.getCatalogEntry = getCatalogEntry;
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
const external_market_catalog_1 = require("./external-market-catalog");
/**
 * 开放市场供应链护栏（纯函数，可单测）
 * ----------------------------------------------------------------
 * 即便未来开放用户提交外部 skill / MCP，也须经此校验，杜绝：
 * - command 不在白名单（如 bash / curl 任意执行）；
 * - args 含 shell 元字符或危险 flag（`; | &`\`$()`、`-e`/`--eval`、`rm -rf`）；
 * - officialUrl 为非 http(s) 的非常规协议（如 `javascript:`）。
 * 当前策展目录应全部通过；任何未通过项在 getCatalog 时被过滤，不参与安装。
 */
exports.ALLOWED_MARKET_COMMANDS = ['node', 'npx'];
const SHELL_META_RE = /[;&|`$()<>\\]/;
const DANGEROUS_FLAG_RE = /^-{1,2}e(val)?$/;
const DANGEROUS_SUBSTR_RE = /rm\s+-rf/i;
function validateExternalMarketEntry(entry) {
    const reasons = [];
    if (!entry.id || !entry.name)
        reasons.push('缺少 id / name');
    if (!entry.source || entry.source.trim().length === 0)
        reasons.push('source 为空');
    if (entry.officialUrl && !/^https?:\/\//i.test(entry.officialUrl)) {
        reasons.push(`officialUrl 必须为 http(s)：${entry.officialUrl}`);
    }
    if (entry.kind === 'mcp' && entry.mcpConfig) {
        const cmd = entry.mcpConfig.command;
        if (!exports.ALLOWED_MARKET_COMMANDS.includes(cmd)) {
            reasons.push(`command 不在白名单：${cmd}`);
        }
        for (const arg of entry.mcpConfig.args ?? []) {
            if (typeof arg !== 'string')
                continue;
            if (SHELL_META_RE.test(arg) ||
                DANGEROUS_FLAG_RE.test(arg) ||
                DANGEROUS_SUBSTR_RE.test(arg)) {
                reasons.push(`args 含危险片段：${arg}`);
                break;
            }
        }
    }
    return { valid: reasons.length === 0, reasons };
}
function getCatalog() {
    // 供应链护栏：过滤掉任何未通过校验的条目
    return external_market_catalog_1.CATALOG.filter((e) => validateExternalMarketEntry(e).valid);
}
function getCatalogEntry(id) {
    const entry = external_market_catalog_1.CATALOG.find((e) => e.id === id);
    if (!entry)
        return undefined;
    return validateExternalMarketEntry(entry).valid ? entry : undefined;
}
//# sourceMappingURL=external-market.js.map