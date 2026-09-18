# 特性（Traits）设计草案

> 状态：**草案**。未合入 `design.md`，未改 `activity/config.json`，未改 `h5/js/sim/`。
> 事实源：`design.md` 为全局事实源；本文只讨论「特性」子系统的增量设计。

> ⚠️ 本文 §3 / §4 / §10 里写的「开局抽 3 条**三选一**」是**设计意图，从未实现**：实现是**随机抽 1~3 条**（`startRoll.traitCountMin/Max`、同「收益轴」最多一条）全部直接生效、可选性为零；「三选一」的两个 API（`rollCareerTraitDraw` / `pickCareerTrait`）没有 UI 入口。详见 §12.5。

## 已定决策（2026-09-15 / 16）

1. 载体范围：**只做主角特性**。同事 / 前辈特性本轮不做。
2. 精力 vigor：**不引入**。代价改挂在钱 / 时间 / 关系 / 成长四类已有资源上（§6）。
3. 落地节奏：首批 6 条 + 开局抽取 + 锁定，**已实现**（见 §10）。
4. 抽取方式：开局随机抽 **1~3 条**（2026-09-18 拍板，`startRoll.traitCountMin/Max`），抽到即 `traitsLocked`，进游戏后不可改。（原写「抽 3 条三选一」，从未按此实现。）

## 0. 现状盘点（读代码得出，非推测）

| 项 | 现状 |
|---|---|
| 特性表 | `activity/config.json:889` `config.traits`，共 **8 条** |
| 载体 | **仅经营局员工**。`sim.drawTraits` 雇佣时按权重抽，升级不新增 |
| schema | `displayName / summary / hireWeight + 效果键` |
| 读取 | `sim.traitDef(id, config)`（`h5/js/sim/staff.js:20`） |
| 生效点 | `staff.js`（薪资）、`project.js`（开发/发售）、`tick.js`（长线）、`media.js`、`liveops.js` |
| 生涯档 | **零特性**。`career.js` 里搜不到任何 `traits` 消费（`talentMarket` / `talentStamp` 是同名无关字段） |

现有 8 条：灵光一闪、一丝不苟、肝帝、人气王、省钱怪、气氛组、跟风选手、长线操盘。

**结论：要新增的是「载体」，不是「表」。**

## 1. 载体

| 载体 | 归属 | 状态 | 获取方式 |
|---|---|---|---|
| **主角特性** | 生涯档玩家 | **本批新增** | 行为阈值解锁 → 觉醒二选一 |
| 员工特性 | 经营局员工 | 已有 8 条，**不动** | 雇佣随机抽 |

## 2. 数据结构

复用同一张 `config.traits` 表，加 `scope` 字段区分；默认 `scope = "staff"`，保持既有 8 条零改动。

```jsonc
"workaholic": {
  "displayName": "工作狂",
  "summary": "月贡献高，但没空经营关系。",
  "scope": "career",
  "unlock": { "type": "streakMonths", "gte": 12 },
  "tier": "common",
  "monthContributionMult": 1.25,
  "bondGrowthMult": 0.7,
  "quarterlyBadEvent": "overwork_alienate"
}
```

- 效果键按 `scope` 分派：`scope: "staff"` 走现有 `producerXxx / memberXxx`；`scope: "career"` 走主角侧键（§4）。
- `unlock` 只对 `scope: "career"` 有意义；`hireWeight` 只对 `scope: "staff"` 有意义。
- 主角特性存 `st.career.traits: []`（新增字段，缺省 `[]`，老存档天然兼容）。

## 3. 获取规则（主角）

**不做随机抽。** 理由：员工是「招聘」语义（你不知道这人什么脾气，随机抽合理）；主角是「你自己」，随机抽会让 30 年生涯的前几年完全被动。

规则：

1. 每月 tick 时，用 `unlock` 条件比对生涯累计量（连续高强度月数 / 作品数 / 人脉数 / 年限 / 休整次数…）。
2. 达标 → 进队列，弹出**觉醒事件**（复用 `careerEventQueueItem`），给两个**互斥**选项。
3. 玩家二选一 → 写入 `st.career.traits`；拒绝则进冷却，若干年后再触发。
4. 上限 **3 条**（开局 1 条 + 生涯最多觉醒 2 条），避免后期堆 buff。
5. 二选一的两个选项**同族但取向相反**（例：工作狂 vs 摸鱼宗师），保证是抉择而不是白送。

