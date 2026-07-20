import { useEffect, useMemo, useRef, useState } from 'react';
import type { InputRef } from 'antd';
import { Button, Empty, Input, List, Modal, Space, Tag, Tooltip, Typography } from 'antd';
import { ArrowRightOutlined, LockOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import apiClient, { extractApiError } from '@/services/api';
import { POPULAR_QUERIES, visibleSiteFeatures, type SiteFeature } from '@/config/site-features';
import { useAuthStore } from '@/stores/auth';

const { Text } = Typography;

interface SearchResult {
  id: string;
  type: string;
  title: string;
  summary?: string;
  path: string;
  group: string;
  access: 'public' | 'authorized' | 'locked';
  score: number;
}

interface GlobalSearchProps {
  compact?: boolean;
}

function matchFeature(feature: SiteFeature, rawQuery: string): number {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return 0;
  const title = feature.title.toLowerCase();
  if (title === query) return 100;
  if (title.includes(query)) return 80;
  if (feature.aliases.some((value) => value.toLowerCase().includes(query))) return 65;
  if (feature.keywords.some((value) => value.toLowerCase().includes(query))) return 55;
  if (feature.description.toLowerCase().includes(query)) return 35;
  return 0;
}

export default function GlobalSearch({ compact = false }: GlobalSearchProps) {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.user?.role);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [remoteResults, setRemoteResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<InputRef>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const scrollRef = useRef(0);

  const features = useMemo(() => visibleSiteFeatures(role), [role]);
  const localResults = useMemo<SearchResult[]>(() => {
    const normalized = query.trim();
    if (!normalized) return [];
    return features
      .map((feature) => ({ feature, score: matchFeature(feature, normalized) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(({ feature, score }) => ({
        id: feature.id,
        type: 'feature',
        title: feature.title,
        summary: feature.description,
        path: feature.path,
        group: '功能直达',
        access: 'public',
        score,
      }));
  }, [features, query]);

  const results = useMemo(() => {
    const seen = new Set<string>();
    return [...localResults, ...remoteResults].filter((result) => {
      const key = `${result.type}:${result.path}:${result.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [localResults, remoteResults]);

  const groupedResults = useMemo(() => {
    const groups = new Map<string, SearchResult[]>();
    results.forEach((result) => {
      const rows = groups.get(result.group) || [];
      rows.push(result);
      groups.set(result.group, rows);
    });
    return [...groups.entries()];
  }, [results]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openSearch();
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setRemoteResults([]);
      setLoading(false);
      setError('');
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const response: any = await apiClient.get('/search', { params: { q: normalized, limit: 20 } });
        if (!cancelled) setRemoteResults(Array.isArray(response?.data) ? response.data : []);
      } catch (requestError) {
        if (!cancelled) {
          setRemoteResults([]);
          setError(extractApiError(requestError, '内容搜索暂不可用'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const openSearch = () => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    scrollRef.current = window.scrollY;
    setOpen(true);
    window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  };

  const closeSearch = (restoreScroll = true) => {
    setOpen(false);
    setQuery('');
    setRemoteResults([]);
    setError('');
    if (restoreScroll) {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: scrollRef.current, left: 0, behavior: 'instant' });
        returnFocusRef.current?.focus({ preventScroll: true });
      });
    }
  };

  const goTo = (path: string) => {
    setOpen(false);
    setQuery('');
    navigate(path);
  };

  return (
    <>
      {compact ? (
        <Tooltip title="全站搜索（Ctrl/Cmd + K）">
          <Button aria-label="打开全站搜索" type="text" icon={<SearchOutlined />} onClick={openSearch} />
        </Tooltip>
      ) : (
        <button
          type="button"
          aria-label="打开全站搜索"
          onClick={openSearch}
          style={{
            width: 'clamp(260px, 28vw, 400px)', height: 38, borderRadius: 10,
            border: '1px solid var(--border)', background: 'var(--bg-container)',
            display: 'flex', alignItems: 'center', gap: 9, padding: '0 12px',
            color: 'var(--text-tertiary)', cursor: 'pointer', minWidth: 0,
          }}
        >
          <SearchOutlined />
          <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            搜索功能、厂商、文档与知识内容
          </span>
          <Tag style={{ margin: 0, fontSize: 11 }}>Ctrl K</Tag>
        </button>
      )}

      <Modal
        title={<Space><SearchOutlined /><span>全站搜索</span></Space>}
        open={open}
        onCancel={() => closeSearch(true)}
        footer={null}
        width={720}
        destroyOnClose
        afterOpenChange={(visible) => visible && inputRef.current?.focus({ preventScroll: true })}
      >
        <Input
          ref={inputRef}
          size="large"
          allowClear
          value={query}
          maxLength={80}
          prefix={<SearchOutlined />}
          placeholder="例如：API Key、Base URL、DeepSeek、知识库、免费额度"
          onChange={(event) => setQuery(event.target.value)}
          onPressEnter={() => { if (results[0]) { closeSearch(false); navigate(results[0].path); } }}
        />

        {!query.trim() ? (
          <div style={{ marginTop: 20 }}>
            <Text strong>热门查询</Text>
            <Space wrap style={{ marginTop: 12 }}>
              {POPULAR_QUERIES.map((item) => (
                <Button key={item} size="small" onClick={() => setQuery(item)}>{item}</Button>
              ))}
            </Space>
            <div style={{ marginTop: 24 }}>
              <Text strong>常用功能</Text>
              <Space wrap style={{ marginTop: 12 }}>
                {features.filter((item) => ['query-center', 'model-config', 'knowledge', 'sandbox', 'pricing', 'points-center'].includes(item.id)).map((item) => (
                  <Button key={item.id} type="link" onClick={() => goTo(item.path)}>{item.title}</Button>
                ))}
              </Space>
            </div>
          </div>
        ) : (
          <div style={{ maxHeight: '58vh', overflowY: 'auto', marginTop: 16 }}>
            {error && <Text type="warning">{error}</Text>}
            {!loading && groupedResults.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到匹配内容，请尝试其他关键词" />
            ) : groupedResults.map(([group, rows]) => (
              <section key={group} style={{ marginBottom: 16 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{group}</Text>
                <List
                  loading={loading && group !== '功能直达'}
                  dataSource={rows}
                  renderItem={(item) => (
                    <List.Item
                      style={{ cursor: 'pointer', paddingInline: 4 }}
                      onClick={() => goTo(item.path)}
                      actions={[<ArrowRightOutlined key="go" />]}
                    >
                      <List.Item.Meta
                        title={<Space>{item.title}{item.access === 'locked' && <Tag icon={<LockOutlined />} color="gold">受限</Tag>}</Space>}
                        description={item.summary}
                      />
                    </List.Item>
                  )}
                />
              </section>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
