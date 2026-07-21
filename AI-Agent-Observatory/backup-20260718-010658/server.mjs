import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';

const execFileAsync = promisify(execFile);
const host = '127.0.0.1';
const port = Number(process.env.CODEX_DASHBOARD_PORT || 4173);
const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, '$1'));
const npmRoot = path.join(process.env.APPDATA || '', 'npm');
const ccusage = path.join(npmRoot, 'node_modules', 'ccusage', 'src', 'cli.js');
const codex = path.join(npmRoot, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');

async function run(script, args) {
  const { stdout } = await execFileAsync(process.execPath, [script, ...args], {
    windowsHide: true,
    timeout: 30000,
    maxBuffer: 50 * 1024 * 1024,
  });
  return stdout.trim();
}
async function jsonReport(kind) {
  return JSON.parse(await run(ccusage, ['codex', kind, '--json', '--offline', '--no-cost']));
}

async function data() {
  const [daily, monthly, sessions, codexVersion, ccusageVersion] = await Promise.all([
    jsonReport('daily'),
    jsonReport('monthly'),
    jsonReport('session'),
    run(codex, ['--version']),
    run(ccusage, ['--version']),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    hostname: os.hostname(),
    codexVersion,
    ccusageVersion,
    daily: daily.daily || [],
    monthly: monthly.monthly || [],
    sessions: sessions.sessions || [],
  };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/api/data') {
      const body = JSON.stringify(await data());
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(body);
      return;
    }
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('ok');
      return;
    }
    const html = await readFile(path.join(root, 'index.html'));
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html);
  } catch (error) {
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: error.message }));
  }
});

server.listen(port, host, () => console.log(`Codex dashboard: http://${host}:${port}`));


