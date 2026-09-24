# HANDOFF — 滚动状态页（每轮收尾覆盖更新）

> 用法：每轮开工先读本文件；收尾时只更新下面三节，历史细节沉到 `.workbuddy/memory/` 日报。
> 上一版时点交接书 `P3-HANDOFF.md` 保留作存档（内容已过期）。

---

## 现状一句话（2026-09-23）

**追加 6（09-23）**：**事件系统批 D / E / F 收口**——
**批 D** 选项 label 全量精修（266 个审完、**184 条改写**：从"少闪退 / 更好看"这类参数名，改成
"把崩的修到不崩 / 把手感调到底"这类动作；eventLines 的'个人深度 / 保完成度 / 赌辨识度'一并修）；
**批 E** choice 正文**去「选项复读」28 条**（正文不再把按钮复述一遍，只写处境 + 人 + 代价；
顺带把 6 条"配了 speakerCast 却没用 `{speaker}`"的接上）；
**批 F** 独立车道**实现完成但实测负收益 → 配置回滚**（`bondBeatsPerMonth: 0`，引擎能力保留可开）。
⚠ **探针修复（重要）**：`career.js` 用 `Date.now()` 生成初始种子，同参数连跑三次能差 50 节点——
上一轮报的"426.6 → 433.5（净 +7）"**在噪声内不可辨**；固定时钟后完全可复现。
探针三要点：**固定 Date.now / 回应 choice / 主动申请晋升**（缺任一数字即无意义）。
**下一轮真瓶颈**：bond-junior **10/24 局卡在那通电话**（准入门禁等公司成立）、bond-mentor 4/24 卡尾拍。
测试 **120 全绿**（文案守卫 602 未涨），真机验过最长 label 11 字不换行、正文 43 字不裁剪。

**追加 5（09-22 深夜）**：**事件系统重设计 批 B + 批 C 全量落地**——
批 B（纯数据）：114 条文案（通知 11 + 事件 103，去掉"画面先掉一档"式数值播报与维度词）、
36 条挂 `speakerCast`、47 个选项写 `setFlags`、新增 **24 条回访事件**（flag 触发 3-8 月后兑现）。
批 C（引擎）：`sim.eventSpeakerName/eventSpeakerFill`（走 `castFor` 跟随 nameMode，`{speaker}` 替换）、
`scheduleEventCallbacks/dueEventCallback`（**延迟用 FNV hash，不消费 RNG**）、
`effects.dropProject`、`optionalLineKind` 加 `downbeat`（不加则新 kind 线永不自动开）、`startWhen.noGroupDone`；
新增**三条下行线** project-cancelled / crunch-collapse / flop-title（一局只走一条）；
**职业线 3×3 拍压成 3×2**（评审/试岗并进决议拍，分支收益保留）。
**节奏实测 426.6 → 433.5**（中途一度 465.8：降概率没用，真正有效的是"同组已 done 就不再开"）。
测试 **115 → 120**（新增 `case-18-p7-events.js`），API 面 **278 → 282**（快照备份后重建），
真机验过最长 68 字弹窗不裁剪、页面不滚。
⚠ 三条踩坑：sim 内写**中文注释会撞 B1 文案守卫**（只许降）→ sim 注释一律英文；
`startCareerLine` 是强制入口**不校验 startWhen**（限流逻辑必须走 processCareerLines 验证）；
`case-09`/`case-10` 硬编码了旧拍序，压拍后要同步改。
下一步：选项 label 改成"三种代价"、speaker 铺到余下事件、bond 独立车道。

**追加 4（同日深夜）**：**事件系统重设计方案已拍板（档 1+2 / 三条下行线 / 说话人随 nameMode），样板批 A 已落地**——
`scripts/_event_copy_pass1.py`（幂等）：通知文案 11 条（hopFail/promoteOk/kickOut 等"后台日志腔"改成有人称叙事，toast 类 ≤22 字）
+ devEvents 8 条文案（5 播报去数字播报 + 3 现场类加场景）+ 选项标签 9 个。只动文案不动数值/presentation。
**sync → validate → tests 115 条全绿**；真机探针验过弹窗不裁剪/页面不滚/toast 不溢出（`scripts/_evt_copy_check.json`）。
⚠ `scripts/_cw_before_eventcopy.json` 是 09-18 同名旧备份**勿作回滚点**，回滚用 `scripts/_event_copy_pass1_rollback.py`。
下一步：批 B（余 ~60 条文案 + 选项三种代价数值）→ 批 C（speakerCast 接 cast + flag 回访投递 + 三条下行线 + 职业线 9→6 拍）。

