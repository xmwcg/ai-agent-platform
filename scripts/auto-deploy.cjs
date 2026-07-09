#!/usr/bin/env node
'use strict';
/**
 * 智能自动同步部署守护进程（本地）
 * ---------------------------------------------------------------
 * 监听本地项目目录的文件变化 → 停手 10 秒后 → 自动 git add/commit/push →
 * 服务器（post-receive 钩子）自动构建部署。
 *
 * 特性：
 *   - 防抖：连续保存合并为一次推送（默认 10s 无改动才推）
 *   - 串行锁：上一次部署未完成时，新改动排队，绝不重叠卡死
 *   - 空改动跳过：没有实际变更不提交不推送
 *   - 后台运行：start 后进程常驻，不依赖任何 IDE / 编辑器
 *
 * 用法：
 *   node scripts/auto-deploy.cjs start    启动后台监听
 *   node scripts/auto-deploy.cjs stop     停止
 *   node scripts/auto-deploy.cjs status   查看是否运行中
 *   node scripts/auto-deploy.cjs log      查看最近日志
 *   node scripts/auto-deploy.cjs run      直接前台运行（内部使用，勿手动调用）
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const LOG_FILE = path.join(ROOT, 'scripts', 'auto-deploy.log');
const PID_FILE = path.join(os.tmpdir(), 'ai-agent-platform-auto-deploy.pid');
const DEBOUNCE_MS = 30 * 1000;
const REMOTE = 'prod';
const BRANCH = 'main';

// 这些目录/文件的变化不触发同步
const IGNORE_DIRS = ['.git', 'node_modules', '.superpowers', 'coverage', 'build', 'dist'];
const IGNORE_FILES = ['auto-deploy.log', '.auto-deploy.pid'];

function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}
function logLine(msg) {
  const line = `[${ts()}] ${msg}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch (e) { /* ignore */ }
}
function readPid() {
  try { return parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10) || null; }
  catch { return null; }
}
function isRunning() {
  const pid = readPid();
  if (!pid) return false;
  try { process.kill(pid, 0); return true; }
  catch { return false; }
}

/* 启动/同步时的背景声音提醒（仅 Windows，失败静默忽略） */
function playNotify() {
  if (process.platform !== 'win32') return;
  try {
    const ps = spawn('powershell', [
      '-NoProfile', '-Command',
      '[System.Media.SystemSounds]::Asterisk.Play()',
    ], { stdio: 'ignore', windowsHide: true });
    ps.on('error', () => {});
    ps.unref();
  } catch (e) { /* 音频不可用时不干扰主流程 */ }
}

/* ----------------------------- git 封装 ----------------------------- */
function git(args, cb) {
  const p = spawn('git', args, { cwd: ROOT, env: process.env });
  let out = '';
  p.stdout.on('data', (d) => (out += d));
  p.stderr.on('data', (d) => (out += d));
  p.on('close', (code) => {
    if (code !== 0) {
      if (out.trim()) logLine(out.trim());
      cb(new Error('git ' + args[0] + ' 退出码 ' + code));
    } else {
      cb(null, out);
    }
  });
  p.on('error', (e) => cb(e));
}

