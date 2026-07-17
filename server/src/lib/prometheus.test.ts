import { renderPrometheusMetrics } from './prometheus';
import type { ApmSnapshot } from '../middleware/apm';

const snapshot: ApmSnapshot = {
  startedAt: Date.now(),
  uptimeSec: 123,
  requests: { total: 100, active: 2, errors: 5, errorRate: 5 },
  routes: {
    '/api/ai': {
      requests: 40,
      avgMs: 120,
      minMs: 10,
      maxMs: 900,
      errors: 2,
      errorRate: 5,
      histogram: [0, 0, 0, 0, 0, 0, 0],
    },
  },
  memory: { heapUsedMB: 50, heapTotalMB: 100, rssMB: 200, externalMB: 5 },
  slowLogs: [],
};

describe('renderPrometheusMetrics', () => {
  const out = renderPrometheusMetrics(snapshot);

  it('包含 HELP/TYPE 与全局计数器', () => {
    expect(out).toContain('# HELP ai_agent_http_requests_total');
    expect(out).toContain('ai_agent_http_requests_total 100');
    expect(out).toContain('ai_agent_http_errors_total 5');
    expect(out).toContain('ai_agent_http_active_requests 2');
  });

  it('包含按路由指标（标签 + 秒级耗时）', () => {
    expect(out).toContain('ai_agent_http_requests_by_route_total{route="/api/ai"} 40');
    expect(out).toContain('ai_agent_http_errors_by_route_total{route="/api/ai"} 2');
    expect(out).toContain('ai_agent_http_request_duration_seconds_avg{route="/api/ai"} 0.12');
    expect(out).toContain('ai_agent_http_request_duration_seconds_max{route="/api/ai"} 0.9');
  });

  it('包含进程/运行时指标（字节换算正确）', () => {
    expect(out).toContain('ai_agent_process_uptime_seconds 123');
    expect(out).toContain('ai_agent_nodejs_heap_used_bytes 52428800'); // 50MB
    expect(out).toContain('ai_agent_process_resident_memory_bytes 209715200'); // 200MB
  });

  it('以有效的 exposition 格式换行结尾', () => {
    expect(out.startsWith('# HELP')).toBe(true);
    expect(out.endsWith('\n')).toBe(true);
  });
});
