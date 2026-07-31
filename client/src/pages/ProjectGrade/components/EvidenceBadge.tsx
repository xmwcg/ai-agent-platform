import React from 'react';

export type EvidenceLevelKey =
  | 'production_automatic'
  | 'ci_integration'
  | 'source_static'
  | 'documentation'
  | 'none';

export interface EvidenceBadgeProps {
  level: EvidenceLevelKey;
  compact?: boolean;
}

const LEVEL_META: Record<
  EvidenceLevelKey,
  { label: string; color: string; bg: string; factor: number; description: string }
> = {
  production_automatic: {
    label: '生产自动',
    color: '#047857',
    bg: 'rgba(16, 185, 129, 0.14)',
    factor: 1.0,
    description: '带 verifiedAt 的生产自动验证证据',
  },
  ci_integration: {
    label: 'CI 集成',
    color: '#0e7490',
    bg: 'rgba(8, 145, 178, 0.14)',
    factor: 0.9,
    description: 'CI、集成或端到端自动化证据',
  },
  source_static: {
    label: '源码静态',
    color: '#1d4ed8',
    bg: 'rgba(37, 99, 235, 0.14)',
    factor: 0.75,
    description: '源码、配置和静态实现线索',
  },
  documentation: {
    label: '文档声明',
    color: '#a16207',
    bg: 'rgba(202, 138, 4, 0.14)',
    factor: 0.4,
    description: '文档声明或计划',
  },
  none: {
    label: '无证据',
    color: '#991b1b',
    bg: 'rgba(220, 38, 38, 0.14)',
    factor: 0,
    description: '当前规则无任何证据支撑',
  },
};

export const EvidenceBadge: React.FC<EvidenceBadgeProps> = ({ level, compact = false }) => {
  const meta = LEVEL_META[level] || LEVEL_META.none;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: compact ? '2px 6px' : '3px 10px',
        borderRadius: 999,
        backgroundColor: meta.bg,
        color: meta.color,
        fontSize: compact ? 11 : 12,
        fontWeight: 600,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}
      title={`${meta.label} · 系数 ${meta.factor} · ${meta.description}`}
    >
      <span
        aria-hidden
        style={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: meta.color,
        }}
      />
      {compact ? meta.label : `${meta.label} · ${meta.factor}`}
    </span>
  );
};

export const EVIDENCE_LEVELS: EvidenceLevelKey[] = [
  'production_automatic',
  'ci_integration',
  'source_static',
  'documentation',
  'none',
];

export const EVIDENCE_LEVEL_META = LEVEL_META;
export default EvidenceBadge;