# Bug Report：职级跑在属性前面——全属性不到 40，职级已经 T5

> **状态：已修复（2026-09-22）。** 三条改动：挖人带级的准入、`applyCareerPromotion` 的门禁兜底、
> 两条晋升线补 `storyPromo` 标记。测试 `tests/cases/case-17-promotion-gate.js`（4 条），全量 **112 条全绿**。
> 复现脚本：`scripts/_probe_promotion_run.js`（整局归因）/ `_probe_promotion.js`（逐次晋升快照）/
> `_probe_promotion_paths.js`（路径取证）。

## 现象

角色四维都不到 40，职级已经到 **T5**。

先对齐命名：界面上的 `T-n` 码来自 `jobRanks.titles[].code`，是**从 0 起**的，所以
**`T-5` = 技术总监 = rank 6 = 满级**（rank 1..6 依次是 T-0 实习生 / T-1 初级 / T-2 中级 /
T-3 高级 / T-4 技术专家 / T-5 技术总监）。也就是说这个 bug 的实际症状比字面更重：
**属性全不到 40 的人一路做到了技术总监**（实测 4/4 局都到 T-5）。

## 先排除的假设：`mainStatOrJobXp` 不是元凶

`promotion.requirements[]` 每条长这样：

```json
{ "mainStat": 41, "mainStatOrJobXp": 68, "creditedTitles": 4, "fameOrHonor": 12, "monthsInRank": 18 }
```

看起来 `mainStatOrJobXp` 是「主职维或职级经验二选一」的逃生口，而 jobXp 每开发月 +1、生涯能到 400+，
所以第一反应是 **jobXp 兜底把门槛架空了**。**实测不是。** `promotionGaps`（career.js:485）里两条是**串行**的：

```js
need = num(req.mainStat, 0);
if (need && main < need) gaps.push({ id: "stat" });                 // ① 无条件硬门槛
need = num(req.mainStatOrJobXp, 0);
if (need && main < need && jobXp < need) gaps.push({ id: "main" }); // ② 附加条款：main 或 jobXp 至少一个够
```

即：**必须同时满足 `main ≥ mainStat` 和 `main ≥ mainStatOrJobXp 或 jobXp ≥ mainStatOrJobXp`。**
② 比 ① 高，所以 jobXp 只在「mainStat 刚过、又没到 mainStatOrJobXp」时起作用，且它通常早就满足了。

逐级验证（主职维固定 39，只改 jobXp，脚本 `_tmp_orcheck.js`）：

```
rank 1→2 (门槛 28) : jobXp 50 起可升
rank 2→3 (门槛 34) : jobXp 80 起可升
rank 3→4 (门槛 41) : jobXp 300 也不可升 ← 卡死在 mainStat 硬门槛
rank 4→5 (门槛 51) : 同上
rank 5→6 (门槛 60) : 同上
```

**结论：主职维 < 41 时，正常晋升路径到 T3 就封顶了。** 所以「属性不到 40 却 T5」必然来自旁路。

## 真正的三条旁路

### ① 挖人带级（主因，占全部晋升 52.6%）★

`career-mobility.js:379`：

```js
if (specR.inviteCanRaiseRank && rankNow < maxR && promotionsThisYear < maxPer) {
  if (sim.canPromoteCareer(state, config) || num(state.career.fame, 0) >= 8) offered = rankNow + 1;
}
```

`inviteCanRaiseRank: true`，而兜底条件是 **`fame ≥ 8`** —— 声望跟主职维毫无关系，8 点声望几乎人人都有。
于是「每年被挖一次 = 白送一级」，且**不限次数、可以一路送到 T6**。这是把人抬过 T3→T6 的唯一通道。

### ② `applyCareerPromotion` 自身不设门槛（结构隐患）

门槛只写在**调用点**上：晋升页的 `promoteCareer` / `requestCareerPromotion` 会先问 `canPromoteCareer`，
但落地点 `applyCareerPromotion` 自己不查——直接调它就能越级（取证：rank 4 + 主职维 20 → 调用后 T5）。
剧情线 `careerLines.js:682` 正是直调它，且两条晋升线（`promo-to-expert` / `promo-to-director`）的
「接受晋升 / 接受任命」选项**漏了 `storyPromo: true`**，于是 `story=false` →
连 `maxPerYear: 1` 的年度上限都不走（`applyCareerPromotion` 只对 story 计上限）。

