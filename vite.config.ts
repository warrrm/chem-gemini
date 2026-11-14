import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createDeepSeekGateway } from './server/deepseekGateway';

export default defineConfig(({ mode }) => {
  // 不使用 VITE_ 前缀或 define 注入：密钥只存在于 Node 服务端。
  const env = loadEnv(mode, process.cwd(), '');
  const isPages = mode === 'pages';
  const gateway = createDeepSeekGateway({ apiKey: isPages ? '' : env.DEEPSEEK_API_KEY ?? '' });
  return {
    base: isPages ? '/chem-gemini/p1/' : '/chem-gemini/',
    define: { 'import.meta.env.VITE_AI_DEPLOYMENT': JSON.stringify(isPages ? 'static' : 'local') },
    plugins: [react(), ...isPages ? [] : [{
      name: 'local-deepseek-gateway',
      configureServer(server) { server.middlewares.use(gateway); },
      configurePreviewServer(server) { server.middlewares.use(gateway); },
    } satisfies import('vite').Plugin]],
    server: { port: 4173, host: '127.0.0.1' },
    preview: { port: 4173, host: '127.0.0.1' },
  };
});
