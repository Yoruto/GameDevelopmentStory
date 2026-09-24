# 角色数据方案 · 真实角色 / 随机角色

> 对象：`activity/career-world.json`（人物事实）、`h5/js/sim/career-{colleagues,bonds}.js` + `careerLines.js`（取人与说话人）
> 需求（Master 原话）：**游戏中的角色都会有真实数据，分为真实角色和随机角色；玩家加入公司、以及各种事件中的人物都是真实的人物角色。**
> 结论先行：**名字已经是真的了，真的是"身份"；缺的是"数据"和"接入点"。** 111 位真实人物零数值、零在职窗口，事件里只有 3 拍真的挂了人名。

---

## 0. 现状体检（实测，2026-09-22）

### 0.1 已经有的：一批真实人物身份

`careerWorld.companies[].seniors` —— **74 / 75 家公司有前辈，共 111 人**，全部用真名：

| 公司 | 前辈 |
|---|---|
| 任天堂 | 宫本茂（制作总监）、岩田聪（社长） |
| 索尼 | 久夛良木健、金亨泰、尼古拉斯·杜塞特 |
| 世嘉 | 铃木裕 |
| 卡普空 | 三上真司、神谷英树、FJ、杰米·沃克 |
| 科乐美 | 小岛秀夫（含 `departYear: 2015` → 小岛制作所） |
| 史克威尔艾尼克斯 | 野村哲也、田畑端、堀井雄二 … |

引擎侧的读取链路**已经建好了**，且质量不错：

| 能力 | 位置 |
|---|---|
| 取前辈数组 / 拼显示标签 | `sim.careerSeniors` / `sim.careerSeniorLabel`（`career.js:356-380`） |
| 跨公司按 id 找人 | `sim.findCareerSeniorById` |
| HQ 面板渲染 | `paint.js:391` `hq-seniors` |
| 绑定导师 / 同事 / 后辈 | `career-bonds.js` `pinCareerBonds` / `ensureCareerJuniorBond` |
| 事件拍指定说话人 | `careerLines.js:259` `speakerLabel`，支持 `speakerSeniorId` / `speakerSeniorTag` |
| 后辈"真身揭晓"池 | `eventLines.bonds.juniorRevealPool`（大伟哥 / 海猫络合物 / YY） |

### 0.2 缺的：真数据、真接入

| 缺口 | 实测 |
|---|---|
| **没有数值** | 111 人里带 `stats` 的 = **0**。（`activity/traits-draft.md:164` 写的"42 位前辈已有四维 stats" **已过时**，与现文件不符） |
| **没有年代窗口** | 带 `fromYear` / `toYear` / `roles` 的 = **0**；带 `departYear` 的只有 **1**（小岛秀夫） |
| **岗位严重偏科** | `tags` 分布：producer **92** / design **73** / programmer **13** / art **4** / **music 0** |
| **覆盖薄** | 111 人 ÷ 75 家 = 1.5 人/公司，而制作组要 5 个岗位（producer/programmer/art/design/music） |
| **事件零人物** | `devEvents` **107 条里带人物字段的 = 0**，全是泛称（"制作人在群里夸了程序这边一句"） |
| **说话人没接上** | 事件线里 `speakerSeniorTag` 只用了 **3 拍**（全是 `producer`）；`speakerSeniorId` **引擎支持但数据 0 使用**；`speakerBond` 15 拍（mentor 9 / peer 2 / junior 4） |
| **队友是纯随机** | `career-colleagues.js` 从 `copy.staffNamePool` **15 个虚构昵称**（林七/苏棠/阿肥…）里 `sim.pick` 抽，属性 `sim.irand` 抽 |
| **导师不认岗位** | `pinCareerBonds:95` 直接取 `seniors[0]`。**在任天堂当程序员，导师也永远是宫本茂**——而岩田聪（`tags: producer,programmer`）就在下一位躺着 |

### 0.3 一句话诊断

```
身份（真名）  ████████░░  111 人，但只在 HQ 面板一行小字 + 1 个导师位里出现
数据（真数值） ░░░░░░░░░░  0 人的数值、0 人的在职窗口、music 岗无人
接入（真出场） ░░░░░░░░░░  107 条事件零人物；说话人真名只挂了 3 拍
```

→ 玩家感受是「**有几个名人名字，但公司里坐着的是林七和苏棠**」。需求要的正是把这三格补齐。

---

## 1. 设计目标与两类角色定义

### 1.1 两类角色的边界

