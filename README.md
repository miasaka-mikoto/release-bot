# release-bot 🤖

GitHub 原生的发布 / QA 自动化，还原 Grok Bot 演示里的工作流：

- **sandcastle**（发布经理）：切分版本 → 生成 release notes → @ 所有贡献者 → 盯构建 → 冒烟测试 → 发版
- **poteto**（工程师）：冒烟失败自动建 `bot-fix` issue 并接手，产出结构化修复任务

零必需依赖（Node 20+ 即可跑核心脚本），Playwright 为可选增强。

## 快速开始（本地 dry-run）

```bash
node scripts/release-notes.mjs --from HEAD        # 生成 release notes 预览
node scripts/notify-authors.mjs --from HEAD --version 0.1.0   # 贡献者通知预览
SMOKE_URL=https://example.com node scripts/smoke.mjs          # 冒烟测试
npm test                                          # 跑测试
```

## 在 GitHub 上切一个版本

Actions → `sandcastle · release cut` → Run workflow，填：

| 参数      | 说明                                           |
| --------- | ---------------------------------------------- |
| `version` | 版本号，如 `0.68.0`                            |
| `dry_run` | 默认 `true`：只构建 + 预览 notes，不切分支     |
| `base_ref`| 切分的基线分支，默认 `main`                    |

确认 dry-run 无误后，用 `dry_run=false` 重跑：切 `releases/<version>` 分支、
发贡献者通知 issue、跑构建 + 冒烟。冒烟失败会自动建 `bot-fix` issue，
`poteto · auto fix` 工作流接手。

## 与演示的对照

| 演示里的能力                          | 这里的实现                                              | 状态 |
| ------------------------------------- | ------------------------------------------------------- | ---- |
| 告诉 bot 切分，私信所有贡献者         | `release-cut.yml` + `notify-authors.mjs`（issue @ 通知，Slack webhook 为可选项） | ✅    |
| dry-run → 正式切分                    | `dry_run` 输入参数                                      | ✅    |
| 自动监控构建                          | workflow 原生支持                                       | ✅    |
| 10+ agent 模糊测试群，像真人一样点击  | `smoke.mjs` 单 agent 定向冒烟；群版见 `docs/ROADMAP.md`  | 🔶    |
| @工程师 bot 开项目修高优问题          | `auto-fix.yml` 接手 `bot-fix` issue，产出结构化修复任务 | 🔶    |
| cherry-pick 补丁发布                  | git 原生命令，流程见 `docs/ARCHITECTURE.md`             | ✅    |

🔶 = 主链路已通、agent 执行层为扩展点（诚实声明：演示里这部分是产品级工程，
不是几百行脚本能"还原"的，路线图里给了接法）。

## 仓库结构

```
.github/workflows/
  release-cut.yml    # sandcastle：切分 + 通知 + 构建 + 冒烟
  auto-fix.yml       # poteto：bot-fix issue 接手
scripts/
  release-notes.mjs  # 从 git 历史生成 release notes（约定式提交）
  notify-authors.mjs # 贡献者通知（gh API 优先，git log 降级）
  smoke.mjs          # 定向冒烟测试（URL 可达 + 可选 Playwright）
tests/               # node:test 单测
docs/
  ARCHITECTURE.md    # 架构与能力对照
  ROADMAP.md         # fuzz 群 / agent 修复的后续路线
```

## 优化点（相对演示的改进）

- dry-run 默认开：演示里是口头说 "skip dryrun"，这里做成参数，防手滑
- 贡献者通知可审计：通知内容落成 issue，而不是只发私信，过程可追溯
- 失败自动建修复 issue：冒烟失败不只停在日志里，直接进 `bot-fix` 队列
- NEW vs PRE-EXISTING：冒烟报告模板预留了回归对比字段（路线图里补全）
