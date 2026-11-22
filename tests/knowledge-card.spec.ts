import { expect, type Page, test } from '@playwright/test';
import { join } from 'node:path';

const sectionTitles = ['主要物理性质', '主要化学性质', '常见用途', '制法与来源', '典型化学方程式'] as const;
type SectionTitle = typeof sectionTitles[number];
const card = (page: Page) => page.locator('section[aria-labelledby="step4-title"]');
const toggle = (page: Page, name: SectionTitle) => card(page).getByRole('button', { name, exact: true });
const panel = (page: Page, name: SectionTitle) => card(page).getByRole('region', { name, exact: true });
const equations = (page: Page) => panel(page, '典型化学方程式');

async function expectCollapsedCard(page: Page) {
  for (const title of sectionTitles) {
    await expect(toggle(page, title)).toBeVisible();
    await expect(toggle(page, title)).toHaveAttribute('aria-expanded', 'false');
    await expect(panel(page, title)).toHaveCount(0);
  }
  await expect(card(page).locator('.knowledge-disclosure-body:visible')).toHaveCount(0);
}

async function openPanel(page: Page, title: SectionTitle) {
  const button = toggle(page, title);
  await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  const content = panel(page, title);
  await expect(content).toBeVisible();
  const controls = await button.getAttribute('aria-controls');
  expect(controls).toBeTruthy();
  await expect(content).toHaveAttribute('id', controls!);
  return content;
}

async function selectSample(page: Page, name: RegExp) {
  await page.locator('.sample-card').filter({ has: page.getByRole('heading', { name }) })
    .getByRole('button', { name: '使用此样例开始学习' }).click();
}

async function unlockCard(page: Page, candidate: RegExp, formula: string) {
  await page.getByRole('button', { name: candidate }).click();
  await expect(card(page)).toHaveCount(0);
  await page.locator('#formula-input').fill(formula);
  await page.getByRole('button', { name: '提交校验并解锁' }).click();
  await expect(page.getByTestId('unlocked-formula-value')).toBeVisible();
  await expectCollapsedCard(page);
}

async function assertNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await equations(page).locator('.equation-scroll-box').evaluateAll(boxes => boxes.every(box => box.scrollWidth <= box.clientWidth + 1))).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('chem_gemini_p0_online_config_v2', JSON.stringify({
    enabled: false, providerPreset: 'demo', providerMode: 'vision', baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-flash',
    credentialSource: 'session', apiKey: '', imageUploadConsented: false,
  })));
  await page.route('**/api/ai/**', route => route.abort());
  await page.route('https://api.deepseek.com/**', route => route.abort());
  await page.goto('./');
});

test('五个栏目的正文默认隐藏，点击分别展开或收起，基础资料仍可见', async ({ page }) => {
  await selectSample(page, /贴“氢氧化钠”/);
  await unlockCard(page, /氢氧化钠.*确认此物质/, 'NaOH');
  await expect(card(page).getByRole('heading', { name: '核心概念辨析' })).toBeVisible();
  const snippets = ['白色固体', '无色酚酞变红', '制肥皂', '电解食盐水', '生成示例'];
  for (const [index, title] of sectionTitles.entries()) {
    await expect(await openPanel(page, title)).toContainText(snippets[index]);
  }
  for (const title of sectionTitles) await expect(panel(page, title)).toBeVisible();
  await toggle(page, '主要化学性质').click();
  await expect(toggle(page, '主要化学性质')).toHaveAttribute('aria-expanded', 'false');
  await expect(panel(page, '主要化学性质')).toHaveCount(0);
  for (const title of sectionTitles.filter(title => title !== '主要化学性质')) {
    await expect(panel(page, title)).toBeVisible();
  }
});

