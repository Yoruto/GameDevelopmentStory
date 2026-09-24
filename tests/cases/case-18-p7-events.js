// 测试用例组：18-p7-events（事件说话人 / flag 回访闭环 / 三条下行线 / 职业线压拍）
"use strict";

module.exports = function runGroup(ctx) {
  const GDS = ctx.GDS, sim = ctx.sim, config = ctx.config, assert = ctx.assert,
      deepClone = ctx.deepClone, ok = ctx.ok,
      liveHostCompany = ctx.liveHostCompany, enterLiveDevMonth = ctx.enterLiveDevMonth,
      withoutTitlePool = ctx.withoutTitlePool;

  function findEvent(list, id) {
    return (list || []).filter(function (e) { return e.id === id; })[0] || null;
  }

  // 一个已经入职、在开发月、从业月数足够长的 state（下行线的开线门槛需要它）
  function veteran(roleId, cfg) {
    const use = cfg || config;
    const st = enterLiveDevMonth(withoutTitlePool(deepClone(use)), 991, roleId || "art", use);
    const cal = config.careerWorld.timeline || {};
    const startY = cal.startYear != null ? cal.startYear : 1995;
    const startM = cal.startMonth != null ? cal.startMonth : 1;
    st.year = startY + 4;
    st.month = startM;
    if (st.career.titleId) {
      st.career.credits = [{
        titleId: st.career.titleId, joinYear: startY, joinMonth: startM,
        shipped: false, virtual: false, leftYear: null
      }];
    }
    return st;
  }

  (function eventSpeakerFollowsNameMode() {
    const st = veteran("art");
    const list = (sim.careerWorld(config).devEvents || {}).list || [];
    const ev = findEvent(list, "reskinLook");
    assert(ev && ev.speakerCast, "reskinLook carries speakerCast");
    const realName = sim.eventSpeakerName(ev, st, config);
    assert(typeof realName === "string" && realName.length > 0, "speaker resolves to a name");

    const ficCfg = deepClone(config);
    ficCfg.careerWorld.nameMode = "fiction";
    ficCfg.careerWorld.useAlias = true;
    const ficName = sim.eventSpeakerName(ev, st, ficCfg);
    assert(typeof ficName === "string" && ficName.length > 0, "fiction mode still resolves");
    // 两种模式都取到 cast 真身时，名字必须不同（这正是双姓名模式的落点）
    const person = sim.castFor({ companyId: st.career.companyId, roleId: "art", year: st.year }, config);
    if (person && person.alias && person.alias !== person.name) {
      assert(realName !== ficName, "real vs fiction speaker differ: " + realName + " / " + ficName);
    }

    const filled = sim.eventSpeakerFill("他说：{speaker} 来了。", "张三");
    assert(filled === "他说：张三 来了。", "speakerFill replaces the token");
    assert(sim.eventSpeakerFill("没有占位符。", "张三") === "没有占位符。", "speakerFill is a no-op without token");
    ok("event speaker resolves through cast and follows nameMode");
  })();

  (function flagCallbackEchoesOnce() {
    const st = veteran("programmer");
    const res = sim.resolveCareerEventChoice(st, "blankStart", "fromScratch", config);
    assert(res && res.ok, "resolve blankStart/fromScratch");
    assert(res.state.career.eventFlags && res.state.career.eventFlags.progFromScratch === true,
      "option writes the flag");
    const pending = res.state.career.pendingCallbacks || [];
    const due = pending.filter(function (p) { return p.eventId === "echoProgFromScratch"; })[0];
    assert(due, "echo event is scheduled");
    assert(due.due > sim.monthIndex(res.state.year, res.state.month), "echo is scheduled for later");

    let later = res.state;
    later.year += 2; // 远超 triggerDelayMonths 上界
    const fired = sim.dueEventCallback(later, config);
    assert(fired && fired.id === "echoProgFromScratch", "echo fires when due");
    assert(sim.dueEventCallback(later, config) === null, "echo fires only once");
    ok("flag written by a choice pays off as a one-shot echo beat");
  })();

  (function downbeatLines() {
    const st = veteran("art");
    const started = sim.startCareerLine(st, "crunch-collapse", config);
    assert(started && started.ok, "crunch-collapse opens as an optional line");
    let s = started.state;
    let step = sim.resolveCareerLineChoice(s, "crunch-collapse", "report", "pushOn", config);
    s = step.state;
    assert(s.career.lines["crunch-collapse"].flags.pushedThrough === true, "pushOn writes the flag");
    s.career.lines["crunch-collapse"].waitUntil = sim.monthIndex(s.year, s.month);
    s.career.lines["crunch-collapse"].pending = false;
    const before = s.career.health;
    sim.processCareerLines(s, config, [], []);
    const after = s.career.health;
    assert(after < before, "collapse costs health: " + before + " -> " + after);

    // 自动开线路径（真实游戏里唯一会走的路径）：startWhen 里的 noGroupDone 让一局只开一条。
    // startCareerLine 是强制入口、不校验 startWhen，所以这里必须走 processCareerLines。
    const cfg = deepClone(config);
    cfg.careerWorld.eventLines.lines.forEach(function (l) {
      if (l.kind === "downbeat") l.startWhen.startChance = 1;
    });
    const isDown = function (id) {
      const d = (cfg.careerWorld.eventLines.lines || []).filter(function (l) { return l.id === id; })[0];
      return !!d && d.kind === "downbeat";
    };
    const fresh = veteran("art", cfg);
    sim.processCareerLines(fresh, cfg, [], []);
    const opened = Object.keys(fresh.career.lines || {}).filter(isDown);
    assert(opened.length === 1, "auto-open starts exactly one downbeat line, got " + opened.length);
    fresh.career.lines[opened[0]].status = "done";
    sim.processCareerLines(fresh, cfg, [], []);
    const reopened = Object.keys(fresh.career.lines || {}).filter(isDown);
    assert(reopened.length === 1, "no second downbeat line after one is done, got " + reopened.length);
    ok("downbeat lines run once per career and cost health");
  })();

  (function cancelledProjectDropsTheTitle() {
    const st = veteran("design");
    const started = sim.startCareerLine(st, "project-cancelled", config);
    assert(started && started.ok, "project-cancelled opens");
    let s = started.state;
    assert(s.career.titleId, "player has a title before cancellation");
    const rumor = sim.resolveCareerLineChoice(s, "project-cancelled", "rumor", "brace", config);
    s = rumor.state;
    s.career.lines["project-cancelled"].waitUntil = sim.monthIndex(s.year, s.month);
    s.career.lines["project-cancelled"].pending = false;
    sim.processCareerLines(s, config, [], []);
    assert(!s.career.titleId, "cancellation drops the current title");
    assert((s.career.cancelledCount || 0) >= 1, "cancellation is counted");
    ok("a cancelled project unhooks the player without kicking them out");
  })();

  (function promoLinesCompressedToTwoBeats() {
    const lines = (config.careerWorld.eventLines || {}).lines || [];
    ["promo-to-expert", "promo-to-director", "become-producer"].forEach(function (id) {
      const line = lines.filter(function (l) { return l.id === id; })[0];
      assert(line, "line exists: " + id);
      assert((line.beats || []).length === 2, id + " compressed to 2 beats");
      const last = line.beats[line.beats.length - 1];
      const opts = last.options || [];
      assert(opts.length >= 3, id + " keeps both branches plus walk-away");
      const promoted = opts.filter(function (o) {
        return o.effects && (o.effects.promote || o.effects.becomeProducer);
      });
      assert(promoted.length >= 2, id + " final beat carries the promotion on both branches");
    });
    ok("career-path lines are 2 beats with the branch rewards intact");
  })();

};