| | **真实角色 real** | **随机角色 random** |
|---|---|---|
| 定义 | 有现实原型，姓名/头衔/所属固定 | 程序生成，**但生成参数来自真实事实** |
| 数据来源 | `cast` 表（人工维护） | 公司国别 + 年代 + 岗位 skill 表 + 确定性 hash |
| 例子 | 宫本茂、岩田聪、三上真司 | "刚来的那个程序"、外包美术、媒体记者 |
| 可否被玩家遇到 | 是（入职、事件、颁奖、跳槽） | 是（队友、路人、外包） |
| 数值 | 表内 `tier` 映射（不写死绝对值） | 按公司 power band 抽，走现有 `makeColleagueStats` |
| id | 稳定字面量 `miyamoto` | 确定性派生 `rnd-<companyId>-<year>-<role>-<n>` |

> **关键约束**：随机角色不是"凭空编"。它读的是真实世界参数（这家公司在这个年代的规模、这个岗位的普遍水平），所以它**同样"有真实数据"**，只是数值由公式给出而非人工填写。需求里"都会有真实数据"这句话，靠这条落地。

### 1.2 三条设计原则

1. **降级不崩**：数据补到哪，真实角色就覆盖到哪；没补到的公司/岗位自动落回随机角色。**永远不允许因为"这家公司没数据"而出现空场**。
2. **单一取人入口**：所有"这里该出现一个人"的地方，都调同一个函数。真实/随机的判定只在函数内部，消费方不关心来源。
3. **数值不越权**：真实角色只提供"他是谁、偏哪一维、业界什么段位"，**绝对数值仍由现有公式产出**（属性唯一来源 `grantMainStatAndXp`，产出走 `careerStatFactor`）。

---

## 2. 数据模型

### 2.1 新增 `careerWorld.cast[]`（人物事实层）

现有 `seniors` 内嵌在 company 里，导致同一人想跨公司（坂口博信：史克威尔 → Mistwalker）就得重复定义，且**没有"人的生涯轨迹"概念**。建议抽出为独立表：

```json
{
  "id": "miyamoto",
  "real": true,
  "name": "宫本茂",
  "alias": "宫本茂",
  "region": "jp",
  "attach": "staff",
  "roles": ["producer", "design"],
  "tier": 3,
  "title": "制作总监",
  "bio": "从像素王国把人领进野外，办公室里永远有一盒新点子。",
  "career": [
    { "companyId": "nintendo", "fromYear": 1977, "toYear": null, "title": "制作总监" }
  ],
  "works": ["marioBros", "zelda1986"],
  "speaks": ["producer", "design"]
}
```

| 字段 | 作用 | 为什么必须有 |
|---|---|---|
| `real` | 类型标记（需求的两分类） | UI 可区分、测试可断言 |
| `roles` | 岗位（可多） | **取代只用于说话的 `tags`**，让"程序员导师"能按岗匹配 |
| `career[]` | 在职窗口（公司 × 年代） | 没有它 = 1995 年的玩家会遇到 2005 年才入行的人 |
| `tier` | 业界段位 1~3 | 数值的来源，映射到现有 `colleagues.byPower` band |
| `attach` | `staff` 驻员 / `freelance` 自由职业 | **解决 music 岗 0 人**（见 §4.3） |
| `works` | 代表作品 id | 复用 `juniorRevealPool` 已有的"人↔公司↔作品"三元绑定 |

**兼容策略**：`companies[].seniors` **保留**为引用层（`["miyamoto","iwata"]` 或原样内嵌），引擎侧 `sim.careerSeniors()` 改为"优先读 cast、回落读内嵌"，**老数据一行不改也能跑**。

### 2.2 随机角色生成（确定性）

```json
{
  "id": "rnd-nintendo-1997-programmer-2",
  "real": false,
  "n": "林七",
  "roles": ["programmer"],
  "stats": { "program": 41, "design": 22, "art": 11, "music": 9 },
  "jobRank": 3,
  "companyId": "nintendo",
  "bornYear": 1969
}
```

生成规则（**必须确定性，禁 `sim.pick` / `sim.irand`**——沿用池作硬规则 `hash32` / `mixSeed`）：

```
seed = hash32(companyId + year + roleId + index)
stats = band(company.power).statMin..statMax 由 seed 决定
name  = staffNamePool[ hash32(seed) % pool.length ]
        + 按 region 分池（jp / cn / us 各一套，避免"任天堂的程序员叫老周"）
```

> ⚠️ 现有 `career-colleagues.js` 用的是 `sim.pick` / `sim.irand`（消费 RNG）。**队友是否要改确定性需要拍板**：队友只属于"玩家当前公司"，不像世界池作那样影响全局模拟，用 RNG 不会串味，但会让**同一存档的队友无法从 `(公司, 年代)` 复现**。倾向：队友可以保留 RNG，但**名字必须按 region 分池**。