**代价是硬约束**：每条特性至少带一个非收益键，且代价落在与收益**不同的资源**上。

## 4. 效果键命名空间（主角侧，新增）

| 键 | 含义 | 挂钩代码 |
|---|---|---|
| `monthContributionMult` | 月度作品贡献倍率 | `applyMonthlyLiveContribution(st, config)` |
| `statGrowthMult` | 主/副维成长倍率（可带 `yearGte` / `yearLt` 分期） | `grantMainStatAndXp(st, kind, config, titleNow)` |
| `titleXpMult` | 称号 XP 倍率（可为 0，表示当月不吸收） | `grantPlayerTitleXp(st, titleNow, amt)` |
| `inspirationRate` / `inspirationDimBonus` | 灵感月概率 / 加成 | `tickCareerMonth` 开发分支（`career.js:4618`） |
| `burnoutEveryMonths` / `burnoutContributionMult` | 每 N 月强制倦怠 + 当月贡献倍率 | `tickCareerMonth` 月首结算 |
| `livingCostMult` | 生活开销倍率 | `sim.careerLivingCost(year, config)`（`career.js:1616`） |
| `bondGrowthMult` | 人脉 rapport 增长倍率 | `sim.tickCareerBonds(st, config)`（`career.js:735`） |
| `eventGambleMult` | 事件「激进」选项收益与惩罚同倍 | `sim.rollCareerDevEvent` / `rollPostLaunchEvent`（`career.js:4663-4671`） |
| `negEventMult` / `posEventMult` | 负面 / 正面事件效果倍率 | 同上 |
| `trendSalesMult` / `offTrendSalesMult` | 顺 / 逆潮流销量倍率 | 发售结算 |
| `hopSalaryMult` | 跳槽谈薪倍率 | mobility 流程 |

## 5. 特性总表（18 条候选）

### A. 产出族

| 特性 | 收益 | 代价 |
|---|---|---|
| 工作狂 | 月贡献 ×1.25；事件线多一个「硬上」选项 | 人脉增长 ×0.7；每季度必触发一次「同事觉得你太拼」负面事件 |
| 灵感爆发 | 开发月 12% 概率「灵感月」：作品随机一维 +5，当月可多回应一次事件 | 灵感月**不计称号 XP**（在输出而非吸收）；灵感月不可预告、不可囤积 |
| 一丝不苟 | 作品评分下限 +0.8，翻车概率减半 | 开发周期 +1 月 |
| 拼命三郎 | 连续 3 个月未休整时贡献 ×1.4 | 每第 6 个月强制触发「倦怠」：当月贡献 ×0.5，且只能选保守选项 |

### B. 成长族

| 特性 | 收益 | 代价 |
|---|---|---|
| 肝帝 | 属性与称号 XP ×1.3 | 生活开销 ×1.15 |
| 大器晚成 | 第 10 年起成长 ×1.4 | 前 10 年 ×0.85 |
| 少年天才 | 前 8 年成长 ×1.5 | 第 8 年后 ×0.8 |
| 杂食 | 副维成长 ×2 | 主维成长 ×0.85 |

### C. 人际族

| 特性 | 收益 | 代价 |
|---|---|---|
| 万人迷 | 人脉增长 ×1.5；挖人成功率 +15% | 事件线冲突必牵动两个人 |
| 孤狼 | 独自负责项目时贡献 ×1.4 | 组队协作加成归零，人脉增长 ×0.5 |
| 名师 | 带后辈时后辈成长 ×2 | 你当月属性成长 ×0.8 |
| 老好人 | 人脉永不断裂（rapport 不降） | 跳槽无法甩掉关系，前公司挽留更强 |

### D. 时代族

| 特性 | 收益 | 代价 |
|---|---|---|
| 风口猎手 | 命中潮流销量 ×1.2 | 逆潮流 ×0.85 |
| 古董商 | 衰退平台 / 过时题材 ×1.25 | 潮头上 ×0.9 |
| 技术宅 | 技术浪潮红利提前 6 个月生效 | 错过浪潮时惩罚翻倍 |

### E. 风险族

| 特性 | 收益 | 代价 |
|---|---|---|
| 赌徒 | 事件「激进」选项收益 ×1.5 | 失败惩罚也 ×1.5 |
| 稳如老狗 | 负面事件效果 ×0.5 | 正面事件效果 ×0.7 |
| 铁公鸡 | 生活开销 ×0.7 | 人脉增长 ×0.8 |

