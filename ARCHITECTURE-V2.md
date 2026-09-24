# GDS v2 架构设计

> 依据：`REDESIGN-TASKS.md`（P1~P8 实施任务书）、`GAMEPLAY-REDESIGN-PLAN.md`（设计理由）、当前代码实测（2026-09-20）。
> 用途：回答三个问题——**整体怎么分层、模块怎么切、以后增删改功能动哪里**。
> 本文档只做架构与接口设计，不替代任务书；任务书管「改什么、怎么验收」，本文档管「落在哪、怎么扩展」。

---

## 1. 定位与约束

**现状一句话**：单页 H5、无框架无构建链、全局 `window.GDS` 命名空间、IIFE + `<script>` 顺序加载、JSON 数据驱动、Node `vm` 沙箱跑同一份 sim 代码做测试。

**架构目标**（判定标准）：

1. **新增内容只动数据层**（`activity/*.json`），不碰引擎；
2. **新增机制只动一个模块 + 一个注册点**，不蔓延；
3. **任何修改有自动化守卫**（测试 / 校验脚本 / 守卫断言），改完一条命令验证。

**非目标**：

- 不引入框架 / 打包器 / ES Module（见 ADR-001）；
- 不做存档兼容（dev 版本，铁律 1）；
- 不重写能用的东西——`tickCareerToDecision`、`careerPace`、`resolveCareerEventChoice` 等已是 v2 机制的雏形，在其上演进。

---

## 2. 总体架构

### 2.1 分层视图

```
┌─ 数据事实源（人改）────────────────────────────────────────────┐
│ activity/config.json        通用配置/文案/天赋/fx              │
│ activity/career-world.json  生涯世界唯一事实源（31 个容器）     │
└──────────────┬───────────────────────────────────────────────┘
               │ python scripts/sync_config.py（唯一生成管线）
               ▼
┌─ 生成物（禁手改）─────────────────────────────────────────────┐
│ h5/config.json（pretty, 测试与真机注入用）                     │
│ h5/js/config.generated.js（minify, 浏览器 window.GDS.CONFIG）  │
└──────────────┬───────────────────────────────────────────────┘
               │ GDS.CONFIG
               ▼
┌─ sim 引擎（纯结算，无 DOM）───────────────────────────────────┐
│ 基础: ns(错误码) rng(LCG) util(维度/换算/查找)                 │
│ 域:   lifecycle(销量曲线/榜单) media(媒体评分) awards(颁奖)    │
│ 生涯: career-core growth projects world-sim mobility events    │
│       careerLines(9 条人物线) pace(tick 主循环+节点推进)        │
│ 入口: tick.js(actions.js 是错误文案)                           │
│        ↓ 每次调用                                              │
│     { state', queue[] }  ← 不可变进、新 state 出               │
└──────────────┬───────────────────────────────────────────────┘
               │ queue（呈现契约，唯一 sim→UI 通道）
               ▼
┌─ UI 层（只读 state、只调动作 API，绝不改 state）──────────────┐
│ app.js(会话/调度/分支resolve) reveal.js(揭晓演出)              │
│ paint.js(各屏绘制) dom.js(选择器)   css/app.css               │
└──────────────┬───────────────────────────────────────────────┘
               ▼
┌─ 持久化 ─────────────────────────────────────────────────────┐
│ save/port.js → bridge/colorbox.js（本地 storage + 可选云端）   │
└───────────────────────────────────────────────────────────────┘

测试：node tests/run-sim-tests.js —— vm 沙箱按 index.html 同顺序
加载 sim/*.js，合并同一份事实源，75+ 条断言直接驱动 sim API。
```

### 2.2 三条架构脊柱（任何改动不得破坏）

| # | 不变量 | 含义 | 违例后果 |
|---|---|---|---|
| 1 | **sim 是唯一结算者** | UI 不直接改 state；一切状态变更走 `sim.*` 动作函数 | 真机与测试分叉、无法 seed 重放 |
| 2 | **tick 单一入口** | 所有时间流逝走 `tickCareerMonth`；节点推进（P3）只是它的循环包装，结算永不旁路 | 「逐月 vs 跳节点」一致性测试必挂 |
| 3 | **RNG 只在 state 内** | 随机数唯一来源是 LCG（`st.rngSeed/rngCount`）；`skipIf` / `req` 门禁判定 RNG-free | 同 seed 不可复现，测试全废 |

### 2.3 命令链（改任何东西都走这条）

```
改 activity/*.json
  → python scripts/sync_config.py        # 重新生成（禁手改生成物）
  → python scripts/validate_career_world.py   # 数据校验（已落地：孤儿引用 / 章覆盖 / 线×章）
  → node tests/run-sim-tests.js          # 引擎断言全绿
  → 真机 agent-browser 走查（涉及 UI 时）
```

---

## 3. 模块划分

### 3.1 现状模块清单与 v2 处置

