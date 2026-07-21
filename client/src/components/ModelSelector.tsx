import { useEffect, useState } from 'react';
import { Select, Spin } from 'antd';
import { gatewayAPI } from '@/services/api';

/**
 * 清理模型显示名称，用于 UI 展示（不暴露 mc_ 前缀）。
 * 输入格式：
 *   - "deepseek/deepseek-v4-flash" → "deepseek-v4-flash"
 *   - "mc_6a5901cbfabd866d80839427/Agnes-2.0-Flash" → "Agnes-2.0-Flash"
 *   - "mc_6a5901cbfabd866d80839427" → "自定义模型"
 *   - "agnes-image-2.0-flash" → "agnes-image-2.0-flash"
 */
export function cleanModelDisplay(raw: string): string {
  if (!raw) return "未选择";
  // Strip mc_<mongoid>/ prefix first
  const cleaned = raw.replace(/^mc_[a-f0-9]{20,30}\//, "").replace(/^mc_[a-f0-9]{20,30}$/, "");
  if (cleaned.includes("/")) {
    const parts = cleaned.split("/");
    const provider = parts[0] || "";
    const model = parts.slice(1).join("/");
    const BUILTIN = new Set(["deepseek","openai","anthropic","hunyuan","zhipu","qwen","doubao","moonshot","baichuan","yi","stepfun","iflytek","agnes","custom","mock"]);
    if (BUILTIN.has(provider.toLowerCase())) return model;
    if (provider.startsWith("mc_")) return model || "自定义模型";
    return cleaned;
  }
  if (cleaned.startsWith("mc_")) return "自定义模型";
  return cleaned;
}

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

// 后端不可用时的最小兜底；DeepSeek 为服务端私有接口，不进入公开选择器。
const FALLBACK: GatewayModelGroup[] = [
  { provider: 'cloudbase', label: 'CloudBase 免费额度', models: ['hy3', 'hy3-preview'] },
  { provider: 'agnes', label: 'Agnes AIHub', models: ['agnes-2.0-flash', 'agnes-image-2.0-flash', 'agnes-image-2.1-flash', 'agnes-video-v2.0'] },
];

function publicGroups(groups: GatewayModelGroup[]): GatewayModelGroup[] {
  return groups.filter((group) => group.provider.toLowerCase() !== 'deepseek');
}

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
          const filtered = publicGroups(data).map(g => ({ ...g, models: filterModels(g.models, mode) })).filter(g => g.models.length > 0);
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
    const first = groups.find((g) => (g.models || []).length > 0 && g.provider !== 'mc_' && !g.provider.startsWith('mc_'));
    const chosen = first || groups.find((g) => (g.models || []).length > 0);
    if (chosen && chosen.models[0]) {
      onChange?.(`${chosen.provider}/${chosen.models[0]}`);
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
      onChange={(val) => {
        // Normalize: ensure model name part is lowercase for consistent matching
        if (typeof val === "string" && val.includes("/")) {
          const [provider, ...rest] = val.split("/");
          val = provider + "/" + rest.join("/").toLowerCase();
        }
        onChange?.(val);
      }}
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

