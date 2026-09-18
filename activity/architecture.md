# 游戏开发物语 · 架构（对齐现行实现）

玩法以 `activity/design.md` 为准；生涯表以 `activity/career-world.json` 为准，生涯仍在消费的共享数值（天赋、Y 曲线、奖项、媒体、潮流、文案）在 `activity/config.json`。本文写目录、公开接口、存档字段和改数流程。

关联：`activity/requirements.md` · `activity/design.md` · `activity/config.json` · `activity/career-world.json` · `activity/README.md`

---

## 0. 落地形态

| 项 | 现行结论 |
|----|----------|
| 载体 | 单页活动 H5（`h5/index.html`），虎扑 App WebView / 移动浏览器；`file://` 可预览 |
| 时间 | 玩家点「下一月」才推进；**禁止**定时器自动过月 |
| 模拟 | 全部在客户端 `h5/js/sim/` 算，不依赖虎扑赛事/帖子接口 |
| 配置 | `activity/config.json` + `career-world.json` → sync 到 `h5/config.json` 与 `h5/js/config.generated.js` |
| 存档 | 已拍板云端：一用户一局 `game_saves`。本机 `ColorboxAI.storage` 只作缓存，禁止 `localStorage`。云环境开通后 `GET …/my/save`、`POST …/save/upsert` |
| 登录 | 写云档、起名过审需要登录。未登录 / 预览不把进度写进云 |
| 开局名 | 生涯档角色名默认「阿喵」，不要用公司名「喵扑studio」 |
| 分享 | 生涯结算不分享 |

经营局（社长/公司经营）已于 2026-09 整体移除：sim 只剩 `mode="career"` 一条路径，本文不再记录经营局接口与字段。

---

## 1. 页面 / 场景结构（单页场景栈）

一层主场景 + 弹层。返回用场景栈，不依赖浏览器前进后退来撤消过月。

```
启动
 └─ 生涯档：角色名（过审）→ 选擅长 → 三份 offer → 入职总览
      或 读档：PLAYING 进总览 / OFFER 回选 offer
      └─ 【主场景】职员总览（积蓄、声望、职称/职级代号、在研、同事、前辈）
            ├─ 情报弹层：发售情报（日历，目录作 + 系列版本「系列：版本名」）、生涯结算、再开一局
            ├─ 底栏：自身（含「履历」槽位）、排行榜、年度奖
            ├─ 点「下一月」→ 结算中（锁操作）
            │     ├─ 开发/热修事件（notice / choice）；制作人岗走 producerEvents
            │     ├─ 事件线拍子（careerLine / careerLineFork）；制作人虚拟作立项（producerPitch）
            │     ├─ 晋升（低职级当场升；4→5 / 5→6 开线）
            │     ├─ 年中挖人（接 / 留下）
            │     ├─ 12 月跳槽申请（过月弹窗，先选再申请，失败本年不能再投）
            │     ├─ 11 月：年度奖
            │     └─ 回到总览
            └─ 终局：2025 生涯结算
```

生涯档点月前可做：处理挖人、过月/事件线抉择。年底 offer 在 12 月过月弹窗里申请。达标后可点晋升或「成为制作人」（二者互斥，走 `requestCareerPromotion` / `startCareerLine`）。发售走目录月，不是玩家点发布。

入口去重约定：情报弹层里「履历」与「年度奖」隐藏——履历整合进「自身」页的 dock 槽位（`dom.js fillSubSlot`），年度奖有底栏 `#dock-tga-l1` 副本；「发售情报」无其他入口，必须保留在弹层里（`app.css` 有注释说明）。

---

## 2. 核心循环与状态机

### 2.1 局状态

```
BOOT ──► 生涯：ROLE → OFFER → PLAYING ──► MONTH_TICK ──► PLAYING
              │                              │
              │                              ├─ 开发/热修 / 事件线 / 挖人 / 跳槽 / TGA
              │                              └─ 已过 timeline 结束年月 ──► SETTLED
```

| phase | 含义 | 允许的操作 |
|-------|------|------------|
| `OFFER` | 生涯开局选 offer | 只许 `acceptOpeningOffer` |
| `PLAYING` | 月内 | 点月前操作 + 「下一月」 |
| `MONTH_TICK` | 正在走点月 | 抉择必须选完 |
| `SETTLED` | 终局 | 看说明，可再开一局 |

`createCareerGame` 写 `phase=OFFER`；入职后 `PLAYING`。UI 启动页不算进存档 phase。

