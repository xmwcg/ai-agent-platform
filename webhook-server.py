#!/usr/bin/env python3
"""
CNB Webhook 接收服务
作用：接收 CNB push 通知，自动拉取代码并部署到 Docker
端口：9000
"""

import os
import sys
import json
import hmac
import hashlib
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime

# 配置
PROJECT_DIR = "/opt/ai-agent-platform"
DEPLOY_SCRIPT = "/opt/ai-agent-platform/deploy-from-cnb.sh"
WEBHOOK_SECRET = os.environ.get("DEPLOY_SECRET", "cnb-deploy-secret-1784006404")
PORT = 9000

class WebhookHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        """自定义日志，输出到文件"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] {self.address_string()} - {format % args}\n"
        print(log_entry, end='')
        with open("/var/log/cnb-webhook.log", "a") as f:
            f.write(log_entry)
    
    def do_POST(self):
        if self.path != "/deploy":
            self.send_response(404)
            self.end_headers()
            return
        
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        
        # 验证签名
        signature = self.headers.get('X-CNB-Signature', '')
        expected = hmac.new(
            WEBHOOK_SECRET.encode(),
            body,
            hashlib.sha256
        ).hexdigest()
        
        if signature != expected and signature != f"sha256={expected}":
            self.log_message("❌ 签名验证失败")
            self.send_response(403)
            self.end_headers()
            self.wfile.write(b"Forbidden")
            return
        
        try:
            data = json.loads(body)
            repo = data.get('repository', 'unknown')
            branch = data.get('branch', 'unknown')
            commit = data.get('commit', 'unknown')[:8]
            message = data.get('message', '')[:50]
            
            self.log_message(f"🚀 接收部署通知: {repo}@{branch} [{commit}] {message}")
            
            # 执行部署脚本
            result = subprocess.run(
                [DEPLOY_SCRIPT],
                capture_output=True,
                text=True,
                timeout=300
            )
            
            if result.returncode == 0:
                self.log_message("✅ 部署成功")
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b"Deploy OK")
            else:
                self.log_message(f"❌ 部署失败: {result.stderr}")
                self.send_response(500)
                self.end_headers()
                self.wfile.write(b"Deploy Failed")
                
        except Exception as e:
            self.log_message(f"❌ 错误: {str(e)}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Error: {str(e)}".encode())
    
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        self.wfile.write(b"CNB Webhook Server Running\n")

if __name__ == "__main__":
    # 创建日志目录
    os.makedirs("/var/log", exist_ok=True)
    
    server = HTTPServer(('0.0.0.0', PORT), WebhookHandler)
    print(f"[*] CNB Webhook 服务启动: http://0.0.0.0:{PORT}/deploy")
    print(f"[*] 项目路径: {PROJECT_DIR}")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] 服务已停止")
        sys.exit(0)
