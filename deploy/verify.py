#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""最终验证：功能测试 + 自动诊断"""
import paramiko, sys, io, requests, os

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
BASE_URL = f'http://{HOST}'

print("=" * 60)
print("  最终验证 - AI Agent Platform 部署")
print("=" * 60)

# 1. 前端页面
print("\n[1/5] 前端页面...")
r = requests.get(f'{BASE_URL}/', timeout=10)
print(f"  状态码: {r.status_code}")
html = r.text[:500]
if 'html' in html.lower() or '<!DOCTYPE' in html.upper():
    print(f"  内容: HTML页面 ({len(r.text)} bytes)")
else:
    print(f"  内容: {html[:100]}")

# 2. API健康检查
print("\n[2/5] API健康检查...")
r = requests.get(f'{BASE_URL}/api/health', timeout=10)
print(f"  状态码: {r.status_code}")
print(f"  响应: {r.text[:200]}")

# 3. API基础接口
print("\n[3/5] API基础接口...")
r = requests.get(f'{BASE_URL}/api', timeout=10)
print(f"  状态码: {r.status_code}")
print(f"  响应: {r.text[:200]}")

# 4. SSH诊断
print("\n[4/5] 服务器自动诊断...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS, timeout=TIMEOUT)

# 运行诊断脚本
stdin, stdout, stderr = ssh.exec_command(
    'cd /opt/ai-agent-platform && bash deploy/lib/diagnostics.sh 2>&1 || true'
)
diag_out = stdout.read().decode()
print(diag_out[:2000] if len(diag_out) > 2000 else diag_out)

# 5. 容器状态
print("\n[5/5] 容器状态...")
stdin, stdout, stderr = ssh.exec_command(
    "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep ai-platform"
)
print(stdout.read().decode())

ssh.close()

print("\n" + "=" * 60)
print("  验证完成!")
print("=" * 60)