| 文件 | 行数 | 职责 | v2 处置 |
|---|---|---|---|
| `sim/ns.js` | 21 | 错误码枚举 | 不动；新动作失败码在此追加 |
| `sim/rng.js` | 36 | LCG + 加权抽取 | 不动 |
| `sim/util.js` | 204 | 两套维度换算、查找、格式化 | 不动；`titleStatsFromPerson` 仍是人物维→作品维唯一入口 |
| `sim/lifecycle.js` | 169 | Y 曲线销量、月榜 | 不动；P6 销量具象化只读它，不改它 |
| `sim/media.js` | 193 | 四家媒体评分 | 不动（串味即 bug 的分工保持） |
| `sim/awards.js` | 180 | 颁奖候选/评分/历史 | **扩展**：双档制（P5c），见 §6.5 |
| `sim/career.js` | 3363 | 生涯基座（共享工具 / 访问器 / 成长 / 项目 / 存档与开局） | 已摘 7 域，见 §3.2；后续只手改这一处 |
| `sim/career-*.js` | 2562 | 已迁出的 7 个独立域（colleagues / awards / events / mobility / bonds / world-sim / pace） | 各域独立演进，P1~P6 改动落在对应域 |
| `sim/careerLines.js` | 1393 | 9 条人物事件线 | 不动结构；P5b 分章盘点只动数据与补拍 |
| `sim/tick.js` | 8 | `tickMonth` 转发 | 不动 |
| `sim/actions.js` | 23 | 错误码→文案 | 不动 |
| `ui/app.js` | 533 | 会话、tick 调度、page 分支 resolve | **扩展**：节点页/置灰选项/健康条（§6） |
| `ui/reveal.js` | 422 | 揭晓演出 | **扩展**：颁奖双档、章开场演出 |
| `ui/paint.js` | 858 | 各屏绘制 | **扩展**：健康条、声望称号、荣誉墙（S6） |
| `bridge/` `save/` | ~130 | 持久化 | 不动 |

### 3.2 career.js 拆分：叶子域摘除（P0 已落地）

**实测结论**（`scripts/_analyze_career_deps.py`、`scripts/_cut_points.py`）：career.js 5546 行、161 个 `sim.*` 导出、147 个私有函数；`num` 被 106 处引用；即使把引用数 ≥5 的 20 个工具排除在外，**全文件仍不存在任何一个「零跨文件依赖」的物理切点**（0 个）。

→ 因此**不按 core/growth/projects 硬拆主干**（那需要改写数百个调用点，风险不可控），改为**先摘叶子域**：每刀切出的域自洽、可独立测试，career.js 单调变薄。

**机制四件套（已固化）**：

1. **共享基座 `sim._`**：career.js 末尾导出被多域共用的纯工具（`num` / `cloneStats` / `clampJobRank` / `DIMS` / `jobRankSpec` …）。域文件顶部 `var num = sim._.num;` 绑定——**调用时解析**，故与加载顺序无关。
2. **`scripts/split_career.py`**：域定义 → 自动求闭包（只被域内引用的私有函数）→ 剪段 → 生成新文件（**函数体一字不改**）→ 从 career.js 删除 → **自动同步 `index.html` 与 `tests/run-sim-tests.js` 的加载列表**。落盘前用 `--dry-run` 审「借用清单」与「私有外泄」。
3. **API 面守卫**：`tests/run-sim-tests.js` 末尾比对 `tests/sim-api-snapshot.json`（247 个导出）+ 按 `tests/sim-shared-tools.json` 逐项断言 `sim._` 完整；漏挂、重名覆盖立即爆掉，而不是等到真机某分支静默失效。
4. **两条防空转硬约束**（第二轮加固，都是踩过/预判到的坑）：
   - **私有外泄默认中止**：域内符号迁出后仍被域外以裸名调用 → 直接中止并列出调用方（`--allow-leaks` 才放行），避免切完才在真机某分支 ReferenceError；
   - **基座导出块幂等**：每次落盘先 `strip_shared_blocks` 清旧再插新（早期版本每刀追加一份，已积累 3 份重复块）；
   - **共享工具迁出即回挂**：若某刀把 `SHARED_TOOLS` 里的符号切走，脚本会在新文件回挂 `sim._`（career.js 末尾的 `typeof !== 'undefined'` 对已迁出者会静默跳过）；域文件的 `bindShared` 绑定失败会 `console.warn` 出声。

**为何能做到主循环零改动**：`tickCareerMonth` 等编排函数**早已全部以 `sim.xxx()` 门面形式调用**导出函数，所以导出搬走后 career.js 侧不用动；域文件缺的私有工具从 `sim._` 取。

**进度**（每刀都必须 `node tests/run-sim-tests.js` 全绿）：

| 序 | 文件 | 内容 | 对应 P 落点 | 规模 |
|---|---|---|---|---|
| 1 | `career-colleagues.js` | 制作组同事生成 | — | 126 行（5 符号） |
| 2 | `career-awards.js` | 年度颁奖评选 + 剧情页 | **P5c 双档** | 323 行（13 符号） |
| 3 | `career-events.js` | 开发/发售后期事件、选项结算、idleGap | **P2b 空窗抉择 / P4a req / P6** | 424 行（19 符号） |
| 4 | `career-mobility.js` | 跳槽 / 邀约 / offer | **P4c 声望反哺邀约** | 575 行（21 符号） |
| 5 | `career-bonds.js` | bond 同址/远程、junior 入场与离队 | P5b 线拍依存 | 308 行（14 符号） |
| 6 | `career-world-sim.js` | 世界作品月度推进、虚拟池、媒体数据准备 | **P1 数据归并 / P2b 虚拟池开关** | 323 行（11 符号） |
| 7 | `career-pace.js` | 月度主循环 / 决策点判定 | **P3 节点推进主战场** | 483 行（13 符号） |

**career.js 5547 → 3363 行（-39%）**；7 个域文件合计 2562 行（含各文件的基座绑定与头部注释）。

**验证**（2026-09-20 第二轮）：
- `node tests/run-sim-tests.js` → **78 条全绿**（原 75 + 加载列表同源 + API 面 + `sim._` 完整性）；
- API 面 247 导出不变、基座 48 工具完整；
- **真机**（agent-browser，`file://` 直开 h5/index.html）：开局 → 30 个月推进，`1997.07 / 世嘉第二研发部 / 音乐岗 / 填充阶段`，中途 11 次事件抉择、41 部世界作品推进，**控制台 0 错误**。

