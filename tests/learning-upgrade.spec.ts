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

test.describe('P0 递进线索与三类并列练习', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('chem_gemini_p0_online_config_v2', JSON.stringify({
      enabled: false, providerPreset: 'demo', providerMode: 'vision',
      baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-flash',
      credentialSource: 'server', apiKey: '', imageUploadConsented: false,
    })));
    await page.route('**/api/ai/**', route => route.abort());
    await page.route('https://api.deepseek.com/**', route => route.abort());
  });

  test('答对前按两次错误逐步开放线索，空白提交不推进', async ({ page }) => {
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

  for (const hasWrongAttempt of [false, true]) {
    test(`${hasWrongAttempt ? '首次答错后纠正' : '第一次就答对'}均开放全部线索，返回查看时不再锁住`, async ({ page }) => {
      await chooseSodiumHydroxide(page);
      if (hasWrongAttempt) {
        await page.locator('#formula-input').fill('NaO');
        await page.getByRole('button', { name: '提交校验并解锁' }).click();
      }
      await page.locator('#formula-input').fill('NaOH');
      await page.getByRole('button', { name: '提交校验并解锁' }).click();
      await expect(page.getByTestId('unlocked-formula-value')).toHaveText('NaOH');
      await page.getByRole('button', { name: /3\..*化学式/ }).click();
      await expect(page.getByTestId('formula-clue-progress')).toContainText('3 / 3');
      await expect(page.getByTestId('formula-clue-valence')).toBeVisible();
      await expect(page.getByTestId('formula-clue-micro').getByRole('img')).toBeVisible();
      await expect(page.getByTestId('formula-clue-valence-locked')).toHaveCount(0);
      await expect(page.getByTestId('formula-clue-micro-locked')).toHaveCount(0);
      await page.getByRole('button', { name: /查看已解锁的知识卡片/ }).click();
      await page.getByRole('button', { name: /3\..*化学式/ }).click();
      await expect(page.getByTestId('formula-clue-progress')).toContainText('3 / 3');
    });
  }

  test('步骤六计算题与另两种题型并列，校验数值单位后展示答案和过程', async ({ page }) => {
    await openQuiz(page);
    await expect(page.getByRole('tablist', { name: '选择题型' }).getByRole('tab')).toHaveText(['单项选择题', '实验探究题', '计算题']);
    await expect(page.getByTestId('calculation-card')).toBeHidden();
    await page.getByRole('tab', { name: '计算题', exact: true }).click();
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
    await expect(page.getByRole('tabpanel', { name: '计算题' }).getByTestId('calculation-card')).toBeVisible();
    await expect(page.getByTestId('quiz-question-position')).toContainText('1 / 4');
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
    await page.getByRole('tab', { name: '计算题', exact: true }).click();
    const next = page.getByRole('button', { name: '换一道题', exact: true });
    await next.click();
    await expect(page.getByTestId('quiz-question-position')).toContainText('2 / 4');
    await expect(page.getByTestId('calculation-stem')).toContainText('质量分数');
    await page.locator('#calculation-answer-input').fill('57.50％');
    await page.getByRole('button', { name: '提交计算答案', exact: true }).click();
    await expect(page.getByTestId('calculation-feedback')).toContainText('计算正确');
    await next.click();
    await expect(page.locator('#calculation-answer-input')).toHaveValue('');
    await expect(page.getByTestId('calculation-solution')).toHaveCount(0);
    await expect(page.getByTestId('calculation-stem')).toContainText('质量为 8 g');
    await page.locator('#calculation-answer-input').fill('4.60 g');
    await page.getByRole('button', { name: '提交计算答案', exact: true }).click();
    await expect(page.getByTestId('calculation-feedback')).toContainText('计算正确');
    await next.click();
    await expect(page.getByTestId('calculation-card')).toContainText('根据化学方程式计算');
    await expect(page.locator('.calculation-equation')).toBeVisible();
  });

  test('教师延迟揭晓模式在提交后仍隐藏计算答案和过程', async ({ page }) => {
    await openQuiz(page);
    await page.getByRole('tab', { name: '计算题', exact: true }).click();
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

  test('实验题显示题干、装置和作答区，提交后可揭晓并正常换题', async ({ page }) => {
    await openQuiz(page);
    await page.getByRole('tab', { name: '实验探究题', exact: true }).click();
    await expect(page.getByTestId('inquiry-question')).toHaveAttribute('data-question-id', 'inq_naoh_1');
    await expect(page.getByTestId('inquiry-scope-note')).toContainText('本物质探究题');
    await expect(page.getByTestId('quiz-question-position')).toContainText('1 / 7');
    await expect(page.getByRole('tabpanel', { name: '实验探究题' }).getByRole('img')).toBeVisible();
    await expect(page.locator('.subq-textarea')).toHaveCount(2);
    await expect(page.getByTestId('inquiry-reveal-0')).toHaveCount(0);
    await page.locator('.subq-textarea').first().fill('我的实验分析');
    await page.getByRole('button', { name: '提交作答并查看参考答案', exact: true }).click();
    await expect(page.getByTestId('inquiry-reveal-0')).toContainText('评分要点');
    await expect(page.locator('.subq-textarea').first()).toBeDisabled();
    await page.getByRole('button', { name: '换一道题', exact: true }).click();
    await expect(page.getByTestId('inquiry-question')).not.toHaveAttribute('data-question-id', 'inq_naoh_1');
    await expect(page.getByTestId('quiz-question-position')).toContainText('2 / 7');
    await expect(page.getByTestId('inquiry-scope-note')).toContainText('关联反应探究题');
    await expect(page.locator('.subq-textarea').first()).toHaveValue('');
    await expect(page.locator('.subq-textarea').first()).toBeEnabled();
    await expect(page.getByTestId('inquiry-reveal-0')).toHaveCount(0);
    await expect(page.getByTestId('calculation-card')).toBeHidden();
  });

  test('实验题连续换题遍历全部七道后循环，不重复上一题并清空旧作答', async ({ page }) => {
    await openQuiz(page);
    await page.getByRole('tab', { name: '实验探究题', exact: true }).click();
    const ids = new Set<string>();
    const scopes = new Set<string>();
    for (let index = 0; index < 7; index++) {
      const id = (await page.getByTestId('inquiry-question').getAttribute('data-question-id'))!;
      expect(ids.has(id)).toBe(false);
      ids.add(id);
      scopes.add((await page.getByTestId('inquiry-scope-note').innerText()).split('：')[0]);
      await page.locator('.subq-textarea').first().fill(`第 ${index + 1} 道作答`);
      await page.getByRole('button', { name: '换一道题', exact: true }).click();
      await expect(page.getByTestId('inquiry-question')).not.toHaveAttribute('data-question-id', id);
      await expect(page.locator('.subq-textarea').first()).toHaveValue('');
    }
    expect(ids.size).toBe(7);
    expect(scopes).toEqual(new Set(['本物质探究题', '关联反应探究题', '同教材综合探究题']));
    await expect(page.getByTestId('inquiry-question')).toHaveAttribute('data-question-id', 'inq_naoh_1');
    await expect(page.getByTestId('quiz-question-position')).toContainText('1 / 7');
  });

  for (const target of [
    { query: '水', formula: 'H2O', candidate: /水（蒸馏水\/纯水）.*确认此物质/, scope: '关联反应探究题' },
    { query: '银', formula: 'Ag', candidate: /^银.*确认此物质/, scope: '同教材综合探究题' },
  ]) {
    test(`原来没有专属实验题的${target.query}也可显示和更换实验题，并说明关联范围`, async ({ page }) => {
      await page.goto('./');
      await page.getByRole('button', { name: '使用此样例开始学习' }).nth(2).click();
      await page.locator('#manual-substance-input').fill(target.query);
      await page.getByRole('button', { name: '搜索名称', exact: true }).click();
      await page.getByRole('button', { name: target.candidate }).click();
      await page.locator('#formula-input').fill(target.formula);
      await page.getByRole('button', { name: '提交校验并解锁' }).click();
      await page.getByRole('button', { name: /6\..*练习/ }).click();
      await expect(page.getByRole('tab', { name: '实验探究题', exact: true })).toBeEnabled();
      await page.getByRole('tab', { name: '实验探究题', exact: true }).click();
      await expect(page.getByTestId('inquiry-question')).toBeVisible();
      await expect(page.getByTestId('inquiry-scope-note')).toContainText(target.scope);
      const first = await page.getByTestId('inquiry-question').getAttribute('data-question-id');
      await page.getByRole('button', { name: '换一道题', exact: true }).click();
      await expect(page.getByTestId('inquiry-question')).not.toHaveAttribute('data-question-id', first!);
    });
  }

  test('教师模式在实验题提交后延迟揭晓，换题后清除揭晓状态', async ({ page }) => {
    await openQuiz(page);
    await page.getByRole('tab', { name: '实验探究题', exact: true }).click();
    await page.getByRole('button', { name: '设置与教师模式', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('checkbox', { name: /开启教师演示模式/ }).check();
    await dialog.getByRole('button', { name: '关闭', exact: true }).click();
    await page.locator('.subq-textarea').first().fill('课堂讨论后的实验分析');
    await page.getByRole('button', { name: '提交作答并查看参考答案', exact: true }).click();
    await expect(page.getByTestId('inquiry-reveal-0')).toHaveCount(0);
    await page.getByRole('button', { name: '揭晓参考答案与评分要点', exact: true }).click();
    await expect(page.getByTestId('inquiry-reveal-0')).toBeVisible();
    await page.getByRole('button', { name: '换一道题', exact: true }).click();
    await expect(page.getByTestId('inquiry-reveal-0')).toHaveCount(0);
    await expect(page.locator('.subq-textarea').first()).toBeEnabled();
  });

  test('切换题型分别保留作答，实验题换题不改动选择题或计算题', async ({ page }) => {
    await openQuiz(page);
    await page.getByRole('radio').first().click();
    await page.getByRole('tab', { name: '计算题', exact: true }).click();
    await page.locator('#calculation-answer-input').fill('40');
    await page.getByRole('tab', { name: '实验探究题', exact: true }).click();
    await page.locator('.subq-textarea').first().fill('保留的实验作答');
    await page.getByRole('tab', { name: '单项选择题', exact: true }).click();
    await expect(page.getByRole('radio').first()).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('tab', { name: '实验探究题', exact: true }).click();
    await expect(page.locator('.subq-textarea').first()).toHaveValue('保留的实验作答');
    await page.getByRole('button', { name: '换一道题', exact: true }).click();
    await expect(page.locator('.subq-textarea').first()).toHaveValue('');
    await page.getByRole('tab', { name: '计算题', exact: true }).click();
    await expect(page.locator('#calculation-answer-input')).toHaveValue('40');
    await page.getByRole('tab', { name: '单项选择题', exact: true }).click();
    await expect(page.getByRole('radio').first()).toHaveAttribute('aria-checked', 'true');
  });

  test('切换教材或换物质时重置实验题位置和作答，避免旧题残留', async ({ page }) => {
    await openQuiz(page);
    await page.getByRole('tab', { name: '实验探究题', exact: true }).click();
    await page.getByRole('button', { name: '换一道题', exact: true }).click();
    await page.locator('.subq-textarea').first().fill('不应带到新教材的内容');
    await page.locator('#edition-select').selectOption('人教版');
    await expect(page.getByRole('tab', { name: '单项选择题', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: '实验探究题', exact: true }).click();
    await expect(page.getByTestId('quiz-question-position')).toContainText('1 / 7');
    await expect(page.locator('.subq-textarea').first()).toHaveValue('');
    await page.locator('.subq-textarea').first().fill('不应带到新物质的内容');
    await page.locator('.brand-btn').click();
    await page.getByRole('button', { name: '使用此样例开始学习' }).first().click();
    await page.getByRole('button', { name: /稀盐酸.*确认此物质/ }).click();
    await page.locator('#formula-input').fill('HCl');
    await page.getByRole('button', { name: '提交校验并解锁' }).click();
    await page.getByRole('button', { name: /6\..*练习/ }).click();
    await page.getByRole('tab', { name: '实验探究题', exact: true }).click();
    await expect(page.getByTestId('inquiry-question')).toHaveAttribute('data-question-id', 'inq_dilute_hcl_1');
    await expect(page.locator('.subq-textarea').first()).toHaveValue('');
    await expect(page.getByTestId('inquiry-reveal-0')).toHaveCount(0);
  });

  test('三个题型均在题目最末显示同一个学科网链接，支持键盘切换', async ({ page }) => {
    await openQuiz(page);
    const tabs = page.getByRole('tablist', { name: '选择题型' }).getByRole('tab');
    const footer = page.getByTestId('quiz-resource-footer');
    const link = footer.getByRole('link', { name: 'https://www.zxxk.com/' });
    for (const [index, name] of ['单项选择题', '实验探究题', '计算题'].entries()) {
      if (index === 0) await tabs.first().focus(); else await tabs.nth(index - 1).press('ArrowRight');
      await expect(tabs.nth(index)).toBeFocused();
      await expect(tabs.nth(index)).toHaveAttribute('aria-selected', 'true');
      const panel = page.getByRole('tabpanel', { name, exact: true });
      await expect(panel).toBeVisible();
      await expect(link).toHaveAttribute('href', 'https://www.zxxk.com/');
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      const panelRect = (await panel.boundingBox())!;
      expect((await footer.boundingBox())!.y).toBeGreaterThanOrEqual(panelRect.y + panelRect.height);
    }
    await tabs.last().press('Home');
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  });

  test('手机宽度下线索、实验题和计算题均可使用且没有横向溢出', async ({ page }) => {
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
    await page.getByRole('tab', { name: '实验探究题', exact: true }).click();
    await expect(page.getByTestId('inquiry-question')).toBeVisible();
    await page.getByRole('button', { name: '换一道题', exact: true }).click();
    await expect(page.getByTestId('quiz-question-position')).toContainText('2 / 7');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('tab', { name: '计算题', exact: true }).click();
    await expect(page.getByTestId('calculation-card')).toBeVisible();
    await expect(page.getByTestId('quiz-resource-footer').getByRole('link')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});
