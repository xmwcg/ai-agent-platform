import React from 'react';
import { Modal, Button, Space, Typography, Tag, Divider, List } from 'antd';
import {
  CrownOutlined,
  ExclamationCircleOutlined,
  ThunderboltOutlined,
  ArrowRightOutlined,
  GiftOutlined,
  LoginOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;

interface QuotaExceededModalProps {
  visible: boolean;
  onClose: () => void;
  /** 后端返回的错误码 */
  code?: string;
  /** 后端返回的错误信息 */
  message?: string;
  /** 资源类型 */
  resource?: string;
  /** 当前用量 */
  used?: number;
  /** 当日上限 */
  limit?: number;
  /** 当前套餐 */
  currentPlan?: string;
  /** 后端下发的站内升级路径 */
  upgradeUrl?: string;
}

const PLAN_NAMES: Record<string, string> = {
  free: '免费版',
  pro: '专业版',
  max: '旗舰版',
  team: '团队版',
};

/** 资源中文名映射 */
const RESOURCE_LABELS: Record<string, string> = {
  ai_chat: 'AI 对话',
  rag_query: '知识检索',
  rag_upload: '文档上传',
  knowledge_create: '知识文档',
  mcp_call: 'MCP 工具调用',
  learning_path: '学习路径',
  code_explain: '代码解释',
  translate: '翻译',
  file_convert: '文件转换',
  plan_generate: '方案生成',
  media_gen: '媒体生成',
  cs_query: '智能客服',
  model_config: '模型配置',
  project_grade_url_scan: '智评通网址扫描',
  project_grade_source_scan: '智评通源码扫描',
  project_grade_evaluation: '智评通正式评估',
  project_grade_report_publish: '智评通正式报告发布',
  project_grade_report_download: '智评通 PDF 报告下载',
};

/**
 * 配额用尽 / 成本超限 全局弹窗
 * 由 api.ts 响应拦截器统一触发
 */
export default function QuotaExceededModal({
  visible,
  onClose,
  code,
  message,
  resource,
  used,
  limit,
  currentPlan,
  upgradeUrl,
}: QuotaExceededModalProps) {
  const navigate = useNavigate();

  const isCostBudget = code === 'COST_BUDGET_EXCEEDED';
  const isPlanRequired =
    code === 'PLAN_REQUIRED' ||
    code?.endsWith('_PLAN_REQUIRED') === true ||
    (code === 'PROJECT_GRADE_QUOTA_EXCEEDED' && limit === 0);
  const isAnon = code === 'ANON_FREE_LIMIT';
  const isApiQuota = code === 'API_QUOTA_EXCEEDED' || code === 'ANON_MEDIA_QUOTA_EXCEEDED';
  /** 成本/额度/匿名超限时，提示 BYOK 零成本路径 */
  const showByok = isCostBudget || isApiQuota || isAnon;
  const resourceLabel = resource ? RESOURCE_LABELS[resource] || resource : '该功能';
  /** 是否已登录（localStorage token 存在即视为已登录） */
  const isLoggedIn = !!localStorage.getItem('token');

  const title = isAnon
    ? '免费体验次数已用尽'
    : isCostBudget
      ? '今日 AI 成本预算已用尽'
      : isPlanRequired
        ? '该功能需要升级套餐'
        : isApiQuota
          ? '调用额度已用尽'
          : '今日配额已用尽';

  const defaultMsg = isAnon
    ? '免费体验次数已用完。登录即可领取每日免费额度，或升级套餐 / 改用自带 Key（BYOK）零成本继续。'
    : isCostBudget
      ? '为保障平台稳定，您今日的 AI 调用成本已达上限。可升级套餐或改用自带 Key（BYOK）继续。'
      : isPlanRequired
        ? '当前套餐不支持该功能，升级即可解锁。'
        : `当前 ${PLAN_NAMES[currentPlan || 'free'] || '免费版'} 的「${resourceLabel}」今日配额已用尽，升级套餐以获得更多额度。`;

  const handleUpgrade = () => {
    onClose();
    navigate(upgradeUrl || '/pricing');
  };

  const handleLogin = () => {
    onClose();
    navigate('/login?redirect=' + encodeURIComponent('/ai-chat'));
  };

  const handlePoints = () => {
    onClose();
    navigate('/points-center');
  };

  const handleByok = () => {
    onClose();
    navigate('/model-config');
  };

  const handleContact = () => {
    onClose();
    // 企业微信 / 客服联系（可替换为实际联系方式）
    window.open('https://work.weixin.qq.com/', '_blank');
  };

  return (
    <Modal open={visible} onCancel={onClose} footer={null} width={520} centered destroyOnClose>
      <div style={{ textAlign: 'center', padding: '8px 0 0' }}>
        <ExclamationCircleOutlined style={{ fontSize: 48, color: '#faad14' }} />
        <Title level={4} style={{ marginTop: 12 }}>
          {title}
        </Title>
      </div>

      <Paragraph type="secondary" style={{ textAlign: 'center', fontSize: 14 }}>
        {message || defaultMsg}
      </Paragraph>

      {/* 用量进度条 */}
      {!isPlanRequired && used !== undefined && limit !== undefined && limit > 0 && (
        <div
          style={{
            margin: '16px 0',
            padding: '12px 16px',
            background: '#f6f8fa',
            borderRadius: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 13 }}>{resourceLabel} 今日用量</Text>
            <Text style={{ fontSize: 13, fontWeight: 600 }}>
              {used} / {limit === -1 ? '∞' : limit}
            </Text>
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 4,
              background: '#e5e7eb',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                borderRadius: 4,
                background: used >= limit ? '#ff4d4f' : '#6c5ce7',
                width: `${Math.min(100, (used / limit) * 100)}%`,
                transition: 'width 0.3s',
              }}
            />
          </div>
        </div>
      )}

      <Divider style={{ margin: '16px 0' }} />

      {/* 自带 Key（BYOK）零成本路径提示 */}
      {showByok && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '12px 14px',
            marginBottom: 16,
            background: '#eef2ff',
            borderRadius: 10,
            border: '1px solid #c7d2fe',
          }}
        >
          <KeyOutlined style={{ fontSize: 18, color: '#4f46e5', marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <Text strong style={{ fontSize: 13, color: '#3730a3' }}>
              不想花钱？用自带 Key（BYOK）零成本继续
            </Text>
            <div style={{ fontSize: 12, color: '#4b5563', marginTop: 2 }}>
              在「模型配置」填入自己的大模型 API Key，平台零垫付，畅用无忧。
            </div>
            <Button
              type="link"
              size="small"
              onClick={handleByok}
              style={{ padding: '2px 0', height: 'auto' }}
            >
              去配置模型 Key
            </Button>
          </div>
        </div>
      )}

      {/* 升级引导 */}
      <div
        style={{
          padding: '16px',
          borderRadius: 12,
          background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)',
          color: '#fff',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <CrownOutlined style={{ fontSize: 20 }} />
          <Text strong style={{ color: '#fff', fontSize: 16 }}>
            升级套餐，解锁更多能力
          </Text>
        </div>
        <List
          size="small"
          dataSource={[
            '大幅提升每日配额上限',
            '无限 AI 对话 / 知识检索（旗舰版）',
            '接入自定义大模型（BYOK）',
            '优先客服支持',
            '专业版仅 ¥9.9/月（竞品 ¥99/月）· 旗舰版 ¥19.9/月（竞品 ¥145/月）',
          ]}
          renderItem={(item) => (
            <List.Item style={{ color: '#fff', padding: '2px 0', border: 'none' }}>
              <ThunderboltOutlined style={{ marginRight: 6 }} />
              {item}
            </List.Item>
          )}
        />
      </div>

      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        {isLoggedIn ? (
          <>
            <Button
              type="primary"
              size="large"
              block
              icon={<ArrowRightOutlined />}
              onClick={handleUpgrade}
              style={{
                background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
                border: 'none',
                borderRadius: 10,
                fontWeight: 600,
              }}
            >
              查看套餐并升级
            </Button>
            <Button
              size="large"
              block
              icon={<GiftOutlined />}
              onClick={handlePoints}
              style={{ borderRadius: 10 }}
            >
              用积分抵扣继续
            </Button>
          </>
        ) : (
          <>
            <Button
              type="primary"
              size="large"
              block
              icon={<LoginOutlined />}
              onClick={handleLogin}
              style={{
                background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
                border: 'none',
                borderRadius: 10,
                fontWeight: 600,
              }}
            >
              登录领取免费额度
            </Button>
            <Button
              size="large"
              block
              icon={<ArrowRightOutlined />}
              onClick={handleUpgrade}
              style={{ borderRadius: 10 }}
            >
              查看套餐并升级
            </Button>
          </>
        )}
        <Button size="large" block onClick={handleContact} style={{ borderRadius: 10 }}>
          联系客服定制方案
        </Button>
        <Button type="link" block onClick={onClose} style={{ color: '#999' }}>
          暂不升级，我知道了
        </Button>
      </Space>
    </Modal>
  );
}

