#!/usr/bin/env node
// ============================================================
// deploy-agent — 一键远程部署 CLI
// 用法：
//   node cli.js deploy --host 159.75.124.59 --user root --password xxx
//   node cli.js status --host 159.75.124.59
//   node cli.js logs --host 159.75.124.59 --service server
//   node cli.js restart --host 159.75.124.59
// ============================================================

const { program } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const { NodeSSH } = require('node-ssh');

// ============================================================
// SSH 连接
// ============================================================
async function connectSSH(host, user, password, privateKey) {
  const ssh = new NodeSSH();
  const config = {
    host,
    username: user || 'root',
    port: 22,
    readyTimeout: 30000,
    keepaliveInterval: 10000,
  };

  if (privateKey) {
    config.privateKey = fs.readFileSync(privateKey, 'utf8');
  } else if (password) {
    config.password = password;
  } else {
    throw new Error('请提供 --password 或 --key 参数');
  }

  process.stdout.write(chalk.cyan(`🔗 连接 ${host}... `));
  await ssh.connect(config);
  console.log(chalk.green('已连接'));
  return ssh;
}

// ============================================================
// 上传项目到服务器
// ============================================================
async function uploadProject(ssh, localPath, remotePath, options = {}) {
  const exclude = [
    'node_modules', '.git', 'dist', '.env',
    'uploads', 'coverage', '*.log',
  ];
  const excludeStr = exclude.map(e => `--exclude='${e}'`).join(' ');

  console.log(chalk.cyan(`📦 上传项目到 ${remotePath}...`));
  console.log(chalk.gray(`   排除: ${exclude.join(', ')}`));

  // 确保远程目录存在
  await ssh.execCommand(`mkdir -p ${remotePath}`);

  // 使用 rsync（如果可用）或 tar+scp
  const rsyncCheck = await ssh.execCommand('which rsync 2>/dev/null');
  if (rsyncCheck.code === 0 && process.platform !== 'win32') {
    console.log(chalk.gray('   使用 rsync 传输...'));
    // rsync 需要本地安装，Windows 可能没有
  }

  // 通用方案：tar + pipe（跨平台）
  console.log(chalk.gray('   打包并上传...'));

  const localDir = path.dirname(localPath);
  const localName = path.basename(localPath);

  const tarCmd = process.platform === 'win32'
    ? `tar -czf - -C "${localDir}" ${excludeStr} "${localName}" 2>/dev/null || tar -czf - -C "${localDir}" "${localName}"`
    : `tar -czf - -C "${localDir}" ${excludeStr} "${localName}"`;

  const remoteCmd = `tar -xzf - -C ${path.dirname(remotePath)}`;

  try {
    await ssh.putFiles([
      { local: localPath, remote: remotePath }
    ]);
    // putFiles 单文件可以，但整个目录最好用 tar pipe
    // 改用 execCommand tar
    // 这里用更简单的方式：直接用 putDirectory
    console.log(chalk.gray('   使用 SFTP 上传（首次可能较慢）...'));
    await ssh.putDirectory(localPath, remotePath, {
      recursive: true,
      concurrency: 5,
      validate: (filePath) => {
        const relative = path.relative(localPath, filePath).replace(/\\/g, '/');
        // 跳过不需要的文件
        const skip = [
          'node_modules', '.git', 'dist', '.env',
          'uploads', 'coverage',
        ];
        const ext = path.extname(relative);
        if (ext === '.log') return false;

        for (const s of skip) {
          if (relative.startsWith(s + '/') || relative === s) return false;
        }
        return true;
      },
    });
    console.log(chalk.green(`✅ 上传完成`));
  } catch (err) {
    // 如果 putDirectory 失败（大项目），用 tar 打包方式
    console.log(chalk.yellow('   SFTP 目录上传失败，尝试 tar 打包上传...'));
    const { execSync } = require('child_process');
    const tmpTar = `/tmp/deploy-${Date.now()}.tar.gz`;

    // Windows git bash 自带 tar
    try {
      execSync(`tar -czf "${tmpTar}" -C "${path.dirname(localPath)}" --exclude=node_modules --exclude=.git --exclude=dist --exclude=uploads --exclude=coverage "${path.basename(localPath)}"`, { stdio: 'pipe' });
    } catch (e) {
      // 降级：排除更少
      console.log(chalk.yellow('   tar 排除过多，尝试最小排除...'));
      execSync(`tar -czf "${tmpTar}" -C "${path.dirname(localPath)}" "${path.basename(localPath)}"`, { stdio: 'pipe' });
    }

    await ssh.putFile(tmpTar, '/tmp/deploy.tar.gz');
    await ssh.execCommand(`rm -rf ${remotePath} && mkdir -p ${remotePath}`);
    await ssh.execCommand(`tar -xzf /tmp/deploy.tar.gz -C ${path.dirname(remotePath)}`);
    await ssh.execCommand('rm -f /tmp/deploy.tar.gz');
    execSync(`rm -f "${tmpTar}"`);
    console.log(chalk.green(`✅ 上传完成（tar 方式）`));
  }
}

