#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "activity", "config.json");
const SIM_DIR = path.join(ROOT, "h5", "js", "sim");
const SIM_FILES = [
  "ns.js",
  "rng.js",
  "util.js",
  "company.js",
  "staff.js",
  "project.js",
  "liveops.js",
  "series.js",
  "rivals.js",
  "media.js",
  "awards.js",
  "events.js",
  "lifecycle.js",
  "tick.js",
  "actions.js"
];

function loadSim() {
  const sandbox = {
    console: console,
    Math: Math,
    JSON: JSON,
    Date: Date,
    Array: Array,
    Object: Object,
    String: String,
    Number: Number,
    Boolean: Boolean
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const file of SIM_FILES) {
    const full = path.join(SIM_DIR, file);
    vm.runInContext(fs.readFileSync(full, "utf8"), sandbox, { filename: file });
  }
  return sandbox.GDS;
}

function deepClone(x) {
  return JSON.parse(JSON.stringify(x));
}

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
}

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

function main() {
  const GDS = loadSim();
  const sim = GDS.sim;
  const config = loadConfig();
  let passed = 0;

  function ok(name) {
    passed += 1;
    console.log("ok  " + name);
  }

  function hireOne(seed) {
    const g = sim.createNewGame("测", config);
    g.rngSeed = seed;
    g.rngCount = 0;
    const hired = sim.hire(g, g.talentMarket[0].id, config);
    assert(hired.ok, "hireOne");
    return hired.state;
  }

  function firstIds() {
    const genreId = config.content.genres[0].id;
    const gameplayId = config.content.gameplay[0].id;
    return { genreId, gameplayId };
  }

  function pitchArgs(state, extra) {
    const ids = firstIds();
    const staffId = state.staff[0].id;
    const base = {
      title: extra && extra.title ? extra.title : "测试作",
      genreId: ids.genreId,
      gameplayId: ids.gameplayId,
      platformId: "pc",
      releaseType: "boxed",
      cycle: "short",
      producerId: staffId,
      memberIds: [staffId]
    };
    return Object.assign(base, extra || {});
  }

  (function startingFundsFromConfig() {
    const g = sim.createNewGame("测试社", config);
    assert(g.company.funds === config.economy.startingFunds, "startingFunds");
    assert(g.staff.length === 0, "start with no staff");
    assert(g.year === config.calendar.startYear && g.month === config.calendar.startMonth, "calendar start");
    assert(g.company.scale === config.company.startingScale, "starting scale");
    assert(g.company.name === "测试社", "company name");
    assert(g.talentMarket.length === config.staff.talentMarket.refreshCount, "market size");
    ok("createNewGame reads startingFunds/calendar/scale from config");
  })();

  (function emptyNameUsesDefault() {
    const g = sim.createNewGame("  ", config);
    assert(g.company.name === config.company.defaultName, "default name");
    ok("empty name uses config.company.defaultName");
  })();

  (function isolatedConfigCopy() {
    const tweaked = deepClone(config);
    tweaked.economy.startingFunds = 12345;
    const g = sim.createNewGame("X", tweaked);
    assert(g.company.funds === 12345, "tweaked funds");
    const g2 = sim.createNewGame("Y", config);
    assert(g2.company.funds === config.economy.startingFunds, "original config unchanged");
    ok("createNewGame uses the passed config object, not a hidden CFG");
  })();

  (function tickAdvancesCalendar() {
    const g = sim.createNewGame("测", config);
    g.rngSeed = 4242;
    const r = sim.tickMonth(g, config);
    assert(r.state.month === g.month + 1 || (g.month === 12 && r.state.month === 1), "month advanced");
    assert(r.state.year === config.calendar.startYear, "still start year after Jan");
    assert(r.queue && r.queue.length >= 1, "queue present");
    assert(g.month === config.calendar.startMonth, "input state not mutated");
    ok("tickMonth advances calendar and returns new state");
  })();

  (function payrollDeducts() {
    const g = sim.createNewGame("测", config);
    g.rngSeed = 7;
    const hired = sim.hire(g, g.talentMarket[0].id, config);
    assert(hired.ok, "hire ok");
    const salary = hired.state.staff[0].salary;
    const before = hired.state.company.funds;
    const r = sim.tickMonth(hired.state, config);
    const note = r.queue[0].body;
    assert(note.indexOf("发薪 -" + salary) >= 0, "payroll note " + note);
    assert(r.state.company.funds <= before - salary + 5000, "not magically richer than salary+max event");
    ok("payroll deducts salary");
  })();

  (function seedReplay() {
    const g = sim.createNewGame("重放", config);
    g.rngSeed = 99991;
    g.rngCount = 0;
    const snap = JSON.stringify(g);
    const a = sim.tickMonth(JSON.parse(snap), config).state;
    const b = sim.tickMonth(JSON.parse(snap), config).state;
    assert(JSON.stringify(a) === JSON.stringify(b), "same seed same tick");
    ok("fixed seed: two tickMonth results match");
  })();

  (function firstMonthNoBankruptWithoutStaff() {
    const g = sim.createNewGame("空公司", config);
    g.rngSeed = 1;
    const r = sim.tickMonth(g, config);
    assert(r.state.phase !== "BANKRUPT", "first month should not bankrupt with no payroll");
    assert(r.state.company.funds > 0, "funds still positive");
    ok("first month without staff is not bankrupt");
  })();

  (function hireDoesNotMutate() {
    const g = sim.createNewGame("雇", config);
    const n = g.staff.length;
    const marketN = g.talentMarket.length;
    const bad = sim.hire(g, "missing", config);
    assert(!bad.ok && bad.error === sim.ERR.HIRE_NOT_FOUND, "missing candidate");
    assert(g.staff.length === n && g.talentMarket.length === marketN, "state unchanged on error");
    ok("failed hire does not mutate state");
  })();

  (function balanceSmoke() {
    let g = sim.createNewGame("冒烟", config);
    g.rngSeed = 202501;
    const months = 24;
    let bankrupt = false;
    for (let i = 0; i < months; i++) {
      const r = sim.tickMonth(g, config);
      g = r.state;
      if (g.phase === "BANKRUPT") {
        bankrupt = true;
        break;
      }
    }
    console.log("    smoke 24 months funds=" + g.company.funds + " phase=" + g.phase + " year=" + g.year + "." + g.month);
    assert(!bankrupt || g.year > config.calendar.startYear, "should not instantly bankrupt");
    ok("balance smoke: auto-tick 24 months from new game");
  })();

  (function fullRunSmoke() {
    let g = sim.createNewGame("十年", config);
    g.rngSeed = 2015;
    let ticks = 0;
    const cap = 140;
    while (g.phase === "PLAYING" && ticks < cap) {
      g = sim.tickMonth(g, config).state;
      ticks += 1;
    }
    console.log("    2015-2025 ticks=" + ticks + " phase=" + g.phase + " funds=" + g.company.funds);
    assert(g.phase === "SETTLED" || g.phase === "BANKRUPT", "run ends");
    ok("full-run smoke: 2015-2025 completes without throw");
  })();

  (function platformsAreThreeFamilies() {
    const g = sim.createNewGame("端", config);
    const plats = sim.platformsNow(g, config);
    const ids = plats.map(function (p) { return p.id; }).sort();
    assert(ids.join(",") === "console,mobile,pc", "ids " + ids.join(","));
    assert(plats.every(function (p) { return p.displayName !== "PS4" && p.id !== "ownConsole"; }), "no sku / ownConsole option");
    g.company.ownConsole = true;
    g.company.scale = "large";
    g.company.fans = config.company.unlockOwnConsoleMinFans;
    const still = sim.platformsNow(g, config).map(function (p) { return p.id; });
    assert(still.indexOf("ownConsole") < 0 && still.length === 3, "own console is not a fourth option");
    ok("pitch platforms are console/pc/mobile only");
  })();

  (function pitchRejectsLegacySku() {
    const g = hireOne(42);
    const snap = JSON.stringify(g);
    const bad = sim.pitchProject(g, pitchArgs(g, { platformId: "ps4" }), config);
    assert(!bad.ok && bad.error === sim.ERR.PITCH_PLATFORM, "ps4 rejected");
    assert(JSON.stringify(g) === snap, "failed pitch does not mutate");
    const okConsole = sim.pitchProject(g, pitchArgs(g, { platformId: "console", title: "主机作" }), config);
    assert(okConsole.ok, "console pitch ok");
    assert(okConsole.state.projects[0].platformId === "console", "stored console");
    ok("pitch only accepts console/pc/mobile");
  })();

  (function boxedCountsShareOutsourceDoesNot() {
    const g = hireOne(88);
    g.released = [{
      id: "r1",
      title: "自制",
      platformId: "pc",
      releaseType: "boxed",
      lifetimeSales: 1000,
      launchSales: 1000
    }, {
      id: "r2",
      title: "外包单",
      platformId: "pc",
      releaseType: "outsource",
      lifetimeSales: 5000,
      launchSales: 0,
      outsourceFee: 4000
    }];
    g.rivalLifetimeByPlatform = { console: 0, pc: 3000, mobile: 0 };
    const shares = sim.marketShares(g, config);
    const pc = shares.filter(function (s) { return s.id === "pc"; })[0];
    assert(pc.playerSales === 1000, "outsource not in share " + pc.playerSales);
    assert(Math.abs(pc.share - 1000 / 4000) < 1e-9, "share formula");
    const mobile = shares.filter(function (s) { return s.id === "mobile"; })[0];
    assert(mobile.playerSales === 0 && mobile.share === 0, "empty mobile");
    ok("boxed counts toward platform share; outsource does not");
  })();

  (function boxedReleaseAddsPlatformShare() {
    let g = hireOne(31415);
    const pitched = sim.pitchProject(g, pitchArgs(g, {
      title: "PC自制",
      platformId: "pc",
      releaseType: "boxed",
      cycle: "short"
    }), config);
    assert(pitched.ok, "boxed pitch");
    g = pitched.state;
    const months = sim.cycleMonths("short", config, "boxed");
    let lastQueue = [];
    let parked = null;
    for (let i = 0; i < months + 8; i++) {
      const r = sim.tickMonth(g, config);
      g = r.state;
      lastQueue = r.queue;
      parked = (g.readyToShip || []).filter(function (x) { return x.title === "PC自制"; })[0];
      if (parked) break;
    }
    const auto = g.released.filter(function (x) { return x.title === "PC自制"; })[0];
    assert(!auto, "boxed must not auto-release");
    assert(!g.released.length || g.released.every(function (x) { return x.title !== "PC自制"; }), "not in released");
    assert(parked, "parked in readyToShip");
    assert(g.staff[0].status === "idle", "team idle after complete");
    const hasMedia = lastQueue.some(function (q) { return q.type === "media"; });
    const hasReady = lastQueue.some(function (q) { return q.type === "ready"; });
    assert(!hasMedia, "complete queue is not media scores");
    assert(hasReady, "ready queue present");
    const snap = JSON.stringify(g);
    const missing = sim.releaseGame(g, "nope", config);
    assert(!missing.ok && missing.error === sim.ERR.RELEASE_NOT_FOUND, "missing release id");
    assert(JSON.stringify(g) === snap, "failed releaseGame does not mutate");
    const shipped = sim.releaseGame(g, parked.id, config);
    assert(shipped.ok, "releaseGame ok");
    g = shipped.state;
    const rec = g.released.filter(function (x) { return x.title === "PC自制"; })[0];
    assert(rec && rec.media && rec.media.rows && rec.media.rows.length >= 1, "boxed has media");
    assert(rec.lifetimeSales > 0, "boxed sales");
    assert(!(g.readyToShip || []).filter(function (x) { return x.id === parked.id; }).length, "removed from ready");
    const pc = sim.marketShares(g, config).filter(function (s) { return s.id === "pc"; })[0];
    assert(pc.playerSales === rec.lifetimeSales, "pc share uses boxed lifetimeSales " + pc.playerSales);
    ok("boxed tick release counts toward pc share");
  })();

  (function outsourceCompletesFeeExpNoMedia() {
    let g = hireOne(202609);
    const staff = g.staff[0];
    const exp0 = staff.exp || 0;
    const level0 = staff.level;
    const funds0 = g.company.funds;
    const pitched = sim.pitchOutsource(g, pitchArgs(g, {
      title: "外包A",
      platformId: "mobile",
      cycle: "short"
    }), config);
    assert(pitched.ok, "small studio can outsource");
    assert(g.projects.length === 0, "input unchanged");
    g = pitched.state;
    let lastQueue = [];
    const months = sim.cycleMonths("short", config, "outsource");
    let rec = null;
    for (let i = 0; i < months + 8; i++) {
      const r = sim.tickMonth(g, config);
      g = r.state;
      lastQueue = r.queue;
      rec = g.released.filter(function (x) { return x.title === "外包A"; })[0];
      if (rec) break;
    }
    assert(rec, "outsource released");
    assert(!(g.readyToShip || []).filter(function (x) { return x.title === "外包A"; }).length, "outsource skips readyToShip");
    assert(rec.releaseType === "outsource", "type");
    assert(!rec.media && !rec.mediaScores, "no media scores");
    assert(rec.avg === 0, "no avg");
    assert(rec.outsourceFee > 0, "fee paid");
    assert(g.company.funds !== funds0, "funds moved");
    assert(g.staff[0].status === "idle", "staff released");
    assert(g.staff[0].exp > exp0 || g.staff[0].level > level0, "exp or level changed");
    const hasMedia = lastQueue.some(function (q) { return q.type === "media"; });
    const hasOs = lastQueue.some(function (q) { return q.type === "outsource"; });
    assert(!hasMedia, "no media panel");
    assert(hasOs, "outsource queue");
    const body = lastQueue.filter(function (q) { return q.type === "outsource"; })[0].body;
    assert(body.indexOf("经验") >= 0 && body.indexOf(String(rec.outsourceFee)) >= 0, "queue copy " + body);
    const pcShare = sim.marketShares(g, config).filter(function (s) { return s.id === "mobile"; })[0];
    assert(pcShare.playerSales === 0, "outsource not in mobile share");
    ok("outsource complete: fee, exp, no mediaScores");
  })();

  (function outsourceCapAndReplay() {
    let g = hireOne(11);
    const first = sim.hire(g, g.talentMarket[0].id, config);
    assert(first.ok, "second hire");
    g = first.state;
    const a = sim.pitchOutsource(g, {
      title: "外包1",
      genreId: firstIds().genreId,
      gameplayId: firstIds().gameplayId,
      platformId: "console",
      cycle: "short",
      producerId: g.staff[0].id,
      memberIds: [g.staff[0].id]
    }, config);
    assert(a.ok, "first outsource");
    const snap = JSON.stringify(a.state);
    const b = sim.pitchOutsource(a.state, {
      title: "外包2",
      genreId: firstIds().genreId,
      gameplayId: firstIds().gameplayId,
      platformId: "pc",
      cycle: "short",
      producerId: a.state.staff[1].id,
      memberIds: [a.state.staff[1].id]
    }, config);
    assert(!b.ok && b.error === sim.ERR.PITCH_OUTSOURCE_CAP, "cap " + b.error);
    assert(JSON.stringify(a.state) === snap, "cap does not mutate");

    const g2 = hireOne(99991);
    g2.rngSeed = 99991;
    g2.rngCount = 0;
    const snap2 = JSON.stringify(g2);
    const t1 = sim.tickMonth(JSON.parse(snap2), config).state;
    const t2 = sim.tickMonth(JSON.parse(snap2), config).state;
    assert(JSON.stringify(t1) === JSON.stringify(t2), "seed replay after platform split");
    ok("outsource cap + fixed seed still replays");
  })();

  (function randomEventChangesFansFundsDev() {
    const tweaked = deepClone(config);
    tweaked.world.monthlyEventChance = 1;
    tweaked.world.events = [{
      id: "testNotice",
      source: "random",
      presentation: "notice",
      weight: 1,
      displayName: "测试通知",
      text: "测",
      fansDelta: 50,
      fundsDelta: -100,
      qualityDelta: 2
    }];
    tweaked.world.historicalEvents = [];
    let g = hireOne(77);
    const pitched = sim.pitchProject(g, pitchArgs(g, { title: "在研测", cycle: "long" }), tweaked);
    assert(pitched.ok, "pitch for event");
    g = pitched.state;
    const fans0 = g.company.fans;
    const funds0 = g.company.funds;
    const q0 = g.projects[0].stats.program + g.projects[0].stats.script + g.projects[0].stats.art + g.projects[0].stats.music;
    const left0 = g.projects[0].monthsLeft;
    const r = sim.tickMonth(g, tweaked);
    g = r.state;
    assert(g.company.fans === fans0 + 50, "fans delta");
    assert(g.company.funds === funds0 - 100 - g.staff[0].salary, "funds delta plus payroll");
    const q1 = g.projects[0].stats.program + g.projects[0].stats.script + g.projects[0].stats.art + g.projects[0].stats.music;
    assert(q1 >= q0 + 2, "quality went up by event plus monthly rolls");
    assert(g.projects[0].monthsLeft === left0 - 1, "dev month still decremented once");
    const ev = r.queue.filter(function (q) { return q.type === "event"; })[0];
    assert(ev && ev.presentation === "notice", "notice in queue");
    ok("random event can change fans/funds/in-dev");
  })();

  (function chickenDinnerChain2017() {
    let g = sim.createNewGame("吃鸡链", config);
    g.rngSeed = 201709;
    g.rngCount = 0;
    g.year = 2017;
    g.month = 9;
    g.firedEventIds = [];
    const sep = sim.tickMonth(g, config);
    g = sep.state;
    const hit = (g.rivalReleased || []).filter(function (x) { return x.title === "吃鸡" || x.series === "吃鸡"; })[0]
      || (g.rivalMonth || []).filter(function (x) { return x.title === "吃鸡" || x.series === "吃鸡"; })[0];
    assert(hit, "Sept 2017 ships 吃鸡");
    assert(hit.releasedYear === 2017 && hit.releasedMonth === 9, "released in Sept");
    assert(!(hit.mau > 0), "mau not yet exploded in Sept");
    const oct = sim.tickMonth(g, config);
    g = oct.state;
    const boom = sim.findRivalTitle(g, "吃鸡");
    assert(boom && boom.mau >= 18500000, "Oct high MAU " + (boom && boom.mau));
    const nov = sim.tickMonth(g, config);
    g = nov.state;
    assert(g.trend && g.trend.gameplayId === "battleRoyale", "Nov trend is battleRoyale");
    ok("chicken dinner chain 2017.9 release → 10 high MAU → 11 BR trend");
  })();

  (function choiceOptionsReplay() {
    const tweaked = deepClone(config);
    tweaked.world.monthlyEventChance = 1;
    tweaked.world.historicalEvents = [];
    tweaked.world.events = [{
      id: "crunchChoice",
      source: "random",
      presentation: "choice",
      weight: 1,
      displayName: "进度告急",
      text: "测",
      options: [
        { id: "crunch", label: "加钱赶工", fundsDelta: -2500, devMonthsDelta: -1 },
        { id: "onTime", label: "按期" },
        { id: "slack", label: "放任质量", qualityDelta: -4 }
      ]
    }];
    function setup() {
      let g = hireOne(424242);
      g.rngSeed = 424242;
      g.rngCount = 0;
      const pitched = sim.pitchProject(g, pitchArgs(g, { title: "抉择作", cycle: "long" }), tweaked);
      assert(pitched.ok, "pitch choice");
      return pitched.state;
    }
    const snap = JSON.stringify(setup());
    const t1 = sim.tickMonth(JSON.parse(snap), tweaked);
    const t2 = sim.tickMonth(JSON.parse(snap), tweaked);
    assert(JSON.stringify(t1.state) === JSON.stringify(t2.state), "choice tick replays before pick");
    const choicePage = t1.queue.filter(function (q) { return q.presentation === "choice"; })[0];
    assert(choicePage && choicePage.eventId === "crunchChoice", "choice queued not auto-applied");
    const fundsAfterTick = t1.state.company.funds;
    const leftAfterTick = t1.state.projects[0].monthsLeft;
    const a = sim.resolveEventChoice(t1.state, "crunchChoice", "crunch", tweaked);
    const b = sim.resolveEventChoice(t2.state, "crunchChoice", "crunch", tweaked);
    assert(a.ok && b.ok, "resolve ok");
    assert(JSON.stringify(a.state) === JSON.stringify(b.state), "same seed same choice");
    assert(a.state.company.funds === fundsAfterTick - 2500, "crunch spends funds");
    assert(a.state.projects[0].monthsLeft === leftAfterTick - 1, "crunch shortens cycle");
    const slack = sim.resolveEventChoice(t1.state, "crunchChoice", "slack", tweaked);
    assert(slack.ok, "slack ok");
    const qTick = t1.state.projects[0].stats.program + t1.state.projects[0].stats.script + t1.state.projects[0].stats.art + t1.state.projects[0].stats.music;
    const qSlack = slack.state.projects[0].stats.program + slack.state.projects[0].stats.script + slack.state.projects[0].stats.art + slack.state.projects[0].stats.music;
    assert(qSlack === qTick - 4, "slack drops quality");
    const bad = sim.resolveEventChoice(t1.state, "crunchChoice", "nope", tweaked);
    assert(!bad.ok && bad.error === sim.ERR.EVENT_OPTION_INVALID, "bad option");
    assert(JSON.stringify(t1.state) === JSON.stringify(t2.state), "failed choice does not mutate");
    ok("choice options change state and replay with same seed");
  })();

  (function rivalAdvanceShipsNextMonth() {
    const tweaked = deepClone(config);
    tweaked.world.monthlyEventChance = 0;
    tweaked.world.events = [];
    tweaked.world.historicalEvents = [{
      id: "testAdvance",
      source: "historical",
      presentation: "notice",
      year: 2015,
      month: 3,
      displayName: "竞品跳档",
      text: "测",
      rivalAdvance: { publisherId: "ea", seriesName: "战地" }
    }];
    let g = sim.createNewGame("跳档", tweaked);
    g.rngSeed = 33;
    g.rngCount = 0;
    g.year = 2015;
    g.month = 3;
    sim.ensureRivals(g, tweaked);
    g.rivalWait.ea = 8;
    const r1 = sim.tickMonth(g, tweaked);
    g = r1.state;
    assert(g.rivalWait.ea === 1, "event set wait to next month " + g.rivalWait.ea);
    const shippedNow = (r1.state.rivalMonth || []).some(function (x) { return x.series === "战地" && x.pubId === "ea"; });
    assert(!shippedNow, "does not ship in the event month");
    const r2 = sim.tickMonth(g, tweaked);
    const shipped = (r2.state.rivalMonth || []).filter(function (x) { return x.series === "战地"; })[0];
    assert(shipped, "next month EA ships 战地");
    ok("rival advance ships next month");
  })();

  (function rivalCalendarAtNewGame() {
    const g = sim.createNewGame("开局日历", config);
    assert(g.year === 2015 && g.month === 1, "starts 2015.01");
    const cal = sim.getRivalCalendar(g, 2015);
    assert(cal.year === 2015, "calendar year 2015");
    let m;
    for (m = 1; m <= 12; m++) {
      assert(Array.isArray(cal.months[m]), "month " + m + " exists");
    }
    ok("createNewGame has 2015 calendar structure");
  })();

  (function rivalCalendarNewYearFromDecember() {
    let g = sim.createNewGame("跨年日历", config);
    g.rngSeed = 201612;
    g.rngCount = 0;
    g.rivalCalendar = null;
    sim.refreshMarket(g, config, true);
    sim.ensureRivalCalendar(g, config);
    g.year = 2016;
    g.month = 12;
    g.phase = "PLAYING";
    const r = sim.tickMonth(g, config);
    g = r.state;
    assert(g.year === 2017 && g.month === 1, "Dec tick enters 2017.01");
    const cal = sim.getRivalCalendar(g, 2017);
    assert(cal.year === 2017, "2017 calendar exists");
    let m;
    for (m = 1; m <= 12; m++) {
      assert(Array.isArray(cal.months[m]), "2017 month " + m);
    }
    const chicken = (cal.months[9] || []).filter(function (p) {
      return p.status !== "moved" && (p.title === "吃鸡" || p.series === "吃鸡");
    })[0];
    assert(chicken, "2017.9 calendar has 吃鸡");
    assert(chicken.publisherId === "krafton" || /K/.test(chicken.publisher), "K 社 on calendar");
    ok("2016.12 tick builds 2017 calendar with 吃鸡 in Sept");
  })();

  (function rivalCalendarSameSeedReplay() {
    function runTo2017() {
      let g = sim.createNewGame("同种", config);
      g.rngSeed = 77701;
      g.rngCount = 0;
      g.rivalCalendar = null;
      sim.refreshMarket(g, config, true);
      sim.ensureRivalCalendar(g, config);
      g.year = 2016;
      g.month = 12;
      g.phase = "PLAYING";
      return sim.tickMonth(g, config).state;
    }
    const a = runTo2017();
    const b = runTo2017();
    assert(JSON.stringify(sim.getRivalCalendar(a, 2017)) === JSON.stringify(sim.getRivalCalendar(b, 2017)), "same seed same 2017 calendar");
    ok("same seed replay yields the same rival calendar");
  })();

  (function rivalAdvanceMovesCalendar() {
    const tweaked = deepClone(config);
    tweaked.world.monthlyEventChance = 0;
    tweaked.world.events = [];
    tweaked.world.historicalEvents = [{
      id: "testAdvanceCal",
      source: "historical",
      presentation: "notice",
      year: 2015,
      month: 3,
      displayName: "竞品跳档",
      text: "测",
      rivalAdvance: { publisherId: "ea", seriesName: "战地" }
    }];
    let g = sim.createNewGame("日历跳档", tweaked);
    g.rngSeed = 33;
    g.rngCount = 0;
    g.rivalCalendar = null;
    sim.refreshMarket(g, tweaked, true);
    sim.ensureRivalCalendar(g, tweaked);
    g.year = 2015;
    g.month = 3;
    g.rivalWait.ea = 8;
    const before = sim.getRivalCalendar(g, 2015);
    const marchBefore = (before.months[3] || []).some(function (p) {
      return p.series === "战地" && p.status === "planned";
    });
    const r1 = sim.tickMonth(g, tweaked);
    g = r1.state;
    const after = sim.getRivalCalendar(g, 2015);
    const april = (after.months[4] || []).filter(function (p) {
      return (p.series === "战地" || p.title === "战地") && p.status === "planned";
    })[0];
    assert(april, "calendar has 战地 in next month");
    if (marchBefore) {
      const moved = (after.months[3] || []).some(function (p) {
        return p.series === "战地" && p.status === "moved";
      });
      assert(moved, "original March slot marked moved");
    }
    const shippedNow = (r1.state.rivalMonth || []).some(function (x) { return x.series === "战地" && x.pubId === "ea"; });
    assert(!shippedNow, "does not ship in the event month");
    const r2 = sim.tickMonth(g, tweaked);
    const shipped = (r2.state.rivalMonth || []).filter(function (x) { return x.series === "战地"; })[0];
    assert(shipped, "next month EA ships 战地 from calendar");
    ok("rival advance reschedules calendar to next month");
  })();

  (function salesFactorMonth1IsBase() {
    const y = sim.salesFactor(1, 10, config);
    assert(Math.abs(y - 1) < 0.02, "Y(1,10)≈1 got " + y);
    const yNoScore = sim.salesFactor(2, null, config);
    assert(yNoScore === 0, "no score is not treated as 10");
    ok("salesFactor(1,10)≈1 and missing score is not 10");
  })();

  (function salesFactorFollowsLogisticFormula() {
    const lc = config.lifecycle;
    function expected(m, S) {
      const u = (S - lc.scoreMin) / (lc.scoreMax - lc.scoreMin);
      const T = lc.tMin + u * lc.tSpan;
      const x0 = lc.x0Min + u * lc.x0Span;
      const x = m - 1;
      return T + (1 - T) / (1 + Math.exp(lc.k * (x - x0)));
    }
    const table10 = [1.00, 0.97, 0.93, 0.87, 0.80, 0.71, 0.62, 0.57, 0.52, 0.48, 0.45, 0.43];
    let m;
    for (m = 1; m <= lc.maxMonths; m++) {
      const y = sim.salesFactor(m, 10, config);
      const exp = expected(m, 10);
      assert(Math.abs(y - exp) < 1e-9, "formula m=" + m + " " + y);
      const tab = table10[m - 1];
      const rel = Math.abs(y - tab) / tab;
      assert(rel < 0.25, "table对照 m=" + m + " y=" + y + " tab=" + tab + " rel=" + rel);
    }
    assert(sim.salesFactor(lc.maxMonths + 1, 10, config) === 0, "past maxMonths");
    ok("salesFactor matches logistic from lifecycle config");
  })();

  (function dropOffReadsConfigNotHardcoded() {
    function lastOnSale(cfg, score) {
      let last = 0;
      let m;
      for (m = 1; m <= cfg.lifecycle.maxMonths; m++) {
        const y = sim.salesFactor(m, score, cfg);
        if (y < cfg.lifecycle.dropOffY) break;
        last = m;
      }
      return last;
    }
    const y7 = sim.salesFactor(7, 6, config);
    const y8 = sim.salesFactor(8, 6, config);
    const tweaked = deepClone(config);
    tweaked.lifecycle.dropOffY = (y7 + y8) / 2;
    const defLast = lastOnSale(config, 6);
    const twLast = lastOnSale(tweaked, 6);
    assert(twLast === 7, "S=6 stops after month 7 when dropOffY is between Y(7) and Y(8); last=" + twLast + " y7=" + y7 + " y8=" + y8);
    assert(defLast !== twLast, "changing dropOffY changes stop month " + defLast + " vs " + twLast);
    if (y8 < config.lifecycle.dropOffY) {
      assert(defLast === 7, "default dropOffY stops S=6 at month 7");
    }
    ok("drop-off month follows lifecycle.dropOffY from config");
  })();

  (function boxedMonth2AddsLaunchTimesY2() {
    const tweaked = deepClone(config);
    tweaked.world.monthlyEventChance = 0;
    tweaked.world.historicalEvents = [];
    let g = sim.createNewGame("曲线", tweaked);
    g.rngSeed = 91;
    g.rngCount = 0;
    g.year = 2015;
    g.month = 2;
    g.released = [{
      id: "r-box",
      title: "测发售",
      genreId: tweaked.content.genres[0].id,
      gameplayId: tweaked.content.gameplay[0].id,
      platformId: "pc",
      releaseType: "boxed",
      releasedYear: 2015,
      releasedMonth: 1,
      avg: 10,
      launchSales: 10000,
      baselineSales: 10000,
      lifetimeSales: 10000,
      onSale: true,
      stats: { program: 10, script: 10, art: 10, music: 10 }
    }];
    const funds0 = g.company.funds;
    const y2 = sim.salesFactor(2, 10, tweaked);
    const expectAmt = Math.round(10000 * y2);
    const r = sim.tickMonth(g, tweaked);
    const rec = r.state.released[0];
    assert(rec.lifetimeSales === 10000 + expectAmt, "lifetime " + rec.lifetimeSales);
    assert(r.state.company.funds === funds0 + expectAmt, "funds " + r.state.company.funds + " expected " + (funds0 + expectAmt));
    assert(rec.onSale !== false, "still on sale at m=2");
    ok("month 2 funds increase by baselineSales*Y(2)");
  })();

  (function boxedLaunchMonthDoesNotDoubleCount() {
    const tweaked = deepClone(config);
    tweaked.world.monthlyEventChance = 0;
    tweaked.world.historicalEvents = [];
    let g = sim.createNewGame("当月", tweaked);
    g.rngSeed = 5;
    g.rngCount = 0;
    g.released = [{
      id: "r-now",
      title: "当月发",
      platformId: "pc",
      releaseType: "boxed",
      releasedYear: g.year,
      releasedMonth: g.month,
      avg: 10,
      launchSales: 8000,
      lifetimeSales: 8000,
      onSale: true,
      stats: { program: 8, script: 8, art: 8, music: 8 }
    }];
    const funds0 = g.company.funds;
    const r = sim.tickMonth(g, tweaked);
    assert(r.state.released[0].lifetimeSales === 8000, "no extra Y on launch month");
    assert(r.state.company.funds === funds0, "funds unchanged besides payroll=0");
    ok("launch month does not multiply Y again");
  })();

  (function oldTailFieldsMigrate() {
    const tweaked = deepClone(config);
    tweaked.world.monthlyEventChance = 0;
    tweaked.world.historicalEvents = [];
    let g = sim.createNewGame("旧档", tweaked);
    g.rngSeed = 3;
    g.rngCount = 0;
    g.year = 2015;
    g.month = 3;
    g.released = [{
      id: "r-old",
      title: "旧尾",
      platformId: "pc",
      releaseType: "boxed",
      releasedYear: 2015,
      releasedMonth: 1,
      avg: 10,
      launchSales: 5000,
      lifetimeSales: 5000,
      tailLeft: 9,
      tail0: 5000
    }];
    const y3 = sim.salesFactor(3, 10, tweaked);
    const r = sim.tickMonth(g, tweaked);
    const rec = r.state.released[0];
    assert(rec.lifetimeSales === 5000 + Math.round(5000 * y3), "migrated to formula " + rec.lifetimeSales);
    assert(rec.onSale === true || rec.onSale === false, "onSale set");
    ok("old tailLeft/tail0 migrate without crashing");
  })();

  (function liveopsAndOutsourceSkipBoxedCurve() {
    const st = sim.createNewGame("跳过", config);
    st.year = 2015;
    st.month = 4;
    const live = {
      id: "lo",
      title: "长线作",
      releaseType: "liveops",
      releasedYear: 2015,
      releasedMonth: 1,
      avg: 1,
      launchSales: 9000,
      lifetimeSales: 9000,
      liveOps: { active: true, maintainerIds: [], monthsLive: 2, peak: 0 }
    };
    const os = {
      id: "os",
      title: "外包作",
      releaseType: "outsource",
      releasedYear: 2015,
      releasedMonth: 1,
      avg: 0,
      launchSales: 0,
      lifetimeSales: 0
    };
    const funds0 = st.company.funds;
    assert(sim.tickLifecycle(st, live, config) === 0, "liveops no boxed Y");
    assert(live.liveOps.active, "liveops not closed by drop-off");
    assert(sim.tickLifecycle(st, os, config) === 0, "outsource no curve");
    assert(st.company.funds === funds0, "no boxed funds");
    ok("liveops and outsource skip boxed lifecycle");
  })();

  (function monthlyChartUsesConfigSizeAndOnSale() {
    const tweaked = deepClone(config);
    tweaked.lifecycle.chartSize = 3;
    const g = sim.createNewGame("榜", tweaked);
    g.released = [1, 2, 3, 4].map(function (n) {
      return {
        id: "p" + n,
        title: "我方" + n,
        platformId: "pc",
        releaseType: "boxed",
        releasedYear: g.year,
        releasedMonth: g.month,
        avg: 10,
        launchSales: 1000 * n,
        lifetimeSales: 1000 * n,
        onSale: true
      };
    });
    g.rivalReleased = [{
      id: "rv",
      title: "对手作",
      pub: "N 社",
      platformId: "pc",
      avg: 9,
      launchSales: 50000,
      sales: 50000,
      releasedYear: g.year,
      releasedMonth: g.month,
      onSale: true
    }];
    const chart = sim.monthlyChart(g, tweaked);
    assert(chart.length === 3, "chartSize from config " + chart.length);
    assert(chart[0].rank === 1 && chart[0].monthSales >= chart[1].monthSales, "sorted by month sales");
    assert(chart[0].title === "对手作", "rival on sale included " + chart[0].title);
    g.released[3].onSale = false;
    const dropped = sim.monthlyChart(g, tweaked).some(function (row) { return row.title === "我方4"; });
    assert(!dropped, "dropped title leaves on-sale list");
    ok("monthlyChart respects chartSize and onSale");
  })();

  (function delayedReleaseStartsAtPublishMonth() {
    const tweaked = deepClone(config);
    tweaked.world.monthlyEventChance = 0;
    tweaked.world.historicalEvents = [];
    let g = hireOne(5150);
    const pitched = sim.pitchProject(g, pitchArgs(g, {
      title: "缓发作",
      platformId: "pc",
      releaseType: "boxed",
      cycle: "short"
    }), tweaked);
    g = pitched.state;
    const months = sim.cycleMonths("short", tweaked, "boxed");
    let parked = null;
    let i;
    for (i = 0; i < months + 8; i++) {
      const r = sim.tickMonth(g, tweaked);
      g = r.state;
      parked = (g.readyToShip || []).filter(function (x) { return x.title === "缓发作"; })[0];
      if (parked) break;
    }
    assert(parked, "parked");
    g = sim.tickMonth(g, tweaked).state;
    g = sim.tickMonth(g, tweaked).state;
    assert((g.readyToShip || []).some(function (x) { return x.title === "缓发作"; }), "still waiting");
    const shipped = sim.releaseGame(g, parked.id, tweaked);
    assert(shipped.ok, "publish after delay");
    g = shipped.state;
    const rec = g.released.filter(function (x) { return x.title === "缓发作"; })[0];
    assert(rec.releasedYear === g.year && rec.releasedMonth === g.month, "m=1 is publish month");
    const expectedBase = sim.boxedBaselineFormula(g, {
      stats: rec.stats,
      genreId: rec.genreId,
      gameplayId: rec.gameplayId,
      platformId: rec.platformId,
      seriesId: null
    }, tweaked, false);
    assert(rec.baselineSales === expectedBase, "baseline equals formula " + rec.baselineSales + " vs " + expectedBase);
    assert(rec.launchSales > 0 && rec.lifetimeSales === rec.launchSales, "launch is actual month 1");
    const launch = rec.launchSales;
    const baseline = rec.baselineSales;
    const y2 = sim.salesFactor(2, rec.avg, tweaked);
    const after1 = sim.tickMonth(g, tweaked);
    assert(after1.state.released.filter(function (x) { return x.title === "缓发作"; })[0].lifetimeSales === launch, "first tick after publish is still m=1");
    g = after1.state;
    const salary = g.staff[0].salary;
    const funds0 = g.company.funds;
    const after2 = sim.tickMonth(g, tweaked);
    const rec2 = after2.state.released.filter(function (x) { return x.title === "缓发作"; })[0];
    assert(rec2.lifetimeSales === launch + Math.round(baseline * y2), "second tick uses baseline*Y(2) " + rec2.lifetimeSales);
    assert(after2.state.company.funds === funds0 + Math.round(baseline * y2) - salary, "funds +Y2 -payroll");
    ok("delayed publish: m=1 is the month the player clicks release");
  })();

  (function smashedMonth1DoesNotRewriteBaseline() {
    const tweaked = deepClone(config);
    tweaked.world.monthlyEventChance = 0;
    tweaked.world.historicalEvents = [];
    let g = sim.createNewGame("砸月", tweaked);
    g.rngSeed = 11;
    g.rngCount = 0;
    g.year = 2015;
    g.month = 2;
    g.released = [{
      id: "r-smash",
      title: "被砸作",
      platformId: "pc",
      releaseType: "boxed",
      releasedYear: 2015,
      releasedMonth: 1,
      avg: 10,
      baselineSales: 10000,
      launchSales: 12,
      lifetimeSales: 12,
      monthSales: 12,
      onSale: true,
      stats: { program: 10, script: 10, art: 10, music: 10 }
    }];
    const y2 = sim.salesFactor(2, 10, tweaked);
    const funds0 = g.company.funds;
    const r = sim.tickMonth(g, tweaked);
    const rec = r.state.released[0];
    assert(rec.baselineSales === 10000, "baseline stays");
    assert(rec.lifetimeSales === 12 + Math.round(10000 * y2), "month 2 uses baseline not smashed launch");
    assert(r.state.company.funds === funds0 + Math.round(10000 * y2), "funds from baseline*Y2");
    assert(rec.onSale !== false, "Y drop-off not actual/baseline");
    ok("smashed month-1 actual does not rewrite baseline or collapse month 2");
  })();

  (function monthSalesEventDoesNotChangeBaseline() {
    const tweaked = deepClone(config);
    tweaked.world.monthlyEventChance = 0;
    tweaked.world.events = [];
    tweaked.world.historicalEvents = [{
      id: "channelOutage",
      source: "historical",
      presentation: "notice",
      year: 2015,
      month: 2,
      displayName: "渠道故障",
      text: "只砸本月实销，基准不变",
      monthSalesMult: 0.4,
      salesTarget: "playerOnSale"
    }];
    let g = sim.createNewGame("渠道", tweaked);
    g.rngSeed = 21;
    g.rngCount = 0;
    g.year = 2015;
    g.month = 2;
    g.released = [{
      id: "r-ch",
      title: "渠道作",
      platformId: "pc",
      releaseType: "boxed",
      releasedYear: 2015,
      releasedMonth: 1,
      avg: 10,
      baselineSales: 10000,
      launchSales: 10000,
      lifetimeSales: 10000,
      monthSales: 10000,
      onSale: true,
      stats: { program: 10, script: 10, art: 10, music: 10 }
    }];
    const y2 = sim.salesFactor(2, 10, tweaked);
    const y3 = sim.salesFactor(3, 10, tweaked);
    const smashed = Math.round(10000 * y2 * 0.4);
    const r1 = sim.tickMonth(g, tweaked);
    const rec1 = r1.state.released[0];
    assert(rec1.baselineSales === 10000, "baseline unchanged by monthSalesMult");
    assert(rec1.monthSales === smashed, "month 2 actual smashed " + rec1.monthSales);
    assert(rec1.lifetimeSales === 10000 + smashed, "lifetime +smashed");
    g = r1.state;
    const funds1 = g.company.funds;
    const r2 = sim.tickMonth(g, tweaked);
    const rec2 = r2.state.released[0];
    assert(rec2.baselineSales === 10000, "baseline still original");
    assert(rec2.monthSales === Math.round(10000 * y3), "month 3 uses original baseline*Y3");
    assert(r2.state.company.funds === funds1 + Math.round(10000 * y3), "funds +baseline*Y3");
    ok("monthSalesMult smashes actual only; next month uses original baseline");
  })();

  (function baselineEventRewritesLaterMonths() {
    const tweaked = deepClone(config);
    tweaked.world.monthlyEventChance = 0;
    tweaked.world.events = [];
    tweaked.world.historicalEvents = [{
      id: "wordOfMouthCrash",
      source: "historical",
      presentation: "notice",
      year: 2015,
      month: 2,
      displayName: "口碑反噬",
      text: "改写基准，之后每月都按新基准",
      baselineSalesMult: 0.65,
      salesTarget: "playerOnSale"
    }];
    let g = sim.createNewGame("口碑", tweaked);
    g.rngSeed = 22;
    g.rngCount = 0;
    g.year = 2015;
    g.month = 2;
    g.released = [{
      id: "r-base",
      title: "口碑作",
      platformId: "pc",
      releaseType: "boxed",
      releasedYear: 2015,
      releasedMonth: 1,
      avg: 10,
      baselineSales: 10000,
      launchSales: 10000,
      lifetimeSales: 10000,
      monthSales: 10000,
      onSale: true,
      stats: { program: 10, script: 10, art: 10, music: 10 }
    }];
    const newBase = Math.round(10000 * 0.65);
    const y2 = sim.salesFactor(2, 10, tweaked);
    const y3 = sim.salesFactor(3, 10, tweaked);
    const r1 = sim.tickMonth(g, tweaked);
    const rec1 = r1.state.released[0];
    assert(rec1.baselineSales === newBase, "baseline rewritten " + rec1.baselineSales);
    assert(rec1.monthSales === Math.round(newBase * y2), "month 2 uses new baseline");
    g = r1.state;
    const funds1 = g.company.funds;
    const r2 = sim.tickMonth(g, tweaked);
    const rec2 = r2.state.released[0];
    assert(rec2.baselineSales === newBase, "baseline sticks");
    assert(rec2.monthSales === Math.round(newBase * y3), "month 3 uses new baseline*Y3");
    assert(r2.state.company.funds === funds1 + Math.round(newBase * y3), "funds follow new baseline");
    ok("baselineSalesMult rewrites later months");
  })();

  (function dropOffIgnoresSmashedActual() {
    const tweaked = deepClone(config);
    tweaked.world.monthlyEventChance = 0;
    tweaked.world.historicalEvents = [];
    const y1 = sim.salesFactor(1, 10, tweaked);
    assert(y1 >= tweaked.lifecycle.dropOffY, "Y(1) above dropOff");
    let g = sim.createNewGame("掉榜", tweaked);
    g.year = 2015;
    g.month = 1;
    g.released = [{
      id: "r-drop",
      title: "低实销",
      platformId: "pc",
      releaseType: "boxed",
      releasedYear: 2015,
      releasedMonth: 1,
      avg: 10,
      baselineSales: 10000,
      launchSales: 1,
      lifetimeSales: 1,
      monthSales: 1,
      onSale: true,
      stats: { program: 10, script: 10, art: 10, music: 10 }
    }];
    const r = sim.tickMonth(g, tweaked);
    const rec = r.state.released[0];
    assert(rec.onSale !== false, "tiny actual does not drop off while Y is high");
    assert(rec.baselineSales === 10000, "baseline intact");
    ok("drop-off still uses Y(m) vs dropOffY");
  })();

  (function choiceMonthSalesOptionRestikes() {
    const tweaked = deepClone(config);
    tweaked.world.monthlyEventChance = 0;
    tweaked.world.historicalEvents = [];
    let g = sim.createNewGame("抉择砸", tweaked);
    g.rngSeed = 7;
    g.rngCount = 0;
    g.released = [{
      id: "r-opt",
      title: "抉择作",
      platformId: "pc",
      releaseType: "boxed",
      releasedYear: g.year,
      releasedMonth: g.month,
      avg: 10,
      baselineSales: 8000,
      launchSales: 8000,
      lifetimeSales: 8000,
      monthSales: 8000,
      onSale: true,
      stats: { program: 8, script: 8, art: 8, music: 8 }
    }];
    const funds0 = g.company.funds;
    const resolved = sim.resolveEventChoice(g, "crunchChoice", "dumpStock", tweaked);
    assert(resolved.ok, "dumpStock option ok");
    const rec = resolved.state.released[0];
    assert(rec.baselineSales === 8000, "choice does not rewrite baseline");
    assert(rec.monthSales === 4000 && rec.launchSales === 4000, "month actual halved");
    assert(resolved.state.company.funds === funds0 - 4000, "funds follow smashed actual");
    ok("choice dumpStock smashes booked month sales only");
  })();

  console.log("\n" + passed + " tests passed");
}

try {
  main();
} catch (e) {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
}
