# 改造方案：长线运营 → 单机式开发（版本拆分为独立作品）

> 状态：**草案，待拍板**（第 5 节 4 个口子）
> 影响阶段：需求单 → 设计文档 → 配置 → sim → UI → 数据 → 存档 → 测试
> 一句话：长线运营从「一套独立机制」降级为「一个标签」。带标签的作品与盒装走**同一条** 开发→完工→点发布→生命周期→停售 的路；原来的「版本」从自动循环的产物变成**独立的同系列作品**，命名 `系列：版本名`（如《原神：空月之歌》），同一系列每个自然年最多发售 **1 部**。TGA 最佳长线运营奖**保留**。

---

## 1. 现状：现在「长线」到底做了什么

| 机制 | 现状 | 位置 |
|---|---|---|
| 立项类型 | 三选：普通发售 / **长线运营** / 外包。长线要求中等公司起 | `config.company.scales[*].unlockLiveOps`、`project.js:244` |
| 发售结算 | 长线**不算盒装基准销量**（`baseline=0`），不走 Y 曲线 | `project.js:117-119`、`config.release.comment` |
| 占人 | 发售时把全组转成 `staff.status="liveops"` 维护岗，占整月 | `project.js:178-189`、`design.md:123-127` |
| 月收 | 每月按 四维合计 × 20 × (1+额外人加成) 进账 | `liveops.js:4-20`、`config.liveOps.monthlyRevenuePerQualitySum` |
| 固定开支 | 每月 2200 | `config.liveOps.monthlyCost` |
| 关服 | 主动关服罚金 600；撤走/不安排维护人 = 自动关服 | `liveops.js:22-34`、`staffLeaveClosesServer` |
| 版本 | 带移动端的长线按 **每 2 个月** 一版自动发售，每年最多 2 版，6 个小版本进 1 个大版本，标签 `原神.2.0` | `liveops.js:84-198`、`config.liveOps.versions` |
| 评奖 | 「最佳长线运营」只收**仍在运营**的长线，**不限于发售当年**，按 `livePeak`（月收峰值）排 | `awards.js:44-71`、`config.awards.list[bestLiveOps]` |
| 生涯档 | `world.liveOps` 状态 + 长线版本相位显示；`postLaunch`（后续支持/热修）是另一回事 | `career.js:2166-2229,3444-3455` |
| 目录作 | 88 部 `liveAfterRelease: true`；版本**不预填目录**，由 sim 按发售日推算 | `career-world.json`、`activity/README.md` |

命中文件与次数（`liveOps|长线`）：`liveops.js 61`、`config.json 221`、`career.js 24`、`paint.js 19`、`panels.js 14`、`awards.js 13`、`tick.js 11`、`lifecycle.js 11`、`index.html 9`、`project.js 8`、其余零散。

---

## 2. 目标模型

### 2.1 一作的生命周期（新旧对比）

| 环节 | 现在（长线） | 改后（长线=盒装+标签） |
|---|---|---|
| 立项 | 选「长线运营」 | 选「长线运营」，只决定**标签**与**系列归属** |
| 开发 | 同盒装 | 同盒装，一字不改 |
| 完工 | 进待发售，点发布 | 同盒装 |
| 发布结算 | 不算基准销量 | **算基准销量**、走 Y(m) 曲线、上畅销榜 |
| 发售后 | 占人 + 月收 + 每 2 月一版 | **什么都不发生**，作品进历史 |
| 停售 | 掉榜走 `shutdownLive`（关服） | 与盒装同：掉榜停售 |
| 下一部 | 版本自动发售（不是新立项） | **重新立项**「同系列新版本」，是一次完整开发 |

### 2.2 版本怎么拆

- **一版 = 一条独立作品**：自己的立项月、开发周期、团队、四维、媒体分、销量、署名、奖项参评记录。作品列表 / 发售日历 / 履历里都是**独立一行**，不再有「当前版本号」这种挂件。
- **命名**：`{系列名}：{版本名}` → 《原神：空月之歌》。配置项 `labelPattern`，经营局由玩家写版本名（给默认建议），目录作由数据表给 `versionName`。
- **节奏**：同一系列每个自然年最多 **1 部**（首发也占当年这一格）→ `versionsPerYear: 1`、最小间隔 12 个月。删掉 `mobileIntervalMonths: 2` / `maxVersionsPerYear: 2` / `minorPerMajor: 6` / `{title}.{major}.{minor}`。
- **不再有**：`active / closedYear / maintainerIds / peak` 这些运营态字段。

### 2.3 TGA 最佳长线运营奖（保留）