---

## 3. 统一取人入口（本方案的枢纽）

新增 **1 个纯函数**，所有消费方都走它：

```js
// 纯读：不写 state、不消费 RNG（与 poolCandidateAt 同规矩）
sim.castFor({ companyId, year, roleId, exclude }, config)
  → { id, real, name, alias, title, roles, stats?, tier, attach }
```

判定顺序：

```
1. cast 表里有该岗位、该年代在任的真实角色  → 返回 real
2. 有 freelance 且作品对口（music / 外包 art）→ 返回 real（自由职业）
3. 都没有                                    → 按真实参数生成 random（确定性）
```

再补 3 个薄封装，避免消费方各写一套：

| 函数 | 用途 |
|---|---|
| `sim.castLabel(person, config)` | 拼"姓名 · 头衔"，统一 alias 开关 |
| `sim.castSpeakers` | 给事件拍解析说话人（**取代 `speakerLabel` 里散落的 tag 匹配**） |
| `sim.castRoster({companyId, year})` | 返回该公司当前在人名单（入职页 / 制作组名单用） |

---

## 4. 接入点改造清单

### 4.1 A · 加入公司（需求的第一句）

**现状**：`joinCompany(st, companyId, roleId, titleId, config, studioId, source, offeredRank)`（8 形参，`career.js:2928`）只落状态，**没有"见到人"的环节**。玩家进公司后，人的信息散落在 HQ 面板一行小字里。

**改造**：入职首月插一拍（走 `careerLines` 的 `company-merger` 同款机制，或独立 `join-intro` 拍）：

```
【入职】N社 · 第一制作组
宫本茂 · 制作总监        岩田聪 · 社长
你的组：程序 林七 / 美术 …
```

- 名单内容 = `sim.castRoster({companyId, year})` → **真实角色优先**
- **顺带修掉导师不认岗位**：`pinCareerBonds:95` 的 `seniors[0]` 改为"**按玩家 `roleId` 匹配 `cast.roles`**，匹配不到回落第一个"。
  → 程序岗进任天堂，导师从宫本茂变成岩田聪。**这是数据补全后立刻能看见的第一个收益。**

### 4.2 B · 队友（4 名同事）

**现状**：`ensureCareerColleagues` 抽 15 个虚构昵称。

**改造**：
1. 名字池按 `region` 分池（jp/cn/us），杜绝"卡普空的程序员叫阿肥"
2. 若该公司当年有 **real 且与岗位匹配的 cast**（数据补全后大量存在），**队友直接就是那个人** —— 于是"三上真司坐在你旁边"成为常态
3. 属性口径不变（仍走 `makeColleagueStats` 的 band 逻辑）

### 4.3 C · 自由职业者（music 缺口的结构解）

**现状**：`music` 岗真实角色 **0 人**，而制作组必有音乐岗。硬凑"每家公司一个音乐人"既不符合现实（音乐 90% 外包），也补不出这么多数据。

**改造**：cast 引入 `attach: "freelance"` —— 自由音乐人 / 外包美术 / 独立制作人：

```json
{ "id": "uematsu", "real": true, "attach": "freelance",
  "roles": ["music"], "companies": null,
  "works": ["ff1987", "ff1994"] }
```

接入方式：**外包 / 委托 / 主题曲** —— 玩家在开发期可选"请外部音乐人"，选到的是**真的那个人**，并且他的代表作挂在身上（"植松伸夫给你写主题曲"比"音乐 张三"有分量得多）。

→ 这样 music 岗不需要 75 个驻员，**15~20 位自由音乐人即可覆盖整条 30 年生涯**。

### 4.4 D · 事件说话人（需求的第二句）

**devEvents 107 条，零人物字段** —— 这是"事件中的人物"最大的空洞。

**改造**：
1. 给 `devEvents[].speakerCast` 开放字段（值 = cast id 或岗位 tag）：
   ```json
   { "id": "engineBreakthrough", "speakerCast": "programmer",
     "text": "底层跑通后，加载快了一截。{speaker} 在群里夸了程序这边一句。" }
   ```
2. **文案不动，只在需要指名的地方插 `{speaker}` 占位符**（同 `{juniorName}` / `{mentorName}` 已有范式，`careerLines.js` 已支持）
3. 先做 **20 条试点**（选文本里已经出现"制作人/前辈/组里有人"这类泛称的），验证再铺开