### 2.2 点月管线

函数：`tickMonth(state, config) → { state, queue }`，是 `tickCareerMonth` 的直接委托（经营局分支已删）。入参不改，返回新 state。结算顺序见 design 第 5 节（11 步）。

随机走局内 `rngSeed` / `rngCount`。

### 2.3 存档 / 恢复

| 时机 | 行为 |
|------|------|
| 开局成功 / 每项点月前操作成功后 | 立即写档 |
| 一次点月 `queue` 全部展示完 | 写档 |
| 启动 | 云优先，否则 storage 缓存，再否则预览内存 |

再来一局覆盖旧档。本机写入走 `ColorboxAI.storage`，禁止 `localStorage` / `sessionStorage`。

---

## 3. 现行结构（view / sim / config）

```
activity/config.json          # 共享数值唯一源（天赋/生命周期/奖项/媒体/潮流/文案）
activity/career-world.json    # 生涯公司/作品/职级/前辈/事件线；sync 时并入 careerWorld
scripts/sync_config.py        # 同步生成物
scripts/build_career_world.py # 生成生涯目录（改完再 sync）
scripts/career_choice_events.py
tests/run-sim-tests.js        # 不启动浏览器的数值测试
h5/
  index.html                  # 结构 + 外链 css/js
  config.json                 # sync 拷贝
  css/app.css
  js/
    config.generated.js       # file:// 可读的 GDS.CONFIG
    sim/                      # 纯逻辑
    ui/                       # 只画和点（含 reveal.js 揭晓动效）
    save/port.js              # persist / restoreOrNull
    bridge/colorbox.js        # ColorboxAI 封装
```

`ui/`：`dom.js` `reveal.js` `paint.js` `app.js`。媒体评分与颁奖夜揭晓只在 UI，不改 sim。

`sim/` 文件（11 个）：`ns.js` `rng.js` `util.js` `events.js` `lifecycle.js` `media.js` `awards.js` `career.js` `careerLines.js` `tick.js` `actions.js`。经营局专属的 `company.js` / `staff.js` / `project.js` / `versions.js` / `series.js` / `rivals.js` 已随经营局移除。

