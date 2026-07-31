import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_MODEL = 'agnes25/agnes-2.5-flash';
const failures = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function requireText(rel, expected) {
  const content = read(rel);
  if (!content.includes(expected)) failures.push(`${rel} 缺少：${expected}`);
}

function forbidText(rel, forbidden) {
  const content = read(rel);
  if (content.includes(forbidden)) failures.push(`${rel} 仍包含旧默认：${forbidden}`);
}

const required = [
  ['client/src/config/default-ai-model.ts', `DEFAULT_TEXT_AI_MODEL = '${DEFAULT_MODEL}'`],
  ['client/src/stores/chat.ts', 'model: DEFAULT_TEXT_AI_MODEL'],
  ['client/src/pages/AiChat.tsx', 'useChatStore'],
  ['client/src/pages/AibakChat.tsx', 'model: DEFAULT_TEXT_AI_MODEL'],
  ['client/src/components/HomeChatPanel.tsx', 'value: DEFAULT_TEXT_AI_MODEL'],
  ['client/src/components/FreeExperienceFab.tsx', 'useState<string>(DEFAULT_TEXT_AI_MODEL)'],
  ['client/src/components/CustomerServiceFab.tsx', 'useState<string>(DEFAULT_TEXT_AI_MODEL)'],
  ['client/src/pages/CustomerServicePage.tsx', 'model: DEFAULT_TEXT_AI_MODEL'],
  ['client/src/pages/KnowledgeAiInterpret.tsx', 'model: DEFAULT_TEXT_AI_MODEL'],
  ['server/src/config/default-ai-model.ts', "DEFAULT_TEXT_AI_MODEL_ID = 'agnes-2.5-flash'"],
  ['server/src/gateway/ai-gateway.service.ts', 'const effectiveModel = req.model || DEFAULT_TEXT_AI_MODEL'],
  ['server/src/services/ai-agent.ts', 'const defaultProvider = provider || DEFAULT_TEXT_AI_PROVIDER'],
  ['server/src/services/ai-text.service.ts', 'model: opts.model || getPreferredAgnesTextModel()'],
  ['server/src/models/CustomerService.ts', 'default: DEFAULT_TEXT_AI_MODEL_ID'],
  ['server/src/models/Workflow.ts', `model: '${DEFAULT_MODEL}'`],
  ['server/src/routes/aibak-chat.ts', 'String(model || getPreferredAgnesTextModel())'],
  ['server/src/routes/learning-path.ts', 'model: getPreferredAgnesTextModel()'],
  ['server/src/services/plan-generator.service.ts', 'getPreferredAgnesTextModel().split'],
  ['server/src/services/translation.service.ts', 'getPreferredAgnesTextModel().split'],
];
for (const [rel, expected] of required) requireText(rel, expected);

const forbidden = [
  ['client/src/pages/AibakChat.tsx', "model: 'CloudBase-AI'"],
  ['server/src/services/ai-agent.ts', "|| 'gpt-4.1'"],
  ['server/src/models/CustomerService.ts', "default: 'gpt-4o'"],
  ['server/src/routes/quickstart.ts', "csModel: 'gpt-4o'"],
  ['server/src/services/translation.service.ts', "|| 'gpt-4o'"],
  ['server/src/services/plan-generator.service.ts', "|| 'gpt-4o'"],
];
for (const [rel, value] of forbidden) forbidText(rel, value);

if (failures.length) {
  console.error('DEFAULT_AI_MODEL_AUDIT_FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`DEFAULT_AI_MODEL_OK ${DEFAULT_MODEL} (${required.length} 个关键入口)`);
