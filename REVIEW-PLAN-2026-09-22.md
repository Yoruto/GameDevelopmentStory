# 项目全面梳理方案（2026-09-22）

> 性质：**只出方案，不动手**。三个问题各一章，均含「现状证据 → 问题清单 → 方案 → 验收方式」。
> 证据来自本轮实测（grep / 读码 / 文件计量），非凭印象。

---

## 0. 体检总评（先说结论）

**「逻辑表现分离」这个大原则，项目已经基本成立了**，比绝大多数无框架 H5 做得好：

| 检查项 | 实测结果 |
|---|---|
| sim 层 DOM/window/localStorage 引用 | **0 处**（18 个文件 ~7700 行全部 grep 过） |
| UI 是否直接改 state 字段 | **0 处**（只整体赋值 sim 返回的新 state） |
| sim→UI 通道 | queue 唯一契约（ADR-002），UI 不含规则 |
| 逻辑层可独立测试 | 已满足：vm 沙箱按 index.html 同序加载同一份 sim 代码，92 条测试全绿 |
| state 可序列化 | clone = JSON 深拷贝，档可存可重放 |
| RNG 纪律 | LCG 在 state 内，同 seed 可复现 |

所以问题 2 的答案不是「推倒重来」，而是**清 4 笔具体债**（见 §2）。
真正需要新建的是问题 1 的「平台适配 + 广告层」（§1），问题 3 是文档债（§3）。

---

## 1. 方案一：虎扑发布 + 广告接入适配

### 1.1 现状证据

- `h5/js/bridge/colorbox.js`（104 行）：绑死 `window.ColorboxAI`——云存档、内容审计（auditText）、本地 storage 全走 Colorbox 专有 JSAPI；
- `h5/js/save/port.js`：通过 `GDS.bridge` 间接调用（端口雏形已存在，只是实现只有一个）；
- `index.html` 注入 `ACTIVITY_API_BASE / ACTIVITY_ENV_ID`，根目录有 `credentials.json`；
- **全仓没有任何广告抽象**；
- 载荷：`config.generated.js` 1.08MB（已 minify）+ app.css 39KB + index.html 12KB，**无图片资源**；`h5/config.json`（1.8MB pretty）只给测试/真机注入用，浏览器不加载；
- viewport 已锁 `user-scalable=no`，UI 铁律「每屏一屏不滚动」天然适配移动 webview。

### 1.2 问题清单

| # | 问题 | 影响 |
|---|---|---|
| A | 桥实现只有 Colorbox 一份，无本地兜底 | 本地开发/站外测试必须依赖平台环境 |
| B | 无广告端口，广告奖励会引诱「UI 直接改 state」 | 破坏脊柱 1（sim 唯一结算者）|
| C | 内容审计在 Colorbox 里（起名审核），虎扑侧需对应物或关闭 | 发布合规 |
| D | 存档触发时机依赖 webview 存活 | 虎扑 webview 杀进程场景可能丢档 |

### 1.3 Master 已拍板（2026-09-22）

| 事项 | 结论 |
|---|---|
| 广告来源 | **虎扑自家**（→ 已找到官方 API：平台 vatask 激励广告，见 1.4-②） |
| 虎扑登录态 / 云存档 | 原则上要求，**本版本不做**（下版接入） |
| 接入形态（webview/外链） | 暂未知 → **已由官方技能包解答**（见 1.4-①） |

### 1.4 调研发现（2026-09-22，含官方技能包 `hupu-ai-game-skills.zip` 解包）

**① 接入形态已经确定——本项目本来就在虎扑 AI 游戏平台（Colorbox）上跑。**
- zip 内容 = `activity.json + credentials.json + skills/runbook + skills/colorbox-*`，与本项目的 skills/ 目录**同构**；`window.ColorboxAI` 就是虎扑侧的官方 JSAPI 桥；
- 所以此前「桥绑死 Colorbox 需要换宿主」的表述修正为：**Colorbox 即虎扑发布目标**。`bridge/local.js` 兜底仍要做，但定位是「本地开发 / 站外测试」，不是换平台。

**② 广告 API 有官方答案：R-06 激励广告（`skills/runbook/references/business-rules.md`）**
- 入口：`window.ColorboxAI.vatask.*`，三条链路：
  - `getActivityTaskState()` —— 初始化，展示剩余次数与 reward 任务；
  - `completeRewardVideo()` —— 用户点「看视频领奖励」→ **`code===200 && data.rewarded===true` 才算到账**；
  - `consumeActivityChance()` —— 抽奖类消耗次数（`data.prize===null` 是未中奖，不是失败）；
- **广告位/活动由平台自动绑定，CP 无需配置**（与「广告来源是虎扑自己」对上了）；
- 硬规矩：必须**用户主动点击**触发，禁止页面加载/轮询/自动重试调用；激励流程进行中禁用按钮、同时只允许一个流程；**禁止自行补发奖励**、禁止直接调 Bridge/任务接口；**仅虎扑 App 内生效**，站外/未登录返回 403（`APP_REQUIRED` / `LOGIN_REQUIRED`），页面要引导。

