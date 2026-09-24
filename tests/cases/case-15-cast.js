// 测试用例组：15-cast（人物层 cast：真实角色 / 随机角色 + 真实/虚构双姓名模式）
"use strict";

module.exports = function runGroup(ctx) {
  const GDS = ctx.GDS, sim = ctx.sim, config = ctx.config, assert = ctx.assert, ok = ctx.ok;

  // 只换 nameMode 的浅拷贝配置：cast 取人只读 careerWorld.nameMode，不必深拷贝整个 config。
  function withMode(mode) {
    return Object.assign({}, config, {
      careerWorld: Object.assign({}, config.careerWorld, { nameMode: mode })
    });
  }

  (function castTableCoversEverySenior() {
    const world = config.careerWorld;
    const cast = world.cast || [];

    assert(world.nameMode === "real", "nameMode defaults to real");
    assert(cast.length === 186, "cast has 186 entries, got " + cast.length);
    assert(cast.every(function (p) { return p.real === true; }), "every cast entry is real:true");
    assert(cast.every(function (p) { return !!p.alias; }), "every cast entry has a fiction name");
    assert(cast.every(function (p) { return p.roles && p.roles.length; }), "every cast entry has roles");
    assert(cast.every(function (p) { return p.career && p.career.length; }), "every cast entry has a duty window");

    // seniors 是兼容引用层：不能出现 cast 里找不到的孤儿
    const senIds = [];
    (world.companies || []).forEach(function (c) {
      (c.seniors || []).forEach(function (s) { senIds.push(s.id); });
    });
    assert(senIds.length === 111, "seniors count 111, got " + senIds.length);
    assert(senIds.every(function (id) { return !!sim.castFind(id, config); }),
      "every senior id resolves in cast");
    ok("cast table: 186 real persons, all seniors migrated, roles + duty windows present");
  })();

  (function nameModeSwitchesBothWays() {
    const fiction = withMode("fiction");
    const m = sim.castFind("miyamoto", config);

    assert(m.name === "宫本茂" && m.alias === "宫本彻", "person keeps both names");
    assert(sim.castName(m, config) === "宫本茂", "real mode → 真名");
    assert(sim.castName(m, fiction) === "宫本彻", "fiction mode → 虚构名");
    assert(sim.castName(m, config) !== sim.castName(m, fiction), "the two modes actually differ");
    // 未知模式回落 real，避免配置写错时名字变空
    assert(sim.castName(m, withMode("bogus")) === "宫本茂", "unknown mode falls back to real");
    // 字符串原样返回（调用方可能已经传了拼好的名字）
    assert(sim.castName("张三", fiction) === "张三", "plain string passes through");
    assert(sim.castName(null, config) === "", "null person → empty string");

    assert(sim.castLabel(m, config) === "宫本茂 · 制作总监", "castLabel joins name + title");
    assert(sim.castLabel(m, fiction) === "宫本彻 · 制作总监", "castLabel follows name mode");
    ok("castName/castLabel: real↔fiction both resolve, unknown mode falls back, title kept");
  })();

  (function seniorLabelFollowsNameMode() {
    const fiction = withMode("fiction");
    const nintendo = sim.careerCompany("nintendo", config);
    const seniors = sim.careerSeniors(nintendo, config);
    const m = seniors.filter(function (s) { return s.id === "miyamoto"; })[0];
    assert(!!m, "nintendo still exposes miyamoto via the compat seniors layer");

    const labReal = sim.careerSeniorLabel(m, config);
    const labFic = sim.careerSeniorLabel(m, fiction);
    assert(labReal.indexOf("宫本茂") === 0, "HQ label shows 真名 by default: " + labReal);
    assert(labFic.indexOf("宫本彻") === 0, "HQ label follows fiction mode: " + labFic);
    assert(labReal !== labFic, "label differs between modes");
    assert(labReal.indexOf("·") > 0, "label keeps the title suffix");
    ok("careerSeniorLabel resolves names via cast and follows nameMode");
  })();

  (function castForMatchesRoleWindowAndDeterminism() {
    // 任天堂驻员：宫本茂(producer,design) / 岩田聪(producer,programmer) /
    // 中乡俊彦(programmer) / 今村孝矢(art)。程序岗必须落到真会写程序的人身上
    // —— 现行 pinCareerBonds 取 seniors[0]，会错拿宫本茂。
    const prog = sim.castFor({ companyId: "nintendo", year: 1997, roleId: "programmer" }, config);
    assert(prog && prog.roles.indexOf("programmer") >= 0,
      "programmer slot resolves to a programmer, got " + (prog && prog.id));
    assert(prog.id !== "miyamoto", "programmer slot never lands on a non-programmer");
    const design = sim.castFor({ companyId: "nintendo", year: 1997, roleId: "design" }, config);
    assert(design && design.id === "miyamoto", "design slot resolves to miyamoto");
    const any1 = sim.castFor({ companyId: "nintendo", year: 1997 }, config);
    assert(any1 && any1.companyId === "nintendo", "no role filter → anyone on the roster");

    // 年代窗口：米哈游 2012 才有可入职年
    assert(sim.castFor({ companyId: "mihoyo", year: 1995, roleId: "producer" }, config) === null,
      "mihoyo unreachable in 1995");
    assert(!!sim.castFor({ companyId: "mihoyo", year: 2015, roleId: "producer" }, config),
      "mihoyo reachable in 2015");

    // 离职窗口：小岛 2015 离开科乐美
    assert(!!sim.castFor({ companyId: "konami", year: 2010, roleId: "producer" }, config),
      "kojima still at konami in 2010");
    assert(sim.castFor({ companyId: "konami", year: 2016, roleId: "producer" }, config) === null,
      "kojima gone from konami by 2016");

    // 无数据 → null（降级信号，交调用方兜底生成随机角色）
    assert(sim.castFor({ companyId: "__none__", year: 2000, roleId: "producer" }, config) === null,
      "unknown company degrades to null");

    // 确定性：同一次询问永远同一个人
    const a = sim.castFor({ companyId: "ea", year: 2005, roleId: "producer" }, config);
    const b = sim.castFor({ companyId: "ea", year: 2005, roleId: "producer" }, config);
    assert(a && a.id === b.id, "same query → same person (deterministic)");
    const ex = sim.castFor({ companyId: "nintendo", year: 1997, roleId: "producer", exclude: ["miyamoto"] }, config);
    assert(ex && ex.id === "iwata", "exclude drops the named person, got " + (ex && ex.id));
    ok("castFor: role match, duty window, determinism, exclude, null degradation");
  })();

  (function castQueriesArePure() {
    const g = sim.createCareerGame("测", "programmer", config);
    const before = JSON.stringify(g);

    const roster = sim.castRoster({ companyId: "nintendo", year: 1997 }, config);
    assert(roster.length === 4, "nintendo roster has 4, got " + roster.length);
    assert(roster.every(function (p) { return p.real; }), "roster only contains real persons");
    const byRole = sim.castRoster({ companyId: "ea", year: 2005, roleId: "programmer" }, config);
    assert(byRole.length >= 1, "ea has at least one programmer on the roster");
    assert(sim.castRoster({ companyId: "nintendo", year: 1900 }, config).length === 0,
      "roster before the duty window is empty");

    sim.castFor({ companyId: "ea", year: 2005, roleId: "producer" }, config);
    sim.castLabel(sim.castFind("miyamoto", config), config);
    assert(JSON.stringify(g) === before, "cast queries do not mutate state");
    ok("cast queries are pure (no state write, no RNG draw)");
  })();

  (function juniorRevealNameGoesThroughCast() {
    const fiction = withMode("fiction");

    const g = sim.createCareerGame("测", "programmer", config);
    sim.pinCareerBonds(g, config);
    const jr = sim.ensureCareerJuniorBond(g, config);
    assert(!!jr && !!jr.revealSeniorId, "junior bond picks a reveal senior");
    const castJr = sim.castFind(jr.revealSeniorId, config);
    assert(!!castJr, "the revealed senior exists in cast");
    assert(jr.aliasNow === sim.castName(castJr, config),
      "junior reveal name resolves through cast: " + jr.aliasNow);

    const g2 = sim.createCareerGame("测", "programmer", config);
    sim.pinCareerBonds(g2, config);
    const jr2 = sim.ensureCareerJuniorBond(g2, fiction);
    const castJr2 = sim.castFind(jr2.revealSeniorId, config);
    assert(jr2.aliasNow === sim.castName(castJr2, fiction),
      "junior reveal name follows fiction mode: " + jr2.aliasNow);
    ok("junior bond reveal name goes through castName (mode-aware)");
  })();

  (function staffBeatsFreelanceWhichBeatsNothing() {
    const world = config.careerWorld;
    const cast = world.cast || [];
    const free = cast.filter(function (p) { return p.attach === "freelance"; });

    // 自由职业池：作曲 + 插画/概念，一个都不绑公司
    assert(free.length >= 20, "freelance pool exists, got " + free.length);
    assert(free.every(function (p) { return p.companyId === null; }),
      "freelance entries are not attached to a company");
    assert(free.some(function (p) { return p.roles.indexOf("music") >= 0; }), "freelance covers music");
    assert(free.some(function (p) { return p.roles.indexOf("art") >= 0; }), "freelance covers art");

    // 三级优先级：公司驻员 > 自由职业者 > null
    const prog = sim.castFor({ companyId: "nintendo", year: 1997, roleId: "programmer" }, config);
    assert(prog && prog.attach !== "freelance", "staff roster wins over the freelance pool");
    const music = sim.castFor({ companyId: "nintendo", year: 1997, roleId: "music" }, config);
    assert(music && music.attach === "freelance",
      "music falls back to a freelance composer when the studio has none");
    // producer 没有自由职业来源，无数据的公司仍然返回 null
    assert(sim.castFor({ companyId: "__none__", year: 2000, roleId: "producer" }, config) === null,
      "no staff and no freelance source → null");

    // 自由职业者不进「公司在职名单」
    const roster = sim.castRoster({ companyId: "nintendo", year: 1997 }, config);
    assert(roster.length > 0 && roster.every(function (p) { return p.companyId === "nintendo"; }),
      "castRoster stays company-only (no freelancers)");
    ok("castFor: staff → freelance → null; roster never mixes in freelancers");
  })();

  (function colleaguesPreferRealCast() {
    function hireAt(companyId, role) {
      const st = sim.createCareerGame("测", role, config);
      st.career.companyId = companyId;
      st.career.roleId = role;
      st.career.jobRank = 1;
      st.rngSeed = 42;
      st.rngCount = 0;
      sim.ensureCareerColleagues(st, config);
      return st;
    }

    // 任天堂(jp) 当年有 miyamoto/iwata/nakago/imamura 四位驻员，同事应尽量贴到真人身上
    const st = hireAt("nintendo", "design");
    const mates = st.career.colleagues || [];
    assert(mates.length === 4, "four colleagues, got " + mates.length);
    const realOnes = mates.filter(function (m) { return !!m.castId; });
    assert(realOnes.length >= 3, "colleagues prefer real cast, got " + realOnes.length + "/4");

    realOnes.forEach(function (m) {
      const p = sim.castFind(m.castId, config);
      assert(!!p, "castId resolves: " + m.castId);
      assert((p.roles || []).indexOf(m.roleId) >= 0,
        "real colleague matches its role slot: " + m.castId + "/" + m.roleId);
      assert(sim.colleagueName(m, config) === sim.castName(p, config),
        "colleagueName follows the shared name mode");
    });
    const ids = realOnes.map(function (m) { return m.castId; });
    assert(ids.length === new Set(ids).size, "no real person occupies two slots");

    // 姓名模式对同事同样生效
    const fiction = Object.assign({}, config, {
      careerWorld: Object.assign({}, config.careerWorld, { nameMode: "fiction" })
    });
    const m0 = realOnes[0];
    const p0 = sim.castFind(m0.castId, config);
    assert(sim.colleagueName(m0, config) === sim.castName(p0, config), "colleague real-mode name");
    assert(sim.colleagueName(m0, fiction) === sim.castName(p0, fiction), "colleague fiction-mode name");

    // 只有一位驻员的公司：该岗位贴真人，其余岗位回落池名
    const dice = hireAt("dice", "design");
    const dProducer = (dice.career.colleagues || []).filter(function (m) { return m.roleId === "producer"; })[0];
    assert(dProducer && dProducer.castId === "liliegren",
      "dice producer slot lands on its only real person, got " + (dProducer && dProducer.castId));
    (dice.career.colleagues || []).forEach(function (m) {
      assert(typeof m.n === "string" && m.n.length > 0, "every colleague has a fallback name");
    });
    ok("colleagues prefer real cast, dedupe per person, fall back to pool names, follow nameMode");
  })();

  (function namePoolIsRegionScoped() {
    const copy = config.copy || {};
    const by = copy.staffNamePoolByRegion || {};
    assert(!!by.jp && !!by.us && !!by.cn && !!by.kr, "four region pools exist");
    assert(copy.staffNamePool.length === by.cn.length, "legacy pool is kept as the cn pool");
    assert(by.jp.indexOf("佐藤") >= 0, "jp pool holds japanese surnames");
    assert(by.jp.every(function (n) { return by.cn.indexOf(n) < 0; }),
      "jp pool does not reuse cn nicknames");
    // 公司地区决定兜底名来源
    const jpCo = sim.careerCompany("capcom", config);
    assert(jpCo.region === "jp", "capcom is a jp company");
    ok("colleague name pool is region-scoped (jp/us/cn/kr); legacy pool kept as cn");
  })();

  (function mentorFollowsPlayerRole() {
    function mentorOf(companyId, role) {
      const st = sim.createCareerGame("测", role, config);
      st.career.companyId = companyId;
      st.career.roleId = role;
      st.career.jobRank = 1;
      st.year = 1997;
      st.career.bonds = { mentor: null, peer: null, junior: null };
      sim.pinCareerBonds(st, config);
      return st.career.bonds.mentor;
    }

    // 任天堂驻员：宫本茂(producer,design) / 岩田聪(producer,programmer)
    //            中乡俊彦(programmer) / 今村孝矢(art)
    const prog = mentorOf("nintendo", "programmer");
    assert(prog && prog.seniorId, "programmer gets a mentor");
    const progCast = sim.castFind(prog.seniorId, config);
    assert(progCast && progCast.roles.indexOf("programmer") >= 0,
      "programmer's mentor can actually program: " + prog.seniorId);
    assert(prog.seniorId !== "miyamoto", "programmer no longer always lands on miyamoto");

    const art = mentorOf("nintendo", "art");
    const artCast = sim.castFind(art.seniorId, config);
    assert(artCast && artCast.roles.indexOf("art") >= 0, "art mentor is an artist: " + art.seniorId);

    const design = mentorOf("nintendo", "design");
    assert(design.seniorId === "miyamoto", "design mentor is miyamoto");

    // 公司里没人能匹配该岗位 → 回落第一个前辈（与改造前一致）
    const fallback = mentorOf("falcom", "programmer");
    assert(fallback && fallback.seniorId,
      "falls back to the first senior when nobody matches the role");
    ok("mentor is picked by the player's role, falling back to the first senior");
  })();

  (function noJoinIntroPopup() {
    // Master 2026-09-22 拍板「不要有入职弹窗」：该节点、其检测器登记与 config 文案已整体移除。
    // 留一条守卫，防止以后顺手加回来又占掉一个月度节点。
    assert(typeof sim.checkJoinIntro === "undefined", "join intro check must stay removed");
    const reg = (sim.careerNodeDetectors || []).filter(function (d) { return d.id === "joinIntro"; });
    assert(reg.length === 0, "join intro detector must not be registered");
    const copy = (config.copy && config.copy.career) || {};
    assert(!Object.keys(copy).some(function (k) { return k.indexOf("joinIntro") === 0; }),
      "join intro copy keys must stay removed");
    ok("no join-intro popup: check, detector and copy all removed (per request)");
  })();

};