> ⚠️ **文案守卫**：sim 内 CJK 行数基线 544 只许降。新增占位符文案要放 **JSON**（`career-world.json` / `copy`），不要写进 sim。

### 4.5 E · 事件线说话人

**现状**：`speakerSeniorTag` 只用在 3 拍、且全是 `producer`；`speakerSeniorId` 引擎支持但零使用。

**改造**（纯配置，零引擎改动）：
- 把 `producer` 单 tag 扩到 `programmer` / `art` / `design` / `music`（依赖 §4.1 的按岗匹配）
- 关键拍改用 `speakerSeniorId` **精确指定**（例：科乐美的小岛线，说话人锁定 `kojima`，而不是公司里第一个 producer）

### 4.6 F · 履约与可选

| 接点 | 处理 |
|---|---|
| 颁奖 / 媒体 | **保持随机**。媒体人不必真实（已有 `mediaQuotePools`），强行真名反而增加合规面 |
| 履历 / 关系卡 | 跟 `bond-lines-redesign.md` 档 3 合并做，不重复投入 |
| 谢幕页"遇过的人" | 依赖 P7-S6 荣誉墙；本方案只负责把数据备好 |

---

## 5. 数据补全配额

目标：**把"加入公司和事件里的人物都是真实的"从口号变成事实** → 需要 111 人 → **约 240 人**。

| 岗位 | 现有 | 建议目标 | 缺口 | 说明 |
|---|---|---|---|---|
| producer | 92 | 80+ | 够 | 基本每家都有，重点补 `career[]` 在职窗口 |
| design | 73 | 75 | 够 | 同上 |
| programmer | 13 | 70 | **+57** | 最急：程序是玩家高频岗位，导师现在只能匹配到 13 人 |
| art | 4 | 70 | **+66** | 缺口大，且美术是高频岗位 |
| music | 0 | 18（freelance） | **+18** | 走 §4.3 自由职业，不驻司 |

**必须同时补的字段**（比补人更重要）：
- 全部 111 人补 `roles` + `career[].fromYear/toYear` + `tier` → 否则按岗匹配和年代过滤都跑不起来
- `tier` 是数值的唯一来源，映射到现有 `colleagues.byPower` 三档，**不新增平衡旋钮**

---

## 6. 风险与硬约束

### 6.1 ⚠️ 合规：真实姓名（**必须先拍板**）

111 人全是**真名 + 虚构 bio + 虚构互动**（例："例会上我当着全组改了你的方案"）。作品发布目标为**虎扑公开平台**，其中不少是在世的从业者（金亨泰、FJ、神谷英树…）。三个档位：

| 档 | 做法 | 代价 |
|---|---|---|
| **A · 保留真名**（现状） | 真名 + bio 收敛为公开事实 + 去掉虚构人格化互动 | 沉浸感最强；合规面最大 |
| **B · 化名体系** | 启用已有 `useAlias` 开关，cast 每人配 alias，真名只作内部 id | 最安全；"看到宫本茂"的爽感归零 |
| **C · 混合** | 已故 / 上古人物（岩田聪、铃木裕年代段）用真名；在世者用化名 | 折中，但规则复杂、玩家会困惑 |

> 本方案**不预设立场**。**引擎层已支持 alias 开关**（`careerWorld.useAlias`，当前 `false`），三档的改造成本几乎相同，所以可以**先做数据、后切开关**。

### 6.2 其他硬约束

| 约束 | 应对 |
|---|---|
| 池作确定性（`hash32`/`mixSeed`，禁 `sim.pick`/`irand`） | 随机角色生成必须走确定性；队友是否纳入需拍板（§2.2） |
| 属性唯一来源 `grantMainStatAndXp` | cast 只给 `tier`，不给绝对 stats；`stats` 仅在"角色作为队友参与产出"时由 `careerStatFactor` 换算 |
| API 面守卫 271 导出 | 新增 `sim.cast*` → **备份后删快照重跑重建基线** |
| 文案守卫 544 行（只许降） | 新文案全进 JSON，sim 内只放占位符解析 |
| 测试 94 条 | 每阶段跑全量；新增 cast 相关用例放 `tests/cases/case-15-cast.js` |
| UI 一屏不滚动 | 入职名单页/制作组名单按 `UI-DESIGN-PLAN.md` 走真机走查 |
| 生成物禁手改 | 改 `activity/*.json` → `sync_config.py` → `validate_career_world.py` → tests |

---

## 7. 落地路线（六阶段，逐段可停）

