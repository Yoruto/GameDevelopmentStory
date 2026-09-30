# 游戏开发物语 · 项目入口

当前产品是 1995.01–2025.12 的单人生涯 H5。开局随机生成属性、擅长岗位与天赋，可重掷，然后选择入职 offer；角色名当前固定为「我」，页面没有文本输入。玩家点「继续」跳过无抉择月份，在项目、事件线、发售、跳槽、年度奖等关键节点停下；时间不会自动推进。原公司经营模式、工资与积蓄系统已移除。

2025 年终章已接入本地代码：随倒数第二部作品的交接安排最后短作，11 月照常评奖，12 月结束后按实际署名和奖项记录进入结局。当前发布与验收状态见 [current-status.md](current-status.md)。

## 运行与存档

- `h5/index.html` 可直接在浏览器打开，作为无 Colorbox 宿主的本机预览；存档写浏览器 `localStorage`。
- 虎扑 App 内使用 `ColorboxAI.storage` 缓存，并经 `ColorboxAI.cloud.auth/request` 同步云端单档。当前开局没有玩家文本输入，因此不触发角色名内容检测；新增文本输入时必须重新接入内容安全检测并完成审查。
- H5 已填写测试环境网关与环境 ID。旧的测试环境联调记录见 [current-status.md](current-status.md)；当前交付阶段仍是 `implement`，安全审查与宿主内验收尚需重做。

## 改数与验证

`config.json` 是共享数值和文案源，包括 `lifecycle.v2`；`career-world.json` 是生涯世界、事件、健康、职业与发售需求源。两者由 `scripts/sync_config.py` 合成 `h5/js/config.generated.js`，不要手改生成物。

```text
python3 scripts/sync_config.py
python3 scripts/validate_career_world.py
node tests/run-sim-tests.js
node tests/run-save-tests.js
```

2026-09-30 本地验证：模拟测试 153 项、存档检查 59 项、弹窗尺寸 4 项、揭晓交互 8 项与玩家身份检查通过；目录校验 0 错误、2 条既有的事件线章节覆盖提醒。平衡复现脚本为 `node scripts/career_balance_audit.js 32`，历史固定策略与统计口径见 [balance-audit-2026-09-27.md](balance-audit-2026-09-27.md)。

## 文档

| 文件 | 用途 |
| --- | --- |
| [current-status.md](current-status.md) | 当前功能、验证证据和剩余验收 |
| [requirements.md](requirements.md) | 已确认需求与历史决策；以页首的当前摘要为准 |
| [design.md](design.md) | 当前玩法摘要及历次设计记录 |
| [architecture.md](architecture.md) | 当前模块、状态、存档与接口摘要 |
| [poster-requirements.md](poster-requirements.md) | 两页生涯海报的实现范围与待验收项 |
| [plan/the-last-dance-proposal.md](plan/the-last-dance-proposal.md) | 终章原始方案及当前实现差异 |
| [test-report.md](test-report.md) | 各时点检查证据；最新本地检查见文末 |

按 [AGENTS.md](../AGENTS.md) 先查交付阶段。根目录的 `HANDOFF.md`、`P3-HANDOFF.md` 和日期方案保留历史过程，不作为现行任务清单。
