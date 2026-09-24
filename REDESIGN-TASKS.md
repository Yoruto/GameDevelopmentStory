# v2 玩法重设计 · 实施任务书

> 用途：供 AI 逐步执行的修改任务清单。设计理由与背景见 `GAMEPLAY-REDESIGN-PLAN.md`，本文档只讲「改什么、怎么改、怎么验收」。
> 定稿：2026-09-20。执行前请通读 §0 全局铁律。

---

## 0. 全局铁律（每个任务都适用）

1. **存档兼容：一律不考虑。** 只有明确的 res 版本才考虑存档问题，当前全部是 dev 版本。任何旧档直接作废。
2. **事实源与命令链**：改数值/文案只改 `activity/*.json`（公司/作品/事件的事实源是 `activity/career-world.json`，直接改它）→ `python scripts/sync_config.py`（生成 `h5/config.json` + `h5/js/config.generated.js`，**生成的文件禁止手改**）→ `node tests/run-sim-tests.js`（现有 **78 条**必须全绿，含加载列表同源 / API 面 / `sim._` 基座守卫）。
3. **禁止**重跑 `scripts/build_career_world.py`——模板已与 json 长期分叉，重跑会冲掉手工调校。
4. **JSON 写盘纪律**：文件全是明文、无 `\u` 转义、LF。用「精确字符串替换」写盘，禁止 json.dump 整体重排；改完必须 `json.loads` 复核。
5. **同一文件禁止并行发多个 Edit**（第二个会静默失效）；行尾**实测**（2026-09-20）：`h5/js/sim/career*.js`、`h5/index.html`、`tests/run-sim-tests.js` 都是 **LF**（旧记「h5/js 是 CRLF」已作废）；改前仍先探。
6. **RNG-free 判定**：所有 `skipIf` / 新增 `req` 门禁判定里禁止任何随机数。
7. **事件文案纪律**：带 `speakerBond` 的拍渲染成 `名字：「body」`，body 必须是该角色第一人称台词；线末尾必须留无条件兜底拍（防尾拍被 skip 后直接 completeLine）。
8. **UI 硬约束**：每屏一屏放完不滚动（见 `UI-DESIGN-PLAN.md`）；全屏只有一个金色实心主按钮；维度色不变（程序金/策划绿/美术蓝/音乐橙）。
9. 沙箱 bash 先 `export PATH="/c/Windows/System32:/c/Windows:/usr/bin:$PATH"`；中文 JSON 上禁用 `grep -c`（误报 0），用 Python 读。

**任务依赖**：P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8。P1 完成后 P2/P3 可并行；P7 各子项相互独立。

---

## P0 前置重构（✅ 2026-09-20 已完成）

不是玩法改动，是把后续所有 P 任务的**落点**整理出来（拆分方案与扩展手册见 `ARCHITECTURE-V2.md` §3.2 / §6 / §7）。

- `career.js` **5547 → 3363 行**，摘出 7 个独立域（各域文件与对应 P 落点）：
  | 文件 | 内容 | 对应 P |
  |---|---|---|
  | `career-colleagues.js` | 制作组同事生成 | — |
  | `career-awards.js` | 年度颁奖评选 + 剧情页 | P5c |
  | `career-events.js` | 开发/发售后期事件、选项结算、idleGap | P2b / P4a / P6 |
  | `career-mobility.js` | 跳槽 / 邀约 / offer | P4c |
  | `career-bonds.js` | bond 同址/远程、junior 入场离队 | P5b |
  | `career-world-sim.js` | 世界作品月度推进、虚拟池、媒体数据 | P1 / P2b |
  | `career-pace.js` | 月度主循环 / 决策点判定 | **P3 主战场** |
- 新增基础设施：`scripts/split_career.py`（后续继续摘域/加共享工具都走它，会**自动同步** `index.html` 与 `tests/run-sim-tests.js` 的加载列表）、`scripts/validate_career_world.py`（数据校验，P1 的验收工具，已可用）、共享基座 `sim._`、API 面守卫。
- 验收：78 条测试全绿；真机开局推进 30 个月无控制台错误。
- **给后续执行的提示**：改成长/项目 → `career.js`；改事件与 req → `career-events.js`；改颁奖 → `career-awards.js`；改跳槽 → `career-mobility.js`；改虚拟池 → `career-world-sim.js`；改过月/节点 → `career-pace.js`。新增跨域共享工具要同时登记到 `split_career.py` 的 `SHARED_TOOLS`。

---

## P1 厂商温和合并（128 → 约 70）（✅ 2026-09-20 已完成，落地 75 家）

**目标**：砍掉低存在感公司，作品归并到保留公司，跳槽表更干净。

**原方案**：作品数 ≤1 全砍；作品数 =2 且【无 landmark && 未被 openingOffer/事件线引用】砍；预计 ~70 家。归并按 successor → publisher → series → 同区兜底。

**实测校正（原规则跑不出来，必须记下）**：
- `landmark` 实际覆盖 **39%**（208/530 部），且「作品数 =1」的 28 家里有 **17 家持招牌名作**（DMA 的 GTA3 9.5 / Rocksteady 的蝙蝠侠 9.6 / Looking Glass 的系统冲击2 9.2 / Westwood 的命令与征服 / 游戏科学的黑神话 / PopCap 的植物大战僵尸…）。原规则 1 无条件砍 ≤1，会把这 17 家一起砍掉，而规则 2 却为作品数 =2 设了 landmark 保护——**规则内部矛盾**。
- 经 Master 拍板「允许把名作归并给能力匹配的公司，尽量压缩」，最终口径：
  - **砍**：作品数 ≤1；作品数 =2 且 landmark 最高分 < 9.4 且未被 offer / 事件线引用；
  - **保**：landmark 最高分 ≥ 9.4 的作品数 =2 公司；**被 `successorId` 或前辈 `successorCompanyId` 指向的公司**。