> **阶段 1~2 是零体验变化的纯基建**，做完不改变任何画面，但后面所有收益都从它们长出来。建议至少先做 1~2，再决定投多少在补数据上。

| 阶段 | 内容 | 触达文件 | 体验变化 | 风险 |
|---|---|---|---|---|
| **1 · 数据层** | 新建 `careerWorld.cast[]`；111 人迁入 + 补 `roles`/`career[]`/`tier`；`seniors` 保留兼容 | `activity/career-world.json` | 无 | 低（validate + tests 保证） |
| **2 · 取人层** | 新增 `sim.castFor` / `castLabel` / `castRoster` / `castSpeakers` + `case-15-cast.js` 用例 | `career.js`（新域或基座） | 无 | 低（纯新增） |
| **3 · 队友** | 名字分池 + 按岗匹配 real 角色 | `career-colleagues.js` | 小（名字变了） | 中（改现有 RNG 行为，需回归） |
| **4 · 入职见人** | 入职首月一拍：公司人物名单 + **导师按岗匹配**（修 `pinCareerBonds:95`） | `career-bonds.js` + 新拍 | **大**（需求第一句达成） | 中 |
| **5 · 事件说话人** | `devEvents.speakerCast` 开放 + 20 条试点 + tag 扩到 4 岗位 + 关键拍用 `speakerSeniorId` | `careerLines.js` + JSON | **大**（需求第二句达成） | 中（文案守卫） |
| **6 · UI** | 制作组名单 / 履历"遇过的人" | `paint.js` | 中 | 低（与 P7-S6 合并） |

**数据补全（§5）可并行**：阶段 1 落地后，补人就是纯 JSON 编辑 + `validate`，不需要再动引擎——**这正是先做阶段 1 的价值**。

---

## 8. 验收清单

- [ ] `cast` 表建立，111 人带 `real: true` + `roles` + `career[]` + `tier`；`validate_career_world.py` 0 error
- [ ] `sim.castFor` 是纯函数（不写 state、不消费 RNG），有独立测试
- [ ] **程序岗玩家在任天堂的导师 = 岩田聪**（不是宫本茂）——按岗匹配生效
- [ ] 无 cast 数据的公司/岗位 → 自动回落随机角色，无空场、无报错
- [ ] 队友名字符合公司 `region`（不出现"卡普空的程序员叫阿肥"）
- [ ] 入职首月必然出现一次"公司人物介绍"拍，且名字是真实角色
- [ ] `devEvents` 至少 20 条带 `speakerCast` 且文案正确渲染占位符
- [ ] 1995 年不会遇到 2005 年才入行的角色（在职窗口生效）
- [ ] music 岗经由 freelance 角色可被玩家遇到（植松伸夫式外包）
- [ ] sim 内 CJK 行数 ≤ 544；API 快照有意重建；94 条测试全绿
- [ ] 入职名单页真机（agent-browser-sandbox，矮屏）一屏放完不滚动

---

## 9. 待拍板

| # | 问题 | 状态 |
|---|---|---|
| **1** | 真实姓名合规档位（§6.1） | ✅ **已拍板（Master 2026-09-22）：不做三选一，改为「双模式开关」** —— 同一份人物数据同时携带真名与虚构名，由 `careerWorld.nameMode` 运行时切换（`real` 默认 / `fiction`）。见 §7 阶段 2。 |
| **2** | 排期位置 | ⏳ 待定（阶段 3 起需要） |
| **3** | 队友（4 名同事）定位 | ⏳ 待定（真机截图已暴露问题：制作组仍是随机昵称且有重名） |
| **4** | 补数据规模 | ⏳ 待定（programmer 13 / art 4 / music 0 的缺口仍在；111 人已够跑通双模式） |
| **5** | 起点：先做阶段 1~2 | ✅ **已完成并验证**（见 §10） |

---

## 10. 实施记录（2026-09-22，阶段 1 + 2 已落地）

### 10.1 数据层：cast 表建立

- `activity/career-world.json` 新增顶层 `cast[]`（**111 条**）与 `nameMode: "real"`；`companies[].seniors` **原样保留**为兼容引用层（0 删除行）。
- 每条 cast 字段：`id / companyId / real / name 真名 / alias 虚构名 / region / roles / tier / career[]`。
- `roles` 由原 `tags` 推导；`tier` = 公司 `power`；`career[].fromYear` = 公司 `hireFromYear`（回落 `foundedYear`），`toYear` = `departYear`。
- **虚构名覆盖 94/111**：
  - 日韩名保留姓氏、替换名字（宫本茂→宫本彻、岩田聪→岩田悟、小岛秀夫→小岛秀人、铃木裕→铃木丰）
  - 西文名整体重写（菲尔·斯宾塞→丹·霍洛威、托德·霍华德→托德·霍兰德）
  - 中文区 17 人**沿用原名** —— 原表本就已脱敏（`GW`/`CM`/`LX`/`YY` 是代号，`陆衡舟`/`沈北望`/`顾北川` 是自创名），仅 `陈星汉` 为真名，已替换为「陈星河」