**拆分纪律**：

1. 一次一域；先 `--dry-run` 确认「借用」全是基座纯工具、无「私有外泄」；切完立刻跑测试（外泄会直接中止，见机制 4）；
2. 域文件必须在 career.js **之后**加载（要取 `sim._`），运行时才被调用，故次序安全；
3. 需要新的共享工具 → 只加进 `split_career.py` 的 `SHARED_TOOLS`（脚本自动重生成 career.js 的基座块与 `tests/sim-shared-tools.json`）；
4. 有意增删 `sim.*` API → 删 `tests/sim-api-snapshot.json` 后重跑一次重建基线。

### 3.3 层间职责边界

| 层 | 可以做 | 不可以做 |
|---|---|---|
| sim | 结算、掷 RNG、产 queue、回答查询 | 碰 DOM、拼 HTML、读 UI 状态 |
| UI | 读 state 渲染、调动作 API、按 queue 播页 | 改 state、自行推导规则（如自己算分数） |
| config | 声明数值/文案/容器 | 放逻辑（JSON 无函数，门禁用声明式 `req`） |
| 测试 | 直接调 sim API、注入裁剪 config | 依赖 DOM、依赖真机 |

---

## 4. 关键数据结构

### 4.1 state（运行时档，JSON 可序列化——`sim.clone` = JSON 深拷贝）

顶层：`{ mode:"career", phase:"PLAYING"|"SETTLED", year, month, rngSeed, rngCount, career:{…}, company:{funds}, worldReleased:[], companyXp:{}, … }`

`st.career` 字段分组（`ensureCareerExtras` 兜底初始化，新字段一律在此登记）：

| 组 | 字段 | v2 变动 |
|---|---|---|
| 身份/雇主 | `companyId, studioId, roleId, jobRank, jobTitleId, tenures[], priorRoleId` | — |
| 在研 | `titleId, liveStats, postLaunch{monthsLeft}, idleMonths, leftProjectLive` | — |
| 成长 | `stats, jobXp, monthsInRank, promotionsThisYear, lastPromotionYear, genreXp{}, gameplayXp{}` | — |
| 关系 | `bonds{mentor,peer,junior}, colleaguePool, colleagues[]` | — |
| 事件线 | `lines{lineId:{beat,flags,status,waitUntil,pending,waitingFor}}, lineStartRolls, pendingStoryPromos, pendingMentorProducer, awaitingProducerPitch` | — |
| 跳槽 | `yearEndOffers, offerYear, invites[], inviteYearStamp, inviteYearHit, invitesRolledThisYear, hopFailedYear` | — |
| 经济（P2a 删除） | `salary, savings, lastPay` | **删除/隐藏**，见 §6.2 |
| 游戏池（P2-fix 启用） | `virtualProjects, virtualDetails, virtualSeq, poolSeq` | 池作（原虚拟作）落盘容器；每部带 `virtual:true / pool:true`，与目录真作走同一套在研/发售链路 |
| 去重/记录 | `credits[], firedTitleEvents[], mergedFromIds[], awardStory{nominated,goty}` | — |
| **v2 新增** | **`health`（1–5，初始 4）**、**`renown`（累积值，档位派生）**、`originId`（S2 出身） | P4/S2 |

**flag 三层存储**（门禁与读回的事实源）：

1. 生涯级：`st.career.awardStory{nominated,goty}` 这类布尔位；
2. 线级：`st.career.lines[lineId].flags`（`setFlags` 写入，`skipIf.flagOn/flagOff/notHeld/notCollapse` 读回）；
3. 去重级：`firedTitleEvents[]`（一次性事件）。

> `req.flags`（P4a）读哪层要写进事件 schema 注释；建议统一读「生涯级 + 当前线级」两层合并视图，求值器内收口（§5.2）。

### 4.2 config（事实源，`activity/*.json`）

`career-world.json` 现有 31 个容器按域归类：

| 域 | 容器 | 说明 |
|---|---|---|
| 世界目录 | `companies(75), titles(530), titleDetails, proficiency` | **P1 已落地**（128→75，见 §6.1） |
| 质量/评分 | `quality(换算矩阵/软帽/时代缩放), scoreFromLive, launchSales` | 不动 |
| 成长 | `player, playerXp, jobRanks, roles, growthStages, development, projectPhases, colleagues` | `development` 加 `cycleMult`（P2c） |
| 事件 | `devEvents(106), postLaunch, producerEvents, eventLines(9线+pathFork), idleGap` | P2b/P4a/P6 主战场 |
| 经济（P2a 移除） | `personalEconomy` | 删除 |
| 游戏池（P2-fix） | `titlePool` | 由 `virtualPool` 改名并重新启用：`enabled:true` + `coverage{minFillMonths:6,maxFillMonths:24}` + `fallback{enabled:true}` |
| 职业流动 | `mobility, openingOffer, lateJoin, producerCareer` | P1 权重复核、P4c 反哺 |
| 时间/颁奖 | `timeline, awards` | P5 扩展 |
| 元 | `comment, useAlias, save` | — |
| **v2 新增** | **`features`（开关）、`chapters`（六章）、`renownTiers`（称号链）、`healthSpec`（健康文案/阈值）、`endings`（S1 多结局）** | 见 §6 |

`activity/config.json` 侧：`copy`（全部文案）、`traits`（天赋池）、`fx`（滚幕时长）、`awards`（奖项定义）、`lifecycle`、`calendar`、`content`。

### 4.3 queue page（sim→UI 唯一呈现契约）

