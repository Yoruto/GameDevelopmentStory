// 测试用例组：02-media（由 scripts/split_tests.py 机械拆分，块内容未改）
"use strict";

module.exports = function runGroup(ctx) {
  const GDS = ctx.GDS, sim = ctx.sim, config = ctx.config, assert = ctx.assert,
      deepClone = ctx.deepClone, ok = ctx.ok, PDIMS = ctx.PDIMS, TDIMS = ctx.TDIMS,
      fs = ctx.fs, path = ctx.path, ROOT = ctx.ROOT, SIM_FILES = ctx.SIM_FILES,
      __dirname = ctx.__dirname,
      liveHostCompany = ctx.liveHostCompany, enterLiveDevMonth = ctx.enterLiveDevMonth,
      fixCycle = ctx.fixCycle, withoutTitlePool = ctx.withoutTitlePool,
      withoutCatalog = ctx.withoutCatalog, withTitlePool = ctx.withTitlePool,
      tsum = ctx.tsum, hireOne = ctx.hireOne, firstIds = ctx.firstIds,
      pitchArgs = ctx.pitchArgs, quietWorld = ctx.quietWorld, fillerLadder = ctx.fillerLadder;
  (function mediaOutletsCarryFullQuotePools() {
    // 四家媒体 = 四个维度各一个主场。配置里的 outlets 与评语池必须一一对应：
    // 删了一家却留着它的池（或反过来）就是文案 bug —— 这里当守卫。
    const outlets = config.release.media.outlets;
    const bands = ["top", "high", "mid", "low"];
    assert(outlets.length === 4, "four media outlets, got " + outlets.length);
    const pools = config.copy.mediaQuotePools.outlets;
    assert(Object.keys(pools).length === outlets.length,
      "no orphan quote pool: pools=" + Object.keys(pools).join(","));
    outlets.forEach(function (o) {
      const pool = pools[o.id];
      assert(pool, "quote pool exists for " + o.id);
      let all = [];
      bands.forEach(function (b) {
        assert(Array.isArray(pool[b]) && pool[b].length > 0, "pool " + o.id + "." + b + " non-empty");
        all = all.concat(pool[b]);
      });
      assert(new Set(all).size === all.length, "no duplicate quotes inside " + o.id);
      assert(all.every(function (q) { return typeof q === "string" && q.length >= 2 && q.length <= 18; }),
        "quotes stay one short sentence: " + o.id);
    });
    // 玩家在同一次揭晓里同时看到四家的评语，同档撞句必须为 0
    for (let i = 0; i < outlets.length; i++) {
      for (let j = i + 1; j < outlets.length; j++) {
        bands.forEach(function (b) {
          const a = pools[outlets[i].id][b];
          const bq = new Set(pools[outlets[j].id][b]);
          const hit = a.filter(function (q) { return bq.has(q); });
          assert(hit.length === 0, "no same-band quote collision " + outlets[i].id + "/" + outlets[j].id + ": " + hit.join("|"));
        });
      }
    }
    ok("four outlets each carry a full, non-colliding quote pool");
  })();

  (function mediaAvgIsMeanOfOutlets() {
    // 面板上的「均分」必须能被玩家拿看得见的四家分数手算出来，而且要和作品评分是同一个数
    // ——2026-09-18 的 bug：4 家都不是 10 分，均分却写 10（面板把对外口碑当均分显示了）。
    const jit = config.careerWorld.scoreFromLive;
    const scatter = { min: jit.mediaJitterMin, max: jit.mediaJitterMax };
    const round1 = function (v) { return Math.round(v * 10) / 10; };
    let seen = 0, freeRange = 0;
    for (let p = 10; p <= 100; p += 1) {
      const pub = p / 10;
      // 离上下限足够远时（余量 ≥ 抖动幅度）不压缩，这是绝大多数分数所在的区间。
      const free = Math.min(config.release.media.maxScore - pub, pub - config.release.media.minScore) >= jit.mediaJitterMax;
      for (let seed = 1; seed <= 40; seed++) {
        const st = { rngSeed: (seed * 104729 + p * 31) >>> 0, rngCount: 0 };
        const m = sim.scoreMediaFromPublic(st, pub, config, scatter);
        const rows = m.rows.map(function (r) { return r.score; });
        const hand = round1(rows.reduce(function (a, b) { return a + b; }, 0) / rows.length);
        assert(m.avg === hand, "media avg is the mean of the shown rows: " + m.avg + " vs " + hand + " " + rows);
        // 抖动是配平的：均分落回口碑，不带系统性偏移（也保证榜单/奖项读到的就是面板上那一个数）
        assert(m.avg === round1(pub), "media avg stays on the public score, got " + m.avg + " vs " + pub);
        // 单家偏移不超过配置写的抖动幅度，且永远不吃 min/max 夹子
        rows.forEach(function (v) {
          assert(Math.abs(v - pub) <= jit.mediaJitterMax + 1e-9, "outlet jitter within cap, got " + v + " vs " + pub);
          assert(v >= config.release.media.minScore && v <= config.release.media.maxScore, "outlet clamped into range");
        });
        if (!free) continue;
        // 分歧必须存在：正好两家偏高、两家偏低
        const up = rows.filter(function (v) { return v > pub + 1e-9; }).length;
        assert(up === 2, "two outlets above, two below: " + up + " rows=" + rows + " pub=" + pub);
        // 哪两家偏高必须轮换，不能永远是同一批
        freeRange += 1;
        seen += rows[0] > pub + 1e-9 ? 1 : 0;
      }
    }
    // 第一家在「偏高」那一档的次数应接近一半（正负两侧是按随机轮换分的，不是按出场顺序）
    assert(seen > freeRange * 0.4 && seen < freeRange * 0.6,
      "outlet bias rotates, first outlet high " + seen + "/" + freeRange);
    // 满分作：余量为 0，四家一致给满分，均分真的到得了 10
    const atTop = sim.scoreMediaFromPublic({ rngSeed: 99, rngCount: 0 }, config.release.media.maxScore, config, scatter);
    assert(atTop.avg === config.release.media.maxScore, "perfect work shows a perfect average");
    assert(atTop.rows.every(function (r) { return r.score === config.release.media.maxScore; }), "perfect work: all four agree");
    ok("media average is the mean of the four shown scores, balanced around the public score");
  })();

};
