"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_QUICKSTART_TEMPLATES = exports.INDUSTRY_TEMPLATES = exports.QUICKSTART_TEMPLATES = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const KnowledgeDocument_1 = require("../models/KnowledgeDocument");
const CustomerService_1 = require("../models/CustomerService");
const Team_1 = require("../models/Team");
const resourceAccess_1 = require("../middleware/resourceAccess");
const http_error_1 = require("../lib/http-error");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
/** 场景化快速启动模板：差异化亮点（对标 n8n 模板市场 / Dify 应用模板），降低上手门槛 */
exports.QUICKSTART_TEMPLATES = [
    {
        id: 'customer-service',
        name: '企业智能客服',
        desc: '一键搭建由知识库支撑的售前/售后客服机器人',
        icon: 'CustomerService',
        category: 'generic',
        knowledge: [
            { title: '产品常见问答', content: '# 产品常见问答\n## 如何退款？\n在订单页申请退款，1-3 个工作日原路返回。', tags: ['faq'] },
            { title: '服务时间与联系方式', content: '# 服务时间\n工作日 9:00-18:00，紧急问题请留联系方式。', tags: ['contact'] },
        ],
        bot: { name: '官网智能客服', systemPrompt: '你是专业客服，依据知识库准确回答，不编造。', welcomeMessage: '您好，我是智能客服，请问有什么可以帮您？' },
        modelHint: '建议使用 DeepSeek / 混元 等国内模型',
    },
    {
        id: 'media-ops',
        name: '新媒体运营助手',
        desc: '自媒体内容生产：文案、图生图、文生视频一站生成',
        icon: 'VideoCamera',
        category: 'generic',
        knowledge: [{ title: '品牌调性指南', content: '# 品牌调性\n年轻、专业、有温度。', tags: ['brand'] }],
        bot: { name: '内容运营助手', systemPrompt: '你是资深新媒体运营，擅长爆款文案与选题。', welcomeMessage: '想产出哪类内容？我来帮你规划。' },
        modelHint: '文案建议 DeepSeek；视频建议接混元/可灵/即梦',
    },
    {
        id: 'study-coach',
        name: '考试备考顾问',
        desc: '基于资料库的学习教练，答疑 + 出题 + 路径规划',
        icon: 'Read',
        category: 'generic',
        knowledge: [{ title: '考试大纲', content: '# 考试大纲\n掌握核心概念与常见题型。', tags: ['exam'] }],
        bot: { name: '备考顾问', systemPrompt: '你是耐心细致的备考导师，依据资料讲解并出题。', welcomeMessage: '告诉我你在备考什么，我来帮你规划。' },
        modelHint: '建议 GPT-4o / DeepSeek 等强推理模型',
    },
    {
        id: 'dev-wiki',
        name: '开发团队知识库',
        desc: '团队文档中枢 + 技术问答客服，沉淀研发资产',
        icon: 'Code',
        category: 'generic',
        knowledge: [{ title: '服务架构概览', content: '# 架构\n前端 React，后端 Express，数据 MongoDB。', tags: ['arch'] }],
        bot: { name: '研发助手', systemPrompt: '你是团队技术助手，依据内部文档解答工程问题。', welcomeMessage: '需要查哪块技术文档？' },
        modelHint: '建议接入企业私有模型以保障代码安全',
    },
];
/**
 * 行业预置知识包 + 垂直模板（★ 差异化：县域/传统行业「零技术接入」）
 * 每个模板自带多份行业知识文档 + 行业合规触发词，诊所/律所/培训机构/工厂一键生成「知识库 + 合规客服」，
 * 直接命中 FastGPT/Dify 未做满的「传统行业零技术接入」空白带。
 */
