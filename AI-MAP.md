# AI-MAP — AI 快速目录（唯一常驻入口）

> 给 AI/新人用的代码与文档索引。每轮先运行 `python3 skills/runbook/state.py current`，再按当前阶段工作。
> 当前状态 → `activity/current-status.md`；`HANDOFF.md` 与 `P3-HANDOFF.md` 保留历史记录。

---

## 1. 项目一句话

H5《游戏开发物语》生涯档，无前端框架：全局 `window.GDS`、IIFE + `<script>` 顺序加载、
JSON 数据驱动、Node vm 沙箱跑同一份 sim 代码做测试。云端单档由现有 CloudBase `activity_api` 服务，发布目标为虎扑 Colorbox。

## 2. 命令链

```text
python3 skills/runbook/state.py current
python3 scripts/sync_config.py             # 仅配置源变化后
python3 scripts/validate_career_world.py   # 最近一次 0 错误、2 条章节覆盖提醒
node tests/run-sim-tests.js                 # 2026-09-30：153 项通过
node tests/run-save-tests.js                # 2026-09-30：59 项通过
node tests/run-dialog-size-tests.js         # 2026-09-30：4 项通过
node tests/run-reveal-tests.js              # 2026-09-30：8 项通过
node tests/run-player-identity-tests.js     # 2026-09-30：通过
node scripts/career_balance_audit.js 32    # 需要复核长期平衡时
```

## 3. 文件地图（什么时候读什么）

### 顶层文档
| 文件 | 内容 | 什么时候读 |
|---|---|---|
| `activity/current-status.md` | 当前功能、验证证据与剩余验收 | 查现状时先读 |
| `HANDOFF.md` | 2026-09-23 以前的滚动交接记录 | 追溯历史时 |
| `REVIEW-PLAN-2026-09-22.md` | 2026-09-22 发布、广告和架构评估 | 追溯当时方案时 |
| `REDESIGN-TASKS.md` | P1~P8 的历史实施任务与验收思路 | 追溯任务来源时 |
| `ARCHITECTURE-V2.md` | 历史分层方案与 ADR | 追溯设计决策时；当前接口见 `activity/architecture.md` |
| `UI-DESIGN-PLAN.md` | 历史界面原则和实测记录 | 追溯旧版布局时；当前结构见 `h5/` |
| `P3-HANDOFF.md` | （已过期的时点存档，被 HANDOFF.md 取代） | 翻旧账才看 |

### 引擎 `h5/js/sim/`（19 文件，加载序 = index.html script 序 = tests SIM_FILES）
| 文件 | 职责 |
|---|---|
| `ns/rng/util/events/lifecycle/media/awards.js` | 基础：错误码、LCG、维度换算、销量曲线、媒体评分、颁奖 |
| `career.js` | 生涯基座、发售需求和海报数据视图；末尾挂 `sim._` 基座 |
| `career-{colleagues,awards,events,mobility,bonds,world-sim,pace}.js` | 已摘出的 7 个叶子域（P0 起分批落地） |
| `careerLines.js` | 表驱动的职业、人物与下行事件线 |
| `last-dance.js` | 2025 年终章排程、最后作品、颁奖夜与结尾分支 |
| `tick.js / actions.js` | 入口转发 / 错误码文案 |

### UI `h5/js/ui/`：`app.js`(调度) `paint.js`(绘制) `reveal.js`(揭晓) `dom.js`(场景/弹窗) `motion.js`(可取消动画) `poster.js`(两页 Canvas 海报)
### 平台 `h5/js/bridge/`：`colorbox.js`(虎扑官方桥) + `local.js`(本地兜底，仅无 ColorboxAI 时安装)
### 存档 `h5/js/save/port.js`（GDS.save → bridge）

### 数据与脚本
| 位置 | 说明 |
|---|---|
| `activity/*.json` | **唯一事实源**（career-world.json = 世界，含 `cast[]` 人物表 + `nameMode`；config.json = 文案/天赋/fx） |
| `activity/cast-plan.md` | 角色数据方案 + 实施记录（真实/虚构双姓名模式、cast 取人层）——**改人物/姓名模式前读** |
| `activity/plan/the-last-dance-proposal.md` | 终章原方案与本地实现差异；当前代码在 `sim/last-dance.js` |
| `activity/request-sdk-audit-2026-09-29.md` | 云请求能力契约与尚缺的宿主 SDK 证据 |
| `h5/js/config.generated.js` | 唯一发布配置生成物，**永不手改** |
| `scripts/sync_config.py` | 生成管线；`scripts/validate_career_world.py` 数据校验 |
| `scripts/career_balance_audit.js` | 固定策略的多种子完整生涯平衡探针 |
| `scripts/split_career.py` | 摘域脚本（自动同步两处加载列表，禁手改） |
| `scripts/_*.py / _*.json` | 历次改动的幂等补丁与数据备份（`_cw_before_*.json` 可回滚） |

### 测试 `tests/`（2026-09-22 拆分后）
| 文件 | 说明 |
|---|---|
| `run-sim-tests.js` | 入口 runner：收集 cases、`--only` 过滤 |
| `_harness.js` | vm 沙箱 + 共享加载与断言 helper |
| `cases/case-00-core-dims.js` … `case-19-poster.js` | 按域分组的用例，含 `case-14-last-dance.js`（文件名排序=执行序） |
| `cases/case-98-copy-guard.js` | B1 文案守卫（sim 内 CJK 行数只许降） |
| `cases/case-99-guards.js` | 加载序同源 + API 面守卫（最近一次 297 导出） |
| `sim-api-snapshot.json` / `sim-shared-tools.json` / `sim-copy-baseline.json` | 三份守卫基线：增删 API、增文案行、新文件含文案 → 相应基线要有意重建/下调 |

## 4. 历史硬规则索引

以下是旧架构手册中仍值得核对的约束；具体调用签名和配置值以当前源码、测试和 [activity/architecture.md](activity/architecture.md) 为准。

cycleMult 唯一入口 `sim.titleDevStart`｜`titleCoversMonth` 第 5/6 形参是 config｜池作必须确定性
（hash32/mixSeed，禁 sim.pick/irand）｜属性唯一来源 `grantMainStatAndXp`｜`mainStat` 硬门槛｜
均分=四家平均｜`joinCompany` 8 形参｜speakerBond 第一人称｜`setFlags` 必配读回点｜
邀约每年一掷｜**人物姓名唯一入口 `sim.castName`（读 `careerWorld.nameMode`），禁直接读 `name`/`alias`**｜
**取真实角色走 `sim.castFor`（纯函数）**｜生成物禁手改｜同文件禁并行 Edit｜Git 提交按用户明确要求执行。

## 5. 「我要改 X」速查

`ARCHITECTURE-V2.md` §7 留有历史扩展手册；当前先查状态机、现行架构和具体测试。
一句话版：改内容动 JSON → sync → validate → tests；改机制动对应 sim 域文件 → tests；
改 UI 遵守移动端布局约束；浏览器或真机走查只在当前交付阶段允许时进行。