### F. 稀有（里程碑，上限 1 条）

| 特性 | 收益 | 代价 |
|---|---|---|
| 制作人之魂 | 转制作人后可给作品「定调」（复用 `virtualGenreId` / `virtualName`）；署名作品口碑下限 +1 | 仅在你署名的作品上生效 |
| 二次创业 | 开工作室初始资金 +50%，可带走 2 名关系最好的同事 | 终局评级按「独立作品」重新计 |

## 6. 为什么不做「精力」，代价改挂哪里

原方案曾建议新增 `st.career.vigor`。**已决定不做**：多一条资源 = 多一套 UI + 存档字段 + 平衡面，收益不抵成本。

代价改为落在**已有资源**上，四类：

| 已有资源 | 表现方式 | 承担的特性 |
|---|---|---|
| 钱 | 生活开销倍率 | 肝帝、铁公鸡 |
| 时间 | 开发周期 +1 月、强制休整月 | 一丝不苟、拼命三郎 |
| 关系 | 人脉增长倍率、被迫的负面事件 | 工作狂、孤狼、铁公鸡 |
| 成长 | 当期属性 / 称号 XP 归零 | 灵感爆发、名师、杂食 |

设计规则：**收益与代价必须落在不同资源上**——产出换关系、输出换成长、效率换时间。同维度对冲（如 +25% 又 −25%）等于没做。

## 7. 平衡与约束

- 主角特性**不影响经营局**（scope 分派保证），既有 8 条平衡不受影响。
- 特性上限 3 条 + 稀有 1 条，避免后期无敌。
- 所有倍率走**乘法**、不叠加法，避免线性膨胀。
- 每条特性补三连单测：解锁条件触发 / 收益生效 / 代价生效且不越界。

## 8. 本轮不做（归档备查）

- **同事 / 前辈特性**：42 位前辈已有四维 `stats`，再挂 1 条特性成本极低（加字段 + `careerSeniorLine` 渲染），且是「班底系统」的前置。本轮按决定不做，要点留档：前辈特性作为 mentor bond 的被动（如「名师」→ 徒弟成长 ×1.2），并在跳槽 / 挖人页展示，让「跟谁」第一次有数值意义。
- **扩充员工特性**：经营局现有 8 条不动，避免连带平衡。

## 9. 待拍板 / 已定

已定：

1. ✅ 载体范围：只做主角特性。
2. ✅ 精力 vigor：不引入，代价落在钱 / 时间 / 关系 / 成长四类已有资源（§6）。
3. ✅ 首批 6 条 + 开局抽取 + 锁定，已实现并跑通测试（§10）。
4. ✅ 第二批 12 条补齐，**18 条全量落地**（§11）。

仍待定：

5. 命名风格是否更「日式经营游戏」一点（如 工作狂 → 社畜之魂）。
6. 生涯中「觉醒第二条」的解锁规则（草案 §3 已设计，未实现；当前只有开局那一掷，1~3 条）。
7. F 族稀有特性（制作人之魂 / 二次创业）未做——它们依赖「转制作人定调」「开工作室」两条尚不存在的系统，留到下一版本。

## 10. 首批落地清单（已实现）

开局流程：`sc-boot`（名字 + 擅长 + 抽天赋，同一屏；不满意点「随机擅长和天赋」重抽）→ `sc-offer`（三份 offer）。

- `sim.rollCareerTraitDraw(st, config)`：按 `drawWeight` 抽 **3 条互不重复**。
- `sim.pickCareerTrait(state, traitId, config)`：写入 `st.career.traits = [id]` 并置 `traitsLocked = true`。
  **三道锁**：已锁定则忽略；`phase !== "OFFER"` 则拒绝；非 `scope: "career"` 的特性拒绝。
- 玩家详情页（`sc-player`）显示天赋名与说明。

