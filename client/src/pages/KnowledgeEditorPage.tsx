import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Form, Input, Select, Space, Button, message, Spin, Typography, Switch, InputNumber, Tooltip } from 'antd';
import { SaveOutlined, ArrowLeftOutlined, TeamOutlined, CrownOutlined, LockOutlined, EyeOutlined } from '@ant-design/icons';
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
  creditsCost?: number;
  requiredPlan?: string;
  freePreviewPages?: number;
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
    teamId: '',
    creditsCost: 0,
    requiredPlan: 'free',
    freePreviewPages: 0,
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
    apiClient.get('/knowledge/' + id)
      .then((res: any) => {
        if (res.data) {
          setForm({
            title: res.data.title || '',
            content: res.data.content || '',
            tags: res.data.tags || [],
            categories: res.data.categories || [],
            isPublic: res.data.isPublic ?? true,
            teamId: res.data.teamId || '',
            creditsCost: res.data.creditsCost ?? 0,
            requiredPlan: res.data.requiredPlan || 'free',
            freePreviewPages: res.data.freePreviewPages ?? 0,
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

  // 加载我所在的团队
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
        await apiClient.put('/knowledge/' + id, payload);
        message.success('更新成功');
      } else {
        const res: any = await apiClient.post('/knowledge', payload);
        message.success('创建成功');
        navigate('/knowledge/' + (res.data?._id || res.data?.id || id), { replace: true });
        return;
      }
      navigate('/knowledge/' + id);
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
            <Button type="primary" icon={<SaveOutlined />} loading={saving}
              onClick={() => { /* 由编辑器内部按钮触发 handleSave */ }}>
              保存
            </Button>
          </Space>
        </div>

        <Form layout="vertical" size="large">
          <Form.Item label="标题" required>
            <Input value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="输入文档标题..." allowClear />
          </Form.Item>

          <Form.Item label="标签">
            <Select mode="tags" value={form.tags}
              onChange={tags => setForm(f => ({ ...f, tags }))}
              placeholder="输入标签后回车" style={{ width: '100%' }}
              options={tags.map(t => ({ label: t, value: t }))} />
          </Form.Item>

          <Form.Item label="分类">
            <Select mode="tags" value={form.categories}
              onChange={cats => setForm(f => ({ ...f, categories: cats }))}
              placeholder="输入分类后回车" style={{ width: '100%' }}
              options={categories.map(c => ({ label: c, value: c }))} />
          </Form.Item>

          <Form.Item label={<span><TeamOutlined /> 归属团队（可选）</span>} tooltip="选择后该文档仅团队成员可见/可编辑">
            <Select value={form.teamId || undefined}
              onChange={v => setForm(f => ({ ...f, teamId: v }))}
              placeholder="个人私有（不归属团队）" allowClear style={{ width: '100%' }}
              options={teams.map(t => ({ label: t.name, value: t._id }))} />
          </Form.Item>

          {/* 付费设置 */}
          <Form.Item label={<span><CrownOutlined /> 付费与权限设置</span>} tooltip="设置文档的访问门槛：会员等级要求、积分消耗、免费试看页数">
            <Card size="small" style={{ background: '#fafbff', border: '1px solid #eef1f5', borderRadius: 10 }}>
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <div>
                  <Text strong style={{ fontSize: 13 }}><CrownOutlined /> 会员等级要求</Text>
                  <Tooltip title="会员低于此等级时无法查看全文">
                    <Select value={form.requiredPlan || 'free'} style={{ width: 200, marginLeft: 12 }}
                      onChange={v => setForm(f => ({ ...f, requiredPlan: v }))}
                      options={[
                        { label: '免费（所有人可读）', value: 'free' },
                        { label: 'Pro 会员', value: 'pro' },
                        { label: 'Max 会员', value: 'max' },
                      ]} />
                  </Tooltip>
                </div>
                <div>
                  <Text strong style={{ fontSize: 13 }}><LockOutlined /> 消耗积分</Text>
                  <Tooltip title="用户查看全文需消耗的积分数，设为 0 则不消耗">
                    <InputNumber min={0} max={99999} value={form.creditsCost || 0} style={{ width: 150, marginLeft: 12 }}
                      onChange={v => setForm(f => ({ ...f, creditsCost: v || 0 }))}
                      addonAfter="积分" placeholder="0" />
                  </Tooltip>
                </div>
                <div>
                  <Text strong style={{ fontSize: 13 }}><EyeOutlined /> 免费试看页数</Text>
                  <Tooltip title="未解锁用户可免费预览的页数（每页约600字），设为 0 则不提供试看">
                    <InputNumber min={0} max={100} value={form.freePreviewPages || 0} style={{ width: 150, marginLeft: 12 }}
                      onChange={v => setForm(f => ({ ...f, freePreviewPages: v || 0 }))}
                      addonAfter="页" placeholder="0" />
                  </Tooltip>
                </div>
              </Space>
            </Card>
          </Form.Item>
        </Form>
      </Card>

      <Card>
        <KnowledgeEditor initialContent={form.content} onSave={handleSave} saving={saving} />
      </Card>
    </div>
  );
}