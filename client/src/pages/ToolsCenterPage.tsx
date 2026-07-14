import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Typography, Tabs, Select, Button, Input, Space, Tag, message,
  Row, Col, Spin, Empty, Upload, Divider, Menu, InputNumber, Slider,
  Result, List, Segmented,
} from 'antd';
import {
  TranslationOutlined, BulbOutlined, SwapOutlined, VideoCameraOutlined,
  ThunderboltOutlined, LineChartOutlined, RobotOutlined, FileTextOutlined,
  FundOutlined, StockOutlined, ShoppingCartOutlined, TikTokOutlined,
  WechatOutlined, GlobalOutlined, AuditOutlined, SafetyOutlined,
  IdcardOutlined, MailOutlined, ScheduleOutlined, ContainerOutlined,
  BarChartOutlined, CodeOutlined, ConsoleSqlOutlined, ApiOutlined,
  BookOutlined, ExperimentOutlined, PictureOutlined, EditOutlined,
} from '@ant-design/icons';
import { toolsAPI, extractApiError } from '@/services/api';
import { aiAPI } from '@/services/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// 通用 AI 工具组件已抽取至 components/tools/AITool.tsx（阶段3-3 前端拆分）
import AITool from '@/components/tools/AITool';

// ============ 主页面 ============
const TOOL_CATEGORIES = [
  { key: 'creative', label: '🎨 创作类', icon: <BulbOutlined /> },
  { key: 'analysis', label: '📊 分析类', icon: <BarChartOutlined /> },
  { key: 'dev', label: '💻 开发类', icon: <CodeOutlined /> },
  { key: 'marketing', label: '📢 营销类', icon: <GlobalOutlined /> },
  { key: 'business', label: '💼 商务类', icon: <IdcardOutlined /> },
  { key: 'office', label: '📋 办公类', icon: <ContainerOutlined /> },
  { key: 'legacy', label: '🔧 经典工具', icon: <ThunderboltOutlined /> },
];

const ToolsCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeCat, setActiveCat] = useState('creative');

  const tools = {
    creative: [
      { key: 'copywriting', component: CopywritingTool, label: '文案生成', icon: <BulbOutlined /> },
      { key: 'ppt', component: PPTOutlineTool, label: 'PPT大纲', icon: <FileTextOutlined /> },
      { key: 'script', component: VideoScriptTool, label: '视频脚本', icon: <VideoCameraOutlined /> },
      { key: 'story', component: StoryTool, label: '小说创作', icon: <BookOutlined /> },
    ],
    analysis: [
      { key: 'invest', component: InvestTool, label: '投资分析', icon: <StockOutlined /> },
      { key: 'data', component: DataTool, label: '数据分析', icon: <FundOutlined /> },
      { key: 'swot', component: SwotTool, label: 'SWOT分析', icon: <BarChartOutlined /> },
      { key: 'competitor', component: CompetitorTool, label: '竞品分析', icon: <LineChartOutlined /> },
    ],
    dev: [
      { key: 'code-explain', component: CodeExplainTool, label: '代码解释', icon: <CodeOutlined /> },
      { key: 'sql-gen', component: SQLGenTool, label: 'SQL生成', icon: <ConsoleSqlOutlined /> },
      { key: 'api-doc', component: APIDocTool, label: 'API文档', icon: <ApiOutlined /> },
      { key: 'regex', component: RegexTool, label: '正则表达式', icon: <ExperimentOutlined /> },
    ],
    marketing: [
      { key: 'ecommerce', component: EcommerceTool, label: '电商文案', icon: <ShoppingCartOutlined /> },
      { key: 'douyin', component: DouyinTool, label: '抖音脚本', icon: <TikTokOutlined /> },
      { key: 'wechat', component: WechatTool, label: '微信推文', icon: <WechatOutlined /> },
      { key: 'seo', component: SEOTool, label: 'SEO优化', icon: <GlobalOutlined /> },
    ],
    business: [
      { key: 'resume', component: ResumeTool, label: '简历优化', icon: <IdcardOutlined /> },
      { key: 'contract', component: ContractTool, label: '合同审查', icon: <AuditOutlined /> },
      { key: 'law', component: LawTool, label: '法律咨询', icon: <SafetyOutlined /> },
      { key: 'bizplan', component: BizPlanTool, label: '商业计划书', icon: <FundOutlined /> },
    ],
    office: [
      { key: 'email', component: EmailTool, label: '邮件撰写', icon: <MailOutlined /> },
      { key: 'meeting', component: MeetingTool, label: '会议纪要', icon: <ScheduleOutlined /> },
      { key: 'weekly', component: WeeklyTool, label: '周报生成', icon: <ContainerOutlined /> },
    ],
    legacy: [
      { key: 'translate', component: TranslateTool, label: '翻译', icon: <TranslationOutlined /> },
      { key: 'plan', component: PlanTool, label: '方案生成', icon: <BulbOutlined /> },
      { key: 'convert', component: ConvertTool, label: '文件转换', icon: <SwapOutlined /> },
      { key: 'media', component: MediaTool, label: '内容生产', icon: <VideoCameraOutlined /> },
    ],
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: 0 }}>
      {/* 左侧分类导航 */}
      <div style={{
        width: 180, flexShrink: 0, borderRight: '1px solid #f0f0f0',
        background: '#fafbfc', padding: '16px 12px', overflowY: 'auto',
      }}>
        <Title level={5} style={{ marginBottom: 16 }}>🛠️ 智能工具箱</Title>
        <Menu
          mode="inline"
          selectedKeys={[activeCat]}
          onClick={({ key }) => setActiveCat(key)}
          style={{ background: 'transparent', borderInlineEnd: 'none' }}
          items={TOOL_CATEGORIES.map((cat) => ({
            key: cat.key,
            icon: cat.icon,
            label: <span style={{ fontSize: 13 }}>{cat.label}</span>,
            children: (tools as any)[cat.key]?.map((t: any) => ({
              key: `${cat.key}-${t.key}`, label: <span style={{ fontSize: 12 }}>{t.icon} {t.label}</span>,
            })),
          }))}
        />
      </div>

      {/* 右侧工具区 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {/* 热门独立工具：合并「小红书文案 / 文生图」入口（调用云函数 4 模型） */}
        <div style={{ marginBottom: 18 }}>
          <Text strong style={{ fontSize: 13 }}>🚀 热门独立工具</Text>
          <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
            {[
              { label: '小红书文案', desc: '爆款笔记 / 种草文案生成', icon: <EditOutlined />, path: '/xhs', grad: 'linear-gradient(135deg,#ff6b6b,#ee5253)' },
              { label: '文生图 / 图生图', desc: 'HY-Image 免费模型出图', icon: <PictureOutlined />, path: '/text2img', grad: 'linear-gradient(135deg,#6c5ce7,#a29bfe)' },
            ].map((t) => (
              <div key={t.path} onClick={() => navigate(t.path)} style={{
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                borderRadius: 12, border: '1px solid var(--border, #f0f0f0)', background: 'var(--bg-container,#fff)',
                minWidth: 220, transition: 'all 0.25s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 26px rgba(0,0,0,0.12)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 10, background: t.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18 }}>{t.icon}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t.label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary,#888)' }}>{t.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <Tabs
          activeKey={Object.keys((tools as any)[activeCat] || {})[0]}
          tabPosition="top"
          type="card"
          size="small"
          items={(tools as any)[activeCat]?.map((t: any) => ({
            key: t.key,
            label: <span>{t.icon} {t.label}</span>,
            children: <t.component />,
          })) || []}
        />
      </div>
    </div>
  );
};

// ============ 各工具实现 ============

// --- 创作类 ---
const CopywritingTool = () => (
  <AITool icon={<BulbOutlined />} title="文案生成" desc="自动生成各类营销文案、广告语、产品描述"
    inputs={[
      { label: '文案类型', key: 'type', type: 'select', options: [
        { label: '广告语', value: '广告语' }, { label: '产品描述', value: '产品描述' },
        { label: '社媒文案', value: '社媒文案' }, { label: '宣传软文', value: '宣传软文' },
      ]},
      { label: '产品/品牌', key: 'product', type: 'text', placeholder: '输入产品名称或品牌' },
      { label: '核心卖点', key: 'features', type: 'textarea', placeholder: '列出产品核心卖点和特点' },
      { label: '目标受众', key: 'audience', type: 'text', placeholder: '如：25-35岁女性白领' },
    ]}
    promptTemplate={(p) => `请以专业文案写手的身份，撰写一段${p.type}。\n产品/品牌：${p.product}\n核心卖点：${p.features}\n目标受众：${p.audience}\n要求：吸引眼球、突出卖点、有说服力、200-500字`}
  />
);

const PPTOutlineTool = () => (
  <AITool icon={<FileTextOutlined />} title="PPT大纲" desc="快速生成演示文稿大纲，AI自动组织内容结构"
    inputs={[
      { label: '主题', key: 'topic', type: 'text', placeholder: '输入 PPT 主题' },
      { label: '页数', key: 'pages', type: 'number' },
      { label: '风格', key: 'style', type: 'select', options: [
        { label: '商业演示', value: '商业演示' }, { label: '教育培训', value: '教育培训' },
        { label: '产品介绍', value: '产品介绍' }, { label: '项目汇报', value: '项目汇报' },
      ]},
    ]}
    promptTemplate={(p) => `请为以下主题生成一份PPT大纲（${p.pages || 10}页，${p.style}风格）：\n主题：${p.topic}\n要求：每页包含标题和3-5个要点，逻辑清晰层层递进`}
  />
);

const VideoScriptTool = () => (
  <AITool icon={<VideoCameraOutlined />} title="视频脚本" desc="生成短视频/直播脚本，包含分镜和台词"
    inputs={[
      { label: '视频主题', key: 'topic', type: 'text', placeholder: '输入视频主题' },
      { label: '平台', key: 'platform', type: 'select', options: [
        { label: '抖音', value: '抖音' }, { label: 'B站', value: 'B站' },
        { label: 'YouTube', value: 'YouTube' }, { label: '视频号', value: '视频号' },
      ]},
      { label: '时长（秒）', key: 'duration', type: 'number' },
    ]}
    promptTemplate={(p) => `请为${p.platform}平台编写一段短视频脚本（${p.duration || 60}秒）：\n主题：${p.topic}\n要求：包含开场吸引注意力、主体内容、结尾引导互动，每10秒一个分镜描述`}
  />
);

const StoryTool = () => (
  <AITool icon={<BookOutlined />} title="小说创作" desc="AI辅助创作小说章节和情节大纲"
    inputs={[
      { label: '类型', key: 'genre', type: 'select', options: [
        { label: '科幻', value: '科幻' }, { label: '玄幻', value: '玄幻' },
        { label: '都市', value: '都市' }, { label: '悬疑', value: '悬疑' },
        { label: '言情', value: '言情' },
      ]},
      { label: '故事构思', key: 'idea', type: 'textarea', placeholder: '描述你的故事构思、人物设定等' },
    ]}
    promptTemplate={(p) => `请以小说家的身份，为以下${p.genre}小说构思提供创作建议：\n${p.idea}\n要求：提供人物关系图、前3章的情节大纲，以及写作风格建议`}
  />
);

// --- 分析类 ---
const InvestTool = () => (
  <AITool icon={<StockOutlined />} title="投资分析" desc="AI驱动的投资基本面和技术面分析"
    inputs={[
      { label: '投资对象', key: 'target', type: 'text', placeholder: '股票代码/基金名称/行业' },
      { label: '分析维度', key: 'dimension', type: 'select', options: [
        { label: '基本面分析', value: '基本面' }, { label: '技术面分析', value: '技术面' },
        { label: '行业趋势', value: '行业趋势' }, { label: '风险评估', value: '风险评估' },
      ]},
    ]}
    promptTemplate={(p) => `请以专业投资分析师的角度，对${p.target}进行${p.dimension}分析。\n要求：数据驱动的分析、客观判断、列出关键指标和风险提示。注意：本分析仅供参考，不构成投资建议。`}
  />
);

const DataTool = () => (
  <AITool icon={<FundOutlined />} title="数据分析" desc="智能数据洞察与可视化建议"
    inputs={[
      { label: '数据描述', key: 'data', type: 'textarea', placeholder: '粘贴或描述你的数据集...' },
      { label: '分析目标', key: 'goal', type: 'text', placeholder: '如：找出趋势、对比分析' },
    ]}
    promptTemplate={(p) => `请以数据分析师的角度，分析以下数据：\n${p.data}\n分析目标：${p.goal}\n要求：提供关键发现、趋势解读、数据可视化建议`}
  />
);

const SwotTool = () => (
  <AITool icon={<BarChartOutlined />} title="SWOT分析" desc="系统化评估项目/企业的优势劣势机会威胁"
    inputs={[
      { label: '分析对象', key: 'target', type: 'text', placeholder: '公司/产品/项目名称' },
      { label: '行业背景', key: 'context', type: 'textarea', placeholder: '简单描述行业和竞争环境' },
    ]}
    promptTemplate={(p) => `请对${p.target}进行专业的SWOT分析：\n背景：${p.context}\n要求：从优势(Strengths)、劣势(Weaknesses)、机会(Opportunities)、威胁(Threats)四个维度详细分析，每项至少3-5个要点`}
  />
);

const CompetitorTool = () => (
  <AITool icon={<LineChartOutlined />} title="竞品分析" desc="多维度对比竞品，识别差异化优势"
    inputs={[
      { label: '我方产品', key: 'ours', type: 'text', placeholder: '输入我方产品名称' },
      { label: '竞品列表', key: 'competitors', type: 'textarea', placeholder: '列出竞品名称，每行一个' },
    ]}
    promptTemplate={(p) => `请对以下产品进行竞品分析：\n我方：${p.ours}\n竞品：${p.competitors}\n要求：从产品功能、定价、用户体验、市场策略四个维度对比，给出差异化建议`}
  />
);

// --- 开发类 ---
const CodeExplainTool = () => (
  <AITool icon={<CodeOutlined />} title="代码解释" desc="逐行详细解释代码逻辑"
    inputs={[
      { label: '代码', key: 'code', type: 'textarea', placeholder: '粘贴需要解释的代码...' },
      { label: '语言', key: 'lang', type: 'select', options: [
        { label: 'JavaScript', value: 'JavaScript' }, { label: 'TypeScript', value: 'TypeScript' },
        { label: 'Python', value: 'Python' }, { label: 'Java', value: 'Java' },
        { label: 'Go', value: 'Go' }, { label: 'Rust', value: 'Rust' },
      ]},
      { label: '解释粒度', key: 'level', type: 'select', options: [
        { label: '简要概述', value: '简洁' }, { label: '详细逐行', value: '详细' },
        { label: '教学级别', value: '教学' },
      ]},
    ]}
    promptTemplate={(p) => `请以${p.level}方式解释以下${p.lang}代码：\n\`\`\`${(p.lang || 'js').toLowerCase()}\n${p.code}\n\`\`\``}
  />
);

const SQLGenTool = () => (
  <AITool icon={<ConsoleSqlOutlined />} title="SQL生成" desc="自然语言转SQL，支持MySQL/PostgreSQL"
    inputs={[
      { label: '需求描述', key: 'query', type: 'textarea', placeholder: '用自然语言描述查询需求...' },
      { label: '数据库', key: 'db', type: 'select', options: [
        { label: 'MySQL', value: 'MySQL' }, { label: 'PostgreSQL', value: 'PostgreSQL' },
      ]},
    ]}
    promptTemplate={(p) => `请根据以下需求生成${p.db} SQL语句：\n${p.query}\n要求：写出完整可执行的SQL，并附带简短注释说明`}
  />
);

const APIDocTool = () => (
  <AITool icon={<ApiOutlined />} title="API文档" desc="自动生成RESTful API文档"
    inputs={[
      { label: '接口描述', key: 'desc', type: 'textarea', placeholder: '描述你的API接口功能和参数...' },
    ]}
    promptTemplate={(p) => `请根据以下描述生成标准的RESTful API文档（包含路径、方法、请求参数、响应格式、示例）：\n${p.desc}`}
  />
);

const RegexTool = () => (
  <AITool icon={<ExperimentOutlined />} title="正则表达式" desc="自然语言生成正则表达式"
    inputs={[
      { label: '匹配需求', key: 'req', type: 'text', placeholder: '如：匹配中国大陆手机号' },
      { label: '编程语言', key: 'lang', type: 'select', options: [
        { label: 'JavaScript', value: 'JavaScript' }, { label: 'Python', value: 'Python' },
        { label: 'Java', value: 'Java' },
      ]},
    ]}
    promptTemplate={(p) => `请生成${p.lang}正则表达式来匹配：${p.req}\n要求：给出正则表达式、使用示例和简要说明`}
  />
);

// --- 营销类 ---
const EcommerceTool = () => (
  <AITool icon={<ShoppingCartOutlined />} title="电商文案" desc="生成淘宝/京东/拼多多商品标题与详情"
    inputs={[
      { label: '平台', key: 'platform', type: 'select', options: [
        { label: '淘宝', value: '淘宝' }, { label: '京东', value: '京东' },
        { label: '拼多多', value: '拼多多' }, { label: '抖音电商', value: '抖音电商' },
        { label: '亚马逊', value: '亚马逊' },
      ]},
      { label: '商品名称', key: 'name', type: 'text', placeholder: '输入商品名称' },
      { label: '商品特点', key: 'features', type: 'textarea', placeholder: '列出商品卖点和特点' },
    ]}
    promptTemplate={(p) => `请为${p.platform}平台撰写${p.name}的商品文案：\n商品特点：${p.features}\n要求：标题SEO优化+吸引点击、详情页卖点突出+有说服力。字数：标题30字以内，详情页200-500字`}
  />
);

const DouyinTool = () => (
  <AITool icon={<TikTokOutlined />} title="抖音脚本" desc="生成抖音短视频脚本和拍摄建议"
    inputs={[
      { label: '主题类型', key: 'type', type: 'select', options: [
        { label: '产品种草', value: '产品种草' }, { label: '知识科普', value: '知识科普' },
        { label: '剧情段子', value: '剧情段子' }, { label: '探店/测评', value: '探店测评' },
      ]},
      { label: '核心内容', key: 'content', type: 'textarea', placeholder: '描述视频要表达的核心内容' },
    ]}
    promptTemplate={(p) => `请为抖音平台编写一段${p.type}短视频脚本：\n内容：${p.content}\n要求：3秒黄金开头、15-30秒主内容、结尾引导互动、包含拍摄和BGM建议`}
  />
);

const WechatTool = () => (
  <AITool icon={<WechatOutlined />} title="微信推文" desc="生成公众号推文，支持排版建议"
    inputs={[
      { label: '推文主题', key: 'topic', type: 'text', placeholder: '输入推文主题' },
      { label: '风格', key: 'style', type: 'select', options: [
        { label: '深度好文', value: '深度' }, { label: '轻松趣味', value: '趣味' },
        { label: '干货教程', value: '教程' }, { label: '新闻资讯', value: '资讯' },
      ]},
    ]}
    promptTemplate={(p) => `请撰写一篇微信公众号推文（${p.style}风格）：\n主题：${p.topic}\n要求：吸引人的标题、引人入胜的开头、有深度的主体、互动结尾。800-1500字，附带排版建议。`}
  />
);

const SEOTool = () => (
  <AITool icon={<GlobalOutlined />} title="SEO优化" desc="网页标题、描述、关键词优化建议"
    inputs={[
      { label: '网页/文章URL或主题', key: 'topic', type: 'text', placeholder: '输入网页主题或URL' },
      { label: '目标关键词', key: 'keywords', type: 'textarea', placeholder: '目标关键词，每行一个' },
    ]}
    promptTemplate={(p) => `请对以下内容提供SEO优化建议：\n主题/URL：${p.topic}\n目标关键词：${p.keywords}\n要求：优化Title标签、Meta描述、H1标签、内容关键词布局建议`}
  />
);

// --- 商务类 ---
const ResumeTool = () => (
  <AITool icon={<IdcardOutlined />} title="简历优化" desc="AI优化简历措辞与排版建议"
    inputs={[
      { label: '目标岗位', key: 'position', type: 'text', placeholder: '如：高级前端工程师' },
      { label: '现有简历/经历', key: 'resume', type: 'textarea', placeholder: '粘贴你的工作经历和技能...' },
      { label: '优化方向', key: 'direction', type: 'select', options: [
        { label: '更专业', value: '专业' }, { label: '更量化', value: '量化' },
        { label: '更简洁', value: '简洁' },
      ]},
    ]}
    promptTemplate={(p) => `请以资深HR视角，优化以下简历（${p.direction}方向），目标是应聘${p.position}：\n${p.resume}\n要求：量化工作成果、使用行业关键词、突出匹配度`}
  />
);

const ContractTool = () => (
  <AITool icon={<AuditOutlined />} title="合同审查" desc="智能合同条款审查和风险提示"
    inputs={[
      { label: '合同类型', key: 'type', type: 'select', options: [
        { label: '劳动合同', value: '劳动合同' }, { label: '采购合同', value: '采购合同' },
        { label: '服务合同', value: '服务合同' }, { label: '保密协议', value: '保密协议' },
        { label: '租赁合同', value: '租赁合同' },
      ]},
      { label: '合同内容/条款', key: 'content', type: 'textarea', placeholder: '粘贴需要审查的关键条款...' },
    ]}
    promptTemplate={(p) => `请以法律顾问的角度审查以下${p.type}条款，提供风险提示和修改建议：\n${p.content}\n注意：本分析仅供参考，重要合同请咨询专业律师`}
  />
);

const LawTool = () => (
  <AITool icon={<SafetyOutlined />} title="法律咨询" desc="常见法律问题咨询与法规查询"
    inputs={[
      { label: '咨询领域', key: 'field', type: 'select', options: [
        { label: '劳动法', value: '劳动法' }, { label: '合同法', value: '合同法' },
        { label: '公司法', value: '公司法' }, { label: '知识产权', value: '知识产权' },
        { label: '消费者权益', value: '消费者权益' },
      ]},
      { label: '问题描述', key: 'question', type: 'textarea', placeholder: '详细描述你的法律问题...' },
    ]}
    promptTemplate={(p) => `请就以下${p.field}相关问题提供法律咨询：\n${p.question}\n要求：引用相关法规条文、提供实务建议。注意：本回答仅供参考，不构成正式法律意见`}
  />
);

const BizPlanTool = () => (
  <AITool icon={<FundOutlined />} title="商业计划书" desc="AI辅助撰写商业计划书框架"
    inputs={[
      { label: '项目名称', key: 'name', type: 'text', placeholder: '输入项目/公司名称' },
      { label: '行业领域', key: 'industry', type: 'text', placeholder: '如：人工智能/电商/教育' },
      { label: '项目简介', key: 'desc', type: 'textarea', placeholder: '简要描述项目的核心价值和商业模式' },
      { label: '融资阶段', key: 'stage', type: 'select', options: [
        { label: '种子轮', value: '种子轮' }, { label: '天使轮', value: '天使轮' },
        { label: 'A轮', value: 'A轮' }, { label: 'B轮+', value: 'B轮' },
      ]},
    ]}
    promptTemplate={(p) => `请为${p.name}撰写一份${p.stage}商业计划书框架：\n行业：${p.industry}\n简介：${p.desc}\n要求：包含市场分析、商业模式、竞争优势、团队介绍、财务预测、融资需求六个核心部分`}
  />
);

// --- 办公类 ---
const EmailTool = () => (
  <AITool icon={<MailOutlined />} title="邮件撰写" desc="专业商务邮件一键生成"
    inputs={[
      { label: '邮件类型', key: 'type', type: 'select', options: [
        { label: '商务合作', value: '商务合作' }, { label: '求职邮件', value: '求职邮件' },
        { label: '客户跟进', value: '客户跟进' }, { label: '拒绝邮件', value: '拒绝邮件' },
        { label: '感谢信', value: '感谢信' }, { label: '会议邀请', value: '会议邀请' },
      ]},
      { label: '收件人角色', key: 'recipient', type: 'text', placeholder: '如：客户/领导/HR' },
      { label: '核心内容', key: 'content', type: 'textarea', placeholder: '需要用到的关键信息...' },
    ]}
    promptTemplate={(p) => `请撰写一封${p.type}邮件，收件人是${p.recipient}：\n核心内容：${p.content}\n要求：专业得体、语气合适、结构清晰（主题行、称呼、正文、落款）`}
  />
);

const MeetingTool = () => (
  <AITool icon={<ScheduleOutlined />} title="会议纪要" desc="录音转文字或要点生成会议纪要"
    inputs={[
      { label: '会议主题', key: 'topic', type: 'text', placeholder: '输入会议主题' },
      { label: '讨论要点', key: 'points', type: 'textarea', placeholder: '粘贴或输入讨论的要点...' },
    ]}
    promptTemplate={(p) => `请将以下会议讨论内容整理为标准的会议纪要：\n主题：${p.topic}\n要点：${p.points}\n要求：包含会议时间/地点（留空）、参会人员（留空）、讨论议题、决议事项、待办事项及负责人`}
  />
);

const WeeklyTool = () => (
  <AITool icon={<ContainerOutlined />} title="周报生成" desc="自动生成结构化的周报汇报"
    inputs={[
      { label: '角色', key: 'role', type: 'text', placeholder: '如：产品经理/研发工程师' },
      { label: '本周工作', key: 'work', type: 'textarea', placeholder: '列出本周完成的工作...' },
      { label: '下周计划', key: 'plan', type: 'textarea', placeholder: '下周计划...' },
    ]}
    promptTemplate={(p) => `请将以下内容整理为一份${p.role}的周报：\n本周工作：${p.work}\n下周计划：${p.plan}\n要求：结构化清晰、突出重点成果、有数据的地方加上量化指标`}
  />
);

// ============ 经典工具（保留原有实现） ============
const TranslateTool: React.FC = () => {
  const [langs, setLangs] = useState<{ code: string; name: string }[]>([]);
  const [source, setSource] = useState('auto');
  const [target, setTarget] = useState('en');
  const [text, setText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { toolsAPI.languages().then((r: any) => setLangs(r.data || [])).catch(() => {}); }, []);

  const onTranslate = async () => {
    if (!text.trim()) return message.warning('请输入文本');
    setLoading(true);
    try { const res: any = await toolsAPI.translate({ text, targetLang: target, sourceLang: source }); setResult(res.data); }
    catch (e) { message.error(extractApiError(e, '翻译失败')); }
    setLoading(false);
  };

  return (
    <Row gutter={16}>
      <Col span={12}>
        <Card size="small" title="源文本" extra={
          <Select style={{ width: 160 }} value={source} onChange={setSource}
            options={[{ code: 'auto', name: '自动检测' }, ...langs].map(l => ({ value: l.code, label: l.name }))} />
        }>
          <TextArea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder="输入要翻译的文本..." />
          <Button type="primary" block icon={<TranslationOutlined />} loading={loading} onClick={onTranslate} style={{ marginTop: 12 }}>立即翻译</Button>
        </Card>
      </Col>
      <Col span={12}>
        <Card size="small" title="翻译结果" extra={
          <Select style={{ width: 160 }} value={target} onChange={setTarget}
            options={langs.map(l => ({ value: l.code, label: l.name }))} />
        }>
          <div style={{ minHeight: 240 }}>
            {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div> : result ? (
              <>
                <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{result.translatedText}</Paragraph>
                <Space><Tag color="blue">{result.sourceLang} → {result.targetLang}</Tag><Tag>{result.provider}/{result.model}</Tag></Space>
              </>
            ) : <Empty description="等待翻译" />}
          </div>
        </Card>
      </Col>
    </Row>
  );
};

const PlanTool: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [type, setType] = useState('general');
  const [length, setLength] = useState('detailed');
  const [audience, setAudience] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const onGenerate = async () => {
    if (!topic.trim()) return message.warning('请输入方案主题');
    setLoading(true);
    try { const res: any = await toolsAPI.generatePlan({ topic, type, length, audience }); setResult(res.data); }
    catch (e) { message.error(extractApiError(e, '生成失败')); }
    setLoading(false);
  };

  return (
    <Row gutter={16}>
      <Col span={8}>
        <Card size="small" title="方案参数">
          <Text>主题</Text><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="例如：AI 教育产品上线推广" style={{ marginBottom: 12 }} />
          <Text>类型</Text><Select style={{ width: '100%', marginBottom: 12 }} value={type} onChange={setType} options={[
            { value: 'general', label: '综合方案' }, { value: 'business', label: '商业方案' },
            { value: 'marketing', label: '营销方案' }, { value: 'technical', label: '技术方案' },
            { value: 'education', label: '教育方案' },
          ]} />
          <Text>篇幅</Text><Select style={{ width: '100%', marginBottom: 12 }} value={length} onChange={setLength} options={[
            { value: 'brief', label: '简洁版' }, { value: 'detailed', label: '标准版' }, { value: 'comprehensive', label: '完整版' },
          ]} />
          <Text>受众</Text><Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="例如：中小企业主" style={{ marginBottom: 12 }} />
          <Button type="primary" block icon={<BulbOutlined />} loading={loading} onClick={onGenerate}>生成方案</Button>
        </Card>
      </Col>
      <Col span={16}>
        <Card size="small" title="生成结果">
          <div style={{ minHeight: 320, maxHeight: 520, overflowY: 'auto' }}>
            {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div> : result ? (
              <>
                <Space wrap style={{ marginBottom: 8 }}>
                  <Tag color="green">{result.type}</Tag>
                  {result.outline?.map((o: string, i: number) => <Tag key={i}>{o}</Tag>)}
                </Space>
                <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{result.content}</Paragraph>
              </>
            ) : <Empty description="填写左侧参数后生成" />}
          </div>
        </Card>
      </Col>
    </Row>
  );
};

const ConvertTool: React.FC = () => {
  const [formats, setFormats] = useState<any[]>([]);
  const [file, setFile] = useState<{ name: string; content: string } | null>(null);
  const [target, setTarget] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { toolsAPI.convertFormats().then((r: any) => setFormats(r.data || [])).catch(() => {}); }, []);
  const allTargets = Array.from(new Set(formats.flatMap((f: any) => f.to)));

  const onConvert = async () => {
    if (!file) return message.warning('请先选择文件');
    if (!target) return message.warning('请选择目标格式');
    setLoading(true);
    try {
      const sourceFmt = file.name.split('.').pop() || '';
      const res: any = await toolsAPI.convert({ fileName: file.name, sourceFormat: sourceFmt, targetFormat: target, content: file.content });
      setResult(res.data);
    } catch (e) { message.error(extractApiError(e, '转换失败')); }
    setLoading(false);
  };

  return (
    <Card>
      <Row gutter={16}>
        <Col span={12}>
          <Title level={5}>上传文件</Title>
          <Upload beforeUpload={(f: any) => { const reader = new FileReader(); reader.onload = () => setFile({ name: f.name, content: String(reader.result) }); reader.readAsText(f); return false; }} maxCount={1} accept=".txt,.md,.csv,.json,.html,.xml">
            <Button icon={<FileTextOutlined />}>选择文件</Button>
          </Upload>
          {file && <Tag style={{ marginTop: 8 }}>{file.name}</Tag>}
          <Divider />
          <Text>目标格式</Text>
          <Select style={{ width: '100%', marginTop: 8 }} value={target || undefined} onChange={setTarget}
            options={allTargets.map((t: string) => ({ value: t, label: '.' + t }))} />
          <Button type="primary" block icon={<SwapOutlined />} loading={loading} onClick={onConvert} style={{ marginTop: 16 }}>开始转换</Button>
        </Col>
        <Col span={12}>
          <Title level={5}>转换结果</Title>
          <div style={{ minHeight: 200 }}>
            {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div> : result ? (
              <div>
                <Paragraph>文件：{result.sourceName} → {result.outputName}</Paragraph>
                {result.downloadUrl && <Button icon={<ThunderboltOutlined />} type="primary" href={result.downloadUrl}>下载</Button>}
              </div>
            ) : <Empty description="等待转换" />}
          </div>
        </Col>
      </Row>
    </Card>
  );
};

