import { expect, Page, test } from '@playwright/test';

async function uploadSyntheticLabel(page: Page) {
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 200;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 320, 200);
    ctx.fillStyle = '#000'; ctx.font = '32px sans-serif'; ctx.fillText('氢氧化钠', 30, 100);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByTestId('image-file-input').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') });
}

test.describe('P0 根路径 GitHub Pages 静态发布', () => {
  test.beforeEach(async ({ page }) => {
    // 静态版不应该访问本机密钥网关，也绝不调用真实付费 API。
    await page.route('**/api/ai/**', route => route.fulfill({ status: 503, json: { error: { message: 'No gateway on Pages' } } }));
    await page.route('https://api.deepseek.com/**', route => route.abort());
  });

  test('shows the P0 marker and honest key requirement, without advertising a built-in gateway', async ({ page }) => {
    await page.goto('./');
    await expect(page).toHaveTitle(/P0.*课堂展示版/);
    await expect(page.locator('#root')).toHaveAttribute('data-app-version', 'p0');
    await expect(page.getByTestId('static-hosting-notice')).toContainText('此网页不包含本机默认 Key');
    await expect(page.getByTestId('static-hosting-notice').getByRole('link')).toHaveAttribute('href', './p1/');
    await expect(page.locator('#panel-ai-key-source')).toHaveValue('session');
    await expect(page.locator('#panel-ai-key-source option[value="server"]')).toBeDisabled();
    await expect(page.locator('#panel-ai-key')).toHaveValue('');
    await expect(page.getByTestId('panel-ai-key-server-notice')).toHaveCount(0);
    await expect(page.getByRole('radiogroup').getByRole('radio')).toHaveCount(2);
    let gatewayCalls = 0;
    page.on('request', request => { if (request.url().includes('/api/ai/')) gatewayCalls++; });
    await uploadSyntheticLabel(page);
    await expect(page.locator('#manual-substance-input')).toBeVisible();
    await expect(page.getByRole('heading', { name: '第三方图像识别数据传输确认' })).toHaveCount(0);
    expect(gatewayCalls).toBe(0);
  });

  test('completes the offline learning flow without any API key', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: '使用此样例开始学习' }).nth(1).click();
    await expect(page.locator('main')).not.toContainText('NaOH');
    await page.getByRole('button', { name: /氢氧化钠.*确认此物质/ }).click();
    await page.locator('#formula-input').fill('NaOH');
    await page.getByRole('button', { name: '提交校验并解锁' }).click();
    await expect(page.getByTestId('unlocked-formula-value')).toHaveText('NaOH');
  });

  test('supports a replacement API with explicit image consent on the hosted page', async ({ page }) => {
    const calls: { authorization?: string; body: Record<string, any> }[] = [];
    await page.route('https://example.invalid/v1/chat/completions', async route => {
      const body = route.request().postDataJSON();
      calls.push({ authorization: route.request().headers().authorization, body });
      await route.fulfill({ json: { choices: [{ message: { content: body.messages[0].content === 'Reply with OK'
        ? 'OK' : JSON.stringify({ status: 'ok', candidates: [{ substanceId: 'naoh' }] }) } }] } });
    });
    await page.goto('./');
    await page.locator('#panel-ai-baseurl').fill('https://example.invalid/v1');
    await page.locator('#panel-ai-model').fill('custom-vision-model');
    await page.locator('#panel-ai-key').fill('dummy-pages-key-not-real');
    await page.getByTestId('submit-ai-config-btn').click();
    await expect(page.getByTestId('ai-panel-feedback')).toContainText('连接成功');
    await uploadSyntheticLabel(page);
    await expect(page.getByRole('heading', { name: '第三方图像识别数据传输确认' })).toBeVisible();
    expect(calls).toHaveLength(1);
    await page.getByRole('button', { name: '同意并继续在线识图' }).click();
    await expect(page.getByRole('button', { name: /氢氧化钠.*确认此物质/ })).toBeVisible();
    expect(calls).toHaveLength(2);
    expect(calls[1].authorization).toBe('Bearer dummy-pages-key-not-real');
    expect(calls[1].body.messages[1].content[1].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
  });

  test('restoring defaults on Pages does not enable a nonexistent server credential', async ({ page }) => {
    await page.goto('./');
    await page.locator('#panel-ai-baseurl').fill('https://example.invalid/v1');
    await page.locator('#panel-ai-model').fill('custom-vision-model');
    await page.getByTestId('restore-default-ai-btn').click();
    await expect(page.locator('#panel-ai-baseurl')).toHaveValue('https://api.deepseek.com/v1');
    await expect(page.locator('#panel-ai-model')).toHaveValue('deepseek-flash');
    await expect(page.locator('#panel-ai-key-source')).toHaveValue('session');
    await expect(page.getByTestId('ai-panel-feedback')).toContainText('填写自备 API Key');
    await expect(page.getByTestId('run-mode-badge')).toHaveText('演示模式');
  });
});
