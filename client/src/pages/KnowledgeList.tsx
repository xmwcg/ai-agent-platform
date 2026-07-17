import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Tag, Button, Input, Space, Select, Typography,
  message, Modal, Dropdown, Tooltip, Badge, Segmented, Upload, TreeSelect,
  Empty, Skeleton,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  SearchOutlined, UnorderedListOutlined, AppstoreOutlined,
  UploadOutlined, DownloadOutlined, FileOutlined, SwapOutlined,
  MoreOutlined, ClockCircleOutlined, UserOutlined, FireOutlined,
} from '@ant-design/icons';
import { knowledgeAPI } from '@/services/api';
import FileConverter from '@/components/FileConverter';
import KnowledgeImport from '@/components/KnowledgeImport';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;

interface KnowledgeDocument {
  _id: string;
  title: string;
  content?: string;
  tags: string[];
  categories: string[];
  isPublic: boolean;
  viewCount: number;
  likeCount: number;
  format?: string;
  fileSize?: number;
  createdAt: string;
  updatedAt: string;
  author: { username: string };
  access?: string;
  requiredPlan?: string;
  creditsCost?: number;
  price?: number;
  freePreviewPages?: number;
}

const COLOR_LIST = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#f97316', '#3b82f6'];

export default function KnowledgeList() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 12, total: 0 });
  const [searchParams, setSearchParams] = useState({ search: '', tags: '', categories: '', categoryTree: '', sortBy: 'updatedAt', order: 'desc' });
  const [tags, setTags] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryTreeOptions, setCategoryTreeOptions] = useState<any[]>([]);
  const [accessFilter, setAccessFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [converterOpen, setConverterOpen] = useState(false);
  const [convertingFile, setConvertingFile] = useState<{ name: string; content?: string }>({ name: '' });
  const [importOpen, setImportOpen] = useState(false);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { ...searchParams, page: pagination.current, limit: pagination.pageSize };
      const response: any = await knowledgeAPI.list(params);
      if (response?.data) {
        setDocuments(response.data);
        setPagination((p) => ({ ...p, total: response.pagination?.total || 0 }));
      }
    } catch {
      message.error('加载文档失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, searchParams]);

  const loadMeta = async () => {
    try {
      const response: any = await knowledgeAPI.getMeta();
      if (response?.data) {
        setTags(response.data.tags || []);
        setCategories(response.data.categories || []);
      }
    } catch { /* ignore */ }
    try {
      const treeRes: any = await knowledgeAPI.getCategoryTree();
      if (treeRes?.data) setCategoryTreeOptions(treeRes.data);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadDocuments(); loadMeta(); }, [loadDocuments]);

  // 访问级别徽章：免费 / 会员专享 / 积分解锁
  const accessBadge = (doc: KnowledgeDocument): { text: string; color: string } | null => {
    if (doc.access === 'plan_locked') return { text: `${doc.requiredPlan === 'max' ? '旗舰' : '专业'}专享`, color: 'gold' };
    if (doc.access === 'credit_locked' || doc.creditsCost) return { text: `积分 ${doc.creditsCost || ''}`, color: 'purple' };
    if (doc.price) return { text: `¥${doc.price}`, color: 'green' };
    if (doc.access === 'preview' || doc.freePreviewPages) return { text: '免费试看', color: 'cyan' };
    return null;
  };

  const displayDocs = useMemo(() => {
    if (accessFilter === 'all') return documents;
    return documents.filter((d) => {
      if (accessFilter === 'free') return d.access === 'full' || d.access === undefined;
      if (accessFilter === 'plan') return d.access === 'plan_locked';
      if (accessFilter === 'credit') return d.access === 'credit_locked' || !!d.creditsCost;
      return true;
    });
  }, [documents, accessFilter]);

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除', content: '此操作不可恢复', okType: 'danger',
      onOk: async () => {
        await knowledgeAPI.delete(id).catch(() => {});
        message.success('已删除');
        loadDocuments();
      },
    });
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    Modal.confirm({
      title: `确认批量删除 ${selectedIds.length} 个文档？`, content: '此操作不可恢复', okType: 'danger',
      onOk: async () => {
        await Promise.allSettled(selectedIds.map((id) => knowledgeAPI.delete(id)));
        message.success(`已删除 ${selectedIds.length} 个文档`);
        setSelectedIds([]);
        loadDocuments();
      },
    });
  };

  const handleDownload = async (doc: KnowledgeDocument) => {
    setConvertingFile({ name: `${doc.title}.md`, content: doc.content });
    setConverterOpen(true);
  };

  const handleConvertAndDownload = (sourceFormat: string, targetFormat: string) => {
    message.info(`正在将 ${sourceFormat.toUpperCase()} 转换为 ${targetFormat.toUpperCase()} 并下载...`);
    // 实际转换逻辑由后端 API 实现
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  // 加载骨架屏
  if (loading && documents.length === 0) {
    return (
      <div style={{ padding: 16 }}>
        <Skeleton active paragraph={{ rows: 1 }} />
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Col xs={24} sm={12} md={8} lg={6} key={i}>
              <Card><Skeleton active /></Card>
            </Col>
          ))}
        </Row>
      </div>
    );
  }

  return (
    <div className="knowledge-page">
      {/* 顶栏 */}
      <div className="knowledge-header">
        <div>
          <Title level={3} style={{ margin: 0 }}>知识中枢</Title>
          <Text type="secondary">管理你的知识文档，支持多格式上传与格式转换</Text>
        </div>
        <Space>
          <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
            快速导入
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/knowledge/create')}>
            创建文档
          </Button>
        </Space>
      </div>

      {/* 工具栏 */}
      <div className="knowledge-toolbar">
        <Space size={12} wrap>
          <Search
            placeholder="搜索文档标题或内容..."
            allowClear
            onSearch={(v) => setSearchParams((p) => ({ ...p, search: v }))}
            style={{ width: 280 }}
            prefix={<SearchOutlined />}
          />
          <Select
            mode="multiple"
            placeholder="标签筛选"
            style={{ minWidth: 160 }}
            value={searchParams.tags ? searchParams.tags.split(',').filter(Boolean) : []}
            onChange={(v) => setSearchParams((p) => ({ ...p, tags: v.join(',') }))}
            options={tags.map((t) => ({ label: t, value: t }))}
            maxTagCount={2}
          />
          <Select
            mode="multiple"
            placeholder="分类筛选"
            style={{ minWidth: 160 }}
            value={searchParams.categories ? searchParams.categories.split(',').filter(Boolean) : []}
            onChange={(v) => setSearchParams((p) => ({ ...p, categories: v.join(',') }))}
            options={categories.map((c) => ({ label: c, value: c }))}
            maxTagCount={2}
          />
          <TreeSelect
            placeholder="业务分类树"
            allowClear
            multiple
            treeCheckable
            treeDefaultExpandAll
            style={{ minWidth: 200 }}
            value={searchParams.categoryTree ? searchParams.categoryTree.split(',').filter(Boolean) : []}
            onChange={(v: any) => setSearchParams((p) => ({ ...p, categoryTree: (v || []).join(',') }))}
            treeData={categoryTreeOptions}
            maxTagCount={2}
          />
        </Space>

        <Space>
          <Segmented
            size="small"
            value={accessFilter}
            onChange={(v) => setAccessFilter(v as string)}
            options={[
              { value: 'all', label: '全部' },
              { value: 'free', label: '免费' },
              { value: 'plan', label: '会员专享' },
              { value: 'credit', label: '积分' },
            ]}
          />
        </Space>

        <Space>
          {selectedIds.length > 0 && (
            <Button danger size="small" onClick={handleBatchDelete}>
              删除选中 ({selectedIds.length})
            </Button>
          )}
          <Segmented
            size="small"
            value={viewMode}
            onChange={(v) => setViewMode(v as 'card' | 'list')}
            options={[
              { value: 'card', icon: <AppstoreOutlined /> },
              { value: 'list', icon: <UnorderedListOutlined /> },
            ]}
          />
        </Space>
      </div>

      {/* 内容区 */}
      {displayDocs.length === 0 ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <Empty
            description={documents.length === 0 ? '暂无文档，开始创建或上传吧' : '该筛选条件下暂无文档'}
          >
            {documents.length === 0 && (
              <Space style={{ marginTop: 16 }}>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/knowledge/create')}>
                  创建文档
                </Button>
                <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
                  快速导入文件
                </Button>
              </Space>
            )}
          </Empty>
        </div>
      ) : viewMode === 'card' ? (
        <Row gutter={[16, 16]}>
          {displayDocs.map((doc, i) => (
            <Col xs={24} sm={12} md={8} lg={6} key={doc._id}>
              <Card
                className={`knowledge-card ${selectedIds.includes(doc._id) ? 'selected' : ''}`}
                hoverable
                onClick={() => navigate(`/knowledge/${doc._id}`)}
                cover={
                  <div
                    className="knowledge-card-cover"
                    style={{ background: `linear-gradient(135deg, ${COLOR_LIST[i % COLOR_LIST.length]}, ${COLOR_LIST[(i + 1) % COLOR_LIST.length]}88)` }}
                  >
                    <FileOutlined style={{ fontSize: 32, color: '#fff', opacity: 0.9 }} />
                    {doc.format && (
                      <Tag className="format-tag">{doc.format.toUpperCase()}</Tag>
                    )}
                  </div>
                }
                actions={[
                  <Tooltip title="查看" key="view"><EyeOutlined onClick={(e) => { e.stopPropagation(); navigate(`/knowledge/${doc._id}`); }} /></Tooltip>,
                  <Tooltip title="编辑" key="edit"><EditOutlined onClick={(e) => { e.stopPropagation(); navigate(`/knowledge/${doc._id}/edit`); }} /></Tooltip>,
                  <Tooltip title="下载/转换" key="convert"><SwapOutlined onClick={(e) => { e.stopPropagation(); handleDownload(doc); }} /></Tooltip>,
                  <Tooltip title="删除" key="del"><DeleteOutlined onClick={(e) => { e.stopPropagation(); handleDelete(doc._id); }} style={{ color: '#ef4444' }} /></Tooltip>,
                ]}
              >
                <Card.Meta
                  title={
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {doc.title}
                      </span>
                      {accessBadge(doc) && <Tag color={accessBadge(doc)!.color} style={{ marginInlineEnd: 0 }}>{accessBadge(doc)!.text}</Tag>}
                      {doc.viewCount > 100 && <Badge count="热" size="small" style={{ backgroundColor: '#f59e0b' }} />}
                    </div>
                  }
                  description={
                    <div>
                      <div style={{ marginBottom: 8 }}>
                        {doc.tags?.slice(0, 2).map((t) => (
                          <Tag key={t} color="blue" style={{ marginBottom: 4 }}>{t}</Tag>
                        ))}
                        {doc.tags?.length > 2 && <Tag>+{doc.tags.length - 2}</Tag>}
                      </div>
                      <Space size={12} style={{ fontSize: 12, color: '#94a3b8' }}>
                        <span><UserOutlined /> {doc.author?.username || '未知'}</span>
                        <span><ClockCircleOutlined /> {new Date(doc.createdAt).toLocaleDateString('zh-CN')}</span>
                      </Space>
                      <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: 12, color: '#94a3b8' }}>
                        <span><EyeOutlined /> {doc.viewCount}</span>
                        <span><FireOutlined /> {doc.likeCount || 0}</span>
                      </div>
                    </div>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <div className="knowledge-list-view">
          {displayDocs.map((doc, i) => (
            <div
              key={doc._id}
              className={`knowledge-list-item ${selectedIds.includes(doc._id) ? 'selected' : ''}`}
              onClick={() => navigate(`/knowledge/${doc._id}`)}
            >
              <div className="list-icon" style={{ background: COLOR_LIST[i % COLOR_LIST.length] }}>
                <FileOutlined style={{ color: '#fff' }} />
              </div>
              <div className="list-content">
                <Text strong style={{ fontSize: 15 }}>{doc.title}</Text>
                <Paragraph type="secondary" style={{ margin: '2px 0', fontSize: 13 }} ellipsis={{ rows: 1 }}>
                  {doc.tags?.join(' · ') || '无标签'}
                </Paragraph>
                <Space size={16} style={{ fontSize: 12, color: '#94a3b8' }}>
                  <span><UserOutlined /> {doc.author?.username}</span>
                  <span><ClockCircleOutlined /> {new Date(doc.updatedAt || doc.createdAt).toLocaleDateString('zh-CN')}</span>
                  <span>浏览 {doc.viewCount}</span>
                </Space>
              </div>
              <Space className="list-actions">
                <Button size="small" onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}>下载</Button>
                <Button size="small" type="primary" ghost onClick={(e) => { e.stopPropagation(); navigate(`/knowledge/${doc._id}/edit`); }}>编辑</Button>
              </Space>
            </div>
          ))}
        </div>
      )}

      {/* 分页信息 */}
      {pagination.total > pagination.pageSize && (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Button
            loading={loading}
            onClick={() => setPagination((p) => ({ ...p, current: p.current + 1, pageSize: p.pageSize }))}
            disabled={pagination.current * pagination.pageSize >= pagination.total}
          >
            加载更多 ({documents.length} / {pagination.total})
          </Button>
        </div>
      )}

      {/* 格式转换弹窗 */}
      <FileConverter
        open={converterOpen}
        onClose={() => setConverterOpen(false)}
        fileName={convertingFile.name}
        content={convertingFile.content}
        onConvert={handleConvertAndDownload}
      />

      {/* RAG 一键导入弹窗（对标 Dify 文档自动处理） */}
      <KnowledgeImport
        visible={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => loadDocuments()}
      />

      <style>{`
        .knowledge-page { padding: 0; }
        .knowledge-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          margin-bottom: 16px; flex-wrap: wrap; gap: 12px;
        }
        .knowledge-toolbar {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 16px; flex-wrap: wrap; gap: 8px;
        }
        .knowledge-card {
          border-radius: 12px; overflow: hidden; transition: all 0.3s;
        }
        .knowledge-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
        .knowledge-card.selected { border: 2px solid #6366f1; }
        .knowledge-card-cover {
          height: 100px; display: flex; align-items: center; justify-content: center;
          position: relative;
        }
        .format-tag {
          position: absolute; top: 8px; right: 8px;
          background: rgba(255,255,255,0.25); border: none; color: #fff;
          font-size: 10px; border-radius: 6px;
        }
        .knowledge-list-view {
          display: flex; flex-direction: column; gap: 4px;
        }
        .knowledge-list-item {
          display: flex; align-items: center; gap: 14px;
          padding: 12px 16px; border-radius: 10px;
          cursor: pointer; transition: all 0.2s;
          border: 1px solid #f0f0f0;
        }
        .knowledge-list-item:hover { background: #f8f9fb; border-color: #e2e8f0; }
        .knowledge-list-item.selected { border-color: #6366f1; background: #f0f4ff; }
        .list-icon {
          width: 44px; height: 44px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .list-content { flex: 1; min-width: 0; }
        .list-actions { opacity: 0; transition: opacity 0.2s; }
        .knowledge-list-item:hover .list-actions { opacity: 1; }
        @media (max-width: 768px) {
          .list-actions { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
