import React from 'react';
import { Tag } from 'antd';

export interface PublicReportFinding {
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  dimensionKey: string;
  title: string;
}

const SEVERITY_META: Record<'P0' | 'P1' | 'P2' | 'P3', { color: string; label: string; desc: string }> = {
  P0: {
    color: '#dc2626',
    label: 'P0 · 阻断',
    desc: '隐私泄露 / 越权 / 支付可篡改 / RCE / Mock 冒充真实 — 最高 39 分禁止上线',
  },
  P1: {
    color: '#f97316',
    label: 'P1 · 红线',
    desc: '登录 / 支付 / 权益 / AI 核心 / License 不可用 — 最高 59 分禁止收费销售',
  },
  P2: {
    color: '#f59e0b',
    label: 'P2 · 阻断',
    desc: '主要功能仍为演示桩 / 退款售后缺失 — 最高 69 分',
  },
  P3: {
    color: '#0e7490',
    label: 'P3 · 缓办',
    desc: '监控 / 测试 / 性能 / 帮助文档不完整 — 最高 79 分',
  },
};

export const FindingList: React.FC<{ items: PublicReportFinding[]; max?: number }> = ({
  items,
  max,
}) => {
  const list = Array.isArray(items) ? items : [];
  const visible = typeof max === 'number' ? list.slice(0, max) : list;
  if (visible.length === 0) {
    return <div style={{ color: '#94a3b8', fontSize: 13 }}>暂无问题清单</div>;
  }
  return (
    <ul
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {visible.map((item, idx) => {
        const meta = SEVERITY_META[item.severity];
        return (
          <li
            key={`${item.severity}-${item.dimensionKey}-${idx}`}
            style={{
              padding: '10px 12px',
              border: `1px solid ${meta.color}33`,
              background: `${meta.color}0d`,
              borderRadius: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag color={meta.color}>{meta.label}</Tag>
              <span style={{ fontSize: 12, color: '#475569' }}>{item.dimensionKey}</span>
            </div>
            <div style={{ marginTop: 4, fontWeight: 600, color: '#0f172a', fontSize: 14 }}>
              {item.title}
            </div>
          </li>
        );
      })}
      {max != null && list.length > max && (
        <li style={{ fontSize: 12, color: '#64748b' }}>另有 {list.length - max} 条未完全展示</li>
      )}
    </ul>
  );
};

export const FINDING_SEVERITY_META = SEVERITY_META;
export default FindingList;