**追加 3（同日）**：**职级门槛第二轮（Master 三条决定）已落地**——
① **剧情破格不上锁**（`storyBypass` 保持 `true`，不动）；
② **移除 `mainStatOrJobXp`**：晋升只看属性（唯一能力门槛 = `mainStat` 28/34/41/51/60），
   连带删掉 5 条数据字段 + 死掉的 `copy.career.gapMain` 与视图分支，职级经验只剩展示用途；
③ **挖人按属性给合适的位置**：新增 `sim.careerStatRank`（属性够到哪一级）+ `promotion.inviteRank`
   （`offered = max(当前职级, 属性档)`，按公司体量 `rankCapByPower` 1→3/2→5/3→6 封顶，仍受「一年一级」约束），
   挖人与外部跳槽 offer 同走这条；`mobility.inviteFitPenalty` 让邀约挑选按「属性档 ↔ 公司体量」加权
   （T1 大厂占比 40% → T6 50%）。**这正是 `mobility.comment` 里早就写着的「职级仍按玩家属性」。**
**硬判据：非剧情晋升里「属性够不到那一级」= 0 次（必须为 0）**；测试 **112→115 条全绿**
（case-17 扩到 7 条：阶梯表 / 邀约封顶 / 职级经验不再替代属性 / 声望不越级），API 面 **277→278**
（新增 `careerStatRank`，快照已重建，旧快照备份 `scripts/_api_snapshot_before_statrank.json`），
文案基线 591→602。⚠ **节奏被推到 131.3 节点/21 分钟**（见待拍板）。

**追加 2（同日）**：**职级门槛修补已落地**（Master 报「全属性不到 40 就 T5」）——
`T-5` 其实是 **rank 6 满级（技术总监）**，即属性全低的人一路做到了顶格。
真凶是**挖人带级**（`inviteCanRaiseRank` 的兜底条件 `fame>=8`，与主职维无关）：
实测占全部晋升 **52.6%**、追跳槽策略下 19 次晋升有 **12 次（63.2%）门槛不满足**、终局 **4/4 全 T-5** 而终局主职维平均仅 46.7。
三处修复：① `promotion.inviteRankBump` 改成「必须够晋升资格才带级」（`fameFallback:0` 废掉声望兜底）；
② `applyCareerPromotion` **自身**加门槛兜底（`gateInFunction`，旧实现只靠调用点自觉，直调即越级）；
③ `promo-to-expert`/`promo-to-director` 的接受选项补 `storyPromo`（缺它连年度上限都不走）。
**效果：挖人带级 52.6%→0，终局 T4/T5 不再满级，曲线 85.7 与节奏 119.8 节点均未受影响**；
测试 **112 条全绿**（新增 `tests/cases/case-17-promotion-gate.js` 4 条），文案基线 584→591。
⚠ 曾先怀疑 `mainStatOrJobXp` 那条 OR 条款，**实测排除**（主职维 39 时 rank 3→4 就卡死，正常路径到不了 T5）。

**追加（同日）**：**开发节奏修复 B + A 已落地**（Master 报「新加入公司做完一作，第二作直接到中期内容填充」）——
归因 + 实测 + 三条修法见 `activity/issues/bug-career-project-phase-starts-midgame.md`。
B：`pickCareerAssignment` 先按进度分桶（`development.assignment.preferFresh/freshBucket`）再比 prestige；
A：`maxProgress` 硬门槛 + 池作/空窗兜底 + `career.waitingForStart`（空窗文案分「等立项」/「组里没活」）
+ 三条死锁守卫。**入场即后半程 30.9% → 6.7%，入场落「打磨/待发售」→ 0%**（大厂宿主 12 局 4464 月）。
D（开工窗口规则 `development.devWindow`）已实现但**默认关闭**，待拍板（见下）。
测试 **107→108 条全绿**（新增 `tests/cases/case-15-dev-pacing.js`，B/A 用例从 case-10 迁出），
文案基线 566→584（全为注释 + 1 条新玩家文案 `copy.career.waitingHint`）；
`devWindow` 默认档与 P2c 老口径逐条一致（0 漂移）。⚠ 两个探针新增 `GDS_DEVWINDOW` 覆盖开关（只改内存）。

