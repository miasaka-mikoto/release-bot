# 路线图

主链路（切分 → 通知 → 构建 → 冒烟 → 修复 issue）已跑通。
以下是演示里"烟雾较重"的两块的诚实拆解和接法。

## 1. Fuzz 群（10+ agent 像真人一样点击）

演示里最贵的一块。完整复刻需要：

- **功能映射**：给应用的每个页面/操作建模（URL、关键选择器、预期结果），
  存成 `fuzz/map.yaml`
- **并发 agent**：N 个 Playwright agent 并行跑，定向用例走 map，chaos monkey
  随机点（`--chaos` 模式，记录操作序列以便复现）
- **回归对比**：同一用例在 `<新版本>` 和 `<上一个稳定版>` 各跑一遍，
  diff 出 NEW vs PRE-EXISTING（冒烟报告模板已预留该字段）
- **成本**：10+ 并发浏览器 + LLM 决策，按次计费，不便宜；
  建议先从"每晚 3 个定向冒烟用例"起步

最小起步（已就绪）：`scripts/smoke.mjs` 装上 playwright 后即可扩展点击流。

## 2. Agent 自动修复（@poteto 开项目修 bug）

`auto-fix.yml` 目前做到"接手 + 结构化任务"。agent 执行层二选一：

**方案 A：自托管 runner + codex-cli**（推荐，和现有云机器衔接）

```yaml
# auto-fix.yml 新增 job（runs-on: self-hosted）
- run: codex exec "修复 issue #${{ github.event.issue.number }}：$(gh issue view $N --json body -q .body)"
```

前提：runner 上的 codex 已接好 API（cx-switch 待用户补 key）。

**方案 B：Cursor Background Agents API**

issue 触发后调 Cursor API 起 agent 修，修完提 PR。需要 Cursor 账号的 API token，
存为 `CURSOR_API_TOKEN` secret。

## 3. Slack 真私信

`notify-authors.mjs` 的通知目前落成 issue。如需演示里的 Slack DM：

1. 建 Slack App，加 `chat:write`、`im:write` 权限
2. `SLACK_BOT_TOKEN` 存为 secret
3. 在 `release-cut.yml` 的"通知贡献者"步骤后加 Slack 发送步骤
   （按 GitHub 用户名 → Slack 用户映射表发 DM）

## 不做的

- 不承诺"chaos monkey 随机点不出误报"：随机点击的失败需要人工先标一轮
  NEW/PRE-EXISTING，agent 才能学会分类
