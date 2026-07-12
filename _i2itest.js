const https = require('https');
const B = 'https://jymkjtools-study-d6eipek12446b18.service.tcloudbase.com/ai-image';
function post(path, obj, timeoutMs) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(obj);
    const u = new URL(path);
    const req = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, res => {
      let body = ''; res.on('data', d => body += d); res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
    req.on('error', reject); req.write(data); req.end();
  });
}
function getBuf(url, timeoutMs) { return new Promise((resolve, reject) => { const req = https.get(url, res => { const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve(Buffer.concat(chunks))); }); req.setTimeout(timeoutMs, () => req.destroy(new Error('dl timeout'))); req.on('error', reject); }); }
(async () => {
  try {
    const t2i = await post(B, { prompt: 'a sunflower', model: 'HY-Image-3.0-Plus-4090-Tob-v1.0' }, 60000);
    const url = (JSON.parse(t2i.body).data || [])[0]?.url;
    console.log('t2i url got:', !!url);
    const buf = await getBuf(url, 30000);
    const b64 = buf.toString('base64');
    console.log('b64 len:', b64.length);
    const i2i = await post(B, { prompt: 'oil painting style', model: 'HY-Image-v3.0-I2I-ToB-v1.0.1', images: [b64] }, 150000);
    console.log('i2i status:', i2i.status);
    console.log('i2i body:', i2i.body.slice(0, 200));
  } catch (e) { console.log('ERR', e.message); }
})();
