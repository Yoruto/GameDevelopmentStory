# 交接书：P3 节点推进（新会话从这里开始）

> 生成于 2026-09-20 16:05。上一轮完成了 **P2-fix-a 补数据 + P2-fix-b 过渡项目收益**。
> 本文件是**唯一入口**：新会话开局只要读本文件 + §2 清单里的前 3 项，就能接上全部上下文。

---

## 0. 开场提示词（复制给新会话即可）

```
项目 E:\GameDevelopmentStory（H5「游戏开发物语」，纯前端）。
先读根目录 P3-HANDOFF.md（交接书，含现状/必读清单/待拍板决策/P3 任务要点）。
再按它的 §2 顺序读：.workbuddy/memory/MEMORY.md、REDESIGN-TASKS.md 的 P2-fix-a/b 段与 P3 段。
项目级 skill 有 gds-config-workflow（改配置/引擎的标准流程）与 gds-sim-gate（加准入规则），
改任何 activity/*.json 或 h5/js/sim/*.js 前先读它们。

这一轮的任务是 P3：节点推进系统（替代过月）。但 P3 开工前有一件事要我先拍板
（P3-HANDOFF.md §4：把空窗填满之后生涯曲线被抬高了，要在「削 perDevMonth」与「抬高晋升门槛」里选一条）。
先把这个决策问清楚，再出实施计划，不要直接动手改数值。
```

---

## 1. 一句话现状

生涯档已完成 P1 厂商合并 → P2 货币移除 → P2-fix 游戏池顶班 → **P2-fix-a 补 452 部真实历史作品（目录 975 部，真作覆盖 80.3%）** → **P2-fix-b 过渡项目从惩罚线改成中性偏好**；门禁全绿（85 条测试 / 0 error / API 255 导出）。**下一步 P3 节点推进，主战场 `h5/js/sim/career-pace.js`。**

---

## 2. 必读清单（按顺序，别一次全读）

| # | 文件 / skill | 读什么 | 为什么 |
|---|---|---|---|
| 1 | `.workbuddy/memory/MEMORY.md` | 全文（已压到 3000 字符内，会**自动注入**） | 命令链、架构、关键旋钮、待拍板 |
| 2 | 本文件 §4 / §5 / §6 | 待拍板 + P3 要点 + 红线 | 少走弯路 |
| 3 | `REDESIGN-TASKS.md` | 「P2-fix-a 补数据 + P2-fix-b」段（含**连锁效应表**）+ `## P3 节点推进` 段 | 任务书、验收标准 |
| 4 | skill `gds-config-workflow` | 全文 | 改配置/引擎的六步闭环 + 批量数据改动的三条硬规矩 + 实测坑 |
| 5 | skill `gds-sim-gate` | 按需（要加准入/门禁规则时） | 准入规则的 4 层收口套路 |
| 6 | `GAMEPLAY-REDESIGN-PLAN.md` | §6.4（池作配平）与 §7（落地序） | 设计意图 |
| 7 | `ARCHITECTURE-V2.md` | §6.2 的 2d/2e 行 + ADR-006 + **§8.1「容易忘的硬规则」表**（12 条铁律，改任何 sim 代码前扫一眼） | 为什么这么落地 + 别踩的坑 |
| 8 | `.workbuddy/memory/2026-09-20.md` | 需要翻旧账时再查（26.9 KB，含两轮 P2-fix 全过程） | 详细过程 |
| 9 | `activity/design.md` / `activity/architecture.md` | 玩法与目录/接口总表 | 写代码前查 |

> skill `agent-browser-sandbox`（用户级）是真机验证的必备技能，改 UI 后必须走它，不能只截图。

---

## 3. 可核对基线（2026-09-20 实测，新会话可复跑确认）

```bash
export PATH="/c/Windows/System32:/c/Windows:/usr/bin:$PATH"
PY="C:/Users/xyc/.workbuddy/binaries/python/versions/3.13.12/python.exe"
NODE="C:/Users/xyc/.workbuddy/binaries/node/versions/22.22.2-3/node.exe"
$PY scripts/sync_config.py
$PY scripts/validate_career_world.py          # 期望 0 error / 2 warning（历史既有，别去修）
$NODE tests/run-sim-tests.js                  # 期望 85 tests passed
$PY scripts/pool_coverage_report.py --top 8   # 期望见下表
```

| 量 | 值 |
|---|---|
| 测试 | **85 条全绿**；API 面 **255 导出**；`sim._` 共享工具 **47 项** |
| 校验器 | **0 error / 2 warning**（`epic-title`、`era-return-china` 两条线的章覆盖，历史既有） |
| 目录 | titles = titleDetails = **975**；公司 **75** 家 |
| 覆盖 | 75 家 / **21432 公司-月** → **真作 80.3% + 池作 17.0% + 短空窗 2.8%**；最长空窗 **5 月 = 上限**；超限公司 **0 家** |
| 整局曲线 | 主职维终值 34 年：关池 67.2 / b 前 92.3 / **b 后 97.7**（12 局 × 372 月，`scripts/_probe_career.js`） |
| 真机 | `scripts/_p2fixb_check.json` → `errCount 0`；履历页 `署名作品 8 · 过渡项目 1`、评语对拍 `virtNoteMatched: 1`、一屏不滚 |

