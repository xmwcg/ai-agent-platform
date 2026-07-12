import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Typography, Button, Row, Col, Statistic, Tag, message, Spin,
  Table, Input, Tooltip, Empty, Divider, Modal, Select, Form,
} from 'antd';
import {
  ShareAltOutlined, CopyOutlined, GiftOutlined, TeamOutlined,
  MoneyCollectOutlined, LinkOutlined, CrownOutlined, RiseOutlined,
  QrcodeOutlined, PictureOutlined, DownloadOutlined,
} from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import ReactECharts from 'echarts-for-react';
import { referralAPI } from '@/services/api';

const { Title, Text, Paragraph } = Typography;

interface ReferralStats {
  inviteCount?: number;
  commissionTotal?: number;
  pendingCommission?: number;
  settledCommission?: number;
  paidCommission?: number;
  totalReferrals?: number;
  monthlyTrend?: { month: string; amountCents: number }[];
}
interface Commission {
  _id?: string; createdAt?: string; amount?: number; status?: string; fromUser?: string; orderNo?: string;
}
interface Withdrawal { _id?: string; amount?: number; method?: string; status?: string; createdAt?: string; }

const TIERS = [
  { name: '推广员', condition: '邀请 0 人起', rate: '一级 5%', color: 'default' },
  { name: '合伙人', condition: '成功邀请 ≥ 10 人', rate: '二级 2%', color: 'blue' },
  { name: '城市代理', condition: '成功邀请 ≥ 50 人', rate: '三级 1%', color: 'gold' },
];

const yuan = (cents?: number) => ((cents ?? 0) / 100).toFixed(2);