| id | 名称 | 收益键 | 代价键 |
|---|---|---|---|
| `workaholic` | 工作狂 | `monthContributionMult` 1.25 | `livingCostMult` 1.2 |
| `peoplePerson` | 万人迷 | `bondTogetherBonus` +1 | `monthContributionMult` 0.85 |
| `inspirationBurst` | 灵感爆发 | `inspirationRate` 0.12 / `inspirationDimBonus` 5 | 灵感月当月属性与职级 XP 归零 |
| `fastLearner` | 学得快 | `statGrowthMult` 1.3 / `jobXpMult` 1.3 | `livingCostMult` 1.15 |
| `pennyPincher` | 铁公鸡 | `livingCostMult` 0.7 | `jobXpMult` 0.8 |
| `lateBloomer` | 大器晚成 | `lateStatGrowthMult` 1.4（第 10 年起） | `earlyStatGrowthMult` 0.85（前 10 年） |

> 命名坑：员工特性里已有 `grindKing`（肝帝），生涯侧 id 不得重复，故成长族改用 **`fastLearner` / 学得快**。

### 代码落点

| 文件 | 改动 |
|---|---|
| `activity/config.json` | `traits` 加 6 条 `scope: "career"`；顶部 comment 补充 scope 语义 |
| `h5/js/sim/staff.js` | `traitIds(config, scope)` 支持按 scope 过滤；`drawTraits` 显式传 `"staff"`，避免招到主角特性 |
| `h5/js/sim/career.js` | 新增 `careerTraits / careerTraitMult / careerTraitSum / careerTraitStatGrowthMult / careerYearsElapsed / rollCareerTraitDraw / pickCareerTrait / careerTraitName / careerTraitLine`；`rollInspirationMonth` |
| `h5/js/sim/career.js` | 挂钩：`grantMainStatAndXp`（成长/职级 XP/灵感月归零）、`applyMonthlyLiveContribution`（产出）、`tickCareerBonds`（关系）、`tickCareerMonth`（灵感月、生活开销） |
| `h5/index.html` / `css/app.css` | 合并 `sc-boot`/`sc-role`/`sc-trait` 为单屏；新增「随机擅长和天赋」按钮 + `.trait-card` 样式；玩家页加天赋行 |
| `h5/js/ui/paint.js` / `app.js` / `dom.js` | `paintCareerTraits` + 流程接线 + `pendingTrait / traitDraw` 会话态 |
| `tests/run-sim-tests.js` | 新增 5 条：scope 隔离、抽 3 不重复、选后锁定、六条收益/代价双向、灵感月换成长 |

测试：108 passed（原 103 + 新增 5）。

## 11. 第二批落地清单（已实现，2026-09-16）

池子从 6 条扩到 **18 条**，开局仍是「3 选 1，锁定不可改」。抽取权重 `drawWeight` 控制在 9–16。

| id | 名称 | 族 | 收益 | 代价 |
|---|---|---|---|---|
| `perfectionist` | 一丝不苟 | 产出 | 月贡献 ×1.22 | 开发周期 +2 月 |
| `hardCharger` | 拼命三郎 | 产出 | 连续作战 ≥3 月时月贡献 ×1.4 | 每第 6 个月强制倦怠：当月 ×0.5 |
| `earlyProdigy` | 少年天才 | 成长 | 前 8 年属性成长 ×1.5 | 第 8 年后 ×0.8 |
| `generalist` | 杂食 | 成长 | 非本职维度贡献 ×1.35 | 本职维度 ×0.85、属性成长 ×0.9 |
| `techRecluse` | 技术宅 | 成长 | 本职维度贡献 ×1.3 | 非本职 ×0.85、生活开销 ×1.1 |
| `loneWolf` | 孤狼 | 人际 | 月贡献 ×1.2 | 相处月数不增长（关系停滞） |
| `greatTeacher` | 名师 | 人际 | 关系推进 +2 月/月 | 自己属性成长 ×0.8 |
| `niceGuy` | 老好人 | 人际 | 分离月数冻结（交情不断） | 生活开销 ×1.12 |
| `trendHunter` | 风口猎手 | 时代 | 踩中潮流时熟练度加成 ×1.5 | 没踩中 ×0.85 |
| `retroDealer` | 古董商 | 时代 | 没踩中潮流时熟练度加成 ×1.3 | 踩中 ×0.8 |
| `gambler` | 赌徒 | 风险 | 事件质量增益 ×1.5 | 事件质量损失也 ×1.5 |
| `steadyHand` | 稳如老狗 | 风险 | 事件质量损失 ×0.5 | 事件质量增益 ×0.7 |