test('栏目支持键盘独立开合，从第五步回到卡片时全部恢复折叠', async ({ page }) => {
  await page.getByRole('button', { name: '从石灰石样例开始' }).click();
  await unlockCard(page, /石灰石（大理石）.*确认此物质/, 'CaCO3');
  const physical = toggle(page, '主要物理性质');
  const chemical = toggle(page, '主要化学性质');
  await physical.focus();
  await page.keyboard.press('Enter');
  await expect(panel(page, '主要物理性质')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(chemical).toBeFocused();
  await page.keyboard.press('Space');
  await expect(panel(page, '主要化学性质')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(chemical).toHaveAttribute('aria-expanded', 'false');
  await expect(panel(page, '主要化学性质')).toHaveCount(0);
  await expect(panel(page, '主要物理性质')).toBeVisible();
  await page.getByRole('button', { name: /下一步：查看相关化学反应方程式/ }).click();
  await expect(card(page)).toHaveCount(0);
  await page.getByRole('button', { name: /4\. 物质知识卡片/ }).click();
  await expectCollapsedCard(page);
});

test('石灰石展开后显示用途、天然来源和主要成分方程式，第五步仍可查看详情', async ({ page }) => {
  await page.getByRole('button', { name: '从石灰石样例开始' }).click();
  await unlockCard(page, /石灰石（大理石）.*确认此物质/, 'CaCO3');
  await expect(await openPanel(page, '常见用途')).toContainText('建筑装饰材料与水泥制造原料');
  const preparation = await openPanel(page, '制法与来源');
  await expect(preparation).toContainText('天然来源');
  await expect(preparation).toContainText('石灰石是天然沉积岩');
  await expect(await openPanel(page, '典型化学方程式')).toContainText('主要成分「碳酸钙」');
  await expect(equations(page).locator('[data-reaction-id="rxn_caco3_hcl"] .equation-scroll-box'))
    .toHaveAttribute('aria-label', /CaCO₃ \+ 2HCl.*CO₂↑/);
  await expect(equations(page).locator('[data-reaction-id="rxn_co2_caoh2"]')).toHaveCount(0);
  await page.getByRole('button', { name: /下一步：查看相关化学反应方程式/ }).click();
  await expect(page.getByRole('heading', { name: '相关化学反应方程式' })).toBeVisible();
  await page.getByRole('group', { name: '按反应角色筛选' }).getByRole('button', { name: /作为反应物/ }).click();
  await expect(page.locator('main')).toContainText('实验现象');
});

for (const width of [320, 1440]) {
  test(`氢氧化钠的制法及已配平方程式在 ${width}px 和投影大字下可读`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await selectSample(page, /贴“氢氧化钠”/);
    await unlockCard(page, /氢氧化钠.*确认此物质/, 'NaOH');
    const screenshot = async (state: string) => {
      if (!process.env.P0_CARD_SCREENSHOTS) return;
      await page.locator('.knowledge-detail-list').screenshot({
        path: join(process.env.P0_CARD_SCREENSHOTS, `naoh-${state}-${width}.png`),
        style: '.top-navbar, .skip-to-content { visibility: hidden; }',
      });
    };
    await assertNoHorizontalOverflow(page);
    await screenshot('collapsed');
    await expect(await openPanel(page, '常见用途')).toContainText('制肥皂');
    await expect(await openPanel(page, '制法与来源')).toContainText('电解食盐水');
    const equation = (await openPanel(page, '典型化学方程式')).getByRole('article').first();
    await expect(equation).toHaveAttribute('data-reaction-id', 'rxn_na2co3_caoh2');
    await expect(equation).toContainText('生成示例');
    await expect(equation.locator('.equation-scroll-box')).toHaveAttribute('aria-label', /Na₂CO₃ \+ Ca\(OH\)₂.*CaCO₃↓ \+ 2NaOH/);
    await assertNoHorizontalOverflow(page);
    const line = equation.locator('.equation-line');
    const physical = toggle(page, '主要物理性质');
    const fontSize = (element: typeof line) => element.evaluate(node => parseFloat(getComputedStyle(node).fontSize));
    const [lineSize, titleSize] = await Promise.all([fontSize(line), fontSize(physical)]);
    await page.getByRole('button', { name: '投影大字', exact: true }).click();
    expect(await fontSize(line)).toBeGreaterThan(lineSize);
    expect(await fontSize(physical)).toBeGreaterThan(titleSize);
    await expect(physical).toHaveAttribute('aria-expanded', 'false');
    await expect(panel(page, '主要物理性质')).toHaveCount(0);
    await assertNoHorizontalOverflow(page);
    await screenshot('projector');
  });
}

test('氧气优先展示制取方程式，催化条件和气体符号清楚可见', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await selectSample(page, /无标签的澄清无色液体/);
  await unlockCard(page, /^氧气$/, 'O2');
  await expect(await openPanel(page, '制法与来源')).toContainText('分离提纯');
  const reaction = (await openPanel(page, '典型化学方程式')).getByRole('article').first();
  await expect(reaction).toHaveAttribute('data-reaction-id', 'rxn_h2o2_decomp');
  await expect(reaction).toContainText('实验室制取');
  await expect(reaction.getByRole('math', { name: /2H₂O₂.*MnO2.*2H₂O \+ O₂↑/ })).toBeVisible();
  await expect(reaction.locator('.eq-condition')).toHaveText('MnO₂');
  await expect(reaction.locator('.eq-mark')).toHaveText('↑');
  await assertNoHorizontalOverflow(page);
});

test('稀盐酸和硫酸铜溶液分别说明配制方法，不把溶液误作纯物质', async ({ page }) => {
  await selectSample(page, /贴“稀盐酸”/);
  await unlockCard(page, /稀盐酸.*确认此物质/, 'HCl');
  await expect(await openPanel(page, '制法与来源')).toContainText('只改变浓度');
  await expect(await openPanel(page, '典型化学方程式')).toContainText('溶质「氯化氢」参与的反应');
  await expect(equations(page)).not.toContainText('作为生成物');
  await page.locator('.brand-btn').click();
  await selectSample(page, /实验桌多物体/);
  await page.getByRole('button', { name: '蓝色硫酸铜溶液', exact: true }).click();
  await unlockCard(page, /硫酸铜溶液.*确认此物质/, 'CuSO4');
  await expect(await openPanel(page, '制法与来源')).toContainText('硫酸铜溶于水形成蓝色溶液');
  await expect(await openPanel(page, '典型化学方程式')).toContainText('溶质「硫酸铜」');
  await expect(equations(page)).not.toContainText('作为生成物');
});

test('切换教材时方程式按范围更新，缺项不冒用其他版反应', async ({ page }) => {
  await selectSample(page, /无标签的澄清无色液体/);
  await page.locator('#manual-substance-input').fill('氯化镁');
  await page.getByRole('button', { name: '搜索名称', exact: true }).click();
  await unlockCard(page, /^氯化镁.*确认此物质/, 'MgCl2');
  await expect((await openPanel(page, '典型化学方程式')).locator('[data-reaction-id="rxn_mg_hcl"]')).toBeVisible();
  await page.locator('#edition-select').selectOption('沪教版');
  await expect(equations(page)).toContainText('「沪教版」范围内暂无匹配反应');
  await expect(equations(page).getByRole('article')).toHaveCount(0);
  await expect(toggle(page, '制法与来源')).toHaveAttribute('aria-expanded', 'false');
  await expect(await openPanel(page, '制法与来源')).toContainText('生成氯化镁溶液');
  await page.locator('#edition-select').selectOption('人教版');
  await expect(equations(page).locator('[data-reaction-id="rxn_mg_hcl"]')).toBeVisible();
});
