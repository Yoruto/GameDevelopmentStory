# 游戏开发物语 · 架构（对齐现行实现）

玩法以 `activity/design.md` 为准；经营数字以 `activity/config.json` 为准，生涯表以 `activity/career-world.json` 为准。本文写目录、公开接口、存档字段和改数流程。

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
| 开局名 | 生涯档角色名默认「阿喵」；经营局公司名默认「喵扑studio」，可改 |
| 分享 | 生涯结算不分享 |

---

## 1. 页面 / 场景结构（单页场景栈）

一层主场景 + 弹层。返回用场景栈，不依赖浏览器前进后退来撤消过月。

```
启动
 └─ 生涯档：角色名（过审）→ 选擅长 → 三份 offer → 入职总览
      或 读档：PLAYING 进总览 / OFFER 回选 offer
      └─ 【主场景】职员总览（积蓄、声望、主职、在研、同事、年底 offer）
            ├─ 情报：发售日历（目录作 + 移动端长线版本）、年度奖
            ├─ 点「下一月」→ 结算中（锁操作）
            │     ├─ 开发/热修事件（notice / choice）
            │     ├─ 年中挖人（接 / 还价 / 留下）
            │     ├─ 12 月跳槽申请（先选再申请，失败本年不能再投）
            │     ├─ 11 月：年度奖
            │     └─ 回到总览
            └─ 终局：2025 生涯结算
经营局 sim 仍保留招人/立项/待发售/破产，本版 H5 不入口。
```

生涯档点月前可做：申请年底 offer、处理挖人、过月抉择。经营局点月前可做：招人/辞退、换场地、广告、立项、**发布待发售**、长线排人/关服、开工作室。推进在研 ≠ 自动发售。

---

## 2. 核心循环与状态机

### 2.1 局状态

```
BOOT ──► 生涯：ROLE → OFFER → PLAYING ──► MONTH_TICK ──► PLAYING
              │                              │
              │                              ├─ 开发/热修 / 挖人 / 跳槽 / TGA
              │                              └─ 已过 timeline 结束年月 ──► SETTLED
（经营局 sim：NEW_GAME 直接 PLAYING；funds<0 → BANKRUPT）
```

媒体评分面板在经营局玩家点 `releaseGame` 成功后弹出。移动端长线**大版本**发售也会在点月 queue 里带媒体分。生涯档发售走目录月，媒体/奖项进 queue。

| phase | 含义 | 允许的操作 |
|-------|------|------------|
| `OFFER` | 生涯开局选 offer | 只许 `acceptOpeningOffer` |
| `PLAYING` | 月内 | 点月前操作 + 「下一月」 |
| `MONTH_TICK` | 正在走点月 | 禁止再点经营按钮；抉择必须选完 |
| `BANKRUPT` / `SETTLED` | 终局 | 看说明，可再开一局 |

`createCareerGame` 写 `phase=OFFER`；入职后 `PLAYING`。`createNewGame` 直接 `PLAYING`。UI 启动页不算进存档 phase。

### 2.2 点月管线

函数：`tickMonth(state, config) → { state, queue }`。入参不改，返回新 state。`mode=career` 时整段 `tickCareerMonth`（design 9.2）。经营局顺序与 design 第 9 节一致：

1. 推进在研 + 长线维护产出  
2. 潮流刷新 → 当月事件（historical + random；choice 只入队）  
3. 对手按日历本月计划出货  
4. 自制进 `readyToShip`；外包自动交付  
5. 盒装 lifecycle（玩家+对手）+ 长线月结 + 移动端长线版本发售 → `monthlyChart`  
6. 发薪；资金 < 0 → `BANKRUPT`  
7. 若本月 = `awards.month`：TGA（盒装看发售窗口；最佳长线看仍在运营）  
8. 人才市场刷新  
9. 日历 +1；跨年调薪并生成新年对手日历；过结束年月 → `SETTLED`

随机走局内 `rngSeed` / `rngCount`。人才市场当月名单存在 `talentMarket` + `talentStamp`。

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
activity/config.json          # 数值唯一源
activity/career-world.json    # 生涯公司/作品表；sync 时并入 careerWorld
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
    ui/                       # 只画和点
    save/port.js              # persist / restoreOrNull
    bridge/colorbox.js        # ColorboxAI 封装
