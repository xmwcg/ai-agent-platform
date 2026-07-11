import React, { useEffect, useRef, useState } from 'react';
import {
  Card, Typography, Tag, Modal, Input, Button, message, Spin, Empty, Divider,
  Space, Select, List, Tabs, Popconfirm, Tooltip,
} from 'antd';
import {
  AppstoreOutlined, ThunderboltOutlined, CopyOutlined, CloudUploadOutlined,
  DownloadOutlined, DeleteOutlined, GlobalOutlined, ImportOutlined, ExportOutlined,
} from '@ant-design/icons';
import { skillsAPI, mcpAPI, workflowAPI, extractApiError } from '@/services/api';

const { Title, Text, Paragraph } = Typography;

interface SkillManifest {
  id: string;
  name: string;
  description: string;
  division: string;
  color: string;
  coreMission: string;
  criticalRules: string[];
  successMetrics: string[];
  quotaResource?: string;
  minRole: string;
  requireAuth: boolean;
  marketable: boolean;
  kind?: string;
  source?: string;
  tags?: string[];
}

interface CatalogEntry {
  id: string;
  name: string;
  source: string;
  kind: string;
  category: string;
  description: string;
  officialUrl?: string;
  installHint?: string;
}

const DIVISION_LABEL: Record<string, string> = {
  knowledge: '知识中枢', ai: 'AI 对话', media: '媒体生产',
  'customer-service': '智能客服', engineering: '工程', productivity: '生产力',
};

const SAMPLE_PACKAGE = `{
  "schema": "reasonix.skill/1.0",
  "manifest": {
    "id": "my-translator",
    "name": "我的翻译官",
    "description": "把任意文本翻译为目标语言",
    "division": "productivity",
    "color": "#6366f1",
    "tags": ["翻译"],
    "marketable": true
  },
  "kind": "prompt",
  "prompt": {
    "system": "你是专业翻译。只输出译文。",
    "userTemplate": "请把下面内容翻译为{{target}}：\\n{{input}}",
    "maxTokens": 800,
    "temperature": 0.3
  }
}`;