// ============================================================
// 远程部署
// ============================================================
async function remoteDeploy(ssh, remotePath) {
  console.log(chalk.cyan(`🚀 触发远程自动部署...`));
  console.log(chalk.gray(`   项目路径: ${remotePath}`));

  const result = await ssh.execCommand(
    `cd ${remotePath} && bash deploy/auto-deploy.sh`,
    { cwd: remotePath, stream: 'both', onStdout: (chunk) => process.stdout.write(chunk.toString('utf8')), onStderr: (chunk) => process.stderr.write(chunk.toString('utf8')) }
  );

  return result.code === 0;
}

// ============================================================
// 远程初始化服务器
// ============================================================
async function remoteInitServer(ssh, remotePath) {
  console.log(chalk.cyan(`🛠️  初始化服务器环境...`));

  const result = await ssh.execCommand(
    `cd ${remotePath} && bash deploy/init-server.sh`,
    { stream: 'both', onStdout: (chunk) => process.stdout.write(chunk.toString('utf8')), onStderr: (chunk) => process.stderr.write(chunk.toString('utf8')) }
  );

  return result.code === 0;
}

// ============================================================
// 远程状态
// ============================================================
async function remoteStatus(ssh, remotePath) {
  console.log(chalk.cyan(`📊 查询项目状态...`));

  const { stdout } = await ssh.execCommand(
    `cd ${remotePath} && echo "---容器---" && docker compose ps 2>/dev/null || echo "NOT_DEPLOYED"`,
  );

  console.log(stdout);

  // 健康检查
  console.log('');
  const health = await ssh.execCommand(
    `curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/health 2>/dev/null || echo 'unreachable'`,
  );
  if (health.stdout === '200') {
    console.log(chalk.green('✅ /api/health 返回 200'));
  } else {
    console.log(chalk.red(`❌ /api/health 不可达 (${health.stdout.trim()})`));
  }

  const frontend = await ssh.execCommand(
    `curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:80/ 2>/dev/null || echo 'unreachable'`,
  );
  if (frontend.stdout === '200') {
    console.log(chalk.green('✅ 前端 返回 200'));
  } else {
    console.log(chalk.yellow(`⚠️  前端状态: ${frontend.stdout.trim()}`));
  }
}

// ============================================================
// 远程日志
// ============================================================
async function remoteLogs(ssh, remotePath, service) {
  const svc = service || '';
  console.log(chalk.cyan(`📋 拉取日志...`));

  const result = await ssh.execCommand(
    `cd ${remotePath} && docker compose logs --tail=100 ${svc} 2>/dev/null || echo "无日志"`,
    { stream: 'both', onStdout: (chunk) => process.stdout.write(chunk.toString('utf8')), onStderr: (chunk) => process.stderr.write(chunk.toString('utf8')) }
  );
}

// ============================================================
// 远程重启
// ============================================================
async function remoteRestart(ssh, remotePath) {
  console.log(chalk.cyan(`🔄 重启服务...`));

  const result = await ssh.execCommand(
    `cd ${remotePath} && docker compose restart`,
    { stream: 'both', onStdout: (chunk) => process.stdout.write(chunk.toString('utf8')), onStderr: (chunk) => process.stderr.write(chunk.toString('utf8')) }
  );

  if (result.code === 0) {
    console.log(chalk.green('✅ 重启完成'));
  } else {
    console.log(chalk.red('❌ 重启失败'));
  }
}

// ============================================================
// CLI 命令定义
// ============================================================
program
  .name('deploy-agent')
  .description('一键远程部署工具 — 从本地部署项目到远程服务器')
  .version('1.0.0');