```

`sim/` 文件：`ns.js` `rng.js` `util.js` `company.js` `staff.js` `project.js` `liveops.js` `series.js` `rivals.js` `events.js` `lifecycle.js` `media.js` `awards.js` `career.js` `tick.js` `actions.js`。

| 层 | 职责 | 禁止 |
|----|------|------|
| **config** | 经营数字在 `activity/config.json`；生涯公司/作品/薪资/跳槽在 `activity/career-world.json` | 在 HTML / UI / sim 里再写一套平衡数字 |
| **sim/** | 下节公开函数 | `document`、`window.ColorboxAI`、存档 IO、`fetch` |
| **ui/** | 场景、按钮、弹层 | 在 click handler 里改资金 / 员工 / 项目 / 质量 |
| **save/ + bridge/** | 云档、storage 缓存、审核 | `localStorage` / `sessionStorage`；假后端 |

动作校验失败 `{ ok:false, error }`，不改入参 state。

### 改数值

1. 只改 `activity/config.json`（生涯作品改 `activity/career-world.json`）。  
2. `python scripts/sync_config.py`  
3. `node tests/run-sim-tests.js`（必须绿）

Windows 可用 `python`；若失败再试 `python3`。

---

## 4. 数据层

部署决策已拍板：**云端保存**。云环境开通放部署阶段；未开通时读云失败不改用 `localStorage`，预览用内存 + storage 缓存。

### 4.1 只放在客户端

玩法模拟、当月 UI 过程量、打包配置、占位图。

### 4.2 要持久化的

第 7 节 `GameState`：经营局公司/员工/在研/待发售；生涯档另有 `career`、`worldReleased`、`companyXp` / `studioXp`。`rngSeed`、`phase`、`mode`。

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
| 文本安全审核 | 生涯角色名、经营局公司名/游戏名/工作室名走 `security.checkAudit`；预览无 SDK 视为通过 |
| 分享 / 海报 / 排行榜 / 抽卡 / PK | 不做 |
| 篮球/足球/帖子接口 | 不做 |

业务请求走 `ColorboxAI.cloud.request` / `ColorboxAI.request`，禁止 `fetch`、XHR、Axios、WebSocket。

---

## 6. 安全与发布

资源/接口域名仅虎扑域；`sim/` 不联网；禁止 `localStorage`、内联脚本、`eval`、iframe、外域跳转、设备敏感 API。玩家输入当文本节点，不 `innerHTML` 拼接。

---

## 7. 关键数据模型（与 sim 字段对齐）

四维键名：`program` / `script` / `art` / `music`。生涯 live 四维也用 `program`/`design`/`art`/`music`（策划对员工 `script`）。`id` 均为局内字符串。`createNewGame` 写 `saveVersion: 4`；`createCareerGame` 写 `careerWorld.save.version`（现行 8）。

### 7.1 GameState

| 字段 | 说明 |
|------|------|
| `saveVersion` | 经营局 4；生涯档读 `careerWorld.save.version` |
| `mode` | `"career"` 为生涯档；缺省/其他为经营局 |
| `phase` | 经营局：`PLAYING` / `BANKRUPT` / `SETTLED`。生涯档另有开局 `OFFER` |
| `rngSeed` `rngCount` | 局种子与已取随机次数 |
| `year` `month` | 经营局见 `config.calendar`；生涯档见 `careerWorld.timeline` |
| `career` | 仅生涯档，见 7.1b |
| `worldReleased` | 生涯档世界已发售（含长线版本字段） |
| `companyXp` `studioXp` | 生涯档公司/工作室题材·玩法经验桶 |
| `company` | 见下 |
| `staff` | 在职 |
| `studios` | 无则为 `[]` |
| `projects` | 在研 |
| `readyToShip` | 自制已完工、尚未发布 |
| `released` | 已发售档案（含外包交付记录） |
| `series` | |
| `talentMarket` `talentStamp` | 当月可雇与年月戳 |
| `trend` `trendWait` | 热点与距离下次随机刷新 |
| `firedEventIds` | 已触发的历史事件 |
| `rivalCalendar` | `{ year, months: { 1..12: RivalPlan[] } }`；开局生成当年，12→1 生成新年 |
| `rivalCalendarHold` | 跨年改期暂存 |
| `rivalReleased` `rivalMonth` `rivalWindow` | 对手在售 / 本月出货 / 颁奖窗口 |
| `rivalLifetimeByPlatform` | `{ console, pc, mobile }` 累计出货 |
| `rivalPlan` `rivalWait` `rivalSequel` `rivalForceSeries` | 管线辅助 |
| `monthSales` `monthChart` | 最近一次点月的本公司销量与榜快照 |
| `lastMedia` `lastAwards` | 最近一次发布/颁奖展示 |
| `settlement` | 终局才有（UI 可从当前快照拼） |

**已废存档形状（不要再写进新档）：** `adBuff` 对象、`unlockedPlatformIds`、`ownConsoleUnlocked`（改用 `company.adOn` / `company.ownConsole`）、`tailLeft` 作为规则、用 `launchSales` 当后续乘数。

### 7.1b Career（仅 `mode=career`）

| 字段 | 说明 |
|------|------|
| `characterName` `roleId` | 角色名与锁定岗（`programmer` / `design` / `art` / `music`） |
| `companyId` `studioId` | 当前东家与工作室 |
| `savings` `salary` `lastPay` | 积蓄、当月档位薪、本月入账（镜像到 `company.funds`） |
| `fame` `honor` `growthStage` | 声望、荣誉、阶段（本版 `employee`） |
| `titleId` `liveStats` `stats` | 当前在研/后续支持作与 live 四维 |
| `postLaunch` | `{ titleId, monthsLeft }`；发售后热修 |
| `credits` | 署名履历 |
| `openingOffers` `yearEndOffers` `invites` | 开局三份 / 年底 5 格 / 年中挖人 |
| `colleagues` `colleaguePool` | 当前 5 人组与公司同事池 |
| `virtualProjects` `virtualDetails` | 空窗虚拟作 |
| `genreXp` `gameplayXp` | 玩家个人熟练度 |
| `idleMonths` `hopFailedYear` `hopNotice` | 空窗计数、本年跳槽失败、提示 |

生涯档 `company.name` 存角色名，`company.funds` 存积蓄，只为复用总览 UI，不表示开了一家公司。

### 7.2 Company

| 字段 | 说明 |
|------|------|
| `name` | 经营局默认 `config.company.defaultName`；生涯档为角色名 |
| `funds` | 整数；`< 0` 破产 |
| `scale` | `"small"` \| `"medium"` \| `"large"` |
| `fans` | 声望/保底销量 |
| `adOn` | 是否加持下一款真正发布 |
| `ownConsole` | 大公司且粉丝 ≥ `unlockOwnConsoleMinFans` 后为 true |

雇佣人数不得超过 `config.company.scales[scale].maxStaff`。

### 7.3 Staff

实现字段名是 `n`（姓名），不是 `name`。另有 `level` `exp` `program` `script` `art` `music` `traits` `honor` `salary` `monthsEmployed` `status`（`idle` / `dev` / `liveops`）`assignmentId` `isStudioLead`。

### 7.4 Project / readyToShip

`releaseType`：`boxed` / `liveops` / `outsource`。`platformId` 只能是 `console` / `pc` / `mobile`。`monthsLeft` 到 0 后自制进 `readyToShip`，外包走 `releaseOutsource`。配置 `release.readyToShipMax` 现行 sim 未强制。

### 7.5 ReleasedGame

| 字段 | 说明 |
|------|------|
| `media` | `{ rows, avg, quote }`；外包为 null，`avg` 为 0 |
| `baselineSales` | 发售公式写入的参照。后续月只用它 × Y(m) |
| `launchSales` | 发售当月**实销**。可被当月事件改，不回写基准 |
| `lifetimeSales` `monthSales` `onSale` | 累计、本月实销、是否在售 |
| `monthSalesForYear` `monthSalesForMonth` | 本月实销已入账的戳，避免发售当月点月再加一遍 |
| `outsourceFee` | 仅外包 |
| `liveOps` | `{ active, maintainerIds, monthsLive, peak, versionMajor, versionMinor, closedYear, closedMonth }`；月开支与版本间隔读配置不存档 |
| `versionMajor` `versionMinor` | 长线当前版本；1.0 是首发。移动端长线才推进 |
| `lastVersionYear` `lastVersionMonth` | 最近一次版本发售年月；同月不重复发 |

旧档缺 `baselineSales` 时从 `launchSales` 迁移。`tailLeft` 在 tick 时忽略。缺版本字段的旧长线按 1.0 展示，到点再发下一版。

### 7.6 只读展示接口

```
marketShares(state, config) → [{ id, displayName, playerSales, rivalSales, share }]
monthlyChart(state, config) → [{ rank, source, title, pub, monthSales, avg, platformId }]
salesFactor(m, score, config) → number   # Y(m)；掉榜看它
boxedBaselineFormula(st, project, config, consumeAd?) → number
getRivalCalendar(state, year) → { year, months }
listLiveOpsVersionDrops(state, year, config) → [{ month, label, isVersion, ... }]
liveOpsVersionLabel(title, ver, config) → string
isLiveOpsTitle(g) → boolean
liveOpsAwardEligible(g, year, config) → boolean
isCareerMode(state) → boolean
careerYearReleases(year, config, state) → { year, months }
careerProjectView(state, config) → { title, phase, idle, postLaunch, ... }
careerSkillLines(state, config) → [{ label, xp, tier }]
careerPlayableRoles(config) / careerCopy(config)
```

### 7.7 逻辑接口（UI 只调这些改 state）

```
createNewGame(companyName, config) → GameState
createCareerGame(characterName, roleId, config) → GameState   # phase=OFFER，已掷 openingOffers
acceptOpeningOffer(state, offerId, config)
hire / fire / relocate / buyAd
foundStudio(state, name, leadId, config)
pitchProject / pitchOutsource
assignLiveOps / shutdownLiveOps
releaseGame(state, gameId, config) → { ok, state, rec?, error? }
resolveEventChoice(state, eventId, optionId, config) → { ok, state, bits?, error? }
  # 生涯档内部转到 resolveCareerEventChoice
