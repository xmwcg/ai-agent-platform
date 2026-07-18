// 金网通购买页后端（纯 Node，零依赖）
// 职责：创建订单 -> 微信/支付宝下单 -> 回调验签 -> 付款后自动签发 license.json -> 提供下载
// 未配置支付凭据时自动进入"手动模式"：客户联系客服付款，厂商用 /api/admin/issue 发货。
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const wechat = require('./pay-wechat');
const alipay = require('./pay-alipay');
const { issueLicense, saveLicense } = require('./license-issuer');

const logger = { info: (...a) => console.log('[jwt]', ...a), warn: (...a) => console.warn('[jwt]', ...a), error: (...a) => console.error('[jwt]', ...a) };

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const ISSUED_DIR = path.join(DATA_DIR, 'issued');
const PUBLIC_DIR = path.join(__dirname, 'public');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'change-me-admin-token';

// 版本与价格（单位：分）。页面通过 /api/editions 拉取，保证一致。
// 2026-07 重新定价：与 ai-agent-platform 私域变现策略对齐，「大厂 1/10」破局价。
//   pro       ¥299/永久  (原 ¥199 → 对标竞品 10%~20%，小本快变现)
//   enterprise¥599/永久
//   team      ¥999/永久
const EDITIONS = {
  pro:       { key: 'pro',       name: '专业版',   price: 29900,  seats: 10,  days: 365, desc: '单公司 ≤10 台，全功能互联+集中管控' },
  enterprise:{ key: 'enterprise',name: '旗舰版',   price: 59900,  seats: 50,  days: 365, desc: '单公司 ≤50 台，含上网管控+网络体检+优先支持' },
  team:      { key: 'team',      name: '团队版',   price: 99900,  seats: 999, days: 365, desc: '不限席位，多分支机构，专属技术支持' },
};

// ai-agent-platform 私有化授权版本 → 金网通 edition 映射（命名对齐，避免签发错版）
const PLATFORM_EDITION_MAP = {
  'ent-standard': 'pro',
  'ent-pro': 'enterprise',
  'ent-ultimate': 'team',
};

function loadOrders() {
  if (!fs.existsSync(ORDERS_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8')); } catch { return {}; }
}
function saveOrders(o) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(o, null, 2), 'utf8');
}
function genOrderNo() {
  return 'JW' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function send(res, code, obj, headers) {
  res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers || {}));
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => resolve(d));
  });
}
function parseBody(req, raw) {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('application/json')) { try { return JSON.parse(raw); } catch { return {}; } }
  if (ct.includes('application/x-www-form-urlencoded')) { return Object.fromEntries(new URLSearchParams(raw)); }
  return {};
}

async function handleOrder(orders, body) {
  const ed = EDITIONS[body.edition];
  if (!ed) return { code: 400, data: { error: '未知版本' } };
  if (!body.fingerprint || !/^[0-9A-Fa-f]{8,64}$/.test(body.fingerprint)) return { code: 400, data: { error: '请提供有效的机器指纹' } };
  const channel = body.channel === 'alipay' ? 'alipay' : 'wechat';
  const orderNo = genOrderNo();
  const order = { orderNo, edition: ed.key, fingerprint: body.fingerprint, channel, amount: ed.price, status: 'CREATED', createdAt: new Date().toISOString() };

  if (channel === 'wechat' && wechat.isConfigured()) {
    const r = await wechat.createOrder({ outTradeNo: orderNo, description: `金网通${ed.name}`, total: ed.price });
    order.payUrl = r.code_url; order.qr = r.code_url;
  } else if (channel === 'alipay' && alipay.isConfigured()) {
    const r = await alipay.createOrder({ outTradeNo: orderNo, subject: `金网通${ed.name}`, total: ed.price });
    order.payUrl = r.qr_code; order.qr = r.qr_code;
  } else {
    order.manual = true; // 未配置支付凭据，走手动客服发货
  }
  orders[orderNo] = order; saveOrders(orders);
  return { code: 200, data: { orderNo, channel, amount: ed.price, qr: order.qr, manual: !!order.manual, payUrl: order.payUrl } };
}

function issueForOrder(orders, orderNo) {
  const order = orders[orderNo];
  if (!order) return { code: 404, data: { error: '订单不存在' } };
  if (order.status !== 'PAID') return { code: 409, data: { error: '订单未支付' } };
  const ed = EDITIONS[order.edition];
  const lic = issueLicense({ fingerprint: order.fingerprint, seats: ed.seats, days: ed.days, edition: ed.key });
  const dir = path.join(ISSUED_DIR, orderNo);
  const file = saveLicense(lic, dir);
  order.licenseFile = file; order.issuedAt = new Date().toISOString();
  saveOrders(orders);
  return { code: 200, data: { orderNo, licenseFile: file } };
}

function markPaid(orders, outTradeNo) {
  const order = orders[outTradeNo];
  if (!order) return false;
  order.status = 'PAID'; order.paidAt = new Date().toISOString();
  saveOrders(orders);
  return true;
}