- 奖项**不删**，`awards.list[bestLiveOps]` 保留，`liveOnly: true` 保留。
- 候选口径：颁奖窗口内（去年 12 月～今年 11 月）**发售**的、带长线标签的作品（玩家自制 + 对手 + 目录作）。「仍在运营 / 窗口内关服」的判定删除。
- **排序依据（已拍板）= 四维合计**：同年发售的长线版本直接比综合属性——原神 2.0 与魔兽世界 3.0 在同一年发售，就看谁的 `program+design+art+music` 更高。`scoreFrom` 由 `livePeak` 改为 `qsum`（即把原来的 `fallback` 扶正），`fallback` 留 `sales` 兜并列。
- 纯盒装仍**不能**参选。
- 版本号（2.0 / 3.0）保留为**副标签**：显示名仍是《系列：版本名》，但列表与颁奖文案里可以带一句「原神 5.0」。`versionMajor/Minor` 留在数据里，不进命名公式。

---

## 3. 逐项改动清单

### 3.1 配置（`activity/config.json` → `h5/config.json`，改完 `python scripts/sync_config.py`）

- **删** `liveOps` 整块：`minScale / minMaintainStaff / staffLeaveClosesServer / monthlyCost / monthlyRevenuePerQualitySum / extraStaffRevenueRate / shutdownPenalty / versions{...}`。
- **加** `liveTag`：`{ enabled, labelPattern:"{series}：{versionName}", versionsPerYear:1, minIntervalMonths:12, firstReleaseOpensSeries:true }`。
- `company.scales[*].unlockLiveOps`：**保留**（小工作室仍不能立长线，门槛=升到中等）。
- `awards.list[bestLiveOps]`：`scoreFrom: "livePeak"` → `"qsum"`，`fallback` → `"sales"`，`liveOnly: true` 不动；`awards.comment`、`awards.career.comment` 里「仍在运营 / 不限于发售当年」的表述删掉。
- `careerWorld.liveOpsDuty`（现为 `null`）：确认保持关闭/删除；`careerWorld.postLaunch`（后续支持）**保留**。
- 特性表：`longlineAce`「长线操盘」的 `liveRevenueMult` 失去作用对象 → 改为抬该作首月销量，或删效果（见第 5 节）。
- `copy.*` 里的长线文案（「转入长线维护」「关服」等）改写/删除。

### 3.2 sim 代码（`h5/js/sim/`）

| 文件 | 动作 |
|---|---|
| `liveops.js` | 拆解：月收/关服/版本推算全删；留「版本命名 + 每年 1 部闸门 + 系列归属」→ 改名 `versions.js` |
| `project.js` | 立项：长线不再建 `liveOps` 状态、不再改 `staff.status`；`releaseProject` 里长线不再 `baseline=0`，与盒装同路 |
| `tick.js` | 删长线月结、版本发售、关服分支 |
| `lifecycle.js` | 删「掉榜的盒装停售、长线走 `shutdownLive`」分支，统一停售 |
| `awards.js` | `liveOpsAwardEligible` 退化为 `isLiveTagged && inAwardWindow`；删 `livePeak` 取数与关服窗口逻辑 |
| `actions.js` | 删 `assignLiveOps` / `shutdownLiveOps` 两个动作及入口 |
| `staff.js` | 删 `status:"liveops"` 这个状态 |
| `util.js` / `rivals.js` | 清长线残留判定 |
| `career.js` | 删 `world.liveOps` 状态、长线版本相位显示；`postLaunch`（热修）保留 |

### 3.3 UI（`h5/js/ui/` + `h5/index.html`）

- `panels.js`：立项面板去掉「维护人员/关服」，长线选项改文案（「长线运营（按单机开发，带长线标签）」）；新增「接续系列 + 版本名」输入。
- `paint.js`：作品列表/日历去掉版本号、维护状态、关服按钮；长线作品只多一个「长线」徽标。
- `app.js` / `index.html`：清长线说明文案，改为 1 处简短口径。
- 技能使用数据块：UI 改动后重跑 `node skills/runbook/scripts/scan-skill-usage.mjs`。

### 3.4 数据（`activity/career-world.json`，可先改 `scripts/build_career_world.py` 再生成）

- 88 部 `liveAfterRelease: true` → 统一为 `live: true` + 补 `seriesId` / `versionName`。
- **版本拆分（范围已拍板）**：现在 sim 按发售日推算版本、目录**不预填**；新模型要求版本是数据里的独立条目 → 在生成脚本里只给**标志性系列**（约 15–20 个）补年度条目，命名 `系列：版本名`，每年 1 部；其余长线系列保持单条，不再有推算出来的假版本。预算约 +60~120 条，不是几百条。
- 版本名来源优先级：①真实资料片/大版本名（魔兽世界：燃烧的远征 / 巫妖王之怒 / 地心之战…）②真实大版本主题名 ③兜底占位「20xx 年度版」。需要一次联网资料补齐。
- 首发与后续版本的关系：`landmark` 只挂首发（或标志性大版本），`prestige` 后续版本递减，不重写历史作品的题材/玩法/名。

### 3.5 文档

- `activity/requirements.md`：第二节经营局删「长线维护/撤人/关服/版本继续发售」，第三节「长线版本」整条重写，TGA 那条改资格，不做范围与已废清单同步（「长线只扣钱不占人」等旧条目换成「长线维护人员/月收/关服/自动版本循环」）。
- `activity/design.md`：第 1/2/4/5/9 节里长线相关段落（门槛、状态、月收、版本、点月顺序、评奖）改写。
- `activity/architecture.md`：存档字段、公开接口清单同步。
- `activity/README.md`：「长线版本不预填目录，由 sim 按发售日推算」这句**作废**，改为「版本是独立目录条目」。

