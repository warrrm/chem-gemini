import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assemblePages } from '../scripts/assemble-pages';

const p0HTML = '<div data-app-version="p0"></div><script src="/chem-gemini/assets/p0.js"></script>';
let root: string;
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'chem-pages-test-'));
  for (const dir of ['p0', 'p1']) mkdirSync(path.join(root, dir, 'assets'), { recursive: true });
  writeFileSync(path.join(root, 'p0/index.html'), p0HTML);
  writeFileSync(path.join(root, 'p0/assets/p0.js'), 'P0 original bytes');
  writeFileSync(path.join(root, 'p1/index.html'), '<div data-app-version="p1"></div><script src="/chem-gemini/p1/assets/p1.js"></script>');
  writeFileSync(path.join(root, 'p1/assets/p1.js'), 'P1 separate bytes');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));
const options = () => ({
  p0Dist: path.join(root, 'p0'), p1Dist: path.join(root, 'p1'), outDir: path.join(root, 'site'),
  p0Commit: 'a'.repeat(40), p0Tag: 'v2.0.0-p0', p1Commit: 'b'.repeat(40),
});

describe('P0/P1 Pages assembly isolation', () => {
  it('preserves P0 bytes at root and copies P1 only into its own subdirectory', () => {
    assemblePages(options());
    expect(readFileSync(path.join(root, 'site/index.html'), 'utf8')).toBe(p0HTML);
    expect(readFileSync(path.join(root, 'site/assets/p0.js'), 'utf8')).toBe('P0 original bytes');
    expect(readFileSync(path.join(root, 'site/p1/assets/p1.js'), 'utf8')).toBe('P1 separate bytes');
    expect(JSON.parse(readFileSync(path.join(root, 'site/release-manifest.json'), 'utf8'))).toMatchObject({
      p0: { branch: 'p0-showcase', tag: 'v2.0.0-p0', commit: 'a'.repeat(40), path: '/chem-gemini/', files: { 'assets/p0.js': expect.stringMatching(/^[a-f0-9]{64}$/) } },
      p1: { commit: 'b'.repeat(40), path: '/chem-gemini/p1/', files: { 'assets/p1.js': expect.stringMatching(/^[a-f0-9]{64}$/) } },
    });
  });

  it('rejects output paths that could erase either input', () => {
    expect(() => assemblePages({ ...options(), outDir: root })).toThrow('不得覆盖');
    expect(() => assemblePages({ ...options(), outDir: path.join(root, 'p0/site') })).toThrow('不得覆盖');
  });

  it('rejects a P1 bundle built for the wrong base path', () => {
    writeFileSync(path.join(root, 'p1/index.html'), '<div data-app-version="p1"></div><script src="/chem-gemini/assets/p1.js"></script>');
    expect(() => assemblePages(options())).toThrow('独立的');
    expect(readFileSync(path.join(root, 'p0/index.html'), 'utf8')).toBe(p0HTML);
  });

  it('rejects an old or mislabelled root bundle before replacing output', () => {
    writeFileSync(path.join(root, 'p0/index.html'), p0HTML.replace('data-app-version="p0"', 'data-app-version="p1"'));
    expect(() => assemblePages(options())).toThrow('版本标记');
  });

  it('rejects even one stylesheet from the other app when the entry script looks correct', () => {
    writeFileSync(path.join(root, 'p0/index.html'), p0HTML + '<link rel="stylesheet" href="/chem-gemini/p1/assets/cross.css">');
    expect(() => assemblePages(options())).toThrow('资源路径');
  });

  it('rejects an entry referencing a missing asset', () => {
    rmSync(path.join(root, 'p1/assets/p1.js'));
    expect(() => assemblePages(options())).toThrow('文件不存在');
  });

  it('refuses to overwrite an existing P0 p1 directory', () => {
    mkdirSync(path.join(root, 'p0/p1'));
    expect(() => assemblePages(options())).toThrow('P0 已占用');
  });
});