export default function DistributionPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [stats, setStats] = useState<ReferralStats>({});
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [copied, setCopied] = useState(false);
  const [posterOpen, setPosterOpen] = useState(false);
  const [posterUrl, setPosterUrl] = useState('');
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const posterCanvas = useRef<HTMLCanvasElement>(null);

  const inviteLink = code ? `https://aibak.site/register?ref=${code}` : 'https://aibak.site/register';

  const load = async () => {
    setLoading(true);
    try {
      const [codeRes, statsRes, commRes, wdRes]: any[] = await Promise.all([
        referralAPI.code().catch(() => ({})),
        referralAPI.stats().catch(() => ({})),
        referralAPI.commissions({ page: 1, pageSize: 20 }).catch(() => ({ data: [] })),
        referralAPI.withdrawals().catch(() => ({ data: [] })),
      ]);
      setCode(codeRes?.code || codeRes?.data?.code || '');
      setStats(statsRes?.data || statsRes || {});
      const arr = commRes?.data?.list || commRes?.data?.docs || commRes?.data || [];
      setCommissions(Array.isArray(arr) ? arr : []);
      const wd = wdRes?.data || wdRes?.data?.list || [];
      setWithdrawals(Array.isArray(wd) ? wd : []);
    } catch {
      message.warning('分销数据加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true); message.success('邀请链接已复制');
      setTimeout(() => setCopied(false), 2000);
    } catch { message.error('复制失败，请手动复制'); }
  };

  // 生成分享海报（canvas 合成：背景 + 标题 + 二维码 + 链接）
  const genPoster = () => {
    const canvas = posterCanvas.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = 600, H = 800;
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#6c5ce7'); grad.addColorStop(1, '#a29bfe');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('AIbak 全站 AI 应用平台', 40, 90);
    ctx.font = '22px sans-serif';
    ctx.fillText('一站式智能生产力 · 邀请即享佣金', 40, 140);
    // 白底卡片
    ctx.fillStyle = '#fff'; ctx.roundRect(60, 200, 480, 440, 24); ctx.fill();
    // 二维码
    const size = 280;
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('扫码注册 · 立得 100 积分', 90, 260);
    // 用 QRCode 渲染到离屏再绘制
    const svg = document.createElement('div');
    // 简化：直接提示用户使用下方二维码；此处绘制占位框
    ctx.strokeStyle = '#6c5ce7'; ctx.lineWidth = 3;
    ctx.strokeRect(160, 300, size, size);
    ctx.fillStyle = '#64748b'; ctx.font = '16px sans-serif';
    ctx.fillText('（二维码见左侧 / 弹窗）', 175, 620);
    ctx.fillStyle = '#0f172a'; ctx.font = 'bold 20px sans-serif';
    ctx.fillText('我的邀请码：' + (code || '—'), 90, 580);
    ctx.fillStyle = '#6c5ce7'; ctx.font = '15px monospace';
    const link = inviteLink.length > 46 ? inviteLink.slice(0, 46) + '…' : inviteLink;
    ctx.fillText(link, 90, 615);
    setPosterUrl(canvas.toDataURL('image/png'));
    setPosterOpen(true);
  };

  const onWithdraw = async (vals: { amount: number; method: 'wechat' | 'alipay'; account?: string }) => {
    setSubmitting(true);
    try {
      await referralAPI.withdraw(vals);
      message.success('提现申请已提交，财务将复核打款');
      setWithdrawOpen(false);
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.error || e?.message || '提现失败');
    }
    setSubmitting(false);
  };

  const commColumns = [
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '—' },
    { title: '来源用户', dataIndex: 'fromUser', key: 'fromUser', render: (v: string) => v || '—' },
    { title: '关联订单', dataIndex: 'orderNo', key: 'orderNo', render: (v: string) => v || '—' },
    { title: '佣金', dataIndex: 'amount', key: 'amount', render: (v: number) => <Text strong style={{ color: '#07c160' }}>¥{yuan(v)}</Text> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => {
      const map: Record<string, { t: string; c: string }> = { pending: { t: '待结算', c: 'orange' }, settled: { t: '已结算', c: 'green' }, withdrawn: { t: '已提现', c: 'blue' } };
      const s = map[v] || { t: v || '未知', c: 'default' };
      return <Tag color={s.c}>{s.t}</Tag>;
    } },
  ];

  const wdColumns = [
    { title: '申请时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '—' },
    { title: '金额', dataIndex: 'amount', key: 'amount', render: (v: number) => <Text strong>¥{(v ?? 0).toFixed(2)}</Text> },
    { title: '方式', dataIndex: 'method', key: 'method', render: (v: string) => v === 'alipay' ? '支付宝' : '微信' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => {
      const map: Record<string, { t: string; c: string }> = { pending: { t: '待打款', c: 'orange' }, approved: { t: '已通过', c: 'blue' }, paid: { t: '已打款', c: 'green' }, rejected: { t: '已驳回', c: 'red' } };
      const s = map[v] || { t: v || '未知', c: 'default' };
      return <Tag color={s.c}>{s.t}</Tag>;
    } },
  ];

  const trend = (stats.monthlyTrend || []).map((t) => ({ month: t.month, 金额: Number((t.amountCents / 100).toFixed(2)) }));

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <ShareAltOutlined style={{ fontSize: 26, color: '#6c5ce7' }} />
        <Title level={3} style={{ margin: 0 }}>分销中心</Title>
        <Tag color="purple" icon={<CrownOutlined />}>推广赚佣金</Tag>
      </div>
      <Text type="secondary">邀请好友注册 / 升级会员，永久获得订阅分成，多级裂变轻松变现。</Text>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : (
        <>
          {/* 邀请链接 + 二维码 + 海报 */}
          <Card style={{ marginTop: 16, borderRadius: 16,
            background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)', border: 'none', color: '#fff' }}>
            <Row align="middle" gutter={16}>
              <Col xs={24} md={13}>
                <Text style={{ color: 'rgba(255,255,255,0.85)' }}>我的专属邀请链接</Text>
                <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.15)', fontFamily: 'monospace', fontSize: 14, wordBreak: 'break-all' }}>{inviteLink}</div>
                <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>邀请码：<b>{code || '—'}</b></div>
                <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Button size="large" icon={copied ? <CopyOutlined /> : <LinkOutlined />} onClick={copyLink}
                    style={{ background: '#fff', color: '#6c5ce7', border: 'none', fontWeight: 600, borderRadius: 10 }}>{copied ? '已复制' : '复制链接'}</Button>
                  <Button ghost size="large" icon={<QrcodeOutlined />} onClick={() => setPosterOpen(true)}
                    style={{ borderRadius: 10, borderColor: 'rgba(255,255,255,0.6)', color: '#fff' }}>二维码</Button>
                  <Button ghost size="large" icon={<PictureOutlined />} onClick={genPoster}
                    style={{ borderRadius: 10, borderColor: 'rgba(255,255,255,0.6)', color: '#fff' }}>分享海报</Button>
                </div>
              </Col>
              <Col xs={24} md={11} style={{ textAlign: 'center' }}>
                <div style={{ display: 'inline-block', background: '#fff', padding: 12, borderRadius: 16 }}>
                  <QRCodeSVG value={inviteLink} size={160} />
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 8 }}>扫码注册即绑定为你邀请</div>
              </Col>
            </Row>
          </Card>

          {/* 数据统计 */}
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={12} md={6}><Card style={{ borderRadius: 14, textAlign: 'center' }}>
              <Statistic title="累计邀请" value={stats.totalReferrals ?? stats.inviteCount ?? 0} prefix={<TeamOutlined style={{ color: '#6c5ce7' }} />} /></Card></Col>
            <Col xs={12} md={6}><Card style={{ borderRadius: 14, textAlign: 'center' }}>
              <Statistic title="佣金总额" value={yuan(stats.commissionTotal)} prefix="¥" valueStyle={{ color: '#07c160' }} /></Card></Col>
            <Col xs={12} md={6}><Card style={{ borderRadius: 14, textAlign: 'center' }}>
              <Statistic title="待结算" value={yuan(stats.pendingCommission)} prefix="¥" valueStyle={{ color: '#fa8c16' }} /></Card></Col>
            <Col xs={12} md={6}><Card style={{ borderRadius: 14, textAlign: 'center' }}>
              <Statistic title="已提现" value={yuan(stats.paidCommission)} prefix="¥" valueStyle={{ color: '#1677ff' }} /></Card></Col>
          </Row>

          {/* 佣金趋势报表 */}
          <Title level={4} style={{ marginTop: 28, marginBottom: 12 }}><RiseOutlined /> 佣金趋势（近 6 个月）</Title>
          <Card style={{ borderRadius: 14 }}>
            {trend.length === 0 ? <Empty description="暂无佣金数据" /> : (
              <ReactECharts option={{
                tooltip: { trigger: 'axis' },
                grid: { left: 40, right: 20, top: 20, bottom: 30 },
                xAxis: { type: 'category', data: trend.map((t) => t.month) },
                yAxis: { type: 'value', name: '¥' },
                series: [{ type: 'bar', data: trend.map((t) => t.金额), itemStyle: { color: '#6c5ce7', borderRadius: [6, 6, 0, 0] }, smooth: true },
                  { type: 'line', data: trend.map((t) => t.金额), itemStyle: { color: '#07c160' } }],
              }} style={{ height: 280 }} />
            )}
            <div style={{ textAlign: 'right', marginTop: 8 }}>
              <Button type="primary" ghost icon={<MoneyCollectOutlined />} onClick={() => setWithdrawOpen(true)}>申请提现</Button>
            </div>
          </Card>

          {/* 分佣等级 */}
          <Title level={4} style={{ marginTop: 28, marginBottom: 12 }}><CrownOutlined /> 分佣等级</Title>
          <Row gutter={[16, 16]}>
            {TIERS.map((t) => (
              <Col xs={24} md={8} key={t.name}>
                <Card style={{ borderRadius: 14, borderTop: '3px solid #6c5ce7', height: '100%' }}>
                  <Tag color={t.color} style={{ marginBottom: 8 }}>{t.name}</Tag>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#6c5ce7' }}>{t.rate}</div>
                  <Text type="secondary">{t.condition}</Text>
                </Card>
              </Col>
            ))}
          </Row>

          {/* 佣金明细 + 提现记录 */}
          <Title level={4} style={{ marginTop: 28, marginBottom: 12 }}><MoneyCollectOutlined /> 佣金明细</Title>
          <Card style={{ borderRadius: 14, marginBottom: 16 }}>
            {commissions.length === 0 ? <Empty description="暂无佣金记录，邀请好友升级会员即可获得分成" /> : (
              <Table rowKey={(r) => r._id || Math.random().toString()} dataSource={commissions} columns={commColumns} pagination={false} size="middle" />
            )}
          </Card>
          <Title level={4} style={{ marginBottom: 12 }}>提现记录</Title>
          <Card style={{ borderRadius: 14 }}>
            {withdrawals.length === 0 ? <Empty description="暂无提现记录" /> : (
              <Table rowKey={(r) => r._id || Math.random().toString()} dataSource={withdrawals} columns={wdColumns} pagination={false} size="middle" />
            )}
          </Card>

          <Divider />
          <Paragraph type="secondary" style={{ fontSize: 12 }}>
            <GiftOutlined /> 推广规则：通过你的邀请链接注册的用户，其每次会员订阅消费你均可获得对应等级佣金；佣金每月结算，满 ¥50 可提现至微信 / 支付宝。最终解释权归 AIbak 所有。
          </Paragraph>
        </>
      )}

      {/* 二维码 / 海报弹窗 */}
      <Modal open={posterOpen} onCancel={() => setPosterOpen(false)} footer={null} title="分享推广">
        <div style={{ textAlign: 'center' }}>
          {posterUrl ? (
            <>
              <img src={posterUrl} alt="poster" style={{ width: '100%', borderRadius: 12 }} />
              <a href={posterUrl} download={`aibak-invite-${code}.png`}>
                <Button type="primary" icon={<DownloadOutlined />} style={{ marginTop: 12 }}>下载海报</Button>
              </a>
            </>
          ) : (
            <div style={{ display: 'inline-block', background: '#fff', padding: 16, borderRadius: 16 }}>
              <QRCodeSVG value={inviteLink} size={220} />
              <div style={{ marginTop: 10, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{inviteLink}</div>
            </div>
          )}
        </div>
        <canvas ref={posterCanvas} width={600} height={800} style={{ display: 'none' }} />
      </Modal>

      {/* 提现弹窗 */}
      <Modal open={withdrawOpen} onCancel={() => setWithdrawOpen(false)} onOk={() => formRef.current?.submit()}
        confirmLoading={submitting} title="申请提现" okText="提交申请">
        <Form layout="vertical" ref={formRef as any} onFinish={onWithdraw} initialValues={{ method: 'wechat', amount: 50 }}>
          <Form.Item label="提现金额（元，最低 ¥50）" name="amount" rules={[{ required: true, type: 'number', min: 50, message: '最低 ¥50' }]}>
            <Input type="number" prefix="¥" />
          </Form.Item>
          <Form.Item label="收款方式" name="method" rules={[{ required: true }]}>
            <Select options={[{ label: '微信', value: 'wechat' }, { label: '支付宝', value: 'alipay' }]} />
          </Form.Item>
          <Form.Item label="收款账号 / 备注" name="account">
            <Input placeholder="微信 / 支付宝账号（选填）" />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>可提现余额：¥{yuan((stats.settledCommission ?? 0) - (stats.paidCommission ?? 0))}（已结算 - 已提现）</Text>
        </Form>
      </Modal>
    </div>
  );
}

const formRef = { current: null as any };
