import { Router, Request, Response } from 'express';
import { RelayChannel } from '../models/RelayChannel';
import { RelayToken, RelayUsage } from '../models/RelayToken';
import { requireAdmin } from '../middleware/auth';
import { encryptSecret } from '../lib/crypto';
import {
  generateToken,
  hashToken,
  proxyChatCompletions,
  listModels,
  RelayError,
} from '../services/relay.service';

const router = Router();

function bearer(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  return h.slice(7);
}

// ───────────── 公开：OpenAI 兼容接口（金网通调用） ─────────────
router.post('/v1/chat/completions', async (req: Request, res: Response) => {
  try {
    const data = await proxyChatCompletions(bearer(req) || '', req.body);
    res.json(data);
  } catch (e: any) {
    if (e instanceof RelayError) return res.status(e.status).json({ error: e.message });
    return res.status(500).json({ error: e?.message || 'internal' });
  }
});

router.get('/v1/models', async (req: Request, res: Response) => {
  try {
    const models = await listModels(bearer(req) || '');
    res.json({ object: 'list', data: models.map((id) => ({ id, object: 'model' })) });
  } catch (e: any) {
    if (e instanceof RelayError) return res.status(e.status).json({ error: e.message });
    return res.status(500).json({ error: e?.message || 'internal' });
  }
});

// ───────────── 管理后台（需管理员） ─────────────
router.get('/admin', requireAdmin, (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(ADMIN_HTML);
});

router.get('/admin/channels', requireAdmin, async (_req: Request, res: Response) => {
  const list = (await RelayChannel.find().sort({ createdAt: -1 }).lean()) as any[];
  res.json({ success: true, data: list.map((c) => ({ ...c, apiKey: c.apiKey ? '****' : '' })) });
});

router.post('/admin/channels', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, provider, baseURL, apiKey, models, authMode, weight } = (req.body || {}) as any;
    if (!name || !baseURL || !apiKey) {
      return res.status(400).json({ success: false, error: '缺少 name / baseURL / apiKey' });
    }
    const ch = await RelayChannel.create({
      name,
      provider: provider || 'custom',
      baseURL,
      apiKey: encryptSecret(apiKey),
      models: Array.isArray(models)
        ? models
        : String(models || '')
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean),
      authMode: authMode === 'x-api-key' ? 'x-api-key' : 'bearer',
      weight: Number(weight) || 1,
    });
    const obj = ch.toObject() as any;
    res.json({ success: true, data: { ...obj, apiKey: '****' } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message });
  }
});

router.delete('/admin/channels/:id', requireAdmin, async (req: Request, res: Response) => {
  await RelayChannel.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

router.get('/admin/tokens', requireAdmin, async (_req: Request, res: Response) => {
  const list = (await RelayToken.find().sort({ createdAt: -1 }).lean()) as any[];
  res.json({ success: true, data: list.map((t) => ({ ...t, tokenHash: t.tokenHash.slice(0, 8) + '…' })) });
});

router.post('/admin/tokens', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { label, licenseId, plan, quotaTotal, expireAt } = (req.body || {}) as any;
    if (!label || !licenseId) {
      return res.status(400).json({ success: false, error: '缺少 label / licenseId' });
    }
    const plain = generateToken();
    const rt = await RelayToken.create({
      tokenHash: hashToken(plain),
      label,
      licenseId,
      plan: plan || 'monthly',
      quotaTotal: Number(quotaTotal) || 0,
      expireAt: expireAt ? new Date(expireAt) : undefined,
    });
    res.json({
      success: true,
      data: { id: String(rt._id), label, licenseId, plan, quotaTotal: rt.quotaTotal, token: plain },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message });
  }
});

router.post('/admin/tokens/:id/revoke', requireAdmin, async (req: Request, res: Response) => {
  await RelayToken.findByIdAndUpdate(req.params.id, { status: 'disabled' });
  res.json({ success: true });
});

