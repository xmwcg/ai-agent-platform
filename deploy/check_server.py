#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""检查远程服务器状态"""
import paramiko, sys, io, os

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# 从环境变量读取连接信息（绝不在代码中硬编码凭据）
HOST = os.getenv('DEPLOY_HOST', os.getenv('DEPLOY_HOST', ''))
USER = os.getenv('DEPLOY_USER', 'root')
PASS = os.getenv('DEPLOY_PASSWORD', '')
TIMEOUT = int(os.getenv('DEPLOY_TIMEOUT', '15'))

if not HOST or not PASS:
    print("[FATAL] 请设置环境变量 DEPLOY_HOST 和 DEPLOY_PASSWORD")
    print("  方式1: export DEPLOY_HOST=your-ip DEPLOY_PASSWORD=your-password")
    print("  方式2: 复制 deploy/.env.example 为 deploy/.env 并在脚本前 source")
    sys.exit(1)

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print(f"[1/4] 连接服务器 {HOST}...")
    ssh.connect(HOST, username=USER, password=PASS, timeout=TIMEOUT)
    print("[OK] 连接成功\n")

    cmds = [
        ("系统信息", "uname -a; uptime"),
        ("Docker版本", "docker --version 2>&1; docker compose version 2>&1"),
        ("项目文件", "ls -la /opt/ai-agent-platform/ 2>&1 || echo '[INFO] 目录不存在'"),
        ("运行容器", "docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>&1"),
        ("磁盘空间", "df -h / 2>&1"),
        ("端口占用", "ss -tlnp 2>&1 | head -20"),
    ]

    for title, cmd in cmds:
        print(f"[*] {title}:")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode().strip()
        err = stderr.read().decode().strip()
        if out:
            print(out)
        if err:
            print(f"[WARN] {err}")
        print()

    print("[OK] 检查完成")
    ssh.close()

except Exception as e:
    print(f"[FAIL] 错误: {e}")
    sys.exit(1)