```js
{
  type: "awards" | "invite" | "hop" | "promotion" | "media"
      | "producerPitch" | "careerLine" | "careerLineFork"
      | "paceSkip" | …,          // 页类型，UI 按 type 分支 resolve + 渲染
  kind: "event" | "info",
  presentation: "choice" | undefined,   // choice → UI 弹选项（#dlg-extra, data-event-opt）
  kicker, title, body,                  // 文案（UI 直出）
  options: [{ id, label, req? }],       // choice 页；v2 选项带 req（§4.4）
  awards / offers / lines / …           // type 私有载荷
}
```

**新增 page type 的四步注册**（缺一不可）：

1. sim 侧产出（某个 `*QueueItem` 工厂）；
2. 若该页可成为停点 → `careerWorld.careerPace.stopOnTypes` 注册（P3 后改为节点注册表，§6.3）；
3. `ui/app.js` 的 resolve 分支（点选项后调哪个 `sim.resolve*`）；
4. `ui/reveal.js`/`paint.js` 的渲染分支 + `app.css` 样式（遵守一屏不滚动约束）。

### 4.4 事件与选项 schema（v2 req 扩展）

事件容器条目（devEvents / postLaunch / producerEvents / eventLines 拍的选项）统一支持：

```json
{
  "id": "evt_xxx",
  "options": [{
    "id": "opt_a",
    "label": "连轴转顶住",
    "req": {
      "minStat": { "program": 30 },
      "flags": ["career.awardStorygoty"],
      "rank": 4,
      "health": 3,
      "renown": 2
    },
    "setFlags": { "…": "…" },
    "effects": { "…": "…" }
  }]
}
```

- `req` **全键可选**；不满足 → UI **置灰 + 一行解锁提示**，不隐藏（铁律 6：判定 RNG-free）；
- req 键是**注册表**而非硬编码 switch（§5.2），新增门禁维度 = 注册一个求值函数 + 一条守卫测试；
- `health`/`renown` 数值语义：门槛值（≥ 判定）。

### 4.5 节点（P3 驱动契约）

```js
node = {
  type: "lineBeat" | "devChoice" | "launch" | "awards" | "hopOrIdle" | "promotion"
      | "chapterOpen" | "chapterClose" | "yearTurn",   // 注册表顺序即优先级
  pages: [/* queue page 列表，直接交给 UI */],
  month: { year, month }
}
```

设计要点：**节点不是新状态机，是 queue 的分类器**。tick 照常结算每个月，`skipToNextNode` 只决定「哪个月的 queue 值得打断玩家」。这保证脊柱 2（一致性）天然成立。

---

## 5. 接口定义（sim 公共 API）

### 5.1 现有 API 分类（调用方只允许按类使用）

| 类 | 函数 | 契约 |
|---|---|---|
| 引擎入口 | `tickMonth`、`tickCareerMonth` | state+config → `{state, queue}` |
| 决策动作 | `resolveCareerEventChoice`、`resolveCareerLineChoice`、`resolveCareerPathFork`、`resolveProducerPitch`、`requestCareerPromotion`、入职/跳槽接受 | state → `{state, queue}` 或 `sim.fail(state, ERR.*)` |
| 纯查询 | `careerCompany/Role/Title`、`activeCareerLineIds`、`listYearEndOffers`、`monthlyChart`、`careerProjectView` | 不改 state、不掷 RNG |
| 纯换算 | `titleStatsFromPerson`、`careerStatFactor`、`salesFactor`、`scoreMedia` | 同上 |
| 生命周期 | `rollCareerStart`、开局 offer 系列 | 建档期专用 |

### 5.2 v2 新增 API

```js
// ── P3 节点推进 ─────────────────────────────────────────────
// 循环 tickCareerMonth 直到命中节点或 SETTLED。中间月份静默结算。
// 与逐月驱动共用同一条 tick 路径（一致性测试的担保）。
sim.skipToNextNode = function (state, config) -> { state, node, skippedMonths }

// 节点探测器注册表 careerNodeDetectors：有序，先命中先停。每个探测器是纯函数对象 {id, test(page, pace, config)}。
// ⚠️ 新增「会产节点」的 page type 必须在此登记 —— 未登记时 careerNodeHit 会判为「无节点」，
//    skipToNextNode 随即把整份 queue 丢弃（不报错、不崩溃，功能静默失效；2026-09-22 cast 阶段 4 实测踩过）。
// 新增节点类型 = 往数组 push 一个 {id, test} + config 侧如有参数加键。
sim.careerNodeDetectors = [
  function detectLineBeat(st, tickResult, config) -> node|null,   // ① eventLines 拍
  function detectDevChoice(/*…*/) { /* ② 白名单内带选项开发事件 */ },
  /* ③ launch ④ awards ⑤ hopOrIdle ⑥ promotion ⑦ chapter ⑧ yearTurn */
];

// ── P4a req 门禁 ────────────────────────────────────────────
// 唯一求值入口。RNG-free 纯函数；UI 渲染置灰与 sim 结算前防御共用。
sim.evalReq = function (st, req, config) -> { ok: bool, reasons: string[] }
// reasons 即解锁提示文案（如「需要：程序 ≥ 30」），由求值器内模板生成。

// req 键注册表：新增门禁维度在此注册。
sim.reqKeys = {
  minStat: function (st, v, config) -> string|null,  // 返回 null=满足，否则提示文案
  flags:   /*…*/, rank: /*…*/, health: /*…*/, renown: /*…*/
};

// ── P4b 健康 ────────────────────────────────────────────────
// 健康唯一写入口，只允许事件结算路径调用（守卫测试：无事件月份 health 不变）。
sim.applyHealthDelta = function (st, delta, reason, config) -> void

// ── P4c 声望 ────────────────────────────────────────────────
sim.renownTierOf = function (st, config) -> { tier: 1..5, id, label }  // 派生，不存档位

// ── P5 章节 ─────────────────────────────────────────────────
sim.currentChapter = function (year, config) -> chapterDef|null

// ── S1 结局 ─────────────────────────────────────────────────
sim.pickEnding = function (st, config) -> endingDef   // endings.list 按 priority 首个 req 满足者
```

