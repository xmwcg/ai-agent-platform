/**
 * PageHeader — 统一页面标题组件
 * 提供：页面标题、副标题、操作区、可选统计标签
 */
import React from 'react';
import { Typography, Space, Tag } from 'antd';
import { useUIStore } from '@/stores/ui';

const { Title, Text } = Typography;

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  /** 右上角操作区 */
  extra?: React.ReactNode;
  /** 统计标签 */
  tags?: { label: string; value: string | number; color?: string }[];
  className?: string;
  style?: React.CSSProperties;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title, subtitle, icon, extra, tags, className, style,
}) => {
  const isMobile = useUIStore((s) => s.isMobile);

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: isMobile ? 12 : 16,
        marginBottom: isMobile ? 20 : 28,
        ...style,
      }}
    >
      {/* 左侧标题区 */}
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <Space align="center" size={10}>
          {icon && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: isMobile ? 36 : 40, height: isMobile ? 36 : 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
              color: '#fff', fontSize: isMobile ? 16 : 18,
            }}>
              {icon}
            </span>
          )}
          <div>
            <Title level={isMobile ? 4 : 3} style={{ margin: 0, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
              {title}
            </Title>
            {subtitle && (
              <Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 2 }}>
                {subtitle}
              </Text>
            )}
          </div>
        </Space>

        {/* 统计标签 */}
        {tags && tags.length > 0 && (
          <Space size={6} wrap style={{ marginTop: isMobile ? 8 : 12 }}>
            {tags.map((tag, i) => (
              <Tag key={i} color={tag.color || 'processing'} style={{ borderRadius: 6, fontSize: 12 }}>
                {tag.label}: <strong>{tag.value}</strong>
              </Tag>
            ))}
          </Space>
        )}
      </div>

      {/* 右侧操作区 */}
      {extra && <div style={{ flexShrink: 0 }}>{extra}</div>}
    </div>
  );
};

export default PageHeader;
