import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // 不 strip /api 前缀：后端所有路由挂在 /api/xxx（如 /api/auth/login），
        // 原样透传即可命中后端路由。
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