**③ 缺口：详细技能文档缺失。**
- business-rules 引用的 `skills/colorbox-vatask/SKILL.md` + 3 个子技能，在 zip 和本项目 skills/ 里**都不存在**——只有 R-06 摘要表。需向平台方要新版技能包，或凭摘要先行。

**④ 公开渠道补充**：npm `mz-h5-sdk`（网关 `mzsdkapi.higame.cn`）= 授权登录/角色上报/内购/余额，无广告、无云存档 API——与 ② 互证：广告走 `ColorboxAI.vatask`，不走 mz-h5-sdk。

**⑤ 对广告位设计的直接影响：平台只有「激励视频」一种**，没有插屏/横幅 API → 方案 A2 的插屏位取消。

### 1.5 方案（按拍板结果与官方 vatask API 修订）

**A1 桥端口化（本版范围：只做 local 兜底）**
- `GDS.bridge` 显式契约清单不变：`hasBox / canCloud / isPreview / auditText / storageGet / storageSet / cloudGetSave / cloudPutSave`；
- 本版新增 `bridge/local.js`：纯 localStorage 兜底 + auditText 放行（本地开发 / 站外托管跑通用）；
- `bridge/colorbox.js` **保留为虎扑正式实现**（它就是官方桥），只需按显式契约对齐；
- 本版顺手做「关键节点双写」（resolve 后 + 章收束后 persist），降低 webview 被杀丢档概率——本版存档只有 localStorage，这条更重要。

**A2 广告层（按 vatask 真实 API 修订）**
- 新增 `js/ads/`：
  - `ads/port.js`：唯一入口 `GDS.ads = { isReady, rewardState, showRewarded(kind, onReward, onFail) }`——内部包 `vatask.getActivityTaskState / completeRewardVideo`；
  - `ads/colorbox.js`：虎扑实现（包 ColorboxAI.vatask，遵守 R-06 全部硬规矩：主动点击触发、单流程、按钮禁用、403 引导）；
  - `ads/none.js`：本地/站外空实现（激励位不渲染）；
- **sim 侧只加一个动作 API**：`sim.applyAdReward(state, kind, config) -> {state, queue}`，**只在 `data.rewarded===true` 后由 UI 调用**（不自行补发奖励，正好符合 R-06 铁律）。本版就实现 + 测试可驱动，上广告只是 UI 打开开关；
- 广告位（修订后）：

| 位 | 形式 | 触发点 | 前置 |
|---|---|---|---|
| 健康见底恢复 | 激励视频 | health ≤1 时，玩家主动点 | 仅 App 内 + 已登录，否则引导 |
| 高门槛选项临时解锁 | 激励视频 | 选项置灰时主动点 | 同上；受平台剩余次数约束 |
| ~~插屏（章收束后/结算页）~~ | ~~取消~~ | 平台暂无插屏 API | 留待平台后续能力 |
| banner | **不做** | 一屏约束 + 阅读沉浸 | — |

- 所有「何时弹广告」的判断在 UI 层，sim 不知道广告存在；
- 登录态联动：激励广告依赖登录（403 LOGIN_REQUIRED）→ UI 至少做「未登录 → 引导」路径（`auth.getUserInfo()` 的 `data.islogin`），本版可只引导不强制。

**A3 发布形态（不变）**
- 部署产物 = index.html + css + js（**不含** `h5/config.json`；`credentials.json` 是云环境凭据，只在部署阶段用，不进静态产物）；
- 首屏 1.1MB 建议托管侧开 gzip（约 300KB 级）；如超预算，二期可把 `config.generated.js` 里的纯数据容器（目录/文案）拆成 fetch 懒加载。

### 1.6 信息缺口清单（更新后只剩两条）

1. **`colorbox-vatask` 详细技能文档**（4 个 SKILL.md，zip 与项目里都缺）——向平台方要新版 hupu-ai-game-skills 包；
2. 平台活动/广告位申请流程（「平台自动绑定」具体怎么绑：谁建任务、次数上限、测试环境怎么验）——找运营/商务确认。

---

## 2. 方案二：架构债清理（逻辑层独立 + 可测试性加固）

### 2.1 现状证据（债在哪）

| # | 债 | 证据 |
|---|---|---|
| 1 | 平台桥绑死 | 同 §1 A1（跨方案复用同一刀） |
| 2 | **文案三处散落**：`config.copy`（事实源）+ sim 内硬编码中文（career.js **176 行**含中文）+ paint.js 兜底文案（**86 行**） | 改一句文案要在三处找；sim 里拼长文案也让 queue body 难溯源 |
| 3 | **测试单文件 5380 行**（run-sim-tests.js，93 条用例全在一起） | 按域定位用例靠 grep；新域用例只能往尾巴追加 |
| 4 | career.js 仍 3388 行巨石 | 已有既定策略（叶子域摘除 + split_career.py），**不建议为拆而拆**——P0 实测 0 个零依赖切点，硬拆主干风险不可控 |
| 5 | UI 直接读全局 `GDS.CONFIG`（app.js 多处） | 与 cfg() 并存，两套取配置路径 |

