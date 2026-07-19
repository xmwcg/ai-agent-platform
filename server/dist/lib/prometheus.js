"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderPrometheusMetrics = renderPrometheusMetrics;
function fmt(n) {
    if (!Number.isFinite(n))
        return '0';
    // Prometheus 数值：保留 3 位小数，避免科学计数法
    return String(Math.round(n * 1000) / 1000);
}
function block(name, help, type, lines) {
    if (lines.length === 0)
        return '';
    return `# HELP ${name} ${help}\n# TYPE ${name} ${type}\n${lines.join('\n')}\n`;
}
function renderPrometheusMetrics(s) {
    const out = [];
    // ── 全局请求 / 错误 / 活跃 ──
    out.push(block('ai_agent_http_requests_total', 'Total HTTP requests since process start.', 'counter', [`ai_agent_http_requests_total ${fmt(s.requests.total)}`]));
    out.push(block('ai_agent_http_errors_total', 'Total HTTP errors (4xx/5xx) since process start.', 'counter', [`ai_agent_http_errors_total ${fmt(s.requests.errors)}`]));
    out.push(block('ai_agent_http_active_requests', 'Currently in-flight HTTP requests.', 'gauge', [`ai_agent_http_active_requests ${fmt(s.requests.active)}`]));
    // ── 按路由前缀 ──
    const reqLines = [];
    const errLines = [];
    const durAvg = [];
    const durMax = [];
    for (const [prefix, b] of Object.entries(s.routes)) {
        const labels = `{route="${prefix}"}`;
        reqLines.push(`ai_agent_http_requests_by_route_total${labels} ${fmt(b.requests)}`);
        errLines.push(`ai_agent_http_errors_by_route_total${labels} ${fmt(b.errors)}`);
        durAvg.push(`ai_agent_http_request_duration_seconds_avg${labels} ${fmt(b.avgMs / 1000)}`);
        durMax.push(`ai_agent_http_request_duration_seconds_max${labels} ${fmt(b.maxMs / 1000)}`);
    }
    out.push(block('ai_agent_http_requests_by_route_total', 'HTTP requests per route prefix.', 'counter', reqLines));
    out.push(block('ai_agent_http_errors_by_route_total', 'HTTP errors per route prefix.', 'counter', errLines));
    out.push(block('ai_agent_http_request_duration_seconds_avg', 'Average request duration per route (seconds).', 'gauge', durAvg));
    out.push(block('ai_agent_http_request_duration_seconds_max', 'Max request duration per route (seconds).', 'gauge', durMax));
    // ── 进程 / 运行时 ──
    out.push(block('ai_agent_process_uptime_seconds', 'Process uptime in seconds.', 'gauge', [`ai_agent_process_uptime_seconds ${fmt(s.uptimeSec)}`]));
    out.push(block('ai_agent_process_resident_memory_bytes', 'Resident memory size in bytes.', 'gauge', [`ai_agent_process_resident_memory_bytes ${fmt(s.memory.rssMB * 1024 * 1024)}`]));
    out.push(block('ai_agent_nodejs_heap_used_bytes', 'Node.js heap used in bytes.', 'gauge', [`ai_agent_nodejs_heap_used_bytes ${fmt(s.memory.heapUsedMB * 1024 * 1024)}`]));
    return out.join('\n');
}
//# sourceMappingURL=prometheus.js.map