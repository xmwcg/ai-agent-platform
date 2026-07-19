import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import router from './router';
import { ErrorBoundary } from './components/ui-states';
import { antdLightTheme, antdDarkTheme } from './theme/tokens';
import { useUIStore } from './stores/ui';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

/** 主题感知的 ConfigProvider 包裹器 */
function ThemedApp() {
  const themeMode = useUIStore((s) => s.themeMode);

  // 同步主题到 <html> 标签
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  const theme = themeMode === 'dark' ? antdDarkTheme : antdLightTheme;

  return (
    <ConfigProvider locale={zhCN} theme={theme}>
      <AntdApp>
        <ErrorBoundary>
          <RouterProvider router={router} />
        </ErrorBoundary>
      </AntdApp>
    </ConfigProvider>
  );
}


// ─── 浏览器缓存清理：清除旧版模型名和 mc_ 前缀残留 ───
(function cleanupLegacyCache() {
  try {
    // 清理 zustand persist 中的旧模型名
    var chatStorage = localStorage.getItem('ai-chat-storage');
    if (chatStorage) {
      var changed = false;
      var cleaned = chatStorage
        .replace(/"deepseek-chat"/g, '"deepseek-v4-flash"')
        .replace(/"deepseek-coder"/g, '"deepseek-v4-flash"');
      if (cleaned !== chatStorage) {
        localStorage.setItem('ai-chat-storage', cleaned);
        changed = true;
      }
      if (changed) console.log('[cleanup] 已清理 localStorage 中的旧模型名');
    }
    // 清除 Service Worker 缓存（如果有）
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        regs.forEach(function(reg) { reg.unregister(); });
      });
    }
  } catch(e) { /* ignore */ }
})();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemedApp />
    </QueryClientProvider>
  </React.StrictMode>
);
