import React from 'react';
import { Tag } from 'antd';
import { PROJECTGRADE_VERDICT_COLORS, PROJECTGRADE_VERDICT_LABEL } from './ScoreGauge';

export interface GradeRibbonProps {
  score: number;            // 0-100
  verdict: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  gateBlocked?: 'P0' | 'P1' | 'P2' | 'P3' | null;
  projectName?: string;
  reportHref?: string;
  reportPublicId?: string;
  label?: string;
  compact?: boolean;
}

export const GradeRibbon: React.FC<GradeRibbonProps> = ({
  score,
  verdict,
  gateBlocked,
  projectName,
  reportHref,
  label = 'AIbak 智评通',
  compact = false,
}) => {
  const color = PROJECTGRADE_VERDICT_COLORS[verdict] || PROJECTGRADE_VERDICT_COLORS.F;
  const verdictLabel = PROJECTGRADE_VERDICT_LABEL[verdict];
  const safeScore = Math.max(0, Math.min(100, score));

  const inner = (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: compact ? '4px 10px' : '8px 14px',
        borderRadius: 999,
        background: 'rgba(15, 23, 42, 0.04)',
        border: `1px solid ${color}55`,
        fontSize: compact ? 12 : 14,
        color: '#0f172a',
      }}
    >
      <span style={{ fontWeight: 600 }}>{label}</span>
      <span
        style={{
          fontWeight: 800,
          color: '#fff',
          background: color,
          padding: compact ? '2px 8px' : '3px 10px',
          borderRadius: 999,
          fontSize: compact ? 12 : 14,
        }}
      >
        {verdict}
      </span>
      <span style={{ fontWeight: 700 }}>{safeScore.toFixed(1)}</span>
      <span style={{ color: '#475569' }}>/ 100 · {verdictLabel}</span>
      {gateBlocked && (
        <Tag color="red" style={{ marginInlineStart: 4 }}>
          {gateBlocked} 门禁
        </Tag>
      )}
      {projectName && (
        <span style={{ color: '#64748b', fontSize: compact ? 11 : 13 }}>
          · {projectName}
        </span>
      )}
    </div>
  );

  if (reportHref) {
    return (
      <a
        href={reportHref}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        {inner}
      </a>
    );
  }
  return inner;
};

export default GradeRibbon;