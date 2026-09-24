// 测试用例组：17-promotion-gate —— 职级必须由属性（mainStat 硬门槛）决定。
// 背景与实测：activity/issues/bug-career-rank-outruns-stats.md
//   旧实现里「挖人带级」的条件是 fame>=8（声望，与主职维无关），实测占全部晋升 52.6%，
//   把 T6 送到了主职维 46.7 的人身上；applyCareerPromotion 自身也不设防，全靠调用点自觉。
"use strict";

module.exports = function runGroup(ctx) {
  const sim = ctx.sim, config = ctx.config, assert = ctx.assert,
      deepClone = ctx.deepClone, ok = ctx.ok;

  const world = config.careerWorld;
  const promo = world.jobRanks.promotion;
  const reqs = promo.requirements || [];

  // rank 3 / 主职维 20（门槛 41）——「属性不到 40 却想升」的最小复现态。
  // fame/credits/months 都给足，只卡属性这一条，保证测的是属性门槛而不是别的。
  function lowStatState(rank, statVal, fame) {
    const g = sim.createCareerGame("测", "programmer", config);
    const st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
    st.year = 2010;
    st.month = 6;
    st.career.companyId = "capcom";
    st.career.studioId = sim.defaultStudioId(sim.careerCompany("capcom", config));
    st.career.jobRank = rank;
    st.career.monthsInRank = 120;
    st.career.promotionsThisYear = 0;
    // jobXp 故意给到极高：2026-09-22 起职级经验**不再**参与晋升判定
    //（原 mainStatOrJobXp「二选一」已移除），所以这 300 点不该救回任何一次晋升。
    st.career.jobXp = 300;
    st.career.fame = fame == null ? 999 : fame;
    st.career.honor = 0;
    st.career.credits = [];
    for (let i = 0; i < 20; i++) {
      st.career.credits.push({ titleId: "cred-" + i, shipped: true, signedEligible: true, signed: true });
    }
    const role = sim.careerRole(st.career.roleId, config);
    st.career.stats = {};
    st.career.stats[(role && role.stat) || "program"] = statVal;
    return st;
  }
  function rankOf(st) { return sim.careerJobRank(st.career, config); }

  // ── ① 硬门槛：属性不够就不该升，哪怕声望爆表 ────────────────────────────
  (function statIsAHardGate() {
    const st = lowStatState(3, 20, 999);
    assert(sim.careerMainStat(st, config) < reqs[3].mainStat,
      "前提：主职维 " + sim.careerMainStat(st, config) + " < 门槛 " + reqs[3].mainStat);
    assert(!sim.canPromoteCareer(st, config), "属性不够时 canPromoteCareer 为 false");
    // 直接调落地点也必须被挡住（旧实现这里会白送一级）
    sim.applyCareerPromotion(st, config);
    assert(rankOf(st) === 3, "applyCareerPromotion 自身复核门槛：属性不够 → 不升（实得 T" + rankOf(st) + "）");
    sim.promoteCareer(st, config);
    assert(rankOf(st) === 3, "promoteCareer 也不放行（实得 T" + rankOf(st) + "）");
    ok("job rank refuses to rise while the main stat is below the requirement");
  })();

  // ── ② 挖人给的职级只看属性，声望再高也不越级（原 fame>=8 兜底已废） ────────
  (function inviteRankNeverFollowsFameAlone() {
    const rankSpec = promo.inviteRank || {};
    assert(rankSpec.enabled !== false, "inviteRank 默认开着");
    assert(Number(rankSpec.rankCapByPower["1"]) < 6, "公司体量封顶生效（power1 给不到满级）");
    // 属性不够（主职维 20，够到 T1）+ 声望爆表 → 邀约职级不得高于自己的职级
    const dets = (world.titleDetails || []).filter(function (d) {
      return d.inviteEligible && d.inviteWindow;
    });
    let checked = 0;
    for (let i = 0; i < dets.length && checked < 8; i++) {
      const d = dets[i];
      const t = sim.findById(world.titles, d.id);
      if (!t) continue;
      const co = sim.careerCompany(t.companyId, config);
      if (!sim.companyJoinable(co, d.inviteWindow.startYear)) continue;
      const st = lowStatState(3, 20, 999);       // 声望 999，主职维只有 20
      assert(!sim.canPromoteCareer(st, config), "前提：属性不够，不可晋升");
      st.year = d.inviteWindow.startYear;
      st.month = d.inviteWindow.startMonth;
      st.career.companyId = "capcom";
      st.career.studioId = sim.defaultStudioId(sim.careerCompany("capcom", config));
      let list = [];
      try { list = sim.listCareerInvites(st, config) || []; } catch (e) { list = []; }
      list.forEach(function (inv) {
        checked += 1;
        assert(inv.jobRank <= 3,
          "属性不够时邀约不得给更高职级（声望不是能力）：" + inv.id + " 给了 T" + inv.jobRank);
      });
    }
    assert(checked > 0, "至少扫到一条邀约（不然这条用例没测到东西，扫了 " + dets.length + " 个窗口）");
    ok("invite rank never follows fame alone");
  })();

  // ── ③ 剧情破格是显式开关：storyBypass=false 时剧情也不能越级 ──────────────
  (function storyBypassIsExplicit() {
    assert(promo.storyBypass !== false, "默认保留剧情破格（叙事需要）");
    const st = lowStatState(3, 20, 0);
    sim.applyCareerPromotion(st, config, { story: true, storyPromo: true });
    assert(rankOf(st) === 4 || (st.career.pendingStoryPromos || 0) > 0,
      "storyBypass 开着时剧情晋升仍可破格（升到 T" + rankOf(st) + " 或挂起）");
    const off = deepClone(config);
    off.careerWorld.jobRanks.promotion.storyBypass = false;
    const st2 = lowStatState(3, 20, 0);
    sim.applyCareerPromotion(st2, off, { story: true, storyPromo: true });
    assert(rankOf(st2) === 3, "storyBypass=false 时剧情晋升也过不了属性门槛（实得 T" + rankOf(st2) + "）");
    // gateInFunction=false 是回滚开关：退回旧的「只靠调用点自觉」
    const legacy = deepClone(config);
    legacy.careerWorld.jobRanks.promotion.gateInFunction = false;
    const st3 = lowStatState(3, 20, 0);
    sim.applyCareerPromotion(st3, legacy);
    assert(rankOf(st3) === 4, "gateInFunction=false 可回滚到旧行为（实得 T" + rankOf(st3) + "）");
    ok("story promotion bypass is an explicit switch, rollback switch intact");
  })();

  // ── ④ 职级经验不再能替代属性（原 mainStatOrJobXp 条款已移除） ──────────────
  (function jobXpNoLongerSubstitutes() {
    const rows = promo.requirements || [];
    rows.forEach(function (r) {
      if (!r) return;
      assert(r.mainStatOrJobXp == null,
        "requirements 里不应再有 mainStatOrJobXp（已移除，晋升只看属性）");
    });
    // 属性不够 + jobXp 爆表 → 仍然升不了
    [2, 3, 4].forEach(function (rank) {
      const st = lowStatState(rank, 10, 999);   // 主职维 10，远低于任何门槛
      st.career.jobXp = 99999;
      assert(!sim.canPromoteCareer(st, config),
        "rank " + rank + " 的职级经验 99999 也换不来晋升（缺 " +
        sim.careerPromotionView(st, config).gaps.map(function (g) { return g.id; }).join(",") + "）");
      const before = rankOf(st);
      sim.applyCareerPromotion(st, config);
      assert(rankOf(st) === before, "职级经验不参与判定：rank " + before + " 应原地不动");
    });
    ok("job experience no longer substitutes for the main stat");
  })();

  // ── ⑤ 属性够到哪一级：careerStatRank 阶梯 ───────────────────────────────
  (function statRankLadder() {
    const expect = [
      [20, 1], [27, 1], [28, 2], [33, 2], [34, 3], [40, 3],
      [41, 4], [50, 4], [51, 5], [59, 5], [60, 6], [80, 6]
    ];
    expect.forEach(function (row) {
      const st = lowStatState(1, row[0], 0);
      assert(sim.careerStatRank(st, config) === row[1],
        "mainStat " + row[0] + " 应该够到 T" + row[1] + "，实得 T" + sim.careerStatRank(st, config));
    });
    // 换岗会换主维：主维换成别的维度后按新维重算
    const st2 = lowStatState(1, 60, 0);
    st2.career.stats.art = 30;
    const artRole = { stat: "art" };
    st2.career.roleId = "art";
    assert(sim.careerStatRank(st2, config) === 2, "换到美术岗后按美术属性重算（30 → T2）");
    void artRole;
    ok("careerStatRank maps the main stat onto the rank ladder");
  })();

  // ── ⑥ 挖人给的位置按属性定，并按公司体量封顶 ────────────────────────────
  (function inviteRankFollowsTheStat() {
    const rankSpec = promo.inviteRank || {};
    assert(rankSpec.enabled !== false && rankSpec.rankCapByPower,
      "inviteRank 开着且配了 rankCapByPower");
    const dets = (world.titleDetails || []).filter(function (d) {
      return d.inviteEligible && d.inviteWindow;
    });
    assert(dets.length > 0, "世界里存在可发邀约的作（这条用例的前提）");
    let checked = 0;
    for (let i = 0; i < dets.length && checked < 6; i++) {
      const d = dets[i];
      const t = sim.findById(world.titles, d.id);
      if (!t) continue;
      const co = sim.careerCompany(t.companyId, config);
      if (!sim.companyJoinable(co, d.inviteWindow.startYear)) continue;
      // 站在窗口起点：主职维 58（够到 T5），当前职级压到 2 → 外部应该按能力给到 T5（受体量封顶）
      const st = lowStatState(2, 58, 500);
      st.year = d.inviteWindow.startYear;
      st.month = d.inviteWindow.startMonth;
      st.career.companyId = "capcom";
      st.career.studioId = sim.defaultStudioId(sim.careerCompany("capcom", config));
      let list = [];
      try { list = sim.listCareerInvites(st, config) || []; } catch (e) { list = []; }
      list.forEach(function (inv) {
        const powerKey = String(sim.careerCompany(inv.companyId, config).power);
        const cap = rankSpec.rankCapByPower[powerKey];
        const want = Math.min(Math.max(2, sim.careerStatRank(st, config)), cap == null ? 6 : cap);
        assert(inv.jobRank === want,
          "邀约职级 = max(当前, 属性档) 再按体量封顶：期望 T" + want + "，实得 T" + inv.jobRank +
          "（" + inv.id + " / power " + powerKey + "）");
        checked += 1;
      });
    }
    assert(checked > 0, "扫到至少一条邀约（扫了 " + dets.length + " 个窗口）");
    // 体量封顶确实会压：小作坊（power1，cap 3）给不了 T5
    const lowCap = rankSpec.rankCapByPower["1"];
    assert(lowCap < 5, "power1 的封顶应当低于 T5（实测 " + lowCap + "），否则封顶没意义");
    ok("invite rank follows the stat, capped by the company scale");
  })();

  // ── ⑦ 够格就该升：门槛不是「永远升不上去」 ──────────────────────────────
  (function qualifiedStillPromotes() {
    const st = lowStatState(3, reqs[3].mainStat + 3, 999);
    assert(sim.canPromoteCareer(st, config), "属性达标 + 署名/声望/月数都够 → 可晋升");
    const before = rankOf(st);
    sim.applyCareerPromotion(st, config);
    assert(rankOf(st) === before + 1, "达标时正常升一级（T" + before + " → T" + rankOf(st) + "）");
    ok("a qualified player still gets promoted (the gate is not a wall)");
  })();
};
