/**
 * 可视化工作流编辑器
 * 对标 Langflow/Dify 的核心能力：拖拽节点 → 连线编排 → 一键执行
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Node,
  Edge,
  BackgroundVariant,
  Panel,
  NodeTypes,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Button, Space, Input, Modal, message, Spin, Drawer, Form,
  Select, InputNumber, Typography, Tag, Card, Badge, Tooltip,
  Collapse, Divider, Empty,
} from 'antd';
import {
  SaveOutlined, PlayCircleOutlined, PlusOutlined, ArrowLeftOutlined,
  ShareAltOutlined, CopyOutlined, DeleteOutlined, ThunderboltOutlined,
  RobotOutlined, SearchOutlined, TranslationOutlined, GlobalOutlined,
  BranchesOutlined, CodeOutlined, PictureOutlined, ImportOutlined,
  ExportOutlined, ApiOutlined, NodeIndexOutlined, HistoryOutlined,
} from '@ant-design/icons';
import apiClient, { skillsAPI } from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// ── 类型定义 ──────────────────────────────────────────

interface WorkflowData {
  _id?: string;
  name: string;
  description?: string;
  nodes: any[];
  edges: any[];
  tags: string[];
  category: string;
  isPublic: boolean;
}

interface NodeTypeInfo {
  type: string;
  label: string;
  category: string;
  icon: string;
  color: string;
  defaultConfig: Record<string, any>;
}

interface ExecutionResult {
  runId: string;
  output: any;
  nodeExecutions: { nodeId: string; nodeLabel: string; status: string; output?: any; error?: string; duration?: number }[];
}

// ── 节点图标映射 ──────────────────────────────────────

const iconMap: Record<string, React.ReactNode> = {
  input: <ImportOutlined />,
  output: <ExportOutlined />,
  ai_chat: <RobotOutlined />,
  rag_search: <SearchOutlined />,
  translate: <TranslationOutlined />,
  web_search: <GlobalOutlined />,
  condition: <BranchesOutlined />,
  code: <CodeOutlined />,
  skill: <ThunderboltOutlined />,
  media_gen: <PictureOutlined />,
};

// ── 自定义节点渲染 ────────────────────────────────────

const WorkflowNode = ({ data }: any) => {
  const color = data.color || '#1890ff';
  return (
    <div
      style={{
        padding: '10px 16px',
        border: `2px solid ${color}`,
        borderRadius: 8,
        background: '#fff',
        minWidth: 160,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        fontSize: 13,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ color, fontSize: 16 }}>{iconMap[data.nodeType] || <NodeIndexOutlined />}</span>
        <Text strong style={{ fontSize: 13 }}>{data.label}</Text>
      </div>
      <Text type="secondary" style={{ fontSize: 11 }}>{data.nodeType}</Text>
      {data.status && (
        <Badge
          status={data.status === 'success' ? 'success' : data.status === 'error' ? 'error' : 'processing'}
          style={{ marginLeft: 8 }}
        />
      )}
    </div>
  );
};

const nodeTypes: NodeTypes = { workflowNode: WorkflowNode };

// ── 主组件 ────────────────────────────────────────────

export default function WorkflowEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // 状态
  const [workflowName, setWorkflowName] = useState('未命名工作流');
  const [workflowDesc, setWorkflowDesc] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<ExecutionResult | null>(null);
  const [nodeTypesList, setNodeTypesList] = useState<NodeTypeInfo[]>([]);
  const [skillOptions, setSkillOptions] = useState<{ label: string; value: string }[]>([]);
  const [testInput, setTestInput] = useState('');

  // ── 加载节点类型 ─────────────────────────────────

  useEffect(() => {
    apiClient.get('/api/wf/node-types')
      .then(res => setNodeTypesList(res.data.data || []))
      .catch(() => {
        // 默认类型
        setNodeTypesList([
          { type: 'input', label: '输入', category: '基础', icon: 'ImportOutlined', color: '#52c41a', defaultConfig: {} },
          { type: 'output', label: '输出', category: '基础', icon: 'ExportOutlined', color: '#fa8c16', defaultConfig: {} },
          { type: 'ai_chat', label: 'AI 对话', category: 'AI', icon: 'RobotOutlined', color: '#1890ff', defaultConfig: { temperature: 0.7 } },
          { type: 'rag_search', label: 'RAG 检索', category: 'AI', icon: 'SearchOutlined', color: '#722ed1', defaultConfig: { maxDocuments: 5 } },
          { type: 'translate', label: '翻译', category: 'AI', icon: 'TranslationOutlined', color: '#13c2c2', defaultConfig: { targetLanguage: '英文' } },
          { type: 'code', label: '代码执行', category: '处理', icon: 'CodeOutlined', color: '#2f54eb', defaultConfig: {} },
        ]);
      });
  }, []);

  // ── 加载技能列表（供技能节点选择）──
  useEffect(() => {
    skillsAPI.list()
      .then((res: any) => {
        const list = res?.data?.skills || res?.skills || [];
        setSkillOptions(
          list.map((s: any) => ({ label: `${s.name}（${s.id}）`, value: s.id }))
        );
      })
      .catch(() => { /* 失败时技能下拉为空，节点仍可手动填 skillId */ });
  }, []);

  // ── 加载已有工作流 ───────────────────────────────

  useEffect(() => {
    if (id) {
      setLoading(true);
      apiClient.get(`/api/wf/${id}`)
        .then(res => {
          const wf = res.data.data;
          setWorkflowName(wf.name);
          setWorkflowDesc(wf.description || '');
          setNodes(wf.nodes || []);
          setEdges(wf.edges || []);
        })
        .catch(() => message.error('加载工作流失败'))
        .finally(() => setLoading(false));
    }
  }, [id]);

  // ── 连线处理 ─────────────────────────────────────

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds: Edge[]) => addEdge({
      ...params,
      type: 'smoothstep',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#1890ff' },
    }, eds)),
    [setEdges]
  );

  // ── 拖拽添加节点 ─────────────────────────────────

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const typeStr = event.dataTransfer.getData('application/reactflow');
      const nt = nodeTypesList.find(n => n.type === typeStr);
      if (!nt || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = {
        x: event.clientX - bounds.left - 80,
        y: event.clientY - bounds.top - 25,
      };

      const newNode: Node = {
        id: `${nt.type}-${Date.now()}`,
        type: 'workflowNode',
        position,
        data: {
          label: nt.label,
          nodeType: nt.type,
          color: nt.color,
          config: { ...nt.defaultConfig },
        },
      };

      setNodes((nds: Node[]) => [...nds, newNode]);
    },
    [nodeTypesList, setNodes]
  );

  // ── 节点选中 ─────────────────────────────────────

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setDrawerOpen(true);
  }, []);

  // ── 更新节点配置 ─────────────────────────────────

  const updateNodeConfig = (key: string, value: any) => {
    if (!selectedNode) return;
    setNodes((nds: Node[]) =>
      nds.map((n: Node) =>
        n.id === selectedNode.id
          ? { ...n, data: { ...n.data, config: { ...n.data.config, [key]: value } } }
          : n
      )
    );
    setSelectedNode((prev: Node | null) =>
      prev ? { ...prev, data: { ...prev.data, config: { ...prev.data.config, [key]: value } } } : null
    );
  };

  // ── 保存工作流 ─────────────────────────────────

  const handleSave = async () => {
    if (!workflowName.trim()) {
      message.warning('请输入工作流名称');
      return;
    }
    setSaving(true);
    try {
      const payload: WorkflowData = {
        name: workflowName,
        description: workflowDesc,
        nodes,
        edges,
        tags: [],
        category: '通用',
        isPublic: false,
      };

      let saved;
      if (id) {
        saved = await apiClient.put(`/api/wf/${id}`, payload);
      } else {
        saved = await apiClient.post('/api/wf', payload);
      }

      message.success('工作流已保存');
      if (!id && saved.data.data?._id) {
        navigate(`/workflow/${saved.data.data._id}`, { replace: true });
      }
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // ── 执行工作流 ─────────────────────────────────

  const handleExecute = async () => {
    if (!id) {
      message.warning('请先保存工作流');
      return;
    }
    setExecuting(true);
    setExecResult(null);
    try {
      const res = await apiClient.post(`/api/wf/${id}/execute`, {
        input: { userInput: testInput || 'Hello' },
      });
      setExecResult(res.data.data);
      message.success('执行完成');

      // 更新节点状态
      if (res.data.data?.nodeExecutions) {
        setNodes((nds: Node[]) =>
          nds.map((n: Node) => {
            const exec = res.data.data.nodeExecutions.find((e: any) => e.nodeId === n.id);
            return exec
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    status: exec.status,
                    lastOutput: exec.output,
                  },
                }
              : n;
          })
        );
      }
    } catch (err: any) {
      message.error(err?.response?.data?.error || '执行失败');
    } finally {
      setExecuting(false);
    }
  };

  // ── 删除选中节点 ─────────────────────────────────

  const handleDeleteNode = () => {
    if (!selectedNode) return;
    Modal.confirm({
      title: '删除节点',
      content: `确定删除「${selectedNode.data.label}」节点？`,
      onOk: () => {
        setNodes((nds: Node[]) => nds.filter((n: Node) => n.id !== selectedNode.id));
        setEdges((eds: Edge[]) => eds.filter((e: Edge) => e.source !== selectedNode.id && e.target !== selectedNode.id));
        setSelectedNode(null);
        setDrawerOpen(false);
      },
    });
  };

  // ── 发布为 API ──────────────────────────────────

  const handlePublish = async () => {
    if (!id) { message.warning('请先保存工作流'); return; }
    try {
      const res = await apiClient.post(`/api/wf/${id}/publish`);
      const { apiKey, endpoint } = res.data.data;
      Modal.success({
        title: '发布成功！',
        content: (
          <div>
            <p>API 端点：<code>{endpoint}</code></p>
            <p>API Key：<code>{apiKey}</code></p>
            <p style={{ marginTop: 8, color: '#8c8c8c', fontSize: 12 }}>
              调用方式：POST {endpoint} + Header X-API-Key: {apiKey}
            </p>
          </div>
        ),
        width: 520,
      });
    } catch { message.error('发布失败'); }
  };

  // ── 节点类型分组 ─────────────────────────────────

  const groupedTypes = nodeTypesList.reduce<Record<string, NodeTypeInfo[]>>((acc, nt) => {
    const cat = nt.category || 'AI';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(nt);
    return acc;
  }, {});

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center' }}><Spin size="large" tip="加载工作流..." /></div>;
  }

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      {/* 顶栏 */}
      <div style={{
        padding: '8px 16px', borderBottom: '1px solid #f0f0f0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: '#fff', zIndex: 10,
      }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/workflows')}>返回</Button>
          <Input
            value={workflowName}
            onChange={e => setWorkflowName(e.target.value)}
            placeholder="工作流名称"
            bordered={false}
            style={{ fontSize: 16, fontWeight: 600, width: 240 }}
          />
        </Space>
        <Space>
          <Input
            value={testInput}
            onChange={e => setTestInput(e.target.value)}
            placeholder="测试输入..."
            style={{ width: 200 }}
            size="small"
          />
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleExecute}
            loading={executing}
            disabled={!id}
          >
            运行测试
          </Button>
          <Button icon={<ApiOutlined />} onClick={handlePublish} disabled={!id}>
            发布API
          </Button>
          <Button icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
            保存
          </Button>
        </Space>
      </div>

      {/* 画布区 */}
      <div style={{ flex: 1, display: 'flex' }}>
        {/* 左侧节点面板 */}
        <div style={{
          width: 220, background: '#fafafa', borderRight: '1px solid #f0f0f0',
          overflowY: 'auto', padding: 12,
        }}>
          <Title level={5} style={{ marginTop: 0 }}>🧩 节点组件</Title>
          {Object.entries(groupedTypes).map(([cat, types]) => (
            <Collapse key={cat} ghost defaultActiveKey={[cat]} size="small"
              items={[{
                key: cat, label: <Text strong>{cat}</Text>,
                children: types.map(nt => (
                  <Card
                    key={nt.type}
                    size="small"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/reactflow', nt.type);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    style={{ marginBottom: 8, cursor: 'grab', borderColor: nt.color }}
                    bodyStyle={{ padding: '8px 12px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: nt.color }}>{iconMap[nt.type] || <NodeIndexOutlined />}</span>
                      <Text style={{ fontSize: 13 }}>{nt.label}</Text>
                    </div>
                  </Card>
                )),
              }]}
            />
          ))}
          <Divider style={{ margin: '12px 0' }} />
          <Text type="secondary" style={{ fontSize: 11 }}>
            💡 拖拽节点到画布，连接节点间端口即可构建工作流
          </Text>
        </div>

        {/* React Flow 画布 */}
        <div ref={reactFlowWrapper} style={{ flex: 1 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={() => { setSelectedNode(null); setDrawerOpen(false); }}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={['Backspace', 'Delete']}
            multiSelectionKeyCode="Shift"
          >
            <Controls />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            <MiniMap
              nodeStrokeColor="#1890ff"
              nodeColor={(n: Node) => n.data?.color || '#1890ff'}
              style={{ background: '#f5f5f5' }}
            />
            <Panel position="top-left" style={{ margin: '60px 0 0 12px' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                节点: {nodes.length} | 连线: {edges.length}
              </Text>
            </Panel>
          </ReactFlow>
        </div>

        {/* 右侧属性面板 */}
        <Drawer
          title={
            <Space>
              <span style={{ color: selectedNode?.data?.color }}>
                {iconMap[selectedNode?.data?.nodeType] || <NodeIndexOutlined />}
              </span>
              {selectedNode?.data?.label || '属性配置'}
            </Space>
          }
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={320}
          extra={
            <Button danger size="small" icon={<DeleteOutlined />} onClick={handleDeleteNode}>
              删除
            </Button>
          }
        >
          {selectedNode && (
            <div>
              <Form layout="vertical" size="small">
                <Form.Item label="节点类型">
                  <Tag color={selectedNode.data?.color}>{selectedNode.data?.nodeType}</Tag>
                </Form.Item>
                <Form.Item label="节点标签">
                  <Input
                    value={selectedNode.data?.label}
                    onChange={(e) => {
                      const newLabel = e.target.value;
                      setNodes((nds: Node[]) =>
                        nds.map((n: Node) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, label: newLabel } } : n))
                      );
                    }}
                  />
                </Form.Item>

                {/* 根据节点类型显示不同配置 */}
                {selectedNode.data?.nodeType === 'ai_chat' && (
                  <>
                    <Form.Item label="系统提示词">
                      <TextArea
                        rows={3}
                        value={selectedNode.data?.config?.systemPrompt || ''}
                        onChange={(e) => updateNodeConfig('systemPrompt', e.target.value)}
                      />
                    </Form.Item>
                    <Form.Item label="温度 (Temperature)">
                      <InputNumber
                        min={0} max={2} step={0.1}
                        value={selectedNode.data?.config?.temperature || 0.7}
                        onChange={(v) => updateNodeConfig('temperature', v)}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </>
                )}

                {selectedNode.data?.nodeType === 'rag_search' && (
                  <>
                    <Form.Item label="检索文档数">
                      <InputNumber
                        min={1} max={20}
                        value={selectedNode.data?.config?.maxDocuments || 5}
                        onChange={(v) => updateNodeConfig('maxDocuments', v)}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                    <Form.Item label="最小相似度">
                      <InputNumber
                        min={0} max={1} step={0.05}
                        value={selectedNode.data?.config?.minSimilarity || 0.7}
                        onChange={(v) => updateNodeConfig('minSimilarity', v)}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </>
                )}

                {selectedNode.data?.nodeType === 'translate' && (
                  <Form.Item label="目标语言">
                    <Select
                      value={selectedNode.data?.config?.targetLanguage || '英文'}
                      onChange={(v) => updateNodeConfig('targetLanguage', v)}
                      options={[
                        { label: '英文', value: '英文' },
                        { label: '中文', value: '中文' },
                        { label: '日文', value: '日文' },
                        { label: '韩文', value: '韩文' },
                        { label: '法文', value: '法文' },
                        { label: '德文', value: '德文' },
                      ]}
                    />
                  </Form.Item>
                )}

                {selectedNode.data?.nodeType === 'condition' && (
                  <Form.Item label="条件表达式 (JS)">
                    <TextArea
                      rows={2}
                      value={selectedNode.data?.config?.condition || ''}
                      onChange={(e) => updateNodeConfig('condition', e.target.value)}
                      placeholder="如: input > 0.5"
                    />
                  </Form.Item>
                )}

                {selectedNode.data?.nodeType === 'code' && (
                  <Form.Item label="代码片段 (JS)">
                    <TextArea
                      rows={6}
                      value={selectedNode.data?.config?.code || 'return input;'}
                      onChange={(e) => updateNodeConfig('code', e.target.value)}
                      style={{ fontFamily: 'monospace', fontSize: 12 }}
                    />
                  </Form.Item>
                )}

                {selectedNode.data?.nodeType === 'skill' && (
                  <Form.Item
                    label="选择技能"
                    extra="技能节点将真实调用所选技能（内置技能或你已安装的技能），未选择时执行会明确报错。"
                  >
                    <Select
                      showSearch
                      placeholder={skillOptions.length ? '选择要调用的技能' : '技能加载中或暂无可用技能'}
                      value={selectedNode.data?.config?.skillId || selectedNode.data?.config?.skillName || undefined}
                      onChange={(v) => updateNodeConfig('skillId', v)}
                      options={skillOptions}
                      style={{ width: '100%' }}
                      notFoundContent="无可用技能"
                    />
                  </Form.Item>
                )}


                {/* 输出信息 */}
                {selectedNode.data?.lastOutput !== undefined && (
                  <>
                    <Divider />
                    <Text strong>上次输出</Text>
                    <pre style={{
                      background: '#f5f5f5', padding: 8, borderRadius: 6,
                      fontSize: 12, maxHeight: 200, overflow: 'auto',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    }}>
                      {typeof selectedNode.data.lastOutput === 'string'
                        ? selectedNode.data.lastOutput
                        : JSON.stringify(selectedNode.data.lastOutput, null, 2)}
                    </pre>
                  </>
                )}
              </Form>
            </div>
          )}
        </Drawer>
      </div>

      {/* 执行结果展示 */}
      {execResult && (
        <div style={{
          maxHeight: 200, overflow: 'auto', borderTop: '1px solid #f0f0f0',
          background: '#fafafa', padding: '8px 16px',
        }}>
          <Space style={{ marginBottom: 4 }}>
            <Text strong>执行结果</Text>
            <Tag color="green">耗时 {execResult.nodeExecutions.reduce((s: number, e: any) => s + (e.duration || 0), 0)}ms</Tag>
          </Space>
          <pre style={{ fontSize: 12, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {typeof execResult.output === 'string' ? execResult.output : JSON.stringify(execResult.output, null, 2)}
          </pre>
          <Space style={{ marginTop: 8 }}>
            {execResult.nodeExecutions.map((ne: any) => (
              <Tag
                key={ne.nodeId}
                color={ne.status === 'success' ? 'green' : ne.status === 'error' ? 'red' : 'blue'}
              >
                {ne.nodeLabel}: {ne.status} ({ne.duration}ms)
              </Tag>
            ))}
          </Space>
        </div>
      )}
    </div>
  );
}
