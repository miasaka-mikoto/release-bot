import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const notesScript = join(ROOT, 'scripts', 'release-notes.mjs');

function makeRepo(commits) {
  const dir = mkdtempSync(join(tmpdir(), 'notes-test-'));
  execSync('git init -q && git config user.email t@t.t && git config user.name tester', { cwd: dir });
  commits.forEach((msg, i) => {
    writeFileSync(join(dir, 'f.txt'), `${i}:${msg}`);
    execSync(`git add . && git commit -qm ${JSON.stringify(msg)}`, { cwd: dir });
  });
  return dir;
}

test('按约定式提交分组输出', () => {
  const dir = makeRepo(['feat: add login', 'fix: crash on start (#42)', 'docs: update readme']);
  const out = execFileSync('node', [notesScript, '--from', 'HEAD'], { cwd: dir, encoding: 'utf8' });
  assert.match(out, /✨ 新功能/);
  assert.match(out, /🐛 修复/);
  assert.match(out, /📝 文档/);
  assert.match(out, /#42/);
  assert.match(out, /tester/);
});

test('空区间给出提示而非空输出', () => {
  const dir = makeRepo(['feat: add login']);
  execSync('git tag v0.1.0', { cwd: dir });
  const out = execFileSync('node', [notesScript, '--from', 'v0.1.0..HEAD'], { cwd: dir, encoding: 'utf8' });
  assert.match(out, /没有符合约定的提交/);
});

test('非约定式提交归入杂项', () => {
  const dir = makeRepo(['random message without type']);
  const out = execFileSync('node', [notesScript, '--from', 'HEAD'], { cwd: dir, encoding: 'utf8' });
  assert.match(out, /🔧 杂项/);
});

test('多条提交的短 hash 完整且不包含换行', (t) => {
  const dir = makeRepo(['feat: first change', 'fix: second change', 'docs: third change']);
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const out = execFileSync('node', [notesScript, '--from', 'HEAD'], { cwd: dir, encoding: 'utf8' });
  const expectedHashes = execFileSync('git', ['rev-list', '--no-merges', 'HEAD'], {
    cwd: dir,
    encoding: 'utf8',
  }).trim().split('\n').map((hash) => hash.slice(0, 7));
  const renderedHashes = [...out.matchAll(/`([^`]+)`/g)].map((match) => match[1]);

  assert.deepEqual(renderedHashes.sort(), expectedHashes.sort());
  assert.equal(out.split('\n').filter((line) => /^- .* `[0-9a-f]{7}`$/.test(line)).length, 3);
});
