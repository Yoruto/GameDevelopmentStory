# 游戏开发物语

虎扑 Colorbox 活动 H5。当前只有一条生涯模式：玩家从 1995 年入职游戏公司，通过「继续」推进关键节点，到 2025 年结算。原公司经营模式已移除。

## 当前功能

- 开局随机生成属性、擅长岗位与天赋，可重掷，再从三份入职 offer 中选择；之后经历项目、事件线、晋升、跳槽、发售和年度奖。当前页面没有角色名输入，角色名固定为「我」。
- 作品使用当月新增销量与逐月累计销量。新发售作品采用销量模型 v2；旧存档作品保留旧曲线。
- 健康会影响事件选择与当月工作；结算后可查看并保存两页生涯海报。
- 2025 年的「The Last Dance」终章按作品排程接续最后短作；11 月照常评奖，12 月完成后根据真实署名与奖项记录收束。
- 本机先保存进度，虎扑 App 内通过 Colorbox 云桥同步单档；直开 `h5/index.html` 是本机预览。

## 开发入口

每轮先运行 `python3 skills/runbook/state.py current`，按当前阶段的门禁和读写范围工作；流程由 [AGENTS.md](AGENTS.md) 约束。项目事实与操作入口见 [activity/README.md](activity/README.md) 和 [activity/current-status.md](activity/current-status.md)。

改数值时编辑 `activity/config.json` 或 `activity/career-world.json`，运行 `python3 scripts/sync_config.py` 生成 `h5/js/config.generated.js`，再运行 `python3 scripts/validate_career_world.py`、`node tests/run-sim-tests.js` 和 `node tests/run-save-tests.js`。页面入口为 `h5/index.html`；仓库根的 `edgeone.json` 指向 `h5/` 输出目录。2026-09-30 本地检查为模拟 153 项、存档 59 项通过；发布安全审查和宿主内验收另按当前阶段执行。

`skills/` 是 Colorbox 能力与交付工作区资料；`AI-MAP.md` 提供代码和文档索引。带日期的方案、交接和问题记录是历史材料，现行规则以代码、配置和 `activity/current-status.md` 为准。