> 与 §5 候选表的偏差（实现时按「钩子是否真实存在」调整）：
> - **技术宅**原设计依赖「技术浪潮系统」（不存在），改为「本职/非本职维度专注」。
> - **杂食**原设计想改「副维成长」（主角只有本职属性一个成长通道），改为非本职维度贡献。
> - **名师**原设计想改「后辈成长」，`junior` 成长通道不存在，改为关系推进 +2。
> - **一丝不苟**原设计想改「评分下限」（career 侧无 scoreFloor），改为月贡献换周期。
> - **铁公鸡**（首批）的代价在首批已从「人脉增长」改为「职级 XP」——`bonds` 里没有 rapport 字段。

### 新增效果键与挂钩点

| 键 | 含义 | 挂钩代码 |
|---|---|---|
| `devMonthsDelta` | 虚拟项目开发周期偏移 | `startVirtualProject`（`career.js:2860` 附近） |
| `streakThreshold` / `streakContributionMult` | 连续作战阈值与加成 | `sim.careerGrindMult` |
| `burnoutEveryMonths` / `burnoutContributionMult` | 每 N 月强制倦怠与当月倍率 | `sim.tickCareerGrind` + `sim.careerGrindMult` |
| `mainDimContributionMult` / `offDimContributionMult` | 本职 / 非本职维度贡献倍率 | `applyMonthlyLiveContribution` |
| `skillBonusTrendOnMult` / `skillBonusTrendOffMult` | 顺 / 逆潮流熟练度加成倍率 | `sim.careerTrendSkillMult` → `careerMonthlyContributionByDim` |
| `eventQualityPosMult` / `eventQualityNegMult` | 事件质量增益 / 损失倍率 | `scaleQualityAmount`（单喉道，4 处调用点共享） |
| `bondApartDelta` | 分离月数增长量（-1 = 冻结） | `sim.tickCareerBonds` |

新增状态字段：`st.career.grindStreak`（连续作战月数）、`st.career.burnoutMonth`（当月是否倦怠），缺省安全，老存档兼容。

### 测试

- 新增 6 条：第二批 12 条收益/代价、潮流双分支、老好人冻结分离、拼命三郎 streak+倦怠、一丝不苟周期、赌徒/稳如老狗事件双向缩放。
- 合计 **114 passed**。
- **顺手修掉既有的测试不确定性**：`createCareerGame` / `createNewGame` 用 `Date.now()` 播种，导致整条链随运行时刻漂移（偶发 `baseline equals formula`、`pitch resolves virtual` 失败，实测约 1/5 概率）。在测试沙箱里固定 `Date.now()`（`TestDate.now`），连跑 8 次全绿。

## 12. 整理批（2026-09-18）：18 → 15 条，清掉「没有消费方」的效果

### 12.1 起因与逐键审计

用户指出「生活开销这个属性目前没有实际作用」。把 18 条的**每个效果键追到真实消费方**后，情况比这更糟 ——

| 键 | 状态 | 依据（本轮实测） |
|---|---|---|
| `livingCostMult` | **死** | `personalEconomy.deductLivingCost = false`；且 `savings` 只喂 UI 与结算页，`savingsGate`（200000）**没有任何消费方**。即**生涯档的「钱」整体没有出口**，不是生活开销一项的事 |
| `bondApartDelta` | **死** | `monthsApart` 全仓无读取点（`tickCareerBonds` 只写不读） |
| `bondTogetherBonus` | **弱（保留）** | 只影响关系线 `when.minMonthsTogether` 的开线门槛 —— 有真实后果但无数值后果 |
| `devMonthsDelta` | **弱** | 只作用于空窗虚拟作；玩家在研目录作的档期由目录表钉死，改不到 |
| 其余 18 个键 | 活 | 月贡献 → `liveStats` → 作品四维 → 评分/销量；属性成长 / 职级 XP / 熟练度趋势 / 事件波动 / 灵感 全部有真实消费方 |

受影响的天赋：**工作狂 / 学得快 / 老好人 / 技术宅 / 铁公鸡** 5 条的钱项全空 → 工作狂、学得快、技术宅是**纯白送**，铁公鸡是**纯惩罚**；老好人收益与代价**双死**（等于没选）；一丝不苟的代价（`devMonthsDelta`）近似无效。

### 12.2 15 条定稿（族 + 收益 / 代价）

开局**随机抽 1~3 条**（`startRoll.traitCountMin/Max`）**全部直接生效**并锁定，界面上没有选择步骤；同「收益轴」最多出一条（`traits[].axis`，见 §12.5）。每条固定一个收益 + 一个代价，且落在不同资源上。

