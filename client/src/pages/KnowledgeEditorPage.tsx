import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Form, Input, Select, Space, Button, message, Spin, Typography, Switch } from 'antd';
import { SaveOutlined, ArrowLeftOutlined, TeamOutlined } from '@ant-design/icons';
import apiClient, { teamAPI , extractApiError} from '@/services/api';
import KnowledgeEditor from '@/components/KnowledgeEditor';

const { Title, Text } = Typography;

interface KnowledgeDoc {
  _id?: string;
  title: string;
  content: string;
  tags: string[];
  categories: string[];
  isPublic: boolean;
  teamId?: string;
}

export default function KnowledgeEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form, setForm] = useState<KnowledgeDoc>({
    title: '',
    content: '',
    tags: [],
    categories: [],
    isPublic: true,
    teamId: ''
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [teams, setTeams] = useState<{ _id: string; name: string }[]>([]);

  // 加载文档（编辑模式）
  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    apiClient.get(`/knowledge/${id}`)
      .then((res: any) => {
        if (res.data) {
          setForm({
            title: res.data.title || '',
            content: res.data.content || '',
            tags: res.data.tags || [],
            categories: res.data.categories || [],
            isPublic: res.data.isPublic ?? true
          });
        }
      })
      .catch(() => message.error('加载文档失败'))
      .finally(() => setLoading(false));
  }, [id]);

  // 加载标签/分类选项
  useEffect(() => {
    apiClient.get('/knowledge/meta/tags-and-categories')
      .then((res: any) => {
        if (res.data) {
          setTags(res.data.tags || []);
          setCategories(res.data.categories || []);
        }
      })
      .catch(() => {});
  }, []);

  // 加载我所在的团队（用于资源级归属）
  useEffect(() => {
    teamAPI.mine().then((r: any) => setTeams(r.data || [])).catch(() => {});
  }, []);

  const handleSave = async (htmlContent: string) => {
    if (!form.title.trim()) {
      message.warning('请输入文档标题');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, content: htmlContent, teamId: form.teamId || undefined };
      if (isEdit) {
        await apiClient.put(`/knowledge/${id}`, payload);
        message.success('更新成功');
      } else {
        const res: any = await apiClient.post('/knowledge', payload);
        message.success('创建成功');
        navigate(`/knowledge/${res.data?._id || res.data?.id || id}`, { replace: true });
        return;
      }
      navigate(`/knowledge/${id}`);
    } catch (err) {
      message.error(extractApiError(err, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: 100 }}>
          <Spin size="large" /><p>加载中...</p>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/knowledge')}>返回列表</Button>
            <Title level={3} style={{ margin: 0 }}>
              {isEdit ? '编辑文档' : '创建文档'}
            </Title>
          </Space>
          <Space>
            <Text type="secondary">公开：</Text>
            <Switch checked={form.isPublic} onChange={v => setForm(f => ({ ...f, isPublic: v }))} />
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={() => {
                // 触发编辑器保存（通过 ref 或状态提升）
                // 此处由编辑器内部按钮触发 handleSave
              }}
            >
              保存
            </Button>
          </Space>
        </div>

        <Form layout="vertical" size="large">
          <Form.Item label="标题" required>
            <Input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="输入文档标题..."
              allowClear
            />
          </Form.Item>

          <Form.Item label="标签">
            <Select
              mode="tags"
              value={form.tags}
              onChange={tags => setForm(f => ({ ...f, tags }))}
              placeholder="输入标签后回车"
              style={{ width: '100%' }}
              options={tags.map(t => ({ label: t, value: t }))}
            />
          </Form.Item>

          <Form.Item label="分类">
            <Select
              mode="tags"
              value={form.categories}
              onChange={cats => setForm(f => ({ ...f, categories: cats }))}
              placeholder="输入分类后回车"
              style={{ width: '100%' }}
              options={categories.map(c => ({ label: c, value: c }))}
            />
          </Form.Item>

          <Form.Item label={<span><TeamOutlined /> 归属团队（可选，团队资源级隔离）</span>} tooltip="选择后该文档仅团队成员可见/可编辑">
            <Select
              value={form.teamId || undefined}
              onChange={v => setForm(f => ({ ...f, teamId: v }))}
              placeholder="个人私有（不归属团队）"
              allowClear
              style={{ width: '100%' }}
              options={teams.map(t => ({ label: t.name, value: t._id }))}
            />
          </Form.Item>
        </Form>
      </Card>

      {/* Tiptap 编辑器 */}
      <Card>
        <KnowledgeEditor
          initialContent={form.content}
          onSave={handleSave}
          saving={saving}
        />
      </Card>
    </div>
  );
}
