#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""上传部署脚本和代码修复到服务器"""
import paramiko, sys, io, os

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# 从环境变量读取连接信息（绝不在代码中硬编码凭据）
HOST = os.getenv('DEPLOY_HOST', '')
USER = os.getenv('DEPLOY_USER', 'root')
PASS = os.getenv('DEPLOY_PASSWORD', '')
TIMEOUT = int(os.getenv('DEPLOY_TIMEOUT', '15'))

if not HOST or not PASS:
    print("[FATAL] 请设置环境变量 DEPLOY_HOST 和 DEPLOY_PASSWORD")
    print("  方式1: export DEPLOY_HOST=your-ip DEPLOY_PASSWORD=your-password")
    print("  方式2: 复制 deploy/.env.example 为 deploy/.env 并在脚本前 source")
    sys.exit(1)

BASE = os.getenv('DEPLOY_LOCAL_PATH', os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REMOTE = '/opt/ai-agent-platform'

# 需要上传的文件
FILES = [
    ('deploy/auto-deploy.sh', 'deploy/auto-deploy.sh'),
    ('deploy/init-server.sh', 'deploy/init-server.sh'),
    ('deploy/sites.yaml', 'deploy/sites.yaml'),
    ('deploy/batch.sh', 'deploy/batch.sh'),
    ('deploy/lib/diagnostics.sh', 'deploy/lib/diagnostics.sh'),
    ('deploy/lib/fixes.sh', 'deploy/lib/fixes.sh'),
    ('deploy/cli/package.json', 'deploy/cli/package.json'),
    ('deploy/cli/cli.js', 'deploy/cli/cli.js'),
    ('deploy/check_server.py', 'deploy/check_server.py'),
    ('client/.dockerignore', 'client/.dockerignore'),
    ('client/nginx.conf', 'client/nginx.conf'),
    ('client/nginx.ssl.conf', 'client/nginx.ssl.conf'),
]

def upload():
    print("=== 上传文件到服务器 ===")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASS, timeout=TIMEOUT)
    sftp = ssh.open_sftp()

    # 创建远程目录
    for d in ['deploy/lib', 'deploy/cli']:
        try:
            sftp.stat(os.path.join(REMOTE, d))
        except:
            try:
                sftp.mkdir(os.path.join(REMOTE, d))
            except:
                pass  # recursive creation

    # 递归创建目录
    stdin, stdout, stderr = ssh.exec_command(f'mkdir -p {REMOTE}/deploy/lib {REMOTE}/deploy/cli')
    stdout.read()

    for local_rel, remote_rel in FILES:
        local_path = os.path.join(BASE, local_rel)
        remote_path = os.path.join(REMOTE, remote_rel).replace('\\', '/')
        try:
            # 读取文件内容，转换 CRLF -> LF
            with open(local_path, 'rb') as f:
                content = f.read().replace(b'\r\n', b'\n').replace(b'\r', b'\n')
            # 用 sftp 写入（防止二进制模式下的换行问题）
            with sftp.open(remote_path, 'wb') as f:
                f.write(content)
            print(f"  [OK] {remote_rel}")
        except Exception as e:
            print(f"  [FAIL] {remote_rel}: {e}")

    sftp.close()

    # 设置脚本执行权限
    print("\n=== 设置执行权限 ===")
    stdin, stdout, stderr = ssh.exec_command(f'chmod +x {REMOTE}/deploy/*.sh {REMOTE}/deploy/lib/*.sh')
    stdout.read()
    print("  [OK] 权限已设置")

    # 验证上传
    print("\n=== 验证上传文件 ===")
    stdin, stdout, stderr = ssh.exec_command(f'ls -la {REMOTE}/deploy/ {REMOTE}/deploy/lib/ {REMOTE}/deploy/cli/')
    print(stdout.read().decode())

    ssh.close()
    print("\n[OK] 上传完成!")

if __name__ == '__main__':
    try:
        upload()
    except Exception as e:
        print(f"[FAIL] {e}")
        sys.exit(1)
