/**
 * 骨架屏 / Loading / 空状态 / 错误状态 组件库
 * 统一全站的过渡态与异常态体验，替换裸 Spin/Empty 组件。
 */
import React from 'react';
import { Skeleton, Row, Col, Button, Result, Card, Typography, Space } from 'antd';
import {
  ReloadOutlined, ExclamationCircleOutlined,
  InboxOutlined, SearchOutlined,
} from '@ant-design/icons';
import { RADIUS, SPACING } from '../theme/tokens';

const { Text, Title } = Typography;

// ──────────────────────────── 骨架屏 ────────────────────────────

/** 卡片骨架屏 */
export const SkeletonCard: React.FC = () => (
  <Card style={{ borderRadius: RADIUS.lg }}>
    <Skeleton active avatar={{ shape: 'square', size: 'large' }} paragraph={{ rows: 3 }} />
  </Card>
);

/** 卡片网格骨架屏 */
export const SkeletonCardGrid: React.FC<{
  count?: number;
  columns?: number;
  minWidth?: number;
}> = ({ count = 6, columns = 3, minWidth = 280 }) => (
  <Row gutter={[SPACING.md, SPACING.md]}>
    {Array.from({ length: count }).map((_, i) => (
      <Col key={i} xs={24} sm={12} md={24 / columns} style={{ minWidth }}>
        <SkeletonCard />
      </Col>
    ))}
  </Row>
);

/** 列表骨架屏 */
export const SkeletonList: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <Card style={{ borderRadius: RADIUS.lg }}>
    <Skeleton active avatar paragraph={{ rows: 1 }} />
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} style={{ marginTop: SPACING.md }}>
        <Skeleton active title={false} paragraph={{ rows: 1 }} />
      </div>
    ))}
  </Card>
);

/** 详情页骨架屏 */
export const SkeletonDetail: React.FC = () => (
  <Card style={{ borderRadius: RADIUS.lg }}>
    <Skeleton active avatar={{ shape: 'square', size: 64 }} paragraph={{ rows: 2 }} />
    <div style={{ marginTop: SPACING.xl }}>
      <Skeleton active paragraph={{ rows: 8 }} />
    </div>
  </Card>
);

/** 页面级骨架屏 */
export const SkeletonPage: React.FC<{ type?: 'cardGrid' | 'list' | 'detail' }> = ({ type = 'cardGrid' }) => {
  if (type === 'list') return <SkeletonList />;
  if (type === 'detail') return <SkeletonDetail />;
  return <SkeletonCardGrid />;
};

// ──────────────────────────── 空状态 ────────────────────────────

export interface EmptyStateProps {
  /** 空状态类型 */
  type?: 'default' | 'search' | 'network';
  title?: string;
  description?: string;
  /** 操作按钮：{ text, onClick } */
  action?: { text: string; onClick: () => void } | null;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

/** 通用空状态 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'default',
  title,
  description,
  action,
  icon,
  children,
}) => {
  const defaults: Record<string, { title: string; desc: string; icon: React.ReactNode }> = {
    default: {
      title: '暂无数据',
      desc: '这里还没有内容，快来创建第一个吧',
      icon: <InboxOutlined style={{ fontSize: 64, color: '#94a3b8' }} />,
    },
    search: {
      title: '未找到匹配结果',
      desc: '请尝试调整搜索条件或筛选条件',
      icon: <SearchOutlined style={{ fontSize: 64, color: '#94a3b8' }} />,
    },
    network: {
      title: '加载失败',
      desc: '请检查网络连接后重试',
      icon: <ExclamationCircleOutlined style={{ fontSize: 64, color: '#f59e0b' }} />,
    },
  };
  const config = defaults[type] || defaults.default;

  return (
    <Card style={{ borderRadius: RADIUS.lg, textAlign: 'center', padding: '40px 16px' }}>
      <div style={{ marginBottom: SPACING.lg }}>{icon || config.icon}</div>
      <Title level={4} style={{ marginBottom: 8 }}>{title || config.title}</Title>
      <Text type="secondary">{description || config.desc}</Text>
      <div style={{ marginTop: SPACING.lg }}>
        {action ? (
          <Button type="primary" onClick={action.onClick}>
            {action.text}
          </Button>
        ) : null}
        {children}
      </div>
    </Card>
  );
};

// ──────────────────────────── 错误边界 ────────────────────────────

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onRetry?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <Result
          status="error"
          title="页面渲染异常"
          subTitle={this.state.error?.message || '发生了未知错误'}
          extra={
            <Space>
              <Button onClick={() => window.location.reload()} icon={<ReloadOutlined />}>
                刷新页面
              </Button>
              <Button type="primary" onClick={this.handleRetry}>
                重试
              </Button>
            </Space>
          }
        />
      );
    }
    return this.props.children;
  }
}

// ──────────────────────────── 带加载状态的页面容器 ────────────────────────────

export interface PageContainerProps {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  /** 骨架屏类型 */
  skeletonType?: 'cardGrid' | 'list' | 'detail';
  /** 空状态配置 */
  emptyConfig?: Omit<EmptyStateProps, 'type'>;
  /** 错误重试 */
  onRetry?: () => void;
  children: React.ReactNode;
}

/** 统一的页面状态容器：loading → skeleton, error → error card, empty → empty card, normal → children */
export const PageContainer: React.FC<PageContainerProps> = ({
  loading,
  error,
  empty,
  skeletonType,
  emptyConfig,
  onRetry,
  children,
}) => {
  if (loading) return <SkeletonPage type={skeletonType} />;

  if (error) {
    return (
      <Card style={{ borderRadius: RADIUS.lg }}>
        <Result
          status="error"
          title="加载失败"
          subTitle={error}
          extra={
            onRetry && (
              <Button type="primary" onClick={onRetry} icon={<ReloadOutlined />}>
                重试
              </Button>
            )
          }
        />
      </Card>
    );
  }

  if (empty) return <EmptyState {...emptyConfig} />;

  return <>{children}</>;
};

// ──────────────────────────── 骨架按钮 ────────────────────────────

/** 加载态按钮：保留按钮文字占位，显示 loading 态 */
export const LoadingButton: React.FC<{
  loading: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'primary' | 'default';
  block?: boolean;
  style?: React.CSSProperties;
}> = ({ loading, children, ...rest }) => (
  <Button {...rest} loading={loading}>
    {loading ? '处理中...' : children}
  </Button>
);
