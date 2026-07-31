#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import paramiko, sys, io, os

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# 从环境变量读取连接信息（绝不在代码中硬编码凭据）
HOST = os.getenv('DEPLOY_HOST', '')
USER = os.getenv('DEPLOY_USER', 'root')
PASS = os.getenv('DEPLOY_PASSWORD', '')
TIMEOUT = int(os.getenv('DEPLOY_TIMEOUT', '15'))

if not HOST or not PASS:
    print("[FATAL] 请设置环境变量 DEPLOY_HOST 和 DEPLOY_PASSWORD")
    sys.exit(1)

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS, timeout=TIMEOUT)

# Check server source for Phase 3 routes
cmds = {
    "marketplace": "grep -rn marketplace /opt/ai-agent-platform/server/src/routes/ 2>&1 | head -5",
    "quickstart": "grep -rn quickstart /opt/ai-agent-platform/server/src/routes/ 2>&1 | head -5",
    "team": "grep -rn 'team' /opt/ai-agent-platform/server/src/routes/ 2>&1 | head -5",
    "docker_image": "docker inspect ai-platform-server --format '{{.Created}}' 2>&1",
    "server_logs": "docker logs ai-platform-server --tail 20 2>&1",
}

for name, cmd in cmds.items():
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    print(f"[{name}]:")
    print(out or err or "(empty)")
    print()

ssh.close()
