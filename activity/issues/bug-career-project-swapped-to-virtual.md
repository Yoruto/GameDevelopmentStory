# Bug Report：触发「后辈线 + 回国线」后，在研作品被换成一部陌生的虚拟作

> **状态：已修复（2026-09-17）。** 四条改动，均在 `h5/js/sim/`，配置只加了一个开关：
> ① `pickScriptedInviteTitle()`（career.js:576）不再兜底到"还没开工的下一档真作"；
> ② `assignCareerProject()`（career.js:3201）不再把玩家从"本公司当年月还在开发"的目录作上顶走；
> ③ `joinCompany()`（career.js:3441）入组时清空空窗计数，不继承上一家的空窗；
> ④ 新增 `sim.hasCareerReturnTarget()`（career.js:1057）+ `when.requireInDevTarget`
>   （careerLines.js:965、`career-world.json` 的 `era-return-china.startWhen`）：
>   小T 所在公司在当月没有在研目录作时，回国线先不开（`retryNextYear` 会一直等到成立）。
> 测试新增 `careerInviteNeverFabricatesATitle`、`careerKeepsTheTitlePlayerIsOn`（119 条全绿）。

## 现象

生涯档在叠纸做《暖暖环游世界》（`nikkiWorld`，开发窗口 2012.6–2013.12）时，触发后辈线（小T 进组）
与回国线（国内来信 → 熟人挖人 → 进组当组员 / 当制作人去）之后，过月 HQ「在研」栏里那部正在做的
游戏没了，换成一部从没听说过的虚拟作（黑市补丁 / 克隆休假 / 义眼售后 这类）。

同一条链路还会顺手塞给玩家一份永远不会发售的署名（履历里出现 `arknights{signed:true,shipped:false}`）。

## 复现

脚本：`.workbuddy/tmp/repro5.js`（用 `tests/run-sim-tests.js` 同一套 vm loader 直接跑 sim，
逐月打印 HQ「在研」栏实际显示的东西）。

```
OPT=staff REVEAL=hypergryph node .workbuddy/tmp/repro5.js      # 小T = 海猫络合物（鹰角）
OPT=staff node .workbuddy/tmp/repro5.js                         # 小T 随机
```

**修复前**（2012.6 叠纸做《暖暖环游世界》，后辈线 + 回国线选「进组当组员」，小T = 海猫络合物/鹰角）：

```
2012.06  【在研目录作】暖暖环游世界（2012.6开工 / 2013.12发售）  东家=paperGames
  · 小T 的真名/公司在: 海猫络合物 / hypergryph / 表内作品 arknights
  ◇ 回国线 · 熟人挖人 → staff
2012.07  【待命/筹备】                                        东家=hypergryph   ← 被挂到 2017.5 才开工的《明日方舟》
2012.08  【虚拟作】黑市补丁（2012.8开工 / 2013.11发售）         东家=hypergryph
履历 credits: ["arknights{signed:true,shipped:false}", "virt-hypergryph-2012-8-1{signed:true,shipped:false}"]
```

小T 落到叠纸（姚润昊）时是另一条同源症状：玩家没换东家，但 2013.3《奇迹暖暖》一开工就把人从
《暖暖环游世界》上顶走（`repro3.js` 的 `mentorSuccessor` 组、`repro2.js` 都能复现）。

**修复后**：

```
A) 小T = 鹰角 & 2012（鹰角那个年代确实没有在研作）
   · 当月 小T 那家有没有在研目录作(hasCareerReturnTarget) = false
   回国线是否开过: false
   2012.06 → 2013.08 一直是【在研目录作】暖暖环游世界（奇迹暖暖 2013.3 开工也没顶走）
B) 小T = 鹰角 & 2017.6（明日方舟 2017.5 开工）
   · hasCareerReturnTarget = true → 回国线开 → 熟人挖人 → staff
   2017.07 【在研目录作】明日方舟（2017.5开工 / 2019.5发售）  东家=hypergryph
```

## 根因

三层，缺一条都不会出这个表现：

1. **邀约把玩家挂到"还没开工"的作品上** — `pickScriptedInviteTitle()` 的兜底链是
   偏好作 → 当月真在研的作 → `nextCatalogTitle()`（下一档**未来**才开工的真作）→ 偏好作。
   2012 年小T 在鹰角、表内作品是《明日方舟》（2017.5 才开工），于是
   `joinCompany()` 拿到 `titleId = "arknights"`，不校验"这部当月覆不覆盖"，直接写进
   `career.titleId` 并 `addCredit(..., signed=true)`。玩家于是"在一部 5 年后才开工的作上"，
   还白拿一份署名。（与 design.md 第 1b 节「在研：优先挂到本公司本工作室、**当前年月正在开发**的
   目录作品」相悖。）

2. **每月重派作品，不保护玩家正在做的那部** — `assignCareerProject()` 每月调
   `pickCareerAssignment()`（本公司当月所有在研目录作里 prestige 最高、发售最早的那部），
   结果与 `career.titleId` 不同就直接覆盖。同一家公司里有人开工了 prestige 更高的 landmark，
   玩家就被无声挪窝：叠纸 2013.3《奇迹暖暖》（landmark，prestige 3）开工，《暖暖环游世界》
   （prestige 2、非 landmark）被顶掉。

3. **不一致被"静默修掉"，修法的产物就是虚拟作** — 第 1 步留下的坏 `titleId` 不覆盖当月，
   `assignCareerProject()` 的"保持当前作"分支（只看 `titleCoversMonth`）失效 → 清空 `titleId`
   → 空窗计数 +1 → `idleMaxMonths = 1` 到点后 `startVirtualProject()`（职员）或
   `producerPitch` → `resolveProducerPitch()`（制作人）开出一部虚拟作。
   虚拟作本身是设计内的空窗填充（`virtualPool.comment`），但它不该由一次"挂错作品"触发。