- **新增保护（原规则漏写、实测必须加）**：`successorId` 落点（`namco→bandaiNamco` / `koei→koeiTecmo`，断了 company-merger 线无处收束）与前辈落点（`konami` 的小岛秀夫 → `kojimaProductions`，断了 bond-mentor「跟着走」拍没去处）。

**归并规则**（整家公司搬迁，不是逐部作品）：
1. `successorId` / `mergedYear` → 保留公司（支持链式解析）；
2. 同 `publisherId` 合作最密的保留公司；
3. 同 `seriesId` 的保留公司；
4. **能力匹配**：目标公司 `studios[].genreIds`（题材 +2）/ `gameplayIds`（玩法 +1）与 `tags` 命中该作品题材玩法，按总得分排序；同区优先 → 分高优先 → 大厂优先；
5. 兜底：同 region + 体量相近。

**结果**：128 → **75 家**（砍 53）。作品 530 部一部不丢：58 部 `companyId`、66 部 `publisherId`、58 部 `studioId` 改挂新公司；33 位前辈迁入新东家（总数仍 111 位）；`openingOffer.companyIds` 去掉已砍公司。

**副作用（已就地处理，别忘）**：
- `careerSeniorLine` 会拼公司**所有**前辈进入职邀请文案 —— `ea` 收 10 位后会爆（违反一屏约束）。已改为最多列 2 位 + 「等N位」（`h5/js/sim/career.js`）。
- 「不可入职的背景公司」21 → 1（被砍的 20 家都是 power=1 的已倒闭发行商，本就不可入职）；开局 small 档 18 → 14。相关测试断言随之下调并注明原因。

**验收**：
- [x] `json.loads` 复核通过；公司数 **75**（65~75 区间）
- [x] 无孤儿引用（作品→公司 / 工作室 / offer / 事件线 / successorId / 前辈落点全通；`validate_career_world.py` **0 error**）
- [x] `sync_config.py` + `node tests/run-sim-tests.js` → **78 条全绿**
- [x] 真机（agent-browser，`file://` 直开）：开局 → 30 个月推进 → `1997.07 / Interplay`，10 次事件抉择、41 部世界作品、跳槽正常（`snk` → `interplayFallback`）、**控制台 0 错误**；GTA3 已在 rockstar 名下
- [x] 跳槽表抽查：被砍公司原作品在归并后公司名下可正常立项

**工具**：`scripts/merge_companies.py`（`--dry-run` 出报告 / `--landmark-min-score` 调口径；落盘自动备份 `scripts/_cw_before_p1.json`，幂等可重跑）。

---

## P2 货币移除 + 虚拟池下线 + 开发周期拉长（✅ 2026-09-20 已完成；2c 的达标项待拍板）

**目标**：删掉死钱、停用虚拟作品、拉长真实作品周期，为节点推进铺路。

**2a. 移除货币（已完成）**
- 删除范围：`personalEconomy` 整块、`jobRanks.salaryFloor`、75 家公司 `salaryMult`、`traits.thrifty`、
  `copy.career.{salaryLabel,livingLabel,savingsLabel,payDeltaPrefix,settleSavingsLabel}`。
- sim 侧删 7 个薪资/生活费函数（`salarySpec`/`salarySteps`/`stepIndexOf`/`snapCareerSalary`/
  `careerSalaryStepUp`/`careerSalaryFor`/`careerLivingCost`）与 state 的 `savings`/`salary`/`lastPay`/`funds`；
  UI 侧删顶栏「积蓄」KPI 与结算页积蓄行。
- **`salaryMult` 的例外处理**：`careerHireChance` 原本读 `personalEconomy.salary.statRef`（= 46），
  属 sim 逻辑引用 → 该数值迁到 `mobility.statRef`（数值不变），其余全部删除。
- 天赋死键 `livingCostMult` / `bondApartDelta` 一并移除（唯一消费方随货币体系走）。
- 新守卫 `careerEconomyFullyRemoved`：配置 / 文案 / sim API / state 四层断言货币不存在，防回潮。

**2b. 虚拟池下线（已完成）**
- `virtualPool.enabled = false`（字段与 `titlesByGenre` 全部保留）；所有生成路径 gate 在 `sim.virtualPoolEnabled` 后：
  `startVirtualProject`、`queueProducerVirtualPitch`、`assignCareerProject` 的虚拟分支。
- 空窗新规则：`gap < idleGap.minDevMonths`(6) 静默过月；`gap ≥ 6`、或本公司已排不出下一档目录作
  （`gap == null`）时弹一次「空窗抉择」——接外包 / 进修 / 休息（`outsource` / `study` / `rest`）。
- 用例：`careerVirtualPoolOffByDefault`（连推 60 月零虚拟作）、`careerIdleGapChoiceOnceAndHop`
  （短空窗静默 / 长空窗只弹一次 / 三选项结算 / 空窗期可跳槽 / 空窗后接档）；
  虚拟池机制本体用 helper `withVirtualPool(cfg)` 打开开关后继续覆盖（时长钳制、命名池、初始四维、制作人自选企划）。

**2c. 周期拉长（已完成，1.75 待原型验证）**
- `development.cycleMult = 1.75`，唯一换算入口 `sim.titleDevStart`：
  `开工月 = 发售月 − round(原时长 × cycleMult)`，**发售月是硬数据，不动**。
