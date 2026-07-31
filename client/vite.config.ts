import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

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
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react/') || id.includes('react-router')) {
              return 'react-vendor';
            }
            if (id.includes('antd') || id.includes('@ant-design')) {
              return 'antd-vendor';
            }
            if (id.includes('dompurify') || id.includes('marked') || id.includes('highlight')) {
              return 'markdown-vendor';
            }
            if (id.includes('monaco-editor') || id.includes('@monaco-editor')) {
              return 'monaco-editor';
            }
            return 'vendor';
          }
        },
      },
    },
  }
});
