# 游戏开发物语 · 架构（对齐现行实现）

玩法以 `activity/design.md` 为准；数字以 `activity/config.json` 为准。本文写目录、公开接口、存档字段和改数流程。

关联：`activity/requirements.md` · `activity/design.md` · `activity/config.json` · `activity/README.md`

---

## 0. 落地形态

| 项 | 现行结论 |
|----|----------|
| 载体 | 单页活动 H5（`h5/index.html`），虎扑 App WebView / 移动浏览器；`file://` 可预览 |
| 时间 | 玩家点「下一月」才推进；**禁止**定时器自动过月 |
| 模拟 | 全部在客户端 `h5/js/sim/` 算，不依赖虎扑赛事/帖子接口 |
| 配置 | `activity/config.json` → sync 到 `h5/config.json` 与 `h5/js/config.generated.js` |
| 存档 | 已拍板云端：一用户一局 `game_saves`。本机 `ColorboxAI.storage` 只作缓存，禁止 `localStorage`。云环境开通后 `GET …/my/save`、`POST …/save/upsert` |
| 登录 | 写云档、起名过审需要登录。未登录 / 预览不把进度写进云 |
| 公司名 | 玩家自己写；开局默认「喵扑studio」，可改 |
| 分享 | 生涯结算不分享 |

---

## 1. 页面 / 场景结构（单页场景栈）

一层主场景 + 弹层。返回用场景栈，不依赖浏览器前进后退来撤消过月。

```
启动
 └─ 开局（公司名默认「喵扑studio」）或 读档进总览
      └─ 【主场景】公司总览
            ├─ 人才市场（招人 / 辞退）
            ├─ 换场地 / 广告营销
            ├─ 立项向导（题材+玩法 → 三端 / 普通·长线·外包 / 周期 → 组队）
            ├─ 在研详情：待发售列表与「发布」
            ├─ 长线维护 / 关服
            ├─ 成立内部工作室（仅大公司）
            ├─ 情报：三端份额、畅销榜、发售日历、对手月活
            ├─ 点「下一月」→ 结算中（锁操作）
            │     ├─ 事件（notice 确认 / choice 必须选）
            │     ├─ 外包交付 / 制作完成尚未发布
            │     ├─ 11 月：年度奖
            │     └─ 回到总览
            └─ 终局：生涯结算或破产
```

点月前可做、不插进自动结算：招人/辞退、换场地、广告、立项、**发布待发售**、长线排人/关服、开工作室。推进在研 ≠ 自动发售。

---

## 2. 核心循环与状态机

### 2.1 局状态

```
BOOT ──► NEW_GAME ──► PLAYING ──► MONTH_TICK（锁 UI）──► PLAYING
              │                      │
              │                      ├─ 弹出 EVENT / 外包 / 待发售提示 / TGA
              │                      ├─ funds < 0 ──► BANKRUPT
              │                      └─ 已过结束年月 ──► SETTLED
```

媒体评分面板在玩家点 `releaseGame` 成功后弹出，**不**在点月自动队列里。

| phase | 含义 | 允许的操作 |
|-------|------|------------|
| `PLAYING` | 月内经营 | 点月前操作（含发布）+ 「下一月」 |
| `MONTH_TICK` | 正在走第 9 节 | 禁止再点经营按钮；抉择必须选完 |
| `BANKRUPT` / `SETTLED` | 终局 | 看说明，可再开一局 |

现行 `createNewGame` 直接把 `phase` 写成 `PLAYING`。UI 启动页是开局，不算进存档 phase。

### 2.2 点月管线

函数：`tickMonth(state, config) → { state, queue }`。入参不改，返回新 state。顺序与 design 第 9 节一致：

1. 推进在研 + 长线维护产出  
2. 潮流刷新 → 当月事件（historical + random；choice 只入队）  
3. 对手按日历本月计划出货  
4. 自制进 `readyToShip`；外包自动交付  
5. 盒装 lifecycle（玩家+对手）+ 长线月结 → `monthlyChart`  
6. 发薪；资金 < 0 → `BANKRUPT`  
7. 若本月 = `awards.month`：TGA  
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
scripts/sync_config.py        # 同步生成物
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

`sim/` 文件：`ns.js` `rng.js` `util.js` `company.js` `staff.js` `project.js` `liveops.js` `series.js` `rivals.js` `events.js` `lifecycle.js` `media.js` `awards.js` `tick.js` `actions.js`。