### 2.2 方案（按优先级）

**B1 文案治理（低风险，先立规矩再搬家）**
- 规矩：**新文案一律进 `config.copy`**，sim 只允许模板拼接 config 文案；
- 加一条守卫测试：统计 sim/*.js 内含 CJK 的行数，**只许降不许涨**（当前基线一次性记录）；
- 搬家不一次做完：P7 每碰一个域，顺手把该域硬编码文案迁进 config.copy。

**B2 测试拆分（机械活，低风险）**
- `tests/cases/<域>.js`（如 career-mobility / career-pace / world-sim / api-guard…），run-sim-tests.js 保留加载器 + 断言库 + vm 沙箱逻辑，改为收集 cases 目录执行；
- 顺手加 `--only <keyword>` 过滤参数，改单域时秒跑；
- API 快照守卫（sim-api-snapshot.json / sim-shared-tools.json）**原样不动**；
- 验收：拆分前后测试条数与断言数完全一致（93 条全绿）。

**B3 配置取用统一**
- app.js 内统一走 `cfg()`，去掉裸 `GDS.CONFIG` 引用（~10 处机械替换 + grep 验证）。

**B4 career.js：维持现状，不做主动拆分**
- 理由见上；P7 各子项本就落单域文件。若日后某域改动频繁（如 P7 的成长域），届时用 split_career.py 再摘一刀。

### 2.3 「逻辑层独立可测试」验收标准（固化进文档）

1. sim 零 DOM/window/localStorage（现在满足；vm 沙箱本身不提供 document 就是天然守卫）；
2. 同 seed 同输入 → 同输出（一致性测试已担保）；
3. 平台/广告/存档全在 sim 之外（§1 落地后满足）；
4. 任何新机制 = 单域文件 + 注册点 + 至少一条测试（扩展手册 §7 已有，继续执行）。

---

## 3. 方案三：AI 快速目录（按 Master 要求放最后）

### 3.1 现状痛点

- `P3-HANDOFF.md` 是**时点快照**：写于 09-20，说「下一步 P3」，实际 P6 已完成——新会话读它会拿到过期结论；
- 接上下文要按 §2 清单读 3+ 份文档（MEMORY.md + HANDOFF + REDESIGN-TASKS 段落），每轮 20KB+；
- ARCHITECTURE-V2 §7「扩展手册」已经很好，但它埋在 492 行文档中部，AI 不一定先读到它。

### 3.2 方案

1. **新建 `AI-MAP.md`（≤150 行，唯一常驻入口）**，内容只做索引不复制内容：
   - 一张总表：`文件 → 一句话职责 → 什么时候读`（sim 域文件 / ui / 数据 / scripts 工具 / tests / 顶层文档）；
   - 命令链（sync → validate → tests）与沙箱纪律 3 行；
   - 硬规则**指向** ARCHITECTURE-V2 §8.1，不复制全文（防两处漂移）；
   - 「我要改 X → 动哪里」直接引用 §7 表；
   - 顶部一行指向当前状态文件（见下）。
2. **HANDOFF 文件改为滚动状态页**：只保留「现状一句话 / 待拍板 / 未提交改动」三节，每轮覆盖更新，历史细节沉到 `.workbuddy/memory/` 日报。文件名建议去 P 字头（如 `HANDOFF.md`），避免每次 P 阶段推进要改名。
3. **防漂移守卫（可选）**：`scripts/check_ai_map.py` 十行，比对 AI-MAP.md 里列的文件与实际目录 diff，进命令链可选步。
4. 时机建议：**P7 开工前做一次**（此时 P7 方案落定，地图最准），之后每轮收尾顺手维护 3 行。

---

## 4. 建议实施顺序（等拍板，未动手）

| 步 | 内容 | 风险 | 阻塞关系 |
|---|---|---|---|
| 1 | A2 广告端口（`ads/port.js` + `none.js`）+ `ads/colorbox.js`（包 vatask）+ `sim.applyAdReward` + 测试 | 低（纯增量） | 不阻塞 P7；vatask 细节文档缺口见 §1.6 |
| 2 | A1 桥端口化（本版只做 `bridge/local.js` 兜底 + 双写存档） | 低 | 发布前置；登录/云存档下版接（等平台时机） |
| 3 | B2 测试拆分 + B3 配置取用统一 | 低（机械） | 独立 |
| 4 | B1 文案守卫测试 | 低 | 独立 |
| 5 | AI-MAP.md + HANDOFF 改滚动 | 无 | P7 开工前 |

每步独立可验收、可单独叫停；全程不 commit（遵守项目纪律）。
