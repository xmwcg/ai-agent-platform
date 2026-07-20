import { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Button, Row, Col, Statistic, Table, Tag,
  Progress, message, Spin, Tabs, List, Space, Tooltip, Divider, Badge, Modal, Input,
} from 'antd';
import {
  GiftOutlined, CalendarOutlined, ThunderboltOutlined, TrophyOutlined,
  CheckCircleOutlined, StarFilled, RocketOutlined, TeamOutlined,
  ShareAltOutlined, CopyOutlined, QrcodeOutlined, CrownOutlined,
  DollarOutlined, ArrowUpOutlined, FireOutlined, LockOutlined,
} from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { pointsAPI, referralAPI, marketplaceAPI, extractApiError } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useResponsive } from '@/hooks/useResponsive';

const { Title, Paragraph, Text } = Typography;

const PLAN_LABEL: Record<string, { text: string; color: string }> = {
  free: { text: '免费版', color: 'default' },
  pro: { text: '专业版', color: 'blue' },
  max: { text: '旗舰版', color: 'gold' },
};

// 签到日历 - 显示最近7天
function WeekCalendar({ streak, checkedInToday }: { streak: number; checkedInToday: boolean }) {
  const days = ['一', '二', '三', '四', '五', '六', '日'];
  const today = new Date().getDay(); // 0=日, 1-6=一~六
  const adjustedToday = today === 0 ? 6 : today - 1; // 转为周一=0

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
      {days.map((d, i) => {
        const isPast = i < adjustedToday;
        const isToday = i === adjustedToday;
        const checked = isPast || (isToday && checkedInToday);
        const isStreakDay = streak > 0 && i >= adjustedToday - streak + 1 && i < adjustedToday;

        return (
          <div key={d} style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 36, height: 36, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: checked ? (isToday ? '#6366f1' : '#e0e7ff') : '#f5f5f5',
                color: checked ? (isToday ? '#fff' : '#6366f1') : '#bbb',
                fontWeight: isToday ? 700 : 500,
                fontSize: 13,
                border: isToday && !checkedInToday ? '2px dashed #6366f1' : '2px solid transparent',
                transition: 'all 0.3s',
              }}
            >
              {checked ? <CheckCircleOutlined style={{ fontSize: 14 }} /> : i + 1}
            </div>
            <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'block' }}>{d}</Text>
          </div>
        );
      })}
    </div>
  );
}