router.get('/admin/usage', requireAdmin, async (_req: Request, res: Response) => {
  const rows = await RelayUsage.aggregate([
    { $group: { _id: '$licenseId', used: { $sum: '$used' }, calls: { $sum: 1 } } },
    { $sort: { used: -1 } },
  ]);
  res.json({ success: true, data: rows });
});

const ADMIN_HTML = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>中转站管理</title>
<style> body{font-family:sans-serif;max-width:900px;margin:20px auto;padding:0 16px} input,button,select{margin:4px 0;padding:6px;width:100%;box-sizing:border-box} h2{margin-top:24px} .row{display:flex;gap:8px} .row>*{flex:1} pre{background:#0b1220;color:#e2e8f0;padding:8px;overflow:auto} </style>
</head>
<body>
<h1>中转站管理后台</h1>
<div><label>管理员 JWT（从平台登录后获取）：</label><input id="tk" placeholder="粘贴 Bearer 之后的 JWT"></div>

<h2>上游渠道（接各家模型）</h2>
<div class="row"><input id="c_name" placeholder="名称"><input id="c_provider" placeholder="provider(如 deepseek)"></div>
<div class="row"><input id="c_base" placeholder="baseURL(如 https://api.deepseek.com/v1)"><input id="c_key" placeholder="apiKey"></div>
<div class="row"><input id="c_models" placeholder="模型,逗号分隔(可空)"><select id="c_auth"><option value="bearer">Bearer</option><option value="x-api-key">x-api-key</option></select></div>
<button onclick="addChannel()">添加渠道</button>
<pre id="c_out"></pre>
<button onclick="loadChannels()">刷新渠道列表</button>
<pre id="c_list"></pre>

<h2>客户令牌（发给金网通）</h2>
<div class="row"><input id="t_label" placeholder="备注(如 客户A)"><input id="t_license" placeholder="LicenseId(会员卡号)"></div>
<div class="row"><input id="t_quota" placeholder="配额token数(0=不限)"><input id="t_expire" placeholder="过期时间(可空,如 2026-12-31)"></div>
<button onclick="issueToken()">发放令牌</button>
<pre id="t_out"></pre>
<button onclick="loadTokens()">刷新令牌列表</button>
<pre id="t_list"></pre>

<h2>用量统计</h2>
<button onclick="loadUsage()">查看用量</button>
<pre id="u_out"></pre>

<script>
const API='/api/relay';
function auth(){return {Authorization:'Bearer '+document.getElementById('tk').value}}
async function addChannel(){
  var b={name:c_name.value,provider:c_provider.value,baseURL:c_base.value,apiKey:c_key.value,models:c_models.value,authMode:c_auth.value};
  var r=await fetch(API+'/admin/channels',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},auth()),body:JSON.stringify(b)});
  c_out.textContent=JSON.stringify(await r.json(),null,2);loadChannels();
}
async function loadChannels(){var r=await fetch(API+'/admin/channels',{headers:auth()});c_list.textContent=JSON.stringify(await r.json(),null,2);}
async function issueToken(){
  var b={label:t_label.value,licenseId:t_license.value,quotaTotal:Number(t_quota.value||0),expireAt:t_expire.value||undefined};
  var r=await fetch(API+'/admin/tokens',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},auth()),body:JSON.stringify(b)});
  var j=await r.json();t_out.textContent=JSON.stringify(j,null,2);
  if(j.success) alert('令牌已生成（仅显示一次）：'+j.data.token);
}
async function loadTokens(){var r=await fetch(API+'/admin/tokens',{headers:auth()});t_list.textContent=JSON.stringify(await r.json(),null,2);}
async function loadUsage(){var r=await fetch(API+'/admin/usage',{headers:auth()});u_out.textContent=JSON.stringify(await r.json(),null,2);}
</script>
</body>
</html>`;

export default router;