生涯档已完成 P1~P6 + P6 正反馈呈现层 + 过月节奏二改（93→94 条测试）；本轮完成项目体检与四件架构清理：
**测试按域拆分**（run-sim-tests.js 5380 行 → `_harness.js` + `cases/` 16 组，94 条全绿）、
**bridge/local.js 本地兜底**（无 ColorboxAI 宿主时 localStorage 存档 + 审计放行）+ pagehide 双写存档、
**B1 文案守卫**（sim 内 CJK 行数基线 544 只许降）、**AI-MAP.md**（本文件 + 常驻目录）。
**下一步 = P7 补充功能**（S1/S2/S4/S5/S6 各子项独立）。广告线挂起：方案在
`REVIEW-PLAN-2026-09-22.md` §1（虎扑 vatask 激励视频，缺 colorbox-vatask 详细技能文档）。

**追加（同日）**：角色数据层 **阶段 1+2 已落地**（方案 `activity/cast-plan.md`）——新建 `careerWorld.cast[]`
人物事实表（111 人，补齐 `roles`/`tier`/`career` 在职窗口）+ **真实/虚构双姓名模式**
（`careerWorld.nameMode`，111 人中 94 人有独立虚构名）；新增统一取人入口 `sim.castFor` 等 5 个导出
（API 面 271→276）；测试 **94→100 条全绿**，文案基线 544→553（+9 全为注释），API 快照有意重建；
真机验过双模式在 HQ 面板生效（`宫本茂/岩田聪` ↔ `宫本彻/岩田悟`，errCount 0）。
**追加 2（同日）**：cast **阶段 3 已落地**（Master 拍板「队友先贴近真实角色，不够再抽虚拟角色；补充数据规模」）——
数据 **111→186 人**（驻员 +49 专攻 programmer/art，自由职业 +26 含 18 位作曲，一次覆盖 75 家公司的 music 缺口）；
`castFor` 改为**三级降级**（驻员→自由职业→null），`careerSeniors` 改合并视图，队友生成接 `castFor`
（**RNG 消费量严格不变**，分人顺序按候选数升序，姓名池按 region 分池）；测试 **100→103 条全绿**；
真机验过制作组 **4/4 真实角色**（岩田聪/今村孝矢/宫本茂/汉斯·季默），一屏不滚动、0 报错。
顺带修了「真实姓名被超长职级标签挤掉」的 CSS 问题。
**追加 3（同日）**：cast **阶段 4 已落地** —— **导师按岗匹配**（`pickMentorByRole`，程序岗入任天堂导师从宫本茂变成岩田聪）。
测试 **105 条全绿**，API 面 **277**，0 报错。
⚠️ 本轮踩到一个静默坑：**新增 `queue.push({type})` 必须登记进 `sim.careerNodeDetectors`**，否则 `skipToNextNode` 判定为"无节点"、整份丢弃 queue（不报错、功能静默失效）。详见 `cast-plan.md` §12.3。
⚠️ **同日二次拍板：入职弹窗已整体移除**（Master「不要有入职弹窗」）—— 节点会占用调好的过月节奏，而 HQ 前辈行本就在显示这批人。新增反向守卫 `noJoinIntroPopup` 防误加回。见 `cast-plan.md` §12.6。
**下一步 = 阶段 5（事件说话人接 cast：`devEvents` 加 `speakerCast` 试点 20 条 + tag 扩到四岗位）**，见 `cast-plan.md` §12.5。

## 待拍板

