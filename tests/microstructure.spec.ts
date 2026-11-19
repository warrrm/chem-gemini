import { expect, Page, test } from '@playwright/test';
import { join } from 'node:path';
import { DEMO_SAMPLES } from '../src/data/samples';
import { ALL_SUBSTANCES, SUBSTANCE_BY_ID } from '../src/data/substances';
import { describeMicroDiagram } from '../src/modules/knowledge/microDiagram';
import { SubstanceEntry } from '../src/types/chemistry';

const sampleButton = (page: Page, index: number) => page.getByRole('button', { name: '使用此样例开始学习', exact: true }).nth(index);
const diagram = (page: Page) => page.getByTestId('formula-clue-micro').getByTestId('micro-diagram');
const testEndpoint = 'https://example.invalid/v1';
const diagramsToReview = new Set(['h2o2', 'h2so4', 'h2co3', 'h2o', 'co2', 'ch4', 'dilute_hcl', 'naoh', 'fe', 'limestone', 'cuso4_solution', 'caoh2', 'fe3o4', 'cuno32', 's', 'c']);

async function captureDiagram(page: Page, id: string) {
  const screenshots = process.env.P1_DIAGRAM_SCREENSHOTS;
  if (!screenshots || !diagramsToReview.has(id)) return;
  await diagram(page).screenshot({
    path: join(screenshots, `${id}-${page.viewportSize()?.width}.png`),
    // 截单张图时不让滚动定位触发的悬浮页头盖在图上；不修改生产页面。
    style: '.top-navbar { visibility: hidden; }',
  });
}