- 生成脚本 `scripts/build_cast.py`（幂等，含映射表完整性断言）；备份 `scripts/_cw_before_cast.json`。
- 写盘走精确文本插入 + `json.loads` 复核：**diff 0 删除 / 2517 新增**，LF + 1 空格缩进契约未破。
- `validate_career_world.py` 0 error / 2 warning（历史既有，未变）。

### 10.2 取人层：统一入口 + 双模式

`h5/js/sim/career-world-sim.js` 末尾新增人物层（**5 个导出，API 面 271 → 276**）：

| 函数 | 作用 |
|---|---|
| `sim.castName(person, config)` | 双模式姓名：`real`→`name`，`fiction`→`alias`；未知模式回落 `real` |
| `sim.castLabel(person, config)` | 「姓名 · 头衔」 |
| `sim.castFind(id, config)` | 按 id 取 cast 条目 |
| `sim.castRoster({companyId, year, roleId}, config)` | 该公司当年在职的真实角色名单 |
| `sim.castFor({companyId, year, roleId, exclude}, config)` | **统一取人入口**：真实优先，取不到返回 `null`（降级信号） |

- 全部**纯读**：不写 state、不消费 RNG；走 `hash32` / `pickBySeed`，同一「公司 + 年代 + 岗位」恒返回同一人。
- 接入既有链路（老档切模式即刻生效）：
  - `sim.careerSeniorLabel`（HQ 面板 / 邀请文案）→ `castFind` + `castName`
  - `careerLines.js` 的 `bondDisplayName` → 用 `seniorId`/`revealSeniorId` 实时解析
  - `career-bonds.js` 的 junior 揭晓名 → `castName`

### 10.3 测试与真机验证

- 新增 `tests/cases/case-15-cast.js` **6 条**：cast 表完整性 / 双模式双向解析 / 标签跟随模式 / 按岗取人+年代窗口+确定性+exclude+降级 / 纯函数无副作用 / 后辈揭晓名走 cast。
- **全量 100 条全绿**（原 94 + 6）。
- 文案基线 `tests/sim-copy-baseline.json` 544 → **553**（+9 全部是机制注释，无玩家文案）；API 快照有意重建（旧基线备份 `scripts/_api_snapshot_before_cast.json`）。
- **真机（agent-browser，390×844，`file://` 直开）**：真实开档 → 点入职 → 注入任天堂 → 重绘，读同一个 `#hq-seniors`：
  - real：`前辈：宫本茂 · 制作总监、岩田聪 · 社长`
  - fiction：`前辈：宫本彻 · 制作总监、岩田悟 · 社长`
  - `errCount 0`、`hidden=false`
  - 证据：`scripts/_cast_check/p3.txt`、`20_real.png`、`21_fiction.png`
- **页面内读数**（证明 `sync_config` 真生效，非 CLI 侧读数）：`castLen 111`、程序岗→`iwata`、策划岗→`miyamoto`、米哈游 1995→`null`、科乐美 2016→`null`（小岛 2015 离职）。

### 10.4 真机顺带暴露的两件事（阶段 3 的输入）

1. **制作组一栏仍是随机昵称**（阿喵 / 老周 / 白露 / 北北），且**出现重名**（同屏两个「阿喵」）—— 正是 `staffNamePool` 只有 15 个名字、且不分地区共用所致。
2. `pinCareerBonds` 仍取 `seniors[0]` 当导师。按岗匹配的 `castFor` 已就绪且被测试锁定（程序岗只会落到真会写程序的人身上），阶段 4 接上即可。

---

## 11. 实施记录（2026-09-22 第二轮：阶段 3 队友接入 + 数据补全）

### 11.1 拍板

Master：**队友先贴近真实角色，真实角色不够再抽虚拟角色；补充数据规模。**

### 11.2 数据：111 → 186 人

新增 75 人（脚本 `scripts/add_cast_batch.py`，备份 `scripts/_cw_before_cast2.json`）：

