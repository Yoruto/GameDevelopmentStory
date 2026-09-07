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
  "career.js",
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
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const careerPath = path.join(ROOT, "activity", "career-world.json");
  if (fs.existsSync(careerPath)) {
    config.careerWorld = JSON.parse(fs.readFileSync(careerPath, "utf8"));
  }
  return config;
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

  function quietWorld(cfg) {
    cfg.world.monthlyEventChance = 0;
    cfg.world.historicalEvents = [];
    cfg.world.events = [];
  }

  function fillerLadder(n, sales) {
    const list = [];
    let i;
    for (i = 1; i <= n; i++) {
      list.push({
        id: "f" + i,
        title: "假作" + i,
        pub: "市场",
        monthSales: sales
      });
    }
    return list;
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

  (function chartPadsToConfigSizeWithFillers() {
    assert(config.lifecycle.chartSize === 30, "chartSize in config is 30");
    assert((config.lifecycle.chartFillers || []).length >= 30, "at least 30 filler titles");
    const g = sim.createNewGame("假作填榜", config);
    const chart = sim.monthlyChart(g, config);
    assert(chart.length === config.lifecycle.chartSize, "open chart length " + chart.length);
    const fillers = chart.filter(function (row) { return row.source === "filler"; });
    assert(fillers.length === chart.length, "open chart is all fillers " + fillers.length);
    assert(chart.every(function (row, i) { return row.rank === i + 1; }), "ranks 1..N");
    ok("chartSize 30 pads with config fillers");
  })();

  (function boxedDropsAfterFallingOffChart() {
    const tweaked = deepClone(config);
    quietWorld(tweaked);
    tweaked.lifecycle.chartSize = 30;
    tweaked.lifecycle.chartFillers = fillerLadder(30, 50000);
    let g = sim.createNewGame("掉榜盒装", tweaked);
    g.rngSeed = 19;
    g.rngCount = 0;
    g.year = 2015;
    g.month = 2;
    g.released = [{
      id: "r-off",
      title: "挤不上去",
      platformId: "pc",
      releaseType: "boxed",
      releasedYear: 2015,
      releasedMonth: 1,
      avg: 10,
      baselineSales: 80,
      launchSales: 80,
      lifetimeSales: 80,
      monthSales: 80,
      onSale: true,
      stats: { program: 2, script: 2, art: 2, music: 2 }
    }];
    const pre = sim.monthlyChart(g, tweaked);
    assert(pre.length === 30, "full chart before tick");
    assert(!pre.some(function (row) { return row.title === "挤不上去"; }), "31st not on chart");
    const funds0 = g.company.funds;
    const r = sim.tickMonth(g, tweaked);
    const rec = r.state.released[0];
    const y2 = sim.salesFactor(2, 10, tweaked);
    const monthAmt = Math.round(80 * y2);
    assert(rec.lifetimeSales === 80 + monthAmt, "this month still books then drops");
    assert(r.state.company.funds === funds0 + monthAmt, "funds from this month");
    assert(rec.onSale === false, "boxed off sale after settle");
    const body = (r.queue[0] && r.queue[0].body) || "";
    assert(body.indexOf("掉出畅销榜，停止发售") >= 0, "drop note " + body);
    const life = rec.lifetimeSales;
    const r2 = sim.tickMonth(r.state, tweaked);
    assert(r2.state.released[0].onSale === false, "stays off sale");
    assert(r2.state.released[0].lifetimeSales === life, "no further boxed sales");
    ok("boxed falling off chart stops after that month's settle");
  })();

  (function liveopsDropsOffChartShutsDown() {
    const tweaked = deepClone(config);
    quietWorld(tweaked);
    tweaked.lifecycle.chartSize = 30;
    tweaked.lifecycle.chartFillers = fillerLadder(30, 80000);
    let g = hireOne(88);
    g.rngSeed = 88;
    g.rngCount = 0;
    g.company.scale = "medium";
    const sid = g.staff[0].id;
    g.staff[0].status = "liveops";
    g.staff[0].assignmentId = "lo-off";
    g.released = [{
      id: "lo-off",
      title: "长线掉榜",
      platformId: "pc",
      releaseType: "liveops",
      releasedYear: g.year,
      releasedMonth: g.month,
      avg: 6,
      stats: { program: 4, script: 4, art: 4, music: 4 },
      liveOps: { active: true, maintainerIds: [sid], monthsLive: 1, peak: 0 }
    }];
    const r = sim.tickMonth(g, tweaked);
    const rec = r.state.released[0];
    assert(rec.liveOps.active === false, "liveops inactive like shutdownLiveOps");
    assert((rec.liveOps.maintainerIds || []).length === 0, "maintainers cleared");
    assert(r.state.staff[0].status === "idle", "staff released");
    const body = (r.queue[0] && r.queue[0].body) || "";
    assert(body.indexOf("掉出畅销榜，停止运营") >= 0, "liveops drop note " + body);
    ok("liveops falling off chart shuts down");
  })();

  (function launchMonthCanChart() {
    const tweaked = deepClone(config);
    quietWorld(tweaked);
    let g = sim.createNewGame("当月榜", tweaked);
    g.rngSeed = 4;
    g.rngCount = 0;
    g.released = [{
      id: "r-launch-chart",
      title: "当月上榜",
      platformId: "pc",
      releaseType: "boxed",
      releasedYear: g.year,
      releasedMonth: g.month,
      avg: 10,
      baselineSales: 99999,
      launchSales: 99999,
      lifetimeSales: 99999,
      monthSales: 99999,
      monthSalesForYear: g.year,
      monthSalesForMonth: g.month,
      onSale: true,
      stats: { program: 10, script: 10, art: 10, music: 10 }
    }];
    const before = sim.monthlyChart(g, tweaked);
    const hit = before.filter(function (row) { return row.title === "当月上榜"; })[0];
    assert(hit && hit.rank >= 1, "launch month books onto chart before next tick");
    const r = sim.tickMonth(g, tweaked);
    const still = (r.state.monthChart || []).filter(function (row) { return row.title === "当月上榜"; })[0];
    assert(still, "launch month still on snapshot after tick");
    assert(r.state.released[0].onSale !== false, "stays on sale after launch-month tick");
    assert(r.state.released[0].lifetimeSales === 99999, "launch month tick does not double-count");
    ok("launch month can chart from booked sales");
  })();

  (function chartSizeNotHardcodedThirty() {
    const tweaked = deepClone(config);
    quietWorld(tweaked);
    tweaked.lifecycle.chartSize = 5;
    tweaked.lifecycle.chartFillers = fillerLadder(8, 4000);
    const g0 = sim.createNewGame("五席", tweaked);
    const open = sim.monthlyChart(g0, tweaked);
    assert(open.length === 5, "chart length follows chartSize=5 got " + open.length);
    let g = sim.createNewGame("五席掉", tweaked);
    g.rngSeed = 6;
    g.rngCount = 0;
    g.year = 2015;
    g.month = 2;
    g.released = [{
      id: "r-five",
      title: "掉出五席",
      platformId: "pc",
      releaseType: "boxed",
      releasedYear: 2015,
      releasedMonth: 1,
      avg: 10,
      baselineSales: 10,
      launchSales: 10,
      lifetimeSales: 10,
      monthSales: 10,
      onSale: true,
      stats: { program: 1, script: 1, art: 1, music: 1 }
    }];
    const r = sim.tickMonth(g, tweaked);
    assert(r.state.monthChart.length === 5, "tick snapshot size 5");
    assert(r.state.released[0].onSale === false, "drop off 5 stops sale");
    let g2 = sim.createNewGame("五席留", tweaked);
    g2.rngSeed = 6;
    g2.rngCount = 0;
    g2.released = [{
      id: "r-keep",
      title: "留在五席",
      platformId: "pc",
      releaseType: "boxed",
      releasedYear: g2.year,
      releasedMonth: g2.month,
      avg: 10,
      baselineSales: 90000,
      launchSales: 90000,
      lifetimeSales: 90000,
      monthSales: 90000,
      monthSalesForYear: g2.year,
      monthSalesForMonth: g2.month,
      onSale: true,
      stats: { program: 10, script: 10, art: 10, music: 10 }
    }];
    const keep = sim.tickMonth(g2, tweaked);
    assert(keep.state.released[0].onSale !== false, "high sales stay inside chartSize 5");
    ok("chartSize from config is not hardcoded 30");
  })();

  (function inChartIgnoresDropOffY() {
    const tweaked = deepClone(config);
    quietWorld(tweaked);
    tweaked.lifecycle.chartSize = 5;
    tweaked.lifecycle.chartFillers = fillerLadder(5, 40);
    const y8 = sim.salesFactor(8, 6, tweaked);
    tweaked.lifecycle.dropOffY = y8 + 0.05;
    assert(y8 < tweaked.lifecycle.dropOffY, "Y(8,6) below raised dropOffY");
    let g = sim.createNewGame("榜内不杀", tweaked);
    g.rngSeed = 3;
    g.rngCount = 0;
    g.year = 2015;
    g.month = 8;
    g.released = [{
      id: "r-stay",
      title: "榜内续卖",
      platformId: "pc",
      releaseType: "boxed",
      releasedYear: 2015,
      releasedMonth: 1,
      avg: 6,
      baselineSales: 20000,
      launchSales: 20000,
      lifetimeSales: 20000,
      monthSales: 20000,
      onSale: true,
      stats: { program: 8, script: 8, art: 8, music: 8 }
    }];
    const r = sim.tickMonth(g, tweaked);
    assert(r.state.released[0].onSale !== false, "in-chart title not killed by Y");
    assert(r.state.released[0].monthSales === Math.round(20000 * y8), "still sold at Y(8)");
    ok("dropOffY does not stop in-chart boxed games");
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
    assert(rec.onSale === false, "rank below fillers stops sale even if Y is high");
    assert(rec.baselineSales === 10000, "baseline intact");
    ok("off-chart boxed stops after settle; baseline intact");
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

  (function traitPoolDrawsVariety() {
    const ids = sim.traitIds(config);
    assert(ids.length >= 6 && ids.length <= 8, "6-8 traits, got " + ids.length);
    assert(ids.indexOf("sparkOfInspiration") >= 0 && ids.indexOf("meticulous") >= 0, "legacy traits remain");
    const seen = {};
    const g = sim.createNewGame("特性池", config);
    g.rngSeed = 424242;
    g.rngCount = 0;
    let i;
    for (i = 0; i < 80; i++) {
      sim.refreshMarket(g, config, true);
      (g.talentMarket || []).forEach(function (c) {
        assert((c.traits || []).length <= (config.staff.talentMarket.maxTraits || 2), "max 2 traits");
        (c.traits || []).forEach(function (id) {
          assert(ids.indexOf(id) >= 0, "unknown trait " + id);
          seen[id] = true;
        });
      });
    }
    assert(Object.keys(seen).length >= 5, "variety " + Object.keys(seen).join(","));
    ok("trait pool is 6-8 and hire draw stays 0-2");
  })();

  (function thriftyCutsSalary() {
    const s = { level: 2, program: 10, script: 10, art: 10, music: 10, honor: 0, traits: [] };
    const full = sim.calcSalary(s, config);
    s.traits = ["thrifty"];
    const cheap = sim.calcSalary(s, config);
    assert(cheap < full, "thrifty cheaper " + cheap + " vs " + full);
    assert(cheap === Math.round(full * config.traits.thrifty.salaryMult), "salaryMult applied");
    ok("thrifty multiplies salary from config");
  })();

  (function crowdMagnetAddsFansOnRelease() {
    const tweaked = deepClone(config);
    tweaked.world.monthlyEventChance = 0;
    tweaked.world.historicalEvents = [];
    let g = hireOne(11);
    g.staff[0].traits = ["crowdMagnet"];
    const pitched = sim.pitchProject(g, pitchArgs(g, { title: "人气作", cycle: "short" }), tweaked);
    assert(pitched.ok, "pitch crowdMagnet");
    g = pitched.state;
    let ticks = 0;
    while (g.phase === "PLAYING" && !(g.readyToShip && g.readyToShip.length) && ticks < 12) {
      g = sim.tickMonth(g, tweaked).state;
      ticks += 1;
    }
    assert(g.readyToShip && g.readyToShip.length, "ready to ship");
    const fans0 = g.company.fans;
    const rel = sim.releaseGame(g, g.readyToShip[0].id, tweaked);
    assert(rel.ok, "release ok");
    const expect = config.traits.crowdMagnet.producerFansOnRelease;
    assert(rel.state.company.fans >= fans0 + expect, "fans from crowdMagnet");
    ok("crowdMagnet adds fans on real release");
  })();

  (function liveOpsAceRaisesRevenue() {
    const g = hireOne(12);
    g.staff[0].traits = ["liveOpsAce"];
    const fake = {
      stats: { program: 10, script: 10, art: 10, music: 10 },
      liveOps: { active: true, maintainerIds: [g.staff[0].id] }
    };
    const withAce = sim.liveOpsRevenue(fake, config, g);
    const none = deepClone(g);
    none.staff[0].traits = [];
    const without = sim.liveOpsRevenue(fake, config, none);
    assert(withAce > without, "ace revenue " + withAce + " vs " + without);
    ok("liveOpsAce raises monthly live revenue");
  })();

  (function trendRiderBoostsMatchingBaseline() {
    const g = hireOne(13);
    g.staff[0].traits = ["trendRider"];
    g.trend = { genreId: "fantasy", gameplayId: null, monthsLeft: 3 };
    const p = {
      stats: { program: 10, script: 10, art: 10, music: 10 },
      genreId: "fantasy",
      gameplayId: "rpg",
      platformId: "pc",
      memberIds: [g.staff[0].id],
      producerId: g.staff[0].id
    };
    const withT = sim.boxedBaselineFormula(g, p, config, false);
    g.staff[0].traits = [];
    const noT = sim.boxedBaselineFormula(g, p, config, false);
    assert(withT > noT, "trendRider extra " + withT + " vs " + noT);
    ok("trendRider extra sales only on matching trend");
  })();

  (function eventCopyPoolHasChoices() {
    const randoms = (config.world.events || []).filter(function (ev) {
      return (ev.source || "random") !== "historical";
    });
    const choices = randoms.filter(function (ev) { return ev.presentation === "choice"; });
    const notices = randoms.filter(function (ev) { return (ev.presentation || "notice") === "notice"; });
    assert(randoms.length >= 16, "random pool size " + randoms.length);
    assert(choices.length >= 5, "choice count " + choices.length);
    assert(notices.length >= 10, "notice count " + notices.length);
    assert(choices.filter(function (ev) { return ev.id === "crunchChoice"; }).length === 1, "crunchChoice stays");
    ok("random event pool has more notices and choices");
  })();

  (function autoChessChain2018() {
    let g = sim.createNewGame("自走棋链", config);
    g.rngSeed = 201806;
    g.rngCount = 0;
    g.year = 2018;
    g.month = 6;
    g.firedEventIds = [];
    const jun = sim.tickMonth(g, config);
    g = jun.state;
    const wave = (jun.queue || []).filter(function (q) {
      return q.eventId === "autoChessWave";
    })[0];
    assert(wave, "June fires autoChessWave");
    const jul = sim.tickMonth(g, config);
    g = jul.state;
    assert(g.trend && g.trend.gameplayId === "autoChess", "July trend is autoChess");
    ok("auto chess chain 2018.6 wave → 7 autoChess trend");
  })();

  (function kingGloryOn2015Calendar() {
    const g = sim.createNewGame("王者日历", config);
    const cal = sim.getRivalCalendar(g, 2015);
    const hit = (cal.months[10] || []).filter(function (p) {
      return p.status !== "moved" && (p.title === "王者荣耀" || p.series === "王者荣耀");
    })[0];
    assert(hit, "2015.10 calendar has 王者荣耀");
    ok("2015 calendar books 王者荣耀 in October");
  })();

  (function careerWorldCatalog() {
    const world = config.careerWorld;
    assert(world && typeof world.useAlias === "boolean", "useAlias flag");
    assert(world.timeline && world.timeline.startYear === 1995, "career timeline 1995");
    assert(world.timeline.endYear === 2025, "career timeline 2025");
    assert(world.quality && world.quality.liveCanExceedMax === true, "live stats can exceed config max");
    assert(world.quality.statMin === 0 && world.quality.statMax === 100, "config stat range 0-100");
    const dimList = world.quality.dims || [];
    assert(dimList.join(",") === "program,design,art,music", "quality dims");
    const companies = world.companies || [];
    const titles = world.titles || [];
    const details = world.titleDetails || [];
    assert(companies.length >= 40, "company count " + companies.length);
    assert(titles.length >= 120, "title count " + titles.length);
    assert(details.length === titles.length, "titleDetails 1:1 with titles");
    const companyIds = {};
    companies.forEach(function (c) {
      assert(c.id && c.name && c.alias, "company name/alias " + c.id);
      assert(!companyIds[c.id], "dup company " + c.id);
      companyIds[c.id] = true;
    });
    const titleIds = {};
    const years = {};
    const genreIds = {};
    const gameplayIds = {};
    (config.content.genres || []).forEach(function (g) { genreIds[g.id] = true; });
    (config.content.gameplay || []).forEach(function (g) { gameplayIds[g.id] = true; });
    titles.forEach(function (t) {
      assert(t.id && t.name && t.alias, "title name/alias " + t.id);
      assert(!titleIds[t.id], "dup title " + t.id);
      titleIds[t.id] = true;
      assert(companyIds[t.companyId], "title company " + t.id);
      assert(companyIds[t.publisherId], "title publisher " + t.id);
      assert(t.releaseYear >= 1995 && t.releaseYear <= 2025, "title year " + t.id);
      assert(typeof t.score === "number" && t.score >= 1 && t.score <= 10, "title score " + t.id);
      assert(genreIds[t.genreId], "title genre " + t.id + " " + t.genreId);
      assert(gameplayIds[t.gameplayId], "title gameplay " + t.id + " " + t.gameplayId);
      const stt = t.stats || {};
      dimList.forEach(function (d) {
        assert(Number.isInteger(stt[d]), "stats int " + t.id + " " + d);
        assert(stt[d] >= 0 && stt[d] <= 100, "stats range " + t.id + " " + d + "=" + stt[d]);
      });
      if (t.peakDims) {
        t.peakDims.forEach(function (d) {
          assert(stt[d] != null, "peakDim subset " + t.id + " " + d);
        });
      }
      years[t.releaseYear] = true;
    });
    for (let y = 1995; y <= 2025; y += 1) {
      assert(years[y], "missing titles in " + y);
    }
    details.forEach(function (d) {
      assert(titleIds[d.id], "orphan detail " + d.id);
      assert(d.inviteWindow && d.inviteRoles && d.inviteRoles.length === 4, "invite fields " + d.id);
      if (d.awards != null) {
        assert(Array.isArray(d.awards) && d.awards.length === 0, "no prefilled awards " + d.id);
      }
    });
    const opening = companies.filter(function (c) { return c.openingOffer; });
    assert(opening.length >= 9, "opening offer pool");
    const unjoinable = companies.filter(function (c) { return c.joinable === false; });
    assert(unjoinable.length >= 8, "unjoinable world houses " + unjoinable.length);
    for (let y = 1995; y <= 2025; y += 1) {
      const n = titles.filter(function (t) { return t.releaseYear === y; }).length;
      assert(n >= 10, "year " + y + " releases " + n);
    }
    const genshin = titles.filter(function (t) { return t.id === "genshin"; })[0];
    assert(genshin && genshin.companyId === "mihoyo" && genshin.name === "原神", "genshin real name");
    const mihoyo = companies.filter(function (c) { return c.id === "mihoyo"; })[0];
    assert(mihoyo && mihoyo.alias === "米社", "mihoyo alias");
    const ff7 = titles.filter(function (t) { return t.id === "ff7"; })[0];
    assert(ff7 && ff7.stats.art > ff7.stats.program && ff7.stats.music > ff7.stats.design, "ff7 art/music peak");
    const events = (world.devEvents && world.devEvents.list) || [];
    assert(events.length >= 56, "career devEvents " + events.length);
    const eventIds = {};
    const rolePhaseChoices = {};
    const genericChoiceIds = ["crunchTradeoff", "scopeCutChoice", "goldDelayChoice"];
    events.forEach(function (ev) {
      assert(!eventIds[ev.id], "duplicate devEvent " + ev.id);
      eventIds[ev.id] = true;
      if (ev.presentation === "choice") {
        assert(ev.choices && ev.choices.length, "choice dims " + ev.id);
        ev.choices.forEach(function (ch) {
          assert(ch.qualityDim, "choice qualityDim " + ev.id + "/" + ch.id);
        });
        if (genericChoiceIds.indexOf(ev.id) >= 0) {
          assert(!ev.role, "generic choice has no role " + ev.id);
        } else if (ev.role) {
          assert(ev.phase, "role choice needs phase " + ev.id);
          const key = ev.role + ":" + ev.phase;
          rolePhaseChoices[key] = (rolePhaseChoices[key] || 0) + 1;
        }
      } else {
        assert(ev.qualityDim, "event qualityDim " + ev.id);
      }
    });
    genericChoiceIds.forEach(function (id) {
      assert(eventIds[id], "kept generic " + id);
    });
    ["programmer", "art", "design", "music"].forEach(function (role) {
      ["prepro", "production", "alpha", "polish", "gold"].forEach(function (phase) {
        assert((rolePhaseChoices[role + ":" + phase] || 0) >= 2, "role/phase choices " + role + "/" + phase);
      });
    });
    const pl = world.postLaunch || {};
    assert(pl.monthsMin === 1 && pl.monthsMax === 3, "postLaunch months 1-3");
    assert((pl.events || []).length >= 12, "postLaunch events " + (pl.events || []).length);
    const plRoleChoices = {};
    (pl.events || []).forEach(function (ev) {
      assert(!eventIds[ev.id], "duplicate postLaunch " + ev.id);
      eventIds[ev.id] = true;
      if (ev.presentation === "choice") {
        assert(ev.choices && ev.choices.length, "postLaunch choice " + ev.id);
        ev.choices.forEach(function (ch) {
          assert(ch.qualityDim, "postLaunch qualityDim " + ev.id + "/" + ch.id);
        });
        if (ev.role) plRoleChoices[ev.role] = (plRoleChoices[ev.role] || 0) + 1;
      }
    });
    ["programmer", "art", "design", "music"].forEach(function (role) {
      assert((plRoleChoices[role] || 0) >= 2, "postLaunch role choices " + role);
    });
    const px = world.playerXp || {};
    assert(px.liveBonusPerXp != null && px.liveBonusCap != null, "playerXp live formula");
    assert(px.contribBonusPerXp != null && px.contribBonusCap != null, "playerXp contrib formula");
    assert(world.save && world.save.version >= 8, "career saveVersion");
    ok("career world catalog: companies, titles, details, alias switch");
  })();

  (function awardsListUsesStatsFields() {
    const list = config.awards.list || [];
    const ids = list.map(function (a) { return a.id; });
    assert(ids.indexOf("bestAudio") >= 0, "bestAudio present");
    assert(ids.indexOf("bestGameplay") >= 0, "bestGameplay present");
    assert(ids.indexOf("bestProduction") < 0, "bestProduction removed");
    list.forEach(function (a) {
      assert(a.scoreFrom || a.stat, "award scoring field " + a.id);
    });
    const audio = list.filter(function (a) { return a.id === "bestAudio"; })[0];
    assert(audio && audio.stat === "music", "bestAudio reads music");
    ok("awards list is stat/scoreFrom driven");
  })();

  (function scoreAwardCategoryReadsStats() {
    const world = config.careerWorld;
    const ff7 = (world.titles || []).filter(function (t) { return t.id === "ff7"; })[0];
    const even = { stats: { program: 85, design: 85, art: 85, music: 85 }, score: 9.0 };
    const defs = {};
    (config.awards.list || []).forEach(function (a) { defs[a.id] = a; });
    assert(ff7 && defs.bestVisual && defs.bestAudio, "ff7 and award defs");
    assert(sim.scoreAwardCategory(ff7, defs.bestVisual) > sim.scoreAwardCategory(even, defs.bestVisual), "ff7 visual > even");
    assert(sim.scoreAwardCategory(ff7, defs.bestAudio) > sim.scoreAwardCategory(even, defs.bestAudio), "ff7 audio > even");
    const portal = (world.titles || []).filter(function (t) { return t.id === "portal"; })[0];
    assert(portal && sim.scoreAwardCategory(portal, defs.bestNarrative) > sim.scoreAwardCategory(even, defs.bestNarrative), "portal design > even");
    const missingMusic = { avg: 8.2, qsum: 320, script: 80, art: 78 };
    assert(typeof sim.scoreAwardCategory(missingMusic, defs.bestAudio) === "number", "rival missing music still scores");
    ok("scoreAwardCategory compares stats without historical winners");
  })();

  (function runAwardsConfigDrivenWithFallback() {
    const g = sim.createNewGame("奖", config);
    g.year = 2015;
    g.month = 11;
    sim.forceRivalRelease(g, { title: "测作", avg: 8.5, sales: 50000, script: 80, art: 70 }, config);
    const notes = [];
    const pack = sim.runAwards(g, config, notes);
    const ids = pack.map(function (a) { return a.id; });
    assert(ids.indexOf("bestAudio") >= 0, "pack has bestAudio");
    assert(ids.indexOf("bestGameplay") >= 0, "pack has bestGameplay");
    assert(ids.indexOf("bestProduction") < 0, "pack has no bestProduction");
    pack.forEach(function (a) {
      assert(a.w, "winner label " + a.id);
    });
    ok("runAwards config-driven with rival fallback");
  })();

  (function careerNewGameOpeningOffers() {
    const g = sim.createCareerGame("测", "programmer", config);
    const world = config.careerWorld;
    assert(g.mode === "career", "career mode");
    assert(g.year === world.timeline.startYear && g.month === world.timeline.startMonth, "career starts 1995.01");
    assert(g.year === 1995 && g.month === 1, "1995 jan");
    assert(g.career.characterName === "测", "character name");
    assert(g.career.roleId === "programmer", "locked role");
    assert(g.career.growthStage === "employee", "employee stage");
    assert(g.phase === "OFFER", "offer phase");
    const offers = g.career.openingOffers || [];
    assert(offers.length === 3, "three offers");
    const tiers = offers.map(function (o) { return o.tier; });
    ["small", "stable", "wild"].forEach(function (t) {
      assert(tiers.indexOf(t) >= 0, "tier " + t);
    });
    offers.forEach(function (o) {
      assert(o.roleId === "programmer", "offer role matches specialty");
      assert(o.salary > 0, "offer salary " + o.companyId);
      assert(o.risk, "offer risk " + o.tier);
      const co = sim.careerCompany(o.companyId, config);
      assert(co && co.openingOffer && co.starterTier === o.tier, "offer company tier");
    });
    ok("career new game: 1995, three-tier offers, role locked");
  })();

  (function careerAcceptJoinsOrIdles() {
    const g = sim.createCareerGame("测", "art", config);
    const offer = g.career.openingOffers[1] || g.career.openingOffers[0];
    const acc = sim.acceptOpeningOffer(g, offer.id, config);
    assert(acc.ok, "accept ok");
    assert(acc.state.phase === "PLAYING", "playing");
    assert(acc.state.career.companyId === offer.companyId, "company set");
    assert(acc.state.career.growthStage === "employee", "not producer");
    const view = sim.careerProjectView(acc.state, config);
    assert(view.idle === true || (view.title && view.phase && view.phase.until != null), "project or idle");
    if (!view.idle) {
      assert(view.title.companyId === offer.companyId, "title company matches");
      assert(acc.state.career.liveStats, "live stats present");
      assert(acc.state.career.colleagues.length === 4, "four colleagues");
      const roles = acc.state.career.colleagues.map(function (c) { return c.roleId; });
      assert(roles.indexOf("art") < 0, "player occupies art slot");
      assert(roles.indexOf("producer") >= 0, "producer npc");
    }
    ok("career accept offer joins project or idles without throw");
  })();

  (function careerTickAdvancesAndPhaseUntil() {
    const g = sim.createCareerGame("测", "design", config);
    const acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config);
    const before = acc.state.career.savings;
    const r = sim.tickMonth(acc.state, config);
    assert(r.state.month === 2 && r.state.year === 1995, "feb 1995");
    assert(r.state.phase !== "BANKRUPT", "no company bankrupt");
    assert(r.state.career.savings === before + acc.state.career.salary, "savings plus salary, no living cost");
    assert(r.state.career.lastPay === acc.state.career.salary, "lastPay recorded");
    const view = sim.careerProjectView(r.state, config);
    if (!view.idle) {
      assert(view.phase && view.phase.until != null, "phase until");
      assert(view.progress >= 0 && view.progress <= 1, "progress range");
    }
    assert(r.queue && Array.isArray(r.queue), "tick queue");
    const kinds = r.queue.map(function (q) { return q.type; });
    assert(kinds.indexOf("notes") < 0, "no monthly notes popup");
    assert(kinds.indexOf("salary") < 0, "no salary queue item");
    ok("career tickMonth advances, savings change, phase until");
  })();

  (function careerEventSpecifiedDimCanExceed100() {
    const tweaked = deepClone(config);
    tweaked.careerWorld = deepClone(config.careerWorld);
    tweaked.careerWorld.devEvents.chance = 1;
    tweaked.careerWorld.devEvents.list = [{
      id: "testBurst",
      displayName: "测试突破",
      text: "指定程序维",
      presentation: "notice",
      qualityDim: "program",
      qualityDelta: 20
    }];
    const g = sim.createCareerGame("测", "programmer", tweaked);
    const squareOffer = (g.career.openingOffers || []).filter(function (o) {
      return o.companyId === "square";
    })[0] || g.career.openingOffers[0];
    const acc = sim.acceptOpeningOffer(g, squareOffer.id, tweaked);
    let st = acc.state;
    st.career.companyId = "square";
    st.career.titleId = "chronoTrigger";
    st.career.liveStats = { program: 95, design: 90, art: 88, music: 92 };
    st.career.credits = [{ titleId: "chronoTrigger", companyId: "square", roleId: "programmer" }];
    const r = sim.tickMonth(st, tweaked);
    assert(r.state.career.liveStats, "still in live after jan tick");
    assert(r.state.career.liveStats.program > 100, "live can exceed 100, got " + r.state.career.liveStats.program);
    ok("career event uses specified dim and live can exceed 100");
  })();

  (function careerDevEventRoleAndPhaseFilter() {
    function choiceEv(id, extra) {
      const row = {
        id: id,
        displayName: id,
        text: "测",
        presentation: "choice",
        choices: [{ id: "a", label: "按期", qualityDim: ["program"], qualityDelta: [2] }]
      };
      Object.keys(extra || {}).forEach(function (k) { row[k] = extra[k]; });
      return row;
    }
    const tweaked = deepClone(config);
    tweaked.careerWorld = deepClone(config.careerWorld);
    tweaked.careerWorld.devEvents.chance = 1;
    tweaked.careerWorld.devEvents.list = [
      choiceEv("artOnlyChoice", { role: "art" }),
      choiceEv("genericChoice"),
      choiceEv("progPreproChoice", { role: "programmer", phase: "prepro" }),
      choiceEv("progProdChoice", { role: "programmer", phase: "production" })
    ];
    tweaked.careerWorld.titles = (tweaked.careerWorld.titles || []).concat([{
      id: "phaseProbe",
      companyId: "square",
      publisherId: "square",
      name: "探针",
      alias: "探针",
      releaseYear: 1995,
      releaseMonth: 12,
      score: 7,
      platforms: ["pc"],
      genreId: "fantasy",
      gameplayId: "rpg",
      stats: { program: 70, design: 70, art: 70, music: 70 }
    }]);
    tweaked.careerWorld.titleDetails = (tweaked.careerWorld.titleDetails || []).concat([{
      id: "phaseProbe",
      devStartYear: 1995,
      devStartMonth: 1,
      devMonths: 11
    }]);
    function primed(roleId, year, month) {
      const g = sim.createCareerGame("测", roleId, tweaked);
      const acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tweaked);
      const st = acc.state;
      st.year = year;
      st.month = month;
      st.career.companyId = "square";
      st.career.titleId = "phaseProbe";
      st.career.liveStats = { program: 80, design: 80, art: 80, music: 80 };
      st.career.credits = [{ titleId: "phaseProbe", companyId: "square", roleId: roleId }];
      st.career.postLaunch = null;
      return st;
    }
    function rollIds(roleId, year, month, n) {
      const ids = {};
      let i;
      for (i = 0; i < n; i++) {
        const st = primed(roleId, year, month);
        st.rngSeed = 1000 + i;
        st.rngCount = 0;
        const ev = sim.rollCareerDevEvent(st, tweaked, []);
        assert(ev, "chance 1 always rolls " + roleId + " " + year + "." + month);
        ids[ev.id] = true;
      }
      return ids;
    }
    const progJan = rollIds("programmer", 1995, 1, 24);
    assert(!progJan.artOnlyChoice, "programmer cannot roll art choice");
    assert(progJan.genericChoice, "role-less generic still rolls");
    assert(progJan.progPreproChoice, "programmer prepro choice rolls in prepro");
    assert(!progJan.progProdChoice, "production choice stays out of prepro");
    const progJun = rollIds("programmer", 1995, 6, 24);
    assert(progJun.progProdChoice, "programmer production choice rolls in production");
    assert(!progJun.progPreproChoice, "prepro choice stays out of production");
    assert(!progJun.artOnlyChoice, "programmer still cannot roll art in production");
    const artJan = rollIds("art", 1995, 1, 24);
    assert(artJan.artOnlyChoice, "art player can roll art choice");
    assert(artJan.genericChoice, "art player can still roll generic");
    assert(!artJan.progPreproChoice, "art player cannot roll programmer choice");
    ok("career devEvents hard-filter role and phase");
  })();

  (function careerPostLaunchRoleFilterAndChoiceReplay() {
    const tweaked = deepClone(config);
    tweaked.careerWorld = deepClone(config.careerWorld);
    tweaked.careerWorld.postLaunch.eventChance = 1;
    tweaked.careerWorld.postLaunch.events = [
      {
        id: "artPostChoice",
        displayName: "破图",
        text: "测",
        presentation: "choice",
        role: "art",
        choices: [
          { id: "fix", label: "立刻补", qualityDim: ["art"], qualityDelta: [5] },
          { id: "wait", label: "等大更新", qualityDim: ["art"], qualityDelta: [-2] }
        ]
      },
      {
        id: "allNotice",
        displayName: "补丁说明",
        text: "测",
        presentation: "notice",
        qualityDim: "program",
        qualityDelta: 1
      }
    ];
    tweaked.careerWorld.devEvents.chance = 1;
    tweaked.careerWorld.devEvents.list = [{
      id: "genericReplay",
      displayName: "通用抉择",
      text: "测",
      presentation: "choice",
      choices: [
        { id: "push", label: "加钱赶工", qualityDim: ["program", "art"], qualityDelta: [7, -4] },
        { id: "hold", label: "按期", qualityDim: ["program"], qualityDelta: [0] }
      ]
    }];
    function supportState(roleId) {
      const g = sim.createCareerGame("测", roleId, tweaked);
      const acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tweaked);
      const st = acc.state;
      st.career.companyId = "square";
      st.career.titleId = "chronoTrigger";
      st.career.liveStats = { program: 80, design: 80, art: 80, music: 80 };
      st.career.credits = [{ titleId: "chronoTrigger", companyId: "square", roleId: roleId }];
      st.career.postLaunch = { titleId: "chronoTrigger", monthsLeft: 2 };
      return st;
    }
    const progSeen = {};
    let i;
    for (i = 0; i < 20; i++) {
      const st = supportState("programmer");
      st.rngSeed = 50 + i;
      st.rngCount = 0;
      const ev = sim.rollPostLaunchEvent(st, tweaked, []);
      assert(ev, "postLaunch chance 1 rolls");
      progSeen[ev.id] = true;
    }
    assert(!progSeen.artPostChoice, "programmer cannot roll art postLaunch choice");
    assert(progSeen.allNotice, "role-less postLaunch notice still rolls");
    const artSeen = {};
    for (i = 0; i < 20; i++) {
      const st = supportState("art");
      st.rngSeed = 80 + i;
      st.rngCount = 0;
      const ev = sim.rollPostLaunchEvent(st, tweaked, []);
      if (ev) artSeen[ev.id] = true;
    }
    assert(artSeen.artPostChoice, "art player can roll art postLaunch choice");

    const g = sim.createCareerGame("测", "programmer", tweaked);
    const acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tweaked);
    let base = acc.state;
    base.career.companyId = "square";
    base.career.titleId = "chronoTrigger";
    base.career.liveStats = { program: 90, design: 88, art: 86, music: 84 };
    base.career.credits = [{ titleId: "chronoTrigger", companyId: "square", roleId: "programmer" }];
    base.career.postLaunch = null;
    base.year = 1995;
    base.month = 1;
    base.rngSeed = 424242;
    base.rngCount = 0;
    const snap = JSON.stringify(base);
    const t1 = sim.tickMonth(JSON.parse(snap), tweaked);
    const t2 = sim.tickMonth(JSON.parse(snap), tweaked);
    assert(JSON.stringify(t1.state) === JSON.stringify(t2.state), "career choice tick replays before pick");
    const choicePage = (t1.queue || []).filter(function (q) {
      return q.presentation === "choice" && q.eventId === "genericReplay";
    })[0];
    assert(choicePage, "career generic choice queued");
    const artBefore = t1.state.career.liveStats.art;
    const a = sim.resolveEventChoice(t1.state, "genericReplay", "push", tweaked);
    const b = sim.resolveEventChoice(t2.state, "genericReplay", "push", tweaked);
    assert(a.ok && b.ok, "career resolve ok");
    assert(JSON.stringify(a.state) === JSON.stringify(b.state), "career same seed same choice");
    assert(a.state.career.liveStats.program === t1.state.career.liveStats.program + 7, "push raises program");
    assert(a.state.career.liveStats.art === artBefore - 4, "push drops art");
    ok("postLaunch role filter and career choice replay same seed");
  })();

  (function careerAwards1997LiveCompare() {
    const g = sim.createCareerGame("测", "music", config);
    let acc = sim.acceptOpeningOffer(g, g.career.openingOffers[1].id, config);
    let st = acc.state;
    st.rngSeed = 11;
    let guard = 0;
    while (!(st.year === 1997 && st.month === 11) && guard < 80) {
      st = sim.tickMonth(st, config).state;
      guard += 1;
    }
    assert(st.year === 1997 && st.month === 11, "reached 1997.11 in " + guard);
    const r = sim.tickMonth(st, config);
    const pack = r.state.lastAwards;
    assert(pack && pack.length === config.awards.list.length, "awardPack size");
    pack.forEach(function (a) {
      assert(a.id && a.n && a.w, "award row " + a.id);
      assert(Array.isArray(a.nominees), "nominees array " + a.id);
      assert(a.nominees.length <= (config.awards.nomineeCount || 5), "nominee cap " + a.id);
      if (a.id !== "bestLiveOps") {
        assert(a.nominees.length === (config.awards.nomineeCount || 5), "5 nominees " + a.id + " got " + a.nominees.length);
        assert(a.nominees[0] && a.nominees[0].label === a.w, "winner from nominees " + a.id);
      } else {
        assert(a.nominees.length === 0 || a.nominees[0].label === a.w, "liveops winner from nominees or empty");
      }
    });
    const ff7 = (r.state.worldReleased || []).filter(function (t) { return t.id === "ff7"; })[0];
    assert(ff7, "ff7 shipped into window");
    const defs = {};
    (config.awards.list || []).forEach(function (a) { defs[a.id] = a; });
    const even = { stats: { program: 85, design: 85, art: 85, music: 85 }, score: 9.0 };
    assert(sim.scoreAwardCategory(ff7, defs.bestVisual) > sim.scoreAwardCategory(even, defs.bestVisual), "compare still uses stats");
    assert(r.state.phase !== "BANKRUPT", "1997 tick no bankrupt");
    ok("career 1997.11 awardPack live compare, no historical winner assert");
  })();

  (function careerTickTo1996Stable() {
    const g = sim.createCareerGame("测", "programmer", config);
    let st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
    let guard = 0;
    while (!(st.year === 1996 && st.month === 1) && guard < 20) {
      const r = sim.tickMonth(st, config);
      st = r.state;
      assert(r.queue && Array.isArray(r.queue), "queue " + guard);
      assert(st.phase !== "BANKRUPT", "no bankrupt " + st.year + "." + st.month);
      guard += 1;
    }
    assert(st.year === 1996 && st.month === 1, "reached 1996.01");
    const dec = sim.listYearEndOffers(st, config);
    const inv = sim.listCareerInvites(st, config);
    assert(Array.isArray(dec) && Array.isArray(inv), "year-end sim APIs");
    ok("career can tick to 1996 without throw; year-end APIs exist");
  })();

  (function worldLabelAliasSwitch() {
    const mihoyo = sim.careerCompany("mihoyo", config);
    const tweaked = deepClone(config);
    tweaked.careerWorld = deepClone(config.careerWorld);
    tweaked.careerWorld.useAlias = false;
    assert(sim.worldLabel(mihoyo, tweaked) === mihoyo.name, "real name");
    tweaked.careerWorld.useAlias = true;
    assert(sim.worldLabel(mihoyo, tweaked) === mihoyo.alias, "alias");
    ok("worldLabel is a single helper for name/alias");
  })();

  (function careerXpAndMediaAndHop() {
    const g = sim.createCareerGame("测", "programmer", config);
    const squareXp = sim.companyXpValue(g, "square", "genre", "fantasy");
    assert(squareXp > 0, "1995 companies have seeded genre xp");
    const offer = g.career.openingOffers[0];
    let acc = sim.acceptOpeningOffer(g, offer.id, config);
    let st = acc.state;
    st.career.companyId = "square";
    st.career.titleId = "chronoTrigger";
    st.career.liveStats = { program: 90, design: 95, art: 88, music: 92 };
    st.career.credits = [{ titleId: "chronoTrigger", companyId: "square", roleId: "programmer" }];
    st.year = 1995;
    st.month = 3;
    const beforeXp = sim.companyXpValue(st, "square", "genre", "fantasy");
    const notes = [];
    const queue = [];
    sim.shipPlayerTitle(st, config, notes, queue);
    assert(st.lastMedia && st.lastMedia.media && st.lastMedia.media.rows.length === 5, "5 media outlets");
    st.lastMedia.media.rows.forEach(function (row) {
      assert(row.quote && typeof row.score === "number", "outlet quote+score " + row.id);
    });
    assert(queue.some(function (q) { return q.type === "media"; }), "player ship queues media");
    const afterXp = sim.companyXpValue(st, "square", "genre", "fantasy");
    assert(afterXp > beforeXp, "player ship raises company xp");

    const low = sim.createCareerGame("测", "art", config);
    const high = sim.createCareerGame("测", "art", config);
    high.companyXp.square = { genreXp: { scifi: 80 }, gameplayXp: { rpg: 80 } };
    const t = sim.careerTitle("ff7", config);
    const liveLow = (function () {
      high.career.companyId = "square";
      return null;
    })();
    void liveLow;
    const bonusSpec = config.careerWorld.companyXp;
    const lowBonus = Math.floor(sim.companyXpValue(low, "square", "genre", t.genreId) * bonusSpec.statBonusPerXp) +
      Math.floor(sim.companyXpValue(low, "square", "gameplay", t.gameplayId) * bonusSpec.statBonusPerXp);
    const highBonus = Math.floor(sim.companyXpValue(high, "square", "genre", t.genreId) * bonusSpec.statBonusPerXp) +
      Math.floor(sim.companyXpValue(high, "square", "gameplay", t.gameplayId) * bonusSpec.statBonusPerXp);
    assert(highBonus > lowBonus, "higher xp gives higher stat bonus");

    let hopSt = sim.createCareerGame("测", "music", config);
    hopSt = sim.acceptOpeningOffer(hopSt, hopSt.career.openingOffers[0].id, config).state;
    hopSt.year = 1995;
    hopSt.month = 12;
    hopSt.career.titleId = null;
    hopSt.career.liveStats = null;
    hopSt.career.yearEndOffers = sim.listYearEndOffers(hopSt, config);
    const offers = hopSt.career.yearEndOffers;
    assert(offers.length >= 1, "year-end offers in december");
    offers.forEach(function (o) {
      const co = sim.careerCompany(o.companyId, config);
      assert(sim.companyJoinable(co, hopSt.year), "offer company joinable");
      assert(o.roleId === "music", "offer locks specialty");
      assert(o.salary > 0 && o.currentSalary != null, "salary compare");
    });
    offers[0].successChance = 1;
    const take = sim.acceptYearEndOffer(hopSt, offers[0].id, config);
    assert(take.ok, "accept hop");
    assert(take.state.career.companyId === offers[0].companyId, "company switched");

    hopSt.career.fame = 80;
    hopSt.year = 1995;
    hopSt.month = 2;
    const inv = sim.listCareerInvites(hopSt, config);
    assert(Array.isArray(inv), "invites list");
    if (inv.length) {
      hopSt.career.invites = inv;
      const accInv = sim.acceptCareerInvite(hopSt, inv[0].id, config);
      assert(accInv.ok, "accept invite");
      assert(accInv.state.career.companyId === inv[0].companyId, "invite switches company");
    } else {
      const tweaked = deepClone(config);
      const chrono = (tweaked.careerWorld.titleDetails || []).filter(function (d) { return d.id === "chronoTrigger"; })[0];
      assert(chrono && chrono.inviteEligible, "chrono invite eligible");
      hopSt.career.fame = chrono.inviteMinFame;
      hopSt.career.companyId = "nintendo";
      hopSt.year = chrono.inviteWindow.startYear;
      hopSt.month = chrono.inviteWindow.startMonth;
      const inv2 = sim.listCareerInvites(hopSt, tweaked);
      assert(inv2.length >= 1, "invite appears when fame and window match");
      hopSt.career.invites = inv2;
      const accInv = sim.acceptCareerInvite(hopSt, inv2[0].id, tweaked);
      assert(accInv.ok && accInv.state.career.companyId === "square", "chrono invite to square");
    }
    ok("xp, 5-outlet media, year-end hop, invites");
  })();

  (function careerIdleStartsVirtual() {
    const g = sim.createCareerGame("测", "programmer", config);
    const small = (g.career.openingOffers || []).filter(function (o) {
      return o.companyId === "fromsoftware" || o.tier === "small";
    })[0] || g.career.openingOffers[0];
    let st = sim.acceptOpeningOffer(g, small.id, config).state;
    st.career.companyId = "fromsoftware";
    st.career.titleId = null;
    st.career.liveStats = null;
    st.career.idleMonths = 0;
    const idleMax = (config.careerWorld.virtualPool || {}).idleMaxMonths || 1;
    let view = sim.careerProjectView(st, config);
    assert(view.idle, "start idle at fromsoftware 1995");
    let guard = 0;
    while (view.idle && guard < idleMax + 2) {
      st = sim.tickMonth(st, config).state;
      view = sim.careerProjectView(st, config);
      guard += 1;
    }
    assert(!view.idle, "virtual project after idle cap");
    assert(view.title && view.title.virtual, "assignment is virtual");
    assert(view.genreId && view.gameplayId, "virtual has genre and gameplay");
    ok("idle past cap starts virtual project");
  })();

  (function careerNominationHonor() {
    const g = sim.createCareerGame("测", "design", config);
    let st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
    st.career.credits = [{ titleId: "chronoTrigger", companyId: "square", roleId: "design" }];
    const rec = (st.worldReleased || []).filter(function (t) { return t.id === "chronoTrigger"; })[0];
    if (!rec) {
      st.worldReleased.push({
        id: "chronoTrigger",
        name: "时空之轮",
        companyId: "square",
        releaseYear: 1995,
        releaseMonth: 3,
        releasedYear: 1995,
        releasedMonth: 3,
        score: 9.5,
        avg: 9.5,
        stats: { program: 82, design: 94, art: 88, music: 92 },
        prestige: 5,
        player: true
      });
    } else rec.player = true;
    (config.careerWorld.titles || []).forEach(function (t) {
      if (t.releaseYear !== 1995) return;
      if ((st.worldReleased || []).some(function (g) { return g.id === t.id; })) return;
      st.worldReleased.push({
        id: t.id,
        name: t.name,
        alias: t.alias,
        companyId: t.companyId,
        releaseYear: t.releaseYear,
        releaseMonth: t.releaseMonth,
        releasedYear: t.releaseYear,
        releasedMonth: t.releaseMonth,
        score: t.score,
        avg: t.score,
        stats: t.stats,
        prestige: t.prestige || 0,
        player: false
      });
    });
    st.year = 1995;
    st.month = 11;
    const honor0 = st.career.honor || 0;
    const fame0 = st.career.fame || 0;
    const pack = sim.runCareerAwards(st, config, []);
    const nom = pack.filter(function (a) { return a.playerNominated; }).length;
    const win = pack.filter(function (a) { return a.playerWon; }).length;
    if (nom) {
      assert(st.career.honor > honor0 || st.career.fame > fame0, "nomination grants honor/fame");
    }
    void win;
    pack.forEach(function (a) {
      if (a.id === "bestLiveOps") {
        assert(!a.nominees || a.nominees.length === 0, "1995 bestLiveOps still empty before liveops era");
        return;
      }
      assert(a.nominees && a.nominees.length === 5, "career tga 5 noms " + a.id);
    });
    ok("player nomination honor and 5 nominees");
  })();

  (function liveOpsTitlesAreDistinctForAwards() {
    const boxed = { releaseType: "boxed", livePeak: 0 };
    const live = { releaseType: "liveops", stats: { program: 80, design: 82, art: 70, music: 68 } };
    assert(!sim.isLiveOpsTitle(boxed), "boxed is not liveops");
    assert(sim.isLiveOpsTitle(live), "releaseType liveops counts");
    assert(sim.isLiveOpsTitle({ live: true }), "rival live flag counts");
    assert(sim.isLiveOpsTitle({ liveOps: { active: true } }), "player liveOps counts");
    const peak = sim.careerLivePeak(live, config);
    assert(peak === Math.round((80 + 82 + 70 + 68) * config.liveOps.monthlyRevenuePerQualitySum), "livePeak from qsum * monthlyRevenuePerQualitySum");
    assert(sim.liveOpsAwardEligible(Object.assign({ releasedYear: 2002, releasedMonth: 8 }, live), 2004, config), "ongoing liveops stay eligible");
    assert(!sim.inAwardWindow({ releasedYear: 2002, releasedMonth: 8 }, 2004, config), "2002 boxed window does not cover 2004");
    assert(!sim.liveOpsAwardEligible({ releaseType: "boxed", releasedYear: 2002, releasedMonth: 8 }, 2004, config), "boxed not in liveops award");
    ok("liveops identity, peak, and ongoing eligibility");
  })();

  (function careerBestLiveOpsHasWorksAfterLiveEra() {
    const g = sim.createCareerGame("测", "programmer", config);
    const acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config);
    const st = acc.state;
    st.year = 2004;
    st.month = 11;
    (config.careerWorld.titles || []).forEach(function (t) {
      if (t.releaseType !== "liveops") return;
      if (t.releaseYear > 2004 || (t.releaseYear === 2004 && t.releaseMonth > 11)) return;
      if ((st.worldReleased || []).some(function (row) { return row.id === t.id; })) return;
      st.worldReleased.push({
        id: t.id,
        name: t.name,
        alias: t.alias,
        companyId: t.companyId,
        studioId: t.studioId || null,
        releaseYear: t.releaseYear,
        releaseMonth: t.releaseMonth,
        releasedYear: t.releaseYear,
        releasedMonth: t.releaseMonth,
        score: t.score,
        avg: t.score,
        stats: t.stats,
        prestige: t.prestige || 0,
        releaseType: t.releaseType,
        live: true,
        livePeak: sim.careerLivePeak(t, config),
        player: false
      });
    });
    const pack = sim.runCareerAwards(st, config, []);
    const live = pack.filter(function (a) { return a.id === "bestLiveOps"; })[0];
    const goty = pack.filter(function (a) { return a.id === "goty"; })[0];
    assert(live && live.nominees && live.nominees.length === (config.awards.nomineeCount || 5), "career bestLiveOps 5 noms got " + (live && live.nominees && live.nominees.length));
    assert(live.w && live.w !== "—", "career bestLiveOps has a winner");
    assert(live.nominees[0] && live.nominees[0].label === live.w, "career liveops winner from nominees");
    const liveIds = {};
    (st.worldReleased || []).forEach(function (row) {
      if (row.releaseType === "liveops") liveIds[sim.worldLabel(row, config)] = true;
    });
    live.nominees.forEach(function (n) {
      assert(liveIds[n.label], "bestLiveOps nominee is a liveops title " + n.label);
    });
    const early = (st.worldReleased || []).filter(function (row) { return row.id === "wowClassicLike"; })[0];
    if (early) {
      const earlyInLive = (live.nominees || []).some(function (n) { return n.titleId === "wowClassicLike"; }) || live.titleId === "wowClassicLike";
      const earlyInGoty = (goty.nominees || []).some(function (n) { return n.titleId === "wowClassicLike"; });
      assert(sim.liveOpsAwardEligible(early, 2004, config), "2002 liveops still eligible in 2004");
      assert(!earlyInGoty, "prior-year liveops does not take boxed GOTY window");
      void earlyInLive;
    }
    ok("career bestLiveOps fills from ongoing liveops");
  })();

  (function companyBestLiveOpsKeepsOperatingRivals() {
    const g = sim.createNewGame("奖", config);
    g.year = 2016;
    g.month = 3;
    sim.forceRivalRelease(g, {
      title: "长线测",
      series: "长线测",
      publisherName: "测厂",
      avg: 8.8,
      sales: 40000,
      live: true,
      livePeak: 9000
    }, config);
    assert((g.rivalReleased || []).some(function (row) { return row.title === "长线测" && row.live; }), "live rival persisted");
    g.year = 2017;
    g.month = 11;
    g.rivalWindow = [];
    const pack = sim.runAwards(g, config, []);
    const live = pack.filter(function (a) { return a.id === "bestLiveOps"; })[0];
    assert(live && live.nominees && live.nominees.length >= 1, "company bestLiveOps has nominees");
    assert(String(live.w).indexOf("长线测") >= 0, "operating live rival still wins bestLiveOps, got " + live.w);
    ok("company bestLiveOps uses still-operating live rivals");
  })();

  (function liveOpsVersionsAreMobileOnlyAndNamed() {
    const spec = config.liveOps.versions;
    assert(spec && spec.requiresMobile && spec.mobileIntervalMonths && spec.minorPerMajor, "versions config present");
    const label = sim.liveOpsVersionLabel("原神", { major: 2, minor: 0 }, config);
    assert(label === "原神.2.0", "label 原神.2.0 got " + label);
    const mobile = {
      releaseType: "liveops",
      platformId: "mobile",
      releasedYear: 2016,
      releasedMonth: 3,
      liveOps: { active: true }
    };
    const pc = {
      releaseType: "liveops",
      platformId: "pc",
      releasedYear: 2016,
      releasedMonth: 3,
      liveOps: { active: true }
    };
    assert(sim.liveOpsUsesVersions(mobile, config), "mobile liveops uses versions");
    assert(!sim.liveOpsUsesVersions(pc, config), "pc-only liveops skips versions");
    const v11 = sim.liveOpsVersionDueAt(mobile, 2016, 5, config);
    assert(v11 && v11.major === 1 && v11.minor === 1, "two months later is 1.1");
    const v20 = sim.liveOpsVersionDueAt(mobile, 2017, 3, config);
    assert(v20 && v20.major === 2 && v20.minor === 0, "minorPerMajor later is 2.0 got " + JSON.stringify(v20));
    assert(!sim.liveOpsVersionDueAt(mobile, 2016, 3, config), "launch month is 1.0 not an update");
    ok("liveops versions: mobile only, 原神.2.0 naming");
  })();

  (function playerMobileLiveOpsShipsVersionOnTick() {
    let g = hireOne(9090);
    g.company.scale = "medium";
    g.year = 2016;
    g.month = 5;
    const sid = g.staff[0].id;
    g.staff[0].status = "liveops";
    g.staff[0].assignmentId = "live-1";
    g.released.push({
      id: "live-1",
      title: "测长线",
      platformId: "mobile",
      releaseType: "liveops",
      releasedYear: 2016,
      releasedMonth: 3,
      stats: { program: 40, script: 40, art: 40, music: 40 },
      avg: 7,
      liveOps: {
        active: true,
        maintainerIds: [sid],
        monthsLive: 2,
        peak: 100,
        versionMajor: 1,
        versionMinor: 0
      }
    });
    const snap = JSON.stringify(g);
    const a = sim.tickMonth(JSON.parse(snap), config);
    const b = sim.tickMonth(JSON.parse(snap), config);
    assert(JSON.stringify(a.state.released[0].liveOps) === JSON.stringify(b.state.released[0].liveOps), "version tick replays");
    const rec = a.state.released[0];
    assert(rec.liveOps.versionMajor === 1 && rec.liveOps.versionMinor === 1, "ticked to 1.1 got " + rec.liveOps.versionMajor + "." + rec.liveOps.versionMinor);
    const body = (a.queue || []).map(function (q) { return q.body || q.title || ""; }).join(" ");
    assert(body.indexOf("测长线.1.1") >= 0, "notes include 测长线.1.1 " + body);
    const pcGame = JSON.parse(snap);
    pcGame.released[0].platformId = "pc";
    const pcTick = sim.tickMonth(pcGame, config);
    assert(pcTick.state.released[0].liveOps.versionMinor === 0, "pc liveops does not version");
    ok("player mobile liveops versions on tick, pc does not");
  })();

  (function careerCalendarShowsGenshinVersions() {
    const g = sim.createCareerGame("测", "programmer", config);
    const acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config);
    const pack = sim.careerYearReleases(2021, config, acc.state);
    const drops = [];
    Object.keys(pack.months).forEach(function (m) {
      (pack.months[m] || []).forEach(function (t) {
        if (t.isVersion && String(t.id).indexOf("genshin-") === 0) drops.push(t);
      });
    });
    assert(drops.length > 0, "genshin versions appear on 2021 calendar");
    const v20 = drops.filter(function (t) {
      return t.month === 9 && t.versionMajor === 2 && t.versionMinor === 0;
    })[0];
    assert(v20, "2021.9 has 原神.2.0");
    assert(v20.label === "原神.2.0", "label " + v20.label);
    const wowPack = sim.careerYearReleases(2005, config, acc.state);
    let wowVer = 0;
    Object.keys(wowPack.months).forEach(function (m) {
      (wowPack.months[m] || []).forEach(function (t) {
        if (t.isVersion && String(t.id).indexOf("wow-") === 0) wowVer += 1;
      });
    });
    assert(wowVer === 0, "pc wow has no mobile-style versions");
    ok("career calendar lists genshin.2.0 and skips pc mmo versions");
  })();

  (function createNewGameStillCompanyMode() {
    const g = sim.createNewGame("经营社", config);
    assert(g.mode !== "career", "company game not career");
    assert(g.year === config.calendar.startYear, "still 2015 company start");
    ok("createNewGame company path unchanged");
  })();

  (function careerSalaryStepsAndInflation() {
    const steps = (((config.careerWorld || {}).personalEconomy || {}).salary || {}).steps || [];
    assert(steps.length >= 8, "salary steps table");
    for (let i = 1; i < steps.length; i++) assert(steps[i] > steps[i - 1], "salary steps monotonic " + steps[i]);
    const g = sim.createCareerGame("测", "programmer", config);
    const mid = (config.careerWorld.companies || []).filter(function (c) {
      return c.power === 2 && c.salaryMult === 1 && c.joinable !== false;
    })[0] || sim.careerCompany("sega", config);
    const junior = sim.careerSalaryFor(mid, 1995, config, g.career);
    assert(steps.indexOf(junior) >= 0, "1995 salary in steps " + junior);
    assert(junior === 3000, "1995 newbie about 3000, got " + junior);
    (g.career.openingOffers || []).forEach(function (o) {
      assert(steps.indexOf(o.salary) >= 0, "opening salary in steps " + o.salary);
    });
    const grown = sim.clone(g);
    grown.career.stats = { program: 120, design: 100, art: 100, music: 100 };
    grown.career.fame = 180;
    grown.career.honor = 24;
    grown.year = 2024;
    const nintendo = sim.careerCompany("nintendo", config);
    const late = sim.careerSalaryFor(nintendo, 2024, config, grown.career);
    assert(steps.indexOf(late) >= 0, "late salary in steps " + late);
    assert(late >= 10000, "high stats fame late years reach 万级, got " + late);
    const y1 = sim.careerSalaryFor(mid, 2000, config, g.career);
    const y2 = sim.careerSalaryFor(mid, 2001, config, g.career);
    assert(steps.indexOf(y1) >= 0 && steps.indexOf(y2) >= 0, "inflation salaries in steps");
    assert(y2 >= y1, "same person next year salary not lower " + y1 + " -> " + y2);
    ok("career salary snaps to steps, 1995~3000, growth and inflation");
  })();

  (function careerYearEndOffersStudiosAndHopRules() {
    const nintendo = sim.careerCompany("nintendo", config);
    assert(nintendo && nintendo.studios && nintendo.studios.length >= 2, "nintendo has 2+ studios");
    ["sony", "sega", "square", "squareEnix", "capcom", "ea", "blizzard", "activision", "tencent", "netease", "mihoyo", "ubisoft", "rockstar"].forEach(function (id) {
      const co = sim.careerCompany(id, config);
      if (!co || co.joinable === false) return;
      assert(co.studios && co.studios.length >= 2, id + " has 2+ studios");
    });
    const titled = (config.careerWorld.titles || []).filter(function (t) {
      return t.companyId === "nintendo" && t.studioId;
    });
    assert(titled.length >= 1, "nintendo titles hang studioId");

    let st = sim.createCareerGame("测", "programmer", config);
    st = sim.acceptOpeningOffer(st, st.career.openingOffers[0].id, config).state;
    st.career.companyId = "nintendo";
    st.career.studioId = nintendo.studios[0].id;
    st.year = 1998;
    st.month = 12;
    const list = sim.listYearEndOffers(st, config);
    assert(list.length === 5, "year-end list length 5, got " + list.length);
    const internals = list.filter(function (o) { return o.internal; });
    assert(internals.length <= 2, "internal offers <= 2, got " + internals.length);
    internals.forEach(function (o, i) {
      assert(list[i].internal, "internals come first at " + i);
      assert(o.studioId && o.studioId !== st.career.studioId, "internal is another studio");
    });
    list.forEach(function (o) {
      assert(typeof o.successChance === "number", "successChance on offer");
      assert(o.studioId, "offer studioId");
    });

    const failList = sim.listYearEndOffers(st, config);
    failList[0].successChance = 0;
    st.career.yearEndOffers = failList;
    const liveBefore = { program: 91, design: 88, art: 84, music: 80 };
    st.career.titleId = "oot";
    st.career.liveStats = { program: 91, design: 88, art: 84, music: 80 };
    st.career.credits = [{ titleId: "oot", companyId: "nintendo", roleId: "programmer" }];
    const failed = sim.applyYearEndOffer(st, failList[0].id, config);
    assert(failed.ok && failed.hopped === false, "failed apply still ok, not hopped");
    assert(failed.state.career.hopFailedYear === failed.state.year, "hopFailedYear set");
    assert(failed.state.career.companyId === "nintendo", "stay at nintendo on fail");
    const again = sim.applyYearEndOffer(failed.state, failList[1] ? failList[1].id : failList[0].id, config);
    assert(!again.ok && again.error === sim.ERR.CAREER_HOP_WAIT, "same year cannot apply again");
    const nextYear = sim.clone(failed.state);
    nextYear.year = failed.state.year + 1;
    nextYear.career.hopFailedYear = failed.state.career.hopFailedYear;
    nextYear.career.yearEndOffers = sim.listYearEndOffers(nextYear, config);
    nextYear.career.yearEndOffers[0].successChance = 1;
    const retry = sim.applyYearEndOffer(nextYear, nextYear.career.yearEndOffers[0].id, config);
    assert(retry.ok && retry.hopped === true, "next year can apply");

    let hopSt = sim.createCareerGame("测", "art", config);
    hopSt = sim.acceptOpeningOffer(hopSt, hopSt.career.openingOffers[0].id, config).state;
    hopSt.career.companyId = "nintendo";
    hopSt.career.studioId = nintendo.studios[0].id;
    hopSt.year = 1998;
    hopSt.month = 6;
    hopSt.career.titleId = "oot";
    hopSt.career.liveStats = { program: 91, design: 88, art: 84, music: 80 };
    hopSt.career.credits = [{ titleId: "oot", companyId: "nintendo", roleId: "art" }];
    hopSt.career.yearEndOffers = sim.listYearEndOffers(hopSt, config);
    const hopTarget = (hopSt.career.yearEndOffers || []).filter(function (o) {
      return o.companyId !== "nintendo";
    })[0] || hopSt.career.yearEndOffers[0];
    hopTarget.successChance = 1;
    const mid = sim.applyYearEndOffer(hopSt, hopTarget.id, config);
    assert(mid.ok && mid.hopped, "mid-project hop allowed");
    const left = (mid.state.career.leftProjectLive || {}).oot;
    assert(left && left.program === 91 && left.design === 88, "left project live unchanged");
    assert(!(mid.state.career.credits || []).some(function (c) { return c.titleId === "oot"; }), "player credit removed");
    assert(mid.state.career.companyId === hopTarget.companyId, "joined new company");
    assert(mid.state.career.studioId, "join writes studioId");

    hopSt.career.invites = [{
      id: "inv-test",
      titleId: "chronoTrigger",
      companyId: "square",
      studioId: "square-rd3",
      roleId: "art",
      salary: 4000
    }];
    const beforeCo = hopSt.career.companyId;
    const inv = sim.acceptCareerInvite(hopSt, "inv-test", config);
    assert(inv.ok, "invite accept ok");
    assert(inv.state.career.companyId === "square", "invite hops without dice");
    assert(inv.state.career.companyId !== beforeCo || hopSt.career.companyId === "square", "invite company set");
    ok("year-end 5 offers, hop fail cooldown, invite sure, mid hop strips credit");
  })();

  (function careerPostLaunchAndPlayerSkill() {
    const pl = (config.careerWorld || {}).postLaunch || {};
    const px = (config.careerWorld || {}).playerXp || {};
    const chrono = sim.careerTitle("chronoTrigger", config);
    assert(chrono && chrono.genreId && chrono.gameplayId, "chrono catalog");

    const g = sim.createCareerGame("测", "programmer", config);
    assert(g.career.genreXp && typeof g.career.genreXp === "object", "genreXp default");
    assert(g.career.gameplayXp && typeof g.career.gameplayXp === "object", "gameplayXp default");
    assert(!sim.careerPostLaunch(g), "new game no postLaunch");
    let acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config);
    let st = acc.state;
    st.career.companyId = "square";
    st.career.studioId = (sim.careerCompany("square", config).studios || [])[0] && sim.careerCompany("square", config).studios[0].id;
    st.career.titleId = "chronoTrigger";
    st.career.liveStats = { program: 90, design: 95, art: 88, music: 92 };
    st.career.credits = [{ titleId: "chronoTrigger", companyId: "square", roleId: "programmer" }];
    st.year = 1995;
    st.month = 3;
    const gxp0 = sim.playerXpValue(st, "genre", chrono.genreId);
    const pxp0 = sim.playerXpValue(st, "gameplay", chrono.gameplayId);
    const notes = [];
    const queue = [];
    sim.shipPlayerTitle(st, config, notes, queue);
    assert(st.career.titleId === "chronoTrigger", "player title stays after ship");
    assert(st.career.liveStats, "live stays for postLaunch");
    const support = sim.careerPostLaunch(st);
    assert(support && support.titleId === "chronoTrigger", "entered postLaunch");
    assert(support.monthsLeft >= pl.monthsMin && support.monthsLeft <= pl.monthsMax, "monthsLeft in config range " + support.monthsLeft);
    const view = sim.careerProjectView(st, config);
    assert(view.postLaunch && !view.idle, "view shows postLaunch not idle");
    assert(view.phase && (view.phase.id === "support" || sim.worldLabel(view.phase, config)), "postLaunch phase label");
    assert(sim.playerXpValue(st, "genre", chrono.genreId) > gxp0, "genreXp up on ship");
    assert(sim.playerXpValue(st, "gameplay", chrono.gameplayId) > pxp0, "gameplayXp up on ship");
    const left = support.monthsLeft;
    const shippedId = st.career.titleId;
    let i;
    for (i = 0; i < left; i++) {
      assert(st.career.titleId === shippedId, "still on shipped title month " + i);
      assert(sim.careerPostLaunch(st), "still postLaunch month " + i);
      st = sim.tickMonth(st, config).state;
    }
    assert(!sim.careerPostLaunch(st), "postLaunch ended after monthsLeft ticks");
    assert(st.career.titleId !== shippedId, "cleared shipped title, maybe next project");

    let hopSt = sim.createCareerGame("测", "art", config);
    hopSt = sim.acceptOpeningOffer(hopSt, hopSt.career.openingOffers[0].id, config).state;
    hopSt.career.companyId = "square";
    hopSt.career.titleId = "chronoTrigger";
    hopSt.career.liveStats = { program: 80, design: 80, art: 90, music: 80 };
    hopSt.career.credits = [{ titleId: "chronoTrigger", companyId: "square", roleId: "art" }];
    hopSt.career.yearEndOffers = [{
      id: "ye-hop-pl",
      companyId: "nintendo",
      studioId: (sim.careerCompany("nintendo", config).studios || [])[0].id,
      roleId: "art",
      salary: 4000,
      successChance: 1
    }];
    const hopped = sim.applyYearEndOffer(hopSt, "ye-hop-pl", config);
    assert(hopped.ok && hopped.hopped, "hopped off before ship");
    assert(!(hopped.state.career.credits || []).some(function (c) { return c.titleId === "chronoTrigger"; }), "credit stripped");
    hopSt = hopped.state;
    hopSt.year = 1995;
    hopSt.month = 3;
    hopSt.career.postLaunch = null;
    sim.shipWorldTitlesThisMonth(hopSt, config);
    assert(!sim.careerPostLaunch(hopSt), "hopped player does not enter postLaunch");
    const rec = (hopSt.worldReleased || []).filter(function (g) { return g.id === "chronoTrigger"; })[0];
    assert(rec && !rec.player, "world ship without player credit");

    const low = sim.createCareerGame("测", "art", config);
    const high = sim.createCareerGame("测", "art", config);
    const t = sim.careerTitle("ff7", config);
    low.career.companyId = "square";
    high.career.companyId = "square";
    high.career.genreXp[t.genreId] = 80;
    high.career.gameplayXp[t.gameplayId] = 80;
    const liveLow = sim.careerLiveFromTitle(low, t, config);
    const liveHigh = sim.careerLiveFromTitle(high, t, config);
    const artStat = (sim.careerRole("art", config) || {}).stat || "art";
    assert(liveHigh[artStat] > liveLow[artStat], "high skill raises main live");
    assert(liveHigh.program === liveLow.program, "player skill does not lift other dims");
    low.career.titleId = "ff7";
    high.career.titleId = "ff7";
    assert(sim.careerMonthlyContribution(high, config) > sim.careerMonthlyContribution(low, config), "high skill raises contrib");
    assert(px.xpPerDevMonth != null && px.xpPerRelease != null && px.xpPerPostLaunchMonth != null, "player xp amounts in config");
    ok("postLaunch occupancy, hop skip, player skill live/contrib");
  })();


  console.log("\n" + passed + " tests passed");
}

try {
  main();
} catch (e) {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
}