### 3.6 存档迁移

- `save.version` 10 → 11，落 `activity/migrations/`：
  - `released[].liveOps{active,maintainerIds,versionMajor/Minor,peak}` → 降级为 `live: true`，其余丢弃；
  - `staff[].status === "liveops"` → 回 `idle`，`assignmentId` 清空；
  - 已被自动版本发售的 `原神.2.0` 之类记录：保留为独立作品（改名 `系列：版本名` 或按占位名），不删除玩家历史。

### 3.7 测试

- `node tests/run-sim-tests.js` 必须绿；补三组新用例：①长线走 Y 曲线与盒装一致；②同系列同年第 2 部被拦；③最佳长线运营奖只收窗口内带标签作品。
- 自检：无月收结算、无关服、无自动版本发售的残留路径。

---

## 4. 影响面与风险

1. **平衡重做**：长线的经济地位从「月收长尾」变成「一次性销量」，原来 `monthlyRevenuePerQualitySum / extraStaffRevenueRate` 撑起来的收益结构没了，长线作品可能需要抬高 `series` 继承或首发销量来补偿，否则「做长线」变成纯亏。→ 需一次 `scripts/balance_analysis.py` 复算。
2. **数据量**：版本拆分是数据活，全量铺会长出几百条目录作。
3. **存档兼容**：老档必须有迁移，否则带长线作品的老档会崩。
4. **测试/门禁**：`tests/` 与 skill-usage 数据块都要跟着过一遍。

---

## 5. 已拍板（4 个口子）

| # | 口子 | 拍板结果 |
|---|---|---|
| 1 | 规模门槛 | **保留**：仍要升到中等公司才能立项长线（改动的只是长线不再有额外机制） |
| 2 | 版本来源 | **玩家重新立项**：同系列新版本 = 一次完整立项（自选周期、组队、开发、点发布）；系统只做「每系列每年最多 1 部」的闸门 |
| 3 | 评奖口径 | **四维合计**：当年发售的长线版本比 `program+design+art+music`；原神 2.0 与魔兽世界 3.0 同年就看谁综合属性高 |
| 4 | 数据范围 | **只铺标志性系列**：约 15–20 个（原神 / 魔兽世界 / 英雄联盟 / 王者荣耀 / 明日方舟 / 崩铁 / 绝区零 / 鸣潮 / 逆水寒…），其余长线保持单条 |

## 6. 落地路径（流程）

规则变更，不能直接改代码：

1. 本方案拍板（第 5 节 4 问）→
2. `python3 skills/runbook/state.py reject implement --to requirements --note "长线运营改为标签+版本拆分"` 回退需求阶段 →
3. 更新需求单 / 设计文档 / README（本方案第 3.5 节）→ 确认 →
4. 进 plan 出实施确认单 → 再回 implement 动配置/代码/数据。

## 7. 文档同步（2026-09-16 补记）

implement 完成后对文档做的同步（与本方案第 3.5 节口径一致）：

- **design.md**
  - §1b 生涯档：长线标记作品发售后当月卸下；版本 = 目录预填/玩家重新立项（「系列：版本名」）；评奖改窗口内发售 + 四维合计。
  - §3 点月前决策：删「长线维护排人/关服」，改为「系列新版本立项」。
  - §4 资金/员工状态：删长线固定开支与「长线维护」状态；特性「长线操盘」改为基准销量加成（制作人 12% / 成员 5%）。
  - §5 立项：长线类型标注「只是标记，运行逻辑同盒装」。
  - §6 「长线运营（已决）」整节按 liveTag 新口径重写（门槛保留 / 版本拆分 / 闸门 / 20 个标志性系列 / 评奖 / 旧档迁移）。
  - §7 畅销榜与点月时序：长线并入盒装曲线，删关服步骤。
  - §8 年度奖：最佳长线 = 窗口内发售的长线标记作品，qsum 口径，不跨年。
  - §10 已废清单追加：长线维护占编/固定开支/关服/月收、自动版本号、移动端限定版本。
- **architecture.md**：日历/queue/点月管线措辞更新；`liveops.js` → `versions.js`；staff status 删 `liveops`；ReleasedGame 字段表换 `live`/`versionName`/`seriesId` 并标注旧 `liveOps` 对象迁移；只读接口清单换 `versionLabel` / `seriesVersionGate` / `liveTagLabel`。
- **requirements.md**：第 1 节点月清单与第 3 节点月前操作删「关服」、版本表述统一为「系列版本」。

实现事实源：`h5/js/sim/versions.js`（liveTag 命名与闸门）、`h5/js/sim/lifecycle.js`（`usesBoxedLifecycle`：长线与盒装同曲线）、`activity/config.json` `liveTag` / `awards.list[bestLiveOps]`。