### ③ 剧情线破格（设计如此，保留但需显式）

`bond-mentor.nominate.accept-promo` 与 `bond-peer.finale-path.promo` 带 `storyPromo: true` →
按配置注释「故事/事件线 effects.promote 可跳过门槛」**故意**破格。
它们的边界是：mentor 线 `skipIf.jobRankGte: 3`（最多送到 T3），peer 线 `startWhen.minJobRank: 3`（T3 起才开）。

## 实测（修复前）

`node scripts/_probe_promotion_run.js --runs 4`，两种策略各 4 局整局（每次都点晋升）：

| 策略 | 总晋升 | 变动前门槛不满足 | 挖人带级 | 年底 offer 页 | 剧情线 | 正常晋升页 | 终局 |
|---|---|---|---|---|---|---|---|
| A 追着跳槽 | 19 | **12 = 63.2%** | **10 = 52.6%** | 5 = 26.3% | 2 = 10.5% | 2 = 10.5% | **4/4 全 T6** |
| B 从不跳槽 | 12 | 6 = 50.0% | 0 | 0 | 7 = 58.3% | 5 = 41.7% | T4×3 / T5×1 |

策略 A 终局**主职维平均只有 46.7 就到 T6**（T6 门槛 60）；其中一局终局主职维 **33**。

## 修复

| # | 改动 | 位置 |
|---|---|---|
| 1 | **挖人带级改为属性相关**：必须够晋升资格（`canPromoteCareer`）才带级；`mainStatSlack>0` 才允许「差一点点也带」；`fameFallback: 0` 彻底废掉声望兜底 | `jobRanks.promotion.inviteRankBump` + `career-mobility.js` 新增内部函数 `inviteRankBumpOk()` |
| 2 | **门槛装进落地点**：`applyCareerPromotion` 默认自查 `canPromoteCareer`，只有 `story`/`sponsored` 且 `promotion.storyBypass !== false` 才放行；`opts.force` 给已自查的调用方短路；`gateInFunction: false` 可整体回滚 | `career.js` `sim.applyCareerPromotion` |
| 3 | **两条晋升线补 `storyPromo: true`**：它们本来就是剧情晋升，缺标记会连年度上限都不走 | `career-world.json` 的 `promo-to-expert` / `promo-to-director` |

三个开关都在 `jobRanks.promotion`：`gateInFunction`（默认 true）、`storyBypass`（默认 true = 保留剧情破格）、
`inviteRankBump`（`enabled` / `requireQualified` / `mainStatSlack` / `fameFallback`）。

## 修复后实测

| 指标 | 修复前 | 修复后 |
|---|---|---|
| 挖人带级占全部晋升 | **52.6%** | **0%** |
| 总晋升次数（追跳槽，4 局） | 19 | 13 |
| 门槛不满足的比例 | 63.2% | 38.5%（剩下的全是剧情线） |
| 终局职级 | 4/4 全 T6 | **T5×1 / T4×3** |
| 终局主职维（到 T6 时） | 46.7（含一局 33） | 44.8，且**再无 T6** |
| 生涯曲线 `主职维终值` | 85.7 | 85.7（不变） |
| 节奏预算 | 126.8 节点 / 20 min | 119.8 节点 / 19 min |

**真机走查**（`agent-browser` + `scripts/_promo_check.json`，390×844，`file://`）：

| 检查项 | 结果 |
|---|---|
| 页面读到的配置 | `gateInFunction:true / storyBypass:true / inviteRankBump{requireQualified:true, mainStatSlack:0, fameFallback:0}` ✓ |
| 页面内「主职维 20、声望 999」态 | `canPromoteCareer = false`；`applyCareerPromotion` 调完 rank 仍是 3 ✓ |
| **扫 224 条邀约** | 最高职级 = 3（= 自己的职级），**没有一条带级** ✓ |
| 职级标签渲染 | rank 3 → 「中级程序员 (T-2)」✓ |
| 报错 | errCount 0 ✓ |

截图：`scripts/_promo_check.png`。

## 第二轮（Master 三条决定，2026-09-22 当日落地）