async function confirmAndReview(page: Page, substance: SubstanceEntry) {
  await expect(diagram(page)).toHaveCount(0);
  await page.locator('.candidate-name-btn').filter({ hasText: substance.name }).click();
  await expect(diagram(page)).toHaveCount(0);
  await page.locator('#formula-input').fill(substance.formula);
  await page.getByRole('button', { name: '提交校验并解锁' }).click();
  await expect(page.getByTestId('unlocked-formula-value')).toBeVisible();
  await page.getByRole('button', { name: /3\..*化学式/ }).click();
  await expect(diagram(page).getByRole('img')).toBeVisible();
  await expect(diagram(page)).toHaveAttribute('data-structure-type', substance.composition.structureType);
  const expected = describeMicroDiagram(substance.composition).tiles.map(({ name, count, charge, particle }) => ({
    name: name ?? '', count: count === undefined ? null : String(count), charge: charge === undefined ? null : String(charge),
    atoms: particle.atoms.map(([symbol]) => symbol),
    bonds: particle.bonds.map(([a, b, style]) => [`${a}-${b}`, style ?? 'line']),
  }));
  const actual = await diagram(page).locator('.micro-tile').evaluateAll(tiles => tiles.map(tile => ({
    name: tile.querySelector('.micro-tile-caption span')?.textContent ?? '',
    count: tile.getAttribute('data-particle-count'),
    charge: tile.querySelector('[data-micro-charge]')?.getAttribute('data-micro-charge') ?? null,
    atoms: Array.from(tile.querySelectorAll('[data-micro-atom]'), atom => atom.getAttribute('data-micro-atom')),
    bonds: Array.from(tile.querySelectorAll('[data-micro-bond]'), bond => [bond.getAttribute('data-micro-bond'), bond.getAttribute('data-bond-style')]),
  })));
  expect(actual, substance.id).toEqual(expected);
  const clipped = await diagram(page).locator('svg').evaluateAll(svgs => svgs.some(element => {
    const svg = element as SVGSVGElement;
    const view = svg.viewBox.baseVal;
    const box = svg.getBBox();
    return !box.width || !box.height || box.x < view.x || box.y < view.y
      || box.x + box.width > view.x + view.width || box.y + box.height > view.y + view.height;
  }));
  expect(clipped, `${substance.id} SVG 图形超出视口`).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${substance.id} 页面横向溢出`).toBe(true);
  await captureDiagram(page, substance.id);
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/ai/**', route => route.abort());
  await page.route('https://api.deepseek.com/**', route => route.abort());
});

test.describe('内置演示样例的微观图', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('chem_gemini_p1_online_config_v2', JSON.stringify({
      enabled: false, providerPreset: 'demo', providerMode: 'vision', baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-flash',
      credentialSource: 'session', apiKey: '', imageUploadConsented: false,
    })));
    await page.setViewportSize({ width: 390, height: 844 });
  });

  for (const [index, sample] of DEMO_SAMPLES.entries()) {
    test(`${sample.title}：展示正确的微粒，或保持原有确认和范围限制`, async ({ page }) => {
      if (sample.candidates.length) {
        for (const { substanceId } of sample.candidates) {
          await page.goto('./');
          await sampleButton(page, index).click();
          await confirmAndReview(page, SUBSTANCE_BY_ID.get(substanceId)!);
        }
      } else if (sample.hotspots?.length) {
        for (const hotspot of sample.hotspots) {
          await page.goto('./');
          await sampleButton(page, index).click();
          await page.getByRole('button', { name: hotspot.label, exact: true }).click();
          if (hotspot.isApparatus) {
            await expect(page.getByRole('alert')).toContainText('烧杯是仪器');
            await expect(diagram(page)).toHaveCount(0);
          } else await confirmAndReview(page, SUBSTANCE_BY_ID.get(hotspot.substanceId!)!);
        }
      } else {
        await page.goto('./');
        await sampleButton(page, index).click();
        await expect(page.locator('main')).toContainText(sample.statusMessage!);
        await expect(diagram(page)).toHaveCount(0);
        if (sample.recognitionStatus === 'ambiguous') {
          await page.locator('#manual-substance-input').fill('水');
          await page.getByRole('button', { name: '搜索名称', exact: true }).click();
          await confirmAndReview(page, SUBSTANCE_BY_ID.get('h2o')!);
        }
      }
    });
  }
});

// 对全库通过真实网页上传入口验证路由和渲染，模型只提供本地 ID，绝不请求真实付费服务。
const batchSize = 7;
for (let i = 0; i < ALL_SUBSTANCES.length; i += batchSize) {
  const batch = ALL_SUBSTANCES.slice(i, i + batchSize);
  test(`模拟识图后检查微观图、键连、电荷和可见范围（第 ${i / batchSize + 1} 组）`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.addInitScript(({ baseURL }) => sessionStorage.setItem('chem_gemini_p1_online_config_v2', JSON.stringify({
      enabled: true, providerPreset: 'custom', providerMode: 'vision', baseURL, model: 'mock-vision',
      credentialSource: 'session', apiKey: 'dummy-test-key-not-real', imageUploadConsented: false,
    })), { baseURL: testEndpoint });
    await page.setViewportSize({ width: (i / batchSize) % 2 ? 390 : 1280, height: 900 });
    let activeId = batch[0].id;
    let imageRequests = 0;
    await page.route(`${testEndpoint}/chat/completions`, async route => {
      const body = route.request().postDataJSON();
      if (Array.isArray(body?.messages?.[1]?.content)) imageRequests++;
      await route.fulfill({ json: { choices: [{ message: { content: JSON.stringify({
        status: 'ok', candidates: [{ substanceId: activeId, formula: '不应使用模型的化学式', composition: '不应使用模型的结构' }],
      }) } }] } });
    });
    for (const substance of batch) {
      await test.step(substance.name, async () => {
        activeId = substance.id;
        await page.goto('./');
        const base64 = await page.evaluate(label => {
          const canvas = document.createElement('canvas');
          canvas.width = 320; canvas.height = 160;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 320, 160);
          ctx.fillStyle = '#000'; ctx.font = '24px sans-serif'; ctx.fillText(label, 14, 88, 292);
          return canvas.toDataURL().split(',')[1];
        }, substance.name);
        await page.getByTestId('image-file-input').setInputFiles({ name: 'test-label.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') });
        await page.getByRole('button', { name: '同意并继续在线识图' }).click();
        await expect(page.locator('.candidate-name-btn')).toHaveCount(1);
        await confirmAndReview(page, substance);
        await expect(page.locator('main')).not.toContainText('不应使用模型的结构');
        if (substance.id === 'h2o2') {
          const viewport = page.viewportSize()!;
          const width = viewport.width === 390 ? 1280 : 390;
          await page.setViewportSize({ ...viewport, width });
          await diagram(page).scrollIntoViewIfNeeded();
          await expect(diagram(page)).toBeInViewport();
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          await captureDiagram(page, substance.id);
          await page.setViewportSize(viewport);
        }
      });
    }
    expect(imageRequests).toBe(batch.length);
  });
}