tickMonth(state, config) → { state, queue }
  # mode=career 时整段 tickCareerMonth
applyYearEndOffer / acceptYearEndOffer(state, offerId, config) → { ok, state, hopped?, notice? }
declineYearEndOffers(state, config)
acceptCareerInvite / counterCareerInvite / declineCareerInvite(state, inviteId, config)
startNewRun(companyName, config) → GameState   # 等同 createNewGame
errorMessage(error) → string
```

`applyLongTail` 是 `tickLifecycle` 的兼容别名，不是指数长尾，UI 不要调用。

生涯档 UI **不要**调 `hire` / `pitchProject` / `releaseGame` / `relocate` 等经营接口；点月仍只调 `tickMonth`。

`PitchInput`：`title, genreId, gameplayId, platformId, releaseType, cycle, producerId, memberIds, seriesId?, studioId?`。

`queue` 项：`notes` / `event`（`presentation: notice|choice`）/ `rivals` / `ready` / `outsource` / `awards` / `media`（长线大版本）/ 生涯跳槽与挖人页。自制首发媒体分仍在 `releaseGame` 成功后由 UI 弹出。

---

## 8. 实现进度与非目标

已接到点月循环，并拆成 view / sim / config。现行页面默认生涯档（1995 入职）。云表与读写骨架已有，环境未开通。浏览器直接打开是预览模式。

第一版仍不做：开通云环境（等部署阶段）、联机、付费抽奖、真排行、海报发帖、经营局 2005/1985 更长档、生涯档当制作人/自己开公司、自动过月、岗位编制、培训界面、虎扑赛事接口、精细立绘。

**已废规则不要复活：** 自动发售、指数长尾、`launchSales` 当后续乘数、PS4/Xbox 玩家选项、N/S 社仅两家简表、12 月 TGA、制作人 2:1 三项合计。

---

## 9. 已定案

1. 关掉再打开自动记录进度。  
2. 生涯结算不分享。  
3. 经营局公司名默认「喵扑studio」，玩家可改。生涯档角色名默认「阿喵」，不要用公司名。  
4. 存储方式：云端。云环境开通与回写地址：部署阶段再做。全站排行第一版不做。
5. 现行 H5 入口是生涯档；经营局逻辑保留在 sim。
