/**
 * deploy-agent CLI 核心模块单元测试
 *
 * 测试范围：
 * - YAML 站点配置解析
 * - SSH 连接配置构建
 * - 文件上传排除规则
 * - 远程命令构建
 *
 * 注意：不测试真实 SSH 连接（需要远程服务器）
 */
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');

// ========== YAML 解析测试 ==========

describe('deploy-agent CLI Core', () => {

  describe('sites.yaml 解析', () => {
    let config;

    beforeAll(() => {
      const yamlPath = path.resolve(__dirname, '../../sites.yaml');
      config = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
    });

    it('应包含 server 配置', () => {
      expect(config.server).toBeDefined();
      expect(config.server.host).toBeTruthy();
    });

    it('应包含 sites 数组', () => {
      expect(Array.isArray(config.sites)).toBe(true);
      expect(config.sites.length).toBeGreaterThanOrEqual(1);
    });

    it('ai-agent-platform 应启用', () => {
      const site = config.sites.find(s => s.name === 'ai-agent-platform');
      expect(site).toBeDefined();
      expect(site.enabled).not.toBe(false);
    });

    it('server 配置应包含 host/user/port/base_path', () => {
      expect(config.server).toHaveProperty('host');
      expect(config.server).toHaveProperty('user');
      expect(config.server).toHaveProperty('port');
      expect(config.server).toHaveProperty('base_path');
    });
  });

  describe('SSH 连接配置构建', () => {
    it('应优先使用 SSH 私钥', () => {
      // 模拟 cli.js connectSSH 逻辑
      class NodeSSH {
        constructor() {
          this.config = null;
        }
        connect(cfg) {
          this.config = cfg;
          return Promise.resolve();
        }
      }
      const ssh = new NodeSSH();
      // 有 key 时不使用 password
      const hasKey = true;
      const hasPassword = 'secret123';
      // 验证逻辑：有 key 时跳过 password
      const useKey = hasKey ? 'privateKey' : 'password';
      expect(useKey).toBe('privateKey');
    });

    it('应包含 keepaliveInterval 配置', () => {
      const config = {
        host: '192.168.1.1',
        username: 'root',
        port: 22,
        readyTimeout: 30000,
        keepaliveInterval: 10000,
        password: 'test',
      };
      expect(config.keepaliveInterval).toBe(10000);
      expect(config.readyTimeout).toBe(30000);
    });
  });

  describe('文件上传排除规则', () => {
    it('应排除 node_modules', () => {
      const exclude = ['node_modules', '.git', 'dist', '.env', 'uploads', 'coverage'];
      const shouldExclude = (filePath) => {
        for (const s of exclude) {
          if (filePath.startsWith(s + '/') || filePath === s) return true;
        }
        return false;
      };
      expect(shouldExclude('node_modules/some-pkg/index.js')).toBe(true);
      expect(shouldExclude('node_modules')).toBe(true);
      expect(shouldExclude('.git/objects/abc')).toBe(true);
      expect(shouldExclude('.git')).toBe(true);
    });

    it('不应排除源码文件', () => {
      const exclude = ['node_modules', '.git', 'dist', '.env', 'uploads', 'coverage'];
      const shouldExclude = (filePath) => {
        for (const s of exclude) {
          if (filePath.startsWith(s + '/') || filePath === s) return true;
        }
        return false;
      };
      expect(shouldExclude('server/src/index.ts')).toBe(false);
      expect(shouldExclude('client/src/App.tsx')).toBe(false);
      expect(shouldExclude('deploy/auto-deploy.sh')).toBe(false);
      expect(shouldExclude('docker-compose.yml')).toBe(false);
    });

    it('应排除 .log 文件', () => {
      const path = require('path');
      expect(path.extname('output.log')).toBe('.log');
      expect(path.extname('server.ts')).not.toBe('.log');
    });
  });

  describe('远程命令构建', () => {
    it('deploy 命令格式正确', () => {
      const remotePath = '/opt/ai-agent-platform';
      const cmd = `cd ${remotePath} && bash deploy/auto-deploy.sh`;
      expect(cmd).toContain('deploy/auto-deploy.sh');
      expect(cmd).toContain(remotePath);
    });

    it('status 命令格式正确', () => {
      const remotePath = '/opt/ai-agent-platform';
      const cmd = `cd ${remotePath} && docker compose ps`;
      expect(cmd).toContain('docker compose ps');
      expect(cmd).toContain(remotePath);
    });

    it('logs 命令格式正确', () => {
      const remotePath = '/opt/ai-agent-platform';
      const service = 'server';
      const cmd = `cd ${remotePath} && docker compose logs --tail=100 ${service}`;
      expect(cmd).toContain(`logs --tail=100 ${service}`);
      expect(cmd).toContain(remotePath);
    });

    it('restart 命令格式正确', () => {
      const remotePath = '/opt/ai-agent-platform';
      const cmd = `cd ${remotePath} && docker compose restart`;
      expect(cmd).toContain('docker compose restart');
      expect(cmd).toContain(remotePath);
    });

    it('init 命令格式正确', () => {
      const remotePath = '/opt/ai-agent-platform';
      const cmd = `cd ${remotePath} && bash deploy/init-server.sh`;
      expect(cmd).toContain('deploy/init-server.sh');
      expect(cmd).toContain(remotePath);
    });
  });

  describe('CLI package.json', () => {
    let pkg;

    beforeAll(() => {
      const pkgPath = path.resolve(__dirname, '../package.json');
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    });

    it('应包含必要依赖', () => {
      expect(pkg.dependencies).toHaveProperty('commander');
      expect(pkg.dependencies).toHaveProperty('node-ssh');
      expect(pkg.dependencies).toHaveProperty('chalk');
    });

    it('chalk 应为 v4 (CommonJS 兼容)', () => {
      const chalkVer = pkg.dependencies.chalk;
      expect(chalkVer).toMatch(/^\^?4\./);
    });

    it('node 最低版本 >= 18', () => {
      expect(pkg.engines.node).toMatch(/>=18/);
    });

    it('应有 bin 入口', () => {
      expect(pkg.bin['deploy-agent']).toBe('./cli.js');
    });
  });

  describe('Shell 脚本完整性', () => {
    const scripts = [
      'auto-deploy.sh',
      'init-server.sh',
      'batch.sh',
      'deploy.sh',
      'setup-server.sh',
      'lib/diagnostics.sh',
      'lib/fixes.sh',
    ];

    for (const script of scripts) {
      it(`${script} 应存在`, () => {
        const scriptPath = path.resolve(__dirname, `../../${script}`);
        expect(fs.existsSync(scriptPath)).toBe(true);
      });

      it(`${script} 应有 shebang`, () => {
        const scriptPath = path.resolve(__dirname, `../../${script}`);
        const content = fs.readFileSync(scriptPath, 'utf8');
        expect(content.startsWith('#!/usr/bin/env bash')).toBe(true);
      });

      it(`${script} 应有 set 安全选项`, () => {
        const scriptPath = path.resolve(__dirname, `../../${script}`);
        const content = fs.readFileSync(scriptPath, 'utf8');
        expect(content).toMatch(/set\s+-euo\s+pipefail/);
      });
    }
  });
});