const MediaTool: React.FC = () => {
  const [types, setTypes] = useState<any[]>([]);
  const [type, setType] = useState('text2img');
  const [prompt, setPrompt] = useState('');
  const [refImage, setRefImage] = useState<string>('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { toolsAPI.mediaTypes().then((r: any) => setTypes(r.data || [])).catch(() => {}); }, []);

  const onGenerate = async () => {
    if (!prompt.trim()) return message.warning('请输入提示词');
    if (type === 'image2image' && !refImage) return message.warning('图生图请先上传参考图');
    setLoading(true);
    try {
      const res: any = await toolsAPI.mediaGenerate(
        type === 'image2image'
          ? { type: type as any, prompt, imageBase64: refImage }
          : { type: type as any, prompt }
      );
      setResult(res.data);
    }
    catch (e) { message.error(extractApiError(e, '生成失败')); }
    setLoading(false);
  };

  return (
    <Row gutter={16}>
      <Col span={10}>
        <Card size="small" title="生产参数">
          <Text>类型</Text>
          <Select style={{ width: '100%', marginBottom: 12 }} value={type} onChange={(v) => { setType(v); setResult(null); }}
            options={types.map((t: any) => ({ value: t.type, label: `${t.label} - ${t.desc}` }))} />
          {type === 'image2image' && (
            <>
              <Text>参考图（图生图）</Text>
              <Upload beforeUpload={(f: any) => {
                const reader = new FileReader();
                reader.onload = () => setRefImage(String(reader.result));
                reader.readAsDataURL(f);
                return false;
              }} maxCount={1} accept="image/*" style={{ marginBottom: 12 }}>
                <Button icon={<PictureOutlined />}>上传参考图</Button>
              </Upload>
            </>
          )}
          <Text>提示词</Text>
          <TextArea rows={6} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="描述你想要生成的内容..." style={{ marginBottom: 12 }} />
          <Button type="primary" block icon={<VideoCameraOutlined />} loading={loading} onClick={onGenerate}>生成</Button>
          <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 10 }}>
            文生图 / 图生图由 AIbak 免费额度（HY-Image）真实生成；视频类需配置对应厂商 Key。
          </Paragraph>
        </Card>
      </Col>
      <Col span={14}>
        <Card size="small" title="生成预览">
          <div style={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', borderRadius: 8 }}>
            {loading ? <Spin size="large" /> : result ? (
              <div style={{ textAlign: 'center' }}>
                {result.outputUrl && <img src={result.outputUrl} alt="result" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8 }} />}
                {result.images?.map((u: string, i: number) => (
                  <img key={i} src={u} alt={`img-${i}`} style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 8, margin: 4 }} />
                ))}
                <div style={{ marginTop: 8 }}>
                  <Tag color="blue">{result.type}</Tag>
                  <Tag>{result.provider}</Tag>
                </div>
              </div>
            ) : <Empty description="填写参数后生成" />}
          </div>
        </Card>
      </Col>
    </Row>
  );
};

export default ToolsCenterPage;