/* ----------------------------- 守护进程核心 ----------------------------- */
function runDaemon() {
  logLine('🚀 自动部署监听启动，监听目录: ' + ROOT);
  let timer = null;
  let deploying = false;
  let pending = false;

  function shouldIgnore(f) {
    if (!f) return false;
    const rel = path.relative(ROOT, f);
    const parts = rel.split(path.sep);
    if (parts.some((p) => IGNORE_DIRS.includes(p))) return true;
    if (IGNORE_FILES.includes(path.basename(f))) return true;
    return false;
  }

  function schedule(f) {
    if (shouldIgnore(f)) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(runDeployOnce, DEBOUNCE_MS);
  }

  function onChange(event, filename) {
    if (filename) {
      const full = path.join(ROOT, filename);
      if (shouldIgnore(full)) return;
      logLine(`📝 检测到改动: ${path.relative(ROOT, full) || filename}`);
    } else {
      logLine('📝 检测到批量改动');
    }
    schedule(filename ? path.join(ROOT, filename) : null);
  }

  function runDeployOnce() {
    if (deploying) {
      pending = true;
      logLine('⏳ 上次部署尚未完成，本次改动排队中...');
      return;
    }
    deploying = true;
    logLine(`🔄 开始同步：git add → commit → push ${REMOTE}/${BRANCH}`);

    git(['add', '-A'], (err) => {
      if (err) return finish('❌ git add 失败');
      git(['status', '--porcelain'], (err2, out) => {
        if (err2) return finish('❌ git status 失败');
        if (!out.trim()) {
          logLine('✓ 没有需要同步的改动，跳过');
          return finish();
        }
        const msg = 'auto-deploy: 自动同步 ' + ts().replace(/[: ]/g, '-');
        git(['commit', '-m', msg], (err3) => {
          if (err3) return finish('❌ git commit 失败');
          logLine('✓ 已提交本地改动');
          git(['push', REMOTE, BRANCH], (err4) => {
            if (err4) return finish('❌ git push 失败（服务器部署未触发）');
            logLine('🚀 已推送到服务器，服务器将自动部署（约 3 分钟）');
            finish();
          });
        });
      });
    });

    function finish(errMsg) {
      if (errMsg) logLine(errMsg);
      deploying = false;
      if (pending) {
        pending = false;
        logLine('🔁 处理排队中的改动');
        setTimeout(runDeployOnce, 1000);
      }
    }
  }

  try {
    const watcher = fs.watch(ROOT, { recursive: true, persistent: true }, onChange);
    watcher.on('error', (e) => {
      logLine('⚠️ 监听出错: ' + e.message);
    });
    logLine(`✅ 监听就绪（防抖 ${DEBOUNCE_MS / 1000}s，远程 ${REMOTE}/${BRANCH}）`);
    logLine('🔔 已播放启动提示音（后台监听中）');
    playNotify();
  } catch (e) {
    logLine('❌ 无法启动文件监听: ' + e.message);
    process.exit(1);
  }

  process.on('SIGTERM', () => {
    logLine('🛑 收到停止信号，退出');
    process.exit(0);
  });
  process.on('SIGINT', () => {
    logLine('🛑 收到中断信号，退出');
    process.exit(0);
  });
}

/* ----------------------------- 控制器命令 ----------------------------- */
function cmdStart() {
  if (isRunning()) {
    console.log('✅ 已在运行中 (PID ' + readPid() + ')');
    return;
  }
  const child = spawn(process.execPath, [__filename, 'run'], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: process.env,
  });
  child.unref();
  try { fs.writeFileSync(PID_FILE, String(child.pid)); } catch (e) {}
  console.log('✅ 自动部署监听已启动 (PID ' + child.pid + ')');
  console.log('   查看日志: node scripts/auto-deploy.cjs log');
  console.log('   停止:     node scripts/auto-deploy.cjs stop');
  console.log('   现在用任何工具改本项目文件，停手 30 秒后自动同步到服务器。');
}

function cmdStop() {
  const pid = readPid();
  if (!pid) { console.log('ℹ️ 未运行'); return; }
  try { process.kill(pid, 'SIGTERM'); } catch (e) {}
  try {
    spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  } catch (e) {}
  try { fs.unlinkSync(PID_FILE); } catch (e) {}
  console.log('🛑 已发送停止信号');
}

function cmdStatus() {
  if (isRunning()) console.log('✅ 运行中 (PID ' + readPid() + ')');
  else console.log('⭕ 未运行');
}

function cmdLog() {
  try {
    const lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n');
    console.log(lines.slice(-60).join('\n'));
  } catch (e) {
    console.log('（暂无日志）');
  }
}

/* ----------------------------- 入口 ----------------------------- */
const cmd = process.argv[2];
switch (cmd) {
  case 'start': cmdStart(); break;
  case 'stop': cmdStop(); break;
  case 'status': cmdStatus(); break;
  case 'log': cmdLog(); break;
  case 'run': runDaemon(); break;
  default:
    console.log('用法: node scripts/auto-deploy.cjs <start|stop|status|log>');
    process.exit(cmd ? 1 : 0);
}