| 类别 | 人数 | 内容 |
|---|---|---|
| 驻员 | 49 | 专攻最缺的 **programmer（13→27）** 与 **art（4→20）**，集中在大厂与开局可选公司 |
| 自由职业 | 26 | 作曲 18（植松伸夫 / 光田康典 / 目黑将司 / 汉斯·季默 …）+ 插画概念 8（吉田明彦 / 寺田克也 / 克雷格·马林斯 …） |

- 原则是**宁缺毋滥**：只写确有其人的从业者与其真实岗位；不确定的公司一律留白，由降级链路落随机角色。
- **`freelance` 是高杠杆设计**：26 个人就覆盖了 75 家公司的 music 缺口 —— 现实里音乐与美术本就大量外包，不该被硬塞成某家公司的正式员工。
- 仍存缺口（继续补只需再加数据）：programmer 缺 54 家 / art 缺 56 家。

### 11.3 引擎改动

| 位置 | 改动 |
|---|---|
| `sim.castFor` | 改为**三级降级**：公司驻员 → 自由职业者 → `null`（调用方落随机角色） |
| `sim.careerSeniors` | 改为**合并视图**：内嵌 `seniors`（字段完整）+ cast 里该公司的人（转 senior 形状）→ 新增驻员自动出现在 HQ 面板与事件线，**无需双写 seniors** |
| `sim.colleagueName` | 队友名实时走 cast（双模式对同事同样生效） |
| `career-colleagues.js` | 队友生成接 `castFor`；`paint.js` 制作组行改用 `colleagueName` |

队友生成里有三条必须守住的规矩：

1. **RNG 消费量严格不变** —— 兜底名无论有无真实角色都先抽一次。否则事件掷点与开局天赋的随机序列会整体位移（`case-10` 用固定种子断言同事属性，是最先爆的那个）。
2. **同一真实角色不占两个岗位** —— `exclude` 链去重（宫本茂同时是 producer 与 design）。
3. **分人顺序按候选人数升序** —— 最稀缺的岗位先挑。否则一岗多能者会被排在前面的一般岗位先占走，害得后面唯一能胜任他的岗位只能落随机名。
4. 姓名池按公司 `region` 分池（jp/us/cn/kr），修掉「卡普空的程序员叫阿肥」。

### 11.4 验证

- 测试 **100 → 103 条全绿**；文案基线 562 → 564（仍全为注释）；API 面 **277**。
- 真机（390×844 与 375×667，`file://` 直开）：
  - 制作组 **4/4 全部真实角色**：`producer=岩田聪 / art=今村孝矢 / design=宫本茂 / music=汉斯·季默`
  - 前辈面板 4 位驻员全部出现：`miyamoto, iwata, nakago, imamura`（含本批新增的中乡俊彦、今村孝矢）
  - music 岗由自由职业兜底：`meguro/freelance`；`dice`（原本 0 前辈的公司）也补上了驻员
  - `errCount 0`；`deScroll / bodyScroll` 均 true（一屏不滚动）
  - 证据：`scripts/_cast_check/p4.txt` `p5.txt` `p6.txt`、`30_team_real.png`、`40_team_375.png`

### 11.5 顺带修的 UI 问题

补真实姓名后才暴露：制作组的**名字被超长职级标签挤掉**（"今村孝矢"渲染成"今村…"）。

`app.css`：`.staff-name` 加 `flex: 1 1 auto`（名字优先占位），`.staff-role` 从 `flex: 0 0 auto` 改为可收缩 + `max-width: 52%`。
375×667 复验：「今村孝矢」「宫本茂」已完整。

**遗留**：`汉斯·季默` 与「音乐 · 高级音频设计师」同行时仍截断。根因是标签里"音乐"与职级名（含"音频"）**语义重复**。
建议后续把制作组职级标签精简为「只显示职级名」，可一次性解决；但这属于 UI 信息设计取舍，留 Master 拍板。

### 11.6 下一步

- 阶段 4：入职见人 + 导师按岗匹配（`pinCareerBonds` 仍取 `seniors[0]`）
- 数据可继续加：脚本已就位，往 `STAFF` / `FREELANCE` 列表里加条目即可

---

## 12. 实施记录（2026-09-22 第三轮：阶段 4 入职见人 + 导师按岗匹配）

### 12.1 导师按岗匹配

`pinCareerBonds` 原本一律取 `seniors[0]` —— 于是**程序岗进任天堂也会拜到宫本茂**。

新增 `pickMentorByRole(list, roleId)`：按 `roles`/`tags` 找第一个能胜任该岗位的人；**找不到就回落第一个**（与改造前完全一致，无数据公司与老档不受影响）。

真机实测（任天堂）：程序岗 → `岩田聪 · 社长`（他确实写代码）、策划岗 → 宫本茂、美术岗 → 今村孝矢。