---

## 6. v2 机制落点（P1~P8 逐项映射）

### 6.1 P1 厂商合并（纯数据任务）（✅ 已落地：128 → 75 家）
- **改**：`activity/career-world.json` 的 `companies/titles/titleDetails` + 事件容器引用 + `openingOffer`；
- **工具**：`scripts/merge_companies.py`（**幂等**归并器，`--dry-run` 出报告、`--landmark-min-score` 调保护口径、落盘自动备份；**不进 sync 管线**）+ `scripts/validate_career_world.py`（**常态化校验器**：孤儿引用 / 章覆盖 / 线×章 / 公司数区间，见 §8）；
- **实测结论**：原规则（作品数 ≤1 全砍）与它的保护条款自相矛盾 —— landmark 覆盖 39%，17 家单作公司持招牌名作。最终口径 = landmark 最高分 ≥ 9.4 才保护作品数 =2 的公司，并对 `successorId` / 前辈 `successorCompanyId` 的落点强制保留（叙事线依赖）。详见任务书 P1。
- **归并新增「能力匹配」层**：目标公司 `studios[].genreIds/gameplayIds` + `tags` 命中作品的题材/玩法，同区 → 分高 → 大厂 三级排序。
- **sim 只被动了一处**：`careerSeniorLine` 加「最多列 2 位前辈 + 等N位」——因为合并后单公司前辈可达两位数（ea 10 位），原实现会拼爆邀请文案（一屏约束）。

### 6.2 P2 货币移除 / 虚拟池下线 / 周期拉长（✅ 已落地 2026-09-20；下表为**实际**落点）
| 子项 | 落点 |
|---|---|
| 2a 货币 | 删 `personalEconomy` 容器、`jobRanks.salaryFloor`、75 家 `company.salaryMult`、`traits.thrifty`、5 条 `copy.career` 货币文案、`st.career.salary/savings/lastPay/funds` 及其在 tick（career-pace）中的结算段、UI KPI 位与结算页积蓄行（让位给健康条）；天赋死键 `livingCostMult/bondApartDelta` 移除。**唯一例外**：`careerHireChance` 读的 `personalEconomy.salary.statRef`(=46) 迁到 `mobility.statRef`（数值不变）。守卫测试 `careerEconomyFullyRemoved`；死配置登记见 §8.3 |
| 2b 虚拟池 | **未用 `features` 容器**，落地为 `career-world.json` 的 `virtualPool.enabled: false`（字段与 `titlesByGenre` 保留）；所有生成点 gate 在 `sim.virtualPoolEnabled(config)` 后（`startVirtualProject` / `queueProducerVirtualPitch` / `assignCareerProject` 的虚拟分支）；空窗新规则落在 career.js 的 `assignCareerProject` + `idleGapSpec` 路径（`outsource` / `study` / `rest` 三类；健康恢复留给 P4） |
| 2c 周期 | `development.cycleMult = 1.75`；换算唯一入口 `sim.titleDevStart`（`开工月 = 发售月 − round(原时长 × mult)`），`titleCoversMonth` / `titleProgress` 均改读它、并新增第 5/6 形参 `config`；新增 `sim.careerCycleMult` / `sim.monthFromIndex`。**未建** `count_typical_titles.py`：改用 `scripts/pool_coverage_report.py` 出覆盖报告，「8~15 部」口径已作废（见 2d） |
| 2d 游戏池（P2-fix） | `virtualPool` → **`titlePool`** 并启用：`sim.titlePoolSpec/Enabled/Usable`、`sim.poolMinFillMonths`、**纯函数** `sim.poolCandidateAt`（不写 state、**不消费 RNG**，哈希取模保证同公司同月同一部作）、落盘入口 `sim.startPoolProject`（`startVirtualProject` 保留为别名）。`assignCareerProject` 顺序改为 **目录真作 → 池作 → 空窗抉择**；`canStartCareerVirtual` 重定义为「够不够开池作」。验收：`titlePoolCoversEveryCompanyLifespan` |
| 2e 池作配平（P2-fix-a/b） | **(a) 数据**：`titles` 523 → **975**（三批补真实历史作 + 删 7 组重复 + 清 6 条 `worldFill_*`；11 家消亡公司补 `successorId` 消灭 2304 僵尸月；`polyphony/tencent` 的 `hireFromYear` 修正）。`pool_coverage_report.py` 修口径（补 `hireUntilYear` 终点）+ 新增 `--zombie`；新增 `_analyze_pool_gaps.py`。**(b) 机制**：新增 `titlePool.devStatMult/devJobXpMult`(1.15) 在 `grantMainStatAndXp` 的 `kind==="dev"` 分支生效；`jobRanks.*.virtualScale` 0.5→0.75、`virtualCreditWeight` 0.4→0.5、`companyXp.xpPerVirtualRelease` 5→7；**新导出** `sim.titlePoolNote(titleId, score, config)`（RNG-free 稳定哈希选条，档位复用 `sim.mediaQuoteBand` → 新导出）与 `copy.career.poolNotes`(4 档 21 条)；`careerResumeView` 增 `signedCount/transitionCount` + 每行 `poolNote`，`careerSettlementView` 增 `transitionCount`。验收：`transitionProjectsPayOffInsteadOfPunishing` / `catalogTitlesAreConsistent`（85 条全绿、API 255 导出） |