- ⚠️ `titleCoversMonth` / `titleProgress` 签名已加 `config`（新增第 5 / 第 6 个形参）。
  **漏传 config 会静默退回未换算的原始开工月**，造成「offer 目标作品」与「在研判定」分叉——改这两处调用点必须带 config。
- 新增 `sim.careerCycleMult` / `sim.monthFromIndex`；虚拟作不走这条换算（它自己从当前月往后排）。
- 用例 `careerCycleMultLengthensDevWindow` 钉死口径与边界（覆盖区间是闭区间 `[start, release]`）；
  注入伪目录作的旧用例统一走 helper `fixCycle(cfg)` 把倍率固定为 1。

**验收**：
- [x] 全仓无货币 / 薪资残留（`careerEconomyFullyRemoved` + 真机 dump `moneyLeak: []`）；
- [x] 关闭开关后整局无虚拟作品生成（测试断言 + 真机 `virtualLeak: 0`）；
- [x] `node tests/run-sim-tests.js` 全绿（**81 条**）；`scripts/validate_career_world.py` 0 error；
- [x] 真机冒烟（390×844，`file://` 直开，开局 → 推进 30 月 → 入职 ea / art）：errCount 0、顶栏只剩「年月 / 声望」2 格、无货币字段；
- [x] ~~典型路线参与作品数 8~15~~ → **口径作废**，由 P2-fix 的「公司全生命周期有活可干」替代。

**⚠️ 待拍板 A / B → 2026-09-20 已拍板并落地（见 P2-fix）**
原实测：`cycleMult` 只前移窗口、不新增作品 → 路线参与作品中位 5 部；全公司在研覆盖中位 37%；
22 家可入职公司开局当月在研为空（入职即长空窗）。
**决定**：不补历史作品、也不重估口径，改用**游戏池**补全——凡是排不出目录真作的月份，从池里抽一部顶上。

---

## P2-fix 游戏池：公司全生命周期有活可干（✅ 2026-09-20 已完成）

**目标（Master 三条指令）**：
1. 池里的作品分给「作品不够」的公司，保证每家公司从成立到 2025 年底都有活可干
   （老牌厂商允许几个月空窗，新厂商从成立年一直到结尾）；
2. 入职当月在研为空 → 立刻从池里抽一部给玩家做；
3. 建一个游戏池，没有作品时就从里面抽。

**3.1 游戏池数据（`careerWorld.titlePool`，由 P2b 的 `virtualPool` 改名并重新启用）**
- `enabled: true`；`coverage: { enabled, minFillMonths: 6, maxFillMonths: 24 }`；
  `fallback: { enabled: true }`。策略子块关掉即回退 P2b 的「短空窗静默 / 长空窗弹抉择」。
- 命名库 `titlesByGenre`（20 题材 × 12~24 名，共 276）与工期/口碑/团队份额等规格原样沿用。

**3.2 sim 侧（`career-world-sim.js` 的池域）**
- `sim.poolCandidateAt(st, config, companyId, studioId, year, month, opts)`：**纯函数**算出「顶这个空档」的池作
  （不写 state、**不掷 RNG**）。判定：到下一档目录真作的空窗 `< minFillMonths` → 不补（短空窗交给推进吸收）；
  否则工期取 `minFillMonths ~ min(maxFillMonths, devMonthsMax, 空窗长度)`，且发售不得跨过下一档真作开工月。
- 取名/选题材玩法走 **FNV-1a 哈希 + 取模**（`hash32/mixSeed/pickBySeed`）：同一家公司同一个月永远抽出同一部作，
  重开档一致、读档不漂，并且**不消费 `st.rng`**（否则开局抽天赋、事件掷点会跟着位移）。
- `sim.startPoolProject()` 落盘到 `virtualProjects / virtualDetails`；旧的 `startVirtualProject` 保留为别名。
- `assignCareerProject` 的新顺序：**目录真作 → 池作 → （池不可用才）空窗抉择**；短空窗静默过月。
  制作人遇到 ≥ `producerCareer.pitchMinFillMonths`(18) 的长空档时，仍走「自选题材玩法」的立项界面。
- 池作带 `virtual:true` + `pool:true` 标记：不进 offer/邀约准入（`companyInDevCatalogTitle` 只看目录真作），
  `resumeVirtual` 文案改为「过渡项目」。

**3.3 验收（`scripts/pool_coverage_report.py` + 测试 `titlePoolCoversEveryCompanyLifespan`）**
> ⚠️ 下表是 P2-fix 当天的口径，**含「僵尸月」**（已消亡公司死后仍被算进可玩区间的月份），
> 且当时目录真作只有 523 部。修正见 P2-fix-a 的验收表 —— 下表只作历史留档。

| 口径 | 数值（P2-fix 当天，口径有误） |
|---|---|
| 可入职公司 | 74 家 / 24216 公司-月 |
| 目录真作覆盖 | 42.1% |
| 池作补全 | 55.1% |
| 仍空窗（短空窗） | 2.9% |
| 全场最长空窗 | **5 个月 = minFillMonths − 1（上限）**；超限公司 **0 家** |

- [x] 入职当月无在研 → 立刻拿到池作（测试 `titlePoolCoversCompanyWithoutCatalogWork`，真机实测）；
- [x] 池关掉后完全回到 P2b 行为（测试 `titlePoolOffFallsBackToIdleGap`）；
- [x] 池作名只从题材名库抽且本局不重名（`poolTitlesComeFromGenreBankAndNeverRepeat`）；
- [x] 池作工期受下一档真作开工月钳制（`titlePoolDurationClampedToNextCatalog`）；
- [x] 全公司覆盖扫描无超限空窗；`run-sim-tests` **81 条全绿**（当时）、API 面 253 导出。