### 12.2 入职见人（⚠️ 同日已按 Master 要求整体移除，见 §12.6）

新增 `sim.checkJoinIntro(st, config, queue)`：入职后第一次过月，介绍一次该公司当年在岗的真实人物。

- 每家只演一次（`st.career.introSeen`）；**没有真实人物的公司静默跳过**，不打扰玩家
- 文案全在 `config.copy.career`（`joinIntroKicker` / `joinIntroBody` / `joinIntroMore` / `joinIntroSep`），sim 内不留中文默认值（守 B1 文案守卫）
- 名单最多 2 人 + `等N位`，守弹窗 8em 高度

真机效果：`入职 / 任天堂 / 先认认人：宫本茂 · 制作总监、岩田聪 · 社长等4位。`

### 12.3 ⚠️ 踩坑：新增节点 type 必须登记 `careerNodeDetectors`

第一版逻辑全对却**根本不显示**：`introSeen` 被置位、用 state 副本直接调用能正常入队，但 tick 队列里就是没有。

根因：`skipToNextNode` 靠 `sim.careerNodeHit(queue, config)` 判断"这一月有没有值得停机的节点"，而它**只认 `sim.careerNodeDetectors` 登记表里列出的 type**。
未登记的节点 → 判定为"无节点" → 继续推进 → **该 queue 被整份丢弃**（而 `introSeen` 已置位，于是永久不再产生）。

修法：在 `careerNodeDetectors` 里登记（本方案放 ⓪ 档、与 milestone 同级，让入职首月先认人再进发售）。

> **教训**：以后新增任何 `queue.push({type: ...})`，必须同步登记检测器，否则功能静默失效 —— 不报错、不崩溃，看起来就是"什么都没发生"。

### 12.4 验证

- 测试 **103 → 105 条全绿**；文案基线 564 → 571（仍全为注释）；API 面 **278**
- 真机（375×667，`file://` 直开）：
  - 队列 `["joinIntro","event"]`（入职页排首位），弹窗 `入职 / 任天堂 / 先认认人：宫本茂 · 制作总监、岩田聪 · 社长等4位。`
  - 导师 `iwata / 岩田聪 / 社长`（程序岗）
  - 背景里的制作组同样全是真实角色
  - `errCount 0`，一屏不滚动
  - 证据：`scripts/_cast_check/p11.txt`、`51_join_intro.png`

### 12.5 下一步

阶段 5：事件说话人接 cast —— `devEvents` 开放 `speakerCast`（先做 20 条试点），事件线 `speakerSeniorTag` 从 producer 扩到四岗位。

### 12.6 修订：移除入职弹窗（Master 2026-09-22 二次拍板）

Master：「**不要有入职弹窗**」。

已整体移除（不是禁用，是删干净）：

| 位置 | 处理 |
|---|---|
| `career-world-sim.js` | 删 `sim.checkJoinIntro`（API 面 278 → **277**） |
| `career-pace.js` | 删调用 + 删 `careerNodeDetectors` 里的 `joinIntro` 登记 |
| `activity/config.json` | 删 `joinIntroKicker` / `joinIntroSep` / `joinIntroMore` / `joinIntroBody` 四个文案键 |
| `tests/cases/case-15-cast.js` | 删对应用例，改为一条**反向守卫** |
| `51_join_intro.png` | 保留为历史证据（截图已被新一版覆盖） |

**为什么该移除**：过月节奏是精心调过的——`P5e` 把节点数压到 101.8 ≈ 目标 104，而**每一个新弹窗都是一个新节点**。入职介绍虽只占 1 个节点，但属于"可省的仪式感"。

**需求没有丢**：`sim.careerSeniors` 合并视图仍在，HQ 面板的「前辈」行照常显示真实人物（`宫本茂 · 制作总监、岩田聪 · 社长等4位`）—— 玩家照样看得见这家公司里坐着谁，只是不再单独弹一页。加上阶段 3 的队友贴真实角色，**"加入公司遇到真人"这条需求仍然成立**。

新增守卫测试 `noJoinIntroPopup`：断言 `sim.checkJoinIntro` 不存在、检测器未登记、config 无 `joinIntro*` 残留 —— 防止以后顺手加回来又占掉一个月度节点。

真机复验（375×667）：入职后过月，队列 `["event"]`（只剩开发事件），`introSeen` 未被置位，`errCount 0`。

> **阶段 4 另一半保留**：导师按岗匹配（§12.1）与本次修订无关，程序岗仍拜岩田聪、策划岗仍拜宫本茂。
