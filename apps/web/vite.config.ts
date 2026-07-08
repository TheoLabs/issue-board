import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// 프론트는 /api 로 호출 → 개발 시 NestJS(:4000)로 프록시 (CORS 불필요)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
