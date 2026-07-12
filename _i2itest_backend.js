const https = require('https');
const http = require('http');
const B = 'https://jymkjtools-study-d6eipek12446b18.service.tcloudbase.com/ai-image';
const BACKEND = 'http://localhost:3000/api/aibak/image';
function postJson(url, obj, timeout, proto) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    const data = JSON.stringify(obj);
    const lib = proto === 'https' ? https : http;
    const req = lib.request({ hostname: u.hostname, path: u.pathname + (u.search || ''), port: u.port, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res({ status: r.statusCode, body: b })); });
    req.setTimeout(timeout, () => req.destroy(new Error('timeout'))); req.on('error', rej); req.write(data); req.end();
  });
}
function getBuf(url, timeout) { return new Promise((res, rej) => { const req = https.get(url, r => { const c = []; r.on('data', d => c.push(d)); r.on('end', () => res(Buffer.concat(c))); }); req.setTimeout(timeout, () => req.destroy(new Error('dl'))); req.on('error', rej); }); }
(async () => {
  try {
    const t2i = await postJson(B, { prompt: 'a sunflower', model: 'HY-Image-3.0-Plus-4090-Tob-v1.0' }, 60000, 'https');
    const url = (JSON.parse(t2i.body).data || [])[0]?.url;
    const buf = await getBuf(url, 30000);
    const b64 = buf.toString('base64');
    const dataUrl = 'data:image/png;base64,' + b64;
    console.log('ref b64 len', b64.length);
    const r = await postJson(BACKEND, { model: 'HY-Image-v3.0-I2I-ToB-v1.0.1', prompt: 'oil painting style', imageBase64: dataUrl }, 180000, 'http');
    console.log('backend i2i status', r.status);
    console.log('backend i2i body', r.body.slice(0, 280));
  } catch (e) { console.log('ERR', e.message); }
})();
