"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const logger_1 = require("../lib/logger");
const http_error_1 = require("../lib/http-error");
const RelayChannel_1 = require("../models/RelayChannel");
const RelayToken_1 = require("../models/RelayToken");
const auth_1 = require("../middleware/auth");
const crypto_1 = require("../lib/crypto");
const relay_service_1 = require("../services/relay.service");
const router = (0, express_1.Router)();
// ───────────── 中转站状态 ─────────────
router.get('/', (req, res) => {
    res.json({
        ok: true,
        name: 'AIbak 中转站',
        description: '大模型 API 聚合中转服务',
        version: '1.0.0',
        endpoints: {
            chat: '/api/relay/v1/chat/completions',
            models: '/api/relay/v1/models',
            admin: '/api/relay/admin'
        }
    });
});
function bearer(req) {
    const h = req.headers.authorization;
    if (!h || !h.startsWith('Bearer '))
        return null;
    return h.slice(7);
}
// ───────────── 公开：OpenAI 兼容接口（金网通调用） ─────────────
router.post('/v1/chat/completions', async (req, res) => {
    try {
        const data = await (0, relay_service_1.proxyChatCompletions)(bearer(req) || '', req.body);
        res.json(data);
    }
    catch (e) {
        if (e instanceof relay_service_1.RelayError)
            return res.status(e.status).json({ error: e.message });
        logger_1.logger.error('relay', 'unexpected error', { error: e?.message || 'internal' });
        (0, http_error_1.sendError)(res, e);
        return;
    }
});
router.get('/v1/models', async (req, res) => {
    try {
        const models = await (0, relay_service_1.listModels)(bearer(req) || '');
        res.json({ object: 'list', data: models.map((id) => ({ id, object: 'model' })) });
    }
    catch (e) {
        if (e instanceof relay_service_1.RelayError)
            return res.status(e.status).json({ error: e.message });
        logger_1.logger.error('relay', 'unexpected error', { error: e?.message || 'internal' });
        (0, http_error_1.sendError)(res, e);
        return;
    }
});
// ───────────── 管理后台（需管理员） ─────────────
// 页面本身公开可访问（仅 HTML 表单，不含敏感数据）；真正的增删改 API 仍由 requireAdmin 保护。
router.get('/admin', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(ADMIN_HTML);
});
// 中转站独立管理员登录（公开）：首次使用任意密码即初始化为管理员密码
router.post('/admin/login', async (req, res) => {
    const pwd = (req.body || {}).password;
    if (!pwd || typeof pwd !== 'string' || pwd.length < 6) {
        return res.status(400).json({ error: '密码至少 6 位' });
    }
    try {
        const ok = await (0, relay_service_1.verifyAdminLogin)(pwd);
        if (!ok)
            return res.status(403).json({ error: '密码错误' });
        const token = (0, auth_1.generateAccessToken)({
            id: 'relay-admin',
            email: 'relay@aibak.local',
            role: 'admin',
        });
        res.json({ success: true, token });
    }
    catch (e) {
        res.status(500).json({ error: e?.message || '登录失败' });
    }
});
router.get('/admin/channels', auth_1.requireAdmin, async (_req, res) => {
    const list = (await RelayChannel_1.RelayChannel.find().sort({ createdAt: -1 }).lean());
    res.json({ success: true, data: list.map((c) => ({ ...c, apiKey: c.apiKey ? '****' : '' })) });
});
router.post('/admin/channels', auth_1.requireAdmin, async (req, res) => {
    try {
        const { name, provider, baseURL, apiKey, models, authMode, weight } = (req.body || {});
        if (!name || !baseURL || !apiKey) {
            return res.status(400).json({ success: false, error: '缺少 name / baseURL / apiKey' });
        }
        const ch = await RelayChannel_1.RelayChannel.create({
            name,
            provider: provider || 'custom',
            baseURL,
            apiKey: (0, crypto_1.encryptSecret)(apiKey),
            models: Array.isArray(models)
                ? models
                : String(models || '')
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
            authMode: authMode === 'x-api-key' ? 'x-api-key' : 'bearer',
            weight: Number(weight) || 1,
        });
        const obj = ch.toObject();
        res.json({ success: true, data: { ...obj, apiKey: '****' } });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e?.message });
    }
});
router.delete('/admin/channels/:id', auth_1.requireAdmin, async (req, res) => {
    await RelayChannel_1.RelayChannel.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});
router.get('/admin/tokens', auth_1.requireAdmin, async (_req, res) => {
    const list = (await RelayToken_1.RelayToken.find().sort({ createdAt: -1 }).lean());
    res.json({ success: true, data: list.map((t) => ({ ...t, tokenHash: t.tokenHash.slice(0, 8) + '…' })) });
});
router.post('/admin/tokens', auth_1.requireAdmin, async (req, res) => {
    try {
        const { label, licenseId, plan, quotaTotal, expireAt } = (req.body || {});
        if (!label || !licenseId) {
            return res.status(400).json({ success: false, error: '缺少 label / licenseId' });
        }
        const plain = (0, relay_service_1.generateToken)();
        const rt = await RelayToken_1.RelayToken.create({
            tokenHash: (0, relay_service_1.hashToken)(plain),
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
    }
    catch (e) {
        res.status(500).json({ success: false, error: e?.message });
    }
});
router.post('/admin/tokens/:id/revoke', auth_1.requireAdmin, async (req, res) => {
    await RelayToken_1.RelayToken.findByIdAndUpdate(req.params.id, { status: 'disabled' });
    res.json({ success: true });
});
router.get('/admin/usage', auth_1.requireAdmin, async (_req, res) => {
    const rows = await RelayToken_1.RelayUsage.aggregate([
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
<div style="border:1px solid #334155;padding:12px;margin-bottom:16px;border-radius:8px">
  <b>中转站管理员密码</b>（首次输入即设置为管理员密码）
  <div class="row"><input id="pwd" type="password" placeholder="管理员密码（至少6位）"></div>
  <button onclick="login()">登录</button>
  <div id="login_msg" style="margin-top:6px"></div>
</div>
<div><label>管理员 JWT（登录后自动填入，也可手动粘贴）：</label><input id="tk" placeholder="Bearer 之后的 JWT"></div>

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
async function login(){
  var pwd=document.getElementById('pwd').value;
  if(!pwd){document.getElementById('login_msg').textContent='请输入密码';return;}
  var r=await fetch(API+'/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pwd})});
  var j=await r.json();
  if(j.success){document.getElementById('tk').value=j.token;document.getElementById('login_msg').textContent='登录成功，JWT 已自动填入';}
  else{document.getElementById('login_msg').textContent='登录失败：'+(j.error||'未知错误');}
}
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
exports.default = router;
//# sourceMappingURL=relay.js.map