/** 触发浏览器下载 Blob */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const SkillsMarketPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('platform');

  // —— 平台技能 ——
  const [platformSkills, setPlatformSkills] = useState<SkillManifest[]>([]);
  const [platformLoading, setPlatformLoading] = useState(false);
  const [active, setActive] = useState<SkillManifest | null>(null);
  const [invokeOpen, setInvokeOpen] = useState(false);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  // —— 我的技能 ——
  const [mySkills, setMySkills] = useState<SkillManifest[]>([]);
  const [myLoading, setMyLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  // —— 外部市场 ——
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);

  // —— 集成与工具流 ——
  const [mcpText, setMcpText] = useState('');
  const [wfText, setWfText] = useState('');
  const [wfExportId, setWfExportId] = useState('');
  const [busyIntegration, setBusyIntegration] = useState(false);

  // 我的技能调用弹窗
  const [myInvokeOpen, setMyInvokeOpen] = useState(false);
  const [myActive, setMyActive] = useState<SkillManifest | null>(null);
  const [myInput, setMyInput] = useState('');
  const [myRunning, setMyRunning] = useState(false);
  const [myResult, setMyResult] = useState<any>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const mcpFileRef = useRef<HTMLInputElement>(null);
  const wfFileRef = useRef<HTMLInputElement>(null);

  const loadPlatform = async () => {
    setPlatformLoading(true);
    try {
      const res: any = await skillsAPI.list();
      setPlatformSkills(res.skills || []);
    } catch {
      message.error('平台技能加载失败');
    }
    setPlatformLoading(false);
  };

  const loadMine = async () => {
    setMyLoading(true);
    try {
      const res: any = await skillsAPI.mine();
      setMySkills(res.skills || []);
    } catch {
      message.error('我的技能加载失败');
    }
    setMyLoading(false);
  };

  const loadCatalog = async () => {
    setCatalogLoading(true);
    try {
      const res: any = await skillsAPI.catalog();
      setCatalog(res.catalog || []);
    } catch {
      message.error('外部市场目录加载失败');
    }
    setCatalogLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'platform') loadPlatform();
    if (activeTab === 'mine') loadMine();
    if (activeTab === 'market') loadCatalog();
  }, [activeTab]);

  // ── 平台技能调用（沿用原逻辑） ──
  const openInvoke = (s: SkillManifest) => {
    setActive(s);
    setResult(null);
    const sample: Record<string, any> = { teamId: '' };
    if (s.division === 'media') { sample.type = 'text2video'; sample.prompt = '请输入生成描述'; sample.duration = 5; }
    else if (s.division === 'ai') { sample.message = '你好，介绍一下你自己'; }
    else if (s.division === 'knowledge') { sample.action = 'search'; sample.query = ''; }
    setInput(JSON.stringify(sample, null, 2));
    setInvokeOpen(true);
  };

  const doInvoke = async () => {
    if (!active) return;
    let payload: any;
    try { payload = JSON.parse(input || '{}'); }
    catch { message.error('输入不是合法 JSON'); return; }
    setRunning(true); setResult(null);
    try {
      const res: any = await skillsAPI.invoke(active.id, payload);
      setResult(res);
      if (res.ok) message.success('调用成功');
      else message.warning(res.error || '调用返回异常');
    } catch (e) { message.error(extractApiError(e, '调用失败')); }
    setRunning(false);
  };

  // ── 导入技能包（我的技能） ──
  const doImport = async () => {
    if (!importText.trim()) { message.error('请粘贴技能包 JSON 或上传文件'); return; }
    let payload: any;
    try { payload = JSON.parse(importText); }
    catch { message.error('JSON 解析失败'); return; }
    setImporting(true);
    try {
      const res: any = await skillsAPI.importPackage(payload);
      if (res.ok) {
        message.success(`成功导入 ${res.imported} 个技能`);
        setImportOpen(false);
        setImportText('');
        loadMine();
      } else message.error(res.error || '导入失败');
    } catch (e) { message.error(extractApiError(e, '导入失败')); }
    setImporting(false);
  };

  const doExport = async (id: string, name: string) => {
    try {
      const blob: any = await skillsAPI.exportPackage(id, true);
      downloadBlob(blob, `${id}.json`);
      message.success(`已导出 ${name}`);
    } catch (e) { message.error(extractApiError(e, '导出失败')); }
  };

  const doDelete = async (id: string) => {
    try {
      await skillsAPI.remove(id);
      message.success('已删除');
      loadMine();
    } catch (e) { message.error(extractApiError(e, '删除失败')); }
  };

  // ── 外部市场安装 ──
  const doInstall = async (entry: CatalogEntry) => {
    if (entry.kind === 'link') {
      if (entry.officialUrl) window.open(entry.officialUrl, '_blank');
      return;
    }
    setInstalling(entry.id);
    try {
      const res: any = await skillsAPI.installCatalog(entry.id);
      if (res.ok) {
        message.success(res.message || '安装成功');
        if (res.type === 'skill') { setActiveTab('mine'); setTimeout(loadMine, 300); }
        if (res.type === 'mcp') { message.info('已加入 MCP，请到「插件管理」补全密钥后连接'); }
      } else message.error(res.error || '安装失败');
    } catch (e) { message.error(extractApiError(e, '安装失败')); }
    setInstalling(null);
  };

  // ── 我的技能调用 ──
  const openMyInvoke = (s: SkillManifest) => {
    setMyActive(s); setMyResult(null); setMyInput(''); setMyInvokeOpen(true);
  };
  const doMyInvoke = async () => {
    if (!myActive) return;
    setMyRunning(true); setMyResult(null);
    try {
      const res: any = await skillsAPI.invoke(myActive.id, { input: myInput });
      setMyResult(res);
      if (res.ok) message.success('调用成功');
      else message.warning(res.error || '调用返回异常');
    } catch (e) { message.error(extractApiError(e, '调用失败')); }
    setMyRunning(false);
  };

  // ── 集成与工具流：MCP / 工作流导入导出 ──
  const doMcpImport = async () => {
    if (!mcpText.trim()) { message.error('请粘贴 MCP 配置包或上传文件'); return; }
    let payload: any;
    try { payload = JSON.parse(mcpText); } catch { message.error('JSON 解析失败'); return; }
    setBusyIntegration(true);
    try {
      const res: any = await mcpAPI.importServers(payload);
      if (res.success) { message.success(`已导入 ${res.imported} 个 MCP 服务器`); setMcpText(''); }
      else message.error(res.error || '导入失败');
    } catch (e) { message.error(extractApiError(e, '导入失败')); }
    setBusyIntegration(false);
  };
  const doMcpExport = async () => {
    try {
      const blob: any = await mcpAPI.exportServers(true);
      downloadBlob(blob, 'mcp-servers.json');
      message.success('已导出全部 MCP 配置');
    } catch (e) { message.error(extractApiError(e, '导出失败')); }
  };
  const doWfImport = async () => {
    if (!wfText.trim()) { message.error('请粘贴工作流包或上传文件'); return; }
    let payload: any;
    try { payload = JSON.parse(wfText); } catch { message.error('JSON 解析失败'); return; }
    setBusyIntegration(true);
    try {
      const res: any = await workflowAPI.importPackage(payload);
      if (res.success) { message.success(`已导入 ${res.imported} 个工作流`); setWfText(''); }
      else message.error(res.error || '导入失败');
    } catch (e) { message.error(extractApiError(e, '导入失败')); }
    setBusyIntegration(false);
  };
  const doWfExport = async () => {
    if (!wfExportId.trim()) { message.error('请输入要导出的工作流 ID'); return; }
    try {
      const blob: any = await workflowAPI.exportPackage(wfExportId.trim(), true);
      downloadBlob(blob, `workflow-${wfExportId.trim()}.json`);
      message.success('已导出工作流');
    } catch (e) { message.error(extractApiError(e, '导出失败')); }
  };

  const readFile = (ref: React.RefObject<HTMLInputElement>, setter: (v: string) => void) => {
    const file = ref.current?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setter(String(reader.result));
    reader.readAsText(file);
  };

  const SkillCard: React.FC<{ s: SkillManifest; onInvoke: (s: SkillManifest) => void; extra?: React.ReactNode }> = ({ s, onInvoke, extra }) => (
    <Card
      hoverable
      title={<Space><span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, display: 'inline-block' }} />{s.name}</Space>}
      extra={s.marketable ? <Tag color="green">可上架</Tag> : <Tag>内部</Tag>}
    >
      <Paragraph style={{ minHeight: 44 }}>{s.description}</Paragraph>
      <Tag color="blue">{DIVISION_LABEL[s.division] || s.division}</Tag>
      {s.kind && <Tag color="purple">{s.kind}</Tag>}
      {s.tags?.map((t) => <Tag key={t}>{t}</Tag>)}
      <Divider style={{ margin: '12px 0' }} />
      <Text type="secondary" style={{ fontSize: 12 }}>核心使命：{s.coreMission}</Text>
      <div style={{ marginTop: 12 }}>
        <Space wrap>
          <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => onInvoke(s)}>调用技能</Button>
          {extra}
        </Space>
      </div>
    </Card>
  );

  const tabItems = [
    {
      key: 'platform',
      label: <span><AppstoreOutlined /> 平台技能</span>,
      children: (
        <Spin spinning={platformLoading}>
          {platformSkills.length === 0 && !platformLoading ? (
            <Empty description="暂无技能" />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {platformSkills.map((s) => (
                <SkillCard key={s.id} s={s} onInvoke={openInvoke} />
              ))}
            </div>
          )}
        </Spin>
      ),
    },
    {
      key: 'mine',
      label: <span><CloudUploadOutlined /> 我的技能</span>,
      children: (
        <div>
          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>上传 / 导入技能包</Button>
            <Button icon={<DownloadOutlined />} onClick={() => { setActiveTab('market'); }}>从外部市场安装</Button>
          </Space>
          <Spin spinning={myLoading}>
            {mySkills.length === 0 && !myLoading ? (
              <Empty description="你还没有上传或安装技能。点击「上传 / 导入技能包」开始，或从「外部市场」一键安装。" />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {mySkills.map((s) => (
                  <SkillCard
                    key={s.id}
                    s={s}
                    onInvoke={openMyInvoke}
                    extra={(
                      <>
                        <Button icon={<DownloadOutlined />} onClick={() => doExport(s.id, s.name)}>导出</Button>
                        <Popconfirm title="确认删除该技能？" onConfirm={() => doDelete(s.id)}>
                          <Button danger icon={<DeleteOutlined />}>删除</Button>
                        </Popconfirm>
                      </>
                    )}
                  />
                ))}
              </div>
            )}
          </Spin>
        </div>
      ),
    },
    {
      key: 'market',
      label: <span><GlobalOutlined /> 外部市场</span>,
      children: (
        <div>
          <Paragraph type="secondary">
            精选自官方 MCP Registry、mcp.so、Smithery、Coze、Dify 等主流市场。点击「安装」即可把配置一键加入你的平台（MCP 类需你本地补全密钥后连接），全程不执行任意代码。
          </Paragraph>
          <Spin spinning={catalogLoading}>
            {catalog.length === 0 && !catalogLoading ? (
              <Empty description="暂无目录" />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                {catalog.map((e) => (
                  <Card key={e.id} hoverable
                    title={<Space><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#8b5cf6', display: 'inline-block' }} />{e.name}</Space>}
                    extra={<Tag color={e.kind === 'link' ? 'default' : 'geekblue'}>{e.source}</Tag>}
                  >
                    <Paragraph style={{ minHeight: 44 }}>{e.description}</Paragraph>
                    <Tag color="cyan">{e.category}</Tag>
                    <Tag>{e.kind === 'mcp' ? 'MCP 服务器' : e.kind === 'skill' ? '技能包' : '外部链接'}</Tag>
                    {e.installHint && <div style={{ marginTop: 8 }}><Text type="secondary" style={{ fontSize: 12 }}>提示：{e.installHint}</Text></div>}
                    <Divider style={{ margin: '12px 0' }} />
                    <Button
                      type="primary"
                      block
                      loading={installing === e.id}
                      icon={e.kind === 'link' ? <GlobalOutlined /> : <CloudUploadOutlined />}
                      onClick={() => doInstall(e)}
                    >
                      {e.kind === 'link' ? '前往市场' : '一键安装'}
                    </Button>
                    {e.officialUrl && (
                      <Button type="link" block icon={<GlobalOutlined />} onClick={() => window.open(e.officialUrl, '_blank')}>
                        查看来源
                      </Button>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </Spin>
        </div>
      ),
    },
    {
      key: 'integration',
      label: <span><ImportOutlined /> 集成与工具流</span>,
      children: (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
          <Card title="MCP 服务器配置包" size="small">
            <Paragraph type="secondary" style={{ fontSize: 12 }}>导入外部 MCP 服务器配置（JSON 对象 / 数组 / {"{ servers: [] }"}），或导出当前全部配置。</Paragraph>
            <Input.TextArea value={mcpText} onChange={(e) => setMcpText(e.target.value)} autoSize={{ minRows: 5, maxRows: 12 }} placeholder='{ "id":"my-mcp", "name":"...", "transport":"stdio", "command":"npx", "args":["-y","..."] }' style={{ fontFamily: 'monospace' }} />
            <Space style={{ marginTop: 12 }} wrap>
              <Button icon={<ImportOutlined />} loading={busyIntegration} onClick={doMcpImport}>导入</Button>
              <Button icon={<ExportOutlined />} onClick={doMcpExport}>导出全部</Button>
              <Button icon={<CloudUploadOutlined />} onClick={() => mcpFileRef.current?.click()}>上传文件</Button>
              <input ref={mcpFileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={() => readFile(mcpFileRef, setMcpText)} />
            </Space>
          </Card>

          <Card title="Agent 工作流包" size="small">
            <Paragraph type="secondary" style={{ fontSize: 12 }}>导入工作流（Agent 工具流）包，或按 ID 导出已有工作流。</Paragraph>
            <Input.TextArea value={wfText} onChange={(e) => setWfText(e.target.value)} autoSize={{ minRows: 5, maxRows: 12 }} placeholder='{ "name":"我的流程", "nodes":[...], "edges":[...] }' style={{ fontFamily: 'monospace' }} />
            <Space style={{ marginTop: 12 }} wrap>
              <Button icon={<ImportOutlined />} loading={busyIntegration} onClick={doWfImport}>导入</Button>
              <Button icon={<CloudUploadOutlined />} onClick={() => wfFileRef.current?.click()}>上传文件</Button>
              <input ref={wfFileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={() => readFile(wfFileRef, setWfText)} />
            </Space>
            <Divider style={{ margin: '12px 0' }} />
            <Space style={{ width: '100%' }} wrap>
              <Input placeholder="工作流 ID" value={wfExportId} onChange={(e) => setWfExportId(e.target.value)} style={{ width: 220 }} />
              <Button icon={<ExportOutlined />} onClick={doWfExport}>导出工作流</Button>
            </Space>
          </Card>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto' }}>
      <Title level={3}><AppstoreOutlined /> 技能市场</Title>
      <Paragraph type="secondary">
        基于 agency-agents 协议的能力名册：可声明、可插拔、可经配额网关调用。支持上传本地技能/安装包、导入导出，
        并能从外部主流市场一键安装 MCP / 技能 / Agent 工具流。
      </Paragraph>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      {/* 平台技能调用弹窗 */}
      <Modal title={`调用技能：${active?.name}`} open={invokeOpen} onCancel={() => setInvokeOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setInvokeOpen(false)}>关闭</Button>,
          <Button key="run" type="primary" loading={running} onClick={doInvoke}>执行</Button>,
        ]} width={680}>
        {active && (
          <>
            <Paragraph type="secondary">关键规则：{active.criticalRules.join('；')}</Paragraph>
            <Text strong>输入参数（JSON）</Text>
            <Input.TextArea value={input} onChange={(e) => setInput(e.target.value)} autoSize={{ minRows: 8, maxRows: 16 }} style={{ fontFamily: 'monospace', marginTop: 8 }} />
            {result && (
              <div style={{ marginTop: 16 }}>
                <Text strong>返回结果</Text>
                <pre style={{ background: '#0d1117', color: '#c9d1d9', padding: 12, borderRadius: 6, maxHeight: 320, overflow: 'auto', fontSize: 12 }}>
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* 我的技能：导入弹窗 */}
      <Modal title="上传 / 导入技能包" open={importOpen} onCancel={() => setImportOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setImportOpen(false)}>取消</Button>,
          <Button key="run" type="primary" loading={importing} onClick={doImport}>导入</Button>,
        ]} width={680}>
        <Paragraph type="secondary">支持单个对象、数组或 {"{ skills: [] }"}。仅支持「声明式技能包」（prompt / 引用已接入的 MCP 或工作流），不会执行任意代码。</Paragraph>
        <Input.TextArea value={importText} onChange={(e) => setImportText(e.target.value)} autoSize={{ minRows: 8, maxRows: 16 }} placeholder={SAMPLE_PACKAGE} style={{ fontFamily: 'monospace' }} />
        <Space style={{ marginTop: 12 }}>
          <Button icon={<CloudUploadOutlined />} onClick={() => fileRef.current?.click()}>从文件上传</Button>
          <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={() => readFile(fileRef, setImportText)} />
          <Button size="small" type="link" icon={<CopyOutlined />} onClick={() => { setImportText(SAMPLE_PACKAGE); message.info('已填入示例'); }}>填入示例</Button>
        </Space>
      </Modal>

      {/* 我的技能：调用弹窗 */}
      <Modal title={`调用技能：${myActive?.name}`} open={myInvokeOpen} onCancel={() => setMyInvokeOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setMyInvokeOpen(false)}>关闭</Button>,
          <Button key="run" type="primary" loading={myRunning} onClick={doMyInvoke}>执行</Button>,
        ]} width={680}>
        {myActive && (
          <>
            <Paragraph type="secondary">类型：{myActive.kind || 'prompt'}（类型决定执行方式：prompt 走 AI 网关 / mcp 调外部工具 / workflow 跑工具流）</Paragraph>
            <Text strong>输入内容</Text>
            <Input.TextArea value={myInput} onChange={(e) => setMyInput(e.target.value)} autoSize={{ minRows: 4, maxRows: 12 }} placeholder='输入将作为 {{input}} 传入技能模板' style={{ marginTop: 8 }} />
            {myResult && (
              <div style={{ marginTop: 16 }}>
                <Text strong>返回结果</Text>
                <pre style={{ background: '#0d1117', color: '#c9d1d9', padding: 12, borderRadius: 6, maxHeight: 320, overflow: 'auto', fontSize: 12 }}>
                  {JSON.stringify(myResult, null, 2)}
                </pre>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default SkillsMarketPage;
