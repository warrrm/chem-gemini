# 化学识物小课堂 · P0 课堂展示版

[打开 P0 课堂展示版](https://warrrm.github.io/chem-gemini/) · [打开原样保留的 P1 学习版](https://warrrm.github.io/chem-gemini/p1/)

本分支 `p0-showcase` 以 `v1.3.0-p1` 为教学基线。图鉴封面可一键从石灰石样例开讲，也可以拍照、上传图片或从六张样例图版任选一张。页首的「投影大字」只调整阅读字号，不强制解锁，也不改变练习答案的揭晓时机。窄屏优先显示正在学习的内容；教师设置、教材筛选、图片授权和模型配置均保留。

**学习流程**：观察图片 → 确认名称 → 用质量比推导化学式 → 知识卡片 → 相关反应 → 随堂练习。首次及再次非空答错逐步开放化合价与微观图，答对后可回看全部线索。纯物质、溶液、混合物按不同口径表述。选择、实验、计算是三个平级题型，各自保存作答。标本封面是示意插画；教学正文与题目来自本地知识库，AI 整理、尚未经教师审校。

## 第四步：物质知识卡片

解锁后，卡片直接显示化学式、常见名称、物质类别、组成类型和概念辨析。「主要物理性质」「主要化学性质」「常见用途」「制法与来源」「典型化学方程式」默认只显示栏目标题，点击任一标题展开，再点同一标题收起；各栏目互不影响。重新进入第 4 步时恢复折叠。

49 个物质均有用途和制法或来源说明；天然标本、物理分离和溶液配制不强配生成反应。方程式从现有本地反应库按所选教材范围选录最多三条，生成示例与相应制法关联；对溶液或混合物注明反应的是溶质或主要成分。第五步继续提供反应筛选、实验现象和核心知识点。「制法与来源」只讲原理，不是操作指南。

原理参考：[OpenStax 化学（代表性金属的来源与制备）](https://openstax.org/books/chemistry-2e/pages/18-2-occurrence-and-preparation-of-the-representative-metals)、[RSC 稀溶液中回收水的蒸馏示例](https://edu.rsc.org/experiments/recovering-water-from-copperii-sulfate-solution/1768.article)、[USGS 石灰石和大理岩辨识](https://pubs.usgs.gov/gip/acidrain/4.html)。参考资料不代表本卡片已经过教师人工审校。

## 运行与测试

```bash
npm ci
npm run dev                   # http://127.0.0.1:4173/chem-gemini/
npm run validate:data && npm test
npm run build && npm run test:e2e
npm run build:pages && npm run test:pages
```

两种构建均使用 `/chem-gemini/`，但只有本地模式装配仅限本机的 Node 网关；不可用普通 `build` 代替 `build:pages` 对外发布。本地网关只读本机私有环境配置，勿复制或提交真实密钥。Pages **不含默认 Key**：样例和本地搜索不需要 Key，在线识图需自备支持浏览器跨域的接口，图片经授权才发送。自备 Key 与授权仅在当前标签页使用 **P0 独立键名**，不迁移、覆盖或清理 P1 配置。常规测试只用样例和模拟接口。

## 发布与回退

本版标签为 `v2.1.1-p0`。折叠改动前的课堂展示版 `v2.1.0-p0`（`03eb86a18d27e28fbb1164b286fd75f61696109e`）保留；它默认显示各栏正文。更早的版本和标签也不变。

本分支不单独部署；[`p1-release` 的双版本流水线](https://github.com/warrrm/chem-gemini/blob/p1-release/.github/workflows/p1-pages.yml) 固定 P0 标签和完整提交，把 P0 放在根目录、P1 放在 `p1/`。若要回退此次折叠改动，将工作流里的 `P0_TAG` 和 `P0_COMMIT` 恢复为上述 `v2.1.0-p0` 的值并重新发布。无需回退 P1 源码；可在 [发布清单](https://warrrm.github.io/chem-gemini/release-manifest.json) 核对两版。