**遗留**：`gap < 6` 的短空窗仍是「静默过月」（当时 2.9% 的月份）。P3 节点推进会把它压成「一小步」，届时再看是否需要体感提示。

---

## P2-fix-a 补数据 + P2-fix-b 过渡项目收益（✅ 2026-09-20 已完成）

**拍板**：Master 选「a + b 一起做」——把池作占比压下去（a），同时让剩下的池作本身值得做（b）。

### a. 补数据：让目录真作真正铺满时间轴

**a0 先修口径（不修的话后面全是错的）**
`pool_coverage_report.py` 原来只按 `hireFromYear` 起算、**漏了 `hireUntilYear` 终点**，
把已消亡公司（sierra 2008 关、bullfrog 2001 关…）死后的月份算成「空窗」，于是：
- 真实基线从「真作 42.1% / 池作 55.1%」修正为 **真作 48.2% / 池作 48.5% / 空窗 3.3%**（24216 → 21024 公司-月）。

**a1 消灭僵尸公司（11 家 / 2304 僵尸月）**
`hireUntilYear != null` 但 `successorId == null` 的公司，`sim.mergerCompanyDue` 永不触发
→ 玩家留在「数据里已消亡」的公司做池作到 2025。按史实（史实不明则同 region + 同能力 + power 最小跳变）
补 11 条接班：`scripts/patch_successors.py`（含「接班公司必须活过被并方」的防连锁校验）。
**sim 侧无需改代码**——`mergerCompanyDue` 的条件本就正确，是数据缺字段。

**a2 去重**
删掉 7 组「同公司 + 同名 + 同发售月」的真重复（会同一部作在榜单/奖项里被算两遍）：
`scripts/patch_dedupe_titles.py`（530 → 523）。

**a3 补真实历史作品（主体）**
- `scripts/patch_add_titles.py` 第一批 **138 部**（523 → 661）：按公司补「大洞」年份的代表作。
- `scripts/patch_add_titles2.py` 第二、三批共 **320 部**（661 → 975）：专补补过之后仍靠池作顶的公司
  （dice 只有 3 部真作 / 270 池作月、sierra 2 部 / 167 月、lucasarts 2 部 / 182 月、irrational、bullfrog、bungie…）。
  参考作品选择放宽为「公司作品 < 4 部时在同题材里取年代最近」，否则 20 部新作会继承同一部旧作的四维形状。
- 规则（确定性、可重跑）：`stats` 按参考作缩放至合计 `300 + (score−8)×6` 夹 `[30,95]`；
  `devStart = 发售月 − devMonths`；`inviteEligible: false`（不扰动已验收的准入链路）；
  `landmark: false`（留给 P5）；题材/玩法从 `activity/config.json` 的 `content` 段校验。
- 新增 `scripts/_analyze_pool_gaps.py`：列出每家公司「目前只有池作顶着」的月段，用于精确安放补录作品。

**a4 清占位作 + 修窗口错配**
- `scripts/patch_drop_worldfill.py`：删掉 6 条 `worldFill_*`（由已废弃的 `build_career_world.py::pad_year_releases`
  生成，blurb 里的公司名与 `companyId` 错配，`worldFill_2015_0` 还越过了 koei 的 `hireUntilYear`）。
  `titlePool.minWorldReleasesPerYear` 在 `h5/js` 里已无消费方。
- `scripts/patch_fix_hirewindows.py`：`polyphony.hireFromYear` 1998→1997（GT1 发售于 1997.12）、
  `tencent.hireFromYear` 2003→2001（国服网游从 2001《热血传奇》起算）。

**a 验收（修正口径后）**

| 口径 | 起点（口径修正后） | P2-fix-a 完成 |
|---|---|---|
| 目录真作覆盖 | 48.2% | **80.3%** |
| 池作补全 | 48.5% | **17.0%** |
| 仍空窗（短空窗） | 3.3% | 2.8% |
| 全场最长空窗 | 5 月 | **5 月 = 上限**；超限公司 **0 家** |
| 目录作品数 | 523 | **975**（titles = titleDetails） |
| 可入职公司 / 公司-月 | 21024 | 21432（polyphony/tencent 窗口放开） |

余下的低真作率公司（teamIco 47.8% / tgc 50.8% / pioneer 52.4% / treasure 58.6%）都是
**真作品本就只有个位数**的独立小厂 —— 它们之间的空档由池作顶班是正确的设计，不再硬补。

### b. 过渡项目本身成为有意义的经历

原来池作是一条**惩罚线**：成长砍半（`xpPerVirtualRelease` 5 vs 历史作 8、`virtualReleaseScale` /
`virtualScale` 0.5）、晋升学分打 4 折、不给奖项、不进榜单、履历只剩「过渡项目」四个字。
玩家时间轴上 17% 是池作 → 近五分之一的时间在打白工。

| 旋钮 | 旧 | 新 | 落点 |
|---|---|---|---|
| `companyXp.xpPerVirtualRelease` | 5 | **7** | 工作室经验（历史作 8，留 1 点差表示不是署名作）|
| `jobRanks.statGain.virtualReleaseScale` | 0.5 | **0.75** | 发售那一笔属性 |
| `jobRanks.jobXpGain.virtualScale` | 0.5 | **0.75** | 发售那一笔职级经验 |
| `jobRanks.virtualCreditWeight` | 0.4 | **0.5** | 晋升的「作品学分」折价 |
| `titlePool.devStatMult` / `devJobXpMult` | — | **1.15** | **开发月**加成（小项目什么都得自己上手）|

