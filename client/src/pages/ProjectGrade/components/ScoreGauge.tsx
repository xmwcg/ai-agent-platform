import React from 'react';

export interface ScoreGaugeProps {
  score: number;            // 0-100
  verdict: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  size?: 'small' | 'medium' | 'large';
  showVerdict?: boolean;
  title?: string;
  description?: string;
}

const VERDICT_COLORS: Record<'S' | 'A' | 'B' | 'C' | 'D' | 'F', string> = {
  S: '#0a7f3f',
  A: '#3b82f6',
  B: '#06b6d4',
  C: '#f59e0b',
  D: '#f97316',
  F: '#dc2626',
};

const VERDICT_LABEL: Record<'S' | 'A' | 'B' | 'C' | 'D' | 'F', string> = {
  S: '标杆',
  A: '商用',
  B: '有限商用',
  C: '测试',
  D: '不可销售',
  F: '高风险',
};

const SIZE_TO_PX: Record<'small' | 'medium' | 'large', number> = {
  small: 96,
  medium: 144,
  large: 200,
};

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({
  score,
  verdict,
  size = 'medium',
  showVerdict = true,
  title,
  description,
}) => {
  const diameter = SIZE_TO_PX[size];
  const stroke = Math.max(8, Math.round(diameter / 12));
  const radius = (diameter - stroke) / 2;
  const center = diameter / 2;
  const circumference = 2 * Math.PI * radius;
  const safeScore = Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - safeScore / 100);
  const color = VERDICT_COLORS[verdict] || VERDICT_COLORS.F;
  const labelFont = size === 'large' ? 38 : size === 'medium' ? 28 : 22;
  const subFont = size === 'large' ? 14 : size === 'medium' ? 12 : 10;

  return (
    <div
      role="img"
      aria-label={`评分 ${safeScore.toFixed(1)} / 100 · 等级 ${verdict}`}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <svg width={diameter} height={diameter} aria-hidden="true">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(15, 23, 42, 0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: 'stroke-dashoffset 800ms ease' }}
        />
        <text
          x={center}
          y={center - 4}
          textAnchor="middle"
          fontFamily="Inter, 'Segoe UI', sans-serif"
          fontSize={labelFont}
          fontWeight={800}
          fill="#0f172a"
        >
          {safeScore.toFixed(1)}
        </text>
        <text
          x={center}
          y={center + labelFont * 0.7}
          textAnchor="middle"
          fontFamily="Inter, 'Segoe UI', sans-serif"
          fontSize={subFont}
          fill={color}
          fontWeight={700}
        >
          {verdict} · {VERDICT_LABEL[verdict]}
        </text>
      </svg>
      {(title || description || showVerdict) && (
        <div style={{ textAlign: 'center', maxWidth: diameter + 80 }}>
          {title && (
            <div style={{ fontWeight: 700, fontSize: size === 'large' ? 18 : 14, color: '#0f172a' }}>
              {title}
            </div>
          )}
          {description && (
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{description}</div>
          )}
        </div>
      )}
    </div>
  );
};

export const PROJECTGRADE_VERDICT_COLORS = VERDICT_COLORS;
export const PROJECTGRADE_VERDICT_LABEL = VERDICT_LABEL;
export default ScoreGauge;