为什么必须**同时**触发两条线：回国线的落点来自后辈线的剧情产物
（`junior.revealCompanyId` / `revealTitleId`，见 `pickReturnInviteTarget`），而这两个字段是
后辈线的 `ensureJunior` 与回国线 beat1 的 `revealJunior` 才写进去的。

## 影响

- 玩家做了半年到两年的在研作品被无声替换，月贡献、署名、口碑全部错位到别的作品上。
- 被换上来的常常是虚拟作，作品履历里混进不存在于目录里的名字，观感像"存档串档"。
- 旧实现还会给"没开工的作"发署名（`arknights{signed:true}`），履历页会出现一部永远不会发售的署名作。

## 相关文件

- `h5/js/sim/career.js`：`pickScriptedInviteTitle()`、`pickReturnInviteTarget()` /
  `sim.hasCareerReturnTarget()`、`assignCareerProject()`、`joinCompany()`
- `h5/js/sim/careerLines.js`：`whenClauseMet()`（新增 `requireInDevTarget`）
- `activity/career-world.json` → `h5/config.json` / `h5/js/config.generated.js`（`scripts/sync_config.py`）：
  `eventLines.lines[era-return-china].startWhen.requireInDevTarget`
- `tests/run-sim-tests.js`：`careerInviteNeverFabricatesATitle`、`careerKeepsTheTitlePlayerIsOn`

## 后续收口：把"当月有在研目录作"提成 offer / 邀约的准入条件（同日第二批）

第一批修的是"**挂到错的作品**"，同源的另一半是"**公司压根没活**"：`strongHop` / `mentorSuccessor` /
`peerEpic` 不再造假 `titleId`，但目标公司当月真没在研目录作时，玩家进去仍是空窗 → 虚拟作；
年底 offer / 挖人更是允许 `titleId` 为空。按"企业挖人是为了让人做事情"的原则补齐准入：

- `sim.companyInDevCatalogTitle(companyId, st, config, studioId)`：这家当年月是否真有在研目录作
  （**虚拟作不算**——虚拟作本身就是空窗的产物）。全站唯一的"有活干"判据。
- **年底 offer**（`sim.listYearEndOffers`）：`mobility.requireInDevTitle.offer` 开着时，
  "当年月没有在研目录作"的公司**不进抽签池**（先过滤再抽权重，不是抽完再丢）；
  `makeHopOffer()` 拿不到目标作品就返回 `null`，调用方丢弃该格（内部工作室调动同样受约束）。
- **挖人邀请**（`sim.listCareerInvites`）：邀请挂的作必须 `titleCoversMonth` 当月仍成立
  （`inviteWindow` 本来就落在开发窗口内，这条是硬约束，防窗口改歪）。
- **剧情邀约**（`requireInDevTitle.scripted`）：同事线「跳去别家」/「搭史诗作」只挑当月真在研的
  东家与作品；前辈线「跟着走」的 `bondDepart` 等新东家真有在研作才拍这一拍；
  效果层兜底——落点不成立就**原地不动**，绝不进空窗。
- **内部调岗**（`requireInDevTitle.studioMove`）：`moveStudio` 只调去当月有在研目录作的工作室。
- 选项门禁（新 `skipIf`，判定函数一律 **RNG-free**，否则每帧评估都会搅乱随机流）：
  `noStrongHopTarget`（`sim.hasStrongHopTarget`）、`noPeerEpicTarget`（`sim.hasPeerEpicTarget`）、
  `noOtherStudioInDev`（`sim.careerOtherStudioPool`）。落在 `bond-peer` finale 的三个选项上。
- 开关形状：`mobility.requireInDevTitle` = `true`（默认）/ `false`（全关，回旧行为）/
  `{ offer:false, invite:false, scripted:false, studioMove:false }`（分面关）。

**副作用（已知、可接受但要知情）**：`kojimaProductions` 的目录作只有《死亡搁浅》（2017.11 开工），
所以前辈线「跟着走」那一拍在 2015～2017.10 不会开（等新东家真有活）——测试已按新行为固定。
想让 2015 就能跟走，给 Kojima Productions 补一部 2015 年在研的目录作即可（或把 `requireInDevTitle.scripted` 关掉）。
开局 offer（`rollOpeningOffers`，应聘入职、不是挖人）**不在**准入范围内：43 家候选里 1995.1 只有 11 家
有在研目录作，收紧会把"小厂开局 + 自家立项"的设计挤掉。

## 相关文件（第二批）

- `h5/js/sim/career.js`：`sim.companyInDevCatalogTitle`、`requireInDevTitle` / `sim.mobilityRequireInDevTitle`、
  `makeHopOffer`、`listYearEndOffers`、`listCareerInvites`、`pickScriptedInviteTitle`、
  `applyScriptedCareerInvite`、`strongHopPool` / `pickStrongHopCompany` / `sim.hasStrongHopTarget`、
  `peerEpicPool` / `pickPeerEpicTitle` / `sim.hasPeerEpicTarget`、`sim.careerOtherStudioPool` / `applyCareerMoveStudio`
- `h5/js/sim/careerLines.js`：`skipCondHits`（3 个新 `skipIf`）、`beatWaitReady`（`bondDepart` 加准入）、
  `peerEpicReady` 的找作分支
- `activity/career-world.json`：`mobility.requireInDevTitle` + `bond-peer` finale 三个选项的 `skipIf`
- `tests/run-sim-tests.js`：`offersAndInvitesRequireAnInDevTitle`（开关读写 / 虚拟作不算有活 /
  逐年 offer 必带在研作品 / 三个门禁 + RNG-free / 前辈线原地不动）