### 6.3 P3 节点推进
- **主战场**：career-pace.js。`tickCareerToDecision` + `careerPace.stopOnTypes` 演进为 `skipToNextNode` + `nodeDetectors` 注册表（§5.2）；
- **config**：`careerPace` 扩展 `devChoiceWhitelist`（106 条筛子集）、`summary`（近况摘要参数）、`yearBanner`（跨年字幕开关）；
- **UI**：`btn-tick`（下一月）下线，`btn-tick-skip` 改名「继续」成唯一主按钮；`app.js` 调度改调 `skipToNextNode`；近况摘要是新 page type `paceSummary`（四步注册，§4.3）；
- **一致性测试**：同 seed 逐月 vs 跳节点全程跑完，深比对 `state`（属性/作品/flags/荣誉）——**这是 P3 的验收核心，也是整个 v2 的回归底座**。

### 6.4 P4 req / 健康 / 声望
| 子项 | 落点 |
|---|---|
| 4a req | schema（§4.4）+ `evalReq`/`reqKeys`（career-core）；四个 `resolve*` 动作入口结算前防御性过 `evalReq`；UI `app.js` 渲染选项时调同一函数置灰；`app.css` 加置灰样式 |
| 4b 健康 | state 加 `career.health`（ensureCareerExtras 登记）；`applyHealthDelta` 唯一写口（career-growth）；事件 `effects` 加 `healthDelta` 键；UI 健康条接管货币 KPI 位（paint.js + css）；赶工文案分年代走 `copy` 按章取文案 |
| 4c 声望 | state 加 `career.renown`（累积值）；`renownTiers` 容器（5 档阈值+称号文案）；`renownTierOf` 派生；award 结算（awards.js `recordAwardsHistory` 处）累积；`rollInvitesThisMonth` 读档位加权 |

### 6.5 P5 六章 + 颁奖双档
| 子项 | 落点 |
|---|---|
| 5a 章容器 | `career-world.json` 新增 `chapters.list[]`：`{id,fromYear,toYear,title,openingLines[],closingLines[],palette}`；`sim.currentChapter`；章开场/收束是新节点类型（探测器 ⑦）与 page type |
| 5b 线×章 | 数据盘点表（validate 脚本产出）+ 补拍遵守 eventLines 纪律（第一人称、尾拍兜底） |
| 5c 双档颁奖 | awards.js `runCareerAwards` 产出的 pack 加 `tier:"full"|"brief"`；brief 档年度游戏从当年 `landmark‖prestige≥3` 选（纯函数、RNG-free）；page type `awards` 加 `tier` 字段，reveal.js 按档渲染（快讯 ≤5 秒可连点） |
| 5d 年表 | `chapters.list[].newsByYear` 或由 landmark 生成；与颁奖快讯同屏 |

### 6.6 P6 正反馈呈现层
- **原则：呈现层只读不改**。属性里程碑 = 新节点/页类型（`milestone`），触发判定读 `promotion.requirements` 门槛；销量具象化 = paint/reveal 文案模板读 `worldReleased.lifetimeSales`（缺则 `launchSales`，都缺 null）；人物线正反馈拍与 postLaunch 扩充 = 纯数据。

### 6.7 P7 独立子项
| 子项 | 落点 |
|---|---|
| S1 多结局 | `endings.list[]`（`{id,priority,req,card}`）+ `sim.pickEnding`（复用 `evalReq`！）+ 谢幕页新 scene |
| S2 出身三选一 | `openingOffer.tiers` 数据映射 + 开局 scene 改明选；天赋三选一重做 `player.startRoll` 逻辑（career-growth） |
| S4 线结局卡 | `eventLines.lines[].endingCards[]`（bond/flag 驱动，复用 req 求值） |
| S5 年代皮肤 | `chapters[].palette` → CSS 变量切换，paint.js 一处收口 |
| S6 荣誉墙 | 纯 UI 新 scene，读 `credits/awardsHistory/lines` |

### 6.8 P8 验证
灰盒与真机按任务书；架构侧担保 = 一致性测试（6.3）+ 校验器（§8.2）+ 全量测试绿。

---

## 7. 扩展手册（日后增删改速查）

| 我要… | 动哪里 | 验证 |
|---|---|---|
| 加/改一家公司、一部作品 | `career-world.json` 对应容器 | sync → validate（孤儿引用）→ 测试 |
| 加一条开发事件 | `devEvents.list`（选项可带 `req`） | sync → 测试；若在 P3 白名单则同时更新 `careerPace.devChoiceWhitelist` |
| 加一个人物线拍 | `eventLines.lines[]`（第一人称 + 尾拍兜底 + setFlags 配读回点） | sync → 测试（含 themedBondLines 类断言） |
| **加一种选项门禁维度**（如「需持有某 bond」） | ① `sim.reqKeys` 注册求值函数 ② schema 文档（§4.4）③ 守卫测试（RNG-free + 提示文案） | 测试 |
| **加一种节点类型** | ① **在 `sim.careerNodeDetectors` 登记 `{id, test}`**（⚠️ 漏登记 = 该 queue 被 `skipToNextNode` 整份丢弃，静默失效）② 注意优先级位次 ③ 若产新 page type 走 §4.3 四步 | 一致性测试 |
| 加一个天赋 | `config.traits`（scope:"career"、axis、活键） | 守卫测试 `careerTraitsStayOnLiveKeys` |
| 加一类奖项 | `config.awards` + awards.js 评分维度核对（串味即 bug） | 测试 |
| 加一章 / 改章界 | `chapters.list`（章界与 P1 校验「每章 ≥5 家可入职」联动，现为 44~59 家） | validate（章覆盖 + 线×章） |
| 加一个结局 | `endings.list`（priority 即胜出顺序，req 复用 §4.4） | S1 分支测试 |
| 改数值公式（如销量曲线） | 先找「唯一入口」（§5.1 纯换算列），只改那一处 + config 参数 | 测试 + 灰盒统计 |
| 加一面 UI 屏 | `index.html` scene + paint 分支 + dock 按钮；遵守一屏不滚动/唯一金按钮/维度色 | 真机走查（含矮屏 ≤700px） |

