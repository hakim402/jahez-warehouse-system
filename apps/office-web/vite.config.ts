import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'JAHEZ_');
  const target = env.JAHEZ_DEV_API_TARGET || 'http://127.0.0.1:3000';
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/v1': { target, changeOrigin: true },
        '/socket.io/': { target, changeOrigin: true, ws: true },
      },
    },
  };
});
