import type { Skill } from '../types';
import { route } from '../../gateway/ai-gateway.service';

/**
 * 技能编写（skill-authoring）
 * ----------------------------------------------------------------
 * 对应 superpowers 的 `writing-skills` 元技能：把有效经验沉淀为新 skill。
 * 区别：superpowers 在编码代理内写 SKILL.md；本技能在「平台运行时」内，
 * 调用统一 AI 网关（route）生成一份可直接落地的 Skill 定义骨架
 * （manifest + invoke 骨架 TS 代码），供开发者复制到 skills/defs/ 并注册。
 *
 * 这是 superpowers 方法论在本项目「技能协议层」上的工程化映射，也是
 * 开放 API 市场「用户可自助沉淀技能」的前置能力。
 */
export const skillAuthoringSkill: Skill = {
  manifest: {
    id: 'skill-authoring',
    name: '技能编写',
    description:
      '用 AI 网关生成新业务技能的 manifest + invoke 骨架，沉淀为可上架的 Skill 定义（superpowers writing-skills 等价物）。',
    division: 'engineering',
    color: '#2f54eb',
    coreMission: '把一句话需求，转化为可注册、可上架的 Skill 定义骨架。',
    criticalRules: [
      '必须走统一 AI 网关（route），不直接调用厂商 SDK',
      '产出的 manifest 必须含 division / quotaResource / marketable 等关键字段',
      'invoke 骨架必须调用对应 service；生产失败必须显式返回错误，不得生成虚假结果',
    ],
    successMetrics: ['产出可编译的 Skill 骨架', '字段齐全可经 registry 注册'],
    quotaResource: 'ai_chat',
    minRole: 'member',
    requireAuth: true,
    marketable: true,
    userStory: '作为平台维护者，我希望描述一个业务目标就能得到技能骨架，从而快速扩充可上架能力。',
    acceptanceCriteria: [
      '输入 goal + division 后返回合法 manifest',
      '返回可直接粘贴的 invoke 骨架代码',
      '无可用真实 provider 时明确失败并提示配置真实厂商',
    ],
    qualityCriteria: ['生产环境不返回 Mock 结果', '生成内容不泄露密钥'],
    references: ['obra/superpowers#writing-skills', 'agency-agents skill protocol'],
  },
  async invoke(ctx) {
    const { goal, division = 'productivity', name, description } = ctx.input || {};
    if (!goal) return { ok: false, error: 'skill-authoring 需要 goal（要沉淀的能力描述）' };

    const system = `你是 AI Agent Platform 的技能架构师。基于 agency-agents 技能协议（Skill = manifest + invoke），
输出一个可被后端 skills/defs/*.skill.ts 直接注册的技能定义骨架。
manifest 必含：id(kebab-case)、name、description、division、color、coreMission、criticalRules[]、successMetrics[]、quotaResource、minRole、requireAuth、marketable。
invoke 必须调用对应 service，生产失败时显式返回错误且不得伪造结果。只输出 JSON：{ manifest: {...}, invokeSkeleton: "ts 代码字符串" }。`;

    let draft: any = null;
    try {
      const r = await route({
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: `目标：${goal}\n分类：${division}\n${name ? `期望名称：${name}\n` : ''}${
              description ? `补充说明：${description}\n` : ''
            }请生成技能骨架。`,
          },
        ],
        maxTokens: 1400,
        temperature: 0.3,
      });
      // 尝试从回复中解析 JSON（容错：截取首个 { 到末个 }）
      const raw = r.reply;
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      draft = start >= 0 && end > start ? JSON.parse(raw.slice(start, end + 1)) : { raw };
    } catch (e: any) {
      return {
        ok: false,
        error: `技能骨架生成失败：${e.message}（请确认已配置真实厂商 Key）`,
      };
    }

    // 组装可直接粘贴的 TS 骨架文件（供前端「一键复制」）
    let tsFile = '';
    if (draft && draft.manifest && draft.manifest.id) {
      const id = String(draft.manifest.id).replace(/[^a-zA-Z0-9-]/g, '');
      const varName = `${id.replace(/(^\w|-\w)/g, (m) => m.replace('-', '').toUpperCase())}Skill`;
      const manifestJson = JSON.stringify(draft.manifest, null, 2);
      const skeleton =
        typeof draft.invokeSkeleton === 'string' && draft.invokeSkeleton.trim()
          ? draft.invokeSkeleton
          : '// 技能已生成骨架。请在 invoke 中调用真实 service 实现业务逻辑。\n// 若依赖未配置，应抛出明确错误，禁止在生产环境使用 Mock 兜底。';
      tsFile = `import type { Skill } from '../types';\n\n// 由 skill-authoring 生成（superpowers writing-skills 等价物）\nexport const ${varName}: Skill = {\n  manifest: ${manifestJson},\n  async invoke(ctx) {\n    ${skeleton}\n  },\n};\n`;
    } else {
      return {
        ok: false,
        status: 502,
        code: 'SKILL_AUTHORING_INVALID_RESPONSE',
        error: 'AI Provider 返回的技能骨架缺少有效 manifest.id，已拒绝生成不可执行的占位技能',
      };
    }

    return {
      ok: true,
      data: {
        howToRegister:
          '将下方 TS 骨架写入 server/src/skills/defs/<id>.skill.ts，并在 registry.ts 中 import + 加入 SKILLS 数组，最后补充 skills.test.ts 断言（或运行 check:superpowers）。',
        tsFile,
        draft,
      },
    };
  },
};