// ---- deploy ----
program
  .command('deploy')
  .description('打包并部署项目到远程服务器')
  .option('-H, --host <host>', '服务器 IP', '159.75.124.59')
  .option('-u, --user <user>', 'SSH 用户名', 'root')
  .option('-p, --password <password>', 'SSH 密码（或使用 -k 指定私钥）')
  .option('-k, --key <key>', 'SSH 私钥路径')
  .option('-P, --path <path>', '项目本地路径', '.')
  .option('-r, --remote <remote>', '远程项目路径', '/opt/ai-agent-platform')
  .option('--init', '首次部署前先初始化服务器环境')
  .action(async (options) => {
    const projectPath = path.resolve(options.path);
    console.log(chalk.bold.blue('\n╔══════════════════════════════╗'));
    console.log(chalk.bold.blue('║   🚀 deploy-agent 一键部署   ║'));
    console.log(chalk.bold.blue('╚══════════════════════════════╝\n'));
    console.log(chalk.gray(`本地路径: ${projectPath}`));
    console.log(chalk.gray(`远程主机: ${options.host}`));
    console.log(chalk.gray(`远程路径: ${options.remote}`));
    console.log('');

    let ssh;
    try {
      ssh = await connectSSH(options.host, options.user, options.password, options.key);

      if (options.init) {
        await remoteInitServer(ssh, options.remote);
      }

      await uploadProject(ssh, projectPath, options.remote);
      const success = await remoteDeploy(ssh, options.remote);

      if (success) {
        console.log(chalk.green.bold('\n✅ 部署成功！\n'));
      } else {
        console.log(chalk.red.bold('\n❌ 部署失败，请查看上方日志\n'));
        process.exit(1);
      }
    } catch (err) {
      console.error(chalk.red(`\n❌ 错误: ${err.message}\n`));
      process.exit(1);
    } finally {
      if (ssh) ssh.dispose();
    }
  });

// ---- status ----
program
  .command('status')
  .description('查看远程项目运行状态')
  .option('-H, --host <host>', '服务器 IP', '159.75.124.59')
  .option('-u, --user <user>', 'SSH 用户名', 'root')
  .option('-p, --password <password>', 'SSH 密码')
  .option('-k, --key <key>', 'SSH 私钥路径')
  .option('-r, --remote <remote>', '远程项目路径', '/opt/ai-agent-platform')
  .action(async (options) => {
    let ssh;
    try {
      ssh = await connectSSH(options.host, options.user, options.password, options.key);
      await remoteStatus(ssh, options.remote);
    } catch (err) {
      console.error(chalk.red(`错误: ${err.message}`));
      process.exit(1);
    } finally {
      if (ssh) ssh.dispose();
    }
  });

// ---- logs ----
program
  .command('logs')
  .description('查看远程项目日志')
  .option('-H, --host <host>', '服务器 IP', '159.75.124.59')
  .option('-u, --user <user>', 'SSH 用户名', 'root')
  .option('-p, --password <password>', 'SSH 密码')
  .option('-k, --key <key>', 'SSH 私钥路径')
  .option('-r, --remote <remote>', '远程项目路径', '/opt/ai-agent-platform')
  .option('-s, --service <service>', '指定服务 (server/client/mongodb/redis)')
  .action(async (options) => {
    let ssh;
    try {
      ssh = await connectSSH(options.host, options.user, options.password, options.key);
      await remoteLogs(ssh, options.remote, options.service);
    } catch (err) {
      console.error(chalk.red(`错误: ${err.message}`));
      process.exit(1);
    } finally {
      if (ssh) ssh.dispose();
    }
  });

// ---- restart ----
program
  .command('restart')
  .description('重启远程项目')
  .option('-H, --host <host>', '服务器 IP', '159.75.124.59')
  .option('-u, --user <user>', 'SSH 用户名', 'root')
  .option('-p, --password <password>', 'SSH 密码')
  .option('-k, --key <key>', 'SSH 私钥路径')
  .option('-r, --remote <remote>', '远程项目路径', '/opt/ai-agent-platform')
  .action(async (options) => {
    let ssh;
    try {
      ssh = await connectSSH(options.host, options.user, options.password, options.key);
      await remoteRestart(ssh, options.remote);
    } catch (err) {
      console.error(chalk.red(`错误: ${err.message}`));
      process.exit(1);
    } finally {
      if (ssh) ssh.dispose();
    }
  });

program.parse();