叙事：`copy.career.poolNotes`（4 档 21 条，档位沿用 `release.media` 的 top/high/low 与媒体评语同源）
+ `sim.titlePoolNote(titleId, score, config)`（**RNG-free**：按 titleId 稳定哈希选条，重绘/读档不漂）
+ 履历页标题改成「署名作品 N · 过渡项目 M」+ 结算页 `transitionCount`。

- [x] `run-sim-tests` **85 条全绿**（新增 `transitionProjectsPayOffInsteadOfPunishing`、
  `catalogTitlesAreConsistent` 两条守卫）；API 面 253 → **255**（`sim.mediaQuoteBand` / `sim.titlePoolNote`，
  快照已重建，旧快照备份 `scripts/_api_snapshot_before_p2fixb.json`）；
- [x] `scripts/validate_career_world.py` 0 error（作品数区间放宽到 480~1100）；
- [x] 整局实测（`scripts/_probe_career.js`，12 局 × 372 月，**未结算晋升队列**故为保守下界）。

### ⚠️ a+b 的连锁效应：生涯曲线被抬高了（P3 必须先拍板）

| 配置 | 主职维终值（34 年） | 空窗月 | 跨过晋升硬门槛的月序 28/34/41/51/60 |
|---|---|---|---|
| 关掉游戏池（回到 P2b 世界） | 67.2 | 151 / 372 | 25 / 72 / 112 / 182 / 235 |
| 池作照旧（b 之前） | 92.3 | 5 / 372 | 24 / 53 / 93 / 144 / 195 |
| 池作加成（b 之后，当前） | **97.7** | 5 / 372 | 24 / 52 / 89 / 140 / 188 |

**根因**：属性成长的唯一来源是「在研月 × 阶段权重」。P2-fix 把空窗从 151 月压到 5 月，
等于凭空多出 146 个有成长的月份 —— 这一项（+25 点）比 b 的加成（+5.4 点）大得多。
`jobRanks.statGain` 的注释里那句「现在到 80 出头」是 **P2 / P2-fix 之前**的实测，已经不成立。
上表还是**没结算晋升**的下界，真机（吃满 rankLogBonus）还会更高。

**P3 开工前需要在两条里选一条**（不要两件一起改）：
① `statGain.perDevMonth` 0.12 → 0.10（乘 ~0.83，把曲线拉回 80 出头）；
② 抬高 `promotion.requirements[].mainStat`（28/34/41/51/60 → 约 34/44/56/70/84）。
**别只改门槛**：门槛是硬门槛，属性膨胀会连带把「属性是一辈子的事业」这条体验结论推翻。

---

## P3 节点推进系统（替代过月）

**目标**：UI 只留「继续」按钮，快进到下一个有分量的节点。

**机制**：
- `sim.skipToNextNode()`：循环现有月 tick，直到命中节点判定；中间月份属性成长、开发进度静默结算。**两种驱动必须走同一条 tick 代码路径**；
- 节点优先级：① eventLines 拍（复用现有 waitUntil 调度）② 带选项的开发事件（从 106 条 devEvents 筛「有抉择分量」子集，建白名单）③ 发售/评分揭晓日 ④ 年度颁奖（见 P5）⑤ 跳槽抉择（邀约 / 空窗 ≥6 月）⑥ 晋升；
- 纯氛围事件降级：无选项的自动结算进「近况摘要」，在下一节点前一次性呈现，每条 ≤2 行；
- 跨年时给年份大字幕 + 1 行行业新闻条；
- UI：「继续」替换「下个月」（保持唯一金色主按钮）；近况摘要样式遵守弹窗约束（`#dlg-body` max-height 8em）。

**一致性测试（新增，关键）**：
- 同一 seed 下：逐月驱动整局 vs skipToNextNode 驱动整局，最终 state（属性/作品记录/flags/荣誉）完全一致；
- 「开档推进器」停机条件仍写 `S.career.companyId`（真机验证用，见 skill `agent-browser-sandbox`）。

**验收**（✅ 2026-09-20 完成）：
- [x] 一致性测试通过并合入 `tests/run-sim-tests.js`：`careerNodeSkipMatchesMonthByMonth`
  （同 seed 逐月整局 vs `skipToNextNode` 整局，最终 state 全等；另有 `careerNodeDetectorRegistry`
  守注册表优先级 / 配置闸门 / RNG-free）；
- [x] ~~现有 75 条中「过月相关」用例全部改写为节点驱动~~ → **调整**：既有用例继续走
  `sim.tickMonth`（它与节点推进共用同一条 tick 路径，改写只会复制覆盖面），
  等价性由一致性测试证明；测试基线 85 → **87 条全绿**，API 面 255 → **259 导出**
  （新增 `skipToNextNode` / `careerNodeDetectors` / `careerNodeHit` / `resolveCareerQueueChoice`，
  快照备份 `scripts/_api_snapshot_before_p3.json`）；
- [x] 真机（agent-browser）跑通：开局 offer → 首部作品立项 → 发售揭晓（`发售|国王密令II`）→
  首次颁奖（`1995年度盛典|1995年颁奖夜`），4 次「继续」走完一年，全程无「下个月」按钮
  （`#btn-tick-skip` 已从 DOM/CSS 移除），页面不滚动、errCount 0
  （证据 `scripts/_p3_smoke.png` / `_p3_award.png`）。

**落地备注**：
- `tickCareerToDecision` 保留为 `skipToNextNode` 的兼容别名（旧调用方零改动）；
- 近况摘要：choice 页永远停机，其余页降级为 `近况|推进了 N 个月` 摘要页
  （默认 ≤5 条 + 溢出计数，`careerPace.digestMaxEntries` 可调）；