| 族 | id | 名称 | 收益 | 代价 | 权重 |
|---|---|---|---|---|---|
| 产出 | `workaholic` | 工作狂 | 月贡献 ×1.25 | 职级 XP ×0.85 | 12 |
| 产出 | `perfectionist` | 一丝不苟 | 月贡献 ×1.22 | 属性成长 ×0.85 | 11 |
| 产出 | `hardCharger` | 拼命三郎 | 连轴 ≥3 月月贡献 ×1.4 | 每 6 月倦怠，当月 ×0.5 | 11 |
| 产出 | `loneWolf` | 孤狼 | 月贡献 ×1.2 | 非本职贡献 ×0.8、关系推进 −1 | 11 |
| 产出 | `inspirationBurst` | 灵感爆发 | 灵感月（12%）随机一维 +5 | 该月属性与职级 XP 归零 | 11 |
| 成长 | `fastLearner` | 学得快 | 属性成长 ×1.3、职级 XP ×1.3 | 月贡献 ×0.8 | 12 |
| 成长 | `lateBloomer` | 大器晚成 | 第 10 年起成长 ×1.4 | 前 10 年 ×0.85 | 10 |
| 成长 | `earlyProdigy` | 少年天才 | 前 8 年成长 ×1.5 | 第 8 年后 ×0.8 | 10 |
| 成长 | `generalist` | 杂食 | 非本职贡献 ×1.35 | 本职 ×0.85、成长 ×0.9 | 12 |
| 成长 | `techRecluse` | 技术宅 | 本职贡献 ×1.3 | 非本职 ×0.85、成长 ×0.9 | 11 |
| 人际 | `peoplePerson` | 万人迷 | 关系推进 +1、事件正面 ×1.25 | 月贡献 ×0.85 | 12 |
| 时代 | `trendHunter` | 风口猎手 | 踩中潮流熟练度 ×1.5 | 没踩中 ×0.85 | 10 |
| 时代 | `retroDealer` | 古董商 | 没踩中 ×1.3 | 踩中 ×0.8 | 10 |
| 风险 | `gambler` | 赌徒 | 事件增益 ×1.5 | 事件损失 ×1.5 | 10 |
| 风险 | `steadyHand` | 稳如老狗 | 事件损失 ×0.5 | 事件增益 ×0.7 | 10 |

**删除 3 条**：
- `niceGuy` 老好人 —— 收益（`bondApartDelta`）与代价（钱）双死，等于不存在。
- `pennyPincher` 铁公鸡 —— 收益（钱）是死的，只剩「职级 XP ×0.8」的纯惩罚。
- `greatTeacher` 名师 —— 收益只有「关系推进 +2」（软资源），代价却是实打实的属性成长 ×0.8 且与万人迷重复 → 净亏。

**重设计 6 条**（把死键换成活键）：工作狂（钱 → 职级 XP）、学得快（钱 → 月贡献）、一丝不苟（`devMonthsDelta` → 属性成长）、技术宅（钱 → 属性成长）、万人迷（补 `eventQualityPosMult` 1.25 让收益有硬成分）、孤狼（补 `offDimContributionMult` 0.8，让「不协作」变成硬代价）。

**对偶设计**（改动后成立，玩家在牌面上能读出取舍）：产出 ↔ 成长（工作狂 / 学得快 / 一丝不苟互为正反面）、本职 ↔ 非本职（杂食 / 技术宅）、早期 ↔ 后期（少年天才 / 大器晚成）、顺流 ↔ 逆流（风口猎手 / 古董商）、放大 ↔ 收敛（赌徒 / 稳如老狗）。

### 12.3 权重重排

`drawWeight` 从 9~16 收紧到 **10~12**。它的真实作用**不是**「三选一里出现的概率」，而是**开局抽到这一条的概率**（`rollCareerStart` 加权抽 1 条）：旧池 16/203 = 7.9% ~ 9/203 = 4.4%，新池 12/163 = **7.4%** ~ 10/163 = **6.1%**。

分档按**泛用性**（不再与强度挂钩 —— 原来权重最高的工作狂恰好最泛用、代价还是死的，等于「最容易被抽到的白送」）：通用型 12（工作狂 / 学得快 / 杂食 / 万人迷）、中间 11（一丝不苟 / 拼命三郎 / 孤狼 / 灵感爆发 / 技术宅）、情境型 10（两条分期 + 两条潮流 + 两条风险）。

