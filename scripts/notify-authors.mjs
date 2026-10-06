#!/usr/bin/env node
/**
 * notify-authors.mjs — 列出区间内的 PR 作者并生成发布通知（零依赖）
 *
 * 用法：
 *   node scripts/notify-authors.mjs --from <range> --version <ver> [--post-issue]
 *
 * 优先用 gh CLI 拿 PR 作者（准确的 GitHub 用户名，可 @）；
 * gh 不可用时降级为 git log 作者名。
 * --post-issue 会创建一个发布通知 issue 并 @ 所有贡献者（需要 gh 已登录）。
 */
import { execFileSync } from 'node:child_process';

function sh(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function parseArgs(argv) {
  const out = { from: 'HEAD', version: '', postIssue: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--from' && argv[i + 1]) out.from = argv[++i];
    else if (argv[i] === '--version' && argv[i + 1]) out.version = argv[++i];
    else if (argv[i] === '--post-issue') out.postIssue = true;
  }
  return out;
}

/** range "A..B" → { since, until }（ISO 时间），供 gh API 过滤 PR */
function rangeDates(range) {
  const m = range.match(/^(.*)\.\.(.*)$/);
  const start = m ? m[1] : null;
  const end = m ? m[2] : range;
  const since = start ? sh('git', ['log', '-1', '--format=%cI', start]) : '';
  const until = sh('git', ['log', '-1', '--format=%cI', end]) || new Date().toISOString();
  return { since, until };
}

function prAuthorsViaGh(since, until) {
  const repo = sh('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']);
  if (!repo) return null;
  let prs;
  try {
    prs = JSON.parse(
      execFileSync('gh', ['api', `repos/${repo}/pulls`, '-F', 'per_page=100', '-F', 'state=closed', '-q',
        '[.[] | select(.merged_at != null) | {number, title, user: .user.login, merged_at}]'],
        { encoding: 'utf8' }),
    );
  } catch {
    return null;
  }
  const inRange = prs.filter((p) => (!since || p.merged_at >= since) && p.merged_at <= until);
  const map = new Map(); // login -> [pr numbers]
  for (const p of inRange) {
    if (!map.has(p.user)) map.set(p.user, []);
    map.get(p.user).push(`#${p.number} ${p.title}`);
  }
  return [...map.entries()].map(([login, prs2]) => ({ handle: `@${login}`, prs: prs2 }));
}

function authorsViaGitLog(range) {
  const raw = sh('git', ['log', range, '--pretty=format:%an', '--no-merges']);
  if (!raw) return [];
  const seen = new Map();
  for (const name of raw.split('\n')) {
    if (name && !seen.has(name)) seen.set(name, []);
  }
  return [...seen.keys()].map((name) => ({ handle: name, prs: [] }));
}

export function collectAuthors(range) {
  const { since, until } = rangeDates(range);
  const viaGh = prAuthorsViaGh(since, until);
  // gh 可用但区间内没有 PR（比如全部直接提交）时，降级用 git log
  return viaGh && viaGh.length ? viaGh : authorsViaGitLog(range);
}

export function buildNotice(version, authors) {
  const lines = [
    `# 📦 ${version} 即将发布`,
    '',
    '本次发布包含以下贡献者的改动。如有阻塞或异议，请直接回复本 issue。',
    '',
    '## 贡献者',
    '',
  ];
  for (const a of authors) {
    lines.push(`- ${a.handle}`);
    for (const pr of a.prs) lines.push(`  - ${pr}`);
  }
  if (!authors.length) lines.push('_本次区间内未找到贡献者。_');
  lines.push('', '_由 sandcastle 自动生成 🤖_');
  return lines.join('\n');
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop());
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const authors = collectAuthors(args.from);
  const notice = buildNotice(args.version || 'unreleased', authors);
  console.log(notice);
  if (args.postIssue) {
    const title = `📦 ${args.version} 发布通知`;
    const out = sh('gh', ['issue', 'create', '--title', title, '--body', notice]);
    console.log(out ? `\n已创建 issue：${out}` : '\n创建 issue 失败（gh 未登录或无权限），请手动发布以上内容。');
  }
}