- 跨年推 `新年|YYYY 年` 字幕 + 1 行确定性新闻条（当年目录最高分真作，`copy.career.yearNewsTpl`）；
- 选项落地统一入口 `sim.resolveCareerQueueChoice`（UI 与测试自动应答同一条 dispatch，
  别再写第二份）；
- 连带修复：`paint.js` 推进按钮文案改读 `copyC.continueButton`
  （`paintStaticCopy` 里 `copyC` 已是 `copy.career`，不是 `config.copy`）。

---

## P4 选项门禁 req + 健康属性 + 声望

**目标**：落地影响链——选项→属性(直接)→作品(间接)→荣誉→后续选项门禁；补健康与声望两条新轴。

**4a. req 门禁**
- 事件选项（devEvents / postLaunch / producerEvents / eventLines 拍的选项）支持：

```json
"req": { "minStat": { "program": 30 }, "flags": ["career.awardStorygoty"], "rank": 4, "health": 3, "renown": 2 }
```

- 不满足 → **置灰显示 + 一行解锁提示**（如「需要：程序 ≥ 30」），不隐藏；
- 判定 RNG-free（铁律 6）；
- UI 沿用 `#dlg-extra` 选项容器（`data-event-opt`），置灰态新增样式。

**4b. 健康属性**
- 5 段体检式状态条、不显数字、初始 4/5，接管货币的 UI 位；
- **只随事件变动，绝不随时间自动衰减**；事件 ±1，全程预计变动 10~15 次；
- 恢复：休息/进修类空窗抉择、家人朋友线正反馈拍；消耗：赶工类抉择、连续大项目、压榨型事件、失败发售后的消沉；
- 赶工类事件文案分年代（年轻时轻、章 4 后重），数值规则不变；
- 效果：`req.health` 门禁（低健康解锁"休整/降档/拒绝加班"，高健康解锁"连轴大项目"）；低于 2 段触发人物线关怀拍；结局分档预留（P7）；
- **v2 禁止**健康影响作品质量。

**4c. 声望**
- 称号链 5 档：无名新人 → 业界熟脸 → 中坚力量 → 明星制作人 → 时代之名；
- 累积规则（初版）：获奖次数×权重 + 作品均分超阈值次数，不做连续积分；数值待原型验证；
- 反哺：邀约档次（高声望解锁大厂主动挖角，走现有 `rollInvitesThisMonth` 年掷一次机制）、`req.renown` 门禁、结局分档（P7）。

**验收**（✅ 2026-09-20 完成）：
- [x] 门禁 RNG-free 断言测试：`careerOptionReqGate`（minStat/flags/rank/health/renown 五类 +
  dispatch 兜底拒绝 + rngCount 前后不变）；
- [x] 置灰选项真机截图（含解锁提示）：`scripts/_p4_lock.png`——「通宵赶工」置灰
  「需要：健康 ≥ 4」、「请大牌歌手」置灰「需要：声望达到『中坚力量』」，未锁选项可点；
- [x] 健康整局只随事件变动：`careerHealthOnlyMovesOnEvents`（静默 24 个月不变 + 钳位 1..5 +
  选项 healthDelta + 低健康关怀拍每年一次 + `manualOnly` 不进随机池）；
- [x] `run-sim-tests.js` **90 条全绿**；API 面 259 → **263**（`applyCareerHealthDelta` /
  `careerRenownView` / `careerRenownTierLabel` / `careerOptionLockHint`，快照备份
  `scripts/_api_snapshot_before_p4.json`）。

**落地备注**：
- req 定义挂在选项上（devEvents/postLaunch/producerEvents 选项、eventLines 拍选项、路径分叉选项）：
  `{ minStat: {program: 30}, flags: ["career.awardStory.goty"], rank: 4, health: 3, renown: 2 }`；
  不满足**置灰 + 一行提示**，不隐藏；`resolveCareerQueueChoice` 兜底再拒一次（lockHint 带回）。
- 健康：`careerWorld.careerHealth`（init 4 / min 1 / max 5 / eraLateYear 2010）；只随事件变动。
  赶工类 10 处选项 `healthDelta: -1`（真机随手一点就可能锁「来/连夜修」），进修/休息/人物线
  正反馈恢复（idle-gap 休息/进修、两门品类课、bond 线 4 个正反馈拍、careCheck 饭局）。
  赶工事件 8 处配 `textLate`（eraLateYear 后换重口径，数值不变）。
- 关怀拍为**轻量实现**：`careCheck`（manualOnly，health ≤ 2 且每年一次，tick 时入队），
  未做成 bond 线专属台词拍——后续想要人物点名可在此基础上换文案。
- 声望：`careerWorld.renown`（winWeight 2 / scoreThreshold 8.5 / tiers [0,6,14,26,42] /
  inviteWeightPerTier 0.25）；`careerRenownView` 纯读；邀约权重随档位上浮；结局分档留 P7；
  **数值待原型验证**（P8 灰盒一并校）。

---

## P5 六章编排 + 年度颁奖双档

**目标**：把碎片事件组织成有起承转合的篇章；每年都有颁奖。

**5a. 章容器**
- `career-world.json` 新增 `chapters` 容器：章界 95-99 / 00-04 / 05-09 / 10-14 / 15-19 / 20-25；
- 每章：开场演出（年份大字幕 + 2~3 行时代白描，风格参考各年代 landmark 的 `shipQuote`）+ 章末收束（时代谢幕文案 + 该年年终颁奖）；
- 章开场演出过 `sync_config.py` 进生成配置，禁止手改生成物。

**5b. 人物线分章盘点（先做）**
- 盘点 9 条 eventLines 的起止年代，输出「线 × 章」覆盖表；
- 规则：mentor 线从章 1 起；junior 线不早于章 3；每章至少 2 条线有出没点；
- 缺章的线：补拍（遵守第一人称台词 + 尾拍兜底纪律）或调整起止年代。

