#!/usr/bin/env node
/**
 * smoke.mjs — 定向冒烟测试（单 agent 版）
 *
 * 用法：node scripts/smoke.mjs
 *   SMOKE_URL=https://your-app.example.com node scripts/smoke.mjs
 *
 * 检查项：
 *  1. 仓库自检（关键文件存在）
 *  2. SMOKE_URL 可达性（设置时）
 *  3. Playwright 可用性探测（安装后可扩展点击流用例）
 *
 * 失败时写 /tmp/smoke-report.md，供 workflow 建 bot-fix issue。
 * NEW vs PRE-EXISTING 回归对比字段已在报告模板预留（见 docs/ROADMAP.md）。
 */
import { statSync, writeFileSync } from 'node:fs';

const failures = [];
const ok = (name) => console.log(`✓ ${name}`);
const fail = (name, detail) => {
  failures.push({ name, detail });
  console.error(`✗ ${name}：${detail}`);
};

async function main() {
  // 1. 仓库自检
  for (const f of [
    'package.json',
    '.github/workflows/release-cut.yml',
    '.github/workflows/auto-fix.yml',
    'scripts/release-notes.mjs',
    'scripts/notify-authors.mjs',
  ]) {
    try {
      statSync(f);
      ok(`文件存在：${f}`);
    } catch {
      fail('仓库自检', `缺失 ${f}`);
    }
  }

  // 2. 线上可达性
  const url = process.env.SMOKE_URL;
  if (url) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (r.ok) ok(`GET ${url} → ${r.status}`);
      else fail('URL 状态异常', `${url} → ${r.status}`);
    } catch (e) {
      fail('URL 不可达', `${url}：${e.message}`);
    }
  } else {
    console.log('ℹ 未设置 SMOKE_URL，跳过线上检查');
  }

  // 3. Playwright 探测（可选增强）
  try {
    await import('playwright');
    ok('playwright 可用（可扩展点击流用例）');
  } catch {
    console.log('ℹ 未安装 playwright，跳过浏览器点击流（npm i -D playwright 可启用）');
  }

  if (failures.length) {
    const report = [
      '# 冒烟测试失败报告',
      '',
      ...failures.map((f) => `- **${f.name}**：${f.detail}`),
      '',
      '## 回归判断（待人工/agent 填写）',
      '',
      '- [ ] NEW（本次引入）',
      '- [ ] PRE-EXISTING（历史遗留）',
      '',
      `_时间：${new Date().toISOString()}_`,
    ].join('\n');
    try {
      writeFileSync('/tmp/smoke-report.md', report);
      console.error(`\n${failures.length} 项失败，报告已写 /tmp/smoke-report.md`);
    } catch (e) {
      console.error(`\n${failures.length} 项失败，写报告失败：${e.message}`);
    }
    process.exit(1);
  }
  console.log('\n冒烟测试通过 ✅');
}

main();
