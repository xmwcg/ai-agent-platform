# MoneyPrinterTurbo worker for AIBAK production.
#
# 设计要点：
#  - 基于官方镜像 harry0703/moneyprinterturbo，已含 MPT 源码 / 依赖 / ffmpeg。
#  - 官方镜像缺 ImageMagick（字幕合成会失败）与中文字体（字幕会变方块），这里补装。
#  - 烘焙一个安全的默认 config（不含任何密钥）。真实密钥在服务器上提供，见 README。
#  - 启动的是 FastAPI API 服务（端口 8080），不是 Streamlit WebUI。
FROM harry0703/moneyprinterturbo:latest

USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      imagemagick \
      fonts-wqy-zenhei fonts-wqy-microhei fonts-noto-cjk \
 && rm -rf /var/lib/apt/lists/*

# 默认配置（无密钥，容器一定能启动；生成任务会因缺 key 优雅失败，由 AIBAK provider 转 502）。
# 真实密钥：在服务器上把 config.example.toml 复制为 config.toml 并填好，再重建本镜像。
COPY config.example.toml /MoneyPrinterTurbo/config.toml

WORKDIR /MoneyPrinterTurbo
EXPOSE 8080
# 与本地拉起方式一致：python main.py -> uvicorn app.asgi:app（监听 config.toml 的 listen_host/port）
CMD ["python", "main.py"]