/**
 * 全局单例：在 App 层挂载一次，通过事件总线触发显示。
 * 各页面无需单独引入，由 api.ts 拦截器统一调用。
 */
import { useEffect, useRef, useCallback } from 'react';

// 简单的事件总线，用于跨组件触发弹窗
type QuotaEvent = {
  code?: string;
  message?: string;
  resource?: string;
  used?: number;
  limit?: number;
  currentPlan?: string;
  upgradeUrl?: string;
};

const listeners = new Set<(e: QuotaEvent) => void>();

export function triggerQuotaModal(e: QuotaEvent) {
  listeners.forEach((fn) => fn(e));
}

/** 在 App.tsx 中挂载此 Provider（全局单例） */
export function QuotaExceededProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = React.useState(false);
  const [event, setEvent] = React.useState<QuotaEvent>({});
  const ref = useRef(false);

  const show = useCallback((e: QuotaEvent) => {
    setEvent(e);
    setVisible(true);
    ref.current = true;
  }, []);

  useEffect(() => {
    listeners.add(show);
    return () => {
      listeners.delete(show);
    };
  }, [show]);

  return (
    <>
      {children}
      <QuotaExceededModal
        visible={visible}
        onClose={() => setVisible(false)}
        code={event.code}
        message={event.message}
        resource={event.resource}
        used={event.used}
        limit={event.limit}
        currentPlan={event.currentPlan}
        upgradeUrl={event.upgradeUrl}
      />
    </>
  );
}
