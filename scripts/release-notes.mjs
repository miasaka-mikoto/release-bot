#!/usr/bin/env node
/**
 * release-notes.mjs — 从 git 历史生成 release notes（零依赖）
 *
 * 用法：
 *   node scripts/release-notes.mjs --from <range> [--format markdown|text]
 *   例：node scripts/release-notes.mjs --from v0.67.0..HEAD
 *
 * 按约定式提交（feat/fix/docs/…）分组；PR 编号从提交信息里提取 (#123)。
 */
import { execFileSync } from 'node:child_process';

const SECTIONS = [
  ['feat', '✨ 新功能'],
  ['fix', '🐛 修复'],
  ['perf', '⚡ 性能'],
  ['refactor', '♻️ 重构'],
  ['docs', '📝 文档'],
  ['test', '✅ 测试'],
  ['build', '📦 构建'],
  ['ci', '🤖 CI'],
  ['style', '💄 样式'],
  ['chore', '🔧 杂项'],
];

function parseArgs(argv) {
  const out = { from: 'HEAD', format: 'markdown' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--from' && argv[i + 1]) out.from = argv[++i];
    else if (argv[i] === '--format' && argv[i + 1]) out.format = argv[++i];
  }
  return out;
}

function gitLog(range) {
  try {
    return execFileSync(
      'git',
      ['log', range, '--pretty=format:%H%x1f%an%x1f%s%x1e', '--no-merges'],
      { encoding: 'utf8' },
    );
  } catch {
    return '';
  }
}

function classify(subject) {
  const m = subject.match(/^(\w+)(?:\(.+\))?(!)?:/);
  return m ? m[1].toLowerCase() : 'chore';
}

export function buildNotes(range) {
  const raw = gitLog(range).split('\x1e').filter(Boolean);
  const groups = new Map(SECTIONS.map(([k]) => [k, []]));
  const authors = new Set();

  for (const line of raw) {
    const [hash, author, subject] = line.split('\x1f');
    if (!subject) continue;
    const clean = subject.trim();
    const type = classify(clean);
    const bucket = groups.has(type) ? type : 'chore';
    const pr = (clean.match(/#(\d+)/) || [])[1];
    groups.get(bucket).push({ hash: (hash || '').slice(0, 7), author, subject: clean, pr });
    if (author) authors.add(author);
  }

  const lines = ['## 更新内容', ''];
  let empty = true;
  for (const [key, title] of SECTIONS) {
    const items = groups.get(key);
    if (!items.length) continue;
    empty = false;
    lines.push(`### ${title}`);
    for (const it of items) {
      const prRef = it.pr ? ` (#${it.pr})` : '';
      lines.push(`- ${it.subject}${prRef} — ${it.author} \`${it.hash}\``);
    }
    lines.push('');
  }
  if (empty) lines.push('_本次区间内没有符合约定的提交。_', '');
  lines.push(`**贡献者**：${[...authors].join('、') || '—'}`);
  return { markdown: lines.join('\n'), authors: [...authors] };
}

// 直接运行时输出；被 import 时只暴露 buildNotes（供测试）
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop());
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  console.log(buildNotes(args.from).markdown);
}
