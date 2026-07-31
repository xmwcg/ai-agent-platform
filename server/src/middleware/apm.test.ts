import { evaluateAlert, DEFAULT_ALERT_THRESHOLDS } from './apm';

describe('evaluateAlert', () => {
  it('空桶不告警', () => {
    expect(evaluateAlert({ count: 0, errors: 0, slow: 0 })).toBeNull();
  });

  it('错误率超阈值触发 error_rate', () => {
    expect(evaluateAlert({ count: 10, errors: 3, slow: 0 })).toBe('error_rate'); // 0.3 >= 0.2
    expect(evaluateAlert({ count: 10, errors: 1, slow: 0 })).toBeNull(); // 0.1 < 0.2
  });

  it('慢请求占比超阈值触发 slow_rate', () => {
    expect(evaluateAlert({ count: 10, errors: 0, slow: 5 })).toBe('slow_rate'); // 0.5 >= 0.3
    expect(evaluateAlert({ count: 10, errors: 0, slow: 2 })).toBeNull(); // 0.2 < 0.3
  });

  it('自定义阈值生效（覆盖默认）', () => {
    expect(
      evaluateAlert({ count: 10, errors: 1, slow: 0 }, { errorRate: 0.05, slowRate: 0.9 })
    ).toBe('error_rate');
  });

  it('默认阈值与导出常量一致', () => {
    expect(DEFAULT_ALERT_THRESHOLDS).toEqual({ errorRate: 0.2, slowRate: 0.3 });
  });
});