---

## 8. 守护体系

### 8.1 已有纪律（铁律复述为架构约束）
生成物禁手改；JSON 精确替换写盘 + `json.loads` 复核；禁跑 `build_career_world.py`；同文件禁并行 Edit；文案第一人称与尾拍兜底。

**容易忘的硬规则（原文只在项目记忆里，2026-09-20 移到这里长期保存）**：

| 规则 | 为什么 |
|---|---|
| `development.cycleMult` 换算**唯一入口** `sim.titleDevStart`（`开工月 = 发售月 − round(原时长 × 1.75)`），**发售月永不动** | 目录档期是硬数据；两个入口必然分叉 |
| `titleCoversMonth` / `titleProgress` 的**第 5/6 形参是 `config`** | 漏传会静默退回未换算开工月（症状：offer 目标作品当月不在研）；覆盖是**闭区间** `[start, release]` |
| 池作的时长 / 命名 / 评语**必须确定性**（`hash32` FNV-1a + `mixSeed` xorshift + `pickBySeed` / 稳定哈希） | 用 `sim.pick` / `sim.irand` 会消费 RNG → 开局抽天赋与全部掷点位移、读档也漂 |
| 属性成长的唯一来源是 `grantMainStatAndXp`；产出倍率走 `sim.careerStatFactor` | 别写 `stat / attrRef` 裸线性（`statSoftCap` ref=100 / max=2） |
| `promotion.requirements[].mainStat`（28/34/41/51/60）是**硬门槛** | 削属性必须同步调门槛，否则升职节奏静默变化 |
| **均分 = 四家媒体落盘分的算术平均**（`shipPlayerTitle` 把 `media.avg` 写回 `rec.score`） | 榜单 / 奖项 / 销量 / 履历全读它；另算一份就会出现「四家都不是 10 分、均分却写 10」 |
| `joinCompany(st, companyId, roleId, titleId, config, studioId, source, offeredRank)` = **8 形参** | 改签名后要全仓 grep 每个调用点（删 salary 时曾有 2 处多传 `null` 使 `config` 收 null 崩掉） |
| 带 `speakerBond` 的拍渲染成 `名字：「body」`（`careerLines.js::queueItemForBeat`） | **body 必须是该角色第一人称台词**，人名一律用占位符 |
| 天赋「同收益轴最多一条」= `traitAxisDistinct`；守卫 `careerTraitsStayOnLiveKeys` | 主角天赋池 = `config.traits` 里 `scope:"career"` 的**恰 15 条**，整组生效、UI 无选择 |
| `skipIf.flagOn/flagOff/notHeld/notCollapse`：**写了 `setFlags` 必须配读回点**；末拍被 skip 会直接 `completeLine` | 尾拍陷阱 → 末尾留无条件兜底拍；`bonds.juniorCall` 靠 `wait.juniorInDev` + `skipIf.juniorCallGone` 防挂起 |
| 邀约 `rollInvitesThisMonth` **每年只掷一次**（存 `career.inviteYearHit`），挖人必成；**0% 通过率的 offer 不进跳槽表** | 开局三份 offer 按 `openingOffer.tiers`（small/stable/wild）加权抽；通过率 ×`mobility.hireChancePowerMul[power]`（大厂 0.62）+ `offerMinRankByPower` 硬门槛 |
| P1 归并序：`successorId` → 同 `publisherId` → 同 `seriesId` → **能力匹配**（`studios[].genreIds/gameplayIds` + `tags`）→ 同 region 兜底 | `career-world.json` 里的 `blurb` 保留**历史原始发行商**（如 `arkhamCity` 归到 `capcom` 但 blurb 仍写 Rocksteady）——**这是正确的归并结果，不是 bug** |
| 事件容器都在 `career-world.json`：`devEvents.list`(106) / `postLaunch.events`(15) / `producerEvents.list`(5) / `idleGap` / `eventLines.lines`(9 线) | 找事件别在 js 里翻 |

### 8.2 测试三层

| 层 | 工具 | 覆盖 | 何时跑 |
|---|---|---|---|
| 引擎 | `node tests/run-sim-tests.js`（vm 沙箱，与浏览器同代码同配置） | **85 条**：领域断言 + 加载列表同源 + API 面（**255 导出**）+ `sim._` 基座（**47 工具**）+ 目录一致性（窗口/唯一性/占位作）；v2 待加：一致性（逐月 vs 跳节点）、req RNG-free、健康无事件不变、双档颁奖来源正确 | 每次改动 |
| 数据 | `python scripts/validate_career_world.py`（**已落地**，进命令链） | 孤儿引用（含 successorId / 前辈落点）、每章 ≥5 家可入职、线×章覆盖、公司数与作品数区间 | 每次改 json |
| 真机 | `agent-browser-sandbox` skill | 一周目全流程、置灰截图、矮屏 | 涉及 UI 的 P 任务 |

`SIM_FILES`（测试加载列表）与 `index.html` script 顺序**必须同步**：新增域文件由 `split_career.py::sync_loaders()` 自动插入（幂等），**不要手改**；
顺序本身由测试里的 `loaderOrderInSync` 守卫逐项比对（本轮就抓到一处历史漂移：`media/awards` 与 `events/lifecycle` 互换，已按生产页顺序对齐）。

