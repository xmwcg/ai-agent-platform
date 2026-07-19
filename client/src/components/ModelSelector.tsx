import { useEffect, useState } from 'react';
import { Select, Spin } from 'antd';
import { gatewayAPI } from '@/services/api';

interface GatewayModelGroup {
  provider: string;
  label: string;
  models: string[];
  custom?: boolean;
}

interface ModelSelectorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  allowClear?: boolean;
  size?: 'small' | 'middle' | 'large';
  /** 首次加载且父组件未指定值时，自动选中第一个模型 */
  defaultToFirst?: boolean;
  /**
   * 自定义模型分组（复用本组件外观，但不走网关接口）。
   * 传此值后将忽略 /api/gateway/models，直接渲染给定分组。
   * 典型场景：模型配置页「测试连接」时，从当前配置自身的 models 列表里选模型。
   */
  customGroups?: GatewayModelGroup[];
  /** 过滤模式：chat-仅对话模型，image-仅图像模型，all-全部（默认） */
  mode?: 'chat' | 'image' | 'all';
}

// 后端不可用时的最小兜底（仅保证 UI 可用，不依赖外部 Key）
const FALLBACK: GatewayModelGroup[] = [
  { provider: 'deepseek', label: 'DeepSeek', models: ['deepseek-v4-pro', 'deepseek-v4-flash'] },
];

// 非对话模型关键词过滤
const NON_CHAT_PATTERNS = /image|video|vision|draw|paint|dall-e|midjourney|stability|sora/i;
const IMAGE_PATTERNS = /image|vision|draw|paint|dall-e|midjourney|stability/i;

function filterModels(models: string[], mode: string): string[] {
  if (mode === 'all') return models;
  if (mode === 'chat') return models.filter(m => !NON_CHAT_PATTERNS.test(m));
  if (mode === 'image') return models.filter(m => IMAGE_PATTERNS.test(m));
  return models;
}

/**
 * 统一模型选择器：数据源为 /api/gateway/models（内置厂商 + 用户自定义第三方模型）。
 * 选中值格式为 "provider/model"（自定义为 "mc_<id>/<model>"），可直接送统一网关路由。
 */
export default function ModelSelector(props: ModelSelectorProps) {
  const {
    value,
    onChange,
    placeholder = '选择模型',
    style,
    disabled,
    allowClear,
    size,
    defaultToFirst = true,
    customGroups,
    mode = 'all',
  } = props;

  const [groups, setGroups] = useState<GatewayModelGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 复用模式：直接使用外部给定分组，不请求网关
    if (customGroups) {
      const filtered = customGroups.map(g => ({ ...g, models: filterModels(g.models, mode) })).filter(g => g.models.length > 0);
      setGroups(filtered);
      setLoading(false);
      return;
    }
    let alive = true;
    gatewayAPI
      .getModels()
      .then((res: any) => {
        if (!alive) return;
        const data: GatewayModelGroup[] = res?.data;
        if (Array.isArray(data) && data.length) {
          const filtered = data.map(g => ({ ...g, models: filterModels(g.models, mode) })).filter(g => g.models.length > 0);
          setGroups(filtered.length > 0 ? filtered : FALLBACK);
        } else {
          setGroups(FALLBACK);
        }
      })
      .catch(() => {
        if (alive) setGroups(FALLBACK);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customGroups, mode]);

  // 首次加载且父组件未指定值时，自动选中第一个可用模型
  useEffect(() => {
    if (!defaultToFirst || loading) return;
    const first = groups.find((g) => (g.models || []).length > 0);
    if (first && first.models[0]) {
      onChange?.(`${first.provider}/${first.models[0]}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, groups]);

  const options = groups
    .filter((g) => (g.models || []).length > 0 || g.custom)
    .map((g) => ({
      label: g.label + (g.custom ? '（自定义）' : ''),
      options: g.models.map((m) => ({
        label: m,
        value: `${g.provider}/${m}`,
      })),
    }));

  return (
    <Select
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={style}
      disabled={disabled}
      allowClear={allowClear}
      size={size}
      showSearch
      optionFilterProp="label"
      loading={loading}
      options={options}
      notFoundContent={loading ? <Spin size="small" /> : null}
    />
  );
}
