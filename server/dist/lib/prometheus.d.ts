/**
 * Prometheus 指标导出（文本 exposition 格式，version 0.0.4）
 * 将 apm.collectApmMetrics() 的快照渲染为 Prometheus 可抓取的文本。
 *
 * 挂载方式（见 index.ts）：
 *   app.get('/api/metrics', requireAdmin, (_req, res) => {
 *     res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
 *     res.send(renderPrometheusMetrics(collectApmMetrics()));
 *   });
 */
import type { ApmSnapshot } from '../middleware/apm';
export declare function renderPrometheusMetrics(s: ApmSnapshot): string;
//# sourceMappingURL=prometheus.d.ts.map