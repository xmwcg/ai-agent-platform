// NexMind Service Worker — 修复 nginx 未配置 mime.types 导致 JS 被当作 text/plain
// 拦截 .js 请求并确保 Content-Type 正确
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", () => self.clients.claim());
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.endsWith(".js") && url.hostname === self.location.hostname) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (!response.ok || response.headers.get("Content-Type")?.includes("javascript")) {
          return response;
        }
        // Content-Type 错误，创建一个修正后的响应
        return response.blob().then((blob) => {
          return new Response(blob, {
            status: response.status,
            statusText: response.statusText,
            headers: {
              ...Object.fromEntries(response.headers.entries()),
              "Content-Type": "application/javascript",
            },
          });
        });
      })
    );
  }
});
