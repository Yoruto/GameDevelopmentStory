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

## 游戏界面文案

- 游戏页面默认只呈现玩家当前需要的内容与操作；不要主动添加解释规则、重复标题、介绍操作方式的常驻小字、提示段落或副标题。
- 优先用清晰的标题、按钮名称、布局和可见的交互状态表达含义。只有用户明确要求，或缺少说明会使关键操作无法理解时，才添加简短说明。
- 必要的错误反馈、空状态、风险告知和无障碍名称可以保留，但应直接说明当前状态或可执行动作，不写成长篇规则解释。
- 新增或修改游戏界面时，检查每段辅助文案是否真的帮助玩家完成当前操作；无明确用途就删除。
