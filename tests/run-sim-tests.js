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
  "careerLines.js",
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
      if (c.joinable === true) {
        const seniors = c.seniors || [];
        assert(seniors.length >= 1, "joinable company needs 前辈 " + c.id);
        seniors.forEach(function (s) {
          assert(s.id && s.name && s.title, "senior fields " + c.id + "/" + (s && s.id));
          assert(s.bio, "senior bio " + c.id + "/" + s.id);
        });
      }
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
    const openingSmall = companies.filter(function (c) { return c.openingOffer && c.starterTier === "small"; });
    assert(openingSmall.length >= 16, "opening small pool " + openingSmall.length);
    const openingBig = companies.filter(function (c) { return c.openingOffer && c.starterTier && c.power === 3; });
    assert(openingBig.length <= 3, "few opening 大厂 " + openingBig.map(function (c) { return c.id; }).join(","));
    assert(companies.filter(function (c) { return c.id === "nintendo"; })[0].openingOffer === false, "nintendo not opening");
    const paper = companies.filter(function (c) { return c.id === "paperGames"; })[0];
    const crytek = companies.filter(function (c) { return c.id === "crytek"; })[0];
    assert(paper && paper.joinable === true && (paper.seniors || []).length >= 1, "paperGames hop pool");
    assert(crytek && crytek.joinable === true && (crytek.seniors || []).length >= 1, "crytek hop pool");
    assert(sim.companyJoinable(paper, 2013), "paperGames hire from 2013");
    assert(!sim.companyJoinable(paper, 2012), "paperGames closed before 2013");
    assert(sim.companyJoinable(crytek, 1999), "crytek hire from 1999");
    assert(!sim.companyJoinable(crytek, 1998), "crytek closed before 1999");
    const noCatalog = companies.filter(function (c) {
      return c.joinable && !titles.some(function (t) { return t.companyId === c.id; });
    });
    assert(!noCatalog.length, "joinable companies have catalog: " + noCatalog.map(function (c) { return c.id; }).join(", "));
    const paperTitles = titles.filter(function (t) { return t.companyId === "paperGames"; });
    assert(paperTitles.length >= 5, "paperGames has catalog titles " + paperTitles.length);
    const paperReturn = (world.eventLines.bonds.returnInvite.titlesByCompany || {}).paperGames;
    assert(paperReturn, "paperGames returnInvite title");
    const paperJunior = (world.eventLines.bonds.juniorRevealPool || []).filter(function (p) { return p.seniorId === "yao-runhao"; })[0];
    assert(paperJunior && paperJunior.titleId, "paperGames junior reveal has titleId");
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
    assert(world.devEvents.minGapMonths === 2 && world.devEvents.pityMonths === 6 && world.devEvents.maxPerYear === 5, "devEvent cadence keys");
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
    assert(pl.monthsMin === 0 && pl.monthsMax === 0, "postLaunch occupancy off");
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
    const vp = world.virtualPool || {};
    assert(vp.devMonthsMin === 6 && vp.devMonthsMax === 24, "virtual pool 6-24");
    const gap = world.idleGap || {};
    assert(gap.minDevMonths === 6, "idleGap minDevMonths");
    assert(gap.eventId && (gap.choices || []).length >= 3, "idleGap choices");
    ["secondment", "crossTrain", "hone"].forEach(function (id) {
      assert((gap.choices || []).some(function (c) { return c.id === id; }), "idleGap choice " + id);
    });
    const late = world.lateJoin || {};
    assert(late.progressMin != null, "lateJoin progressMin");
    assert(late.hopHireChanceMul != null && late.hopHireChanceMul < 1, "lateJoin hop mul");
    assert(world.save && world.save.version >= 9, "career saveVersion");
    const ranks = world.jobRanks || {};
    assert(ranks.min === 1 && ranks.max === 6, "jobRanks 1-6");
    assert(ranks.codeSeries && ranks.codeSeries.programmer === "T" && ranks.codeSeries.design === "D" && ranks.codeSeries.art === "A" && ranks.codeSeries.music === "M", "rank code series T/D/A/M");
    ["programmer", "design", "art", "music"].forEach(function (role) {
      assert(ranks.titles && ranks.titles[role] && ranks.titles[role].length === 6, "job titles " + role);
      ranks.titles[role].forEach(function (row) {
        assert(row.code != null, "title code " + role + " " + row.id);
      });
    });
    const nintendoSeniors = ((sim.careerCompany("nintendo", config) || {}).seniors || []).map(function (s) { return s.name; });
    assert(nintendoSeniors.indexOf("宫本茂") >= 0, "nintendo has 宫本茂");
    const konamiSeniors = ((sim.careerCompany("konami", config) || {}).seniors || []).map(function (s) { return s.name; });
    assert(konamiSeniors.indexOf("小岛秀夫") >= 0, "konami has 小岛秀夫");
    const mihoyoSeniors = ((sim.careerCompany("mihoyo", config) || {}).seniors || []).map(function (s) { return s.name; });
    assert(mihoyoSeniors.indexOf("大伟哥") >= 0, "mihoyo has 大伟哥");
    ok("career world catalog: companies, titles, details, alias switch");
  })();

  (function catalogStatJitterIsIntegerPctCeil() {
    const q = config.careerWorld.quality;
    assert(q.statJitterMinPct === -10 && q.statJitterMaxPct === 10, "jitter range in config");
    const tweaked = deepClone(config);
    tweaked.careerWorld.quality.statJitterMinPct = 7;
    tweaked.careerWorld.quality.statJitterMaxPct = 7;
    const st = { rngSeed: 1, rngCount: 0 };
    const out = sim.applyCatalogStatJitter(st, { program: 85, design: 85, art: 85, music: 85 }, tweaked);
    assert(out.program === 91 && out.design === 91 && out.art === 91 && out.music === 91, "85 * 1.07 ceil -> 91");
    tweaked.careerWorld.quality.statJitterMinPct = -10;
    tweaked.careerWorld.quality.statJitterMaxPct = -10;
    const down = sim.applyCatalogStatJitter({ rngSeed: 1, rngCount: 0 }, { program: 85, design: 10, art: 0, music: 100 }, tweaked);
    assert(down.program === 77, "85 * 0.9 ceil -> 77");
    assert(down.design === 9, "10 * 0.9 ceil -> 9");
    assert(down.art === 0, "0 stays 0");
    assert(down.music === 90, "100 * 0.9 ceil -> 90");
    const a = sim.applyCatalogStatJitter({ rngSeed: 42, rngCount: 0 }, { program: 76, design: 82, art: 96, music: 97 }, config);
    const b = sim.applyCatalogStatJitter({ rngSeed: 42, rngCount: 0 }, { program: 76, design: 82, art: 96, music: 97 }, config);
    assert(JSON.stringify(a) === JSON.stringify(b), "same seed same jitter");
    ["program", "design", "art", "music"].forEach(function (k) {
      const base = { program: 76, design: 82, art: 96, music: 97 }[k];
      const lo = Math.ceil(base * 0.9);
      const hi = Math.ceil(base * 1.1);
      assert(a[k] >= lo && a[k] <= hi && a[k] === Math.floor(a[k]), "jitter integer in range " + k);
    });
    const g = sim.createCareerGame("测", "programmer", config);
    const rec = (g.worldReleased || []).filter(function (t) { return t.id; })[0];
    const catalog = rec && sim.careerTitle(rec.id, config);
    if (rec && catalog && catalog.stats) {
      ["program", "design", "art", "music"].forEach(function (k) {
        const base = catalog.stats[k];
        const lo = Math.ceil(base * 0.9);
        const hi = Math.ceil(base * 1.1);
        assert(rec.stats[k] >= lo && rec.stats[k] <= hi, "worldReleased " + rec.id + "." + k);
      });
    }
    ok("catalog stat jitter is integer pct then ceil");
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

  (function mediaQuotePoolsPerOutlet() {
    const pools = (config.copy && config.copy.mediaQuotePools && config.copy.mediaQuotePools.outlets) || {};
    const ids = (config.release.media.outlets || []).map(function (o) { return o.id; });
    assert(ids.length === 5, "five outlets");
    ids.forEach(function (id) {
      const p = pools[id];
      assert(p && p.high && p.mid && p.low, "outlet quote bands " + id);
      assert(p.high.length >= 18 && p.mid.length >= 18 && p.low.length >= 18, "outlet quote volume " + id);
    });
    const g = sim.createNewGame("评", config);
    const media = sim.scoreMedia(g, { program: 90, script: 88, art: 86, music: 84 }, [], config, null);
    media.rows.forEach(function (row) {
      const p = pools[row.id];
      const all = (p.high || []).concat(p.mid || []).concat(p.low || []);
      assert(all.indexOf(row.quote) >= 0, "quote from outlet pool " + row.id);
    });
    ok("media quote pools are per-outlet and used");
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
    assert(g.career.jobRank === 1, "start Lv.1");
    assert(sim.careerJobTitleLabel(g, config) === "代码实习生", "programmer intern title");
    assert(sim.formatCareerRankLabel("programmer", 1, config) === "代码实习生 (T-0)", "programmer intern code");
    assert(sim.careerJobTitleDisplay(g, config) === "代码实习生 (T-0)", "programmer intern display");
    assert(g.career.stats.program >= 22 && g.career.stats.program <= 26, "main stat in 20s");
    assert(g.career.stats.art >= 16 && g.career.stats.art <= 20, "off-dim in teens");
    assert(g.career.stats.program < 40, "main not in 40s");
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
      const seniorLine = sim.careerSeniorLine(co, config);
      assert(seniorLine.indexOf("前辈") === 0 && seniorLine.length > 3, "opening offer 前辈 " + o.companyId);
    });
    ok("career new game: 1995, three-tier offers, role locked");
  })();

  (function careerRankCodeFormatting() {
    assert(sim.careerRankCode("programmer", 1, config) === "T-0", "T-0");
    assert(sim.formatCareerRankLabel("programmer", 4, config) === "高级程序员 (T-3)", "T-3");
    assert(sim.formatCareerRankLabel("programmer", 6, config) === "技术总监 (T-5)", "T-5");
    assert(sim.formatCareerRankLabel("design", 5, config) === "主策划 (D-4)", "D-4");
    assert(sim.formatCareerRankLabel("art", 2, config) === "初级美术 (A-1)", "A-1");
    assert(sim.formatCareerRankLabel("art", 5, config) === "主美 (A-4)", "A-4");
    assert(sim.formatCareerRankLabel("music", 1, config) === "音频实习生 (M-0)", "M-0");
    assert(sim.formatCareerRankLabel("music", 6, config) === "音频总监 (M-5)", "M-5");
    const promo = sim.careerPromotionView(sim.createCareerGame("测", "design", config), config);
    assert(promo.currentLabel === "策划实习生 (D-0)", "promo view uses rank code");
    const line = sim.careerSeniorLine("nintendo", config);
    assert(line.indexOf("宫本茂") >= 0 && line.indexOf("制作总监") >= 0, "senior label has title");
    ok("career rank codes T/D/A/M and 前辈 line");
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
    tweaked.careerWorld.devEvents.minGapMonths = 0;
    tweaked.careerWorld.devEvents.pityMonths = 0;
    tweaked.careerWorld.devEvents.maxPerYear = 99;
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
    st.career.jobRank = 6;
    st.career.stats.program = 90;
    st.career.liveStats = { program: 95, design: 90, art: 88, music: 92 };
    st.career.credits = [{ titleId: "chronoTrigger", companyId: "square", roleId: "programmer" }];
    st.rngSeed = 1;
    st.rngCount = 0;
    const ev = sim.rollCareerDevEvent(st, tweaked, []);
    assert(ev && ev.id === "testBurst", "burst event rolled");
    assert(st.career.liveStats.program > 100, "live can exceed 100, got " + st.career.liveStats.program);
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
    tweaked.careerWorld.devEvents.minGapMonths = 0;
    tweaked.careerWorld.devEvents.pityMonths = 0;
    tweaked.careerWorld.devEvents.maxPerYear = 99;
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
    tweaked.careerWorld.devEvents.minGapMonths = 0;
    tweaked.careerWorld.devEvents.pityMonths = 0;
    tweaked.careerWorld.devEvents.maxPerYear = 99;
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
    const f = sim.careerPlayerImpactFactor(t1.state, tweaked);
    assert(a.state.career.liveStats.program === t1.state.career.liveStats.program + 7 * f, "push raises program by scaled delta");
    assert(a.state.career.liveStats.art === artBefore - 4 * f, "push drops art by scaled delta");
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
    const hist = r.state.awardsHistory;
    assert(Array.isArray(hist) && hist.length >= 3, "awardsHistory years " + (hist && hist.length));
    const years = hist.map(function (h) { return h.year; });
    assert(years.indexOf(1995) >= 0 && years.indexOf(1996) >= 0 && years.indexOf(1997) >= 0, "history has 95-97");
    const listed = sim.listAwardsHistory(r.state, config);
    assert(listed[0] && listed[0].year === 1997, "listAwardsHistory newest first");
    pack.forEach(function (a) {
      assert(typeof a.playerWon === "boolean", "playerWon flag " + a.id);
      assert(a.year === 1997, "award year stamped " + a.id);
      assert(a.n.indexOf("1997") < 0, "category name has no year " + a.n);
    });
    const night = r.queue.filter(function (p) { return p.type === "awards"; })[0];
    assert(night && night.title === "1997年颁奖夜", "night title has year");
    assert(night.kicker === "1997年度盛典", "night kicker has year");
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
    assert(typeof st.lastMedia.launchSales === "number", "career media rec has launchSales");
    assert(st.lastMedia.launchSales > 0, "career launchSales > 0");
    (function assertCareerLaunchMatchesFormula() {
      const packed = sim.careerLaunchSales(
        sim.careerTitle("chronoTrigger", config, st),
        st.lastMedia.score,
        config,
        st.lastMedia.liveStats || st.lastMedia.stats
      );
      const y1 = sim.salesFactor(1, st.lastMedia.score, config);
      assert(st.lastMedia.baselineSales === packed.baselineSales, "career baseline from public score coeffs");
      assert(st.lastMedia.launchSales === packed.launchSales, "career launchSales stamped on rec");
      assert(st.lastMedia.launchSales === sim.boxedActualFromY({ baselineSales: packed.baselineSales }, y1), "career launch is baseline×Y(1)");
      const mediaPage = queue.filter(function (q) { return q.type === "media"; })[0];
      assert(mediaPage && mediaPage.rec && mediaPage.rec.launchSales === packed.launchSales, "queued media rec carries launchSales");
    })();
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
      if (o.kind === "promotion" || o.kind === "promotionLine") {
        assert(o.roleId === "music", "promo keeps specialty");
      } else {
        assert(["programmer", "art", "design", "music"].indexOf(o.roleId) >= 0, "hop staff role " + o.roleId);
        assert(o.roleId !== "producer", "producer hop locked before line done");
      }
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

  (function careerVirtualClampedToNextCatalog() {
    const vp = config.careerWorld.virtualPool || {};
    assert(vp.devMonthsMax === 24 && vp.devMonthsMin === 6, "virtual 6-24");
    let g = sim.createCareerGame("测", "programmer", config);
    let st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
    st.career.companyId = "fromsoftware";
    st.career.studioId = "fromsoftware-main";
    st.career.titleId = null;
    st.year = 1995;
    st.month = 1;
    const virt = sim.startVirtualProject(st, config);
    assert(virt && virt.virtual, "fromsoftware 1995 starts virtual");
    const vdet = sim.careerTitleDetail(virt.id, config, st);
    assert(vdet.devMonths >= 6 && vdet.devMonths <= 24, "virtual months in pool range");

    const tweaked = deepClone(config);
    tweaked.careerWorld = deepClone(config.careerWorld);
    tweaked.careerWorld.titles = (tweaked.careerWorld.titles || []).concat([{
      id: "gapLongProbe",
      companyId: "fromsoftware",
      studioId: "fromsoftware-main",
      name: "长空窗探针",
      alias: "长空窗探针",
      releaseYear: 1997,
      releaseMonth: 1,
      score: 7,
      platforms: ["pc"],
      genreId: "fantasy",
      gameplayId: "rpg",
      releaseType: "boxed",
      stats: { program: 70, design: 70, art: 70, music: 70 }
    }]);
    tweaked.careerWorld.titleDetails = (tweaked.careerWorld.titleDetails || []).concat([{
      id: "gapLongProbe",
      devStartYear: 1995,
      devStartMonth: 11,
      devMonths: 14
    }]);
    g = sim.createCareerGame("测", "programmer", tweaked);
    st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tweaked).state;
    st.career.companyId = "fromsoftware";
    st.career.studioId = "fromsoftware-main";
    st.career.titleId = null;
    st.year = 1995;
    st.month = 1;
    assert(sim.catalogGapMonths(st, tweaked, "fromsoftware", "fromsoftware-main") === 10, "gap 10 months");
    const clamped = sim.startVirtualProject(st, tweaked);
    const cdet = sim.careerTitleDetail(clamped.id, tweaked, st);
    assert(clamped && clamped.virtual, "gap>=6 starts virtual");
    assert(cdet.devMonths >= 6 && cdet.devMonths <= 10, "virtual clamped to gap");
    ok("virtual duration clamped to next catalog");
  })();

  (function careerShortIdleGapOnceAndHop() {
    const gapSpec = config.careerWorld.idleGap || {};
    const tweaked = deepClone(config);
    tweaked.careerWorld = deepClone(config.careerWorld);
    tweaked.careerWorld.titles = (tweaked.careerWorld.titles || []).concat([{
      id: "gapProbe",
      companyId: "fromsoftware",
      studioId: "fromsoftware-main",
      name: "空窗探针",
      alias: "空窗探针",
      releaseYear: 1995,
      releaseMonth: 8,
      score: 7,
      platforms: ["pc"],
      genreId: "fantasy",
      gameplayId: "rpg",
      releaseType: "boxed",
      stats: { program: 70, design: 70, art: 70, music: 70 }
    }]);
    tweaked.careerWorld.titleDetails = (tweaked.careerWorld.titleDetails || []).concat([{
      id: "gapProbe",
      devStartYear: 1995,
      devStartMonth: 5,
      devMonths: 3,
      inviteEligible: false
    }]);
    let g = sim.createCareerGame("测", "programmer", tweaked);
    let st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tweaked).state;
    st.career.companyId = "fromsoftware";
    st.career.studioId = "fromsoftware-main";
    st.career.titleId = null;
    st.career.liveStats = null;
    st.career.idleGap = null;
    st.career.idleMonths = 9;
    st.year = 1995;
    st.month = 1;
    assert(sim.catalogGapMonths(st, tweaked, "fromsoftware", "fromsoftware-main") === 4, "short gap 4");
    assert(!sim.startVirtualProject(st, tweaked), "short gap no virtual");
    const q = [];
    sim.assignCareerProject(st, tweaked, q);
    assert(!st.career.titleId, "stays off title");
    assert(q.length === 1 && q[0].eventId === (gapSpec.eventId || "idle-gap"), "idle gap queued");
    sim.assignCareerProject(st, tweaked, []);
    assert(st.career.idleGap && st.career.idleGap.prompted, "still prompted");
    const q2 = [];
    sim.assignCareerProject(st, tweaked, q2);
    assert(q2.length === 0, "not queued again");
    const prog0 = st.career.stats.program;
    const design0 = st.career.stats.design;
    const picked = sim.resolveEventChoice(st, gapSpec.eventId || "idle-gap", "crossTrain", tweaked);
    assert(picked.ok, "resolve idle gap");
    st = picked.state;
    assert(st.career.idleGap.settled, "settled once");
    assert(st.career.stats.design > design0, "off-stat up");
    assert(st.career.stats.program === prog0, "main stat unchanged");
    const again = sim.resolveEventChoice(st, gapSpec.eventId || "idle-gap", "hone", tweaked);
    assert(again.state.career.stats.program === st.career.stats.program, "no second apply");
    st.month = 12;
    st.career.yearEndOffers = [];
    assert(sim.canCareerHop(st, tweaked), "hop allowed in short gap");
    const ticked = sim.tickCareerMonth(st, tweaked);
    assert((ticked.queue || []).some(function (p) { return p.type === "hop"; }), "December hop in short gap");
    st = ticked.state;
    st.year = 1995;
    st.month = 5;
    st.career.companyId = "fromsoftware";
    st.career.studioId = "fromsoftware-main";
    st.career.titleId = null;
    st.career.idleGap = null;
    sim.assignCareerProject(st, tweaked);
    assert(st.career.titleId === "gapProbe", "hangs next catalog after gap");
    ok("short idle gap once, hop allowed, then catalog");
  })();

  (function careerLateJoinUnsignedAndDecemberShipHop() {
    const lateSpec = config.careerWorld.lateJoin || {};
    const nintendo = sim.careerCompany("nintendo", config);
    const freshCfg = deepClone(config);
    freshCfg.careerWorld = deepClone(config.careerWorld);
    freshCfg.careerWorld.titles = (freshCfg.careerWorld.titles || []).concat([{
      id: "freshProbe",
      companyId: "fromsoftware",
      studioId: "fromsoftware-main",
      name: "刚开工",
      alias: "刚开工",
      releaseYear: 1995,
      releaseMonth: 12,
      score: 7,
      platforms: ["pc"],
      genreId: "fantasy",
      gameplayId: "rpg",
      releaseType: "boxed",
      stats: { program: 70, design: 70, art: 70, music: 70 }
    }]);
    freshCfg.careerWorld.titleDetails = (freshCfg.careerWorld.titleDetails || []).concat([{
      id: "freshProbe",
      devStartYear: 1995,
      devStartMonth: 1,
      devMonths: 11,
      inviteEligible: true,
      inviteMinFame: 0,
      inviteWindow: { startYear: 1995, startMonth: 1, endYear: 1995, endMonth: 11 }
    }]);
    let earlySt = sim.createCareerGame("测", "programmer", freshCfg);
    earlySt = sim.acceptOpeningOffer(earlySt, earlySt.career.openingOffers[0].id, freshCfg).state;
    earlySt.career.companyId = "fromsoftware";
    earlySt.career.studioId = "fromsoftware-main";
    earlySt.year = 1995;
    earlySt.month = 1;
    earlySt.career.titleId = null;
    sim.assignCareerProject(earlySt, freshCfg);
    assert(earlySt.career.titleId === "freshProbe", "just-started catalog assigned");
    const freshCred = (earlySt.career.credits || []).filter(function (c) { return c.titleId === "freshProbe"; })[0];
    assert(freshCred && freshCred.signedEligible !== false, "fresh join can sign");
    assert(!sim.careerTitleIsLate(
      sim.careerTitle("freshProbe", freshCfg),
      sim.careerTitleDetail("freshProbe", freshCfg),
      1995, 1, freshCfg
    ), "progress 0 is not late");

    const lateTitle = {
      id: "lateProbe",
      companyId: "fromsoftware",
      studioId: "fromsoftware-main",
      name: "后期探针",
      alias: "后期探针",
      releaseYear: 1995,
      releaseMonth: 12,
      score: 8,
      platforms: ["pc"],
      genreId: "fantasy",
      gameplayId: "rpg",
      releaseType: "boxed",
      stats: { program: 80, design: 80, art: 80, music: 80 }
    };
    const lateDet = {
      id: "lateProbe",
      devStartYear: 1994,
      devStartMonth: 1,
      devMonths: 23,
      inviteEligible: true,
      inviteMinFame: 0,
      inviteWindow: { startYear: 1994, startMonth: 3, endYear: 1995, endMonth: 11 },
      inviteRoles: ["programmer", "art", "design", "music"]
    };
    const lateCfg = deepClone(config);
    lateCfg.careerWorld = deepClone(config.careerWorld);
    lateCfg.careerWorld.titles = (lateCfg.careerWorld.titles || []).concat([lateTitle]);
    lateCfg.careerWorld.titleDetails = (lateCfg.careerWorld.titleDetails || []).concat([lateDet]);
    assert(sim.careerTitleIsLate(lateTitle, lateDet, 1995, 6, lateCfg), "mid 1995 is late");
    let invSt = sim.createCareerGame("测", "art", lateCfg);
    invSt = sim.acceptOpeningOffer(invSt, invSt.career.openingOffers[0].id, lateCfg).state;
    invSt.career.companyId = "nintendo";
    invSt.career.studioId = nintendo.studios[0].id;
    invSt.career.fame = 99;
    invSt.year = 1995;
    invSt.month = 6;
    const invites = sim.listCareerInvites(invSt, lateCfg);
    assert(!invites.some(function (x) { return x.titleId === "lateProbe"; }), "late not invited");

    invSt.career.companyId = "fromsoftware";
    invSt.career.studioId = "fromsoftware-main";
    invSt.career.titleId = null;
    invSt.career.credits = [];
    sim.assignCareerProject(invSt, lateCfg);
    assert(invSt.career.titleId === "lateProbe", "can still be assigned late catalog");
    const lateCred = (invSt.career.credits || []).filter(function (c) { return c.titleId === "lateProbe"; })[0];
    assert(lateCred && lateCred.signedEligible === false, "late join not sign-eligible");
    invSt.career.liveStats = { program: 80, design: 80, art: 80, music: 80 };
    invSt.year = 1995;
    invSt.month = 12;
    sim.shipPlayerTitle(invSt, lateCfg, [], []);
    assert(!lateCred.shipped, "late join unsigned at ship");

    lateCfg.careerWorld.companies.forEach(function (c) {
      if (c.id !== "nintendo" && c.id !== "fromsoftware") c.joinable = false;
    });
    let hopSt = sim.createCareerGame("测", "programmer", lateCfg);
    hopSt = sim.acceptOpeningOffer(hopSt, hopSt.career.openingOffers[0].id, lateCfg).state;
    hopSt.year = 1995;
    hopSt.month = 6;
    hopSt.career.companyId = "nintendo";
    hopSt.career.studioId = nintendo.studios[0].id;
    const fromCo = sim.careerCompany("fromsoftware", lateCfg);
    const fromStudio = sim.careerStudio("fromsoftware", "fromsoftware-main", lateCfg);
    const assigned = sim.pickCareerAssignment("fromsoftware", 1995, 6, lateCfg, hopSt, "fromsoftware-main");
    assert(assigned && assigned.id === "lateProbe", "fromsoftware assignment is late probe");
    const titledChance = sim.careerHireChance(fromCo, hopSt, lateCfg, fromStudio, assigned);
    const lateOffer = sim.listYearEndOffers(hopSt, lateCfg).filter(function (o) {
      return o.companyId === "fromsoftware" && o.titleId === "lateProbe";
    })[0];
    assert(lateOffer, "fromsoftware late offer present");
    assert(lateOffer.successChance < titledChance, "late hop chance lower");
    assert(Math.abs(lateOffer.successChance - titledChance * lateSpec.hopHireChanceMul) < 1e-6, "uses hopHireChanceMul");

    let shipHop = sim.clone(earlySt);
    shipHop.career.liveStats = { program: 80, design: 80, art: 80, music: 80 };
    shipHop.year = 1995;
    shipHop.month = 12;
    const decTick = sim.tickCareerMonth(shipHop, freshCfg);
    assert((decTick.queue || []).some(function (p) { return p.type === "hop"; }), "December ship queues hop");
    assert(!sim.careerPostLaunch(decTick.state), "December ship has no postLaunch occupancy");
    ok("late join unsigned, invite skipped, December ship hop");
  })();

  (function startingAbleSkillsAndHopFit() {
    const px = (config.careerWorld || {}).playerXp || {};
    const ableXp = px.startingAbleXp;
    const gCount = px.startingAbleGenreCount;
    const pCount = px.startingAbleGameplayCount;
    assert(ableXp > 0 && gCount === 2 && pCount === 2, "starting able config");
    const g = sim.createCareerGame("测", "programmer", config);
    const genreIds = Object.keys(g.career.genreXp || {}).filter(function (id) {
      return g.career.genreXp[id] > 0;
    });
    const playIds = Object.keys(g.career.gameplayXp || {}).filter(function (id) {
      return g.career.gameplayXp[id] > 0;
    });
    assert(genreIds.length === gCount, "starting genre count " + genreIds.length);
    assert(playIds.length === pCount, "starting gameplay count " + playIds.length);
    genreIds.forEach(function (id) {
      assert(g.career.genreXp[id] === ableXp, "starting genre xp " + id);
      assert(sim.xpTierFor(g.career.genreXp[id], config).id === "able", "starting genre able " + id);
    });
    playIds.forEach(function (id) {
      assert(g.career.gameplayXp[id] === ableXp, "starting play xp " + id);
      assert(sim.xpTierFor(g.career.gameplayXp[id], config).id === "able", "starting play able " + id);
    });
    const sheet = sim.careerSkillSheet(g, config);
    assert(sheet.genres.length === (config.content.genres || []).length, "sheet all genres");
    assert(sheet.gameplay.length === (config.content.gameplay || []).length, "sheet all gameplay");
    sheet.genres.concat(sheet.gameplay).forEach(function (row) {
      assert(row.xp == null, "sheet hides xp " + row.id);
      assert(row.tier && row.tierId, "sheet has tier " + row.id);
    });
    const ableGenre = genreIds[0];
    const ablePlay = playIds[0];
    const missGenre = (config.content.genres || []).map(function (x) { return x.id; }).filter(function (id) {
      return genreIds.indexOf(id) < 0;
    })[0];
    const missPlay = (config.content.gameplay || []).map(function (x) { return x.id; }).filter(function (id) {
      return playIds.indexOf(id) < 0;
    })[0];
    const co = sim.careerCompany("fromsoftware", config) || sim.careerCompany(g.career.openingOffers[0].companyId, config);
    const chanceFit = sim.careerHireChance(co, g, config, null, { genreId: ableGenre, gameplayId: ablePlay });
    const chanceMiss = sim.careerHireChance(co, g, config, null, { genreId: missGenre, gameplayId: missPlay });
    assert(chanceFit > chanceMiss, "skill fit hireChance " + chanceMiss + " -> " + chanceFit);
    ok("starting able skills, sheet, hop fit");
  })();

  (function skillEventsGrantCurrentTitleXp() {
    const px = (config.careerWorld || {}).playerXp || {};
    const ids = ((config.careerWorld.devEvents && config.careerWorld.devEvents.list) || []).map(function (e) { return e.id; });
    ["genreRefBoard", "playRefClear", "genrePlayClinic", "alphaPlaytestNotes", "goldGenrePass",
      "progFeelLab", "artMoodBoard", "designComps", "musicGenreListen", "polishPlayTune",
      "polishGenreLock", "goldPlayFaq", "artPolishPass", "designPlayPass", "musicThemeLock"].forEach(function (id) {
      assert(ids.indexOf(id) >= 0, "skill event " + id);
    });
    const prodIds = ((config.careerWorld.producerEvents && config.careerWorld.producerEvents.list) || []).map(function (e) { return e.id; });
    assert(prodIds.indexOf("prodSkillClinic") >= 0, "producer skill clinic");
    const chrono = sim.careerTitle("chronoTrigger", config);
    assert(chrono && chrono.genreId && chrono.gameplayId, "chrono catalog");

    const tweaked = deepClone(config);
    tweaked.careerWorld = deepClone(config.careerWorld);
    tweaked.careerWorld.devEvents.chance = 1;
    tweaked.careerWorld.devEvents.minGapMonths = 0;
    tweaked.careerWorld.devEvents.pityMonths = 0;
    tweaked.careerWorld.devEvents.maxPerYear = 99;
    tweaked.careerWorld.devEvents.list = (config.careerWorld.devEvents.list || []).filter(function (e) {
      return e.id === "genreRefBoard";
    }).map(function (e) {
      const row = deepClone(e);
      delete row.phase;
      delete row.role;
      return row;
    });
    const g = sim.createCareerGame("测", "programmer", tweaked);
    const acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tweaked);
    let st = acc.state;
    st.career.companyId = "square";
    st.career.titleId = "chronoTrigger";
    st.career.liveStats = { program: 80, design: 80, art: 80, music: 80 };
    st.rngSeed = 1;
    st.rngCount = 0;
    const beforeG = sim.playerXpValue(st, "genre", chrono.genreId);
    const beforeP = sim.playerXpValue(st, "gameplay", chrono.gameplayId);
    const ev = sim.rollCareerDevEvent(st, tweaked, []);
    assert(ev && ev.id === "genreRefBoard", "rolled genreRefBoard");
    assert(sim.playerXpValue(st, "genre", chrono.genreId) === beforeG + px.eventGenreXp, "notice genre xp");
    assert(sim.playerXpValue(st, "gameplay", chrono.gameplayId) === beforeP, "notice play xp unchanged");

    const g2 = sim.createCareerGame("测", "design", config);
    let st2 = sim.acceptOpeningOffer(g2, g2.career.openingOffers[0].id, config).state;
    st2.career.companyId = "square";
    st2.career.titleId = "chronoTrigger";
    st2.career.liveStats = { program: 80, design: 80, art: 80, music: 80 };
    const g0 = sim.playerXpValue(st2, "genre", chrono.genreId);
    const p0 = sim.playerXpValue(st2, "gameplay", chrono.gameplayId);
    const picked = sim.resolveCareerEventChoice(st2, "genrePlayClinic", "play", config);
    assert(picked.ok, "clinic choice ok");
    assert(sim.playerXpValue(picked.state, "gameplay", chrono.gameplayId) === p0 + px.eventFocusXp, "choice play focus xp");
    assert(sim.playerXpValue(picked.state, "genre", chrono.genreId) === g0, "choice genre unchanged");
    const prod = sim.resolveCareerEventChoice(st2, "prodSkillClinic", "genreClass", config);
    assert(prod.ok, "producer clinic ok");
    assert(sim.playerXpValue(prod.state, "genre", chrono.genreId) === g0 + px.eventFocusXp, "producer genre class xp");
    ok("skill events grant current title xp");
  })();

  (function careerDevEventCadence() {
    const tweaked = deepClone(config);
    tweaked.careerWorld = deepClone(config.careerWorld);
    tweaked.careerWorld.devEvents.chance = 1;
    tweaked.careerWorld.devEvents.minGapMonths = 2;
    tweaked.careerWorld.devEvents.pityMonths = 6;
    tweaked.careerWorld.devEvents.maxPerYear = 5;
    tweaked.careerWorld.devEvents.list = [{
      id: "cadenceProbe",
      displayName: "节奏探针",
      text: "测",
      presentation: "notice",
      qualityDim: "program",
      qualityDelta: 1
    }];
    function primed(year, month) {
      const g = sim.createCareerGame("测", "programmer", tweaked);
      const acc = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tweaked);
      const st = acc.state;
      st.year = year;
      st.month = month;
      st.career.companyId = "square";
      st.career.titleId = "chronoTrigger";
      st.career.liveStats = { program: 80, design: 80, art: 80, music: 80 };
      st.career.postLaunch = null;
      st.career.lastDevEventYm = null;
      st.career.devEventYear = year;
      st.career.devEventsThisYear = 0;
      st.rngSeed = 1;
      st.rngCount = 0;
      return st;
    }
    const jan = primed(1995, 1);
    assert(sim.rollCareerDevEvent(jan, tweaked, []), "first month can fire");
    assert(jan.career.devEventsThisYear === 1, "year count 1");
    jan.month = 2;
    assert(!sim.rollCareerDevEvent(jan, tweaked, []), "min gap blocks next month");
    jan.month = 3;
    assert(sim.rollCareerDevEvent(jan, tweaked, []), "fires after min gap");

    const pity = primed(1995, 7);
    pity.career.lastDevEventYm = sim.monthIndex(1995, 1);
    pity.career.devEventsThisYear = 1;
    tweaked.careerWorld.devEvents.chance = 0;
    assert(sim.rollCareerDevEvent(pity, tweaked, []), "pity fires at 6 months");

    tweaked.careerWorld.devEvents.chance = 1;
    const cap = primed(1995, 11);
    cap.career.lastDevEventYm = sim.monthIndex(1995, 1);
    cap.career.devEventsThisYear = 5;
    assert(!sim.rollCareerDevEvent(cap, tweaked, []), "max 5 per year");
    cap.year = 1996;
    cap.month = 1;
    cap.career.lastDevEventYm = sim.monthIndex(1995, 11);
    assert(sim.rollCareerDevEvent(cap, tweaked, []), "new year resets cap");

    const lineSkip = primed(1995, 6);
    lineSkip.career.lastDevEventYm = null;
    const q = [];
    const notes = [];
    if (sim.processCareerLines) sim.processCareerLines(lineSkip, tweaked, q, notes);
    const rolled = sim.rollCareerDevEvent(lineSkip, tweaked, notes);
    assert(rolled, "line-free month still rolls random");
    ok("career dev event cadence 4 months / 3-5 year");
  })();

  (function virtualTitlesAreGenreFictionAndUnique() {
    const byGenre = (config.careerWorld.virtualPool || {}).titlesByGenre || {};
    const seen = {};
    Object.keys(byGenre).forEach(function (gid) {
      assert(Array.isArray(byGenre[gid]) && byGenre[gid].length >= 8, "genre pool " + gid);
      byGenre[gid].forEach(function (n) {
        assert(n && !seen[n], "unique fictional name " + n);
        seen[n] = true;
      });
    });
    const g = sim.createCareerGame("测", "programmer", config);
    let st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
    st.career.companyId = "fromsoftware";
    st.career.studioId = "fromsoftware-main";
    st.career.titleId = null;
    st.career.liveStats = null;
    st.career.postLaunch = null;
    st.year = 1995;
    st.month = 1;
    const names = [];
    let i, t, pool, inGenre;
    for (i = 0; i < 8; i++) {
      t = sim.startVirtualProject(st, config);
      assert(t && t.virtual && t.name, "virtual " + i);
      assert(names.indexOf(t.name) < 0, "no reuse " + t.name);
      names.push(t.name);
      pool = byGenre[t.genreId] || [];
      inGenre = pool.indexOf(t.name) >= 0;
      assert(inGenre || seen[t.name], "name from genre pool " + t.name + " / " + t.genreId);
    }
    ok("virtual titles are genre fiction and unique");
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
    const interval = sim.liveOpsVersionInterval(mobile, config);
    let dueMonth = 3 + interval;
    let dueYear = 2016;
    while (dueMonth > 12) { dueMonth -= 12; dueYear += 1; }
    const v11 = sim.liveOpsVersionDueAt(mobile, dueYear, dueMonth, config);
    assert(v11 && v11.major === 1 && v11.minor === 1, "next interval is 1.1 got " + JSON.stringify(v11) + " at " + dueYear + "." + dueMonth);
    const majorMonths = interval * (spec.minorPerMajor || 6);
    let majorMonth = 3 + majorMonths;
    let majorYear = 2016;
    while (majorMonth > 12) { majorMonth -= 12; majorYear += 1; }
    const v20 = sim.liveOpsVersionDueAt(mobile, majorYear, majorMonth, config);
    assert(v20 && v20.major === 2 && v20.minor === 0, "minorPerMajor later is 2.0 got " + JSON.stringify(v20) + " at " + majorYear + "." + majorMonth);
    assert(!sim.liveOpsVersionDueAt(mobile, 2016, 3, config), "launch month is 1.0 not an update");
    ok("liveops versions: mobile only, 原神.2.0 naming");
  })();

  (function playerMobileLiveOpsShipsVersionOnTick() {
    let g = hireOne(9090);
    g.company.scale = "medium";
    g.year = 2016;
    g.month = 3 + sim.liveOpsVersionInterval({
      releaseType: "liveops",
      platformId: "mobile",
      releasedYear: 2016,
      releasedMonth: 3,
      liveOps: { active: true }
    }, config);
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
    assert(drops.length <= (config.liveOps.versions.maxVersionsPerYear || drops.length), "genshin 2021 within yearly cap");
    assert(drops.some(function (t) { return String(t.label).indexOf("原神.") === 0; }), "label looks like 原神.x.y got " + drops.map(function (t) { return t.label; }).join(","));
    const wowPack = sim.careerYearReleases(2005, config, acc.state);
    let wowVer = 0;
    Object.keys(wowPack.months).forEach(function (m) {
      (wowPack.months[m] || []).forEach(function (t) {
        if (t.isVersion && String(t.id).indexOf("wow-") === 0) wowVer += 1;
      });
    });
    assert(wowVer === 0, "pc wow has no mobile-style versions");
    ok("career calendar lists genshin versions and skips pc mmo versions");
  })();

  (function mobileLiveOpsCapTwoVersionsPerYear() {
    const spec = config.liveOps.versions;
    const cap = spec.maxVersionsPerYear;
    assert(cap === 2, "config maxVersionsPerYear is 2 got " + cap);
    const mobile = {
      id: "cap-mobile",
      title: "测手游",
      releaseType: "liveops",
      platformId: "mobile",
      releasedYear: 2016,
      releasedMonth: 1,
      liveOps: { active: true }
    };
    const boxed = {
      id: "cap-boxed",
      title: "测盒装",
      releaseType: "boxed",
      platformId: "console",
      releasedYear: 2018,
      releasedMonth: 4
    };
    const pcLive = {
      id: "cap-pc",
      title: "测端游",
      releaseType: "liveops",
      platformId: "pc",
      releasedYear: 2016,
      releasedMonth: 1,
      liveOps: { active: true }
    };
    const yearDrops = [];
    let m;
    for (m = 1; m <= 12; m++) {
      const ver = sim.liveOpsVersionDueAt(mobile, 2018, m, config);
      if (ver) yearDrops.push({ month: m, ver: ver });
    }
    assert(yearDrops.length <= cap, "later year at most " + cap + " version drops got " + yearDrops.length);
    assert(yearDrops.length === cap, "full later year still ships the yearly cap got " + yearDrops.length);
    assert(!sim.liveOpsUsesVersions(boxed, config), "boxed console does not version");
    let pcDrops = 0;
    for (m = 1; m <= 12; m++) {
      if (sim.liveOpsVersionDueAt(pcLive, 2018, m, config)) pcDrops += 1;
    }
    assert(pcDrops === 0, "pc liveops has no mobile version drops");

    const listed = sim.listLiveOpsVersionDrops({
      released: [mobile, boxed],
      rivalReleased: []
    }, 2018, config);
    const mobileListed = listed.filter(function (d) { return d.id.indexOf("cap-mobile") === 0; });
    const boxedListed = listed.filter(function (d) { return String(d.title).indexOf("测盒装") >= 0; });
    assert(mobileListed.length <= cap, "listLiveOpsVersionDrops respects cap got " + mobileListed.length);
    assert(mobileListed.length === yearDrops.length, "listing matches due-at months");
    assert(boxedListed.length === 0, "boxed does not appear as version drops");

    const career = sim.createCareerGame("测", "programmer", config);
    const acc = sim.acceptOpeningOffer(career, career.career.openingOffers[0].id, config);
    const pack = sim.careerYearReleases(2021, config, acc.state);
    const byTitle = {};
    let boxedOnCal = 0;
    Object.keys(pack.months).forEach(function (month) {
      (pack.months[month] || []).forEach(function (t) {
        if (t.isVersion) {
          const key = String(t.id || "").replace(/-v\d+-\d+$/, "") || t.title || t.label;
          byTitle[key] = (byTitle[key] || 0) + 1;
        } else if (t.releaseType !== "liveops") {
          boxedOnCal += 1;
        }
      });
    });
    Object.keys(byTitle).forEach(function (k) {
      assert(byTitle[k] <= cap, k + " calendar version drops " + byTitle[k] + " exceed cap " + cap);
    });
    assert(boxedOnCal > 0, "non-liveops boxed/console/pc releases still occupy the calendar");
    ok("mobile title <=2 version drops/year; boxed unaffected; calendar listing capped");
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
    const floor1 = ((config.careerWorld.jobRanks || {}).salaryFloor || [])[1];
    assert(junior === floor1, "1995 intern sits on rank-1 salary floor, got " + junior);
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
    ok("career salary snaps to steps, intern floor, growth and inflation");
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
    const hops = list.filter(function (o) { return o.kind !== "promotion" && o.kind !== "promotionLine"; });
    assert(list.length === 4, "year-end offer count 4, got " + list.length);
    assert(hops.length >= 3 && hops.length <= 4, "year-end hop slots 3–4, got " + hops.length);
    const internals = hops.filter(function (o) { return o.internal; });
    assert(internals.length <= 2, "internal offers <= 2, got " + internals.length);
    internals.forEach(function (o, i) {
      assert(hops[i].internal, "internals come first at " + i);
      assert(o.studioId && o.studioId !== st.career.studioId, "internal is another studio");
    });
    hops.forEach(function (o) {
      assert(typeof o.successChance === "number", "successChance on offer");
      assert(o.studioId, "offer studioId");
    });
    (function hopPageShowsFourLeanCards() {
      const pageSt = sim.clone(st);
      pageSt.career.yearEndOffers = [];
      pageSt.career.titleId = null;
      pageSt.career.liveStats = null;
      const tick = sim.tickCareerMonth(pageSt, config);
      const hopPage = (tick.queue || []).filter(function (p) { return p.type === "hop"; })[0];
      assert(hopPage, "december hop page");
      const hopOpts = (hopPage.options || []).filter(function (o) { return o.id !== "stay"; });
      assert(hopOpts.length === 4, "hop UI shows 4, got " + hopOpts.length);
      hopOpts.forEach(function (opt) {
        assert(opt.label.indexOf("前辈") < 0, "hop label no 前辈");
        assert(opt.label.indexOf("对口") < 0, "hop label no 对口");
        assert(opt.label.indexOf("→") < 0, "hop label no current salary");
        assert(opt.hopView && opt.hopView.title, "hop title");
        assert(opt.hopView.meta, "hop salary/rank");
        assert(/^\d+%$/.test(opt.hopView.pct), "hop pct " + opt.hopView.pct);
      });
    })();

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
    assert(retry.notice, "hop success notice survives join");
    assert(retry.state.career.hopNotice, "hopNotice kept after joinCompany");
    assert(!(retry.state.career.yearEndOffers || []).length, "hop clears leftover offers");

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
    const ootCredit = (mid.state.career.credits || []).filter(function (c) { return c.titleId === "oot"; })[0];
    assert(ootCredit, "resume keeps unsigned participation");
    assert(!ootCredit.shipped, "mid hop not credited at ship");
    assert(ootCredit.leftYear != null, "left dates written");
    assert(mid.state.career.companyId === hopTarget.companyId, "joined new company");
    assert(mid.state.career.studioId, "join writes studioId");

    hopSt.career.yearEndOffers = [{ id: "stale-hop" }];
    hopSt.career.invites = [{
      id: "inv-test",
      titleId: "chronoTrigger",
      companyId: "square",
      studioId: "square-rd3",
      roleId: "art",
      salary: 4000,
      currentSalary: 2000
    }];
    assert((config.careerWorld.mobility || {}).inviteCanCounter === false, "invite counter off");
    assert(!sim.counterCareerInvite(hopSt, "inv-test", config).ok, "counter API disabled");
    const invOptSt = sim.clone(hopSt);
    invOptSt.year = 1995;
    invOptSt.month = 2;
    invOptSt.career.fame = 90;
    invOptSt.career.titleId = null;
    invOptSt.career.companyId = "nintendo";
    const listedInv = sim.listCareerInvites(invOptSt, config);
    assert(listedInv.length >= 1, "invite list for option test");
    invOptSt.career.inviteYearStamp = invOptSt.year;
    invOptSt.career.invitesRolledThisYear = 99;
    invOptSt.career.invites = [listedInv[0]];
    const inviteTick = sim.tickMonth(invOptSt, config);
    const invPage = ((inviteTick && inviteTick.queue) || []).filter(function (p) { return p.type === "invite"; })[0];
    assert(invPage, "invite page queued");
    assert((invPage.options || []).every(function (o) { return o.id !== "counter"; }), "invite has no counter");
    assert((invPage.options || []).some(function (o) { return o.id === "accept"; }), "invite accept remains");
    assert((invPage.options || []).some(function (o) { return o.id === "decline"; }), "invite decline remains");
    const beforeCo = hopSt.career.companyId;
    const inv = sim.acceptCareerInvite(hopSt, "inv-test", config);
    assert(inv.ok, "invite accept ok");
    assert(inv.notice, "invite success notice");
    assert(!(inv.state.career.yearEndOffers || []).length, "invite clears stale hop list");
    assert(inv.state.career.companyId === "square", "invite hops without dice");
    assert(inv.state.career.companyId !== beforeCo || hopSt.career.companyId === "square", "invite company set");
    ok("year-end 4 offers, hop fail cooldown, invite sure, mid hop keeps unsigned credit");
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
    assert(st.career.titleId === "chronoTrigger", "player title stays during ship call");
    assert(st.career.liveStats, "live still present at ship");
    assert(!sim.careerPostLaunch(st), "ship does not occupy postLaunch");
    const view = sim.careerProjectView(st, config);
    assert(!view.postLaunch, "view is not postLaunch after ship");
    assert(sim.playerXpValue(st, "genre", chrono.genreId) > gxp0, "genreXp up on ship");
    assert(sim.playerXpValue(st, "gameplay", chrono.gameplayId) > pxp0, "gameplayXp up on ship");
    const shippedId = st.career.titleId;
    st.month = 4;
    sim.assignCareerProject(st, config);
    assert(!sim.careerPostLaunch(st), "still no postLaunch after unload");
    assert(st.career.titleId !== shippedId, "cleared shipped title after month ends");

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
    const chronoCredit = (hopped.state.career.credits || []).filter(function (c) { return c.titleId === "chronoTrigger"; })[0];
    assert(chronoCredit && !chronoCredit.shipped, "unsigned resume remains");
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
    assert(pl.monthsMin === 0 && pl.monthsMax === 0, "postLaunch months occupancy 0");
    ok("ship unloads after month, hop skip unsigned, player skill live/contrib");
  })();

  (function careerJobRankResumeAndPromotion() {
    const world = config.careerWorld;
    const ranks = world.jobRanks || {};
    const steps = (((world.personalEconomy || {}).salary || {}).steps) || [];
    const nintendo = sim.careerCompany("nintendo", config);
    const sega = sim.careerCompany("sega", config) || (world.companies || []).filter(function (c) { return c.power === 2; })[0];
    let g = sim.createCareerGame("测", "design", config);
    assert(g.career.jobRank === 1, "design starts Lv.1");
    assert(sim.careerJobTitleLabel(g, config) === "策划实习生", "design intern title");
    assert(sim.formatCareerRankLabel("design", 1, config) === "策划实习生 (D-0)", "design intern code");
    g = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
    assert(g.career.growthStage === "employee", "still employee after hire");
    assert((g.career.tenures || []).length === 1, "opening tenure written");
    assert(g.career.tenures[0].source === "opening", "tenure source opening");
    assert(g.career.tenures[0].jobRank === 1, "tenure rank 1");
    assert(!sim.canPromoteCareer(g, config), "fresh hire cannot promote yet");

    const base = Number((world.player && world.player.monthlyContribution) != null ? world.player.monthlyContribution : 2);
    const low = sim.createCareerGame("测", "programmer", config);
    const high = sim.clone(low);
    high.career.jobRank = 6;
    high.career.stats = { program: 90, design: 17, art: 17, music: 17 };
    const c1 = sim.careerMonthlyContribution(low, config);
    const c6 = sim.careerMonthlyContribution(high, config);
    assert(c1 < c6, "higher rank+stat contrib " + c1 + " -> " + c6);
    assert(c1 < base, "Lv.1 contrib below old 2, got " + c1);
    assert(c6 > base, "Lv.6 high-stat contrib above 2, got " + c6);

    const floor6 = (ranks.salaryFloor || [])[6];
    const poor = sim.clone(g);
    poor.career.jobRank = 6;
    poor.career.stats = { program: 34, design: 34, art: 34, music: 34 };
    poor.career.fame = 0;
    poor.career.honor = 0;
    poor.year = 1995;
    const floored = sim.careerSalaryFor(sega || nintendo, 1995, config, poor.career);
    assert(steps.indexOf(floored) >= 0, "floored salary in steps");
    assert(floored >= floor6, "Lv.6 salary floor " + floored + " >= " + floor6);

    const wLow = sim.liveToPublicScore({ program: 90, design: 90, art: 90, music: 90 }, 7, config, low);
    const wHigh = sim.liveToPublicScore({ program: 90, design: 90, art: 90, music: 90 }, 7, config, high);
    assert(wHigh > wLow, "higher rank weighs player more in score " + wLow + " -> " + wHigh);

    const attrLow = sim.clone(low);
    const attrHigh = sim.clone(low);
    attrLow.career.jobRank = 4;
    attrHigh.career.jobRank = 4;
    attrLow.career.stats = { program: 30, design: 17, art: 17, music: 17 };
    attrHigh.career.stats = { program: 80, design: 17, art: 17, music: 17 };
    const aLow = sim.liveToPublicScore({ program: 90, design: 90, art: 90, music: 90 }, 7, config, attrLow);
    const aHigh = sim.liveToPublicScore({ program: 90, design: 90, art: 90, music: 90 }, 7, config, attrHigh);
    assert(aHigh > aLow, "higher mainStat weighs player more at same rank " + aLow + " -> " + aHigh);

    const chanceLow = sim.careerHireChance(nintendo, low, config);
    const chanceHigh = sim.careerHireChance(nintendo, high, config);
    assert(chanceHigh > chanceLow, "high rank hireChance higher");
    assert(chanceLow === 0, "nintendo power3 minRank blocks Lv.1, got " + chanceLow);

    function makePromotable(st, rank) {
      const reqs = ((ranks.promotion || {}).requirements || [])[rank] || {};
      const role = sim.careerRole(st.career.roleId, config);
      const statKey = (role && role.stat) || "program";
      st.career.jobRank = rank;
      st.career.monthsInRank = (reqs.monthsInRank || 0) + 1;
      st.career.jobXp = (reqs.mainStatOrJobXp || 0) + 1;
      st.career.stats = st.career.stats || {};
      st.career.stats[statKey] = (reqs.mainStat != null ? reqs.mainStat : (reqs.mainStatOrJobXp || 0)) + 1;
      st.career.fame = (reqs.fameOrHonor || 0) + 1;
      st.career.honor = 0;
      st.career.promotionsThisYear = 0;
      st.career.lastPromotionYear = null;
      st.career.credits = [];
      let n = 0;
      const need = reqs.creditedTitles || 0;
      while (n < need) {
        n += 1;
        st.career.credits.push({
          titleId: "cred-" + n,
          companyId: st.career.companyId,
          roleId: st.career.roleId,
          jobRank: rank,
          shipped: true,
          virtual: false
        });
      }
      return st;
    }

    let st = sim.clone(g);
    st = makePromotable(st, 1);
    assert(sim.canPromoteCareer(st, config), "eligible after meeting gates");
    const lowStat = sim.clone(st);
    const designKey = (sim.careerRole(lowStat.career.roleId, config) || {}).stat || "design";
    lowStat.career.stats[designKey] = 20;
    assert(!sim.canPromoteCareer(lowStat, config), "low mainStat blocks even with jobXp");
    const blocked = sim.promoteCareer(lowStat, config);
    assert(!blocked.ok && blocked.error === sim.ERR.CAREER_PROMOTE_LOCKED, "click promo blocked by mainStat");
    sim.applyCareerPromotion(lowStat, config, { story: true });
    assert(lowStat.career.jobRank === 2, "story promo skips mainStat gate");
    const before = st.career.jobRank;
    const silent = sim.clone(st);
    const ticked = sim.tickMonth(silent, config).state;
    assert(ticked.career.jobRank === before, "tick does not auto promote");
    const promo = sim.promoteCareer(st, config);
    assert(promo.ok, "promote ok");
    assert(promo.state.career.jobRank === 2, "clicked up to Lv.2");
    assert(promo.state.career.growthStage === "employee", "promotion does not change growthStage");
    assert(sim.careerJobTitleLabel(promo.state, config) === "初级策划", "design junior title");
    assert(sim.formatCareerRankLabel("design", 2, config) === "初级策划 (D-1)", "design junior code");
    assert((promo.state.career.tenures || []).filter(function (t) { return t.source === "promotion"; }).length === 1, "promotion tenure");
    assert(!sim.canPromoteCareer(promo.state, config), "one promo per year");
    const again = sim.promoteCareer(promo.state, config);
    assert(!again.ok && again.error === sim.ERR.CAREER_PROMOTE_LOCKED, "second promo blocked");

    let hop = sim.clone(promo.state);
    hop.career.yearEndOffers = [{
      id: "ye-rank-hop",
      companyId: "square",
      studioId: ((sim.careerCompany("square", config).studios || [])[0] || {}).id,
      roleId: "design",
      jobRank: hop.career.jobRank,
      salary: 8000,
      successChance: 1
    }];
    const hopped = sim.applyYearEndOffer(hop, "ye-rank-hop", config);
    assert(hopped.ok && hopped.hopped, "hop ok");
    assert(hopped.state.career.jobRank === 2, "hop keeps rank");
    assert(hopped.state.career.growthStage === "employee", "hop still employee");

    let top = sim.clone(g);
    top.career.jobRank = 6;
    top.career.jobTitleId = "des-director";
    top.career.monthsInRank = 99;
    top.career.jobXp = 999;
    top.career.fame = 99;
    top.career.credits = [{ titleId: "x", shipped: true, virtual: false }];
    top.career.promotionsThisYear = 0;
    assert(!sim.canPromoteCareer(top, config), "Lv.6 cannot promote");
    const fake = sim.promoteCareer(top, config);
    assert(!fake.ok, "Lv.6 promote fails");
    assert(top.career.growthStage === "employee", "Lv.6 still employee");

    const resume = sim.careerResumeView(promo.state, config);
    assert(resume.tenures.length >= 1, "resume tenures");
    const settle = sim.careerSettlementView(hopped.state, config);
    assert(settle.jobLabel, "settlement job label");
    assert(settle.growthStage === "employee", "settlement employee");
    assert(settle.creditedCount >= 0, "settlement credited count");

    const shipSt = sim.clone(g);
    shipSt.career.titleId = "chronoTrigger";
    shipSt.career.companyId = "square";
    shipSt.career.liveStats = { program: 90, design: 90, art: 80, music: 80 };
    shipSt.career.credits = [];
    sim.shipPlayerTitle(shipSt, config, [], []);
    const shipped = (shipSt.career.credits || []).filter(function (c) { return c.titleId === "chronoTrigger"; })[0];
    assert(shipped && shipped.shipped, "ship writes signed credit");
    assert(shipped.score != null, "ship writes score on credit");
    assert(shipSt.career.stats.design > g.career.stats.design, "main stat grows on ship");

    const evLow = { id: "fatalBug", minRank: undefined, maxRank: 3, qualityDelta: -6 };
    const evHigh = { id: "engineBreakthrough", minRank: 4, qualityDelta: 8 };
    const fatal = ((world.devEvents || {}).list || []).filter(function (e) { return e.id === "fatalBug"; })[0];
    const engine = ((world.devEvents || {}).list || []).filter(function (e) { return e.id === "engineBreakthrough"; })[0];
    assert(fatal && fatal.maxRank === 3, "junior negative event maxRank");
    assert(engine && engine.minRank === 4, "senior event minRank");
    void evLow; void evHigh;

    ok("job rank, click promotion, salary floor, resume, hop keeps rank, one promo/year, Lv.6 employee");
  })();

  (function careerEventLinesAndProducer() {
    const world = config.careerWorld;
    const lines = (world.eventLines || {}).lines || [];
    const founder = (world.growthStages || []).filter(function (s) { return s.id === "founder"; })[0];
    assert(founder && founder.lockedThisVersion, "founder lockedThisVersion");
    assert(lines.some(function (l) { return l.id === "promo-to-expert"; }), "promo-to-expert line configured");
    assert(lines.some(function (l) { return l.id === "become-producer"; }), "become-producer line configured");
    assert((world.producerCareer || {}).minJobRank === 4, "producer unlock at rank 4");

    function hired(role) {
      let g = sim.createCareerGame("测", role || "programmer", config);
      g = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
      return g;
    }
    function makePromotable(st, rank) {
      const reqs = ((world.jobRanks.promotion || {}).requirements || [])[rank] || {};
      const role = sim.careerRole(st.career.roleId, config);
      const statKey = (role && role.stat) || "program";
      st.career.jobRank = rank;
      st.career.monthsInRank = (reqs.monthsInRank || 0) + 1;
      st.career.jobXp = (reqs.mainStatOrJobXp || 0) + 1;
      st.career.stats = st.career.stats || {};
      st.career.stats[statKey] = (reqs.mainStat != null ? reqs.mainStat : (reqs.mainStatOrJobXp || 0)) + 1;
      st.career.fame = (reqs.fameOrHonor || 0) + 1;
      st.career.honor = 0;
      st.career.promotionsThisYear = 0;
      st.career.lastPromotionYear = null;
      st.career.credits = [];
      const need = reqs.creditedTitles || 0;
      for (let i = 0; i < Math.ceil(need); i++) {
        st.career.credits.push({
          titleId: "cred-" + i,
          shipped: true,
          virtual: false,
          jobRank: rank,
          companyId: st.career.companyId
        });
      }
      return st;
    }

    let st = makePromotable(hired("design"), 4);
    assert(sim.canPromoteCareer(st, config), "rank4 eligible");
    assert(sim.promotionUsesEventLine(st, config), "rank4 uses event line");
    assert(sim.canStartBecomeProducerLine(st, config), "producer unlock at jobRank 4");
    const instant = sim.promoteCareer(st, config);
    assert(instant.ok, "promoteCareer at rank4 starts line");
    assert(instant.state.career.jobRank === 4, "rank unchanged until final beat");
    assert(sim.activeCareerLineId(instant.state) === "promo-to-expert", "promo line active");

    let lineSt = instant.state;
    let step = sim.resolveCareerLineChoice(lineSt, "promo-to-expert", "offer", "apply", config);
    assert(step.ok && step.state.career.lines["promo-to-expert"].flags.applied, "offer accepted");
    lineSt = step.state;
    lineSt.career.lines["promo-to-expert"].waitUntil = sim.monthIndex(lineSt.year, lineSt.month);
    lineSt.career.lines["promo-to-expert"].pending = false;
    const q = [];
    sim.processCareerLines(lineSt, config, q, []);
    assert(q.length && q[0].beatId === "review", "months wait fires review");
    step = sim.resolveCareerLineChoice(lineSt, "promo-to-expert", "review", "depth", config);
    lineSt = step.state;
    assert(lineSt.career.jobRank === 4, "still rank4 after review");
    lineSt.career.lines["promo-to-expert"].waitingFor = "shipReady";
    lineSt.career.lines["promo-to-expert"].pending = false;
    const q2 = [];
    sim.processCareerLines(lineSt, config, q2, []);
    assert(q2.length && q2[0].beatId === "decision", "onShip fires decision");
    step = sim.resolveCareerLineChoice(lineSt, "promo-to-expert", "decision", "accept", config);
    assert(step.ok && step.done, "promo line done");
    assert(step.state.career.jobRank === 5, "final beat promotes 4→5");
    assert(step.state.career.lines["promo-to-expert"].status === "done", "line status done");

    let abortSt = makePromotable(hired("art"), 4);
    abortSt.career.lines = {};
    let started = sim.startCareerLine(abortSt, "promo-to-expert", config);
    assert(started.ok, "start promo line");
    const aborted = sim.resolveCareerLineChoice(started.state, "promo-to-expert", "offer", "decline", config);
    assert(aborted.ok && aborted.aborted, "abort ok");
    assert(aborted.state.career.jobRank === 4, "abort keeps rank");
    assert(aborted.state.career.lines["promo-to-expert"].status === "aborted", "aborted status");
    assert(!sim.canStartPromotionLine(aborted.state, config), "no reopen same year");
    aborted.state.year += 1;
    aborted.state.career.promotionsThisYear = 0;
    assert(sim.canStartPromotionLine(aborted.state, config), "reopen next year");

    [4, 5, 6].forEach(function (rank) {
      let p = makePromotable(hired("music"), Math.min(rank, 5));
      p.career.jobRank = rank;
      p.career.lines = {};
      p.career.promotionsThisYear = 0;
      assert(sim.canStartBecomeProducerLine(p, config), "producer unlock at rank " + rank);
    });

    let prod = makePromotable(hired("programmer"), 4);
    prod.career.lines = {};
    started = sim.startCareerLine(prod, "become-producer", config);
    assert(started.ok, "start become-producer");
    assert(!sim.canStartPromotionLine(started.state, config), "mutual exclusion while producer line active");
    step = sim.resolveCareerLineChoice(started.state, "become-producer", "invite", "yes", config);
    prod = step.state;
    prod.career.lines["become-producer"].waitUntil = sim.monthIndex(prod.year, prod.month);
    prod.career.lines["become-producer"].pending = false;
    sim.processCareerLines(prod, config, [], []);
    step = sim.resolveCareerLineChoice(prod, "become-producer", "trial", "craft", config);
    prod = step.state;
    prod.career.lines["become-producer"].waitingFor = "shipReady";
    prod.career.lines["become-producer"].pending = false;
    sim.processCareerLines(prod, config, [], []);
    const keptRank = prod.career.jobRank;
    step = sim.resolveCareerLineChoice(prod, "become-producer", "seat", "accept", config);
    assert(step.ok && step.done, "producer line done");
    assert(step.state.career.roleId === "producer", "roleId producer");
    assert(step.state.career.growthStage === "producer", "growthStage producer");
    assert(step.state.career.jobRank === keptRank, "kept jobRank after producer");
    assert(sim.careerJobTitleDisplay(step.state, config) === "制作人", "display 制作人");
    assert(sim.isCareerProducer(step.state), "isCareerProducer");
    assert(!sim.canPromoteCareer(step.state, config), "producer cannot promote ladder");

    const virtSt = sim.clone(step.state);
    virtSt.career.titleId = null;
    virtSt.career.liveStats = null;
    virtSt.career.idleMonths = 99;
    virtSt.year = 2024;
    virtSt.month = 1;
    const virt = sim.startVirtualProject(virtSt, config, { genreId: "fantasy", gameplayId: "rpg" });
    assert(virt && virt.virtual && virt.genreId === "fantasy" && virt.gameplayId === "rpg", "producer virtual genre/gameplay choosable");

    let capSt = makePromotable(hired("programmer"), 4);
    capSt.career.lines = {};
    started = sim.startCareerLine(capSt, "become-producer", config);
    assert(started.ok && started.state.career.producerAskCount === 1, "first producer ask counted");
    const no1 = sim.resolveCareerLineChoice(started.state, "become-producer", "invite", "no", config);
    assert(no1.ok && no1.aborted, "first producer ask declined");
    no1.state.year += 1;
    no1.state.career.promotionsThisYear = 0;
    assert(sim.canStartBecomeProducerLine(no1.state, config), "producer ask can reopen once");
    started = sim.startCareerLine(no1.state, "become-producer", config);
    assert(started.ok && started.state.career.producerAskCount === 2, "second producer ask counted");
    const no2 = sim.resolveCareerLineChoice(started.state, "become-producer", "invite", "no", config);
    no2.state.year += 1;
    no2.state.career.promotionsThisYear = 0;
    assert(!sim.canStartBecomeProducerLine(no2.state, config), "producer ask cap after 2");
    const blocked = sim.startCareerLine(no2.state, "become-producer", config);
    assert(!blocked.ok, "third producer start blocked");

    assert(sim.isGrowthStageLocked("founder", config), "founder still locked helper");
    const stages = world.growthStages || [];
    assert(stages.every(function (s) { return s.id !== "founder" || s.lockedThisVersion; }), "no founder unlock");

    ok("event lines, rank4→5 final beat, producer unlock 4/5/6, founder locked");
  })();

  (function producerCatalogDirectionAndInviteRoles() {
    function hiredAt(role, rank) {
      let st = sim.createCareerGame("测", role, config);
      st = sim.acceptOpeningOffer(st, st.career.openingOffers[0].id, config).state;
      st.career.jobRank = rank;
      st.career.fame = 80;
      st.career.lines = {};
      return st;
    }

    function finishProducerLine(st) {
      let started = sim.startCareerLine(st, "become-producer", config);
      assert(started.ok, "start producer line for invite test");
      let step = sim.resolveCareerLineChoice(started.state, "become-producer", "invite", "yes", config);
      st = step.state;
      st.career.lines["become-producer"].waitUntil = sim.monthIndex(st.year, st.month);
      st.career.lines["become-producer"].pending = false;
      sim.processCareerLines(st, config, [], []);
      step = sim.resolveCareerLineChoice(st, "become-producer", "trial", "craft", config);
      st = step.state;
      st.career.lines["become-producer"].waitingFor = "shipReady";
      st.career.lines["become-producer"].pending = false;
      sim.processCareerLines(st, config, [], []);
      step = sim.resolveCareerLineChoice(st, "become-producer", "seat", "accept", config);
      assert(step.ok && step.done, "finish producer line");
      return step.state;
    }

    let prod = finishProducerLine(hiredAt("programmer", 4));
    assert(sim.hasCompletedBecomeProducerLine(prod, config), "become-producer done");

    const chrono = sim.careerTitle("chronoTrigger", config);
    assert(chrono && !chrono.virtual, "chrono is catalog");
    const snap = {
      name: chrono.name,
      alias: chrono.alias,
      genreId: chrono.genreId,
      gameplayId: chrono.gameplayId
    };
    prod.career.titleId = "chronoTrigger";
    prod.career.liveStats = { program: 80, design: 80, art: 80, music: 80 };
    prod.career.awaitingProducerPitch = false;
    const queued = [];
    assert(!sim.queueProducerVirtualPitch(prod, config, queued), "no pitch while on catalog");
    assert(queued.length === 0, "catalog blocks pitch queue");

    prod.career.titleId = null;
    prod.career.liveStats = null;
    prod.career.idleMonths = 99;
    assert(sim.queueProducerVirtualPitch(prod, config, queued), "pitch when idle virtual path");
    assert(queued.length === 1 && queued[0].type === "producerPitch", "pitch queued");
    const optId = (prod.career.producerPitchOptions || [])[0].id;
    const pitched = sim.resolveProducerPitch(prod, optId, config);
    assert(pitched.ok && pitched.virtual, "pitch resolves virtual");
    const virtTitle = sim.careerTitle(pitched.state.career.titleId, config, pitched.state);
    assert(virtTitle && virtTitle.virtual, "assigned virtual");
    assert(virtTitle.genreId && virtTitle.gameplayId, "virtual has genre/gameplay from pitch");
    assert(chrono.name === snap.name && chrono.genreId === snap.genreId && chrono.gameplayId === snap.gameplayId,
      "catalog name/genre/gameplay untouched");

    const rewriteCfg = deepClone(config);
    rewriteCfg.careerWorld = deepClone(config.careerWorld);
    rewriteCfg.careerWorld.producerEvents = deepClone(config.careerWorld.producerEvents || { list: [] });
    rewriteCfg.careerWorld.producerEvents.list = (rewriteCfg.careerWorld.producerEvents.list || []).concat([{
      id: "testCatalogRewrite",
      displayName: "试改目录",
      text: "不该改写目录作。",
      presentation: "choice",
      choices: [{
        id: "rewrite",
        label: "改",
        virtualGenreId: "horror",
        virtualGameplayId: "survival",
        virtualName: "黑客编的假名"
      }]
    }]);
    let onCatalog = sim.clone(pitched.state);
    onCatalog.career.titleId = "chronoTrigger";
    onCatalog.career.liveStats = { program: 80, design: 80, art: 80, music: 80 };
    const rewrite = sim.resolveCareerEventChoice(onCatalog, "testCatalogRewrite", "rewrite", rewriteCfg);
    assert(rewrite.ok, "rewrite choice resolves");
    assert(chrono.name === snap.name && chrono.alias === snap.alias, "catalog name blocked");
    assert(chrono.genreId === snap.genreId && chrono.gameplayId === snap.gameplayId, "catalog genre/gameplay blocked");

    let beforeDone = hiredAt("design", 4);
    beforeDone.career.roleId = "producer";
    beforeDone.career.growthStage = "producer";
    beforeDone.career.lines = {};
    assert(!sim.hasCompletedBecomeProducerLine(beforeDone, config), "role alone ≠ line done");
    beforeDone.year = 1995;
    beforeDone.month = 2;
    beforeDone.career.companyId = "nintendo";
    const invBefore = sim.listCareerInvites(beforeDone, config);
    invBefore.forEach(function (inv) {
      assert(inv.roleId !== "producer", "no producer dig before line done");
    });
    const hopsBefore = sim.listYearEndOffers(beforeDone, config).filter(function (o) {
      return !o.kind;
    });
    hopsBefore.forEach(function (o) {
      assert(o.roleId !== "producer", "no producer hop before line done");
    });

    let after = finishProducerLine(hiredAt("art", 4));
    after.year = 1995;
    after.month = 2;
    after.career.companyId = "nintendo";
    after.career.fame = 90;
    after.career.titleId = null;
    const weights = deepClone(config);
    weights.careerWorld = deepClone(config.careerWorld);
    weights.careerWorld.mobility.inviteRoleWeights = {
      programmer: 0,
      design: 0,
      art: 0,
      music: 0,
      producer: 1
    };
    weights.careerWorld.mobility.hopRoleWeights = {
      programmer: 0,
      design: 0,
      art: 0,
      music: 0,
      producer: 1
    };
    const invProd = sim.listCareerInvites(after, weights);
    assert(invProd.length >= 1, "invites exist after line done");
    assert(invProd.some(function (inv) { return inv.roleId === "producer"; }), "producer dig can appear after line done");

    weights.careerWorld.mobility.inviteRoleWeights = {
      programmer: 1,
      design: 1,
      art: 1,
      music: 1,
      producer: 0
    };
    const invStaff = sim.listCareerInvites(after, weights);
    assert(invStaff.length >= 1, "staff digs while currently producer");
    assert(invStaff.every(function (inv) { return inv.roleId !== "producer"; }), "producer weight 0 → staff only");
    assert(invStaff.some(function (inv) {
      return ["programmer", "design", "art", "music"].indexOf(inv.roleId) >= 0;
    }), "staff role dig while producer");

    after.career.invites = [invStaff[0]];
    const acc = sim.acceptCareerInvite(after, invStaff[0].id, weights);
    assert(acc.ok, "accept staff dig as producer");
    assert(acc.state.career.roleId === invStaff[0].roleId, "switched to staff role");
    assert(acc.state.career.growthStage === "employee", "growthStage back to employee");
    assert(!sim.isCareerProducer(acc.state), "no longer producer after staff dig");

    after = finishProducerLine(hiredAt("music", 4));
    after.year = 1995;
    after.month = 12;
    after.career.titleId = null;
    weights.careerWorld.mobility.hopRoleWeights = {
      programmer: 1,
      design: 1,
      art: 1,
      music: 1,
      producer: 0
    };
    const hops = sim.listYearEndOffers(after, weights);
    const hopStaff = hops.filter(function (o) { return !o.kind; });
    assert(hopStaff.length >= 1, "year-end hops");
    hopStaff.forEach(function (o) {
      assert(o.roleId !== "producer", "hop staff when producer weight 0");
    });

    weights.careerWorld.mobility.hopRoleWeights = {
      programmer: 0,
      design: 0,
      art: 0,
      music: 0,
      producer: 1
    };
    const hopsProd = sim.listYearEndOffers(after, weights).filter(function (o) { return !o.kind; });
    assert(hopsProd.some(function (o) { return o.roleId === "producer"; }), "producer hop after line done");

    ok("producer catalog locked; invite/hop roles gated by become-producer line");
  })();

  (function careerScoreTracksColleaguesAndMedia() {
    const world = config.careerWorld;
    const player = world.player || {};
    const dims = ["program", "design", "art", "music"];
    dims.forEach(function (d) {
      assert(player.startingStats[d] >= 16 && player.startingStats[d] <= 20, d + " starting teens");
    });
    assert(player.specialtyBonus >= 6 && player.specialtyBonus <= 8, "specialtyBonus 6-8");
    assert(Math.abs(sim.careerCraftPublicScore(30, 5, 6, config) - 3) <= 0.4, "craft 5x30x6 ≈3");
    assert(Math.abs(sim.careerCraftPublicScore(50, 5, 6, config) - 5) <= 0.4, "craft 5x50x6 ≈5");
    assert(sim.careerCraftPublicScore(100, 5, 6, config) >= 9.5, "craft 5x100x6 touches 10");
    assert(sim.careerCraftPublicScore(30, 5, 24, config) < 8, "weak team cannot grind masterpiece");

    function meanStats(stats) {
      return (stats.program + stats.design + stats.art + stats.music) / 4;
    }
    function hireAt(companyId, role) {
      let st = sim.createCareerGame("测", role || "programmer", config);
      st.career.companyId = companyId;
      st.career.studioId = sim.defaultStudioId(sim.careerCompany(companyId, config));
      st.career.roleId = role || "programmer";
      st.career.jobRank = 1;
      st.rngSeed = 42;
      st.rngCount = 0;
      sim.ensureCareerColleagues(st, config);
      return st;
    }

    const nintendo = hireAt("nintendo", "programmer");
    assert((nintendo.career.colleagues || []).length === 4, "four nintendo colleagues");
    nintendo.career.colleagues.forEach(function (c) {
      assert(c.jobRank != null, "colleague has jobRank");
      if (c.roleId === "producer") {
        assert(c.jobRank >= 5 && c.jobRank <= 6, "power3 producer rank " + c.jobRank);
      } else {
        assert(c.jobRank >= 4 && c.jobRank <= 6, "power3 specialist rank " + c.jobRank);
      }
      const avg = meanStats(c.stats);
      assert(avg >= 80 && avg <= 100, "power3 stats " + avg);
    });

    const atlus = hireAt("atlus", "programmer");
    atlus.career.colleagues.forEach(function (c) {
      assert(c.jobRank >= 1 && c.jobRank <= 3, "power1 rank " + c.jobRank);
      const avg = meanStats(c.stats);
      assert(avg >= 35 && avg <= 58, "power1 stats " + avg);
    });
    const nAvg = meanStats(sim.careerTeamAvgStats(nintendo, config));
    const pAvg = meanStats(sim.careerTeamAvgStats(atlus, config));
    assert(nAvg > pAvg + 15, "power3 team avg exceeds power1");
    const nCraft = sim.careerCraftPublicScore(nAvg, 5, 6, config);
    const pCraft = sim.careerCraftPublicScore(pAvg, 5, 6, config);
    assert(nCraft >= 6.5 && nCraft <= 9.2, "nintendo virtual intern craft " + nCraft);
    assert(pCraft >= 2.5 && pCraft <= 5.5, "power1 virtual intern craft " + pCraft);
    assert(nCraft > pCraft + 1.5, "nintendo virtual beats small-studio virtual");

    const oot = sim.careerTitle("oot", config);
    assert(oot && oot.landmark && oot.prestige === 5, "oot landmark p5");
    nintendo.career.titleId = "oot";
    nintendo.career.liveStats = sim.careerLiveFromTitle(nintendo, oot, config);
    sim.shipPlayerTitle(nintendo, config, [], []);
    const rec = (nintendo.worldReleased || []).filter(function (g) { return g.id === "oot"; })[0];
    assert(rec && rec.score >= 9.5 && rec.score <= 10, "intern landmark public " + (rec && rec.score));
    assert(rec.score >= oot.score - 0.1, "landmark floor catalog-0.1");
    assert(rec.media && rec.media.rows && rec.media.rows.length === 5, "five media rows");
    rec.media.rows.forEach(function (row) {
      assert(Math.abs(row.score - rec.score) <= 0.7, "media tracks public " + row.score + " vs " + rec.score);
    });
    assert(typeof rec.launchSales === "number" && rec.launchSales > 0, "intern landmark launchSales");
    assert(rec.launchSales === sim.careerLaunchSales(oot, rec.score, config, rec.liveStats || rec.stats).launchSales, "landmark launch matches formula");

    const mid = sim.createCareerGame("测", "programmer", config);
    mid.rngSeed = 7;
    mid.rngCount = 0;
    const pub = sim.liveToPublicScore({ program: 90, design: 90, art: 90, music: 90 }, 7.2, config, mid);
    const around = sim.scoreMediaFromPublic(mid, pub, config, {
      min: world.scoreFromLive.mediaJitterMin,
      max: world.scoreFromLive.mediaJitterMax
    });
    assert(around.rows.every(function (r) { return Math.abs(r.score - pub) <= 0.7; }), "scatter around public");
    assert(around.rows.some(function (r) { return r.score < 9.5; }), "high live stats do not force media 10s");
    const studioMedia = sim.scoreMedia(mid, { program: 90, script: 90, art: 90, music: 90 }, [], config, null);
    assert(studioMedia.rows.every(function (r) { return r.score >= 9.5; }), "studio divisor 6.5 still maps 90s to ~10");

    const tw = deepClone(config);
    tw.careerWorld = deepClone(config.careerWorld);
    tw.careerWorld.devEvents.chance = 1;
    tw.careerWorld.devEvents.minGapMonths = 0;
    tw.careerWorld.devEvents.maxPerYear = 99;
    tw.careerWorld.devEvents.list = [{
      id: "ootHistory",
      titleId: "oot",
      displayName: "史实",
      text: "测",
      presentation: "notice",
      qualityDim: "program",
      qualityDelta: 10
    }];
    const hist = hireAt("nintendo", "programmer");
    hist.career.titleId = "oot";
    hist.career.liveStats = { program: 90, design: 90, art: 90, music: 90 };
    hist.career.jobRank = 1;
    hist.rngSeed = 1;
    hist.rngCount = 0;
    const fired = sim.rollCareerDevEvent(hist, tw, []);
    assert(fired && fired.id === "ootHistory", "titleId notice rolled");
    assert(hist.career.liveStats.program === 100, "landmark titleId notice unscaled, got " + hist.career.liveStats.program);

    ok("starting teens, craft anchors, colleagues-by-power, intern landmark, media around public");
  })();

  (function careerLaunchSalesZeroWhenCoeffsSaySo() {
    const tw = deepClone(config);
    tw.careerWorld = deepClone(config.careerWorld);
    tw.careerWorld.launchSales = { scoreCoeff: 0, prestigeCoeff: 0, qualitySumCoeff: 0 };
    const packed = sim.careerLaunchSales(
      { prestige: 5, stats: { program: 90, design: 90, art: 90, music: 90 } },
      10,
      tw,
      { program: 90, design: 90, art: 90, music: 90 }
    );
    assert(packed.baselineSales === 0 && packed.launchSales === 0, "zero coeffs → 0 launch");
    const g = sim.createCareerGame("测", "programmer", tw);
    let st = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, tw).state;
    st.career.companyId = "square";
    st.career.titleId = "chronoTrigger";
    st.career.liveStats = { program: 90, design: 95, art: 88, music: 92 };
    st.career.credits = [{ titleId: "chronoTrigger", companyId: "square", roleId: "programmer" }];
    st.year = 1995;
    st.month = 3;
    sim.shipPlayerTitle(st, tw, [], []);
    assert(st.lastMedia.launchSales === 0, "ship writes 0 when formula says so");
    assert(st.lastMedia.media && st.lastMedia.media.rows.length === 5, "media rec still present");
    ok("career launchSales is 0 only when coeffs say so");
  })();

  (function optionalEventLinesParallelKickOutReturnMentor() {
    const world = config.careerWorld;
    const lines = (world.eventLines || {}).lines || [];
    const ids = lines.map(function (l) { return l.id; });
    ["bond-mentor", "bond-peer", "bond-junior", "epic-title", "era-return-china"].forEach(function (id) {
      assert(ids.indexOf(id) >= 0, "optional line " + id);
      const def = lines.filter(function (l) { return l.id === id; })[0];
      assert(def.exclusiveGroup !== "careerPath", id + " not in careerPath");
    });
    const kojima = ((sim.careerCompany("konami", config) || {}).seniors || []).filter(function (s) {
      return s.id === "kojima";
    })[0];
    assert(kojima && kojima.successorCompanyId === "kojimaProductions", "kojima successor configured");

    function hired(role) {
      let g = sim.createCareerGame("测", role || "programmer", config);
      g = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
      return g;
    }

    let st = hired("programmer");
    st.career.jobRank = 4;
    st.career.fame = 20;
    st.career.honor = 20;
    st.career.jobXp = 99;
    st.career.monthsInRank = 99;
    st.career.promotionsThisYear = 0;
    st.career.credits = [{ titleId: "x", shipped: true, virtual: false, jobRank: 4 }];
    const company0 = st.career.companyId;
    assert(st.career.bonds && st.career.bonds.mentor, "mentor pinned on hire");
    const prod = sim.startCareerLine(st, "become-producer", config);
    assert(prod.ok, "start producer while bonds exist");
    let step = sim.resolveCareerLineChoice(prod.state, "become-producer", "invite", "yes", config);
    st = step.state;
    const mentorStart = sim.startCareerLine(st, "bond-mentor", config);
    assert(mentorStart.ok, "mentor starts while producer line active");
    st = mentorStart.state;
    const actives = sim.activeCareerLineIds(st);
    assert(actives.indexOf("become-producer") >= 0 && actives.indexOf("bond-mentor") >= 0, "two lines active");
    step = sim.resolveCareerLineChoice(st, "bond-mentor", "take-in", "follow", config);
    st = step.state;
    st.career.lines["become-producer"].waitUntil = sim.monthIndex(st.year, st.month);
    st.career.lines["become-producer"].pending = false;
    st.career.lines["bond-mentor"].waitUntil = sim.monthIndex(st.year, st.month);
    st.career.lines["bond-mentor"].pending = false;
    const qPri = [];
    sim.processCareerLines(st, config, qPri, []);
    assert(qPri.length === 1, "one beat per month");
    assert(qPri[0].lineId === "become-producer", "careerPath beat wins priority, got " + (qPri[0] && qPri[0].lineId));

    let kickSt = hired("design");
    const chrono = sim.careerTitle("chronoTrigger", config);
    const worldScore0 = chrono && chrono.score;
    const savings0 = kickSt.career.savings;
    const fame0 = kickSt.career.fame;
    kickSt.career.titleId = "chronoTrigger";
    kickSt.career.companyId = kickSt.career.companyId || "square";
    const epic = sim.startCareerLine(kickSt, "epic-title", config);
    assert(epic.ok, "start epic-title");
    const collapsed = sim.resolveCareerLineChoice(epic.state, "epic-title", "weight", "collapse", config);
    assert(collapsed.ok && collapsed.done, "collapse completes");
    assert(collapsed.state.career.companyId == null, "kicked out of company");
    assert((collapsed.state.career.tenures || []).every(function (t) { return t.endYear != null; }), "tenures closed");
    assert(collapsed.state.career.savings === savings0, "no extra money penalty");
    assert(collapsed.state.career.fame === fame0, "no extra fame penalty");
    assert(sim.careerTitle("chronoTrigger", config).score === worldScore0, "catalog score unchanged");
    assert(sim.canCareerHop(collapsed.state, config), "unemployed can seek work");
    const offers = sim.listYearEndOffers(collapsed.state, config);
    assert(offers.length >= 1, "year-end offers after kick");
    offers[0].successChance = 1;
    collapsed.state.career.yearEndOffers = offers;
    const hopped = sim.applyYearEndOffer(collapsed.state, offers[0].id, config);
    assert(hopped.ok && hopped.hopped, "rehire via existing hop");
    assert(hopped.state.career.companyId, "employed again");

    let ret = hired("art");
    ret.year = 2014;
    ret.month = 3;
    const retStart = sim.startCareerLine(ret, "era-return-china", config);
    assert(retStart.ok, "start return line");
    let retStep = sim.resolveCareerLineChoice(retStart.state, "era-return-china", "letter", "read", config);
    assert(retStep.ok, "read letter");
    const invitePage = (retStep.queue || []).filter(function (p) { return p.beatId === "invite"; })[0];
    assert(invitePage, "chained to return invite");
    const optIds = (invitePage.options || []).map(function (o) { return o.id; });
    assert(optIds.indexOf("staff") >= 0, "staff option");
    assert(optIds.indexOf("producer") >= 0, "producer option allowed on this invite");
    const staffJoin = sim.resolveCareerLineChoice(retStep.state, "era-return-china", "invite", "staff", config);
    assert(staffJoin.ok, "staff join");
    const cnIds = ["mihoyo", "hypergryph", "paperGames"];
    assert(cnIds.indexOf(staffJoin.state.career.companyId) >= 0, "joined a catalog CN company");
    assert(["programmer", "art", "design", "music"].indexOf(staffJoin.state.career.roleId) >= 0, "staff is one of four roles");
    assert(staffJoin.state.career.growthStage !== "founder", "staff not founder");
    const prodJoin = sim.resolveCareerLineChoice(retStep.state, "era-return-china", "invite", "producer", config);
    assert(prodJoin.ok, "producer join");
    assert(prodJoin.state.career.roleId === "producer", "producer role");
    assert(prodJoin.state.career.growthStage === "producer", "producer stage");
    assert(prodJoin.state.career.growthStage !== "founder", "still not founder");
    assert(cnIds.indexOf(prodJoin.state.career.companyId) >= 0, "producer is employee of catalog CN company");
    assert(sim.isGrowthStageLocked("founder", config), "founder still locked");

    let stay = hired("music");
    stay.career.companyId = "konami";
    stay.year = 2015;
    stay.month = 9;
    stay.career.bonds = stay.career.bonds || {};
    stay.career.bonds.mentor = {
      seniorId: "kojima",
      name: "小岛秀夫",
      alias: "小岛秀夫",
      title: "制作人",
      companyId: "konami",
      homeCompanyId: "konami",
      colocated: true,
      departYear: 2015,
      successorCompanyId: "kojimaProductions",
      monthsTogether: 20
    };
    const stayCo = stay.career.companyId;
    const mStart = sim.startCareerLine(stay, "bond-mentor", config);
    const mFollow = sim.resolveCareerLineChoice(mStart.state, "bond-mentor", "take-in", "follow", config);
    stay = mFollow.state;
    const mentorDef = lines.filter(function (l) { return l.id === "bond-mentor"; })[0];
    const leaveIdx = mentorDef.beats.map(function (b) { return b.id; }).indexOf("leave");
    assert(leaveIdx >= 0, "leave beat still present");
    stay.career.lines["bond-mentor"].beat = leaveIdx;
    stay.career.lines["bond-mentor"].pending = false;
    stay.career.lines["bond-mentor"].waitUntil = null;
    stay.career.lines["bond-mentor"].waitingFor = null;
    const qLeave = [];
    sim.processCareerLines(stay, config, qLeave, []);
    assert(qLeave.length && qLeave[0].beatId === "leave", "leave beat ready");
    const stayed = sim.resolveCareerLineChoice(stay, "bond-mentor", "leave", "stay", config);
    assert(stayed.ok && stayed.done, "not following is a legal end");
    assert(stayed.state.career.lines["bond-mentor"].status === "done", "mentor line done");
    assert(stayed.state.career.companyId === stayCo, "still at same company");
    void company0;

    ok("optional lines parallel, kick-out only, return invite roles, mentor stay ends");
  })();

  (function themedBondLinesMergerRemoteStoryPromo() {
    const world = config.careerWorld;
    const lines = (world.eventLines || {}).lines || [];
    function lineDef(id) {
      return lines.filter(function (l) { return l.id === id; })[0];
    }
    function beatIdx(lineId, beatId) {
      const beats = (lineDef(lineId).beats || []);
      let i;
      for (i = 0; i < beats.length; i++) if (beats[i].id === beatId) return i;
      return -1;
    }
    function hired(role) {
      let g = sim.createCareerGame("测", role || "programmer", config);
      g = sim.acceptOpeningOffer(g, g.career.openingOffers[0].id, config).state;
      return g;
    }
    function pinPeer(st) {
      st.career.bonds = st.career.bonds || {};
      if (!st.career.bonds.peer) {
        st.career.bonds.peer = {
          id: "peer-test",
          name: "同组",
          roleId: "design",
          jobRank: 3,
          companyId: st.career.companyId,
          homeCompanyId: st.career.companyId,
          monthsTogether: 30,
          colocated: true
        };
      } else {
        st.career.bonds.peer.monthsTogether = 30;
        st.career.bonds.peer.jobRank = st.career.bonds.peer.jobRank || 3;
        st.career.bonds.peer.homeCompanyId = st.career.bonds.peer.homeCompanyId || st.career.companyId;
        st.career.bonds.peer.colocated = true;
      }
      return st;
    }
    function jumpBeat(st, lineId, beatId) {
      st.career.lines[lineId].beat = beatIdx(lineId, beatId);
      st.career.lines[lineId].pending = false;
      st.career.lines[lineId].waitUntil = sim.monthIndex(st.year, st.month);
      st.career.lines[lineId].waitingFor = null;
      st.career.lines[lineId].waitUntilYear = null;
    }
    function hopTo(st, companyId) {
      const co = sim.careerCompany(companyId, config);
      const studio = ((co && co.studios) || [])[0];
      st.career.yearEndOffers = [{
        id: "test-hop",
        companyId: companyId,
        studioId: studio && studio.id,
        roleId: st.career.roleId,
        salary: 1200,
        successChance: 1
      }];
      return sim.applyYearEndOffer(st, "test-hop", config);
    }

    assert(lineDef("company-merger") && lineDef("company-merger").exclusiveGroup !== "careerPath", "merger not careerPath");
    assert((world.producerCareer || {}).minJobRank === 4, "producer minRank still 4");

    let st = hired("programmer");
    st.career.jobRank = 2;
    let started = sim.startCareerLine(st, "bond-mentor", config);
    let step = sim.resolveCareerLineChoice(started.state, "bond-mentor", "take-in", "follow", config);
    st = step.state;
    jumpBeat(st, "bond-mentor", "nominate");
    let q = [];
    sim.processCareerLines(st, config, q, []);
    assert(q.length && q[0].beatId === "nominate", "mentor nominate fires at rank 2");
    step = sim.resolveCareerLineChoice(st, "bond-mentor", "nominate", "accept-promo", config);
    assert(step.ok, "rank2 nominate promote");
    assert(step.state.career.jobRank === 3, "mentor finale rank 2 → +1");
    ok("mentor finale rank 2 promotes +1");

    st = hired("programmer");
    st.career.jobRank = 3;
    st.career.promotionsThisYear = 0;
    assert(!sim.canStartBecomeProducerLine(st, config), "rank 3 cannot start producer globally");
    assert(sim.canStartBecomeProducerLine(st, config, { ignoreMinRank: true }), "mentor sponsor ignores minRank");
    started = sim.startCareerLine(st, "bond-mentor", config);
    step = sim.resolveCareerLineChoice(started.state, "bond-mentor", "take-in", "follow", config);
    st = step.state;
    jumpBeat(st, "bond-mentor", "nominate");
    q = [];
    sim.processCareerLines(st, config, q, []);
    assert(q[0] && q[0].beatId === "nominate", "nominate at rank 3");
    const optIds = (q[0].options || []).map(function (o) { return o.id; });
    assert(optIds.indexOf("sponsor-producer") >= 0, "producer sponsor option visible");
    step = sim.resolveCareerLineChoice(st, "bond-mentor", "nominate", "sponsor-producer", config);
    assert(step.ok, "sponsor producer");
    const act = sim.activeCareerLineIds(step.state);
    assert(act.indexOf("become-producer") >= 0, "mentor rank 3 starts become-producer");
    assert((world.producerCareer || {}).minJobRank === 4, "minRank config unchanged");
    ok("mentor finale rank 3 starts become-producer");

    const tweaked = deepClone(config);
    const peerLine = ((tweaked.careerWorld.eventLines || {}).lines || []).filter(function (l) {
      return l.id === "bond-peer";
    })[0];
    peerLine.startWhen.startChance = 1;
    peerLine.startWhen.minMonthsTogether = { bond: "peer", n: 0 };
    let peerSt = pinPeer(hired("programmer"));
    peerSt.career.jobRank = 2;
    q = [];
    sim.processCareerLines(peerSt, tweaked, q, []);
    assert(!(peerSt.career.lines && peerSt.career.lines["bond-peer"] && peerSt.career.lines["bond-peer"].status === "active"), "peer line will not start at jobRank 2");
    peerSt.career.jobRank = 3;
    q = [];
    sim.processCareerLines(peerSt, tweaked, q, []);
    assert(peerSt.career.lines && peerSt.career.lines["bond-peer"] && peerSt.career.lines["bond-peer"].status === "active", "peer starts at jobRank 3");
    ok("peer line gated at minJobRank 3");

    function startPeerFinale(rank) {
      let s = pinPeer(hired("programmer"));
      s.career.jobRank = rank;
      s.career.promotionsThisYear = 0;
      const go = sim.startCareerLine(s, "bond-peer", config);
      const rival = sim.resolveCareerLineChoice(go.state, "bond-peer", "rival", "compete", config);
      s = rival.state;
      jumpBeat(s, "bond-peer", "finale");
      const qq = [];
      sim.processCareerLines(s, config, qq, []);
      assert(qq[0] && qq[0].beatId === "finale", "peer finale ready");
      return { state: s, page: qq[0] };
    }
    let pack = startPeerFinale(3);
    const promoIds = (pack.page.options || []).map(function (o) { return o.id; });
    assert(promoIds.indexOf("promo") >= 0 && promoIds.indexOf("dual") >= 0 && promoIds.indexOf("role-change") >= 0, "peer finale endings present");
    step = sim.resolveCareerLineChoice(pack.state, "bond-peer", "finale", "promo", config);
    assert(step.state.career.jobRank === 4, "peer promo 3→4");
    pack = startPeerFinale(3);
    const peerRank0 = pack.state.career.bonds.peer.jobRank;
    step = sim.resolveCareerLineChoice(pack.state, "bond-peer", "finale", "dual", config);
    assert(step.state.career.jobRank === 4, "dual player +1");
    assert(step.state.career.bonds.peer.jobRank === peerRank0 + 1, "dual peer +1");
    pack = startPeerFinale(3);
    const role0 = pack.state.career.roleId;
    step = sim.resolveCareerLineChoice(pack.state, "bond-peer", "finale", "role-change", config);
    assert(step.state.career.roleId !== role0, "role change among staff jobs");
    assert(step.state.career.jobRank === 3, "role change keeps jobRank");
    pack = startPeerFinale(4);
    step = sim.resolveCareerLineChoice(pack.state, "bond-peer", "finale", "promo", config);
    assert(step.state.career.jobRank === 5, "peer promo 4→5");
    assert(step.state.career.lines["promo-to-expert"] && step.state.career.lines["promo-to-expert"].status === "done", "promo-to-expert marked done");
    ok("peer finale promote / dual / role change");

    st = hired("programmer");
    started = sim.startCareerLine(st, "bond-mentor", config);
    step = sim.resolveCareerLineChoice(started.state, "bond-mentor", "take-in", "follow", config);
    st = step.state;
    const home0 = st.career.companyId;
    const hopped = hopTo(st, home0 === "nintendo" ? "sega" : "nintendo");
    assert(hopped.ok && hopped.hopped, "mid-line hop");
    st = hopped.state;
    assert(st.career.bonds.mentor.colocated === false, "hop sets colocated false");
    assert(st.career.lines["bond-mentor"].remotePending, "remote beat pending");
    q = [];
    sim.processCareerLines(st, config, q, []);
    assert(q.length && q[0].beatId === "remote", "remote check beat");
    step = sim.resolveCareerLineChoice(st, "bond-mentor", "remote", "keep", config);
    assert(step.ok && step.state.career.lines["bond-mentor"].status === "active", "keep in touch continues");
    ok("hop mid-line remote beat");

    st = hired("programmer");
    st.career.companyId = "square";
    st.career.studioId = "square-rd1";
    st.year = 2004;
    q = [];
    sim.processCareerLines(st, config, q, []);
    assert(q.length && q[0].lineId === "company-merger", "merger interrupt queued");
    step = sim.resolveCareerLineChoice(st, "company-merger", "merge", "stay", config);
    assert(step.ok && step.state.career.companyId === "squareEnix", "merger stay joins successor");
    ok("company merger join successor");

    st = hired("art");
    started = sim.startCareerLine(st, "bond-junior", config);
    assert(started.ok, "junior line starts");
    st = started.state;
    assert(st.career.bonds && st.career.bonds.junior, "ensureBond junior");
    st.year = 2014;
    const retStart = sim.startCareerLine(st, "era-return-china", config);
    step = sim.resolveCareerLineChoice(retStart.state, "era-return-china", "letter", "read", config);
    assert((step.queue || []).some(function (p) { return p.beatId === "reveal"; }) || (step.state.career.bonds.junior && step.state.career.bonds.junior.revealed), "return line reveal still works");
    ok("junior bond + return reveal");

    st = hired("programmer");
    st.career.jobRank = 1;
    st.career.promotionsThisYear = 0;
    const reqs = ((world.jobRanks.promotion || {}).requirements || [])[1] || {};
    const progRole = sim.careerRole(st.career.roleId, config);
    const progKey = (progRole && progRole.stat) || "program";
    st.career.monthsInRank = (reqs.monthsInRank || 0) + 1;
    st.career.jobXp = (reqs.mainStatOrJobXp || 0) + 1;
    st.career.stats = st.career.stats || {};
    st.career.stats[progKey] = (reqs.mainStat != null ? reqs.mainStat : (reqs.mainStatOrJobXp || 0)) + 1;
    st.career.fame = (reqs.fameOrHonor || 0) + 1;
    st.career.credits = [{ titleId: "c0", shipped: true, virtual: false, jobRank: 1 }];
    const first = sim.promoteCareer(st, config);
    assert(first.ok && first.state.career.jobRank === 2, "click promo 1→2");
    st = first.state;
    assert(st.career.promotionsThisYear >= 1, "year cap used");
    started = sim.startCareerLine(st, "bond-mentor", config);
    step = sim.resolveCareerLineChoice(started.state, "bond-mentor", "take-in", "follow", config);
    st = step.state;
    jumpBeat(st, "bond-mentor", "nominate");
    q = [];
    sim.processCareerLines(st, config, q, []);
    step = sim.resolveCareerLineChoice(st, "bond-mentor", "nominate", "accept-promo", config);
    assert(step.state.career.jobRank === 2, "second story promo same year delayed");
    assert(step.state.career.pendingStoryPromos >= 1, "pending story promo queued");
    st = step.state;
    st.month = 1;
    st.year += 1;
    st.career.promotionsThisYear = 0;
    sim.applyPendingStoryPromos(st, config);
    assert(st.career.jobRank === 3, "delayed story promo settles in January");
    ok("year promo cap delays second story promo");
  })();


  console.log("\n" + passed + " tests passed");
}

try {
  main();
} catch (e) {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
}
