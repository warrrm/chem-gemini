import { expect, Page, test } from '@playwright/test';
import { join } from 'node:path';

// 图鉴与投影演示不得依赖摄像头、真实图片或任何 AI 服务。
test.beforeEach(async ({ page }) => {
  await page.route('**/api/ai/**', route => route.abort());
  await page.route('https://api.deepseek.com/**', route => route.abort());
});

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function capture(page: Page, name: string) {
  if (process.env.P0_SHOWCASE_SCREENSHOTS) {
    await page.screenshot({ path: join(process.env.P0_SHOWCASE_SCREENSHOTS, `${name}-${page.viewportSize()?.width}.png`) });
  }
}

for (const [width, height] of [[320, 740], [390, 844], [768, 1024], [1440, 900]]) {
  test(`图鉴首页、六步导航及开讲入口在 ${width}px 可用`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('./');
    await expect(page.locator('#root')).toHaveAttribute('data-app-version', 'p0');
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('从一张照片，认识一种物质');
    const nav = page.getByRole('navigation', { name: '学习步骤导航' });
    const header = page.getByRole('banner');
    await expect(header).not.toContainText(/版本适配仅供参考|尚未经教师审校/);
    const toolbar = await header.locator('.navbar-inner').boundingBox();
    expect((await nav.boundingBox())!.y - (toolbar!.y + toolbar!.height)).toBeLessThanOrEqual(2);
    await expect(nav.getByRole('button')).toHaveCount(6);
    const navRects = await nav.getByRole('button').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
    for (const r of navRects) { expect(r.x).toBeGreaterThanOrEqual(0); expect(r.right).toBeLessThanOrEqual(width); }
    const cards = page.getByRole('region', { name: '课堂样例' }).getByRole('article');
    await expect(cards).toHaveCount(6);
    await expect(page.getByText('示意插画 · 非实物照片')).toBeVisible();
    const rows = await page.locator('.samples-section, .home-layout > .ai-panel-card').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top));
    expect(rows[0]).toBeLessThan(rows[1]);
    await noHorizontalOverflow(page);
    await capture(page, 'home');
    await page.getByRole('button', { name: '从石灰石样例开始' }).click();
    await expect(page.locator('#workspace')).toBeFocused();
    await page.getByRole('button', { name: /石灰石（大理石）.*确认此物质/ }).click();
    await expect(nav.locator('[aria-current="step"]')).toHaveAccessibleName(/3\..*化学式/);
    await expect(page.locator('main')).toContainText('请写出其主要成分');
    await expect(page.locator('main')).not.toContainText('CaCO');
    const card = await page.locator('.step-card').boundingBox();
    const sidebar = await page.locator('.study-sidebar').boundingBox();
    if (width <= 800) expect(card!.y).toBeLessThan(sidebar!.y);
    await noHorizontalOverflow(page);
    await capture(page, 'formula');
    await page.locator('#formula-input').fill('CaCO3');
    await page.getByRole('button', { name: '提交校验并解锁' }).click();
    await expect(page.getByTestId('unlocked-formula-value')).toHaveText('CaCO₃');
    await page.getByRole('button', { name: /5\..*反应/ }).click();
    await noHorizontalOverflow(page);
    await page.getByRole('button', { name: /6\..*练习/ }).click();
    await expect(page.getByRole('tab')).toHaveCount(3);
    await page.getByRole('tab', { name: '计算题' }).click();
    await noHorizontalOverflow(page);
    await capture(page, 'practice');
  });
}

test('投影大字实际放大正文且不自动授予教师解锁；设置与页首开关同步', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '从石灰石样例开始' }).click();
  await page.getByRole('button', { name: /石灰石（大理石）.*确认此物质/ }).click();
  const prompt = page.locator('.target-instruction');
  const size = () => prompt.evaluate(node => parseFloat(getComputedStyle(node).fontSize));
  const before = await size();
  const toggle = page.getByRole('button', { name: '投影大字', exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(await size()).toBeGreaterThan(before);
  await expect(page.getByTestId('teacher-mode-badge')).toHaveCount(0);
  await expect(page.getByTestId('unlocked-formula-value')).toHaveCount(0);
  await page.getByRole('button', { name: /4\. 物质知识卡片/ }).click();
  await expect(page.getByRole('alert')).toContainText('先完成化学式书写');
  await page.getByRole('button', { name: '设置与教师模式' }).click();
  const modal = page.getByRole('dialog');
  const checkbox = modal.getByRole('checkbox', { name: /投影大字/ });
  await expect(checkbox).toBeChecked();
  await expect(modal.getByRole('checkbox', { name: /开启教师演示模式/ })).not.toBeChecked();
  await checkbox.uncheck();
  await modal.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(await size()).toBe(before);
});

test('教师模式不恢复页首提示条，审校说明仍可从页脚查看', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '设置与教师模式', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox', { name: /开启教师演示模式/ }).check();
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByTestId('teacher-mode-badge')).toBeVisible();
  await expect(page.getByRole('banner')).not.toContainText(/版本适配仅供参考|尚未经教师审校/);
  await page.getByRole('contentinfo').getByRole('button', { name: '关于与审校说明' }).click();
  await expect(dialog).toContainText('尚未经教师审校');
});

test('首页保留上传与拍照入口；相机不可用时能改为文件选择', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined }));
  await page.goto('./');
  const picker = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '上传图片', exact: true }).click();
  expect((await picker).isMultiple()).toBe(false);
  await page.getByRole('button', { name: '拍照识物', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('不支持直接调用摄像头');
  const fallback = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: '改用本地上传图片' }).click();
  expect((await fallback).isMultiple()).toBe(false);
  await expect(dialog).toHaveCount(0);
});
