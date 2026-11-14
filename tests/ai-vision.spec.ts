import { expect, Page, test } from '@playwright/test';

const recognitionReply = { choices: [{ message: { content: JSON.stringify({
  status: 'ok', candidates: [{ substanceId: 'naoh' }],
}) } }] };
const connectionReply = { choices: [{ message: { content: 'OK' } }] };

async function uploadLabel(page: Page) {
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 480; canvas.height = 320;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 480, 320);
    ctx.fillStyle = '#000'; ctx.font = '48px sans-serif'; ctx.fillText('氢氧化钠', 60, 160);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByTestId('image-file-input').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') });
}

test.describe('P1 DeepSeek V4.1 Flash 识图与 API 替换', () => {
  test.beforeEach(async ({ page }) => {
    // 即使界面意外发起默认请求，也不能消耗本机真实 Key 的额度。
    await page.route('**/api/ai/chat/completions', async (route) => route.fulfill({ json: connectionReply }));
  });

  test('defaults to server-side Flash vision without exposing a key in the form or storage', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByTestId('run-mode-badge')).toContainText('DeepSeek V4.1 Flash');
    await expect(page.getByTestId('ai-mode-online')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#panel-ai-model')).toHaveValue('deepseek-flash');
    await expect(page.locator('#panel-ai-key-source')).toHaveValue('server');
    await expect(page.locator('#panel-ai-key')).toHaveCount(0);
    expect(await page.evaluate(() => JSON.stringify(sessionStorage))).not.toMatch(/sk-[0-9a-f]{32}/);
  });

  test('asks consent before uploading and sends a real image_url request to the default gateway', async ({ page }) => {
    const captured: { headers: Record<string, string>; body: Record<string, any> }[] = [];
    await page.route('**/api/ai/chat/completions', async (route) => {
      captured.push({ headers: route.request().headers(), body: route.request().postDataJSON() });
      await route.fulfill({ json: recognitionReply });
    });
    await page.goto('./');
    await uploadLabel(page);
    await expect(page.getByRole('heading', { name: '第三方图像识别数据传输确认' })).toBeVisible();
    expect(captured).toHaveLength(0);
    await page.getByRole('button', { name: '同意并继续在线识图' }).click();
    await expect(page.getByRole('button', { name: /氢氧化钠.*确认此物质/ })).toBeVisible();
    expect(captured).toHaveLength(1);
    expect(captured[0].headers.authorization).toBeUndefined();
    expect(captured[0].headers['x-chem-image-consent']).toBe('true');
    expect(captured[0].body.model).toBe('deepseek-flash');
    expect(captured[0].body.thinking).toEqual({ type: 'disabled' });
    expect(captured[0].body.messages[1].content[1].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
    expect(await page.locator('main').innerText()).not.toContain('NaOH');
  });

  test('declining consent makes no AI request and keeps local search usable', async ({ page }) => {
    let calls = 0;
    await page.route('**/api/ai/chat/completions', async (route) => { calls++; await route.fulfill({ json: recognitionReply }); });
    await page.goto('./');
    await uploadLabel(page);
    await page.getByRole('button', { name: '不同意，保持本地模式' }).click();
    await expect(page.locator('#manual-substance-input')).toBeVisible();
    await expect(page.locator('main')).toContainText('演示模式不会分析你的图片');
    expect(calls).toBe(0);
  });

  test('allows switching to another API, reauthorizes images and persists the replacement config', async ({ page }) => {
    const calls: { authorization?: string; body: Record<string, any> }[] = [];
    await page.route('https://example.invalid/v1/chat/completions', async (route) => {
      const body = route.request().postDataJSON();
      calls.push({ authorization: route.request().headers().authorization, body });
      await route.fulfill({ json: typeof body.messages[0].content === 'string' && body.messages[0].content === 'Reply with OK' ? connectionReply : recognitionReply });
    });
    await page.goto('./');
    await page.locator('#panel-ai-baseurl').fill('https://example.invalid/v1');
    await page.locator('#panel-ai-model').fill('custom-vision-model');
    await page.locator('#panel-ai-mode').selectOption('vision');
    await page.locator('#panel-ai-key').fill('dummy-custom-api-key');
    await page.getByTestId('submit-ai-config-btn').click();
    await expect(page.getByTestId('ai-panel-feedback')).toContainText('连接成功');
    await expect(page.getByTestId('run-mode-badge')).toContainText('在线模型 (custom-vision-model)');
    expect(calls[0].authorization).toBe('Bearer dummy-custom-api-key');
    await page.reload();
    await expect(page.locator('#panel-ai-baseurl')).toHaveValue('https://example.invalid/v1');
    await expect(page.locator('#panel-ai-key-source')).toHaveValue('session');
    await uploadLabel(page);
    await expect(page.getByRole('heading', { name: '第三方图像识别数据传输确认' })).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText('https://example.invalid/v1');
    expect(calls).toHaveLength(1);
    await page.getByRole('button', { name: '同意并继续在线识图' }).click();
    await expect(page.getByRole('button', { name: /氢氧化钠.*确认此物质/ })).toBeVisible();
    expect(calls).toHaveLength(2);
    expect(calls[1].body.model).toBe('custom-vision-model');
  });

  test('changing the provider revokes consent and never carries its old key across', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('chem_gemini_p1_online_config_v2', JSON.stringify({
      enabled: true, providerPreset: 'deepseek', providerMode: 'vision', baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-flash', credentialSource: 'session', apiKey: 'dummy-old-provider-key', imageUploadConsented: true,
    })));
    await page.goto('./');
    await page.locator('#panel-ai-baseurl').fill('https://opencode.ai/zen/v1');
    await expect(page.locator('#panel-ai-key')).toHaveValue('');
    await page.route('https://opencode.ai/zen/v1/chat/completions', async (route) => route.fulfill({ json: connectionReply }));
    await page.locator('#panel-ai-key').fill('dummy-new-provider-key');
    await page.getByTestId('submit-ai-config-btn').click();
    await expect(page.getByTestId('ai-panel-feedback')).toContainText('连接成功');
    await uploadLabel(page);
    await expect(page.getByRole('heading', { name: '第三方图像识别数据传输确认' })).toBeVisible();
  });

  test('restores the built-in default without refilling a key', async ({ page }) => {
    await page.goto('./');
    await page.locator('#panel-ai-baseurl').fill('https://example.invalid/v1');
    await page.locator('#panel-ai-model').fill('custom-vision-model');
    await page.getByTestId('restore-default-ai-btn').click();
    await expect(page.locator('#panel-ai-key-source')).toHaveValue('server');
    await expect(page.locator('#panel-ai-model')).toHaveValue('deepseek-flash');
    await expect(page.getByTestId('run-mode-badge')).toContainText('DeepSeek V4.1 Flash');
  });

  test('shows only two run modes and removes redundant shortcuts on desktop, mobile and settings', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('./');
    const modes = page.getByRole('radiogroup', { name: '选择 AI 运行方式' });
    await expect(modes.getByRole('radio')).toHaveCount(2);
    await expect(page.getByTestId('ai-mode-online')).toContainText('在线 AI 识图');
    await expect(page.getByTestId('ai-mode-demo')).toContainText('离线演示');
    for (const id of ['volcengine_deepseek', 'opencode_vision', 'custom']) {
      await expect(page.getByTestId(`ai-preset-${id}`)).toHaveCount(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: '设置与教师模式', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: '1. AI 识图设置' })).toBeVisible();
    for (const name of ['火山方舟 DeepSeek', '多模态识图', '自定义接口']) {
      await expect(dialog.getByRole('button', { name, exact: true })).toHaveCount(0);
    }
    await expect(dialog.locator('.modal-preset-row, .model-quick-chips')).toHaveCount(0);
    await expect(dialog.locator('#ai-base-url')).toBeEditable();
    await expect(dialog.getByRole('button', { name: '关闭', exact: true })).toHaveCSS('white-space', 'nowrap');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await dialog.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('keeps legacy API configurations selected as online mode without exposing old preset cards', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('chem_gemini_p1_online_config_v2', JSON.stringify({
      enabled: true, providerPreset: 'opencode_vision', providerMode: 'vision', baseURL: 'https://opencode.ai/zen/v1',
      model: 'gpt-4o-mini', credentialSource: 'session', apiKey: 'dummy-legacy-api-key', imageUploadConsented: false,
    })));
    await page.goto('./');
    await expect(page.getByTestId('ai-mode-online')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('ai-mode-demo')).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('#panel-ai-baseurl')).toHaveValue('https://opencode.ai/zen/v1');
    await expect(page.locator('#panel-ai-model')).toHaveValue('gpt-4o-mini');
    await expect(page.locator('#panel-ai-key')).toHaveValue('dummy-legacy-api-key');
    await expect(page.getByRole('radiogroup').getByRole('radio')).toHaveCount(2);
  });

  test('allows replacing the API directly in the simplified settings form', async ({ page }) => {
    await page.route('https://example.invalid/v1/chat/completions', async (route) => route.fulfill({ json: connectionReply }));
    await page.goto('./');
    await page.getByRole('button', { name: '设置与教师模式', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#ai-base-url').fill('https://example.invalid/v1');
    await dialog.locator('#ai-model').fill('custom-vision-model');
    await dialog.locator('#ai-provider-mode').selectOption('vision');
    await expect(dialog.locator('#ai-api-key-source')).toHaveValue('session');
    await dialog.locator('#ai-api-key').fill('dummy-settings-api-key');
    await dialog.getByRole('button', { name: '测试接口连通性', exact: true }).click();
    await expect(dialog.getByRole('status')).toContainText('连接成功');
    await dialog.getByRole('button', { name: '保存并应用设置', exact: true }).click();
    await dialog.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(page.getByTestId('run-mode-badge')).toContainText('在线模型 (custom-vision-model)');
    await expect(page.locator('#panel-ai-baseurl')).toHaveValue('https://example.invalid/v1');
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('chem_gemini_p1_online_config_v2')!))).toMatchObject({
      providerPreset: 'custom', credentialSource: 'session', imageUploadConsented: false,
    });
  });

  test('switching offline and back online preserves the manually configured API', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('chem_gemini_p1_online_config_v2', JSON.stringify({
      enabled: true, providerPreset: 'custom', providerMode: 'vision', baseURL: 'https://example.invalid/v1',
      model: 'custom-vision-model', credentialSource: 'session', apiKey: 'dummy-switch-mode-key', imageUploadConsented: false,
    })));
    await page.goto('./');
    await page.getByTestId('ai-mode-demo').click();
    await expect(page.getByTestId('run-mode-badge')).toHaveText('演示模式');
    await expect(page.getByTestId('ai-inline-form')).toHaveCount(0);
    await page.getByTestId('ai-mode-online').click();
    await expect(page.getByTestId('run-mode-badge')).toContainText('在线模型 (custom-vision-model)');
    await expect(page.locator('#panel-ai-baseurl')).toHaveValue('https://example.invalid/v1');
    await expect(page.locator('#panel-ai-model')).toHaveValue('custom-vision-model');
    await expect(page.locator('#panel-ai-key')).toHaveValue('dummy-switch-mode-key');
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('chem_gemini_p1_online_config_v2')!))).toMatchObject({
      enabled: true, providerPreset: 'custom',
    });
  });

  test('a late image response cannot reopen a reset learning flow', async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let started = false;
    await page.route('**/api/ai/chat/completions', async (route) => {
      started = true;
      await gate;
      await route.fulfill({ json: recognitionReply });
    });
    await page.goto('./');
    await uploadLabel(page);
    await page.getByRole('button', { name: '同意并继续在线识图' }).click();
    await expect.poll(() => started).toBe(true);
    await page.locator('.brand-btn').click();
    const completed = page.waitForResponse('**/api/ai/chat/completions');
    release();
    await completed;
    await expect(page.getByRole('heading', { name: '从一张照片，认识一种物质', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '候选物质与名称确认' })).toHaveCount(0);
  });

  test('gateway errors fall back to manual search instead of a blank screen', async ({ page }) => {
    await page.route('**/api/ai/chat/completions', async (route) => route.fulfill({ status: 503, json: { error: { message: 'not configured' } } }));
    await page.goto('./');
    await uploadLabel(page);
    await page.getByRole('button', { name: '同意并继续在线识图' }).click();
    await expect(page.locator('main')).toContainText('HTTP 503');
    await expect(page.locator('#manual-substance-input')).toBeVisible();
    await expect(page.locator('main')).not.toContainText('DeepSeek 官方接口为纯文本模型');
  });
});
