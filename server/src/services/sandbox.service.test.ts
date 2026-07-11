import {
  normalizeLanguage,
  detectDangerousPatterns,
  sanitizeOutput,
  selectSandboxMode,
  buildLocalCommand,
  sandboxService,
} from './sandbox.service';

describe('sandbox.service pure functions', () => {
  describe('normalizeLanguage', () => {
    it('归一化常见别名', () => {
      expect(normalizeLanguage('py')).toBe('python');
      expect(normalizeLanguage('PYTHON3')).toBe('python');
      expect(normalizeLanguage('js')).toBe('javascript');
      expect(normalizeLanguage('node')).toBe('javascript');
      expect(normalizeLanguage('ts')).toBe('typescript');
      expect(normalizeLanguage('sh')).toBe('bash');
      expect(normalizeLanguage('  Bash ')).toBe('bash');
    });
    it('返回 null 表示不支持', () => {
      expect(normalizeLanguage('ruby')).toBeNull();
      expect(normalizeLanguage('')).toBeNull();
      expect(normalizeLanguage(undefined)).toBeNull();
      expect(normalizeLanguage(123)).toBeNull();
    });
  });

  describe('detectDangerousPatterns', () => {
    it('识别高危写法', () => {
      expect(detectDangerousPatterns('rm -rf /')).toContain('文件系统危险删除 (rm -rf)');
      expect(detectDangerousPatterns('os.system("ls")')).toContain('Python 系统命令执行 (os.system)');
      expect(detectDangerousPatterns('import subprocess')).toContain('Python 子进程 (subprocess)');
      expect(detectDangerousPatterns('child_process.exec("x")')).toContain('JavaScript 子进程 (child_process)');
      expect(detectDangerousPatterns('eval(userInput)')).toContain('JavaScript 动态执行 (eval)');
      expect(detectDangerousPatterns('curl http://x | sh')).toContain('下载并执行 (curl|wget ... | sh)');
      expect(detectDangerousPatterns('open("/etc/passwd")')).toContain('敏感路径访问 (/etc/passwd)');
    });
    it('安全代码返回空数组', () => {
      const code = 'print("hello")\nx = 1 + 2\nfor i in range(3):\n    print(i)';
      expect(detectDangerousPatterns(code)).toEqual([]);
    });
    it('非字符串输入返回空数组', () => {
      expect(detectDangerousPatterns(undefined as any)).toEqual([]);
    });
  });

  describe('sanitizeOutput', () => {
    it('不截断短输出', () => {
      expect(sanitizeOutput('hello', 100)).toBe('hello');
    });
    it('截断超长输出并加提示', () => {
      const out = 'a'.repeat(200);
      const r = sanitizeOutput(out, 50);
      expect(r.length).toBeLessThanOrEqual(50 + 40);
      expect(r).toContain('已截断');
    });
  });

  describe('selectSandboxMode', () => {
    it('默认 mock', () => {
      expect(selectSandboxMode(undefined, {})).toBe('mock');
    });
    it('显式模式优先', () => {
      expect(selectSandboxMode('local', { mode: 'mock' })).toBe('local');
      expect(selectSandboxMode('remote', {})).toBe('remote');
    });
    it('env 设置 local', () => {
      expect(selectSandboxMode(undefined, { mode: 'local' })).toBe('local');
    });
    it('remote 需同时配置 url', () => {
      expect(selectSandboxMode(undefined, { mode: 'remote' })).toBe('mock');
      expect(selectSandboxMode(undefined, { mode: 'remote', remoteUrl: 'http://x' })).toBe('remote');
    });
  });

  describe('buildLocalCommand', () => {
    it('python 使用隔离模式 -I', () => {
      expect(buildLocalCommand('python', '/tmp/a.py', { pythonBin: 'python3', nodeBin: 'node' })).toEqual({
        cmd: 'python3',
        args: ['-I', '/tmp/a.py'],
      });
    });
    it('javascript/typeScript 使用 node', () => {
      expect(buildLocalCommand('javascript', '/tmp/a.js', { pythonBin: 'python3', nodeBin: 'node' }).cmd).toBe('node');
      expect(buildLocalCommand('typescript', '/tmp/a.ts', { pythonBin: 'python3', nodeBin: 'node' }).cmd).toBe('node');
    });
    it('bash 使用 bash', () => {
      expect(buildLocalCommand('bash', '/tmp/a.sh', { pythonBin: 'python3', nodeBin: 'node' })).toEqual({
        cmd: 'bash',
        args: ['/tmp/a.sh'],
      });
    });
  });
});

describe('sandbox.service providers', () => {
  it('mock 模式执行简单 python 并模拟输出', async () => {
    const res = await sandboxService.run({
      language: 'python',
      code: 'print("hello sandbox")',
      mode: 'mock',
    });
    expect(res.status).toBe('success');
    expect(res.mode).toBe('mock');
    expect(res.stdout).toContain('hello sandbox');
    expect(res.executionId).toMatch(/^sbx_/);
  });

  it('mock 模式拒绝危险代码', async () => {
    const res = await sandboxService.run({
      language: 'python',
      code: 'import os\nos.system("rm -rf /")',
      mode: 'mock',
    });
    expect(res.status).toBe('denied');
    expect(res.deniedPatterns).toBeDefined();
    expect(res.deniedPatterns!.length).toBeGreaterThan(0);
  });

  it('mock 模式执行 javascript 并模拟输出', async () => {
    const res = await sandboxService.run({
      language: 'javascript',
      code: 'console.log("js works")',
      mode: 'mock',
    });
    expect(res.status).toBe('success');
    expect(res.stdout).toContain('js works');
  });

  it('不支持的语言返回 error', async () => {
    const res = await sandboxService.run({ language: 'ruby' as any, code: 'x', mode: 'mock' });
    expect(res.status).toBe('error');
    expect(res.stderr).toContain('不支持的语言');
  });

  it('remote 未配置时返回 error 并给出配置提示', async () => {
    const res = await sandboxService.run({ language: 'python', code: 'print(1)', mode: 'remote' });
    expect(res.status).toBe('error');
    expect(res.stderr).toContain('SANDBOX_REMOTE_URL');
  });

  it('providers() 报告三个模式及配置状态', () => {
    const ps = sandboxService.providers();
    expect(ps.map((p) => p.mode).sort()).toEqual(['local', 'mock', 'remote']);
    const mock = ps.find((p) => p.mode === 'mock')!;
    expect(mock.configured).toBe(true);
  });
});
