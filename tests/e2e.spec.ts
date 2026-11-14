import { expect, test } from '@playwright/test';

test.describe('化学识物小课堂 — 5 大必测验收场景 (Section 11)', () => {
  // 经典场景只验证本地教学流程，不调用真实付费 API。
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('chem_gemini_p1_online_config_v2', JSON.stringify({
      enabled: false, providerPreset: 'demo', providerMode: 'text_assist',
      baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-flash',
      credentialSource: 'server', apiKey: '', imageUploadConsented: false,
    })));
  });
  test('场景 1：有清晰标签的物质（稀盐酸溶液 & 氢氧化钠纯净物）防剧透与解锁全流程', async ({ page }) => {
    await page.goto('./');

    await page.getByRole('button', { name: '使用此样例开始学习' }).first().click();

    await expect(page.getByRole('heading', { name: '候选物质与名称确认' })).toBeVisible();
    const pageBodyStep2 = await page.locator('main').innerText();
    expect(pageBodyStep2).not.toContain('HCl');

    await page.getByRole('button', { name: /4\. 物质知识卡片/ }).click();
    await expect(page.getByRole('alert')).toContainText('先完成化学式书写');

    await page.getByRole('button', { name: /稀盐酸.*确认此物质/ }).click();

    await expect(page.getByRole('heading', { name: '推导并书写化学式' })).toBeVisible();
    await expect(page.locator('main')).toContainText('稀盐酸属于溶液（混合物），请写出其溶质「氯化氢」的化学式');

    await page.locator('#formula-input').fill('hcl');
    await page.getByRole('button', { name: '提交校验并解锁' }).click();
    await expect(page.getByTestId('formula-feedback')).toContainText('大小写不规范');

    await page.locator('#formula-input').fill('HCl');
    await page.getByRole('button', { name: '提交校验并解锁' }).click();

    await expect(page.getByRole('heading', { name: '稀盐酸' })).toBeVisible();
    await expect(page.getByTestId('unlocked-formula-value')).toHaveText('HCl');

    await page.getByRole('button', { name: /下一步：查看相关化学反应方程式/ }).click();
    await expect(page.getByRole('heading', { name: '相关化学反应方程式' })).toBeVisible();

    await page.getByRole('button', { name: /下一步：完成随堂练习题/ }).click();
    await expect(page.getByTestId('mcq-feedback-box')).toHaveCount(0);
    await page.getByRole('radio').nth(2).click();
    await page.getByRole('button', { name: '提交答案' }).click();
    await expect(page.getByTestId('mcq-feedback-box')).toBeVisible();
  });

  test('场景 2：无标签澄清无色液体，提示无法确定并提供手动输入入口', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: '使用此样例开始学习' }).nth(2).click();

    await expect(page.locator('main')).toContainText('仅凭图片无法确定，请补充标签或名称');
    await page.getByRole('button', { name: /4\. 物质知识卡片/ }).click();
    await expect(page.getByRole('alert')).toContainText('先完成化学式书写');

    await page.locator('#manual-substance-input').fill('水');
    await page.getByRole('button', { name: '搜索名称' }).click();
    await page.getByRole('button', { name: /水（蒸馏水\/纯水）.*确认此物质/ }).click();

    await page.getByRole('tab', { name: '线索二：元素质量比' }).click();
    await expect(page.locator('main')).toContainText('m(H) : m(O) = 1 : 8');

    await page.locator('#formula-input').fill('H2O');
    await page.getByRole('button', { name: '提交校验并解锁' }).click();
    await expect(page.getByTestId('unlocked-formula-value')).toHaveText('H₂O');
  });

  test('场景 3：石灰石混合物，区分物体与主要成分碳酸钙 CaCO3', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: '使用此样例开始学习' }).nth(3).click();

    await page.getByRole('button', { name: /石灰石（大理石）.*确认此物质/ }).click();
    await expect(page.locator('main')).toContainText('石灰石（大理石）属于混合物，请写出其主要成分「碳酸钙」的化学式');

    await page.locator('#formula-input').fill('CaCO3');
    await page.getByRole('button', { name: '提交校验并解锁' }).click();

    await expect(page.locator('main')).toContainText('物体：石灰石（大理石）（混合物，无统一化学式）');
    await expect(page.getByTestId('unlocked-formula-value')).toHaveText('CaCO₃');
  });

  test('场景 4：实验桌多物体图片，点烧杯提示仪器不是物质，点铁钉进入流程', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: '使用此样例开始学习' }).nth(4).click();

    await page.getByRole('button', { name: '玻璃烧杯' }).click();
    await expect(page.getByRole('alert')).toContainText('烧杯是仪器，不是物质，请选择铁钉或硫酸铜溶液');

    await page.getByRole('button', { name: '洁净铁钉' }).click();
    await page.getByRole('button', { name: /铁（铁钉\/铁粉）.*确认此物质/ }).click();

    await page.locator('#formula-input').fill('Fe');
    await page.getByRole('button', { name: '提交校验并解锁' }).click();
    await expect(page.getByTestId('unlocked-formula-value')).toHaveText('Fe');
  });

  test('场景 5：苯酚（初中教材范围外物质），提示暂不在当前学习范围内', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: '使用此样例开始学习' }).nth(5).click();

    await expect(page.locator('main')).toContainText('暂不在当前学习范围内');
    await expect(page.getByRole('button', { name: '重新上传' })).toBeVisible();
    await expect(page.locator('#manual-substance-input')).toBeVisible();
  });
});
