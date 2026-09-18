# Bug Report：生涯档虚拟作立项时 liveStats 初始值过高

> **状态：已修复（2026-09-16）。** 采用开发者拍板的公式，不是本报告最初建议的缩系数方案：
> 立项四维 = 全员（玩家 + 同事）各维 × `virtualPool.teamStatShare`（10%）求和后向下取整，
> 再乘工作室对题材 + 玩法的熟练度加成（生疏 0% / 熟练 10% / 拿手 15% / 看家本领 20%，两档相加，上限 +40%）。
> 玩家个人熟练度不再进立项，改为乘在每月贡献上（四维共用，制作人同吃）。
> 代码：`careerCraftLiveStats()`、`studioProficiencyBonusPct()`、`playerProficiencyBonusPct()`、
> `playerSkillContribMult()`、`liveFromTitle()`；配置：`career-world.json` 新增 `proficiency` 与
> `virtualPool.teamStatShare`，删除 `playerXp.liveBonusPerXp|liveBonusCap|contribBonusPerXp|contribBonusCap`
> 与 `producerCareer.skillLiveBonus*`；测试新增 `careerVirtualInitialStatsFollowTeamShareAndStudioSkill`。
> **口碑标尺已重定（2026-09-16 第二轮，已落地）**：虚拟作口碑 = `craft.scoreBase`(1) + 四维均值 ÷ `craft.statDivisor`(7.5)，
> 夹 1～10。人数与工期不再在口碑里重复计算（人数已折进立项四维，工期靠每月贡献抬 live）。
> 锚点：全 30 队无熟练立项 3.0；全 80 队无熟练 6.3、高熟练(+40%) 8.5、开发 6 月后 9.1；两年以上的顶级队才够 10。
> 代码：`careerCraftPublicScore(liveMean, config)`（签名简化）、`liveToPublicScore()` 的虚拟作分支；
> 配置：`virtualPool.craft` 改为 `scoreBase` + `statDivisor`（删 `refTeamSize`/`refMonths`/`sizeExp`/`timeExp`）。

## 现象

生涯档（career mode）中，当玩家入职后首次或被分配到一个新的虚拟项目（如截图中的《灰羽契约·前期》）时，"在研作品" 四维（程序/策划/美术/音乐）一开始就显示为 107 / 92 / 97 / 89 等远高于玩家自身属性的数值。玩家当前自身属性仅约 43 / 17 / 17 / 17，导致新项目开局即接近满值，后续成长空间很小。

## 复现代码路径

1. `h5/js/sim/career.js` 中的 `sim.assignCareerProject()` 在空闲足够月数后调用 `sim.startVirtualProject()` 生成虚拟项目。
2. `startVirtualProject()` 用 `sim.careerCraftLiveStats(st, months, n, config)` 计算项目初始 `title.stats`。
3. `careerCraftLiveStats()`（行 1885-1907）公式为：

   ```javascript
   sizeF = Math.pow(n / refTeamSize, sizeExp);   // n=5, ref=5, sizeExp=0.6 → 1
   timeF = Math.pow(months / refMonths, timeExp); // months=6, ref=6, timeExp=0.5 → 1
   out[k] = avg[k] * sizeF * timeF;
   ```

   其中 `avg` 来自 `sim.careerTeamAvgStats()`，是 **玩家 + 4 名同事** 的属性平均值。
4. 同事属性由 `makeColleagueStats()` 按公司 `power` 抽取：
   - power 1：38-52
   - power 2：55-72（+2~5 专业加成）
   - power 3：80-92（+4~8 专业加成）

   因此只要入职一家 power 较高（或玩家已晋升、同事等级变高）的公司，teamAvg 很容易达到 70-90，新项目初始四维直接被拉到这个区间，加上公司/工作室经验加成和玩家熟练度加成后轻松破百。

## 根因

虚拟作立项时把 **完整团队平均值** 直接作为项目起点属性，而不是从一个较低的基础值开始、在开发过程中逐步成长。由于同事属性往往远高于玩家，新项目一立项就"继承"了同事能力，造成"新游戏初始属性非常高"。

## 影响

- 新项目开局口碑（≈ liveStats 均值 / 10）轻松达到 8-10，削弱养成感。
- 玩家个人成长、题材/玩法熟练度、开发事件对最终质量的影响被稀释。
- 弱组/小团队拉不开差距，强组一开始就在天花板附近。

## 建议修复

修改 `h5/js/sim/career.js` 中的 `careerCraftLiveStats()`，让初始值以 `virtualPool.baseStats` 为底，只把团队均值的一部分作为"立项加成"，而不是直接等于 teamAvg。

示例（保持现有公式结构，仅降低起点）：

```javascript
var baseStats = pool.baseStats || { program: 32, design: 32, art: 32, music: 32 };
for (i = 0; i < DIMS.length; i++) {
  k = DIMS[i];
  // 立项时只实现团队均值与 baseStats 之间的一部分差距
  out[k] = num(baseStats[k], 32) +
           (num(avg[k], 0) - num(baseStats[k], 32)) * sizeF * timeF * 0.4;
  if (out[k] < 0) out[k] = 0;
}
```

或者更简洁：在返回前对 `out[k]` 乘以一个 "initialScale"（可在 `virtualPool.craft` 中配置，默认 0.4-0.5）。

两种方案都能保留"人多/周期长加成高"的设计，但让新项目起点回到合理区间（30-50 左右），给玩家成长、事件和开发月贡献留出空间。

## 相关文件

- `h5/js/sim/career.js`：`careerCraftLiveStats()`、`startVirtualProject()`、`assignCareerProject()`
- `activity/career-world.json`：`virtualPool.craft`、`virtualPool.baseStats`、`colleagues.byPower.*`
- `tests/run-sim-tests.js`：现有测试未覆盖初始 liveStats 数值上限，修复后建议补断言
