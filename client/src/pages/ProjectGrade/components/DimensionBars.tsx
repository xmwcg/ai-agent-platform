import React from 'react';

export interface DimensionBar {
  dimensionKey: string;
  label: string;
  weight: number;
  rawScore: number;
  normalizedScore: number;     // 0-100
  gateSeverity?: 'P0' | 'P1' | 'P2' | 'P3' | null;
}

export const DimensionBars: React.FC<{ rows: DimensionBar[] }> = ({ rows }) => {
  if (!rows || rows.length === 0) {
    return <div style={{ color: '#94a3b8', fontSize: 13 }}>暂无维度数据</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map((row) => {
        const percent = Math.max(0, Math.min(100, row.normalizedScore));
        const fill = percentToColor(percent);
        const mutedByGate =
          row.gateSeverity === 'P1' || row.gateSeverity === 'P0';
        return (
          <div key={row.dimensionKey} style={{ opacity: mutedByGate ? 0.92 : 1 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                fontSize: 13,
                color: '#0f172a',
                marginBottom: 4,
              }}
            >
              <span style={{ fontWeight: 600 }}>{row.label}</span>
              <span style={{ color: '#475569' }}>
                {row.rawScore.toFixed(1)} / {row.weight} · {percent.toFixed(0)}%
              </span>
            </div>
            <div
              style={{
                position: 'relative',
                height: 10,
                borderRadius: 999,
                background: 'rgba(15, 23, 42, 0.06)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${percent}%`,
                  height: '100%',
                  background: fill,
                  transition: 'width 600ms ease',
                }}
              />
            </div>
            {row.gateSeverity && (
              <div
                style={{
                  fontSize: 11,
                  marginTop: 4,
                  color: row.gateSeverity === 'P0' ? '#dc2626' : '#f97316',
                }}
              >
                ⚠ 受 {row.gateSeverity} 门禁影响
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

function percentToColor(percent: number): string {
  if (percent >= 90) return '#0a7f3f';
  if (percent >= 75) return '#3b82f6';
  if (percent >= 60) return '#06b6d4';
  if (percent >= 40) return '#f59e0b';
  return '#dc2626';
}

export default DimensionBars;