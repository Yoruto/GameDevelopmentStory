<!-- COLORBOX:START -->
# Colorbox 活动交付工作区

阶段状态机驱动交付。每轮先查状态再工作，阶段细节按需读 `state.py current` 输出的「读」列出的文档；机制/配置详见 README.md。

## 每轮必做
- 每轮先跑 `python3 skills/runbook/state.py current` 拉取当前阶段、门禁与下一步命令，再开始本步工作。

## 事实源与状态
- 流程定义唯一事实源：`skills/runbook/PROCESS.md`（改流程只改它）。
- 状态只经 `state.py` 翻转（init/current/confirm/advance/reject/goto/decide/tree/clean），决策只经 `state.py decide` 记录；禁止手改 state/*.json。
- 无 `activity.json` 也能运行（默认身份 workspace）；云凭据 `credentials.json` 缺失只在部署阶段向用户确认。

## 探索边界
- 每轮只读 `state.py current` 输出的「读」里列的文件；禁读 `skills/runbook/` 源码、`skills/act-cloudbase/` 实现与 `examples/`、`state/*.json`。
- 探索 ≤5 次工具调用，之后必须产出草案/确认单或向开发者提问，不把准备当产出。

<!-- COLORBOX:END -->
