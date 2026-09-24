// 测试用例组：13-chapters（由 scripts/split_tests.py 机械拆分，块内容未改）
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
  (function careerChaptersAndAwardEras() {
    // P5a：章容器——六阶段边界 + 开场白描齐备
    const chapters = ((config.careerWorld.chapters || {}).list) || [];
    assert(chapters.length === 6, "6 chapters, got " + chapters.length);
    const bounds = JSON.stringify(chapters.map(function (c) { return c.years; }));
    assert(bounds === JSON.stringify([[1995, 1999], [2000, 2004], [2005, 2009], [2010, 2014], [2015, 2019], [2020, 2025]]),
      "chapter bounds " + bounds);
    chapters.forEach(function (c) {
      assert(c.name && Array.isArray(c.open.lines) && c.open.lines.length >= 2 && c.open.lines.length <= 3,
        "chapter " + c.id + " has 2~3 open lines");
      assert(c.closeLine, "chapter " + c.id + " has close line");
    });
    [1995, 2000, 2005, 2010, 2015, 2020].forEach(function (y) {
      const ch = sim.careerChapterOf(y, config);
      assert(ch && ch.years[0] === y, "chapter starts at " + y);
    });
    [1997, 2003, 2018].forEach(function (y) {
      assert(!sim.careerChapterOf(y, config), "no chapter start at " + y);
    });
    // P5c：双档命名（1995-2013 年度游戏大赏 / 2014 起 TGA）
    assert(sim.careerAwardNightKicker(1997, config) === "1997年度游戏大赏", "classic era kicker");
    assert(sim.careerAwardNightKicker(2013, config) === "2013年度游戏大赏", "last classic year");
    assert(sim.careerAwardNightKicker(2014, config) === "2014 TGA 年度盛典", "tga era kicker");
    assert(sim.careerAwardShowName(1997, config) === "年度游戏大赏", "classic show name");
    assert(sim.careerAwardShowName(2014, config) === "TGA 年度盛典", "tga show name");
    // P5c 快讯档：玩家未卷入的届次才生成一行颁奖快讯；快讯档读上届 goty 得主
    const stNews = { awardsHistory: [{ year: 1996, awards: [{ id: "goty", n: "年度游戏", w: "最终幻想VII", titleId: "ff7", playerNominated: false, playerWon: false }] }] };
    const line = sim.careerAwardNewsLine(1996, stNews, config);
    assert(line && line.indexOf("1996 年度游戏大赏") >= 0 && line.indexOf("最终幻想VII") >= 0,
      "award news line: " + line);
    // 得主不满足高声望 → 回落「当年 catalog 高声望代表作」（5c 口径）
    const stLow = { awardsHistory: [{ year: 1996, awards: [{ id: "goty", n: "年度游戏", w: "小作品", titleId: null, playerNominated: false, playerWon: false }] }] };
    const line2 = sim.careerAwardNewsLine(1996, stLow, config);
    assert(line2 && line2.indexOf("1996 年度游戏大赏颁给《") >= 0, "news falls back to landmark of the year: " + line2);
    const stPlayer = { awardsHistory: [{ year: 1996, awards: [{ id: "goty", n: "年度游戏", w: "X", playerNominated: true, playerWon: false }] }] };
    assert(sim.careerAwardNewsLine(1996, stPlayer, config) === null, "player-involved year uses full show, no news line");
    assert(sim.careerAwardNewsLine(1999, stNews, config) === null, "missing year no news line");
    // P5e 节奏调参（Master 拍板 1+2）：maxPerYear 5→2；12 条纯氛围 choice 降级为 notice
    assert(config.careerWorld.devEvents.maxPerYear === 2, "pacing: maxPerYear 2");
    const choicePool = config.careerWorld.devEvents.list.filter(function (e) {
      return (e.presentation || "notice") === "choice" && !e.manualOnly;
    });
    assert(choicePool.length === 65, "choice pool after demotion, got " + choicePool.length);
    const he = config.careerWorld.devEvents.list.filter(function (e) { return e.id === "colorFight"; })[0];
    assert(he && he.presentation === "notice" && !he.choices && he.qualityDim && he.qualityDelta,
      "flavor choice demoted to notice with merged effect");
    // P5a 章末收束接线：1999.12 继续一步 → 谢幕页 + 开场页，停在 chapterOpen
    sim.careerChapterEndingAt(1999, config);
    const endCh = sim.careerChapterEndingAt(1999, config);
    assert(endCh && endCh.id === "ch1", "ch1 ends at 1999");
    assert(sim.careerChapterEndingAt(1994, config) === null, "no chapter ends at 1994");
    const gCh = sim.createCareerGame("章", "programmer", config);
    gCh.rngSeed = 555; gCh.rngCount = 0;
    let st99 = sim.acceptOpeningOffer(gCh, gCh.career.openingOffers[0].id, config).state;
    st99.year = 1999; st99.month = 12;
    const rr = sim.skipToNextNode(st99, config);
    assert(rr.node && rr.node.id === "chapterOpen", "chapter open stops the skip");
    const closePage = (rr.queue || []).filter(function (p) { return p.type === "chapterClose"; })[0];
    const openPage = (rr.queue || []).filter(function (p) { return p.type === "chapterOpen"; })[0];
    assert(closePage && closePage.body.indexOf("新世纪要来了") >= 0, "close page carries ch1 closeLine");
    assert(openPage && openPage.title.indexOf("2000 年 · 网游淘金") >= 0, "open page titles ch2");
    ok("P5a/5c: chapters container, dual-era award naming, award news line, chapter close wiring, pacing knobs");
  })();

  (function careerP6Feedback() {
    // P6a 里程碑：阈值与晋升硬门槛对齐 + 每档一次 + flag 落盘
    const ms = ((config.careerWorld.statMilestones || {}).list) || [];
    const reqs = (config.careerWorld.jobRanks.promotion.requirements || [])
      .filter(function (r) { return r && r.mainStat != null; })
      .map(function (r) { return r.mainStat; });
    assert(JSON.stringify(ms.map(function (m) { return m.at; })) === JSON.stringify(reqs),
      "milestone at values == promotion mainStat thresholds");
    const st = deepClone(sim.createCareerGame("碑", "programmer", config));
    st.rngSeed = 31; st.rngCount = 0;
    st.career.stats = { program: 52, design: 5, art: 5, music: 5 };
    st.career.statMilestones = {};
    const q1 = [];
    sim.checkStatMilestones(st, config, q1);
    assert(q1.length === 4, "crossing 52 fires 4 milestones, got " + q1.length);
    assert(st.career.statMilestones[28] && st.career.statMilestones[34] &&
      st.career.statMilestones[41] && st.career.statMilestones[51], "milestone flags set");
    assert(q1[0].type === "milestone" && q1[0].kicker === "被世界承认" && q1[0].at === 28,
      "milestone page shape");
    assert(st.rngCount === 0, "milestone check consumes no RNG");
    const q2 = [];
    sim.checkStatMilestones(st, config, q2);
    assert(q2.length === 0, "each tier fires exactly once");
    st.career.stats.program = 60;
    const q3 = [];
    sim.checkStatMilestones(st, config, q3);
    assert(q3.length === 1 && q3[0].at === 60, "60th tier fires after crossing");
    // P6b 离奖信号（纯文案，三档 + 低分不给）
    assert(sim.mediaAwardHint(9, config).indexOf("颁奖夜") >= 0, "award hint high");
    assert(sim.mediaAwardHint(7.8, config).indexOf("提名") >= 0, "award hint mid");
    assert(sim.mediaAwardHint(6.2, config).indexOf("离奖") >= 0, "award hint low");
    assert(sim.mediaAwardHint(5, config) === null, "no hint below 6");
    // P6c 销量具象化：同期 landmark 被超过 → 对标一行；launchSales 链路只读不动
    const stF = { worldReleased: [
      { titleId: "ff7", releasedYear: 1997, releasedMonth: 1, lifetimeSales: 100 },
      { titleId: "mine97", releasedYear: 1997, releasedMonth: 6, launchSales: 5000, lifetimeSales: 5000 }
    ] };
    const recF = { titleId: "mine97", score: 8.8, launchSales: 5000, lifetimeSales: 5000,
                   releasedYear: 1997, releasedMonth: 6 };
    const flavor = sim.mediaRevealFlavor(recF, stF, config);
    assert(flavor.length >= 1 && flavor.length <= 2, "flavor 1~2 lines");
    assert(flavor[0].indexOf("颁奖夜") >= 0, "flavor line1 award hint: " + flavor[0]);
    assert(flavor.some(function (l) { return l.indexOf("最终幻想VII") >= 0; }),
      "landmark beat line: " + flavor.join(" | "));
    assert(recF.launchSales === 5000 && recF.lifetimeSales === 5000, "sales numbers untouched by flavor layer");
    // P6d 人物线正反馈拍：9 条线各一条 effects.cheer
    (config.careerWorld.eventLines.lines || []).forEach(function (l) {
      const has = (l.beats || []).some(function (b) {
        return (b.options || []).some(function (o) { return o.effects && o.effects.cheer; });
      });
      assert(has, "line " + l.id + " has a cheer beat");
    });
    // P6e 玩家的玩家反馈：6 条 notice 事件，每条 ≤2 行
    const fans = (config.careerWorld.postLaunch.events || []).filter(function (e) {
      return e.id.indexOf("fan") === 0;
    });
    assert(fans.length === 6, "6 fan feedback events");
    fans.forEach(function (e) {
      assert(e.presentation === "notice" && e.qualityDim, "fan event " + e.id + " notice + qualityDim");
      assert((e.text || "").length <= 90, "fan event " + e.id + " within 2 lines");
    });
    ok("P6: stat milestones, award hint, sales flavor, line cheer, fan feedback");
  })();

};