⚠️ **轴去重会稀释「多条目轴」，权重不是唯一决定因素**：抽第 2/3 条时同轴已被排除，于是「独苗轴」的天赋出现率反而更高。实测 400 局（页面内 `rollCareerStart`，各轴合计）：out（6 条）262 次 → 单条 39~48；growth（3 条）167；skill（2 条）107；event（2 条）116；**bond（仅万人迷）79**、**insp（仅灵感爆发）68**。这是「保证多条各有手感」的代价，不是 bug —— 轴内条目越多，单条越难被抽到。

### 12.4 防复发

- 新增单测 **`careerTraitsStayOnLiveKeys`**（替换掉原来的 `perfectionistLengthensDevCycle`）：禁止 career 天赋使用 `livingCostMult` / `bondApartDelta`；断言池子恰好 15 条；断言**每条都有真实收益 + 真实代价**（`eventQualityNegMult` 按「放大负面＝代价」反向判定；灵感爆发的代价由引擎内建行为承载，单独豁免）；displayName 唯一；员工池不得混入主角特性。
- 删掉 `niceGuyFreezesApartMonths`（测的天赋已删）。
- `career.js` 三处注释写清了坑：钱没有出口（打开 `deductLivingCost` 前先让钱有用）、`devMonthsDelta` 只影响虚拟作、`bondApartDelta` 没有读取点。

### 12.5 获取方式：开局随机 1~3 条（不是三选一）

**审计发现的偏差**：§3 / §10 写的是「开局抽 3 条**三选一**，选定即锁定」，但实现从来不是三选一 —— `sim.rollCareerStart` 只按 `startRoll.traitCount` 加权抽 N 条、整组写进 `st.career.traits` 并锁死；`sim.rollCareerTraitDraw`（抽 3 条）与 `sim.pickCareerTrait`（选定并锁定）**没有任何 UI 调用方**，是只在单测里被调用的孤岛代码（保留着，将来若要三选一可以直接接线）。

**Master 拍板（2026-09-18）**：每局**随机出 1~3 个天赋**。落地：

| 项 | 值 |
|---|---|
| `startRoll.traitCountMin / traitCountMax` | `1 / 3`（`sim.irand` 随机；旧的单个 `traitCount` 仍作为兜底读取） |
| `startRoll.traitAxisDistinct` | `true` —— 同一「收益轴」最多出一条 |
| `traits[].axis` | 15 条全部标注：out（产出 6 条）/ growth（成长 3）/ skill（熟练度 2）/ event（事件 2）/ bond（人际 1）/ insp（灵感 1） |
| `sim.careerTraitAxis(id, config)` | 新入口；**未标 axis 的天赋按各自独立处理**（缺字段只是少一层去重，不会互相挤掉） |
| UI | `#roll-trait` 天然多条竖排；多条时标题带序号（`天赋 2/3 · 孤狼`） |

**为什么要轴去重**（不是可有可无的润色）：
1. **防强度爆炸**：产出轴 3 条同时生效能叠到 `1.25 × 1.22 × 1.2 = 1.83`；现在产出轴最多 1 条。
2. **防对偶互相抵消**：`workaholic`（产出 ×1.25）与 `fastLearner`（代价产出 ×0.8）同抽 → 月贡献净 1.0，玩家拿了两张牌却感觉不到任何收益。

**实测**（页面内 `rollCareerStart`，固定种子序列）：
- 400 局：抽到 1 / 2 / 3 条分别 **133 / 135 / 132**（均匀）；同轴重复 **0** 次。
- 布局压测（各轴文案最长的组合：学得快 + 孤狼 + 万人迷）：**360×640 / 375×667 / 390×844 三档 `.hero` 溢出全为 0**、三张卡全可见、页面不滚。
  - ⚠️ 修这个之前 360×640 的 `.hero` 会被顶出 **8px**（它 `overflow:auto` → 变成内部滚动 = 违反「一屏放完」）。已在 `@media (max-height: 700px)` 里收紧 roll 卡（`.hero p` 边距 20→12、`.roll-card` padding 12→10、`.roll-trait` 10/10→8/8、`.roll-item + .roll-item` 8/8→6/6）。

**沿用「重掷开局」**：`rerolls: 3` 仍是唯一的随机性调节手段（属性 + 擅长 + 天赋一起重掷）。