| 层 | 职责 | 禁止 |
|----|------|------|
| **config** | 共享数值在 `activity/config.json`；生涯公司/作品/薪资/跳槽/前辈/职级代号/事件线/制作人规则在 `activity/career-world.json` | 在 HTML / UI / sim 里再写一套平衡数字 |
| **sim/** | 下节公开函数 | `document`、`window.ColorboxAI`、存档 IO、`fetch` |
| **ui/** | 场景、按钮、弹层 | 在 click handler 里改 state 数值 |
| **save/ + bridge/** | 云档、storage 缓存、审核 | `localStorage` / `sessionStorage`；假后端 |

动作校验失败 `{ ok:false, error }`，不改入参 state。

### 改数值

1. 只改 `activity/config.json`（生涯作品、职级、事件线改 `activity/career-world.json`）。
2. `python scripts/sync_config.py`
3. `node tests/run-sim-tests.js`（必须绿）

Windows 可用 `python`；若失败再试 `python3`。

---

## 4. 数据层

部署决策已拍板：**云端保存**。云环境开通放部署阶段；未开通时读云失败不改用 `localStorage`，预览用内存 + storage 缓存。

### 4.1 只放在客户端

玩法模拟、当月 UI 过程量、打包配置、占位图。

### 4.2 要持久化的

第 7 节 `GameState`：`career`、`worldReleased`、`companyXp` / `studioXp`、`trend`、`firedEventIds`、`lastMedia` / `lastAwards` / `awardsHistory` 等；`rngSeed`、`phase`、`mode`。

### 4.3 本机缓存

- 写：`ColorboxAI.storage.setValue`
- 读：`ColorboxAI.storage.getValue`
- 禁止原生 `localStorage`

### 4.4 云端（已拍板，环境未开通）

- 登录后 `ColorboxAI.cloud.auth`，再 `cloud.request`
- 表 `game_saves`：一人一条（`unique puid`）
- 读：`GET {apiBase}/my/save`；写：`POST {apiBase}/save/upsert`（body 含 `saveJson`，不带身份字段）
- `h5/index.html` 里 `ACTIVITY_API_BASE` / `ACTIVITY_ENV_ID` 现为空；有值且 Colorbox 就绪才 `canCloud()`

### 4.5 明确不做

全站排行、抽卡、PK 投票、采集手机号、120 个月流水上云。

---

## 5. 虎扑能力接入点

| 能力 | 现行 |
|------|------|
| 活动页存储 读/写 | 要（缓存 / 预览） |
| 云鉴权 + 云请求 | 桥已接；env 空时不真正打云 |
| 文本安全审核 | 生涯角色名走 `security.checkAudit`；预览无 SDK 视为通过 |
| 分享 / 海报 / 排行榜 / 抽卡 / PK | 不做 |
| 篮球/足球/帖子接口 | 不做 |

业务请求走 `ColorboxAI.cloud.request` / `ColorboxAI.request`，禁止 `fetch`、XHR、Axios、WebSocket。

---

## 6. 安全与发布

资源/接口域名仅虎扑域；`sim/` 不联网；禁止 `localStorage`、内联脚本、`eval`、iframe、外域跳转、设备敏感 API。玩家输入当文本节点，不 `innerHTML` 拼接。

---

## 7. 关键数据模型（与 sim 字段对齐）

**两套四维是分开的**：**人物维** `program` / `design` / `art` / `music`（员工数据里策划写作 `script`，由 `sim.personStatVal` 统一收口；维度表 `careerWorld.quality.personDims`）；**作品维** `play` / `fun` / `expression` / `immersion`（维度表 `careerWorld.quality.dims`）。两者靠 `careerWorld.quality.personToTitle` 系数矩阵换算。换算入口只有一个：`sim.titleStatsFromPerson(personStats, config, mult, matrixOverride)`（人物→作品）；**不要跨套索引**。`id` 均为局内字符串。`createCareerGame` 写 `careerWorld.save.version`（现行 10：职级/履历为 9，事件线/制作人为 10）。

### 7.1 GameState（career）

| 字段 | 说明 |
|------|------|
| `saveVersion` | 读 `careerWorld.save.version` |
| `mode` | 恒为 `"career"` |
| `phase` | `OFFER` / `PLAYING` / `SETTLED`（+ 过月瞬时 `MONTH_TICK`） |
| `rngSeed` `rngCount` | 局种子与已取随机次数 |
| `year` `month` | 见 `careerWorld.timeline`（1995.01–2025.12） |
| `career` | 见 7.1b |
| `worldReleased` | 世界已发售作品记录；目录作四维进局时先按 `quality.eraStatScale` 乘发售年，再按 `quality.statJitterMinPct`～`MaxPct` 整数百分比浮动后向上取整 |
| `companyXp` `studioXp` | 公司/工作室题材·玩法经验桶 |
| `company` | **仅 UI 镜像**：`name` 存角色名、`funds` 存积蓄，复用总览展示，不代表开了一家公司 |
| `trend` `trendWait` | 热点与距离下次随机刷新 |
| `firedEventIds` | 已触发的事件 |
| `monthChart` | 最近一次点月的榜快照（本月 `worldReleased` 按实销排） |
| `lastMedia` `lastAwards` `awardsHistory` | 最近一次发售/颁奖展示；`awardsHistory` 为 `{ year, awards }[]`，年度奖页按年回看 |
| `settlement` | 终局才有（UI 可从当前快照拼） |

### 7.1b Career

| 字段 | 说明 |
|------|------|
| `characterName` `roleId` | 角色名与锁定岗（`programmer` / `design` / `art` / `music`） |
| `companyId` `studioId` | 当前东家与工作室 |
| `savings` `salary` `lastPay` | 积蓄、当月档位薪、本月入账（镜像到 `company.funds`） |
| `fame` `honor` `growthStage` | 声望、荣誉、阶段（`employee` / `producer`；`founder` 本版锁定） |
| `jobRank` `jobTitleId` `jobXp` | 专精职级 1–6、当前职称 id、职级经验；转制作人后仍保留 `jobRank` |
| `lines` | 事件线进度：`{ [lineId]: { beat, flags, startedAt, status, waitUntil?, waitingFor?, pending?, abortedYear?, remotePending?, waitUntilYear? } }`。多条可同时 `active` |
| `bonds` | 持久人物：`mentor` / `peer` / `junior`（跳槽保留）。junior 可有 `aliasThen` / `aliasNow` |
| `lineStartRolls` | 可选线开线掷骰年份戳 |
| `producerPitchOptions` | 制作人虚拟作立项选项；选完清空 |
| `producerAskCount` | 成为制作人已询问次数；满 `maxAsks` 后不再问 |
| `pendingStoryPromos` | 故事晋升推迟到次年 1 月的队列 |
| `tenures` | 任职记录：公司/工作室/`roleId`/`jobRank`/职称 id/起止年月/起止薪/`source`（opening / hop / invite / promotion / producer） |
| `monthsInRank` `promotionsThisYear` `lastPromotionYear` | 任现职月数、本年已晋升次数、上次晋升年份 |
| `titleId` `liveStats` `stats` | 当前作品 id；`liveStats` 是**作品维**四维（`play`/`fun`/`expression`/`immersion`）；`stats` 是**人物维**四维（`program`/`design`/`art`/`music`，主职维会涨） |
| `postLaunch` | `{ titleId, monthsLeft }`；发售后热修 |
| `credits` | 作品履历：`titleId` / 公司工作室 / `roleId` / 当时 `jobRank` / 加入离开年月 / `shipped` 署名发售 / `supported` 后续支持 / `virtual` / 口碑 `score` / `mainStatDelta` / `awards`。中途跳槽保留条目但 `shipped=false` |
| `openingOffers` `yearEndOffers` `invites` | 开局三份 / 年底 4 格 / 年中挖人；挖人默认接或留下（`mobility.inviteCanCounter` 现为 false）；挖人与跳槽 `roleId` 按 `mobility.*RoleWeights` 抽，制作人岗需 `become-producer` 线 done |
| `colleagues` `colleaguePool` | 当前 5 人组与公司同事池。同事条目：`id` `n` `roleId` `stats` `jobRank`。池按东家 `power` 从 `colleagues.byPower` 抽，不读当前 `title.stats` |
| `virtualProjects` `virtualDetails` | 空窗虚拟作 |
| `genreXp` `gameplayXp` | 玩家个人熟练度 |
| `idleMonths` `hopFailedYear` `hopNotice` | 空窗计数、本年跳槽失败、提示 |

### 7.2 只读展示接口

```
monthlyChart(state, config) → [{ rank, source, title, pub, monthSales, avg, platformId }]
salesFactor(m, score, config) → number   # Y(m)
isCareerMode(state) → boolean
careerYearReleases(year, config, state) → { year, months }
careerProjectView(state, config) → { title, phase, idle, postLaunch, ... }
careerSkillLines(state, config) → [{ label, xp, tier }]   # 总览摘要
careerSkillSheet(state, config) → { genres, gameplay }   # 详情页全表，档位无经验值
careerHireChance(company, state, config, studio?, title?) → number  # 含题材/玩法熟练度加成
careerPlayableRoles(config) / careerCopy(config)
careerJobTitle(state, config) / careerJobTitleLabel(state, config)
formatCareerRankLabel(roleId, rank, config) / careerRankCode(roleId, rank, config) / careerJobTitleDisplay(state, config)
liveToPublicScore / careerMonthlyContribution / careerMonthlyContributionByDim / catalogTitleBaseStats / careerCraftPublicScore / scoreMediaFromPublic
careerLaunchSales(title, publicScore, config, liveStats) → { baselineSales, launchSales }  # 生涯首月实销：口碑系数×Y(1)
careerSeniors(company, config) / careerSeniorLine(company, config)
careerPromotionView(state, config) → { can, rank, gaps, currentLabel, nextLabel }
careerResumeView(state, config) → { tenures, credits, jobLabel, rank }
careerSettlementView(state, config) → { characterName, jobLabel, fame, honor, creditedCount, savings, employer }
canPromoteCareer(state, config) → boolean
promotionUsesEventLine(state, config) / canStartBecomeProducerLine(state, config) / isCareerProducer(state)
listAwardsHistory(state, config) → [{ year, awards }]   # 数据新在前；无历史时用 lastAwards 兜底。年度奖页年份钮按升序横排可左右滑，点年份只渲染该届
isLiveOpsTitle(g) → boolean
liveOpsAwardEligible(g, year, config) → boolean   # 窗口内发售的长线标记作品
# 注：「系列：版本名」由 `liveTag.labelPattern` 在目录预填时生成（career-world.json 带 versionOf 的条目）；「长线」标记文案读 `copy.liveTagLabel`（UI 层用），两者都不是 sim 函数
```

### 7.3 逻辑接口（UI 只调这些改 state）

```
createCareerGame(characterName, roleId, config) → GameState   # phase=OFFER，已掷 openingOffers
acceptOpeningOffer(state, offerId, config)
resolveEventChoice(state, eventId, optionId, config) → { ok, state, bits?, error? }
  # career 模式内部转到 resolveCareerEventChoice；事件线/制作人立项也会走这里
resolveCareerLineChoice(state, lineId, beatId, optionId, config)
resolveCareerPathFork(state, optionId, config)
resolveProducerPitch(state, optionId, config)
startCareerLine(state, lineId, config)
requestCareerPromotion(state, config) → 低职级当场升；4→5/5→6 开晋升事件线
kickOutOfCareerCompany(state, config) → 清当前 tenure，进求职；由线效果 `kickOut` 触发
tickMonth(state, config) → { state, queue }   # = tickCareerMonth；合并/远程打断走 careerLine，仍由 resolveCareerLineChoice 结算
tickCareerToDecision(state, config) → { state, queue, skippedMonths, from, to }
  # 连跑 tickCareerMonth 直到抉择页 / 终局 / careerPace.maxSkipMonths；≥summaryMinSkipped 时前置 paceSkip 摘要
careerQueueNeedsDecision(queue, config) → boolean  # 只读：queue 是否含需停下的页
applyYearEndOffer / acceptYearEndOffer(state, offerId, config) → { ok, state, hopped?, notice? }
declineYearEndOffers(state, config)
acceptCareerInvite / counterCareerInvite / declineCareerInvite(state, inviteId, config)
  # 挖人默认只有接或留下；counterCareerInvite 仅当 mobility.inviteCanCounter=true
promoteCareer(state, config) → { ok, state }   # 低职级点一次才升；高级及以上请用 requestCareerPromotion / 事件线
errorMessage(error) → string
```

`queue` 项：`notes` / `event`（`presentation: notice|choice`）/ `awards` / `media`（目录发售）/ 生涯 `hop` / `invite` / `promotion` / `careerLine` / `careerLineFork` / `producerPitch` / `paceSkip`（跳空月摘要）。挖人接完后若 `yearEndOffers` 已空，UI 跳过随后的跳槽页。

ERR 码：`EVENT_NOT_FOUND` / `EVENT_NOT_CHOICE` / `EVENT_OPTION_INVALID` + `CAREER_*` 系列（见 `ns.js`）。

### 7.4 生涯事件线（`career-world.eventLines`）

表驱动，实现在 `h5/js/sim/careerLines.js`。进度只写 `career.lines`，拍子入现有点月 queue。

| 项 | 说明 |
|----|------|
| `maxBeatsPerMonth` | 默认每月最多 1 拍；`beat.wait.type=sameMonthChain` 可同月连拍 |
| `exclusiveGroup: careerPath` | 仅职业轨互斥：晋升 4→5 / 5→6 与 `become-producer`。人物/史诗/回国线不要进该组 |
| `lines[]` | `{ id, kind, fromRank/toRank 或 minRank, exclusiveGroup?, priority, maxAsks?, reopen?, startWhen, beats[] }`；`become-producer.maxAsks` 限制询问次数 |
| `beats[].wait.type` | `immediate` / `months` / `onShip` / `yearEnd` / `sameMonthChain` |
| 效果 | 升职、改岗、kickOut、钉 bond、storyPromo、开制作人立项等；踢出走 `kickOutOfCareerCompany` |

可选五条（前辈 / 同事 / 后辈 / 史诗作 / 回国）用 `startWhen` 权重，一局可走完 0～5 条。东家 `hireUntilYear` + `successorId` 的合并抉择是当月打断，不算第六条可选线。

---

## 8. 实现进度与非目标

已接到点月循环，并拆成 view / sim / config。现行页面默认生涯档（1995 入职）。云表与读写骨架已有，环境未开通。浏览器直接打开是预览模式。

第一版仍不做：开通云环境（等部署阶段）、联机、付费抽奖、真排行、海报发帖、1985 更早档、生涯档自己开公司、自动过月、岗位编制、培训界面、虎扑赛事接口、精细立绘。

**已废规则不要复活：** 经营局（社长/招人/立项/发布/待发售/外包/对手/破产/份额/广告/工作室/自研主机）、自动发售、指数长尾、`launchSales` 当后续乘数、PS4/Xbox 玩家选项、12 月 TGA、制作人 2:1 三项合计、制作人专属换算矩阵。

---

## 9. 已定案

1. 关掉再打开自动记录进度。
2. 生涯结算不分享。
3. 生涯档角色名默认「阿喵」，不要用公司名。
4. 存储方式：云端。云环境开通与回写地址：部署阶段再做。全站排行第一版不做。
5. 现行 H5 只有一条生涯档路径；经营局逻辑已整体移除（2026-09），不要复活。