| 层 | 职责 | 禁止 |
|----|------|------|
| **config** | 金额、月数、编制、倍率、名单、lifecycle、对手日历区间 | 在 HTML / UI / sim 里再写一套平衡数字 |
| **sim/** | 下节公开函数 | `document`、`window.ColorboxAI`、存档 IO、`fetch` |
| **ui/** | 场景、按钮、弹层 | 在 click handler 里改资金 / 员工 / 项目 / 质量 |
| **save/ + bridge/** | 云档、storage 缓存、审核 | `localStorage` / `sessionStorage`；假后端 |

动作校验失败 `{ ok:false, error }`，不改入参 state。

### 改数值

1. 只改 `activity/config.json`。  
2. `python scripts/sync_config.py`  
3. `node tests/run-sim-tests.js`（必须绿）

Windows 可用 `python`；若失败再试 `python3`。

---

## 4. 数据层

部署决策已拍板：**云端保存**。云环境开通放部署阶段；未开通时读云失败不改用 `localStorage`，预览用内存 + storage 缓存。

### 4.1 只放在客户端

玩法模拟、当月 UI 过程量、打包配置、占位图。

### 4.2 要持久化的

第 7 节 `GameState`：公司、员工、工作室、在研、待发售、已发售、系列、广告开关、潮流、对手日历与在售、人才市场、`rngSeed`、`phase`。

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
| 文本安全审核 | 开局公司名、游戏名、工作室名走 `security.checkAudit`；预览无 SDK 视为通过 |
| 分享 / 海报 / 排行榜 / 抽卡 / PK | 不做 |
| 篮球/足球/帖子接口 | 不做 |

业务请求走 `ColorboxAI.cloud.request` / `ColorboxAI.request`，禁止 `fetch`、XHR、Axios、WebSocket。

---

## 6. 安全与发布

资源/接口域名仅虎扑域；`sim/` 不联网；禁止 `localStorage`、内联脚本、`eval`、iframe、外域跳转、设备敏感 API。玩家输入当文本节点，不 `innerHTML` 拼接。

---

## 7. 关键数据模型（与 sim 字段对齐）

四维键名：`program` / `script` / `art` / `music`。`id` 均为局内字符串。现行 `createNewGame` 写入 `saveVersion: 4`。

### 7.1 GameState

| 字段 | 说明 |
|------|------|
| `saveVersion` | 现行 4 |
| `phase` | `PLAYING` / `BANKRUPT` / `SETTLED` |
| `rngSeed` `rngCount` | 局种子与已取随机次数 |
| `year` `month` | 起止见 `config.calendar` |
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

### 7.2 Company

| 字段 | 说明 |
|------|------|
| `name` | 开局默认 `config.company.defaultName` |
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
| `liveOps` | `{ active, maintainerIds, monthsLive, peak, closedYear, closedMonth }`；月开支读配置不存档 |

旧档缺 `baselineSales` 时从 `launchSales` 迁移。`tailLeft` 在 tick 时忽略。

### 7.6 只读展示接口

```
marketShares(state, config) → [{ id, displayName, playerSales, rivalSales, share }]
monthlyChart(state, config) → [{ rank, source, title, pub, monthSales, avg, platformId }]
salesFactor(m, score, config) → number   # Y(m)；掉榜看它
boxedBaselineFormula(st, project, config, consumeAd?) → number
getRivalCalendar(state, year) → { year, months }
```

### 7.7 逻辑接口（UI 只调这些改 state）

```
createNewGame(companyName, config) → GameState
hire / fire / relocate / buyAd
foundStudio(state, name, leadId, config)
pitchProject / pitchOutsource
assignLiveOps / shutdownLiveOps
releaseGame(state, gameId, config) → { ok, state, rec?, error? }
resolveEventChoice(state, eventId, optionId, config) → { ok, state, bits?, error? }
tickMonth(state, config) → { state, queue }
startNewRun(companyName, config) → GameState   # 等同 createNewGame
errorMessage(error) → string
```

`applyLongTail` 是 `tickLifecycle` 的兼容别名，不是指数长尾，UI 不要调用。

`PitchInput`：`title, genreId, gameplayId, platformId, releaseType, cycle, producerId, memberIds, seriesId?, studioId?`。

`queue` 项：`notes` / `event`（`presentation: notice|choice`）/ `rivals` / `ready` / `outsource` / `awards`。发售媒体分只在 `releaseGame` 成功后由 UI 弹出。

---

## 8. 实现进度与非目标

已接到点月循环，并拆成 view / sim / config。云表与读写骨架已有，环境未开通。浏览器直接打开是预览模式。

第一版仍不做：开通云环境（等部署阶段）、联机、付费抽奖、真排行、海报发帖、2005/1985 更长档、自动过月、岗位编制、培训界面、虎扑赛事接口、精细立绘。

**已废规则不要复活：** 自动发售、指数长尾、`launchSales` 当后续乘数、PS4/Xbox 玩家选项、N/S 社仅两家简表、12 月 TGA、制作人 2:1 三项合计。

---

## 9. 已定案

1. 关掉再打开自动记录进度。  
2. 生涯结算不分享。  
3. 公司名默认「喵扑studio」，玩家可改。  
4. 存储方式：云端。云环境开通与回写地址：部署阶段再做。全站排行第一版不做。