exports.INDUSTRY_TEMPLATES = [
    {
        id: 'clinic',
        name: '诊所智能导诊',
        desc: '诊所/社区卫生站一键生成：门诊预约 + 就诊指引 + 急症合规转人工',
        icon: 'MedicineBox',
        category: 'industry',
        vertical: 'clinic',
        knowledge: [
            { title: '门诊时间与预约', content: '# 门诊时间\n周一至周日 8:00-17:30（午间 12:00-13:30 为值班）。\n预约方式：公众号「在线挂号」或拨打前台 0XX-XXXXXXX。\n初诊请携带身份证与医保卡。', tags: ['预约', '门诊'] },
            { title: '常见症状就诊指引', content: '# 就诊指引（非诊断，仅供参考）\n- 发热 ≥38.5℃ 伴咳嗽 → 呼吸内科 / 发热门诊\n- 腹痛、腹泻 → 内科\n- 皮疹、过敏 → 皮肤科\n- 儿童不适 → 儿科\n温馨提示：本助手不提供诊断，具体以医生面诊为准。', tags: ['指引', '症状'] },
            { title: '医保与费用', content: '# 医保与费用\n本院支持城镇职工医保、城乡居民医保实时结算。\n挂号费：普通门诊 10 元，专家门诊 30 元。\n自费项目会在就诊前明确告知。', tags: ['医保', '费用'] },
        ],
        bot: {
            name: '诊所智能导诊',
            systemPrompt: '你是诊所导诊助手，依据知识库提供门诊时间、预约方式、就诊指引与医保说明。严禁给出诊断结论或用药剂量，遇到急症相关表述立即引导急诊或拨打 120。',
            welcomeMessage: '您好，我是诊所导诊助手，可以帮您查询门诊时间、预约或就诊指引。',
        },
        escalationTriggers: ['急诊', '胸痛', '呼吸困难', '大出血', '昏迷', '中风', '抽搐', '120', '急救', '休克'],
        modelHint: '建议使用 DeepSeek / 混元 等国内模型',
    },
    {
        id: 'law',
        name: '律所咨询助手',
        desc: '律所/法务一键生成：业务领域介绍 + 委托流程 + 高风险事项转律师',
        icon: 'Bank',
        category: 'industry',
        vertical: 'law',
        knowledge: [
            { title: '业务领域', content: '# 业务领域\n婚姻家事、合同纠纷、劳动争议、刑事辩护、公司法务顾问、知识产权。\n如需具体法律意见，请预约执业律师面谈。', tags: ['业务', '领域'] },
            { title: '委托流程与材料', content: '# 委托流程\n1. 初次咨询（免费 15 分钟）\n2. 签订委托协议、出具风险告知书\n3. 提交证据材料（合同、聊天记录、票据等原件）\n4. 立案 / 谈判 / 应诉\n材料请通过事务所加密渠道提交，勿在聊天中泄露隐私。', tags: ['流程', '委托'] },
            { title: '收费说明', content: '# 收费说明\n按件收费或按标的额比例收费，具体以委托协议为准。\n初次咨询免费 15 分钟；风险评估与文书代写为有偿服务。', tags: ['收费'] },
        ],
        bot: {
            name: '律所咨询助手',
            systemPrompt: '你是律所咨询助手，依据知识库介绍业务领域、委托流程与收费。不做法律定性判断，不出具法律意见，遇到起诉/上诉/赔偿金额/诉讼时效/拘留/判刑等高风险表述立即转接执业律师。',
            welcomeMessage: '您好，我是律所咨询助手，可为您介绍业务领域与委托流程。',
        },
        escalationTriggers: ['起诉', '上诉', '赔偿金额', '诉讼时效', '拘留', '判刑', '仲裁申请', '风险代理', '立案'],
        modelHint: '建议使用 DeepSeek / GPT-4o / 百川（医疗法律专业优化）',
    },
    {
        id: 'training',
        name: '培训机构课程顾问',
        desc: '培训机构一键生成：课程体系 + 报名退费 + 投诉纠纷转人工顾问',
        icon: 'Read',
        category: 'industry',
        vertical: 'training',
        knowledge: [
            { title: '课程体系', content: '# 课程体系\n- 就业班（3 个月，含项目实战与内推）\n- 周末提升班（周六日，灵活学习）\n- 青少年素养课（编程 / 思维 / 口才）\n具体开班时间以官网「课程表」为准。', tags: ['课程'] },
            { title: '报名与退费', content: '# 报名与退费政策\n- 线上 / 前台均可报名，定金锁定名额\n- 开课前可全额退；开课 7 日内按比例退，扣除已消耗课时\n- 退费申请 5 个工作日内原路退回\n如对退费有异议，可联系课程顾问或投诉专线。', tags: ['报名', '退费'] },
            { title: '师资与成果', content: '# 师资与成果\n授课师资均具备行业经验与教学资质，官网公示简介。\n学员作品与就业喜报经授权后展示于「学员故事」专栏。', tags: ['师资'] },
        ],
        bot: {
            name: '课程顾问助手',
            systemPrompt: '你是培训机构课程顾问，依据知识库介绍课程、报名与退费政策。遇到投诉、退费纠纷、师资质疑等敏感表述立即转接人工顾问处理。',
            welcomeMessage: '您好，我是课程顾问，可为您介绍课程与报名优惠。',
        },
        escalationTriggers: ['投诉', '退费纠纷', '退款', '举报', '起诉', '师资虚假', '虚假宣传'],
        modelHint: '建议使用 DeepSeek / 混元',
    },
    {
        id: 'factory',
        name: '工厂设备问答助手',
        desc: '工厂/车间一键生成：设备操作手册 + 报修流程 + 安全事故转安全员',
        icon: 'Tool',
        category: 'industry',
        vertical: 'factory',
        knowledge: [
            { title: '设备操作手册摘要', content: '# 设备操作（以 XX 生产线为例）\n1. 开机前检查电源、气源、急停按钮复位\n2. 依次启动：总闸 → 主控 → 各工位\n3. 参数按《工艺卡》设置，禁止超范围\n4. 运行中发现异响 / 异味立即停机\n详细步骤见现场《设备作业指导书》。', tags: ['操作', '手册'] },
            { title: '安全与应急', content: '# 安全须知\n- 必须穿戴劳保用品（安全帽 / 工服 / 防护鞋）\n- 禁止违规跨越、伸手入危险区\n- 火灾按警铃、沿疏散通道撤离，勿乘电梯\n- 发生工伤立即停机、救人与上报班长', tags: ['安全', '应急'] },
            { title: '报修流程', content: '# 报修流程\n设备异常 → 按急停 → 拍照记录 → 联系机修班（分机 8021 / 企业微信「设备报修」）\n说明：设备编号、故障现象、发生时间，便于快速派单。', tags: ['报修'] },
        ],
        bot: {
            name: '工厂设备问答助手',
            systemPrompt: '你是工厂设备问答助手，依据手册回答操作、安全与报修流程。遇到安全事故、伤亡、起火、泄漏等危险表述立即引导停机并联系安全员/班长，不鼓励继续操作。',
            welcomeMessage: '您好，我是设备问答助手，可查询操作手册与报修流程。',
        },
        escalationTriggers: ['事故', '伤亡', '起火', '爆炸', '工伤', '急停', '泄漏', '触电', '中毒'],
        modelHint: '建议使用 DeepSeek / 混元',
    },
    // ★ 新增：教育垂直行业模板
    {
        id: 'education',
        name: 'K12 教育辅导助手',
        desc: '教培机构一键生成：课程体系 + 学情反馈 + 家长沟通 + 投诉转人工',
        icon: 'Read',
        category: 'industry',
        vertical: 'education',
        knowledge: [
            { title: '课程体系与班型', content: '# 课程体系\n- 小学：语文/数学/英语培优班（每班≤15人）\n- 初中：中考冲刺班（语文/数学/英语/物理/化学）\n- 高中：高考专题班（各科名校真题精讲）\n- 特色课：编程启蒙、奥数思维、新概念英语\n上课时间以「学期课程表」为准，支持试听 1 课时。', tags: ['课程', '班型'] },
            { title: '收费标准与退费', content: '# 收费标准\n- 大班课：80 元/课时（45分钟）\n- 小班课（≤8人）：150 元/课时\n- 1对1 辅导：300 元/课时\n\n退费政策：\n- 试听课后不满意可全额退\n- 开课 3 次内退 80%\n- 开课过 1/3 后不退费\n- 退费申请 7 个工作日原路退回', tags: ['收费', '退费'] },
            { title: '教学理念与方法', content: '# 教学理念\n- 分层教学：入学测评 → 匹配班型 → 动态调整\n- 讲练结合：40% 精讲 + 40% 实战 + 20% 答疑\n- 定期反馈：每月出具《学情报告》，含成绩趋势与薄弱项分析\n- 家校联动：每学期至少 2 次家长会，微信群每日学情通报', tags: ['理念', '方法'] },
        ],
        bot: {
            name: 'K12 教育助手',
            systemPrompt: '你是教育培训机构智能助手，依据知识库介绍课程体系、收费标准与教学理念。不做出成绩承诺或升学保证，遇到退费纠纷、投诉、教学质量质疑等敏感话题立即引导联系人工教务老师。',
            welcomeMessage: '您好，我是 XX 教育助手，可以帮您了解课程、班型和收费政策。',
        },
        escalationTriggers: ['退费', '投诉', '差评', '教学质量', '虚假宣传', '成绩承诺', '包过'],
        modelHint: '建议使用 DeepSeek / 通义千问 / 百川',
    },
    // ★ 新增：电商垂直行业模板
    {
        id: 'ecommerce',
        name: '电商智能客服',
        desc: '电商卖家一键生成：退换货政策 + 物流查询 + 商品FAQ + 投诉差评转人工',
        icon: 'Shopping',
        category: 'industry',
        vertical: 'ecommerce',
        knowledge: [
            { title: '退换货政策', content: '# 退换货政策\n- 7天无理由退货（签收日起算，商品完好不影响二次销售）\n- 质量问题 15 天内包退换，运费由本店承担\n- 换货流程：在线申请 → 寄回商品 → 仓库验收 → 发出新货（3-5 个工作日）\n- 退款时效：验收通过后 1-3 个工作日原路退回\n- 以下情况不支持退货：定制商品、生鲜食品、已拆封的数码产品', tags: ['退换货', '政策'] },
            { title: '物流与配送', content: '# 物流配送\n- 默认发顺丰/中通，16:00 前付款当天发货\n- 配送时效：江浙沪 1-2 天，其他地区 2-4 天，偏远地区 5-7 天\n- 物流查询：在「我的订单」点击运单号实时追踪\n- 如超 72 小时无物流更新，请联系客服核查', tags: ['物流', '配送'] },
            { title: '常见商品 FAQ', content: '# 商品 FAQ\n- 尺码建议：详情页有尺码表，建议按实际测量选择\n- 材质说明：商品标题和详情页标注面料成分\n- 色差说明：因显示器差异，实际颜色可能与图片有轻微偏差\n- 库存咨询：页面显示有货即可拍，缺货会标注「暂时缺货」', tags: ['FAQ', '商品'] },
        ],
        bot: {
            name: '电商智能客服',
            systemPrompt: '你是电商智能客服助手，依据知识库回答退换货、物流与商品 FAQ。不做虚假承诺（如"保证明天到"），遇到投诉、差评、工商举报、假货质疑等敏感话题立即引导转人工客服。',
            welcomeMessage: '您好，我是店铺智能客服，可以帮您查询订单、退换货政策和物流信息。',
        },
        escalationTriggers: ['投诉', '差评', '举报', '假货', '工商', '12315', '欺诈', '维权', '媒体曝光', '律师函'],
        modelHint: '建议使用 DeepSeek / 通义千问',
    },
];
/** 合并通用 + 行业模板，作为完整模板目录 */
exports.ALL_QUICKSTART_TEMPLATES = [
    ...exports.QUICKSTART_TEMPLATES,
    ...exports.INDUSTRY_TEMPLATES,
];
/** 模板目录（支持 ?category=industry|generic 筛选，命中行业零技术接入垂直包） */
router.get('/templates', (req, res) => {
    const { category } = req.query;
    const list = category
        ? exports.ALL_QUICKSTART_TEMPLATES.filter((t) => t.category === category)
        : exports.ALL_QUICKSTART_TEMPLATES;
    res.json({
        success: true,
        data: list.map((t) => ({ id: t.id, name: t.name, desc: t.desc, icon: t.icon, category: t.category, vertical: t.vertical, modelHint: t.modelHint })),
    });
});
/** 应用模板：为当前用户创建知识文档 + 客服机器人 */
router.post('/apply', auth_1.requireAuth, async (req, res) => {
    try {
        const { templateId, teamId } = req.body;
        const tpl = exports.ALL_QUICKSTART_TEMPLATES.find((t) => t.id === templateId);
        if (!tpl)
            return res.status(404).json({ success: false, error: '模板不存在' });
        // 归属团队时校验：必须是该团队成员（>= member）
        let validatedTeamId;
        if (teamId) {
            const team = await Team_1.Team.findById(teamId).lean();
            const member = team?.members?.find((m) => m.userId === req.user.id);
            if (!member || !(0, resourceAccess_1.canAccessResource)({ userId: req.user.id, memberRole: member.role, minRole: 'member' })) {
                return res.status(403).json({ success: false, error: '你不是该团队成员，无法在该团队下创建' });
            }
            validatedTeamId = teamId;
        }
        const docs = await KnowledgeDocument_1.KnowledgeDocument.insertMany(tpl.knowledge.map((k) => ({
            title: k.title,
            content: k.content,
            tags: k.tags,
            author: req.user.id,
            teamId: validatedTeamId,
        })));
        const cs = await CustomerService_1.CustomerService.create({
            name: tpl.bot.name,
            knowledgeBaseIds: docs.map((d) => d._id.toString()),
            systemPrompt: tpl.bot.systemPrompt,
            welcomeMessage: tpl.bot.welcomeMessage,
            provider: 'openai',
            csModel: 'gpt-4o',
            ownerId: req.user.id,
            teamId: validatedTeamId,
            embedCode: crypto_1.default.randomBytes(12).toString('hex'),
            // 行业模板预置合规触发词：命中即转人工（诊所急诊 / 律所起诉 / 工厂起火等）
            escalationTriggers: tpl.escalationTriggers || [],
        });
        res.json({
            success: true,
            data: { knowledgeIds: docs.map((d) => d._id), customerServiceId: cs._id },
        });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
exports.default = router;
//# sourceMappingURL=quickstart.js.map