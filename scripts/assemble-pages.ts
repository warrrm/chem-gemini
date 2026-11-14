import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface PagesOptions {
  p0Dist: string;
  p1Dist: string;
  outDir: string;
  p0Commit: string;
  p1Commit: string;
}

function inventory(dir: string, prefix = ''): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    assert.ok(!entry.isSymbolicLink(), 'Pages 构建不允许符号链接');
    if (entry.isDirectory()) Object.assign(files, inventory(path.join(dir, entry.name), relative));
    else if (entry.isFile()) files[relative] = createHash('sha256').update(readFileSync(path.join(dir, entry.name))).digest('hex');
  }
  return files;
}

/** P0 原样位于根目录，P1 只写入 p1/；不会向任意旧版本源码写文件。 */
export function assemblePages(options: PagesOptions): void {
  const [p0, p1, out] = [options.p0Dist, options.p1Dist, options.outDir].map(dir => path.resolve(dir));
  for (const input of [p0, p1]) {
    assert.ok(existsSync(path.join(input, 'index.html')), `缺少构建入口：${input}`);
    const overlaps = (parent: string, child: string) => {
      const relative = path.relative(parent, child);
      return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
    };
    assert.ok(!overlaps(out, input) && !overlaps(input, out), '输出目录不得覆盖输入或其父子目录');
  }
  assert.ok(!existsSync(path.join(p0, 'p1')), 'P0 已占用 p1/，停止发布以免覆盖');
  assert.ok(!existsSync(path.join(p0, 'release-manifest.json')), 'P0 已占用发布清单路径，停止发布以免覆盖');
  assert.match(options.p0Commit, /^[a-f0-9]{40}$/, 'P0 必须固定到完整提交 ID');
  assert.match(options.p1Commit, /^[a-f0-9]{40}$/, 'P1 必须提供完整提交 ID');
  const p1HTML = readFileSync(path.join(p1, 'index.html'), 'utf8');
  assert.ok(p1HTML.includes('data-app-version="p1"'), 'P1 必须包含独立版本标记');
  assert.ok(p1HTML.includes('/chem-gemini/p1/assets/'), 'P1 资源路径必须位于独立的 /chem-gemini/p1/ 下');
  const p0Files = inventory(p0);
  inventory(p1); // 在清理输出前拒绝链接等不安全构建内容。
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(p0, out, { recursive: true });
  cpSync(p1, path.join(out, 'p1'), { recursive: true });
  for (const [file, digest] of Object.entries(p0Files)) {
    assert.equal(createHash('sha256').update(readFileSync(path.join(out, file))).digest('hex'), digest, `P0 文件被改变：${file}`);
  }
  if (!existsSync(path.join(out, '.nojekyll'))) writeFileSync(path.join(out, '.nojekyll'), '');
  writeFileSync(path.join(out, 'release-manifest.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    p0: { branch: 'p0-stable', tag: 'v1.0.0-p0', commit: options.p0Commit, path: '/chem-gemini/', files: p0Files },
    p1: { branch: 'p1-release', commit: options.p1Commit, path: '/chem-gemini/p1/', hosting: 'static-no-default-key' },
  }, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  assemblePages({
    p0Dist: process.env.P0_DIST ?? '.pages-p0/dist',
    p1Dist: process.env.P1_DIST ?? 'dist',
    outDir: process.env.PAGES_OUT ?? 'pages-dist',
    p0Commit: process.env.P0_COMMIT ?? '7915a15d368091937cbaf92a08ceac038dfa48d0',
    p1Commit: process.env.P1_COMMIT ?? process.env.GITHUB_SHA ?? '',
  });
  console.log('Pages 发布包已组装：P0 保留原根目录，P1 位于 p1/，不包含本机密钥配置。');
}
