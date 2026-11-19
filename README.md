# 化学识物小课堂 · P0 课堂展示版

[打开 P0 课堂展示版](https://warrrm.github.io/chem-gemini/) · [打开原样保留的 P1 学习版](https://warrrm.github.io/chem-gemini/p1/)

本分支 `p0-showcase` 以 `v1.3.0-p1` 为教学基线。图鉴封面可一键从石灰石样例开讲，也可以拍照、上传图片或从六张样例图版任选一张。页首的「投影大字」只调整阅读字号，不强制解锁，也不改变练习答案的揭晓时机。窄屏优先显示正在学习的内容；教师设置、教材筛选、图片授权和模型配置均保留。

**学习流程**：观察图片 → 确认名称 → 用质量比推导化学式 → 知识卡片 → 相关反应 → 随堂练习。首次及再次非空答错逐步开放化合价与微观图，答对后可回看全部线索。纯物质、溶液、混合物按不同口径表述。选择、实验、计算是三个平级题型，各自保存作答。标本封面是示意插画；教学正文与题目来自本地知识库，AI 整理、尚未经教师审校。

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

P0 展示版标签为 `v2.0.1-p0`（页首不再显示常驻提示，审校说明仍可从页脚查看），原 P0 保留在 `main`、`p0-stable`、`v1.0.0-p0`（`7915a15`）。本分支不部署单版本站点。推送并测试展示版源码后，在 [`p1-release` 的双版本流水线](https://github.com/warrrm/chem-gemini/blob/p1-release/.github/workflows/p1-pages.yml) 固定要发布的 P0 完整提交；发布包将 P0 放在根目录、P1 放在 `p1/`。上线后可核对 [发布清单](https://warrrm.github.io/chem-gemini/release-manifest.json)。旧版构建方式和回退说明见 [发布分支文档](https://github.com/warrrm/chem-gemini/blob/p1-release/docs/P1-发布说明.md)。
