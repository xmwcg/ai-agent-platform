/**
 * 购买意向感知 + AI 智能促单引擎
 * 
 * 三层设计：
 * 1. 感知层：记录用户行为（点击购买、对比套餐、停留时长、退出意图）
 * 2. AI引擎层：基于用户画像调用AI生成个性化促单话术
 * 3. 展示层：前端在合适时机展示AI建议（停留久、要离开、二次访问）
 */
import { Router, Response } from 'express';
import { AuthRequest, optionalAuth } from '../middleware/auth';
import { User } from '../models/User';
import { Order } from '../models/Order';
import { sendError } from '../lib/http-error';
import { logger } from '../lib/logger';
import { callCloudbaseChat, AIBAK_MODELS } from '../services/cloudbase-ai.service';

const router = Router();

// AI 促单系统提示词
const SALES_COACH_PROMPT = `你是 AIbak（aibak.site）的智能销售助手。根据用户画像和行为生成个性化促单建议。

## 原则
1. 真诚不夸大 2. 解决顾虑 3. 突出价值 4. 降低门槛 5. 自然亲切

## 输出 JSON 数组（最多3条），每条 { "type":"value|objection|urgency|social_proof|guide", "title":"标题", "content":"内容", "action":{"text":"按钮","path":"路径"} }
如果用户行为不足2次交互，返回 []。`;

type IntentAction = 'click_pricing' | 'compare' | 'view_demo' | 'stay_long' | 'exit_intent' | 'return_visit' | 'view_features';

// 内存意向存储（生产可改为 MongoDB）
const intentStore = new Map<string, any[]>();

// 记录购买意向
router.post('/purchase-intent', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { productId, action, productName, pageStaySeconds, comparedPlans } = req.body;
    if (!productId || !action) return res.status(400).json({ success: false, error: '缺少参数' });

    const uid = req.user?.id || req.ip || 'anonymous';
    const key = `${uid}:${productId}`;
    if (!intentStore.has(key)) intentStore.set(key, []);
    const events = intentStore.get(key)!;
    events.push({ productId, productName, action, pageStaySeconds, comparedPlans, time: new Date() });
    if (events.length > 30) events.shift(); // 限制

    logger.info('marketing', `Intent: user=${uid} product=${productId} action=${action}`);
    res.json({ success: true });
  } catch (err) { sendError(res, err); }
});

// AI 生成促单建议
router.post('/generate-tips', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { productId, productName } = req.body;
    const uid = req.user?.id || req.ip || 'anonymous';
    const key = `${uid}:${productId}`;
    const events = intentStore.get(key) || [];

    // 行为太少不触发AI
    if (events.length < 2) {
      return res.json({ success: true, data: { tips: [], userProfile: { isLoggedIn: !!req.user } } });
    }

    // 用户画像
    let profile: any = { isLoggedIn: !!req.user };
    if (req.user?.id) {
      const user = await User.findById(req.user.id).select('plan credits createdAt').lean();
      if (user) {
        profile.plan = user.plan;
        profile.credits = user.credits;
        profile.memberSince = user.createdAt;
        const cnt = await Order.countDocuments({ userId: req.user.id, paymentStatus: 'paid' });
        profile.previousPurchases = cnt;
      }
    }

    const actions = [...new Set(events.map((e: any) => e.action))].join(', ');
    const staySec = events.reduce((s: number, e: any) => s + (e.pageStaySeconds || 0), 0);
    const compared = [...new Set(events.flatMap((e: any) => e.comparedPlans || []))];

    const prompt = `用户浏览「${productName || productId}」定价页。
画像：${profile.isLoggedIn ? `已登录，套餐:${profile.plan}，积分:${profile.credits}` : '游客'}${profile.previousPurchases > 0 ? `，曾购买${profile.previousPurchases}次` : '，首次访问'}
行为：${actions}，停留${staySec}秒${compared.length ? '，对比:' + compared.join(',') : ''}，${events.length}次交互。
请生成促单建议。`;

    // 调用 AI
    const aiRes: any = await callCloudbaseChat({
      model: AIBAK_MODELS.FAST || AIBAK_MODELS.DEFAULT,
      messages: [
        { role: 'system', content: SALES_COACH_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    });

    let tips: any[] = [];
    try {
      const text = typeof aiRes === 'string' ? aiRes : (aiRes?.content || aiRes?.text || '');
      const m = text.match(/\[[\s\S]*\]/);
      if (m) tips = JSON.parse(m[0]);
    } catch { /* AI返回非JSON，用下面的兜底 */ }

    if (!tips.length) {
      tips = [
        { type: 'guide', title: '💡 需要帮助？', content: '对套餐选择有疑问？联系客服获取一对一建议。', action: { text: '联系客服', path: '/contact' } },
      ];
    }

    res.json({
      success: true,
      data: { tips: tips.slice(0, 3), userProfile: profile },
    });
  } catch (err) {
    // AI失败时兜底
    res.json({
      success: true,
      data: {
        tips: [
          { type: 'guide', title: '💡 需要帮助？', content: '如有疑问可以联系在线客服。', action: { text: '联系客服', path: '/contact' } },
          { type: 'value', title: '🛡️ 放心购买', content: '支持7天无理由退款。', action: { text: '退款政策', path: '/refund-policy' } },
        ],
        userProfile: { isLoggedIn: !!req.user },
        fallback: true,
      },
    });
  }
});

export default router;
