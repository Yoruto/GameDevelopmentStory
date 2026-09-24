// 测试用例组：15-dev-pacing —— 玩家「接哪部作」的节奏（development.assignment / devWindow）。
// 背景与实测：activity/issues/bug-career-project-phase-starts-midgame.md
//   B：pickCareerAssignment 先比新鲜度、再比 prestige（preferFresh）
//   A：候选深过 maxProgress 就不接，改走池作 / 等下一部开工（含死锁守卫）
//   D：开工窗口规则（devWindow.mode=cadence），默认关闭，这里只验规则本身
"use strict";

module.exports = function runGroup(ctx) {
  const sim = ctx.sim, config = ctx.config, assert = ctx.assert,
      deepClone = ctx.deepClone, ok = ctx.ok;

  const world = config.careerWorld;
  const det = {};
  (world.titleDetails || []).forEach(function (d) { det[d.id] = d; });

  function hired(role) {
    let g = sim.createCareerGame("测", role || "programmer", config);
    g = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
    return g;
  }

  // ── B：同池里优先挑进度最浅的那部；landmark 优先不被挤掉；可关 ──────────────
  (function careerAssignmentPrefersTheFreshest() {
    const st = hired("programmer");
    st.year = 2014;
    st.month = 1;
    st.career.companyId = "paperGames";
    st.career.studioId = "paperGames-main";
    const prog = function (t) { return sim.titleProgress(t, det[t.id], 2014, 1, config); };
    const all = sim.titlesInDevAt("paperGames", 2014, 1, config, st, "paperGames-main");
    assert(all.length >= 2, "2014.1 叠纸当月有多部在研目录作（不然这条用例没有意义）");
    const picked = sim.pickCareerAssignment("paperGames", 2014, 1, config, st, "paperGames-main");
    // 规则断言：选中的必须是「landmark 池里进度最浅」的那部，而不是写死的 id
    const lms = all.filter(function (t) { return t.landmark && !t.virtual; });
    assert(lms.length >= 2, "landmark 池里也有多部（测的是同池内的新鲜度）");
    lms.forEach(function (t) {
      assert(prog(picked) <= prog(t) + 1e-9,
        "preferFresh 选进度最浅的：" + picked.id + "(" + prog(picked).toFixed(3) + ") vs " +
        t.id + "(" + prog(t).toFixed(3) + ")");
    });
    assert(!!picked.landmark, "landmark 优先没被新鲜度挤掉");
    // 关掉开关 = 回到纯 prestige → 发售最早（旧行为），且不再保证是最新的那部
    const off = deepClone(config);
    off.careerWorld.development.assignment.preferFresh = false;
    const oldPick = sim.pickCareerAssignment("paperGames", 2014, 1, off, st, "paperGames-main");
    const expect = lms.slice().sort(function (a, b) {
      const pd = (b.prestige || 0) - (a.prestige || 0);
      if (pd) return pd;
      if (a.releaseYear !== b.releaseYear) return a.releaseYear - b.releaseYear;
      return (a.releaseMonth || 1) - (b.releaseMonth || 1);
    })[0];
    assert(oldPick.id === expect.id, "preferFresh=false 时回到纯 prestige 排序");
    assert(oldPick.id !== picked.id, "两个开关下确实选了不同的作（新鲜度真的生效）");
    ok("pickCareerAssignment prefers the freshest candidate, landmark first, switchable");
  })();

  // ── A：候选深过 maxProgress 就不接，改走池作 / 等下一部开工 ────────────────
  (function careerAssignmentRejectsADeepCandidate() {
    const maxP = Number(world.development.assignment.maxProgress);
    const probeAt = function (coId, studioId, y, m) {
      const st = hired("programmer");
      st.year = y; st.month = m;
      st.career.companyId = coId; st.career.studioId = studioId;
      st.career.titleId = null; st.career.liveStats = null; st.career.idleMonths = 0;
      return st;
    };
    // 现场扫一个「有候选、候选很深、而且排得出下一档」的档期（别把公司和年份写死）
    let fix = null;
    ["nintendo", "capcom", "sega", "ea"].forEach(function (coId) {
      if (fix) return;
      const studioId = sim.defaultStudioId(sim.careerCompany(coId, config));
      for (let y = 1995; y <= 2005 && !fix; y++) {
        for (let m = 1; m <= 12 && !fix; m++) {
          const st = probeAt(coId, studioId, y, m);
          const cand = sim.pickCareerAssignment(coId, y, m, config, st, studioId);
          if (!cand || cand.virtual) continue;
          const p = sim.titleProgress(cand, det[cand.id], y, m, config);
          if (!(p > maxP + 0.1)) continue;
          if (!sim.nextCatalogTitle(st, config, coId, studioId)) continue;
          if (sim.catalogGapMonths(st, config, coId, studioId) == null) continue;
          fix = { coId: coId, studioId: studioId, y: y, m: m, cand: cand, prog: p, st: st };
        }
      }
    });
    assert(fix, "世界里存在「候选已深过 maxProgress 且还有下一档」的档期（这条用例的前提）");
    // ① 门槛生效：不挂在深候选上，改由池作（当月 0% 开工）兜底
    const st1 = deepClone(fix.st);
    sim.assignCareerProject(st1, config);
    assert(st1.career.titleId !== fix.cand.id,
      "拒收深候选（" + fix.cand.id + " 进度 " + fix.prog.toFixed(2) + "），不挂在它上面");
    assert(st1.career.titleId, "拒收后由池作兜底，不是空窗（" + (st1.career.titleId || "空") + "）");
    const st1t = sim.careerTitle(st1.career.titleId, config, st1);
    assert(st1t && st1t.virtual, "兜底的是池作（从当月 0% 开工）");
    // ② 关掉门槛 = 旧行为：直接挂上那部深候选
    const off = deepClone(config);
    off.careerWorld.development.assignment.maxProgress = null;
    const st2 = deepClone(fix.st);
    sim.assignCareerProject(st2, off);
    assert(st2.career.titleId === fix.cand.id, "maxProgress=null 时照旧挂在深候选上（开关可控）");
    // ③ 死锁守卫：这家公司排不出下一档就照收，不许把玩家卡在空窗里
    const solo = deepClone(config);
    solo.careerWorld.titles = solo.careerWorld.titles.filter(function (t) {
      return t.companyId !== fix.coId || t.id === fix.cand.id;
    });
    const keep = {};
    solo.careerWorld.titles.forEach(function (t) { keep[t.id] = true; });
    solo.careerWorld.titleDetails = solo.careerWorld.titleDetails.filter(function (d) { return keep[d.id]; });
    const st3 = deepClone(fix.st);
    sim.assignCareerProject(st3, solo);
    assert(st3.career.titleId === fix.cand.id, "排不出下一档时照收深候选（不死锁）");
    // ④ 空窗文案：「等下一部立项」要和「组里真没活」分开说
    const st4 = deepClone(fix.st);
    st4.career.titleId = null; st4.career.liveStats = null;
    st4.career.waitingForStart = { titleId: fix.cand.id, startYear: fix.y + 2, startMonth: 1 };
    const v4 = sim.careerProjectView(st4, config);
    assert(v4.idle && v4.idleLabel === config.copy.career.waitingHint, "空窗 + 等立项 → waitingHint");
    st4.career.waitingForStart = null;
    assert(sim.careerProjectView(st4, config).idleLabel !== config.copy.career.waitingHint,
      "没有下一档可等时不说 waitingHint");
    ok("assignCareerProject rejects a too-deep candidate, falls back to pool, never deadlocks");
  })();

  // ── D：开工窗口规则（devWindow）。默认 stretch = 旧口径；cadence 才拉稀档期 ──
  (function devWindowRuleKeepsWindowsFromOverlapping() {
    const dw = (world.development || {}).devWindow || {};
    assert(dw.mode === "stretch", "devWindow.mode 默认是 stretch（不许动已拍板的 P2c 口径）");
    const titles = (world.titles || []).filter(function (t) { return !t.virtual && det[t.id]; });
    const byCo = {};
    titles.forEach(function (t) { (byCo[t.companyId] = byCo[t.companyId] || []).push(t); });
    const rel = function (t) { return sim.monthIndex(t.releaseYear, t.releaseMonth); };

    // ① cadence：同公司相邻两作的窗口首尾相接，不再重叠
    const cad = deepClone(config);
    cad.careerWorld.development.devWindow.mode = "cadence";
    let pairs = 0, overlapBefore = 0, overlapAfter = 0;
    Object.keys(byCo).forEach(function (cid) {
      const list = byCo[cid].slice().sort(function (a, b) { return rel(a) - rel(b); });
      for (let i = 1; i < list.length; i++) {
        const prevRel = rel(list[i - 1]);
        const sBefore = sim.titleDevStart(list[i], det[list[i].id], config);
        const sAfter = sim.titleDevStart(list[i], det[list[i].id], cad);
        pairs += 1;
        if (sBefore <= prevRel) overlapBefore += 1;
        if (sAfter <= prevRel) overlapAfter += 1;
        assert(sAfter >= prevRel, "cadence 下开工月不早于上一作发售：" + list[i].id);
        assert(sAfter <= rel(list[i]), "cadence 不会把开工月推到发售之后：" + list[i].id);
      }
    });
    assert(pairs > 500, "样本量足够（相邻对 " + pairs + "）");
    assert(overlapBefore > overlapAfter,
      "cadence 确实减少了重叠：" + overlapBefore + " -> " + overlapAfter + " / " + pairs);
    // ② 窗口被压短（这正是它与 P2c 冲突的地方，明写出来免得被误当成免费午餐）
    const medLen = function (cfg) {
      const arr = [];
      titles.forEach(function (t) {
        arr.push(sim.monthIndex(t.releaseYear, t.releaseMonth) - sim.titleDevStart(t, det[t.id], cfg));
      });
      arr.sort(function (a, b) { return a - b; });
      return arr[Math.floor(arr.length / 2)];
    };
    const before = medLen(config), after = medLen(cad);
    assert(after < before, "cadence 把窗口中位从 " + before + " 压到 " + after + "（代价）");
    // ③ cap：只砍超长项目，短项目不动
    const cap = deepClone(config);
    cap.careerWorld.development.devWindow.capMonths = 30;
    titles.forEach(function (t) {
      const len = sim.monthIndex(t.releaseYear, t.releaseMonth) - sim.titleDevStart(t, det[t.id], cap);
      assert(len <= 30, "capMonths=30 之后没有窗口超过 30 月：" + t.id + " = " + len);
    });
    // ④ 默认档（stretch + cap 0）必须逐条等于老口径，绝不能悄悄动 P2c
    const oldWay = function (t) {
      const raw = sim.monthIndex(det[t.id].devStartYear, det[t.id].devStartMonth);
      const end = sim.monthIndex(t.releaseYear, t.releaseMonth);
      const mult = sim.careerCycleMult(config);
      if (!mult || mult === 1 || end <= raw) return raw;
      return end - Math.round((end - raw) * mult);
    };
    let drift = 0;
    titles.forEach(function (t) {
      if (sim.titleDevStart(t, det[t.id], config) !== oldWay(t)) drift += 1;
    });
    assert(drift === 0, "默认 devWindow 与老口径逐条一致（漂移 " + drift + " 部）");
    ok("devWindow: cadence removes overlap, cap trims long windows, default stays P2c");
  })();
};
