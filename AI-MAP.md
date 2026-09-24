# AI-MAP — AI 快速目录（唯一常驻入口）

> 给 AI/新人用：**先读本文件就能开工**。只做索引不复制内容；内容细节点进去看。
> 状态（做到哪了/待拍板）→ `HANDOFF.md`；本文件只回答「东西在哪、怎么跑、别踩什么」。

---

## 1. 项目一句话

H5《游戏开发物语》生涯档，纯前端无框架：全局 `window.GDS`、IIFE + `<script>` 顺序加载、
JSON 数据驱动、Node vm 沙箱跑同一份 sim 代码做测试。发布目标 = 虎扑 AI 游戏平台（Colorbox）。

## 2. 命令链（改任何东西都走这条，沙箱先 `export PATH="/c/Windows/System32:/c/Windows:/usr/bin:$PATH"`）

```bash
PY="C:/Users/xyc/.workbuddy/binaries/python/versions/3.13.12/python.exe"
NODE="C:/Users/xyc/.workbuddy/binaries/node/versions/22.22.2-3/node.exe"
$PY scripts/sync_config.py                 # activity/*.json 改过才需要
$PY scripts/validate_career_world.py       # 0 error / 2 warning（历史既有，别修）
$NODE tests/run-sim-tests.js               # 全量（94 条）
$NODE tests/run-sim-tests.js --only 11-tick  # 按文件名过滤单个用例组
```

## 3. 文件地图（什么时候读什么）

### 顶层文档
| 文件 | 内容 | 什么时候读 |
|---|---|---|
| `HANDOFF.md` | 滚动状态页：现状/待拍板/未提交改动 | **每轮开工先读** |
| `REVIEW-PLAN-2026-09-22.md` | 虎扑发布+广告 / 架构债 / AI 目录三份方案 | 做发布、广告、架构清理时 |
| `REDESIGN-TASKS.md` | P1~P8 实施任务书（验收标准在这） | 做 P 任务时读对应段 |
| `ARCHITECTURE-V2.md` | 分层/接口/ADR/**§7 扩展手册**/**§8.1 硬规则表** | 改 sim 代码前扫 §8.1；扩展新功能查 §7 |
| `UI-DESIGN-PLAN.md` | 一屏不滚动/唯一金按钮等 UI 铁律 | 改 UI 前 |
| `P3-HANDOFF.md` | （已过期的时点存档，被 HANDOFF.md 取代） | 翻旧账才看 |

### 引擎 `h5/js/sim/`（18 文件，加载序 = index.html script 序 = tests SIM_FILES）
| 文件 | 职责 |
|---|---|
| `ns/rng/util/events/lifecycle/media/awards.js` | 基础：错误码、LCG、维度换算、销量曲线、媒体评分、颁奖 |
| `career.js` | 生涯基座（3388 行：共享工具/成长/项目/开局），末尾挂 `sim._` 基座 |
| `career-{colleagues,awards,events,mobility,bonds,world-sim,pace}.js` | 已摘出的 7 个叶子域（P0 起分批落地） |
| `careerLines.js` | 9 条人物事件线 |
| `tick.js / actions.js` | 入口转发 / 错误码文案 |

### UI `h5/js/ui/`：`app.js`(调度) `paint.js`(绘制) `reveal.js`(演出) `dom.js`(选择器)
### 平台 `h5/js/bridge/`：`colorbox.js`(虎扑官方桥) + `local.js`(本地兜底，仅无 ColorboxAI 时安装)
### 存档 `h5/js/save/port.js`（GDS.save → bridge）

### 数据与脚本
| 位置 | 说明 |
|---|---|
| `activity/*.json` | **唯一事实源**（career-world.json = 世界，含 `cast[]` 人物表 + `nameMode`；config.json = 文案/天赋/fx） |
| `activity/cast-plan.md` | 角色数据方案 + 实施记录（真实/虚构双姓名模式、cast 取人层）——**改人物/姓名模式前读** |
| `h5/config.json` + `h5/js/config.generated.js` | 生成物，**永不手改** |
| `scripts/sync_config.py` | 生成管线；`scripts/validate_career_world.py` 数据校验 |
| `scripts/split_career.py` | 摘域脚本（自动同步两处加载列表，禁手改） |
| `scripts/_*.py / _*.json` | 历次改动的幂等补丁与数据备份（`_cw_before_*.json` 可回滚） |

### 测试 `tests/`（2026-09-22 拆分后）
| 文件 | 说明 |
|---|---|
| `run-sim-tests.js` | 入口 runner：收集 cases、`--only` 过滤 |
| `_harness.js` | vm 沙箱 + 共享 helper（loadSim/loadConfig/13 个 helper/ok 计数） |
| `cases/case-00-core-dims.js` … `case-14-resume.js` | 按域分组的用例（文件名排序=执行序） |
| `cases/case-98-copy-guard.js` | B1 文案守卫（sim 内 CJK 行数只许降） |
| `cases/case-99-guards.js` | 加载序同源 + API 面守卫（271 导出） |
| `sim-api-snapshot.json` / `sim-shared-tools.json` / `sim-copy-baseline.json` | 三份守卫基线：增删 API、增文案行、新文件含文案 → 相应基线要有意重建/下调 |

## 4. 硬规则（只列名字，全文在 ARCHITECTURE-V2 §8.1）

cycleMult 唯一入口 `sim.titleDevStart`｜`titleCoversMonth` 第 5/6 形参是 config｜池作必须确定性
（hash32/mixSeed，禁 sim.pick/irand）｜属性唯一来源 `grantMainStatAndXp`｜`mainStat` 硬门槛｜
均分=四家平均｜`joinCompany` 8 形参｜speakerBond 第一人称｜`setFlags` 必配读回点｜
邀约每年一掷｜**人物姓名唯一入口 `sim.castName`（读 `careerWorld.nameMode`），禁直接读 `name`/`alias`**｜
**取真实角色走 `sim.castFor`（纯函数）**｜生成物禁手改｜同文件禁并行 Edit｜**别 commit（除非 Master 明确要求）**。

## 5. 「我要改 X」速查

详见 ARCHITECTURE-V2 §7 扩展手册（加事件/线拍/门禁维度/节点类型/章节/结局/UI 屏…）。
一句话版：改内容动 JSON → sync → validate → tests；改机制动单个域文件 → tests；
改 UI 遵守一屏不滚动 → 真机 agent-browser-sandbox 走查。
