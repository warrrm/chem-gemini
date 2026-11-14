import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

// 与常规测试分离，防止 CI 或普通 npm test 意外产生付费请求。
if (process.env.RUN_LIVE_AI_TEST !== '1') {
  console.error('此测试会调用真实付费接口。请明确执行 RUN_LIVE_AI_TEST=1 npm run test:live。');
  process.exit(1);
}

const localEnv = readFileSync('.env.local', 'utf8');
const key = process.env.DEEPSEEK_API_KEY?.trim() || localEnv.match(/^DEEPSEEK_API_KEY=(.+)$/m)?.[1]?.trim();
assert.ok(key, '请先配置本机服务端 DEEPSEEK_API_KEY');

function scanBundle(dir: string): void {
  for (const entry of readdirSync(dir)) {
    const file = path.join(dir, entry);
    if (statSync(file).isDirectory()) scanBundle(file);
    else assert.ok(!readFileSync(file).includes(key!), `构建产物不应含默认密钥：${file}`);
  }
}
scanBundle('dist');
console.log('生产构建检查：未包含默认密钥。');

const port = Number(process.env.LIVE_AI_PORT ?? '4188');
const origin = `http://127.0.0.1:${port}`;
const server = await createServer({
  root: process.cwd(), server: { port, host: '127.0.0.1', strictPort: true }, logLevel: 'error',
});
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await server.listen();
  const status = await fetch(`${origin}/chem-gemini/api/ai/status`).then((response) => response.json()) as { configured: boolean; model: string };
  assert.equal(status.configured, true);
  assert.equal(status.model, 'deepseek-flash');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/chem-gemini/`);
  // 仅发送程序生成的试剂标签图，不读取或上传用户照片。
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f1f5f9'; ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = '#fff'; ctx.fillRect(130, 80, 380, 330);
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 8; ctx.strokeRect(130, 80, 380, 330);
    ctx.fillStyle = '#000'; ctx.font = 'bold 64px sans-serif'; ctx.fillText('氢氧化钠', 160, 230);
    ctx.font = '36px sans-serif'; ctx.fillText('Sodium hydroxide', 155, 320);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByTestId('image-file-input').setInputFiles({ name: 'synthetic-label.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') });
  await page.getByRole('heading', { name: '第三方图像识别数据传输确认' }).waitFor();
  const pendingResponse = page.waitForResponse((response) => response.url().endsWith('/api/ai/chat/completions'), { timeout: 75000 });
  await page.getByRole('button', { name: '同意并继续在线识图' }).click();
  const response = await pendingResponse;
  console.log(`真实 DeepSeek 图片请求：HTTP ${response.status()}。`);
  assert.equal(response.request().headers().authorization, undefined, '浏览器请求不应携带默认 Key');
  assert.equal(response.status(), 200, '真实接口调用失败，请检查网络、密钥、余额和权限');
  await page.getByRole('button', { name: /氢氧化钠.*确认此物质/ }).waitFor({ timeout: 10000 });
  assert.ok(!(await page.evaluate(() => JSON.stringify(sessionStorage))).includes(key!));
  await page.getByRole('button', { name: /氢氧化钠.*确认此物质/ }).click();
  await page.locator('#formula-input').fill('NaOH');
  await page.getByRole('button', { name: '提交校验并解锁' }).click();
  await page.getByTestId('unlocked-formula-value').waitFor();
  assert.deepEqual(errors, [], '页面不应发生未捕获错误');
  console.log('真实验收通过：图片识别为氢氧化钠 → 确认名称 → 书写 NaOH → 解锁知识卡片。');
  console.log('密钥检查通过：浏览器请求、sessionStorage、生产 JS 均不包含默认 Key。');
} finally {
  if (browser) await browser.close();
  await server.close();
}
