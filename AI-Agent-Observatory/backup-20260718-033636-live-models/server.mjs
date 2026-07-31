import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const host = '127.0.0.1';
const port = Number(process.env.CODEX_DASHBOARD_PORT || 4173);
const root = path.dirname(fileURLToPath(import.meta.url));
const scanner = path.join(root, 'scan_agents.py');
const python = process.env.CODEX_DASHBOARD_PYTHON || 'python';
const cacheTtlMs = 30_000;
let cache = null;
let cacheAt = 0;
let scanPromise = null;

async function scan() {
  const { stdout } = await execFileAsync(python, [scanner], {
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    encoding: 'utf8',
  });
  const parsed = JSON.parse(stdout.replace(/^\uFEFF/, ''));
  if (parsed?.security?.secretsExposed !== false) {
    throw new Error('安全检查失败：扫描结果未确认脱敏');
  }
  cache = parsed;
  cacheAt = Date.now();
  return parsed;
}

async function getData(force = false) {
  if (!force && cache && Date.now() - cacheAt < cacheTtlMs) return cache;
  if (!scanPromise) scanPromise = scan().finally(() => { scanPromise = null; });
  return scanPromise;
}

function send(res, status, type, body) {
  res.writeHead(status, {
    'content-type': `${type}; charset=utf-8`,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'",
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${host}:${port}`);
    if (url.pathname === '/api/data') {
      send(res, 200, 'application/json', JSON.stringify(await getData(url.searchParams.get('refresh') === '1')));
      return;
    }
    if (url.pathname === '/health') {
      send(res, 200, 'text/plain', 'ok');
      return;
    }
    if (url.pathname !== '/' && url.pathname !== '/index.html') {
      send(res, 404, 'text/plain', 'Not found');
      return;
    }
    send(res, 200, 'text/html', await readFile(path.join(root, 'index.html'), 'utf8'));
  } catch (error) {
    send(res, 500, 'application/json', JSON.stringify({ error: error?.message || String(error) }));
  }
});

server.listen(port, host, () => console.log(`AI Agent Observatory: http://${host}:${port}`));
