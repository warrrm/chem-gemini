import { expect, test } from '@playwright/test';

// 在同一标签页真实跳转，不能拿两个独立预览端口来证明配置互不继承。
test('P0 和 P1 在同一站点加载各自的资源，互相跳转不沿用对方的接口、Key 或图片授权', async ({ page, baseURL }) => {
  const first = new URL(baseURL!);
  const unexpected: string[] = [];
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === first.origin && !url.pathname.includes('/api/ai/')) return route.continue();
    unexpected.push(url.origin);
    return route.abort();
  });
  await page.goto('./');
  await expect(page.locator('#root')).toHaveAttribute('data-app-version', 'p0');
  const assets = () => page.locator('script[src],link[rel="stylesheet"]').evaluateAll(tags => tags.map(node => node.getAttribute('src') ?? node.getAttribute('href')));
  expect(await assets()).toEqual([expect.stringMatching(/^\/chem-gemini\/assets\/.+\.js$/), expect.stringMatching(/^\/chem-gemini\/assets\/.+\.css$/)]);
  // 使用纯测试凭据：P1 已有自己的设置；P0 仍应没有 Key，也没有图片授权。
  await page.evaluate(() => sessionStorage.setItem('chem_gemini_p1_online_config_v2', JSON.stringify({
    enabled: true, providerPreset: 'custom', providerMode: 'vision', baseURL: 'https://example.invalid/v1',
    model: 'p1-classroom-test', credentialSource: 'session', apiKey: 'dummy-p1-only', imageUploadConsented: true,
  })));
  await page.reload();
  await expect(page.locator('#panel-ai-key')).toHaveValue('');
  await page.getByRole('button', { name: '设置与教师模式', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('checkbox', { name: /已知晓并同意/ })).not.toBeChecked();
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByTestId('ai-mode-demo').click();
  await page.getByTestId('static-hosting-notice').getByRole('link').click();
  await expect(page).toHaveURL(new URL('p1/', first).href);
  await expect(page.locator('#root')).toHaveAttribute('data-app-version', 'p1');
  expect(await assets()).toEqual([expect.stringMatching(/^\/chem-gemini\/p1\/assets\/.+\.js$/), expect.stringMatching(/^\/chem-gemini\/p1\/assets\/.+\.css$/)]);
  await expect(page.locator('#panel-ai-key')).toHaveValue('dummy-p1-only');
  await expect(page.getByTestId('run-mode-badge')).toContainText('p1-classroom-test');
  await page.getByTestId('static-hosting-notice').getByRole('link').click();
  await expect(page).toHaveURL(first.href);
  await expect(page.getByTestId('ai-mode-demo')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: '从石灰石样例开始' })).toBeVisible();
  expect(unexpected).toEqual([]);
});