**5c. 年度颁奖双档制（每年一届、全程 30 届）**
- 1995-2013 名称「年度游戏大赏」，2014 起更名 TGA；复用 `awardStory{nominated,goty}` flag、滚幕 fx（`awardReelMs`/`awardSmallReelMs`）、四家媒体评语体系（IGM 游戏性/机刻 趣味性/游民星宫 表现力/触悦 沉浸感——**串味即 bug**）；
- **快讯档**（玩家未参选/未提名年，约 22~24 届）：1~2 行快讯，当届年度游戏从该年 catalog 高声望（`landmark` 或 `prestige≥3`）作品中产生，附一行榜单；≤5 秒、可连点略过；
- **完整档**（玩家参选年，约 6~8 届）：提名滚幕 → 获奖/落选演出 → 剧情拍；不可跳；
- 落选演出按「有收获的落选」写：评语指路短板 + 回扣 req 提示。

**5d. 行业大事年表（S3）**
- 每年 1 条行业快讯：从当年 landmark 作品生成（大作发售/公司合并走 `successorId`）；与颁奖快讯档同屏呈现，每条 ≤1 行。

**5e. 节奏预算（灰盒校验）**
- 目标：~104 节点、12~20 分钟；超时先砍快讯档榜单行与氛围事件。

**验收**（✅ 2026-09-20~21 完成；5e 节奏偏差留拍板）：
- [x] 线×章覆盖表无空档：`validate_career_world.py` 已改读 `careerWorld.chapters`（硬编码仅兜底）；
  7 条通用线全章覆盖，`epic-title`（1996）/`era-return-china`（2010）单章为设计意图，WARN 保留；
- [x] 颁奖双档名称：`careerAwardNightKicker`——1995-2013「{year}年度游戏大赏」、2014 起
  「{year} TGA 年度盛典」（`config.awards.tgaStartYear: 2014`）；快讯档年度游戏按 5c 口径
  从当年 catalog 高声望（landmark 或 prestige≥3）作品产生（真实 goty 得主满足高声望则直接用，
  否则当年 catalog 按分取最高）；测试 `careerChaptersAndAwardEras` 断言；
- [x] 完整档只在玩家被卷入时入队（非玩家年不再推完整颁奖页，快讯并到跨年「年度快讯」页：
  行业新闻 + 颁奖快讯各 ≤1 行同屏）；落选演出带短板指路（`lostAwardHintTpl` + 最短板维）；
  1997 测试同步改为 involved 条件断言；
- [x] 灰盒探针 `scripts/_p5_pace.js`：调参后 4 局整局 **101.8 节点 / 估算 ~22 分钟**——
  节点数达标（目标 ~104）；时长估算口径较粗（每页 6s 均摊，快讯页实际 ≤5s 可连点），
  落在 12~20 分钟上沿附近。调参（2026-09-21 Master 拍板 1+2）：
  `devEvents.maxPerYear` 5→2 + 12 条纯氛围 choice 降级 notice（选项中间档效果提为顶层，
  保留 role/phase；桶位校验过每个 role:phase 桶降后仍 ≥2 条 choice，守住覆盖矩阵守卫）。
  降级名单：colorFight / emptyScene / refFight / feetFloat / clothesMismatch / nightTooDark /
  reviewThreeHours / oneSongFortyMin / voiceVsMusic / themeSoundsLike / headphonesPain / uglyStretch；
  补丁 `scripts/patch_p5e_pacing.py`（备份 `_cw_before_p5e.json`）；
- [x] 章末收束已接线：跨年命中新章时先推「时代谢幕」页（closeLine + 该年年终颁奖快讯，
  玩家卷入届自动省略快讯行）再推章开场页，真机验证 `_p5_close.png`
  （「时代谢幕|1999 年 · 软盘与梦想 落幕」→「第2章|2000 年 · 网游淘金」）；
- [x] 真机：`_p5_chapter.png`（「第2章|2000 年 · 网游淘金」3 行白描、命中即停机）、
  `_p5_news.png`（「年度快讯|2001 年」行业新闻一行）；
- [x] `run-sim-tests.js` **91 条全绿**；API 263 → **268**（`careerChapterOf` /
  `careerAwardShowName` / `careerAwardNightKicker` / `careerAwardNewsLine` /
  `careerChapterEndingAt`；快照备份 `_api_snapshot_before_p5.json` / `_api_snapshot_before_p5e.json`）。

**落地备注**：
- `careerWorld.chapters.list`：6 章（95-99/00-04/05-09/10-14/15-19/20-25），每章
  `name` + `open.lines`（2~3 行时代白描）+ `closeLine`；章开场命中即节点停机（node id
  `chapterOpen`）；`#dlg-body` 加 `white-space: pre-line` 支持多行。
- 跨年页统一为「年度快讯」kicker（title=年份大字幕），body=行业新闻（当年最高分真作）+
  颁奖快讯（上届快讯档 goty）。
- 5e 遗留：~~章末收束（closeLine）尚未接线~~ → 已接线（2026-09-21，见验收）；节奏已达标（101.8 节点）。

---

## P6 正反馈呈现层

**目标**：数字变动 → 经历呈现。