### 8.3 死配置登记（防复活）
已死：`playerXp.liveBonusCap|contribBonusCap|liveBonusPerXp|contribBonusPerXp`、`hireChanceByPower`、`colleagues.teamSize`、员工天赋池（无 scope 的 **7** 条，P2a 删 `thrifty`）。
P2 落地时**物理删除**（不是停用）并在此登记防复活：`personalEconomy` 全容器、`jobRanks.salaryFloor`、`company.salaryMult`、`traits.thrifty`、`livingCostMult` / `bondApartDelta` 键、`copy.career.{salaryLabel,livingLabel,savingsLabel,payDeltaPrefix,settleSavingsLabel}`、sim 侧 `careerSalaryFor` / `careerLivingCost` / `careerSalaryStepUp` / `snapCareerSalary`、state 的 `salary` / `savings` / `lastPay` / `funds`、UI 的 `#hq-funds` / `#hq-pay-delta` / `#end-sales`。守卫：`careerEconomyFullyRemoved`（四层断言）。
P2b 曾把 `virtualPool` 整块停用（`enabled:false`）；**P2-fix 已改名为 `titlePool` 并重新启用**（覆盖补全 + 入职兜底），守卫改为 `titlePoolCoversCompanyWithoutCatalogWork` / `titlePoolOffFallsBackToIdleGap`（关掉它即回到 P2b 行为）。
登记方式：本文档本节 + 对应守卫测试。

---

## 9. ADR（架构决策记录）

### ADR-001：保留全局命名空间 + script 顺序加载
- **Context**：无构建链，浏览器直跑，vm 沙箱测试同源。
- **Decision**：不引 ESM/打包器；模块 = IIFE 挂 `GDS.*`；依赖序 = script 顺序。
- **Consequences**：拆分 career.js 零工具成本、测试真机天然同源；代价是顺序靠纪律（§3.2-3），跨文件私有函数必须上门面。

### ADR-002：queue 作为 sim↔UI 唯一契约
- **Decision**：sim 产出 `{state, queue[]}`，UI 只消费 queue 播页、只调动作 API。
- **Consequences**：P3 节点推进、P5 双档颁奖、S1 结局页都归约为「新 page type + 注册」；UI 永远不含规则。代价：page type 注册有四步（§4.3），漏步即静默不显示——由一致性测试兜底。

### ADR-003：节点推进 = tick 循环的包装，结算永不旁路
- **Context**：P3 要求跳月，但中间月份成长/进度必须结算。
- **Decision**：`skipToNextNode` 只做「循环 + 分类」，不做任何结算；节点判定是纯函数探测器。
- **Consequences**：一致性测试（同 seed 两种驱动全等）成为可证明的属性而非祈祷；探测器顺序即设计语义（优先级），调优先级 = 调数组顺序。

### ADR-004：req 门禁 = 声明式 schema + 纯函数求值器 + 键注册表
- **Decision**：`req` 是数据不是代码；`evalReq` RNG-free；新维度走 `reqKeys` 注册。
- **Consequences**：S1 结局、S4 结局卡、5c 参选判定全部复用同一求值器；置灰提示与判定同源，永不同步漂移。代价：求值器要兼顾「生涯级 + 线级」两层 flag 视图，需注释写清。

### ADR-005：健康/声望 state 化，健康禁入质量公式
- **Decision**：`health` 只经 `applyHealthDelta` 写、只在事件路径调；`renown` 存累积值、档位派生；v2 禁止健康影响作品质量。
- **Consequences**：「无事件月份健康不变」可断言；称号链改阈值只动 `renownTiers` 数据。

### ADR-006：虚拟池开关下线，不删代码
- **Decision**（P2b → P2-fix 修订）：不引入 `features` 容器；池的开关落在 `titlePool.enabled` + `coverage/fallback` 两个策略子块。P2b 曾默认 off（空窗交给推进/抉择），P2-fix 因「公司全生命周期要有活可干」而重新打开，并把语义从「待命太久才长出的虚拟作」升级为「**顶空档的池作**」（覆盖补全 + 入职兜底）。
- **Consequences**：可灰度、可回滚（关 `titlePool.enabled` 即回 P2b，测试 `titlePoolOffFallsBackToIdleGap` 钉住）。P2-fix 当天池作占到 55% 的时间；**P2-fix-a/b 已把它压到 17.0%（目录真作 80.3%）**，并把剩下的池作从「惩罚线」改成中性偏好（成长/学分/叙事三处）。副作用是生涯曲线被抬高（关池 67.2 → 97.7，见 `REDESIGN-TASKS.md` P2-fix-a/b 的连锁效应表），P3 开工前需先拍板 `perDevMonth` 或晋升门槛。

---

## 附：落地顺序（P0 已完成，实测校正）

```
✅ P0（2026-09-20 完成，含实测校正）：
   · 依赖实测：0 个零切点 → 采用「叶子域摘除」而非硬拆 core/growth/projects 主干
   · 基础设施：sim._ 共享基座 + scripts/split_career.py（含加载列表自动同步）
                + API 面守卫（tests/sim-api-snapshot.json）+ scripts/validate_career_world.py
   · 已摘 3 域：colleagues / awards / events（career.js 5547 → 4865 行）
   · 76 条测试全绿

→ P1（数据归并，校验器已就位）→ P2（开关 + 删钱 + cycleMult，顺手摘 world-sim）
  → P3（摘 pace 域 + 一致性测试入列）→ P4（evalReq 进基座，健康/声望进成长域）
  → P5（chapters + awards 双档，awards 域已独立）→ P6（呈现层）→ P7（各 S 独立）→ P8
```