---

## 4. ⚠️ 待拍板：P3 开工前必须先问 Master（二选一，别一起改）

**问题**：属性成长的唯一来源是「在研月 × 阶段权重」。P2-fix 把空窗从 151 月压到 5 月 → 凭空多出 146 个有成长的月份，曲线整体抬高。

| 配置 | 主职维终值（34 年） | 空窗月 | 跨过「主维 60」的时点 |
|---|---|---|---|
| 关掉游戏池（P2b 世界） | 67.2 | 151 / 372 | 第 235 月 |
| 池作照旧（b 之前） | 92.3 | 5 / 372 | 第 195 月 |
| **当前（b 之后）** | **97.7** | 5 / 372 | **第 188 月** |

- 「把空窗填满」贡献 **+25 点**，b 的成长加成只有 **+5.4 点** —— 前者是主因。
- `jobRanks.statGain` 注释里那句「现在到 80 出头」是 **P2 之前**的实测，已经不成立。
- 上表还是**未结算晋升**的下界（真机吃满 `rankLogBonus` 会更高）。
- **选项**：① `statGain.perDevMonth` 0.12 → 0.10（乘 ~0.83 拉回 80 出头）；② 抬高 `promotion.requirements[].mainStat`（28/34/41/51/60 → 约 34/44/56/70/84）。
- ⚠️ 别只抬门槛：门槛是**硬门槛**，属性膨胀会把「属性是一辈子的事业」这条体验结论推翻。

---

## 5. P3 任务要点（详细见 `REDESIGN-TASKS.md` 的 P3 段）

- **目标**：UI 只留「继续」按钮，快进到下一个有分量的节点（替代逐月点击）。
- **主战场**：`h5/js/sim/career-pace.js`。`tickCareerToDecision` + `careerPace.stopOnTypes` 演进为 `skipToNextNode` + `nodeDetectors` 注册表。
- **节点优先级**：① eventLines 拍（复用 `waitUntil` 调度）② 带选项的开发事件（从 `devEvents.list` 106 条筛白名单）③ 发售/评分揭晓 ④ 年度颁奖 ⑤ 跳槽抉择（邀约 / 空窗 ≥6 月）⑥ 晋升。
- **纯氛围事件降级**：无选项的自动结算进「近况摘要」，在下一节点前一次性呈现，每条 ≤2 行。
- **关键一致性测试**：同一 seed 下「逐月驱动整局」与「`skipToNextNode` 驱动整局」最终 state（属性/作品记录/flags/荣誉）必须完全一致。
- **UI 硬约束**：每屏一屏放完不出滚动条（`UI-DESIGN-PLAN.md`）；全屏只有一个金色实心主按钮；弹窗 `#dlg-body` max-height 8em。
- **停机条件**：开档推进器仍写 `S.career.companyId`（真机验证用）。

---

## 6. 红线 / 易踩（完整版在 skill `gds-config-workflow`）

> **不改代码先看 `ARCHITECTURE-V2.md` §8.1「容易忘的硬规则」表**（12 条：cycleMult 唯一入口、
> `titleCoversMonth` 第 5/6 形参是 config、池作确定性、均分=四家平均、`mainStat` 硬门槛、
> `joinCompany` 8 形参、`speakerBond` 第一人称、`traitAxisDistinct`、`skipIf` 读回点…）。
> 下面 12 条是**操作纪律**，与那张表互补。