export default function PointsCenter() {
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  const user = useAuthStore((s) => s.user);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);

  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);

  // 签到状态
  const [checkinStatus, setCheckinStatus] = useState<any>(null);
  // 积分变动历史
  const [creditsHistory, setCreditsHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  // 推荐统计
  const [referralStats, setReferralStats] = useState<any>(null);
  const [referralCode, setReferralCode] = useState('');
  // 推荐/佣金列表
  const [referrals, setReferrals] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  // 分享弹窗
  const [shareModal, setShareModal] = useState(false);
  // 任务列表
  const [tasks, setTasks] = useState<any[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        pointsAPI.checkinStatus(),
        referralAPI.stats(),
        referralAPI.code(),
        pointsAPI.tasks(),
      ]);

      if (results[0].status === 'fulfilled') {
        setCheckinStatus((results[0].value as any)?.data || {});
      }
      if (results[1].status === 'fulfilled') {
        setReferralStats((results[1].value as any)?.data || {});
      }
      if (results[2].status === 'fulfilled') {
        setReferralCode((results[2].value as any)?.data?.referralCode || '');
      }
      if (results[3].status === 'fulfilled') {
        setTasks((results[3].value as any)?.data?.tasks || []);
      }
    } catch { /* fallback */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadCreditsHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res: any = await marketplaceAPI.usage();
      setCreditsHistory(Array.isArray(res?.data?.transactions || res?.data) ? (res?.data?.transactions || res?.data) : []);
    } catch { /* fallback */ }
    setHistoryLoading(false);
  }, []);

  useEffect(() => { loadCreditsHistory(); }, [loadCreditsHistory]);

  // 加载推荐/佣金列表（Tab 切换时）
  const loadTabData = async (tab: string) => {
    setTabLoading(true);
    try {
      if (tab === 'referrals') {
        const r: any = await referralAPI.list({ pageSize: 20 });
        setReferrals(r?.data?.items || []);
      } else if (tab === 'commissions') {
        const r: any = await referralAPI.commissions({ pageSize: 20 });
        setCommissions(r?.data?.items || []);
      }
    } catch { /* fallback */ }
    setTabLoading(false);
  };

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      const res: any = await pointsAPI.checkin();
      if (res?.data?.success) {
        message.success(res.data.message || '签到成功！');
        await loadAll();
        await fetchProfile();
        await loadCreditsHistory();
      } else {
        message.info(res?.data?.message || '今日已签到');
      }
    } catch (err: any) {
      const msg = extractApiError(err, '');
      if (msg) message.warning(msg);
    }
    setCheckingIn(false);
  };

  const copyReferralLink = () => {
    const link = `https://aibak.site/register?ref=${referralCode}`;
    navigator.clipboard.writeText(link).then(() => {
      message.success('邀请链接已复制到剪贴板');
    }).catch(() => {
      message.info('复制失败，请手动复制');
    });
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  const plan = user?.plan || 'free';
  const credits = user?.credits || 0;
  const checkedIn = checkinStatus?.checkedInToday || false;
  const streak = checkinStatus?.streak || 0;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Title level={isMobile ? 4 : 3}><GiftOutlined /> 积分中心</Title>

      {/* ─── 积分概览 ─── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="我的积分"
              value={credits}
              prefix={<ThunderboltOutlined />}
              suffix={
                <Tag color={PLAN_LABEL[plan]?.color} style={{ marginLeft: 8 }}>
                  {PLAN_LABEL[plan]?.text}
                </Tag>
              }
              valueStyle={{ color: '#6366f1', fontWeight: 700 }}
            />
            <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
              10 积分 = 1 次 API 调用
            </Paragraph>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="连续签到"
              value={streak}
              prefix={<FireOutlined style={{ color: '#f97316' }} />}
              suffix="天"
              valueStyle={{ fontWeight: 700 }}
            />
            <div style={{ marginTop: 8 }}>
              <Progress percent={Math.min((streak % 7) / 7 * 100, 100)} size="small"
                strokeColor="#6366f1" showInfo={false}
                format={() => `${7 - (streak % 7)}天后额外+30`} />
              <Text style={{ fontSize: 11, color: '#94a3b8' }}>
                距周奖励还有 {7 - (streak % 7)} 天
              </Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="佣金余额"
              value={(referralStats?.pendingCommission || 0) / 100}
              prefix={<DollarOutlined style={{ color: '#10b981' }} />}
              suffix="¥"
              precision={2}
              valueStyle={{ color: '#10b981', fontWeight: 700 }}
            />
            <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
              累计推荐 {referralStats?.directReferrals || 0} 人
            </Paragraph>
          </Card>
        </Col>
      </Row>

      {/* ─── 每日签到区 ─── */}
      <Card
        style={{ marginBottom: 16, background: checkedIn ? '#f8fafc' : 'linear-gradient(135deg, #eef2ff 0%, #faf5ff 100%)' }}
      >
        <Row align="middle" gutter={16}>
          <Col xs={24} md={12}>
            <Space direction="vertical" size={8}>
              <Title level={5} style={{ margin: 0 }}>
                <CalendarOutlined /> 每日签到
              </Title>
              <Text type="secondary">
                {checkedIn
                  ? `今日已签到，连续 ${streak} 天`
                  : `签到可获得积分，连续签到越多奖励越多！`}
              </Text>
              <div>
                <Button
                  type="primary"
                  size="large"
                  icon={<GiftOutlined />}
                  disabled={checkedIn}
                  loading={checkingIn}
                  onClick={handleCheckIn}
                  style={{ background: checkedIn ? undefined : 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}
                >
                  {checkedIn ? '今日已签到' : '立即签到'}
                </Button>
                {checkedIn && <Tag color="green" style={{ marginLeft: 8 }}>+{checkinStatus?.todayPoints || 0} 积分</Tag>}
              </div>
            </Space>
          </Col>
          <Col xs={24} md={12}>
            <WeekCalendar streak={streak} checkedInToday={checkedIn} />
          </Col>
        </Row>
      </Card>

      {/* ─── Tabs：积分记录 / 积分任务 / 推荐赚积分 ─── */}
      <Tabs
        defaultActiveKey="history"
        onChange={(key) => {
          if (key === 'referrals' || key === 'commissions') loadTabData(key);
        }}
        items={[
          {
            key: 'history',
            label: <span><ThunderboltOutlined /> 积分记录</span>,
            children: (
              <Card>
                <Table
                  dataSource={creditsHistory.slice(0, 20)}
                  rowKey={(r: any) => r._id || r.id || Math.random().toString()}
                  size="small"
                  loading={historyLoading}
                  pagination={{ pageSize: 10 }}
                  locale={{ emptyText: '暂无积分记录' }}
                  columns={[
                    {
                      title: '说明', dataIndex: 'description', key: 'desc',
                      render: (v: string, r: any) => v || r.desc || (r.type === 'earn' ? '获取积分' : '消费积分'),
                    },
                    {
                      title: '变动', dataIndex: 'amount', key: 'amount',
                      render: (v: number) => (
                        <Text style={{ color: v > 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                          {v > 0 ? `+${v}` : v}
                        </Text>
                      ),
                    },
                    {
                      title: '时间', dataIndex: 'createdAt', key: 'time',
                      render: (v: string, r: any) => (v || r.time || '-')?.toString().slice(0, 10),
                    },
                    {
                      title: '类型', dataIndex: 'type', key: 'type',
                      render: (t: string) => {
                        const labels: Record<string, string> = {
                          earn: '获取', spend: '消费', deduction: '扣减', grant: '赠送', purchase: '购买', checkin: '签到', referral: '推荐',
                        };
                        return <Tag>{labels[t] || t}</Tag>;
                      },
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'tasks',
            label: <span><TrophyOutlined /> 积分任务</span>,
            children: (
              <Card>
                <Title level={5}>完成以下任务赚取积分</Title>
                <List
                  dataSource={tasks.length > 0 ? tasks : [
                    { taskType: 'ai_chat', points: 5, label: 'AI 对话' },
                    { taskType: 'knowledge_upload', points: 30, label: '上传知识文档' },
                    { taskType: 'course_complete', points: 20, label: '完成课程' },
                    { taskType: 'tool_use', points: 3, label: '使用智能工具' },
                    { taskType: 'daily_login', points: 2, label: '每日登录' },
                    { taskType: 'profile_complete', points: 50, label: '完善个人资料（一次性）' },
                    { taskType: 'share_content', points: 5, label: '分享内容' },
                  ]}
                  renderItem={(item: any) => (
                    <List.Item>
                      <Space>
                        <CheckCircleOutlined style={{ color: '#10b981' }} />
                        <Text>{item.label || item.taskType}</Text>
                        <Tag color="gold">+{item.points} 积分</Tag>
                      </Space>
                    </List.Item>
                  )}
                />
              </Card>
            ),
          },
          {
            key: 'referral',
            label: <span><TeamOutlined /> 推荐赚积分</span>,
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} md={10}>
                  <Card title="你的邀请链接" style={{ marginBottom: 16 }}>
                    <Input
                      value={`https://aibak.site/register?ref=${referralCode}`}
                      readOnly
                      addonAfter={
                        <Button type="text" icon={<CopyOutlined />} onClick={copyReferralLink} style={{ padding: '0 8px' }} />
                      }
                    />
                    <Space style={{ marginTop: 12 }} wrap>
                      <Button icon={<CopyOutlined />} onClick={copyReferralLink}>复制链接</Button>
                      <Button icon={<QrcodeOutlined />} onClick={() => setShareModal(true)}>二维码</Button>
                    </Space>

                    <Divider />

                    <Title level={5}>佣金比例</Title>
                    <List size="small">
                      <List.Item>一级分销：<strong>5%</strong> 佣金</List.Item>
                      <List.Item>二级分销：<strong>2%</strong> 佣金</List.Item>
                      <List.Item>三级分销：<strong>1%</strong> 佣金</List.Item>
                      <List.Item>最低提现：<strong>¥50</strong></List.Item>
                    </List>
                    <Divider />
                    <Paragraph type="secondary" style={{ fontSize: 12 }}>
                      💡 好友注册即送你 100 积分；好友付费你获得佣金，满 ¥50 即可提现。
                    </Paragraph>
                  </Card>
                </Col>
                <Col xs={24} md={14}>
                  <Card title="我的推荐" extra={
                    <Button size="small" onClick={() => loadTabData('referrals')} loading={tabLoading}>刷新</Button>
                  } style={{ marginBottom: 16 }}>
                    <Table
                      dataSource={referrals}
                      rowKey={(r: any) => r._id || Math.random().toString()}
                      size="small"
                      pagination={false}
                      locale={{ emptyText: '暂无推荐记录，快去邀请好友吧！' }}
                      columns={[
                        {
                          title: '用户', dataIndex: 'referredUserId', key: 'name',
                          render: (v: any) => v?.name || v?.email?.slice(0, 8) + '...' || '-',
                        },
                        {
                          title: '层级', dataIndex: 'level', key: 'level',
                          render: (v: number) => <Tag>{v ? `第${v}级` : '-'}</Tag>,
                        },
                        {
                          title: '状态', dataIndex: 'status', key: 'status',
                          render: (v: string) => (
                            <Badge status={v === 'active' ? 'success' : 'default'} text={v === 'active' ? '已激活' : '待激活'} />
                          ),
                        },
                        {
                          title: '时间', dataIndex: 'createdAt', key: 'time',
                          render: (v: string) => v?.slice(0, 10) || '-',
                        },
                      ]}
                    />
                  </Card>

                  <Card title="佣金记录" extra={
                    <Button size="small" onClick={() => loadTabData('commissions')} loading={tabLoading}>刷新</Button>
                  }>
                    <Table
                      dataSource={commissions}
                      rowKey={(r: any) => r._id || Math.random().toString()}
                      size="small"
                      pagination={false}
                      locale={{ emptyText: '暂无佣金记录' }}
                      columns={[
                        {
                          title: '金额', dataIndex: 'commissionAmount', key: 'amount',
                          render: (v: number) => (
                            <Text style={{ color: '#10b981', fontWeight: 600 }}>¥{(v / 100).toFixed(2)}</Text>
                          ),
                        },
                        {
                          title: '层级', dataIndex: 'level', key: 'level',
                          render: (v: number) => <Tag>第{v}级</Tag>,
                        },
                        {
                          title: '状态', dataIndex: 'status', key: 'status',
                          render: (v: string) => {
                            const statusMap: Record<string, { text: string; color: string }> = {
                              pending: { text: '待结算', color: 'orange' },
                              settled: { text: '已结算', color: 'green' },
                              withdrawn: { text: '已提现', color: 'blue' },
                            };
                            const s = statusMap[v] || { text: v, color: 'default' };
                            return <Tag color={s.color}>{s.text}</Tag>;
                          },
                        },
                        {
                          title: '时间', dataIndex: 'createdAt', key: 'time',
                          render: (v: string) => v?.slice(0, 10) || '-',
                        },
                      ]}
                    />
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'membership',
            label: <span><CrownOutlined /> 会员权益</span>,
            children: (
              <Row gutter={[16, 16]}>
                {[
                  {
                    name: '免费版', plan: 'free', price: '¥0', color: '#94a3b8',
                    features: ['基础 AI 对话', '知识库查询', '模型对比', '日配额 50 积分', '个人使用'],
                    disabled: ['无限 API', '媒体生成', '团队协作', '优先客服'],
                  },
                  {
                    name: '专业版', plan: 'pro', price: '¥29/月', color: '#6366f1',
                    features: ['无限 AI 对话', '高级知识库', '模型对比', '日配额 500 积分', 'API 开放', '媒体生成'],
                    disabled: ['团队协作', '优先客服'],
                    highlighted: true,
                  },
                  {
                    name: '旗舰版', plan: 'max', price: '¥99/月', color: '#f59e0b',
                    features: ['无限 AI 对话', '高级知识库 + RAG', '全部功能', '日配额无限制', 'API 全额配额', '媒体生成无限', '团队协作', '优先客服'],
                    disabled: [],
                  },
                ].map((tier) => (
                  <Col xs={24} md={8} key={tier.plan}>
                    <Card
                      style={{
                        borderRadius: 14,
                        border: tier.highlighted ? '2px solid #818cf8' : '1px solid #e8e8e8',
                        boxShadow: tier.highlighted ? '0 0 20px rgba(129,140,248,0.15)' : undefined,
                        position: 'relative',
                      }}
                    >
                      {tier.highlighted && (
                        <Tag color="#8b5cf6" style={{ position: 'absolute', top: 12, right: 12, borderRadius: 10 }}>
                          推荐
                        </Tag>
                      )}
                      {user?.plan === tier.plan && (
                        <Tag color="green" style={{ position: 'absolute', top: 12, left: 12, borderRadius: 10 }}>
                          当前方案
                        </Tag>
                      )}
                      <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <Text strong style={{ fontSize: 18, color: tier.color }}>{tier.name}</Text>
                        <div style={{ fontSize: 28, fontWeight: 800, margin: '8px 0', color: tier.color }}>
                          {tier.price}
                        </div>
                      </div>
                      <Divider style={{ margin: '0 0 12px' }} />
                      <div style={{ minHeight: 200 }}>
                        {tier.features.map((f) => (
                          <div key={f} style={{ padding: '4px 0', fontSize: 13 }}>
                            <CheckCircleOutlined style={{ color: '#10b981', marginRight: 6 }} />{f}
                          </div>
                        ))}
                        {tier.disabled.map((f) => (
                          <div key={f} style={{ padding: '4px 0', fontSize: 13, color: '#cbd5e1' }}>
                            <LockOutlined style={{ marginRight: 6 }} />{f}
                          </div>
                        ))}
                      </div>
                      {user?.plan !== tier.plan && (
                        <Button
                          type={tier.highlighted ? 'primary' : 'default'}
                          block
                          onClick={() => navigate('/pricing')}
                          style={{
                            background: tier.highlighted ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : undefined,
                            border: tier.highlighted ? 'none' : undefined,
                          }}
                        >
                          {user?.plan && ['free', 'pro', 'max'].indexOf(user.plan) < ['free', 'pro', 'max'].indexOf(tier.plan)
                            ? '升级'
                            : '了解详情'}
                        </Button>
                      )}
                    </Card>
                  </Col>
                ))}
              </Row>
            ),
          },
        ]}
      />

      {/* ─── 分享推广弹窗 ─── */}
      <Modal
        title="分享推广"
        open={shareModal}
        onCancel={() => setShareModal(false)}
        footer={null}
      >
        <div style={{ textAlign: 'center' }}>
          <QRCodeSVG
            value={`https://aibak.site/register?ref=${referralCode}`}
            size={isMobile ? 150 : 180}
            level="M"
            includeMargin
          />
          <Paragraph style={{ marginTop: 12 }}>
            扫描二维码注册，你即可获得 <Tag color="gold">100 积分</Tag> 奖励
          </Paragraph>
          <Input
            value={`https://aibak.site/register?ref=${referralCode}`}
            readOnly
            style={{ marginTop: 12 }}
            addonAfter={
              <Button type="text" size="small" icon={<CopyOutlined />} onClick={copyReferralLink} />
            }
          />
        </div>
      </Modal>
    </div>
  );
}
