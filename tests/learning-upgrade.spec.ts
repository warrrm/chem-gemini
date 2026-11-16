import { expect, Page, test } from '@playwright/test';

async function chooseSodiumHydroxide(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: '使用此样例开始学习' }).nth(1).click();
  await page.getByRole('button', { name: /氢氧化钠.*确认此物质/ }).click();
}

async function openQuiz(page: Page) {
  await chooseSodiumHydroxide(page);
  await page.locator('#formula-input').fill('NaOH');
  await page.getByRole('button', { name: '提交校验并解锁' }).click();
  await page.getByRole('button', { name: /6\..*练习/ }).click();
}

test.describe('P1 递进线索与附加计算题', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('chem_gemini_p1_online_config_v2', JSON.stringify({
      enabled: false, providerPreset: 'demo', providerMode: 'vision',
      baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-flash',
      credentialSource: 'server', apiKey: '', imageUploadConsented: false,
    })));
    await page.route('**/api/ai/**', route => route.abort());
    await page.route('https://api.deepseek.com/**', route => route.abort());
  });

  test('线索按两次错误逐步开放，空白和正确作答不提前泄露后续线索', async ({ page }) => {
    await chooseSodiumHydroxide(page);
    await expect(page.getByTestId('formula-clue-mass')).toContainText('m(Na) : m(O) : m(H) = 23 : 16 : 1');
    await expect(page.getByTestId('formula-clue-valence')).toHaveCount(0);
    await expect(page.getByTestId('formula-clue-micro')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /查看提示/ })).toHaveCount(0);
    await expect(page.getByTestId('calculation-card')).toHaveCount(0);
    await page.getByRole('button', { name: '提交校验并解锁' }).click();
    await expect(page.getByTestId('formula-clue-progress')).toContainText('1 / 3');
    await page.locator('#formula-input').fill('NaO');
    await page.getByRole('button', { name: '提交校验并解锁' }).click();
    await expect(page.getByTestId('formula-clue-valence')).toContainText('钠（Na）：+1');
    await expect(page.getByTestId('formula-clue-micro')).toHaveCount(0);
    await page.locator('#formula-input').fill('NaO2H');
    await page.getByRole('button', { name: '提交校验并解锁' }).click();
    await expect(page.getByTestId('formula-clue-micro').getByRole('img')).toBeVisible();
    await expect(page.getByTestId('formula-clue-progress')).toContainText('3 / 3');
    await page.locator('#formula-input').fill('NaOH');
    await page.getByRole('button', { name: '提交校验并解锁' }).click();
    await expect(page.getByTestId('unlocked-formula-value')).toHaveText('NaOH');
  });

  test('页面前后导航保留已开放线索，更换物质重置线索', async ({ page }) => {
    await chooseSodiumHydroxide(page);
    await page.locator('#formula-input').fill('NaO');
    await page.getByRole('button', { name: '提交校验并解锁' }).click();
    await page.getByRole('button', { name: /2\..*确认/ }).click();
    await page.getByRole('button', { name: /3\..*化学式/ }).click();
    await expect(page.getByTestId('formula-clue-valence')).toBeVisible();
    await expect(page.getByTestId('formula-clue-micro')).toHaveCount(0);
    await page.locator('.brand-btn').click();
    await page.getByRole('button', { name: '使用此样例开始学习' }).first().click();
    await page.getByRole('button', { name: /稀盐酸.*确认此物质/ }).click();
    await expect(page.getByTestId('formula-clue-progress')).toContainText('1 / 3');
    await expect(page.getByTestId('formula-clue-valence')).toHaveCount(0);
  });

  test('单质没有跨元素质量比，仍遵循同样的逐步开放顺序', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: '使用此样例开始学习' }).nth(4).click();
    await page.getByRole('button', { name: '洁净铁钉' }).click();
    await page.getByRole('button', { name: /铁（铁钉\/铁粉）.*确认此物质/ }).click();
    await expect(page.getByTestId('formula-clue-mass')).toContainText('不存在不同元素之间的质量比');
    await page.locator('#formula-input').fill('Fe2');
    await page.getByRole('button', { name: '提交校验并解锁' }).click();
    await expect(page.getByTestId('formula-clue-valence')).toContainText('铁（Fe）：0');
    await expect(page.getByTestId('formula-clue-micro')).toHaveCount(0);
  });

  test('步骤六同时提供计算题，校验数值单位后展示答案与过程', async ({ page }) => {
    await openQuiz(page);
    await expect(page.getByTestId('calculation-card')).toBeVisible();
    await expect(page.getByTestId('calculation-stem')).toContainText('相对式量');
    await expect(page.getByTestId('calculation-solution')).toHaveCount(0);
    await page.getByRole('button', { name: '提交计算答案', exact: true }).click();
    await expect(page.getByTestId('calculation-feedback')).toContainText('请输入非负数值');
    await page.locator('#calculation-answer-input').fill('40g');
    await page.getByRole('button', { name: '提交计算答案', exact: true }).click();
    await expect(page.getByTestId('calculation-feedback')).toContainText('没有单位');
    await expect(page.getByTestId('calculation-solution')).toHaveCount(0);
    await page.locator('#calculation-answer-input').fill('40');
    await page.getByRole('button', { name: '提交计算答案', exact: true }).click();
    await expect(page.getByTestId('calculation-feedback')).toContainText('计算正确');
    await expect(page.getByTestId('calculation-solution')).toContainText('23×1 + 16×1 + 1×1 = 40');
    await expect(page.getByRole('tab', { name: '单项选择题', exact: true })).toBeVisible();
  });

  test('可依次练习质量分数、元素质量及反应计算，换题清空旧答案', async ({ page }) => {
    await openQuiz(page);
    await page.getByRole('button', { name: '换一道计算题', exact: true }).click();
    await expect(page.getByTestId('calculation-stem')).toContainText('质量分数');
    await page.locator('#calculation-answer-input').fill('57.50％');
    await page.getByRole('button', { name: '提交计算答案', exact: true }).click();
    await expect(page.getByTestId('calculation-feedback')).toContainText('计算正确');
    await page.getByRole('button', { name: '换一道计算题', exact: true }).click();
    await expect(page.locator('#calculation-answer-input')).toHaveValue('');
    await expect(page.getByTestId('calculation-solution')).toHaveCount(0);
    await expect(page.getByTestId('calculation-stem')).toContainText('质量为 8 g');
    await page.locator('#calculation-answer-input').fill('4.60 g');
    await page.getByRole('button', { name: '提交计算答案', exact: true }).click();
    await expect(page.getByTestId('calculation-feedback')).toContainText('计算正确');
    await page.getByRole('button', { name: '换一道计算题', exact: true }).click();
    await expect(page.getByTestId('calculation-card')).toContainText('根据化学方程式计算');
    await expect(page.locator('.calculation-equation')).toBeVisible();
  });

  test('教师延迟揭晓模式在提交后仍隐藏计算答案和过程', async ({ page }) => {
    await openQuiz(page);
    await page.getByRole('button', { name: '设置与教师模式', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('checkbox', { name: /开启教师演示模式/ }).check();
    await dialog.getByRole('button', { name: '关闭', exact: true }).click();
    await page.locator('#calculation-answer-input').fill('40');
    await page.getByRole('button', { name: '提交计算答案', exact: true }).click();
    await expect(page.getByTestId('calculation-feedback')).toContainText('计算正确');
    await expect(page.getByTestId('calculation-solution')).toHaveCount(0);
    await page.getByRole('button', { name: '揭晓计算过程', exact: true }).click();
    await expect(page.getByTestId('calculation-solution')).toBeVisible();
  });

  test('手机宽度下线索和计算题没有横向溢出', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await chooseSodiumHydroxide(page);
    for (const wrong of ['NaO', 'NaO2H']) {
      await page.locator('#formula-input').fill(wrong);
      await page.getByRole('button', { name: '提交校验并解锁' }).click();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#formula-input').fill('NaOH');
    await page.getByRole('button', { name: '提交校验并解锁' }).click();
    await page.getByRole('button', { name: /6\..*练习/ }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});