1. **`activity/*.json` 是唯一事实源**；`h5/config.json` + `h5/js/config.generated.js` 是生成物，**永不手改**；改完必须 `sync_config.py`。
2. **`cycleMult` 换算只有 `sim.titleDevStart` 一个入口**（`开工月 = 发售月 − round(原时长 × 1.75)`），发售月永不动；`titleCoversMonth` / `titleProgress` 的**第 5/6 形参是 `config`**，漏传会静默退回未换算开工月。
3. **池作的时长/命名/评语必须确定性**：只准用 `hash32` / `mixSeed` / `pickBySeed`（或稳定哈希），**绝不能用 `sim.pick` / `sim.irand`**，否则开局抽天赋与全部掷点位移、读档也漂。
4. **产出别写 `stat/attrRef` 裸线性**，走 `sim.careerStatFactor`。
5. **`promotion.requirements[].mainStat` 是硬门槛**（28/34/41/51/60）：削属性必须同步调门槛。
6. **均分 = 四家媒体分的算术平均**（`shipPlayerTitle` 写回 `rec.score`），榜单/奖项/销量/履历全读它，别另算一份。
7. **JSON 明文、无 `\u` 转义、LF** → 用「精确字符串替换」写盘（锚点要唯一 + 断言命中数）+ `json.loads` 复核；整文件 `json.dumps` 往返会改浮点尾零产生噪音 diff。
8. **增删 `sim.*` 导出** → 先 `cp tests/sim-api-snapshot.json scripts/_api_snapshot_before_<改动名>.json`，再删快照重跑重建基线。
9. **同一条消息里对同一文件并行发多个 Edit，第二个会静默失效** —— 一次只改一处，改完 grep 复核。
10. **数据一补，测试里的「某公司某年空着」假设就会失效** —— 用 `tests/run-sim-tests.js` 顶部的 `withoutCatalog(cfg, companyId)` 把公司目录摘掉，别换成另一家公司。
11. **真机验证**：`sim.tickMonth` 返回 clone，诊断脚本里改完必须写回 `GDS.ui.session.state`，否则 dump 读的是旧 state（本轮因此误判过「池作不进履历」）。
12. **沙箱**：先 `export PATH="/c/Windows/System32:/c/Windows:/usr/bin:$PATH"`；`node`/`python` 用绝对路径；中文 JSON 别用 `grep -c`（误报 0）。

---

## 7. ⚠️ 未提交改动与回滚点

**工作区有 66 项未提交改动**（最后一次提交是 `520cb00 文档对齐当前实现：经营局已移除，只剩生涯档`，之后 P0~P2-fix-b 全部没提交）。
新会话注意：
- **别做任何破坏性 git 操作**（`reset --hard` / `checkout --` / `clean`）——会把 P0~P2-fix-b 全部成果冲掉。
- **不要主动 commit**，除非 Master 明确要求。
- 想回滚某一轮数据改动，用 `scripts/_cw_before_*.json`（按轮次命名，见下），不要用 git。

| 改动轮次 | 数据备份 |
|---|---|
| P1 厂商合并 | `scripts/_cw_before_p1.json` |
| P2 游戏池 | `scripts/_cw_before_titlepool.json` |
| P2-fix-a 补接班 / 去重 / 补作品 | `_cw_before_successors.json` / `_cw_before_dedupe.json` / `_cw_before_addtitles.json` / `_cw_before_addtitles2.json` |
| P2-fix-a 清占位 / 修窗口 | `_cw_before_dropfill.json` / `_cw_before_hirewin.json` |
| P2-fix-b 池作收益 + 文案 | `scripts/_cw_before_poolreward.json` + `scripts/_cfg_before_poolreward.json` |
| API 快照 | `scripts/_api_snapshot_before_p2fixb.json`（另有 `_before_p2` / `_before_p2fix`） |

---

## 8. 本轮（P2-fix-a/b）新增 / 改动文件

**数据**：`activity/career-world.json`（975 部作品 / 75 家公司 / 11 条 successorId / 窗口修正）、`activity/config.json`（`copy.career.poolNotes` 4 档 21 条）

**引擎 / UI**：`h5/js/sim/career.js`（`grantMainStatAndXp` 池作开发月加成、新导出 `titlePoolNote`、`careerResumeView` 增 `signedCount/transitionCount/poolNote`、`careerSettlementView` 增 `transitionCount`）、`h5/js/sim/media.js`（新导出 `mediaQuoteBand`）、`h5/js/ui/paint.js`（`paintResume` 摘要标题 + 过渡项目评语行）

**测试**：`tests/run-sim-tests.js`（85 条；新增 `withoutCatalog` helper、`catalogTitlesAreConsistent`、`transitionProjectsPayOffInsteadOfPunishing`；4 个用例的 fromsoftware 空窗假设改为摘目录/现场扫）

**工具**（幂等 + 自带备份）：`patch_add_titles.py`、`patch_add_titles2.py`、`patch_dedupe_titles.py`、`patch_drop_worldfill.py`、`patch_successors.py`、`patch_fix_hirewindows.py`、`patch_pool_rewards.py`、`_analyze_pool_gaps.py`（摆位分析）、`_probe_career.js`（整局曲线探针，支持 `--legacy` / `--nopool` / `--runs N`）

**证据**：`scripts/_p2fixb_check.json` + `_p2fixb_check.log` + `_p2fixb_resume.png`（履历页）/ `_p2fixb_settled.png` / `_p2fixb_resume_stress.png`

**文档**：`REDESIGN-TASKS.md`（新增 P2-fix-a/b 段 + 连锁效应表 + P3 前置决策）、`GAMEPLAY-REDESIGN-PLAN.md`（§6.4 + 落地序 ②c）、`ARCHITECTURE-V2.md`（§6.2 的 2e 行 + ADR-006 修订）、`.workbuddy/skills/gds-config-workflow/SKILL.md`（新增「批量数据改动」整节 + 实测坑）、`.workbuddy/memory/MEMORY.md`（压缩重写）、`.workbuddy/memory/2026-09-20.md`（追加全过程）