- ⚠ **P5e 节奏预算需要整体重排**（本轮晋升修复把它从 119.8 推到 **131.3 节点 / 21 分钟**，
  目标 ~104 / 12~20 分钟；**其中 119.8 在本轮之前就已经超标**）。增量在 `careerLine 14.5→19.8`：
  职级提前上去 → 两条晋升线（各 3 拍）与 `minJobRank 3/4` 的同事线/制作人线更早开火。
  收它要动事件频率/线拍数/页面数，不适合夹在晋升改动里顺手改。见
  `activity/issues/bug-career-rank-outruns-stats.md`。
- **职级经验的去向**：`mainStatOrJobXp` 移除后 jobXp 不再参与任何判定，只剩展示 +（天赋 `jobXpMult`、
  事件 `jobXpDelta` 还在加它）。要么给它找个新闭环（例如反过来影响谈判/挖人吸引力），要么连数据一起删。

- ⚠ **D（开工窗口规则）建议保持关闭**；要收窄节奏就改门槛阈值——归因与实测见
  `activity/issues/bug-career-project-phase-starts-midgame.md`。B/A 已落地（入场即后半程 30.9%→6.7%），
  D 已实现但默认 `stretch`（= P2c 原口径，case-15 有 `drift===0` 断言防漂移）。实测三条：
  ① `capMonths:30` **反而把入场质量弄差**（6.7%→15.0%：cap 把候选从 0.71 压到 0.47，掉到闸门以下 → 闸门失效）；
  ② `mode:"cadence"` 入场压到 0%、署名 7.5→12.6 部，但节奏 20→22~23 分钟 / 节点 →140~146
  （P5e 目标 ~104、12~20 分钟）**且与 P2c「拉长开发窗口」正面相反**（窗口中位 35→14）→ 要开得先重定 P2c 与 P5e；
  ③ **推荐旋钮：`assignment.maxProgress` 0.7→0.5** —— 入场后半程 6.7%→3.3%、空窗 69→54 月、节点 126.8→122.5，
  代价是署名 7.5→6.9、终值 -0.4（属平衡范畴，等拍板，一个数字的改动）。0.3 以下空窗反弹。
- ⚠ **首次入职的落点要不要也过闸门**（B/A 没覆盖，有意留的）：offer/邀约自带 titleId → `joinCompany`
  直接挂上，不经 `assignCareerProject`。现状依据是已拍板的 `lateJoin`（后期加入允许、不署名、
  跳槽成功率 ×0.2），套上闸门等于取消它，也会动 `careerHireChance` 的 late 分支与 case-09 `lateProbe`。
  叙事线（`applyScriptedCareerInvite` 挂剧本点名的作）也不能改口径。建议保持现状。
- P7 子项做哪些、什么顺序（S1 多结局 / S2 出身三选一 / S4 线结局卡 / S5 年代皮肤 / S6 荣誉墙）。
- 广告是否重启、何时向平台要 `colorbox-vatask` 技能文档与活动绑定流程（REVIEW-PLAN §1.6）。
- **cast**：排期位置（是否并入 P7 作 S7）；是否继续补数据（programmer 仍缺 54 家 / art 缺 56 家，脚本已就位）；
  制作组职级标签是否精简（"音乐 · 高级音频设计师"里的角色前缀与职级名重复，精简可解决长名截断）。见 `cast-plan.md` §11.5。

## 未提交改动（⚠ 别做破坏性 git 操作；别主动 commit）

最后一次提交仍是 `520cb00`。当前工作区 **101+ 项未提交**（另有本轮新增 `activity/issues/bug-career-project-phase-starts-midgame.md`、`scripts/_probe-phase-flow.js` 两文件未跟踪）：
覆盖 P0~P6 全部成果 + 本轮四件（`tests/_harness.js`、`tests/cases/`、`tests/sim-copy-baseline.json`、
`scripts/split_tests.py`、备份 `scripts/_tests_before_split.js`、`h5/js/bridge/local.js`、
`h5/index.html`、`h5/js/ui/app.js`、`AI-MAP.md`、本文件、`REVIEW-PLAN-2026-09-22.md`）。
回滚数据改动用 `scripts/_cw_before_*.json`，回滚测试拆分用 `scripts/_tests_before_split.js`。