// ---------- 静态文件 ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
function serveStatic(req, res, pathname) {
  let f = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  f = path.normalize(f);
  if (!f.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url);
  const pathname = parsed.pathname;
  const orders = loadOrders();

  try {
    if (req.method === 'GET' && pathname === '/api/health') return send(res, 200, { ok: true });
    if (req.method === 'GET' && pathname === '/api/editions') return send(res, 200, { editions: Object.values(EDITIONS), wechat: wechat.isConfigured(), alipay: alipay.isConfigured() });

    if (req.method === 'POST' && pathname === '/api/order') {
      const body = parseBody(req, await readBody(req));
      const r = await handleOrder(orders, body);
      return send(res, r.code, r.data);
    }
    if (req.method === 'GET' && pathname.startsWith('/api/order/')) {
      const no = pathname.split('/').pop();
      const o = orders[no];
      if (!o) return send(res, 404, { error: '订单不存在' });
      return send(res, 200, { orderNo: no, status: o.status, edition: o.edition, amount: o.amount, manual: !!o.manual });
    }

    // 微信回调
    if (req.method === 'POST' && pathname === '/api/webhook/wechat') {
      const raw = await readBody(req);
      const plain = wechat.verifyAndDecrypt(req.headers, raw);
      if (!plain) return send(res, 400, { code: 'FAIL', message: '验签失败' });
      if (plain.trade_state === 'SUCCESS' && markPaid(orders, plain.out_trade_no)) issueForOrder(orders, plain.out_trade_no);
      return send(res, 200, { code: 'SUCCESS', message: '成功' });
    }
    // 支付宝回调
    if (req.method === 'POST' && pathname === '/api/webhook/alipay') {
      const body = parseBody(req, await readBody(req));
      if (!alipay.verifyNotify(body)) return res.writeHead(400), res.end('failure');
      if (body.trade_status === 'TRADE_SUCCESS' && markPaid(orders, body.out_trade_no)) issueForOrder(orders, body.out_trade_no);
      return res.writeHead(200), res.end('success');
    }

    // 手动发货 / 外部平台签发（需 ADMIN_TOKEN）
    // 模式 A（兼容）：body.orderNo 存在 → 走 store 内部订单签发（手动模式客服发货）
    // 模式 B（新增）：ai-agent-platform 私有化授权直接调本接口，传外部参数即时签发，
    //   入参：{ product, version, validDays, seats, offline, email, orderNo?, adminToken }
    //   无需先在 store 建订单，便于平台侧 webhook 履约阶段自动签发。
    if (req.method === 'POST' && pathname === '/api/admin/issue') {
      const body = parseBody(req, await readBody(req));
      if (body.adminToken !== ADMIN_TOKEN) return send(res, 403, { error: '无权限' });

      // 模式 B：外部参数化直接签发
      if (body.version && body.seats != null && body.validDays != null) {
        const fingerprint = (body.email || body.orderNo || 'aibak-platform') + '|' + (body.product || body.version);
        const lic = issueLicense({
          fingerprint,
          seats: Number(body.seats),
          days: Number(body.validDays),
          edition: PLATFORM_EDITION_MAP[body.version] || body.version,
        });
        const dir = path.join(ISSUED_DIR, 'platform-' + (body.orderNo || Date.now().toString(36)));
        const file = saveLicense(lic, dir);
        logger && logger.info && logger.info('admin/issue', `平台直接签发: version=${body.version} orderNo=${body.orderNo}`);
        return send(res, 200, { license: lic, licenseFile: file, downloadUrl: `/api/license/platform-${body.orderNo || ''}` });
      }

      // 模式 A：store 内部订单签发
      const order = orders[body.orderNo];
      if (!order) return send(res, 404, { error: '订单不存在' });
      if (order.status !== 'PAID') { order.status = 'PAID'; order.paidAt = new Date().toISOString(); saveOrders(orders); }
      const r = issueForOrder(orders, body.orderNo);
      return send(res, r.code, r.data);
    }

    // 下载 license（仅已支付）
    if (req.method === 'GET' && pathname.startsWith('/api/license/')) {
      const no = pathname.split('/').pop();
      const o = orders[no];
      if (!o || o.status !== 'PAID' || !o.licenseFile) return send(res, 409, { error: '许可证尚未签发' });
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="license.json"` });
      return fs.createReadStream(o.licenseFile).pipe(res);
    }

    if (req.method === 'GET') return serveStatic(req, res, pathname);
    send(res, 404, { error: 'not found' });
  } catch (e) {
    send(res, 500, { error: String(e && e.message || e) });
  }
});

server.listen(PORT, () => {
  console.log(`金网通购买页已启动: http://localhost:${PORT}`);
  console.log(`  微信支付: ${wechat.isConfigured() ? '已配置' : '未配置(手动模式)'}`);
  console.log(`  支付宝:   ${alipay.isConfigured() ? '已配置' : '未配置(手动模式)'}`);
});