| # | 决定 | 落地 |
|---|---|---|
| 1 | **剧情破格不要上锁** | 不动：`promotion.storyBypass` 保持 `true`。bond 两线（`bond-mentor.nominate.accept-promo`、`bond-peer.finale-path.promo`）继续可跳过门槛，年度上限照旧 |
| 2 | **移除 `mainStatOrJobXp`，只按属性判断晋升** | 删掉 `promotionGaps` 里的判定块 + 5 条数据字段 + 已死的 `copy.career.gapMain` 与视图分支。现在 `mainStat` 是**唯一**的能力门槛（28/34/41/51/60），职级经验只剩展示/人设用途 |
| 3 | **挖人时考虑角色自身属性给合适的位置** | 新增 `sim.careerStatRank(state, config)`（属性够到哪一级）+ `promotion.inviteRank`（按属性定级、公司体量封顶 `rankCapByPower`）+ `mobility.inviteFitPenalty`（邀约挑选按「属性档 ↔ 公司体量」加权） |

### 3 的实现细节

- **给什么职级**：`offered = max(当前职级, 属性够到的职级)`，再按公司体量封顶（power1→3 / power2→5 / power3→6），
  `maxPerYear` 仍然限制「一年最多升一级」。挖人（`listCareerInvites`）与跳槽 offer（`makeHopOffer` 外部岗）都走这条；
  公司内部调岗仍给当前职级。**这正是 `mobility.comment` 里早就写着的「职级仍按玩家属性」——之前实现是 `fame>=8` 给 +1 级。**
- **来挖的是谁**：`rollInvitesThisMonth` 抽公司权重多乘一项
  `1/(1+|属性档 − 该公司体量能给到的最高职级|×inviteFitPenalty)`。
  实测权重占比随属性档迁移（`scripts/_probe_invite_fit.js`，2008 年候选池）：

  | 玩家属性档 | power2 占比 | power3 占比 |
  |---|---|---|
  | T1 | 60% | 40% |
  | T3 | 62% | 38% |
  | T5 | 64% | 36% |
  | T6 | 50% | 50% |

  倾向是温和的偏置（不是硬筛），`inviteFitPenalty: 0` 即关掉；想更明显就调大（0.6 约把倍率摆幅从 1.7× 拉到 2.2×）。

### 硬判据（`_probe_promotion_run.js`，两策略各 4 局整局）

| 指标 | 第一轮修复后 | 第二轮（三条决定落地后） |
|---|---|---|
| **非剧情晋升里「属性够不到那一级」** | — | **0 次 = 0.0%**（这是必须为 0 的等式） |
| 剧情破格次数 | 2 + 7 = 9 | 4 + 6 = 10（按设计保留） |
| 靠「署名/声望/月数」不足但属性够而拿到的职级 | — | 10 次（挖人只认能力，按本轮决定） |
| 终局职级 | T5×1 / T4×3 | T5×2 / T4×2（不再是满级） |

### ⚠ 节奏预算被推高（P5e，需另开一轮）

| 变体 | 节点数 | 分钟 |
|---|---|---|
| 本日节奏修复（B+A）之后 | 119.8 | 19 |
| 再叠加「移除 OR 条款 + 邀约匹配度」 | 124.0 | 20 |
| 再叠加「挖人按属性跳级」（= 现在） | **131.3** | **21** ⚠ |

增量集中在 `careerLine 14.5 → 19.8`：职级提前上去了 → `promo-to-expert` / `promo-to-director`
两条晋升线（各 3 拍）与 `minJobRank 3/4` 的同事线/制作人线更早开火。
**注意 P5e 目标（~104 节点 / 12~20 分钟）在本轮之前就已经没达标**（119.8），这是既有的账，
本轮又加了 11.5。真要收，得整体重排（事件频率/线拍数/页面数），不适合夹在晋升修复里顺手改。

## 遗留 / 待拍板

1. **剧情破格要不要也上锁**：现在 `storyBypass: true`，bond 两线仍能送 1~2 级（多数情况属性是达标的，
   只有换岗导致主职维重置时会出现真·破格，如 mainStat 25 升 T4）。改成 `false` 一行即可，
   但「你先升一级」这类剧情承诺会落空 → 若要走这条路，落地点应该改成**挂起**（`pendingStoryPromos`）
   而不是静默丢弃。
2. **`mainStatOrJobXp` 这条附加条款已经形同虚设**：晋升时刻 jobXp 中位 160、均值 191，
   远超门槛最大值 92，所以它永远满足；同时它比 `mainStat` 高，只有「mainStat 刚过而 jobXp 不足」时才卡人
   （实测 0 次）。要么删掉它、要么把数字按 jobXp 的真实标尺重标一次（否则它既不拦人也不赋能，纯噪音）。