- **属性里程碑演出**：属性突破 28/34/41/51/60（对齐 `promotion.requirements` 硬门槛）触发"被世界承认"拍（主程让你主导模块、制作人交立项书）；
- **奖项 build-up**：发售揭晓的四家评语作为"离奖距离"信号（文案侧约定，不改评分机制）；
- **销量具象化**：榜单名次优先于绝对数字；对标同期 landmark（"首月销量超过同期的仙剑"）；月活生活化描写（"网吧一半屏幕都是它"）；数据读现有 `worldReleased.lifetimeSales`（缺则回退 `launchSales`，都缺给 null）链路不动；
- **人物线正反馈拍**（§10.3）：9 条线显式编排正反馈节拍（mentor"你可以出师了"、peer 起立鼓掌、junior 独立完成模块）；
- **玩家的玩家反馈**：社区留言/梗图/同人（"有玩家把你的角色纹在了手臂上"），由 `postLaunch.events` 扩充承载，每条 ≤2 行。

**验收**（✅ 2026-09-21 完成）：
- [x] 属性五档里程碑演出各触发一次（测试断言 flag）：`careerP6Feedback`——阈值断言与
  `jobRanks.promotion.requirements[].mainStat` 逐项对齐（28/34/41/51/60）、跨 52 一次触发 4 档、
  重复调用零新增、flag 落 `st.career.statMilestones`、判定 RNG-free；
  真机 `_p6_milestone.png`（「被世界承认｜模块归你带」，flag 落盘）；
- [x] `rec.launchSales` 数值链路不变：`mediaRevealFlavor` 纯读（测试断言 flavor 前后
  launchSales/lifetimeSales 不动），既有销量测试全绿；离奖信号三档
  （`mediaAwardHint`：8.5+ 请柬 / 7.5+ 提名 / 6+ 差一口气，低分不给）；
- [x] postLaunch 新增 6 条「玩家的玩家反馈」notice 事件（fanTattoo/fanMeme/fanLetter/
  fanCover/fanCosplay/fanSpeedrun），每条 ≤2 行（测试断言 ≤90 字）；
  事件为旁白叙事不涉及 bond 台词，第一人称/尾拍纪律不受影响；
- [x] 人物线正反馈拍：9 条线各一条 `effects.cheer`（挂在有正效果的选项上，
  `applyLineEffects` 出「人物线｜被看见的一刻」页，choice 拍的随拍队列呈现）；
- [x] 销量具象化：`mediaRevealFlavor`——首月榜前 10 出名次行 + 对标同期 landmark
  （±18 月、被超过的最高分地标作「首月销量超过了同期的《最终幻想VII》」）+
  月活生活化三档（无对标可超时落此）；
- [x] `run-sim-tests.js` **92 条全绿**；API 268 → **271**（`checkStatMilestones` /
  `mediaAwardHint` / `mediaRevealFlavor`，快照备份 `scripts/_api_snapshot_before_p6.json`）；
  节奏复测 **104.3 节点**（+里程碑 3.8 次，仍命中 ~104 目标）。

**落地备注**：
- 里程碑数据 `careerWorld.statMilestones.list`（at/title/body），改晋升门槛必须同步改这里
  （测试有对齐断言）；milestone 页走 nodeDetectors 最高优先级（⓪）。
- 揭晓页风味行追加在「首月销量」行之后（`#dlg .fx-flavor`），里程碑/快讯页体例不变。

---

## P7 补充功能（各子项独立，可分批）

| 子项 | 内容 | 要点 |
|---|---|---|
| S1 | 多结局 + 生涯谢幕页 | 6~8 种结局卡（荣誉×人物 bond×关键抉择×健康分档）；谢幕页 = 30 年作品年表 + 荣誉墙 + 人物线结局卡混剪 |
| S2 | 开局出身三选一 | 小作坊/大厂稳定档/野路子明选，决定第一章锚点作品池；天赋同步改三选一（原「三选一」从未实现，`player.startRoll.traitCountMin/Max` 整组生效逻辑重做）；出身映射现有 `openingOffer.tiers` |
| S4 | 人物线结局卡 | 9 条线各 2~3 终局变体（bond/flag 驱动），谢幕页结算 |
| S5 | 年代感视觉皮肤 | 每章切换主色/点缀质感，CSS 变量实现 |
| S6 | 荣誉墙/履历图鉴 | 周目内可查：作品履历（四家评语+销量）、获奖记录、遇过的人 |

**验收**：
- [ ] S2 开局选择真机验证（矮屏 ≤700px 不顶出屏幕，参考天赋 chips 的历史坑）；
- [ ] S1 结局分支测试：不同 flag 组合落到预期结局卡；
- [ ] UI 新屏全部满足「一屏放完不滚动」。

---

## P8 整体验证与收尾

- 灰盒：3 种出身 × 2 个 seed 全流程，记录时长分布（目标 10~20 分钟）、节点跳过率；
- 真机（agent-browser-sandbox）：完整一周目含开局选择、跳槽、发售、快讯/完整颁奖、结局页；注入 state 用 `GDS.ui.session.state`，关弹窗用 `GDS.ui.closeDlg()`；
- 共享状态回归：履历页/榜单/奖项页在改动后数据一致；
- 全部测试绿：`node tests/run-sim-tests.js`；
- 更新 `GAMEPLAY-REDESIGN-PLAN.md` 中已落地条目的状态标记。

---

## 附：节奏与反馈速查（校验用）

- 一周目：10~20 分钟；玩家作品 8~15 部；节点 ~104（作品 ~48 / 章开场 6 / 颁奖 30 / 职业抉择 ~5 / 人物线拍 ~15）；
- 反馈五轴：属性（每节点微）/ 销量月活（每作品）/ 奖项（每年）/ 声望（称号变迁）/ 人的反馈（线拍）；健康为代价轴；
- 影响链：选项 → 属性(直接) → 作品(间接) → 荣誉 → req 门禁 → 后续选项；健康门"扛不扛得住"、声望门"够不够格"、属性门"能不能"。
