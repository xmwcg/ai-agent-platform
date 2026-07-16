#!/usr/bin/env python3
"""可选的 CNB Webhook 触发器。

该服务不直接拉取或部署 main；它只唤醒 deploy-from-cnb.sh，最终仍由
cnb-watcher.sh 检查 deploy/production，避免绕过 CNB 质量门禁。
默认仅监听本机，若确需公网接入应放在 HTTPS 反向代理之后。
"""

import hashlib
import hmac
import json
import os
import subprocess
import sys
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer

DEPLOY_SCRIPT = os.environ.get("DEPLOY_SCRIPT", "/opt/ai-agent-platform/deploy-from-cnb.sh")
WEBHOOK_SECRET = os.environ.get("DEPLOY_SECRET")
BIND_HOST = os.environ.get("WEBHOOK_BIND", "127.0.0.1")
PORT = int(os.environ.get("WEBHOOK_PORT", "9000"))
LOG_FILE = os.environ.get("WEBHOOK_LOG", "/var/log/cnb-webhook.log")


class WebhookHandler(BaseHTTPRequestHandler):
    def log_message(self, format_string, *args):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] {self.address_string()} - {format_string % args}\n"
        print(log_entry, end="")
        with open(LOG_FILE, "a", encoding="utf-8") as log:
            log.write(log_entry)

    def do_POST(self):
        if self.path != "/deploy":
            self.send_error(404)
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        if content_length <= 0 or content_length > 1024 * 1024:
            self.send_error(400, "Invalid body size")
            return
        body = self.rfile.read(content_length)

        signature = self.headers.get("X-CNB-Signature", "")
        expected = hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
        valid_signature = hmac.compare_digest(signature, expected) or hmac.compare_digest(
            signature, f"sha256={expected}"
        )
        if not valid_signature:
            self.log_message("签名验证失败")
            self.send_error(403)
            return

        try:
            data = json.loads(body)
            repo = data.get("repository", "unknown")
            branch = data.get("branch", "unknown")
            commit = str(data.get("commit", "unknown"))[:8]
            self.log_message("收到触发通知: %s@%s [%s]", repo, branch, commit)

            result = subprocess.run(
                [DEPLOY_SCRIPT],
                capture_output=True,
                text=True,
                timeout=1800,
                check=False,
            )
            if result.returncode == 0:
                self.send_response(202)
                self.end_headers()
                self.wfile.write(b"Watcher completed\n")
                return

            self.log_message("watcher 失败: %s", result.stderr[-1000:])
            self.send_error(500, "Watcher failed")
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_error(400, "Invalid JSON")
        except subprocess.TimeoutExpired:
            self.log_message("watcher 执行超时")
            self.send_error(504, "Watcher timeout")
        except Exception as error:  # 防止 webhook 服务因单次异常退出
            self.log_message("处理失败: %s", str(error))
            self.send_error(500)

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(b"CNB webhook trigger ready\n")


if __name__ == "__main__":
    if not WEBHOOK_SECRET:
        print("DEPLOY_SECRET 未配置，拒绝启动 webhook 服务", file=sys.stderr)
        sys.exit(1)
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    server = HTTPServer((BIND_HOST, PORT), WebhookHandler)
    print(f"CNB webhook trigger listening on http://{BIND_HOST}:{PORT}/deploy")
    server.serve_forever()
