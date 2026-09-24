(function (root) {
  var sim = root.GDS.sim;
  var PLAYABLE = ["programmer", "art", "design", "music"];
  // DIMS 是「人物维」：员工与玩家的属性（roles[].stat / jobRanks / career.stats / 同事 stats）。
  // 「作品维」（play/fun/expression/immersion）一律走 sim.titleDims(config)，两者靠
  // quality.personToTitle 系数矩阵换算。不要拿 DIMS 去索引作品 stats，也不要拿作品维索引员工。
  var DIMS = ["program", "design", "art", "music"];

  function num(v, fallback) {
    if (typeof v === "number" && isFinite(v)) return v;
    return fallback;
  }

  function isArr(x) {
    return Object.prototype.toString.call(x) === "[object Array]";
  }

  function cloneStats(src) {
    var out = { program: 0, design: 0, art: 0, music: 0 };
    if (!src) return out;
    out.program = num(src.program, 0);
    out.design = num(src.design, num(src.script, 0));
    out.art = num(src.art, 0);
    out.music = num(src.music, 0);
    return out;
  }

  sim.catalogEraStatMult = function (title, config) {
    var world = sim.careerWorld(config);
    var era = ((world && world.quality) || {}).eraStatScale || {};
    var y, startY, endY, startM, endM, t;
    if (!era || era.enabled === false) return 1;
    if (!title || title.virtual) return 1;
    if (era.landmarksOnly && !title.landmark) return 1;
    y = num(title.releaseYear, 0);
    startY = era.startYear != null ? num(era.startYear, 1995) : 1995;
    endY = era.endYear != null ? num(era.endYear, 2025) : 2025;
    startM = era.startMult != null ? num(era.startMult, 1) : 1;
    endM = era.endMult != null ? num(era.endMult, 1) : 1;
    if (endY <= startY) return y <= startY ? startM : endM;
    t = (y - startY) / (endY - startY);
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    return startM + (endM - startM) * t;
  };

  sim.catalogTitleBaseStats = function (title, config) {
    var out = sim.cloneTitleStats(title && title.stats, config);
    var dims = sim.titleDims(config);
    var mult, i, k, q, min, max;
    if (!title || title.virtual) return out;
    mult = sim.catalogEraStatMult(title, config);
    if (mult !== 1) {
      q = (sim.careerWorld(config).quality) || {};
      min = q.statMin != null ? num(q.statMin, 0) : 0;
      max = q.statMax;
      for (i = 0; i < dims.length; i++) {
        k = dims[i];
        out[k] = Math.round(num(out[k], 0) * mult);
        if (out[k] < min) out[k] = min;
        if (max != null && !q.liveCanExceedMax && out[k] > max) out[k] = max;
      }
    }
    return out;
  };

  sim.applyCatalogStatJitter = function (st, stats, config) {
    var world = sim.careerWorld(config);
    var q = (world && world.quality) || {};
    var minPct = q.statJitterMinPct;
    var maxPct = q.statJitterMaxPct;
    var out = sim.cloneTitleStats(stats, config);
    var dims = sim.titleDims(config);
    var i, k, pct, tmp;
    if (minPct == null) minPct = 0;
    if (maxPct == null) maxPct = 0;
    minPct = num(minPct, 0);
    maxPct = num(maxPct, 0);
    if (minPct > maxPct) {
      tmp = minPct;
      minPct = maxPct;
      maxPct = tmp;
    }
    if (!st || (minPct === 0 && maxPct === 0)) return out;
    for (i = 0; i < dims.length; i++) {
      k = dims[i];
      pct = sim.irand(st, minPct, maxPct);
      out[k] = Math.ceil(num(out[k], 0) * (1 + pct / 100));
      if (out[k] < 0) out[k] = 0;
    }
    return out;
  };

  function catalogStatsForWorld(st, title, config) {
    if (!title || title.virtual) return sim.cloneTitleStats(title && title.stats, config);
    return sim.applyCatalogStatJitter(st, sim.catalogTitleBaseStats(title, config), config);
  }

  function cloneXpMap(src) {
    var out = {};
    var k;
    if (!src) return out;
    for (k in src) {
      if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = num(src[k], 0);
    }
    return out;
  }

  function mergeXpMap(dst, src) {
    var k;
    if (!src) return dst;
    for (k in src) {
      if (Object.prototype.hasOwnProperty.call(src, k)) dst[k] = num(dst[k], 0) + num(src[k], 0);
    }
    return dst;
  }

  sim.careerWorld = function (config) {
    return (config && config.careerWorld) || {};
  };

  sim.isCareerMode = function (st) {
    return !!(st && st.mode === "career");
  };

  sim.careerCopy = function (config) {
    return (config && config.copy && config.copy.career) || {};
  };


  // ── P4b 健康：只在事件落地时变动（±1，钳在 min..max），绝不随时间自动衰减 ──
  sim.applyCareerHealthDelta = function (st, delta, config) {
    var spec, v;
    if (!st || !st.career || !num(delta, 0)) return st;
    spec = sim.careerWorld(config).careerHealth || {};
    v = num(st.career.health == null ? num(spec.init, 4) : st.career.health, 4) + num(delta, 0);
    if (spec.min != null && v < spec.min) v = spec.min;
    if (spec.max != null && v > spec.max) v = spec.max;
    st.career.health = v;
    return st;
  };


  // flags 点路径（P4a）：只支持以 "career." 开头，如 "career.awardStory.goty"。
  // P6：主职维突破晋升硬门槛刻度 → 「被世界承认」里程碑拍（每档一次，flag 落
  // st.career.statMilestones；at 值必须与 jobRanks.promotion.requirements[].mainStat 对齐）。
  sim.checkStatMilestones = function (st, config, queue) {
    var list, main, cur, flags, i, m;
    if (!st || !st.career || !queue) return;
    main = (sim.careerRole(st.career.roleId, config) || {}).stat;
    if (!main) return;
    cur = num(st.career.stats && st.career.stats[main], 0);
    list = (sim.careerWorld(config).statMilestones || {}).list || [];
    flags = st.career.statMilestones || (st.career.statMilestones = {});
    for (i = 0; i < list.length; i++) {
      m = list[i];
      if (!m || flags[m.at] || cur < num(m.at, 0)) continue;
      flags[m.at] = true;
      queue.push({
        type: "milestone",
        kind: "event",
        presentation: "notice",
        at: m.at,
        kicker: "被世界承认",
        title: m.title,
        body: m.body
      });
    }
  };


  // flags 点路径（P4a）：只支持以 "career." 开头，如 "career.awardStory.goty"。
  function careerFlagHit(st, path) {
    var parts = String(path || "").split(".");
    var node, i;
    if (parts[0] !== "career") return false;
    node = st && st.career;
    for (i = 1; i < parts.length; i++) {
      if (node == null || typeof node !== "object") return false;
      node = node[parts[i]];
    }
    return !!node;
  }


  // ── P4a 选项门禁判据：RNG-free（skipIf/渲染层都会反复求值，绝不许掷骰）──
  // 不满足返回一行解锁提示（置灰显示用），满足返回 null。
  sim.careerOptionLockHint = function (st, config, req) {
    var copy, bits, renown;
    if (!req || typeof req !== "object") return null;
    copy = sim.careerCopy(config);
    bits = [];
    if (req.minStat) {
      Object.keys(req.minStat).forEach(function (dim) {
        var have = st && st.career && st.career.stats ? num(st.career.stats[dim], 0) : 0;
        if (have < num(req.minStat[dim], 0)) {
          bits.push((copy["dim" + dim.charAt(0).toUpperCase() + dim.slice(1)] || dim) + " ≥ " + num(req.minStat[dim], 0));
        }
      });
    }
    (req.flags || []).forEach(function (p) {
      if (!careerFlagHit(st, p)) bits.push(p.indexOf("career.awardStory") === 0 ? "拿过奖" : "解锁前情");
    });
    if (req.rank != null) {
      if (!st || !st.career || num(st.career.jobRank, 1) < num(req.rank, 0)) {
        bits.push("职级 ≥ " + num(req.rank, 0));
      }
    }
    if (req.health != null) {
      if (!st || !st.career || num(st.career.health == null ? 4 : st.career.health, 4) < num(req.health, 0)) {
        bits.push((copy.healthLabel || "健康") + " ≥ " + num(req.health, 0));
      }
    }
    if (req.renown != null) {
      renown = sim.careerRenownView ? sim.careerRenownView(st, config) : null;
      if (!renown || num(renown.tier, 1) < num(req.renown, 0)) {
        bits.push((copy.renownLabel || "声望") + "达到「" +
          (sim.careerRenownTierLabel ? sim.careerRenownTierLabel(config, req.renown) : "") + "」");
      }
    }
    if (!bits.length) return null;
    return (copy.lockPrefix || "需要：") + bits.join("、");
  };

  sim.worldLabel = function (row, config) {
    var world, useAlias;
    if (!row) return "";
    if (typeof row === "string") return row;
    world = sim.careerWorld(config);
    useAlias = !!world.useAlias;
    if (useAlias) return row.alias || row.name || row.displayName || row.n || "";
    return row.name || row.alias || row.displayName || row.n || "";
  };

  sim.monthIndex = function (year, month) {
    return year * 12 + (month || 1);
  };

  // monthIndex 的逆运算（cycleMult 换算后要把开工月写成 year/month 存进 state）。
  sim.monthFromIndex = function (idx) {
    var y = Math.floor((idx - 1) / 12);
    return { year: y, month: idx - y * 12 };
  };

  sim.careerRole = function (roleId, config) {
    var roles = sim.careerWorld(config).roles || [];
    return sim.findById(roles, roleId);
  };

  sim.careerPlayableRoles = function (config) {
    var roles = sim.careerWorld(config).roles || [];
    return roles.filter(function (r) {
      return PLAYABLE.indexOf(r.id) >= 0 && r.stat;
    });
  };

  function jobRankSpec(config) {
    return sim.careerWorld(config).jobRanks || {};
  }

  function clampJobRank(rank, config) {
    var spec = jobRankSpec(config);
    var min = spec.min != null ? spec.min : 1;
    var max = spec.max != null ? spec.max : 6;
    rank = num(rank, spec.start != null ? spec.start : 1);
    if (rank < min) rank = min;
    if (rank > max) rank = max;
    return rank;
  }

  // career 相关 API 既接受 state，也接受 career 子对象（历史两种调用都有），统一在这里收口。
  function careerArg(career) {
    if (!career) return null;
    return career.career ? career.career : career;
  }

  sim.careerJobRank = function (career, config) {
    var cr = careerArg(career);
    var spec = jobRankSpec(config);
    return clampJobRank(cr && cr.jobRank, config) || (spec.start != null ? spec.start : 1);
  };

  // 「光看属性够到哪一级」：从 rank 1 起逐级看 mainStat 门槛，够得到的最大职级。
  // 晋升门槛唯一看属性（见 promotionGaps），所以这个值就是「能力对应的位置」——
  // 挖人/跳槽给什么职级用它（外面只认能力，不认你在这家公司熬的资历）。
  // roleId 与当前职级无关：换岗后主维会变，按新岗的属性和门槛表重算。
  sim.careerStatRank = function (state, config) {
    var st = state && state.career ? state : { career: state };
    var cr = st && st.career;
    var spec = jobRankSpec(config);
    var reqs = (spec.promotion || {}).requirements || [];
    var max = spec.max != null ? spec.max : 6;
    var stat = mainStatValue(st, config);
    var rank = 1;
    var i, need;
    if (!cr) return 1;
    for (i = 1; i < reqs.length && i < max; i++) {
      if (!reqs[i]) break;
      need = num(reqs[i].mainStat, 0);
      if (!(need > 0) || stat < need) break;
      rank = i + 1;
    }
    return clampJobRank(rank, config);
  };

  sim.careerJobTitleDef = function (roleId, rank, config) {
    var spec = jobRankSpec(config);
    var list = (spec.titles && spec.titles[roleId]) || [];
    var i, row;
    rank = clampJobRank(rank, config);
    for (i = 0; i < list.length; i++) {
      row = list[i];
      if (row && num(row.rank, i + 1) === rank) return row;
    }
    return list[rank - 1] || list[0] || null;
  };

  sim.careerJobTitle = function (state, config) {
    var cr = state && state.career;
    var rank = sim.careerJobRank(cr, config);
    var roleId = cr && cr.roleId;
    var role;
    if (cr && (cr.roleId === "producer" || cr.growthStage === "producer")) {
      role = sim.careerRole("producer", config);
      return role || { id: "producer", name: "制作人", alias: "制作人" };
    }
    return sim.careerJobTitleDef(roleId, rank, config);
  };

  sim.careerJobTitleLabel = function (state, config) {
    return sim.worldLabel(sim.careerJobTitle(state, config), config) || "";
  };

  sim.careerRankCodeSeries = function (roleId, config) {
    var spec = jobRankSpec(config);
    var series = spec.codeSeries || {};
    if (roleId && series[roleId]) return series[roleId];
    return "";
  };

  sim.careerRankCode = function (roleId, rank, config) {
    var def = sim.careerJobTitleDef(roleId, rank, config);
    var series = sim.careerRankCodeSeries(roleId, config);
    var code;
    if (!series) return "";
    if (def && def.code != null) code = def.code;
    else return "";
    return series + "-" + code;
  };

  sim.formatCareerRankLabel = function (roleId, rank, config) {
    var def = sim.careerJobTitleDef(roleId, rank, config);
    var name = sim.worldLabel(def, config) || "";
    var code = sim.careerRankCode(roleId, rank, config);
    if (name && code) return name + " (" + code + ")";
    return name || code;
  };

  sim.careerJobTitleDisplay = function (state, config) {
    var cr = state && state.career;
    var role;
    if (cr && (cr.roleId === "producer" || cr.growthStage === "producer")) {
      role = sim.careerRole("producer", config);
      return sim.worldLabel(role, config) || "制作人";
    }
    return sim.formatCareerRankLabel(cr && cr.roleId, sim.careerJobRank(cr, config), config);
  };

  sim.isGrowthStageLocked = function (stageId, config) {
    var list = (sim.careerWorld(config).growthStages) || [];
    var i, row;
    for (i = 0; i < list.length; i++) {
      row = list[i];
      if (row && row.id === stageId) return !!row.lockedThisVersion;
    }
    return false;
  };

  sim.careerSeniors = function (company, config) {
    var co = typeof company === "string" ? sim.careerCompany(company, config) : company;
    var list, extra, out, seen, i, p, c0;
    if (!co) return [];
    list = co.seniors || [];
    if (!sim.castRoster) return list;
    // 内嵌 seniors 优先（字段完整：tags / departYear / successor*）；cast 补上「只存在于 cast」的
    // 驻员（阶段 3 批量新增的人），并转成 seniors 形状，HQ 面板与事件线因此自动认得他们。
    extra = sim.castRoster({ companyId: co.id }, config);
    if (!extra.length) return list;
    out = [];
    seen = {};
    for (i = 0; i < list.length; i++) {
      out.push(list[i]);
      if (list[i] && list[i].id) seen[list[i].id] = 1;
    }
    for (i = 0; i < extra.length; i++) {
      p = extra[i];
      if (!p || seen[p.id]) continue;
      seen[p.id] = 1;
      c0 = (p.career && p.career[0]) || null;
      out.push({
        id: p.id,
        name: p.name,
        alias: p.alias,
        title: p.title || "",
        bio: p.bio || "",
        tags: p.roles || [],
        departYear: c0 ? c0.toYear : null,
        successorCompanyId: null,
        successorSeniorId: null
      });
    }
    return out;
  };

  sim.careerSeniorLabel = function (senior, config) {
    var name, title, cast;
    if (!senior) return "";
    // 人物姓名走 cast 双模式（careerWorld.nameMode）；cast 未覆盖的人回落 worldLabel 旧行为。
    cast = senior.id && sim.castFind ? sim.castFind(senior.id, config) : null;
    name = cast ? sim.castName(cast, config) : sim.worldLabel(senior, config);
    title = (cast && cast.title) || senior.title || senior.role || "";
    if (name && title) return name + " · " + title;
    return name || title;
  };

  sim.findCareerSeniorById = function (seniorId, config) {
    var companies, i, j, list, s;
    if (!seniorId) return null;
    companies = sim.careerWorld(config).companies || [];
    for (i = 0; i < companies.length; i++) {
      list = sim.careerSeniors(companies[i], config);
      for (j = 0; j < list.length; j++) {
        s = list[j];
        if (s && s.id === seniorId) return s;
      }
    }
    return null;
  };

  sim.careerSeniorLine = function (company, config) {
    var list = sim.careerSeniors(company, config);
    var copy = sim.careerCopy(config);
    // 一屏约束：邀请文案里最多列 2 位前辈，其余折成「等N位」。
    // （P1 厂商合并会把被砍公司的前辈并入目标公司，单公司前辈数可达两位数。）
    var max = 2;
    var bits = [];
    var i, lab;
    for (i = 0; i < list.length; i++) {
      if (bits.length >= max) break;
      lab = sim.careerSeniorLabel(list[i], config);
      if (lab) bits.push(lab);
    }
    if (!bits.length) return "";
    var tail = list.length > bits.length ? ("等" + list.length + "位") : "";
    return (copy.seniorLabel || "前辈") + "：" + bits.join("、") + tail;
  };

  function rankTableVal(table, rank, fallback) {
    if (!table) return fallback;
    if (table[rank] != null && typeof table[rank] !== "object") return num(table[rank], fallback);
    return fallback;
  }

  function findCredit(st, titleId) {
    var list, i;
    if (!st || !st.career || !titleId) return null;
    list = st.career.credits || [];
    for (i = 0; i < list.length; i++) if (list[i].titleId === titleId) return list[i];
    return null;
  }

  function creditIsSigned(c) {
    return !!(c && c.shipped);
  }

  function creditWeightOf(c, config) {
    var spec = jobRankSpec(config);
    if (!creditIsSigned(c)) return 0;
    if (c.virtual) return num(spec.virtualCreditWeight, 0.4);
    return num(spec.catalogCreditWeight, 1);
  }

  sim.careerCreditWeight = function (st, config) {
    var sum = 0;
    ((st && st.career && st.career.credits) || []).forEach(function (c) {
      sum += creditWeightOf(c, config);
    });
    return sum;
  };

  function mainStatValue(st, config) {
    var cr = st && st.career;
    var role = sim.careerRole(cr && cr.roleId, config);
    var key = (role && role.stat) || "program";
    return num(cr && cr.stats && cr.stats[key], 0);
  }

  function promotionReq(st, config) {
    var spec = jobRankSpec(config);
    var promo = spec.promotion || {};
    var reqs = promo.requirements || [];
    var rank = sim.careerJobRank(st && st.career, config);
    var max = spec.max != null ? spec.max : 6;
    if (rank >= max) return null;
    return reqs[rank] || null;
  }

  function promotionGaps(st, config) {
    var cr = st && st.career;
    var spec = jobRankSpec(config);
    var promo = spec.promotion || {};
    var maxPer = promo.maxPerYear != null ? promo.maxPerYear : num(spec.maxPromotionsPerYear, 1);
    var rank = sim.careerJobRank(cr, config);
    var max = spec.max != null ? spec.max : 6;
    var req = promotionReq(st, config);
    var gaps = [];
    var main, creditW, fameHonor, months, need;
    if (!cr) return [{ id: "noCareer", label: "还没有入职" }];
    if (rank >= max) return [];
    if (num(cr.promotionsThisYear, 0) >= maxPer) {
      gaps.push({ id: "year", label: "今年已经升过一级", have: num(cr.promotionsThisYear, 0), need: maxPer });
    }
    if (!req) return gaps;
    main = mainStatValue(st, config);
    // 晋升只看属性：mainStat 是唯一的能力门槛。
    // （2026-09-22 移除原 mainStatOrJobXp「主职维或职级经验二选一」：jobXp 每开发月 +1、
    //   生涯能到 400+，那条永远满足，既不拦人也不赋能。jobXp 现在只是展示/人设素材。）
    need = num(req.mainStat, 0);
    if (need && main < need) {
      gaps.push({
        id: "stat",
        label: "主职能力",
        have: main,
        need: need
      });
    }
    creditW = sim.careerCreditWeight(st, config);
    need = num(req.creditedTitles, 0);
    if (need && creditW < need) {
      gaps.push({ id: "credits", label: "署名作品", have: creditW, need: need });
    }
    fameHonor = Math.max(num(cr.fame, 0), num(cr.honor, 0));
    need = num(req.fameOrHonor, 0);
    if (need && fameHonor < need) {
      gaps.push({ id: "fame", label: "声望或荣誉", have: fameHonor, need: need });
    }
    months = num(cr.monthsInRank, 0);
    need = num(req.monthsInRank, 0);
    if (need && months < need) {
      gaps.push({ id: "months", label: "任现职月数", have: months, need: need });
    }
    return gaps;
  }

  sim.canPromoteCareer = function (state, config) {
    var spec = jobRankSpec(config);
    var rank = sim.careerJobRank(state && state.career, config);
    var max = spec.max != null ? spec.max : 6;
    if (!sim.isCareerMode(state) || !state.career || !state.career.companyId) return false;
    if (sim.isCareerProducer && sim.isCareerProducer(state)) return false;
    if (rank >= max) return false;
    return promotionGaps(state, config).length === 0;
  };

  sim.careerPromotionView = function (state, config) {
    var cr = state && state.career;
    var spec = jobRankSpec(config);
    var rank = sim.careerJobRank(cr, config);
    var max = spec.max != null ? spec.max : 6;
    var next = rank < max ? rank + 1 : rank;
    var gaps = promotionGaps(state, config);
    var copy = sim.careerCopy(config);
    var cur = sim.careerJobTitleDef(cr && cr.roleId, rank, config);
    var nxt = rank < max ? sim.careerJobTitleDef(cr && cr.roleId, next, config) : null;
    var lines = [];
    var i, g;
    if (rank >= max) lines.push(copy.gapMax || "已经是本岗最高职级");
    else if (!gaps.length) lines.push(copy.gapReady || "可以申请晋升");
    else {
      for (i = 0; i < gaps.length; i++) {
        g = gaps[i];
        if (g.id === "year") lines.push(copy.gapYear || g.label);
        else if (g.id === "stat") lines.push((copy.gapStat || "主职能力还差") + " " + Math.ceil(g.need - g.have));
        else if (g.id === "credits") lines.push((copy.gapCredits || "署名作品还差") + " " + (Math.round((g.need - g.have) * 10) / 10));
        else if (g.id === "fame") lines.push((copy.gapFame || "声望或荣誉还差") + " " + Math.ceil(g.need - g.have));
        else if (g.id === "months") lines.push((copy.gapMonths || "任现职还差") + " " + Math.ceil(g.need - g.have) + " 个月");
        else lines.push(g.label);
      }
    }
    return {
      can: sim.canPromoteCareer(state, config),
      rank: rank,
      nextRank: next,
      atMax: rank >= max,
      currentTitle: cur,
      nextTitle: nxt,
      currentLabel: sim.formatCareerRankLabel(cr && cr.roleId, rank, config) || "",
      nextLabel: nxt ? sim.formatCareerRankLabel(cr && cr.roleId, next, config) : "",
      gaps: gaps,
      gapLines: lines
    };
  };

  function closeTenure(st) {
    var list, last;
    if (!st || !st.career) return;
    list = st.career.tenures || (st.career.tenures = []);
    if (!list.length) return;
    last = list[list.length - 1];
    if (!last || last.endYear != null) return;
    last.endYear = st.year;
    last.endMonth = st.month;
  }

  function openTenure(st, source, config) {
    var cr, title;
    if (!st || !st.career || !st.career.companyId) return;
    cr = st.career;
    if (!cr.tenures) cr.tenures = [];
    title = sim.careerJobTitle(st, config);
    cr.tenures.push({
      companyId: cr.companyId,
      studioId: cr.studioId || null,
      roleId: cr.roleId,
      jobRank: sim.careerJobRank(cr, config),
      jobTitleId: (title && title.id) || null,
      startYear: st.year,
      startMonth: st.month,
      endYear: null,
      endMonth: null,
      source: source || "opening"
    });
  }

  function applyPromotion(st, config) {
    var spec = jobRankSpec(config);
    var next = sim.careerJobRank(st.career, config) + 1;
    var title;
    closeTenure(st);
    st.career.jobRank = clampJobRank(next, config);
    st.career.monthsInRank = 0;
    st.career.promotionsThisYear = num(st.career.promotionsThisYear, 0) + 1;
    st.career.lastPromotionYear = st.year;
    if (!(sim.isCareerProducer && sim.isCareerProducer(st))) {
      st.career.growthStage = "employee";
    }
    title = sim.careerJobTitle(st, config);
    st.career.jobTitleId = title && title.id;
    openTenure(st, "promotion", config);
    void spec;
  }

  function maxPromotionsPerYear(config) {
    var spec = jobRankSpec(config);
    var promo = spec.promotion || {};
    return promo.maxPerYear != null ? promo.maxPerYear : num(spec.maxPromotionsPerYear, 1);
  }

  function markPromoLineIfNeeded(st, config, prevRank) {
    var next = sim.careerJobRank(st.career, config);
    if (prevRank < 5 && next >= 5 && sim.markCareerLineDone) {
      sim.markCareerLineDone(st, "promo-to-expert", config);
    }
  }

  // 晋升的唯一落地点。门槛必须在**这里**兜一次：旧实现只靠调用点自觉先问 canPromoteCareer，
  // 于是任何漏判的新调用点都能白送职级（实测挖人带级那条把 T6 送到主职维 46.7 的人身上）。
  // story/sponsored 是「剧情破格」的显式出口，受 promotion.storyBypass 控制；opts.force 是给
  // 已自查过门槛的调用方（promoteCareer / yearEndSlot）用的短路。
  sim.applyCareerPromotion = function (st, config, opts) {
    var spec, max, rank, maxPer, story, promo;
    if (!st || !st.career) return;
    opts = opts || {};
    story = !!(opts.story || opts.sponsored);
    spec = jobRankSpec(config);
    promo = spec.promotion || {};
    rank = sim.careerJobRank(st.career, config);
    max = spec.max != null ? spec.max : 6;
    if (rank >= max) return;
    if (!opts.force && promo.gateInFunction !== false &&
        !(story && promo.storyBypass !== false) && !sim.canPromoteCareer(st, config)) return;
    maxPer = maxPromotionsPerYear(config);
    if (story && num(st.career.promotionsThisYear, 0) >= maxPer) {
      st.career.pendingStoryPromos = num(st.career.pendingStoryPromos, 0) + 1;
      return;
    }
    applyPromotion(st, config);
    markPromoLineIfNeeded(st, config, rank);
  };

  sim.applyPendingStoryPromos = function (st, config) {
    var rank, max, maxPer;
    if (!st || !st.career) return;
    if (num(st.career.pendingStoryPromos, 0) <= 0) return;
    if (num(st.career.promotionsThisYear, 0) > 0) return;
    rank = sim.careerJobRank(st.career, config);
    max = (jobRankSpec(config).max != null) ? jobRankSpec(config).max : 6;
    if (rank >= max) {
      st.career.pendingStoryPromos = 0;
      return;
    }
    maxPer = maxPromotionsPerYear(config);
    if (maxPer <= 0) return;
    st.career.pendingStoryPromos = num(st.career.pendingStoryPromos, 0) - 1;
    applyPromotion(st, config);
    markPromoLineIfNeeded(st, config, rank);
  };

  sim.applyCareerBecomeProducer = function (st, config) {
    var role, copy;
    if (!st || !st.career) return;
    if (sim.isGrowthStageLocked("founder", config) && st.career.growthStage === "founder") {
      st.career.growthStage = "employee";
    }
    closeTenure(st);
    st.career.priorRoleId = st.career.priorRoleId || st.career.roleId;
    st.career.roleId = "producer";
    st.career.growthStage = "producer";
    st.career.jobTitleId = "producer";
    role = sim.careerRole("producer", config);
    openTenure(st, "producer", config);
    copy = sim.careerCopy(config);
    if (copy.becomeProducerOk) st.career.hopNotice = copy.becomeProducerOk;
    void role;
  };

  function defaultStudioForCompany(companyId, config) {
    var co = sim.careerCompany(companyId, config);
    return sim.defaultStudioId(co);
  }

  // 邀约/跳槽时"挂到哪部作"：只挂当年月真的在开发（titleCoversMonth）的目录作。
  // 旧实现在找不到时会兜底到 nextCatalogTitle()——那是"下一档还没开工的真作"，
  // 玩家于是被挂在一部几年后才开工的作品上，过月被判空窗，一两个月后被塞一部虚拟作。
  // 找不到就返回 null，交回 joinCompany 走 assignCareerProject 的统一判定。
  function pickScriptedInviteTitle(st, companyId, preferredId, config) {
    var preferred, det, assigned, studioId;
    studioId = defaultStudioForCompany(companyId, config);
    preferred = preferredId ? sim.careerTitle(preferredId, config, st) : null;
    det = preferredId ? sim.careerTitleDetail(preferredId, config, st) : null;
    if (preferred && det && sim.titleCoversMonth && sim.titleCoversMonth(preferred, det, st.year, st.month, config)) {
      return preferredId;
    }
    // 先看玩家会进的那个工作室，再看全公司（有些在研作挂在别的工作室）。
    // 虚拟作不算：那是空窗的产物，不能拿它当"有活干"。
    assigned = sim.pickCareerAssignment(companyId, st.year, st.month, config, st, studioId);
    if (assigned && !assigned.virtual) return assigned.id;
    assigned = sim.pickCareerAssignment(companyId, st.year, st.month, config, st, null);
    if (assigned && !assigned.virtual) return assigned.id;
    return null;
  }

  function staffRoleForInvite(st) {
    var rid = st.career && st.career.roleId;
    if (rid && PLAYABLE.indexOf(rid) >= 0) return rid;
    rid = st.career && st.career.priorRoleId;
    if (rid && PLAYABLE.indexOf(rid) >= 0) return rid;
    return PLAYABLE[0] || "programmer";
  }

  function markBecomeProducerDone(st, config) {
    var def = sim.findEventLineDef ? sim.findEventLineDef(config, "become-producer") : null;
    var id = (def && def.id) || "become-producer";
    if (!st.career.lines) st.career.lines = {};
    if (!st.career.lines[id]) {
      st.career.lines[id] = {
        beat: 0,
        flags: {},
        startedAt: { year: st.year, month: st.month },
        status: "done",
        waitUntil: null,
        waitingFor: null,
        pending: false,
        abortedYear: null
      };
    } else {
      st.career.lines[id].status = "done";
      st.career.lines[id].pending = false;
    }
  }

  function bondHomeCompanyId(bond) {
    if (!bond) return null;
    return bond.homeCompanyId || bond.companyId || null;
  }

  function bondRoleForLine(def) {
    if (!def) return null;
    if (def.bond) return def.bond;
    if (def.startWhen && def.startWhen.requireBond) return def.startWhen.requireBond;
    if (def.ensureBond) return def.ensureBond;
    if (def.id === "bond-mentor") return "mentor";
    if (def.id === "bond-peer") return "peer";
    if (def.id === "bond-junior") return "junior";
    return null;
  }

  function careerTraits(st) {
    if (!st || !st.career) return [];
    return st.career.traits || [];
  }

  sim.careerTraitIds = function (st) {
    return careerTraits(st).slice();
  };

  sim.hasCareerTrait = function (st, id) {
    return careerTraits(st).indexOf(id) >= 0;
  };

  sim.careerTraitMult = function (st, key, config, dflt) {
    var m = 1;
    var found = false;
    careerTraits(st).forEach(function (id) {
      var t = sim.traitDef(id, config);
      if (!t || t[key] == null) return;
      m *= num(t[key], 1);
      found = true;
    });
    return found ? m : (dflt == null ? 1 : dflt);
  };

  sim.careerTraitSum = function (st, key, config) {
    var s = 0;
    careerTraits(st).forEach(function (id) {
      var t = sim.traitDef(id, config);
      if (t && t[key] != null) s += num(t[key], 0);
    });
    return s;
  };

  // 天赋的「收益轴」：抽多条时同轴只出一条（见 traits-draft §12.5）。没标 axis 的按各自独立处理，
  // 这样新增天赋忘标 axis 时只是少一层去重，不会把别人挤掉。
  sim.careerTraitAxis = function (id, config) {
    var t = sim.traitDef(id, config);
    return (t && t.axis) || ("$" + id);
  };

  // 风口猎手 / 古董商：熟练度加成按「是否踩中当前潮流」分派倍率。
  sim.careerTrendSkillMult = function (st, title, config) {
    var hits;
    if (!st || !st.career) return 1;
    hits = !!sim.matchesTrend(
      { genreId: title && title.genreId, gameplayId: title && title.gameplayId },
      st.trend
    );
    return hits
      ? sim.careerTraitMult(st, "skillBonusTrendOnMult", config, 1)
      : sim.careerTraitMult(st, "skillBonusTrendOffMult", config, 1);
  };

  sim.careerYearsElapsed = function (st, config) {
    var cal = (sim.careerWorld(config).timeline) || {};
    return num(st && st.year, num(cal.startYear, 1995)) - num(cal.startYear, 1995);
  };

  sim.careerTraitStatGrowthMult = function (st, config) {
    var m = 1;
    var y = sim.careerYearsElapsed(st, config);
    careerTraits(st).forEach(function (id) {
      var t = sim.traitDef(id, config);
      if (!t) return;
      if (t.splitYear != null) {
        m *= num(y < t.splitYear ? t.earlyStatGrowthMult : t.lateStatGrowthMult, 1);
      } else if (t.statGrowthMult != null) {
        m *= num(t.statGrowthMult, 1);
      }
    });
    return m;
  };

  sim.rollCareerTraitDraw = function (st, config) {
    var spec = sim.careerWorld(config).careerTraits || {};
    var ids = sim.traitIds(config, "career");
    var n = Math.min(num(spec.drawCount, 3), ids.length);
    var pool = ids.map(function (id) {
      var t = sim.traitDef(id, config);
      return { id: id, weight: num(t && t.drawWeight, 1) };
    });
    var out = [];
    var i, choice;
    for (i = 0; i < n; i++) {
      if (!pool.length) break;
      choice = sim.pickWeighted(st, pool);
      if (!choice) break;
      out.push(choice.id);
      pool = pool.filter(function (x) { return x.id !== choice.id; });
    }
    return out;
  };

  sim.rollCareerStart = function (st, config) {
    var world = sim.careerWorld(config);
    var spec = ((world.player || {}).startRoll) || {};
    var px = world.playerXp || {};
    var q = world.quality || {};
    var cap = q.statMax;
    var totalMin = num(spec.totalMin, 30);
    var totalMax = num(spec.totalMax, 50);
    var spread = num(spec.weightSpread, 3);
    var total = sim.irand(st, totalMin, totalMax);
    var i, k, sumW, acc, best, role, choice;
    var weights = [];
    var stats = {};
    var left = total;
    // 先 roll 总属性，再按随机权重把点数分到四维（每维至少 1 点）。
    for (i = 0; i < DIMS.length; i++) weights.push(1 + sim.rand(st) * spread);
    sumW = 0;
    for (i = 0; i < weights.length; i++) sumW += weights[i];
    for (i = 0; i < DIMS.length; i++) {
      k = DIMS[i];
      stats[k] = i === DIMS.length - 1
        ? left
        : Math.max(1, Math.min(left - (DIMS.length - 1 - i), Math.round(total * weights[i] / sumW)));
      left -= stats[k];
    }
    if (cap != null) {
      for (i = 0; i < DIMS.length; i++) {
        k = DIMS[i];
        if (stats[k] > cap) stats[k] = cap;
      }
    }
    // 最高的一维定擅长主职；并列时随机取一。
    best = [DIMS[0]];
    for (i = 1; i < DIMS.length; i++) {
      if (stats[DIMS[i]] > stats[best[0]]) best = [DIMS[i]];
      else if (stats[DIMS[i]] === stats[best[0]]) best.push(DIMS[i]);
    }
    best = [sim.pick(st, best)];
    role = null;
    (sim.careerPlayableRoles(config) || []).forEach(function (r) {
      if (!role && best.indexOf(r.stat) >= 0) role = r;
    });
    // 天赋按 drawWeight 抽 traitCountMin~traitCountMax 条（默认 1~3，不重复）；入行熟练与属性同一掷一起出。
    // traitAxisDistinct：同一「收益轴」最多出一条 —— 否则三条产出向能叠到 ×1.8 的强度爆炸，
    // 且叠在一起的正负修正会互相抵消（工作狂 × 学得快 = 月贡献净 1.0），玩家拿了两张却感觉不到。
    var minN = Math.max(0, Math.round(num(spec.traitCountMin, num(spec.traitCount, 1))));
    var maxN = Math.max(minN, Math.round(num(spec.traitCountMax, minN)));
    var traitCount = maxN > minN ? sim.irand(st, minN, maxN) : minN;
    var axisDistinct = spec.traitAxisDistinct !== false;
    var traitPool = sim.traitIds(config, "career").map(function (id) {
      var t = sim.traitDef(id, config);
      return { id: id, weight: num(t && t.drawWeight, 1) };
    });
    var traitIds = [];
    var usedAxis = {};
    for (i = 0; i < traitCount && traitPool.length; i++) {
      choice = sim.pickWeighted(st, traitPool);
      if (!choice) break;
      traitIds.push(choice.id);
      usedAxis[sim.careerTraitAxis(choice.id, config)] = true;
      traitPool = traitPool.filter(function (x) {
        if (x.id === choice.id) return false;
        if (axisDistinct && usedAxis[sim.careerTraitAxis(x.id, config)]) return false;
        return true;
      });
    }
    return {
      total: total,
      stats: stats,
      mainDim: best[0],
      roleId: role ? role.id : null,
      traitIds: traitIds,
      traitId: traitIds[0] || null,
      genreIds: pickAbleIds(st, (config.content || {}).genres, num(px.startingAbleGenreCount, 0)),
      gameplayIds: pickAbleIds(st, (config.content || {}).gameplay, num(px.startingAbleGameplayCount, 0))
    };
  };

  sim.pickCareerTrait = function (state, traitId, config) {
    var st = sim.clone(state);
    var t;
    if (!st || !st.career) return st;
    if (st.career.traitsLocked) return st;
    if (st.phase !== "OFFER") return st;
    t = sim.traitDef(traitId, config);
    if (!t || (t.scope || "staff") !== "career") return st;
    st.career.traits = [traitId];
    st.career.traitsLocked = true;
    return st;
  };

  sim.careerTraitName = function (st, config) {
    return careerTraits(st).map(function (id) {
      var t = sim.traitDef(id, config);
      return t && t.displayName ? t.displayName : id;
    }).join(" / ");
  };

  sim.careerTraitLine = function (st, config) {
    return careerTraits(st).map(function (id) {
      var t = sim.traitDef(id, config);
      if (!t) return "";
      return t.summary ? (t.displayName + "：" + t.summary) : t.displayName;
    }).filter(Boolean).join(" ");
  };

  function eventLinesBonds(config) {
    return ((sim.careerWorld(config).eventLines) || {}).bonds || {};
  }

  // 「和同事一起搭一部史诗作」的候选作。准入（mobility.requireInDevTitle.scripted）：
  // 只挑**当月正在开发**的史诗作——只按"发售年还没到"筛，会挑到几年后才开工的那部，
  // 玩家于是被挂在一部还没开工的作上，过月被判空窗，一两个月后被塞一部虚拟作。
  function peerEpicPool(st, config) {
    var spec = eventLinesBonds(config).peerEpic || {};
    var titles = sim.careerWorld(config).titles || [];
    var minPrestige = spec.minPrestige != null ? spec.minPrestige : 4;
    var landmarkOnly = spec.landmarkOnly !== false;
    var needsWork = requireInDevTitle(config, "scripted");
    var pool = [];
    var i, t, co, det;
    for (i = 0; i < titles.length; i++) {
      t = titles[i];
      if (!t || t.virtual) continue;
      if (landmarkOnly && !t.landmark) continue;
      if (num(t.prestige, 0) < minPrestige) continue;
      if (st.career && t.companyId === st.career.companyId) continue;
      co = sim.careerCompany(t.companyId, config);
      if (!sim.companyJoinable(co, st.year)) continue;
      if (needsWork) {
        det = sim.careerTitleDetail(t.id, config, st);
        if (!det || !sim.titleCoversMonth(t, det, st.year, st.month, config)) continue;
      } else if (t.releaseYear != null && t.releaseYear < st.year) {
        continue;
      }
      pool.push(t);
    }
    return pool;
  }

  function pickPeerEpicTitle(st, config) {
    var pool = peerEpicPool(st, config);
    if (!pool.length) return null;
    return sim.pick(st, pool) || pool[0];
  }

  // RNG-free：只回答"有没有这样的史诗作"。给选项 skipIf 用。
  function pickReturnInviteTarget(st, config) {
    var spec = eventLinesBonds(config).returnInvite || {};
    var junior = st.career && st.career.bonds && st.career.bonds.junior;
    var ids = spec.companyIds || ["mihoyo", "hypergryph", "paperGames"];
    var byCo = spec.titlesByCompany || {};
    var order = [];
    var i, id, co, hit;
    if (junior && junior.revealCompanyId) order.push(junior.revealCompanyId);
    else {
      for (i = 0; i < ids.length; i++) order.push(ids[i]);
    }
    for (i = 0; i < order.length; i++) {
      id = order[i];
      co = sim.careerCompany(id, config);
      if (!co) continue;
      // 准入看全公司（哪个工作室有活都行），具体挂哪部交给 pickScriptedInviteTitle。
      hit = sim.companyInDevCatalogTitle(id, st, config, null);
      if (!hit) continue;
      return {
        companyId: id,
        titleId: (junior && junior.revealCompanyId === id && junior.revealTitleId)
          ? junior.revealTitleId
          : (byCo[id] || null)
      };
    }
    return null;
  }

  sim.applyScriptedCareerInvite = function (st, kind, config) {
    var co, companyId, titleId, roleId, studioId, late, target, title, peer;
    if (!st || !st.career || !kind) return st;
    late = false;
    if (kind === "mentorSuccessor") {
      if (!st.career.bonds || !st.career.bonds.mentor || !st.career.bonds.mentor.successorCompanyId) return st;
      companyId = st.career.bonds.mentor.successorCompanyId;
      titleId = pickScriptedInviteTitle(st, companyId, null, config);
      roleId = staffRoleForInvite(st);
    } else if (kind === "peerEpic") {
      peer = st.career.bonds && st.career.bonds.peer;
      title = (peer && peer.epicTitleId) ? sim.careerTitle(peer.epicTitleId, config, st) : pickPeerEpicTitle(st, config);
      if (!title) return st;
      if (peer) {
        peer.epicTitleId = title.id;
        peer.epicCompanyId = title.companyId;
      }
      companyId = title.companyId;
      titleId = title.id;
      roleId = staffRoleForInvite(st);
      late = true;
    } else if (kind === "returnProducer" || kind === "returnStaff") {
      target = pickReturnInviteTarget(st, config);
      if (!target) return st;
      companyId = target.companyId;
      titleId = pickScriptedInviteTitle(st, companyId, target.titleId, config);
      roleId = kind === "returnProducer" ? "producer" : staffRoleForInvite(st);
    } else if (kind === "strongHop") {
      co = pickStrongHopCompany(st, config);
      if (!co) return st;
      companyId = co.id;
      titleId = pickScriptedInviteTitle(st, companyId, null, config);
      roleId = pickMobilityRole(st, config, "hop");
      if (PLAYABLE.indexOf(roleId) < 0) roleId = staffRoleForInvite(st);
    } else {
      return st;
    }
    co = sim.careerCompany(companyId, config);
    if (!co) return st;
    // 准入（mobility.requireInDevTitle.scripted）：这家当月手上没活就"这趟不去"，原地不动。
    // 剧情入口一般已用 skipIf / 等待条件挡住（同事线跳槽/搭史诗作、前辈线跟着走），
    // 这里是老存档或数据改动后的兜底：宁可不动，也不把人挂进空窗。
    if (requireInDevTitle(config, "scripted")) {
      titleId = pickScriptedInviteTitle(st, companyId, titleId, config);
      if (!titleId) return st;
    }
    title = titleId ? sim.careerTitle(titleId, config, st) : null;
    studioId = (title && title.studioId) || defaultStudioForCompany(companyId, config);
    detachFromProject(st, config);
    joinCompany(st, companyId, roleId, titleId, config, studioId, "invite", null);
    if (late && titleId) {
      (function markUnsigned() {
        var cred = findCredit(st, titleId);
        if (cred) cred.signedEligible = false;
      })();
    }
    if (roleId === "producer") markBecomeProducerDone(st, config);
    return st;
  };

  // 「跳去别家」的候选公司。准入（mobility.requireInDevTitle.scripted）：只考虑当年月真有
  // 在研目录作的东家——跟着跳过去是为了做事情，不是去坐冷板凳。
  function strongHopPool(st, config) {
    var companies = sim.careerWorld(config).companies || [];
    var needsWork = requireInDevTitle(config, "scripted");
    var pool = [];
    var i, co, w;
    for (i = 0; i < companies.length; i++) {
      co = companies[i];
      if (!co || co.id === (st.career && st.career.companyId)) continue;
      if (!sim.companyJoinable(co, st.year)) continue;
      if (needsWork && !sim.companyInDevCatalogTitle(co.id, st, config, null)) continue;
      w = num(co.power, 1);
      if (w <= 0) w = 1;
      pool.push({ id: co, weight: w });
    }
    return pool;
  }

  function pickStrongHopCompany(st, config) {
    var pool = strongHopPool(st, config);
    if (!pool.length) return null;
    return (sim.pickWeighted(st, pool) || pool[0]).id;
  }

  // RNG-free：只回答"有没有这样的东家"。给选项 skipIf 用——判定函数不能掷骰，
  // 否则每帧评估一次选项就会搅乱随机流。
  sim.hasStrongHopTarget = function (st, config) {
    return strongHopPool(st, config).length > 0;
  };

  sim.careerSignedCreditCount = function (st) {
    var n = 0;
    ((st && st.career && st.career.credits) || []).forEach(function (c) {
      if (creditIsSigned(c)) n += 1;
    });
    return n;
  };

  sim.careerHasOtherStudio = function (st, config) {
    var co = st && st.career ? sim.careerCompany(st.career.companyId, config) : null;
    var list = sim.careerStudios(co);
    var cur = st && st.career && st.career.studioId;
    var i;
    if (!list || list.length < 2) return false;
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].id !== cur) return true;
    }
    return false;
  };

  sim.careerEmployerJoinable = function (st, config) {
    var co = st && st.career ? sim.careerCompany(st.career.companyId, config) : null;
    return !!(co && sim.companyJoinable(co, st.year));
  };

  sim.mergerCompanyDue = function (st, config) {
    var co, succ;
    if (!st || !st.career || !st.career.companyId) return null;
    co = sim.careerCompany(st.career.companyId, config);
    if (!co || co.hireUntilYear == null || !co.successorId) return null;
    if (st.year <= co.hireUntilYear) return null;
    if ((st.career.mergedFromIds || []).indexOf(co.id) >= 0) return null;
    succ = sim.careerCompany(co.successorId, config);
    if (!succ) return null;
    return co;
  };

  function rememberMerged(st, oldId) {
    if (!st.career.mergedFromIds) st.career.mergedFromIds = [];
    if (oldId && st.career.mergedFromIds.indexOf(oldId) < 0) st.career.mergedFromIds.push(oldId);
  }

  function clearRemotePendingForHomes(st, homeId, config) {
    var list, i, def, prog, bond, role;
    list = sim.eventLineDefs ? sim.eventLineDefs(config) : [];
    for (i = 0; i < list.length; i++) {
      def = list[i];
      if (!def || def.kind !== "bond") continue;
      role = bondRoleForLine(def);
      bond = st.career.bonds && role ? st.career.bonds[role] : null;
      if (!bond) continue;
      if (bondHomeCompanyId(bond) !== homeId && bond.companyId !== homeId) continue;
      prog = st.career.lines && st.career.lines[def.id];
      if (prog) prog.remotePending = false;
    }
  }

  sim.applyCareerJoinSuccessor = function (st, config) {
    var co = st && st.career ? sim.careerCompany(st.career.companyId, config) : null;
    var oldId, succId, keys, i, k, bond;
    if (!co || !co.successorId || !sim.careerCompany(co.successorId, config)) return st;
    oldId = co.id;
    succId = co.successorId;
    detachFromProject(st, config);
    joinCompany(st, succId, st.career.roleId, null, config, null, "merger", null);
    keys = ["mentor", "peer", "junior"];
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      bond = st.career.bonds && st.career.bonds[k];
      if (!bond) continue;
      if (bondHomeCompanyId(bond) === oldId || bond.companyId === oldId) {
        bond.homeCompanyId = succId;
        bond.companyId = succId;
        bond.colocated = true;
      }
    }
    clearRemotePendingForHomes(st, succId, config);
    rememberMerged(st, oldId);
    sim.refreshCareerBondColocation(st, config);
    return st;
  };

  sim.applyCareerChangeRole = function (st, config) {
    var cur, pool, i, rid, hit, title;
    if (!st || !st.career) return st;
    cur = st.career.roleId;
    pool = [];
    for (i = 0; i < PLAYABLE.length; i++) {
      rid = PLAYABLE[i];
      if (rid === cur) continue;
      pool.push({ id: rid, weight: 1 });
    }
    (function applyHopWeights() {
      var weights = mobilityRoleWeightTable(config, "hop");
      var j, w;
      for (j = 0; j < pool.length; j++) {
        w = weights[pool[j].id];
        if (w != null) pool[j].weight = w;
      }
      pool = pool.filter(function (row) { return num(row.weight, 0) > 0; });
    })();
    if (!pool.length) return st;
    hit = sim.pickWeighted(st, pool);
    rid = (hit && hit.id) || pool[0].id;
    if (!rid || rid === cur) return st;
    closeTenure(st);
    st.career.priorRoleId = cur;
    st.career.roleId = rid;
    if (rid !== "producer") st.career.growthStage = "employee";
    title = sim.careerJobTitle(st, config);
    st.career.jobTitleId = title && title.id;
    openTenure(st, "roleChange", config);
    sim.ensureCareerColleagues(st, config);
    return st;
  };

  // 内部调岗的目标工作室（不含当前那个）。准入（mobility.requireInDevTitle.studioMove）：
  // 优先调去当年月真有在研目录作的工作室——调过去接着做事情，而不是坐进空窗。
  sim.careerOtherStudioPool = function (st, config) {
    var co, list, needsWork, pool = [];
    var i;
    if (!st || !st.career || !st.career.companyId) return pool;
    co = sim.careerCompany(st.career.companyId, config);
    list = sim.careerStudios(co) || [];
    needsWork = requireInDevTitle(config, "studioMove");
    for (i = 0; i < list.length; i++) {
      if (!list[i] || list[i].id === st.career.studioId) continue;
      if (needsWork && !sim.companyInDevCatalogTitle(st.career.companyId, st, config, list[i].id)) continue;
      pool.push(list[i]);
    }
    return pool;
  };

  sim.applyCareerMoveStudio = function (st, config) {
    var next, pool, title;
    if (!st || !st.career || !st.career.companyId) return st;
    pool = sim.careerOtherStudioPool(st, config);
    next = pool.length ? pool[0] : null;
    if (!next && !requireInDevTitle(config, "studioMove")) {
      (function fallbackAnyStudio() {
        var list = sim.careerStudios(sim.careerCompany(st.career.companyId, config)) || [];
        var i;
        for (i = 0; i < list.length; i++) {
          if (list[i] && list[i].id !== st.career.studioId) { next = list[i]; return; }
        }
      })();
    }
    if (!next) return st;
    closeTenure(st);
    st.career.studioId = next.id;
    title = sim.careerJobTitle(st, config);
    st.career.jobTitleId = title && title.id;
    openTenure(st, "studioMove", config);
    detachFromProject(st, config);
    sim.assignCareerProject(st, config);
    sim.ensureCareerColleagues(st, config);
    return st;
  };

  sim.promoteCareer = function (state, config) {
    var st;
    if (!sim.isCareerMode(state)) return sim.fail(state, sim.ERR.CAREER_NOT_CAREER);
    if (sim.promotionUsesEventLine && sim.promotionUsesEventLine(state, config)) {
      return sim.requestCareerPromotion
        ? sim.requestCareerPromotion(state, config)
        : sim.fail(state, sim.ERR.CAREER_PROMOTE_LOCKED);
    }
    if (!sim.canPromoteCareer(state, config)) return sim.fail(state, sim.ERR.CAREER_PROMOTE_LOCKED);
    st = sim.clone(state);
    sim.ensureCareerExtras(st);
    applyPromotion(st, config);
    return sim.ok(st);
  };

  sim.careerResumeView = function (state, config) {
    var cr = state && state.career;
    var copy = sim.careerCopy(config);
    var tenures = [];
    var credits = [];
    // P2-fix-b：履历页要把「署名作品」和「过渡项目」拆开显示——玩家该看得见
    // 自己有多少时间花在了目录真作上，又有多少是顶空档的过渡项目。
    var signedCount = 0;
    var virtualCount = 0;
    sim.ensureCareerExtras(state);
    ((cr && cr.tenures) || []).forEach(function (t) {
      var co = sim.careerCompany(t.companyId, config);
      var studio = sim.careerStudio(t.companyId, t.studioId, config);
      var title = sim.careerJobTitleDef(t.roleId, t.jobRank, config);
      tenures.push({
        companyId: t.companyId,
        studioId: t.studioId,
        companyLabel: co ? sim.worldLabel(co, config) : t.companyId,
        studioLabel: studio ? sim.worldLabel(studio, config) : "",
        roleId: t.roleId,
        jobRank: t.jobRank,
        jobTitleId: t.jobTitleId,
        jobLabel: sim.formatCareerRankLabel(t.roleId, t.jobRank, config) || sim.worldLabel(title, config) || "",
        startYear: t.startYear,
        startMonth: t.startMonth,
        endYear: t.endYear,
        endMonth: t.endMonth,
        source: t.source
      });
    });
    ((cr && cr.credits) || []).forEach(function (c) {
      var title = sim.careerTitle(c.titleId, config, state);
      var rec = findWorldReleased(state, c.titleId);
      // 履历的「作品总销量」：首发簿记（stampCareerLaunchSales）盖的是 lifetimeSales，
      // 目录作 / 后期加入的作品只有 launchSales，兜底读它；两条都缺（没发售过）就不显示。
      var sales = rec ? num(rec.lifetimeSales != null ? rec.lifetimeSales : rec.launchSales, null) : null;
      var virtual = !!c.virtual;
      // P2-fix-b：过渡项目不再是「履历上的一行污点」，按落盘分数给一句专属评语。
      if (c.shipped) {
        if (virtual) virtualCount += 1;
        else signedCount += 1;
      }
      credits.push({
        titleId: c.titleId,
        titleLabel: title ? sim.worldLabel(title, config) : c.titleId,
        companyId: c.companyId,
        studioId: c.studioId,
        roleId: c.roleId,
        jobRank: c.jobRank,
        joinYear: c.joinYear,
        joinMonth: c.joinMonth,
        leftYear: c.leftYear,
        leftMonth: c.leftMonth,
        shipped: !!c.shipped,
        supported: !!c.supported,
        virtual: virtual,
        unsigned: !c.shipped,
        score: c.score,
        sales: sales,
        mainStatDelta: c.mainStatDelta,
        awards: c.awards || [],
        poolNote: (virtual && c.shipped) ? sim.titlePoolNote(c.titleId, c.score, config) : "",
        statusLabel: c.shipped
          ? (virtual ? (copy.resumeVirtual || "过渡项目") : (copy.resumeShipped || "署名发售"))
          : (copy.resumeUnsigned || "参与过、未署名发售")
      });
    });
    return {
      rank: sim.careerJobRank(cr, config),
      jobTitle: sim.careerJobTitle(state, config),
      jobLabel: sim.careerJobTitleDisplay(state, config),
      tenures: tenures,
      credits: credits,
      signedCount: signedCount,
      transitionCount: virtualCount
    };
  };

  sim.careerSettlementView = function (state, config) {
    var cr = state && state.career;
    var co = cr ? sim.careerCompany(cr.companyId, config) : null;
    var signed = 0;
    var transitions = 0;
    ((cr && cr.credits) || []).forEach(function (c) {
      if (!creditIsSigned(c)) return;
      if (c.virtual) transitions += 1;
      else signed += 1;
    });
    if (!co && cr && cr.tenures && cr.tenures.length) {
      co = sim.careerCompany(cr.tenures[cr.tenures.length - 1].companyId, config);
    }
    return {
      characterName: (cr && cr.characterName) || "",
      jobLabel: sim.careerJobTitleDisplay(state, config),
      jobRank: sim.careerJobRank(cr, config),
      fame: num(cr && cr.fame, 0),
      honor: num(cr && cr.honor, 0),
      creditedCount: signed,
      transitionCount: transitions,
      employer: co ? sim.worldLabel(co, config) : "",
      growthStage: (cr && cr.growthStage) || "employee"
    };
  };

  // phaseMult：开发月的阶段权重（sim.careerPhaseMult）。0 表示这个月没有实质产出
  // （金盘期等发售），连职级经验一起停——「这个月你在项目上实际投入了多少」是一个倍率管全部。
  function grantMainStatAndXp(st, kind, config, title, phaseMult) {
    var spec = jobRankSpec(config);
    var statGain = spec.statGain || {};
    var xpGain = spec.jobXpGain || {};
    var role = sim.careerRole(st.career && st.career.roleId, config);
    var key = role && role.stat;
    var virtual = !!(title && title.virtual);
    var statAmt = 0;
    var xpAmt = 0;
    var rankBonus, rk, offAmt, pdims, pi, dk, poolSpec;
    var rec;
    if (!st || !st.career) return;
    phaseMult = num(phaseMult, 1);
    if (kind === "dev") {
      // P2-fix-b：过渡项目（池作）的开发月成长略高——小项目什么都得自己上手，
      // 这是它相对目录作唯一的收益来源。旋钮在 titlePool.devStatMult / devJobXpMult；
      // 发售那一笔仍按 jobRanks.*.virtualScale 折价（署名作的分量还是在发售时体现）。
      poolSpec = virtual ? titlePoolSpec(config) : null;
      statAmt = num(statGain.perDevMonth, 0) * (virtual ? num(poolSpec.devStatMult, 1) : 1);
      xpAmt = num(xpGain.perDevMonth, 0) * (virtual ? num(poolSpec.devJobXpMult, 1) : 1);
    } else if (kind === "release") {
      statAmt = num(statGain.perRelease, 0) * (virtual ? num(statGain.virtualReleaseScale, 1) : 1);
      xpAmt = num(xpGain.perRelease, 0) * (virtual ? num(xpGain.virtualScale, 1) : 1);
    } else if (kind === "support") {
      statAmt = num(statGain.perPostLaunchMonth, 0);
      xpAmt = num(xpGain.perPostLaunchMonth, 0);
    }
    if (st.career.inspirationMonth) {
      statAmt = 0;
      xpAmt = 0;
    } else {
      if (statAmt) {
        statAmt = statAmt * phaseMult * sim.careerTraitStatGrowthMult(st, config);
        // 职级只给对数加成，避免「职级 × 属性」双线性相乘把后期拉爆。
        rankBonus = num(statGain.rankLogBonus, 0);
        rk = sim.careerJobRank(st.career, config);
        if (rankBonus > 0 && rk > 1) statAmt = statAmt * (1 + rankBonus * Math.log(rk) / Math.LN2);
      }
      if (xpAmt) xpAmt = xpAmt * phaseMult * sim.careerTraitMult(st, "jobXpMult", config, 1);
    }
    if (key && statAmt) {
      // 主职维全量、副维按 offRoleShare 微量跟进——只涨主职维会让玩到后期的角色
      // 仍是单维怪，副维永远停在开局值。
      if (!st.career.stats) st.career.stats = cloneStats();
      st.career.stats[key] = num(st.career.stats[key], 0) + statAmt;
      offAmt = statAmt * num(statGain.offRoleShare, 0);
      if (offAmt > 0) {
        pdims = sim.personDims(config);
        for (pi = 0; pi < pdims.length; pi++) {
          dk = pdims[pi];
          if (dk === key) continue;
          st.career.stats[dk] = num(st.career.stats[dk], 0) + offAmt;
        }
      }
    }
    if (xpAmt) st.career.jobXp = num(st.career.jobXp, 0) + xpAmt;
    rec = findCredit(st, st.career.titleId);
    if (rec && key && statAmt) rec.mainStatDelta = num(rec.mainStatDelta, 0) + statAmt;
  }

  sim.careerCompany = function (companyId, config) {
    return sim.findById(sim.careerWorld(config).companies || [], companyId);
  };

  sim.careerStudios = function (company) {
    return (company && company.studios) || [];
  };

  sim.careerStudio = function (companyId, studioId, config) {
    var co = typeof companyId === "object" ? companyId : sim.careerCompany(companyId, config);
    var list = sim.careerStudios(co);
    if (studioId) {
      var hit = sim.findById(list, studioId);
      if (hit) return hit;
    }
    return list[0] || null;
  };

  sim.defaultStudioId = function (company) {
    var list = sim.careerStudios(company);
    return list.length ? list[0].id : null;
  };

  sim.companyJoinable = function (company, year) {
    if (!company) return false;
    if (company.joinable === false) return false;
    if (company.hireFromYear != null && year < company.hireFromYear) return false;
    if (company.hireUntilYear != null && year > company.hireUntilYear) return false;
    return true;
  };

  function virtualList(st, key) {
    if (!st || !st.career) return [];
    return st.career[key] || [];
  }

  sim.careerTitle = function (titleId, config, st) {
    var t = sim.findById(sim.careerWorld(config).titles || [], titleId);
    if (t) return t;
    return sim.findById(virtualList(st, "virtualProjects"), titleId);
  };

  sim.careerTitleDetail = function (titleId, config, st) {
    var d = sim.findById(sim.careerWorld(config).titleDetails || [], titleId);
    if (d) return d;
    return sim.findById(virtualList(st, "virtualDetails"), titleId);
  };

  sim.allCareerTitles = function (config, st) {
    return (sim.careerWorld(config).titles || []).concat(virtualList(st, "virtualProjects"));
  };

  sim.careerPhaseAt = function (progress, config) {
    var phases = sim.careerWorld(config).projectPhases || [];
    var i, p, until;
    if (!phases.length) return null;
    for (i = 0; i < phases.length; i++) {
      p = phases[i];
      until = p.until != null ? p.until : 1;
      if (progress <= until) return p;
    }
    return phases[phases.length - 1];
  };

  // 开发期成长旋钮（career-world.json 的 development 段）。
  function careerDevSpec(config) {
    return (sim.careerWorld(config) || {}).development || {};
  }

  // 派工偏好（development.assignment 段）：玩家接手新作时「挑哪部」。
  function assignmentSpec(config) {
    return careerDevSpec(config).assignment || {};
  }

  // 进度分桶：0~1 的进度按 freshBucket 切段，用于「先比新鲜度、再比 prestige」的两级排序。
  // freshBucket 配 0 或负数 = 不分桶，排序退回纯 prestige（旧行为）。
  function freshBucket(progress, spec) {
    var b = num(spec.freshBucket, 0);
    var v;
    if (!(b > 0)) return 0;
    v = Math.floor(num(progress, 0) / b);
    return v > 0 ? v : 0;
  }

  // A：该不该拒绝一个「已经做得很深」的候选。三条任一条不成立就照收——
  // 宁可让人去收尾，也不许把玩家锁死在空窗里（死锁守卫）。
  function deepCandidateRejected(title, st, config) {
    var spec = assignmentSpec(config);
    var maxP = spec.maxProgress;
    var detail, next, gap;
    if (maxP == null || !title || !st || !st.career) return false;
    detail = sim.careerTitleDetail(title.id, config, st);
    if (!detail) return false;
    if (sim.titleProgress(title, detail, st.year, st.month, config) <= num(maxP, 0)) return false;
    if (num(st.career.idleMonths, 0) >= num(spec.waitMaxMonths, 8)) return false;
    if (!sim.nextCatalogTitle(st, config, st.career.companyId, st.career.studioId)) return false;
    gap = sim.catalogGapMonths(st, config, st.career.companyId, st.career.studioId);
    if (gap == null) return false;
    return true;
  }

  // 「在等下一部新作开工」的记录：UI 靠它把空窗文案从「组里没活」换成「等立项」。
  function waitingForStartOf(st, config, title) {
    var idx = sim.titleDevStart(title, sim.careerTitleDetail(title.id, config, st), config);
    var parts = idx == null ? null : sim.monthFromIndex(idx);
    return {
      titleId: title.id,
      startYear: parts ? parts.year : null,
      startMonth: parts ? parts.month : null
    };
  }

  // 阶段权重：按项目所处阶段缩放「开发月的属性成长 + 作品贡献」。
  // 立项期在摸需求、学得慢；填充与打磨期反复调优、学得最快；金盘期只等压盘，无实质产出（0）。
  // 参数是阶段 id 而不是 state：调用方（tick）手上已经有 projectView.phase，不必再算一次。
  // 长线运营月的 phase 是 postLaunch.phase（id="support"），查不到表项自然回退 default 1。
  sim.careerPhaseMult = function (phaseId, config) {
    var spec = careerDevSpec(config);
    var table = spec.phaseMult || {};
    var v = phaseId != null ? table[phaseId] : null;
    return v == null ? num(spec.phaseMultDefault, 1) : num(v, 1);
  };

  // 体量阻尼：一个人在小项目里一人多岗、产出占比高；在 3A 里只是螺丝钉。
  // 只作用在「作品月贡献」上，不动属性成长——大项目跟着强团队学得多，不等于个人功劳大。
  // 体量取 company.power（虚拟作兜底读 title.power），同 sim.careerLaunchSales 的口径。
  sim.careerPowerContribMult = function (title, config) {
    var spec = careerDevSpec(config);
    var table = spec.powerContribMult || {};
    var p = titlePower(title, config);
    var v = p != null ? table[p] : null;
    return v == null ? num(spec.powerContribDefault, 1) : num(v, 1);
  };

  sim.titleCoversMonth = function (title, detail, year, month, config) {
    var start, end, now;
    if (!title || !detail) return false;
    start = sim.titleDevStart(title, detail, config);
    end = sim.monthIndex(title.releaseYear, title.releaseMonth);
    now = sim.monthIndex(year, month);
    return now >= start && now <= end;
  };

  sim.titleProgress = function (title, detail, year, month, config) {
    var start, end, now, span;
    if (!title || !detail) return 0;
    start = sim.titleDevStart(title, detail, config);
    end = sim.monthIndex(title.releaseYear, title.releaseMonth);
    now = sim.monthIndex(year, month);
    span = Math.max(1, end - start);
    if (now <= start) return 0;
    if (now >= end) return 1;
    return (now - start) / span;
  };

  function lateJoinSpec(config) {
    return (sim.careerWorld(config).lateJoin) || {};
  }

  function idleGapSpec(config) {
    return (sim.careerWorld(config).idleGap) || {};
  }

  sim.careerTitleIsLate = function (title, detail, year, month, config) {
    var spec = lateJoinSpec(config);
    var progress, remain, end;
    if (!title || title.virtual || !detail) return false;
    progress = sim.titleProgress(title, detail, year, month, config);
    if (spec.progressMin != null && progress >= spec.progressMin) return true;
    if (spec.remainingMonthsMax != null) {
      end = sim.monthIndex(title.releaseYear, title.releaseMonth);
      remain = end - sim.monthIndex(year, month);
      if (remain <= spec.remainingMonthsMax) return true;
    }
    return false;
  };

  // atYear/atMonth 可省略（默认取 st 的当月）：池作兜底要按「假想的当月」问
  // 「这家公司下一档真作什么时候开工」，不能只看玩家此刻站在哪个月。
  sim.nextCatalogTitle = function (st, config, companyId, studioId, atYear, atMonth) {
    var world = sim.careerWorld(config);
    var titles = world.titles || [];
    var details = world.titleDetails || [];
    var detailMap = {};
    var shipped = st ? shippedSet(st) : {};
    var yAt = atYear != null ? atYear : (st && st.year);
    var mAt = atMonth != null ? atMonth : (st && st.month);
    var now = sim.monthIndex(yAt, mAt);
    var studioHits = [];
    var companyHits = [];
    var i, t, d, start, pool, row;
    if (!companyId) return null;
    for (i = 0; i < details.length; i++) detailMap[details[i].id] = details[i];
    for (i = 0; i < titles.length; i++) {
      t = titles[i];
      if (!t || t.virtual || t.companyId !== companyId) continue;
      if (shipped[t.id]) continue;
      d = detailMap[t.id];
      if (!d) continue;
      if (sim.titleCoversMonth(t, d, yAt, mAt, config)) continue;
      start = sim.titleDevStart(t, d, config);
      if (start <= now) continue;
      row = { title: t, detail: d, start: start };
      if (studioId && t.studioId === studioId) studioHits.push(row);
      companyHits.push(row);
    }
    pool = studioHits.length ? studioHits : companyHits;
    pool.sort(function (a, b) {
      if (a.start !== b.start) return a.start - b.start;
      if (a.title.releaseYear !== b.title.releaseYear) return a.title.releaseYear - b.title.releaseYear;
      return (a.title.releaseMonth || 1) - (b.title.releaseMonth || 1);
    });
    return pool.length ? pool[0].title : null;
  };

  sim.catalogGapMonths = function (st, config, companyId, studioId) {
    var next = sim.nextCatalogTitle(st, config, companyId, studioId);
    var d, start;
    if (!next) return null;
    d = sim.careerTitleDetail(next.id, config, st);
    if (!d) return null;
    start = sim.titleDevStart(next, d, config);
    return start - sim.monthIndex(st.year, st.month);
  };

  // ── 游戏池（titlePool；P2-fix 从 virtualPool 改名并重新启用）────────────────
  // 池里的作品不属于任何公司，谁缺作品就分给谁：
  //   ① 覆盖补全——某公司某月排不出目录真作时抽一部顶上（titlePool.coverage）；
  //   ② 入职/在岗兜底——当月没活就直接抽（titlePool.fallback），不再弹空窗抉择。
  // 名字里的 virtual 仍指「非目录真作」，别当成「已下线」。
  function titlePoolSpec(config) {
    return (sim.careerWorld(config).titlePool) || {};
  }
  sim.titlePoolSpec = titlePoolSpec;

  function titlePoolEnabled(config) {
    return titlePoolSpec(config).enabled === true;
  }
  sim.titlePoolEnabled = titlePoolEnabled;

  // 池能不能用：总开关开着，且 coverage / fallback 至少开一个。
  function titlePoolUsable(config) {
    var spec = titlePoolSpec(config);
    var cov, fb;
    if (spec.enabled !== true) return false;
    cov = spec.coverage || {};
    fb = spec.fallback || {};
    return cov.enabled === true || fb.enabled === true;
  }
  sim.titlePoolUsable = titlePoolUsable;

  // 「值得为它开一部池作」的最小空窗。比它短的洞交给推进吸收
  // → 允许的空窗 = 它 − 1 个月（覆盖保证的验收口径）。
  function poolMinFillMonths(config) {
    var spec = titlePoolSpec(config);
    var cov = spec.coverage || {};
    return num(cov.minFillMonths, num(idleGapSpec(config).minDevMonths, virtualMinDevMonths(config)));
  }
  sim.poolMinFillMonths = poolMinFillMonths;

  // 过渡项目的专属评语（P2-fix-b）。档位与媒体评语同源（config.release.media 的
  // topScore/highScore/lowScore），缺档按就近回退（与 media.js 的 BAND_CHAIN 同序）。
  // 选条用 titleId 的稳定哈希 —— **不消费 RNG**，履历页每次重绘拿到的都是同一句，
  // 读档后也不会漂（这条和池作工期/命名同一条纪律）。
  sim.titlePoolNote = function (titleId, score, config) {
    var pools = ((sim.careerCopy(config) || {}).poolNotes) || {};
    var band, chain, list = null, h = 0, i, id;
    if (score == null) return "";
    band = sim.mediaQuoteBand ? sim.mediaQuoteBand(score, config) : "mid";
    chain = {
      top: ["top", "high", "mid", "low"],
      high: ["high", "top", "mid", "low"],
      mid: ["mid", "high", "low", "top"],
      low: ["low", "mid", "high", "top"]
    }[band] || ["mid", "high", "low", "top"];
    for (i = 0; i < chain.length; i++) {
      if (pools[chain[i]] && pools[chain[i]].length) { list = pools[chain[i]]; break; }
    }
    if (!list) return "";
    id = String(titleId || "");
    for (i = 0; i < id.length; i++) h = ((h * 31) + id.charCodeAt(i)) >>> 0;
    return list[h % list.length];
  };

  function virtualMinDevMonths(config) {
    var pool = titlePoolSpec(config);
    var gap = idleGapSpec(config);
    if (pool.devMonthsMin != null) return num(pool.devMonthsMin, 0);
    return num(gap.minDevMonths, 0);
  }

  // 当前公司当月够不够开一部池作：池得能用，且到下一档目录真作的空窗 ≥ poolMinFillMonths
  // （gap == null 表示本公司已经排不出真作，池作可以一直顶下去）。
  function canStartCareerVirtual(st, config) {
    var gap, minDev;
    if (!st || !st.career || !st.career.companyId) return false;
    if (!titlePoolUsable(config)) return false;
    minDev = poolMinFillMonths(config);
    gap = sim.catalogGapMonths(st, config, st.career.companyId, st.career.studioId);
    if (gap == null) return true;
    return gap >= minDev;
  }
  sim.canStartPoolProject = canStartCareerVirtual;

  function shippedSet(st) {
    var set = {};
    (st.worldReleased || []).forEach(function (g) {
      set[g.id] = true;
    });
    return set;
  }

  // titlesInDevAt 的带详情版本：pickCareerAssignment 要算进度，别再自己建一遍详情索引。
  function titlesInDevAtDetail(companyId, year, month, config, st, studioId) {
    var titles = sim.allCareerTitles(config, st);
    var details = (sim.careerWorld(config).titleDetails || []).concat(virtualList(st, "virtualDetails"));
    var detailMap = {};
    var shipped = st ? shippedSet(st) : {};
    details.forEach(function (d) { detailMap[d.id] = d; });
    return {
      detailMap: detailMap,
      list: titles.filter(function (t) {
        if (companyId && t.companyId !== companyId) return false;
        if (studioId && t.studioId && t.studioId !== studioId) return false;
        if (shipped[t.id]) return false;
        return sim.titleCoversMonth(t, detailMap[t.id], year, month, config);
      })
    };
  }

  sim.titlesInDevAt = function (companyId, year, month, config, st, studioId) {
    return titlesInDevAtDetail(companyId, year, month, config, st, studioId).list;
  };

  // 招牌作（landmark）优先这条不变——它是「重点作品优先」的产品语义。
  // 新鲜度只在招牌作池内部起作用：同池里优先把玩家放进刚开工的作。
  sim.pickCareerAssignment = function (companyId, year, month, config, st, studioId) {
    var hit = titlesInDevAtDetail(companyId, year, month, config, st, studioId);
    var list = hit.list;
    var spec = assignmentSpec(config);
    var landmarks, pool;
    if (!list.length) return null;
    landmarks = list.filter(function (t) { return t.landmark && !t.virtual; });
    pool = landmarks.length ? landmarks : list.filter(function (t) { return !t.virtual; });
    if (!pool.length) pool = list;
    pool = pool.slice().sort(function (a, b) {
      var pd, fa, fb;
      if (spec.preferFresh === true) {
        fa = freshBucket(sim.titleProgress(a, hit.detailMap[a.id], year, month, config), spec);
        fb = freshBucket(sim.titleProgress(b, hit.detailMap[b.id], year, month, config), spec);
        if (fa !== fb) return fa - fb;
      }
      pd = num(b.prestige, 0) - num(a.prestige, 0);
      if (pd) return pd;
      if (a.releaseYear !== b.releaseYear) return a.releaseYear - b.releaseYear;
      return (a.releaseMonth || 1) - (b.releaseMonth || 1);
    });
    return pool[0];
  };

  // 一家公司当年月是否真有一部"目录作品"在开发（虚拟作不算：虚拟作本身就是空窗的产物）。
  // 这是 offer / 邀约的准入条件——企业挖人、发 offer 是为了让人做事情，把人挂进一家
  // 当月空着的公司，过月就被判空窗，一两个月后被塞一部虚拟作
  //（见 activity/issues/bug-career-project-swapped-to-virtual.md）。
  sim.companyInDevCatalogTitle = function (companyId, st, config, studioId) {
    var hit;
    if (!companyId || !st) return null;
    hit = sim.pickCareerAssignment(companyId, st.year, st.month, config, st, studioId);
    return (hit && !hit.virtual) ? hit : null;
  };

  // P2c 开发周期拉长：目录作的档期是硬数据（releaseYear/Month 钉死），所以只能改开工那一端——
  // 发售日不动，开工月 = 发售月 − 原时长 × development.cycleMult。虚拟作不走这条（它自己从当前月往后算）。
  // 所有「这部作覆盖哪几个月」「现在做到几成」的判定都必须走这里，否则进度与拍档期会分叉。
  sim.careerCycleMult = function (config) {
    return num(careerDevSpec(config).cycleMult, 1);
  };

  // D：开工窗口规则（development.devWindow）。默认 stretch = 与 P2c 完全一致的旧口径。
  function devWindowSpec(config) {
    return careerDevSpec(config).devWindow || {};
  }

  // 「本公司上一作的发售月」索引（titleId → 上一作发售月序）。只在 mode=cadence 时才建，
  // 且按 config 记忆化——否则 hot path（titleCoversMonth/titleProgress）每次都要扫 975 部作。
  var devPrevMemo = [];
  function devPrevRelease(config) {
    var i, map, byCo, titles, det, spec;
    for (i = 0; i < devPrevMemo.length; i++) {
      if (devPrevMemo[i].cfg === config) return devPrevMemo[i].map;
    }
    spec = sim.careerWorld(config);
    titles = spec.titles || [];
    det = {};
    (spec.titleDetails || []).forEach(function (d) { det[d.id] = d; });
    byCo = {};
    titles.forEach(function (t) {
      if (!t || t.virtual || !det[t.id]) return;
      (byCo[t.companyId] = byCo[t.companyId] || []).push({
        id: t.id,
        rel: sim.monthIndex(t.releaseYear, t.releaseMonth)
      });
    });
    map = {};
    Object.keys(byCo).forEach(function (cid) {
      var list = byCo[cid].sort(function (a, b) { return a.rel - b.rel; });
      for (var k = 0; k < list.length; k++) map[list[k].id] = k > 0 ? list[k - 1].rel : null;
    });
    devPrevMemo.push({ cfg: config, map: map });
    if (devPrevMemo.length > 4) devPrevMemo.shift();
    return map;
  }

  function applyDevWindow(title, start, end, config) {
    var spec = devWindowSpec(config);
    var cap = num(spec.capMonths, 0);
    var floor, prev;
    if (spec.mode !== "cadence" && !(cap > 0)) return start;
    if (cap > 0 && end - start > cap) start = end - cap;
    if (spec.mode === "cadence") {
      prev = devPrevRelease(config)[title.id];
      if (prev != null) {
        floor = prev + num(spec.minGapMonths, 1);
        if (floor > start) start = floor;
      }
      if (start > end) start = end;
    }
    return start;
  }

  sim.titleDevStart = function (title, detail, config) {
    var start, end, mult;
    if (!title || !detail) return null;
    start = sim.monthIndex(detail.devStartYear, detail.devStartMonth);
    if (title.virtual || detail.virtual) return start;
    end = sim.monthIndex(title.releaseYear, title.releaseMonth);
    mult = sim.careerCycleMult(config);
    if (mult && mult !== 1 && end > start) start = end - Math.round((end - start) * mult);
    return applyDevWindow(title, start, end, config);
  };

  function scoreFromLiveSpec(config) {
    return (sim.careerWorld(config).scoreFromLive) || {};
  }

  function attrRefOf(config) {
    var m = scoreFromLiveSpec(config);
    var q = (sim.careerWorld(config).quality) || {};
    var ref = m.attrRef != null ? m.attrRef : q.statMax;
    ref = num(ref, 0);
    return ref > 0 ? ref : 1;
  }

  // 人物属性 → 产出倍率的唯一换算。属性本身不封顶（career.stats 不夹），但产出必须收敛：
  // softMax × stat / (stat + softRef)，stat = softRef 时正好 1.0，再往上趋近 softMax 但不越过。
  // 旧口径 stat / attrRef 是线性无界的——属性 200 时产出 2 倍、300 时 3 倍，中后期直接失控。
  // 没配 statSoftCap 时退回旧线性口径，免得打错配置把产出打成 0。
  sim.careerStatFactor = function (stat, config) {
    var spec = ((sim.careerWorld(config).quality) || {}).statSoftCap || {};
    var ref = num(spec.ref, 0);
    var max = num(spec.max, 0);
    var v = num(stat, 0);
    if (!(v > 0)) return 0;
    if (!(ref > 0) || !(max > 0)) return v / attrRefOf(config);
    return max * v / (v + ref);
  };

  function careerStateArg(st) {
    if (!st) return null;
    return st.career ? st : { career: careerArg(st) };
  }

  sim.careerMainStat = function (st, config) {
    return mainStatValue(careerStateArg(st), config);
  };

  sim.careerPlayerImpactFactor = function (st, config) {
    var cr = st && st.career ? st.career : careerArg(st);
    var rank = sim.careerJobRank(cr, config);
    var main = sim.careerMainStat(st, config);
    var factor = rankTableVal(jobRankSpec(config).contribMult, rank, 1) * sim.careerStatFactor(main, config);
    if (factor < 0) factor = 0;
    return factor;
  };

  sim.careerPlayerScoreWeight = function (st, config) {
    var m = scoreFromLiveSpec(config);
    var cr = st && st.career ? st.career : careerArg(st);
    var rank = sim.careerJobRank(cr, config);
    var main = sim.careerMainStat(st, config);
    var w = num(m.playerWeight, 0) * rankTableVal(jobRankSpec(config).playerWeightMult, rank, 1) * sim.careerStatFactor(main, config);
    if (m.playerWeightMin != null && w < m.playerWeightMin) w = m.playerWeightMin;
    if (m.playerWeightMax != null && w > m.playerWeightMax) w = m.playerWeightMax;
    if (w < 0) w = 0;
    if (w > 1) w = 1;
    return w;
  };

  sim.careerMasterpieceBonus = function (title, config) {
    var m = scoreFromLiveSpec(config).masterpiece || {};
    var by = m.byPrestige || {};
    var row;
    if (!title || title.virtual || !title.landmark) return 0;
    row = by[String(title.prestige)] || by[title.prestige];
    return row ? num(row.bonus, 0) : 0;
  };

  function landmarkScoreFloor(title, catalogScore, config) {
    var m = scoreFromLiveSpec(config).masterpiece || {};
    var by = m.byPrestige || {};
    var row;
    if (!title || title.virtual || !title.landmark || catalogScore == null) return null;
    row = by[String(title.prestige)] || by[title.prestige];
    if (!row || row.floorBelowCatalog == null) return null;
    return num(catalogScore, 0) - num(row.floorBelowCatalog, 0);
  }

  function craftSpec(config) {
    return titlePoolSpec(config).craft || {};
  }

  function proficiencySpec(config) {
    return (sim.careerWorld(config) || {}).proficiency || {};
  }

  // 熟练度档位序号：0 生疏 / 1 熟练 / 2 拿手 / 3 看家本领。
  sim.xpTierIndex = function (xp, config) {
    var tiers = sim.xpTiers(config);
    var i;
    xp = num(xp, 0);
    for (i = 0; i < tiers.length; i++) {
      if (xp <= num(tiers[i].until, 0)) return i;
    }
    return tiers.length ? tiers.length - 1 : 0;
  };

  // 档位 → 加成百分比：config.proficiency.ladder，默认 0% / 10% / 15% / 20%。
  function proficiencyLadder(config) {
    var ladder = proficiencySpec(config).ladder;
    if (!ladder || !ladder.length) ladder = [0, 0.1, 0.15, 0.2];
    return ladder;
  }

  function combineProficiencyPct(a, b, mode) {
    if (mode === "higher") return Math.max(a, b);
    if (mode === "average") return (a + b) / 2;
    return a + b;
  }

  // 题材 / 玩法两条线的经验值：工作室优先，没有工作室时退回公司经验桶。
  function projectXpValue(st, companyId, studioId, kind, id) {
    var v = studioId ? sim.studioXpValue(st, studioId, kind, id) : 0;
    if (!v && companyId) v = sim.companyXpValue(st, companyId, kind, id);
    return v;
  }

  // 工作室对题材 + 玩法的熟练度加成，用于新作立项初始四维。
  sim.studioProficiencyBonusPct = function (st, companyId, studioId, genreId, gameplayId, config) {
    var mode = proficiencySpec(config).studioCombine || "sum";
    var ladder = proficiencyLadder(config);
    var g = projectXpValue(st, companyId, studioId, "genre", genreId);
    var p = projectXpValue(st, companyId, studioId, "gameplay", gameplayId);
    var gp = num(ladder[sim.xpTierIndex(g, config)], 0);
    var pp = num(ladder[sim.xpTierIndex(p, config)], 0);
    return combineProficiencyPct(gp, pp, mode);
  };

  // 玩家个人对题材 + 玩法的熟练度加成，用于开发月贡献。
  sim.playerProficiencyBonusPct = function (st, genreId, gameplayId, config) {
    var mode = proficiencySpec(config).playerCombine || "sum";
    var ladder = proficiencyLadder(config);
    var g = sim.playerXpValue(st, "genre", genreId);
    var p = sim.playerXpValue(st, "gameplay", gameplayId);
    var gp = num(ladder[sim.xpTierIndex(g, config)], 0);
    var pp = num(ladder[sim.xpTierIndex(p, config)], 0);
    return combineProficiencyPct(gp, pp, mode);
  };

  // （作品四维均值统一走 sim.titleQualityMean，不要在这里再写一份。）

  sim.careerTeamMembers = function (st, config) {
    var list = [];
    var cr = st && st.career;
    if (!cr) return list;
    list.push({
      id: "player",
      roleId: cr.roleId,
      jobRank: sim.careerJobRank(cr, config),
      stats: cloneStats(cr.stats)
    });
    (cr.colleagues || []).forEach(function (c) {
      list.push({
        id: c.id,
        roleId: c.roleId,
        jobRank: c.jobRank,
        stats: cloneStats(c.stats)
      });
    });
    return list;
  };

  sim.careerTeamAvgStats = function (st, config) {
    var members = sim.careerTeamMembers(st, config);
    var out = cloneStats();
    var i, j, k, n = members.length;
    if (!n) return out;
    for (i = 0; i < members.length; i++) {
      for (j = 0; j < DIMS.length; j++) {
        k = DIMS[j];
        out[k] += num(members[i].stats && members[i].stats[k], 0);
      }
    }
    for (j = 0; j < DIMS.length; j++) out[DIMS[j]] = out[DIMS[j]] / n;
    return out;
  };

  // 虚拟作「四维均值 → 对外口碑」：craft.scoreBase + 均值 / craft.statDivisor，夹 1～10。
  // 人数与工期不在这里重复计算：人数已折进立项四维（teamStatShare 求和），工期靠每月贡献抬 live。
  sim.careerCraftPublicScore = function (liveMean, config) {
    var spec = craftSpec(config);
    var m = scoreFromLiveSpec(config);
    var base = spec.scoreBase != null ? num(spec.scoreBase, 0) : 0;
    var div = num(spec.statDivisor, 0);
    var score, min, max, dec, f;
    if (!div) div = 1;
    score = base + num(liveMean, 0) / div;
    min = m.min != null ? m.min : score;
    max = m.max != null ? m.max : score;
    if (score < min) score = min;
    if (score > max) score = max;
    dec = m.decimals != null ? m.decimals : 1;
    f = Math.pow(10, dec);
    return Math.round(score * f) / f;
  };

  // 新作立项基础分：全员四维各取 titlePool.teamStatShare（默认 10%）相加后向下取整，
  // 再乘工作室对题材 + 玩法的熟练度加成。玩家个人熟练度不进这里，改走开发月贡献。
  sim.careerCraftLiveStats = function (st, months, teamN, config, genreId, gameplayId) {
    var pool = titlePoolSpec(config);
    var members = sim.careerTeamMembers(st, config);
    var n = teamN != null ? num(teamN, 0) : members.length;
    var share = pool.teamStatShare != null ? num(pool.teamStatShare, 0.1) : 0.1;
    var cr = (st && st.career) || {};
    var pct = sim.studioProficiencyBonusPct(st, cr.companyId, cr.studioId, genreId, gameplayId, config);
    var personSum = {}, i, j, k, sum, out;
    DIMS.forEach(function (d) { personSum[d] = 0; });
    if (!n || !members.length) return sim.cloneTitleStats(pool.baseStats, config);
    // 先按人物维把全员收一遍，再整块过 personToTitle 落到作品维。
    for (i = 0; i < DIMS.length; i++) {
      k = DIMS[i];
      sum = 0;
      for (j = 0; j < members.length; j++) sum += num(members[j].stats && members[j].stats[k], 0);
      personSum[k] = sum;
    }
    out = sim.titleStatsFromPerson(personSum, config, share);
    sim.titleDims(config).forEach(function (d) {
      var v = Math.floor(num(out[d], 0));
      if (pct) v = Math.floor(v * (1 + pct));
      out[d] = v < 0 ? 0 : v;
    });
    return out;
  };

  function scoreCareerMedia(st, publicScore, config) {
    var m = scoreFromLiveSpec(config);
    if (sim.scoreMediaFromPublic) {
      return sim.scoreMediaFromPublic(st, publicScore, config, {
        min: m.mediaJitterMin,
        max: m.mediaJitterMax
      });
    }
    return sim.scoreMedia(st, sim.liveStatsForMedia(st.career && st.career.liveStats, config), [], config, null);
  }

  // 表驱动的倍率取值：表键是字符串（"1"/"2"/"3"），查不到就回退 dflt。
  function tableMult(table, key, dflt) {
    var v;
    if (!table || key == null || key === "") return dflt;
    v = table[String(key)];
    if (v == null) v = table[key];
    v = num(v, null);
    return v == null ? dflt : v;
  }

  // 作品的发行方实力（1/2/3）。目录作读 companyId 指向的公司，虚拟作/兜底读 title.power。
  // 查不到返回 null，由调用方用 launchSales.powerDefault 兜底。
  function titlePower(title, config) {
    var co;
    if (!title) return null;
    if (title.power != null) return title.power;
    if (!title.companyId || !sim.careerCompany) return null;
    co = sim.careerCompany(title.companyId, config);
    return co && co.power != null ? co.power : null;
  }

  // 首月销量基准 = 单位量 × 评分曲线 × prestige 倍率 × 质量倍率 × 发行方倍率。
  // 评分曲线在 scoreRef 处换斜率：及格线以上每分 ×e^scoreExp（约 ×5.5），落差由评分主导而不是靠堆线性系数
  // （旧的 scoreCoeff 线性写法下 9.9 分和 7 分只差 1.7 倍，销量对评分几乎不敏感）。
  // 及格线以下换更缓的 scoreExpBelow：纯指数的下尾会把 3 分作品压到个位数，而真实市场里再烂的作品
  // 也有基础曝光。这个旋钮只抬下尾，7 分及以上完全由 scoreExp 决定、一个数不动。
  sim.careerLaunchSales = function (title, publicScore, config, liveStats) {
    var spec = (sim.careerWorld(config).launchSales) || {};
    var score = num(publicScore, 0);
    var stats = liveStats || (title && title.stats) || {};
    var qsum = sim.titleQualitySum(stats, config);
    var qref = num(spec.qualityRef, 0);
    var qexp = num(spec.qualityExp, 0);
    var qm = qref > 0 ? Math.pow(Math.max(0, qsum) / qref, qexp) : 1;
    var qmin = num(spec.qualityMin, null);
    var qmax = num(spec.qualityMax, null);
    var ref = num(spec.scoreRef, 0);
    var curveExp;
    var baseline, y1, sales;
    if (qmin != null && qm < qmin) qm = qmin;
    if (qmax != null && qm > qmax) qm = qmax;
    curveExp = score < ref
      ? num(spec.scoreExpBelow, num(spec.scoreExp, 0))
      : num(spec.scoreExp, 0);
    baseline = Math.round(
      num(spec.baseUnit, 0) *
      Math.exp(curveExp * (score - ref)) *
      tableMult(spec.prestigeMult, title && title.prestige, 1) *
      qm *
      tableMult(spec.powerMult, titlePower(title, config), num(spec.powerDefault, 1))
    );
    if (!(baseline >= 0)) baseline = 0;
    y1 = sim.salesFactor ? sim.salesFactor(1, score, config) : 1;
    if (!(y1 > 0)) y1 = 0;
    sales = sim.boxedActualFromY
      ? sim.boxedActualFromY({ baselineSales: baseline }, y1)
      : Math.round(baseline * y1);
    if (sales < 0) sales = 0;
    return { baselineSales: baseline, launchSales: sales };
  };

  function stampCareerLaunchSales(rec, title, publicScore, config, liveStats) {
    var packed = sim.careerLaunchSales(title, publicScore, config, liveStats);
    rec.baselineSales = packed.baselineSales;
    rec.launchSales = packed.launchSales;
    rec.lifetimeSales = packed.launchSales;
    rec.monthSales = packed.launchSales;
  }

  sim.liveToPublicScore = function (liveStats, worldScore, config, st, title) {
    var world = sim.careerWorld(config);
    var m = world.scoreFromLive || {};
    var dims = sim.titleDims(config);
    var sum = 0, n = 0, i, avg, divisor, fromLive, w, mixed, min, max, dec, f, bonus, floor, catalog;
    var state = careerStateArg(st);
    liveStats = liveStats || {};
    title = title || (state && state.career && state.career.titleId
      ? sim.careerTitle(state.career.titleId, config, state) : null);
    for (i = 0; i < dims.length; i++) {
      if (liveStats[dims[i]] != null) {
        sum += num(liveStats[dims[i]], 0);
        n += 1;
      }
    }
    avg = n ? sum / n : 0;
    divisor = m.divisor;
    if (divisor == null || divisor === 0) divisor = 1;
    fromLive = avg / divisor;
    if (title && title.virtual) {
      // 虚拟作走 craft 自己的标尺（scoreBase + 均值 / statDivisor），不混目录 score。
      mixed = sim.careerCraftPublicScore(avg, config);
    } else {
      bonus = sim.careerMasterpieceBonus(title, config);
      catalog = worldScore == null ? fromLive : (num(worldScore, 0) + bonus);
      w = 0;
      if (state) w = sim.careerPlayerScoreWeight(state, config);
      else if (m.playerWeight != null) w = num(m.playerWeight, 0);
      mixed = catalog * (1 - w) + fromLive * w;
      if (state && state.career) {
        mixed += num(state.career.producerReleaseBias, 0);
        mixed += num((sim.careerWorld(config).producerCareer || {}).releaseBias, 0) *
          ((sim.isCareerProducer && sim.isCareerProducer(state)) ? 1 : 0);
      }
      floor = landmarkScoreFloor(title, worldScore, config);
      if (floor != null && mixed < floor) mixed = floor;
    }
    min = m.min != null ? m.min : mixed;
    max = m.max != null ? m.max : mixed;
    if (mixed < min) mixed = min;
    if (mixed > max) mixed = max;
    dec = m.decimals != null ? m.decimals : 1;
    f = Math.pow(10, dec);
    return Math.round(mixed * f) / f;
  };

  sim.applyCareerLiveDelta = function (st, dim, delta, config) {
    var world, q, key, next, min, dims, pdims, pi;
    if (!st.career || !st.career.liveStats || !dim) return;
    world = sim.careerWorld(config);
    q = world.quality || {};
    // liveStats 存的是作品维。历史别名（script/design）按位置对到作品维上，
    // 人物维一旦传进来就直接忽略，免得把两套维度混在一张表里。
    dims = sim.titleDims(config);
    if (dims.indexOf(dim) >= 0) {
      key = dim;
    } else {
      pdims = sim.personDims(config);
      pi = pdims.indexOf(dim === "script" ? "design" : dim);
      if (pi < 0) return;
      key = dims[pi % dims.length];
    }
    next = num(st.career.liveStats[key], 0) + num(delta, 0);
    min = q.statMin != null ? q.statMin : 0;
    if (next < min) next = min;
    if (!q.liveCanExceedMax && q.statMax != null && next > q.statMax) next = q.statMax;
    st.career.liveStats[key] = next;
  };

  function scaleQualityAmount(st, amount, config, unscaled) {
    var f, i, k, out, posM, negM;
    if (unscaled || amount == null) return amount;
    f = sim.careerPlayerImpactFactor(st, config);
    // 赌徒（好坏都放大）/ 稳如老狗（好坏都削减）：按正负号分派倍率。
    posM = sim.careerTraitMult(st, "eventQualityPosMult", config, 1);
    negM = sim.careerTraitMult(st, "eventQualityNegMult", config, 1);
    function scaleOne(v) {
      v = num(v, 0) * f;
      return v >= 0 ? v * posM : v * negM;
    }
    if (isArr(amount)) {
      out = [];
      for (i = 0; i < amount.length; i++) out.push(scaleOne(amount[i]));
      return out;
    }
    if (typeof amount === "object") {
      out = {};
      for (k in amount) {
        if (Object.prototype.hasOwnProperty.call(amount, k)) out[k] = scaleOne(amount[k]);
      }
      return out;
    }
    return scaleOne(amount);
  }

  function initPlayerStats(role, player) {
    var stats = cloneStats(player.startingStats);
    var dim = role && role.stat;
    if (dim) stats[dim] = num(stats[dim], 0) + num(player.specialtyBonus, 0);
    return stats;
  }

  sim.ensureCareerExtras = function (st, config) {
    if (!st.career) return st;
    if (!st.career.virtualProjects) st.career.virtualProjects = [];
    if (!st.career.virtualDetails) st.career.virtualDetails = [];
    if (!st.career.credits) st.career.credits = [];
    if (!st.career.yearEndOffers) st.career.yearEndOffers = [];
    if (!st.career.invites) st.career.invites = [];
    if (!st.career.colleaguePool) st.career.colleaguePool = {};
    if (!st.career.colleagues) st.career.colleagues = [];
    if (!st.career.firedTitleEvents) st.career.firedTitleEvents = [];
    if (st.career.idleMonths == null) st.career.idleMonths = 0;
    if (st.career.waitingForStart === undefined) st.career.waitingForStart = null;
    if (st.career.virtualSeq == null) st.career.virtualSeq = 0;
    if (st.career.inviteYearStamp == null) st.career.inviteYearStamp = 0;
    if (st.career.invitesRolledThisYear == null) st.career.invitesRolledThisYear = 0;
    if (st.career.inviteYearHit == null) st.career.inviteYearHit = false;
    if (st.career.hopFailedYear == null) st.career.hopFailedYear = null;
    if (!st.career.leftProjectLive) st.career.leftProjectLive = {};
    if (!st.career.genreXp) st.career.genreXp = {};
    if (!st.career.gameplayXp) st.career.gameplayXp = {};
    if (st.career.jobRank == null) st.career.jobRank = (jobRankSpec(config || {}).start) || 1;
    if (st.career.jobXp == null) st.career.jobXp = 0;
    if (!st.career.tenures) st.career.tenures = [];
    if (st.career.monthsInRank == null) st.career.monthsInRank = 0;
    if (st.career.promotionsThisYear == null) st.career.promotionsThisYear = 0;
    if (st.career.lastPromotionYear == null) st.career.lastPromotionYear = null;
    if (!st.career.lines) st.career.lines = {};
    if (st.career.health == null) {
      // P4b：健康初始 4/5；老存档补字段走这里，绝不随时间衰减。
      st.career.health = num((sim.careerWorld(config || {}).careerHealth || {}).init, 4);
    }
    if (!st.career.bonds) st.career.bonds = { mentor: null, peer: null, junior: null };
    if (!st.career.lineStartRolls) st.career.lineStartRolls = {};
    if (st.career.pendingStoryPromos == null) st.career.pendingStoryPromos = 0;
    if (!st.career.mergedFromIds) st.career.mergedFromIds = [];
    if (st.career.pendingMentorProducer == null) st.career.pendingMentorProducer = null;
    if (st.career.awaitingProducerPitch == null) st.career.awaitingProducerPitch = false;
    if (st.career.producerReleaseBias == null) st.career.producerReleaseBias = 0;
    if (st.career.producerAskCount == null) st.career.producerAskCount = 0;
    if (st.career.priorRoleId == null) st.career.priorRoleId = null;
    if (!st.career.jobTitleId) {
      (function () {
        var def = sim.careerJobTitle(st, config);
        if (def) st.career.jobTitleId = def.id;
      })();
    }
    if (st.career.postLaunch && (!st.career.postLaunch.titleId || num(st.career.postLaunch.monthsLeft, 0) <= 0)) {
      st.career.postLaunch = null;
    }
    if (!st.companyXp) st.companyXp = {};
    if (!st.studioXp) st.studioXp = {};
    if (!st.worldReleased) st.worldReleased = [];
    return st;
  }

  sim.careerPostLaunch = function (st) {
    var pl;
    if (!st || !st.career) return null;
    pl = st.career.postLaunch;
    if (!pl || !pl.titleId || num(pl.monthsLeft, 0) <= 0) return null;
    return pl;
  };

  sim.companyXpBucket = function (st, companyId) {
    if (!st.companyXp) st.companyXp = {};
    if (!st.companyXp[companyId]) st.companyXp[companyId] = { genreXp: {}, gameplayXp: {} };
    return st.companyXp[companyId];
  };

  sim.addCompanyXp = function (st, companyId, genreId, gameplayId, amount) {
    var bucket, amt = num(amount, 0);
    if (!companyId || !amt) return;
    bucket = sim.companyXpBucket(st, companyId);
    if (genreId) bucket.genreXp[genreId] = num(bucket.genreXp[genreId], 0) + amt;
    if (gameplayId) bucket.gameplayXp[gameplayId] = num(bucket.gameplayXp[gameplayId], 0) + amt;
  };

  sim.studioXpBucket = function (st, studioId) {
    if (!st.studioXp) st.studioXp = {};
    if (!studioId) return { genreXp: {}, gameplayXp: {} };
    if (!st.studioXp[studioId]) st.studioXp[studioId] = { genreXp: {}, gameplayXp: {} };
    return st.studioXp[studioId];
  };

  sim.addStudioXp = function (st, studioId, genreId, gameplayId, amount) {
    var bucket, amt = num(amount, 0);
    if (!studioId || !amt) return;
    bucket = sim.studioXpBucket(st, studioId);
    if (genreId) bucket.genreXp[genreId] = num(bucket.genreXp[genreId], 0) + amt;
    if (gameplayId) bucket.gameplayXp[gameplayId] = num(bucket.gameplayXp[gameplayId], 0) + amt;
  };

  sim.companyXpValue = function (st, companyId, kind, id) {
    var bucket = st && st.companyXp && st.companyXp[companyId];
    if (!bucket) return 0;
    if (kind === "gameplay") return num(bucket.gameplayXp && bucket.gameplayXp[id], 0);
    return num(bucket.genreXp && bucket.genreXp[id], 0);
  };

  sim.studioXpValue = function (st, studioId, kind, id) {
    var bucket = st && st.studioXp && st.studioXp[studioId];
    if (!bucket) return 0;
    if (kind === "gameplay") return num(bucket.gameplayXp && bucket.gameplayXp[id], 0);
    return num(bucket.genreXp && bucket.genreXp[id], 0);
  };

  sim.xpTiers = function (config) {
    var world = sim.careerWorld(config);
    var player = world.playerXp || {};
    if (player.tiers && player.tiers.length) return player.tiers;
    return (world.companyXp || {}).tiers || [];
  };

  sim.xpTierFor = function (xp, config) {
    var tiers = sim.xpTiers(config);
    var i, t;
    xp = num(xp, 0);
    for (i = 0; i < tiers.length; i++) {
      t = tiers[i];
      if (xp <= num(t.until, 0)) return t;
    }
    return tiers.length ? tiers[tiers.length - 1] : null;
  };

  sim.playerXpValue = function (st, kind, id) {
    var cr = st && st.career;
    if (!cr || !id) return 0;
    if (kind === "gameplay") return num(cr.gameplayXp && cr.gameplayXp[id], 0);
    return num(cr.genreXp && cr.genreXp[id], 0);
  };

  sim.addPlayerXp = function (st, genreId, gameplayId, amount) {
    var amt = num(amount, 0);
    if (!st || !st.career || !amt) return;
    if (!st.career.genreXp) st.career.genreXp = {};
    if (!st.career.gameplayXp) st.career.gameplayXp = {};
    if (genreId) st.career.genreXp[genreId] = num(st.career.genreXp[genreId], 0) + amt;
    if (gameplayId) st.career.gameplayXp[gameplayId] = num(st.career.gameplayXp[gameplayId], 0) + amt;
  };

  function playerSkillContribMult(st, title, config) {
    var pct = sim.playerProficiencyBonusPct(st, title && title.genreId, title && title.gameplayId, config);
    if (!pct) return 1;
    return 1 + pct * sim.careerTrendSkillMult(st, title, config);
  }

  sim.careerMonthlyContributionByDim = function (st, config) {
    var world = sim.careerWorld(config);
    var player = (world && world.player) || {};
    var prod = world.producerCareer || {};
    var out = { program: 0, design: 0, art: 0, music: 0 };
    var rank = sim.careerJobRank(st && st.career, config);
    var rankM = rankTableVal(jobRankSpec(config).contribMult, rank, 1);
    var title = st && st.career && st.career.titleId ? sim.careerTitle(st.career.titleId, config, st) : null;
    var skillM = playerSkillContribMult(st, title, config);
    var role = sim.careerRole(st && st.career && st.career.roleId, config);
    var main = role && role.stat;
    var stats = (st && st.career && st.career.stats) || {};
    var base, attr, mainM, offM, i, k;
    if (sim.isCareerProducer && sim.isCareerProducer(st)) {
      base = num(prod.monthlyContributionAllDims, 1);
      attr = sim.careerStatFactor(sim.careerMainStat(st, config), config);
      if (prod.monthlyContributionRankScale !== false) {
        base = base * rankM * attr;
      }
      for (i = 0; i < DIMS.length; i++) out[DIMS[i]] = base * skillM;
      return out;
    }
    mainM = player.contribMainMult != null ? num(player.contribMainMult, 1) : 1;
    offM = player.contribOffMult != null ? num(player.contribOffMult, 0) : 0;
    base = num(player.monthlyContribution, 0) * rankM;
    for (i = 0; i < DIMS.length; i++) {
      k = DIMS[i];
      attr = sim.careerStatFactor(num(stats[k], 0), config);
      out[k] = base * attr * (main && k === main ? mainM : offM) * skillM;
    }
    return out;
  };

  sim.careerMonthlyContribution = function (st, config) {
    var by = sim.careerMonthlyContributionByDim(st, config);
    var role = sim.careerRole(st && st.career && st.career.roleId, config);
    if (sim.isCareerProducer && sim.isCareerProducer(st)) return by.program;
    if (role && role.stat) return by[role.stat];
    return by.program;
  };

  // 拼命三郎：连续作战计数 + 每 N 月强制倦怠一次。
  sim.tickCareerGrind = function (st, config, working) {
    var c, every;
    if (!st || !st.career) return;
    c = st.career;
    c.grindStreak = working ? num(c.grindStreak, 0) + 1 : 0;
    c.burnoutMonth = false;
    every = Math.round(sim.careerTraitSum(st, "burnoutEveryMonths", config));
    if (every > 0 && c.grindStreak > 0 && c.grindStreak % every === 0) c.burnoutMonth = true;
  };

  sim.careerGrindMult = function (st, config) {
    var c = st && st.career;
    if (!c) return 1;
    if (c.burnoutMonth) return sim.careerTraitMult(st, "burnoutContributionMult", config, 1);
    if (num(c.grindStreak, 0) >= sim.careerTraitSum(st, "streakThreshold", config)) {
      return sim.careerTraitMult(st, "streakContributionMult", config, 1);
    }
    return 1;
  };

  // mult：外部传入的成长倍率（开发月 = 阶段权重 × 体量阻尼）。0 表示这个月没有实质产出，
  // 四维一律不加；缺省 1（长线运营月与旧调用点）。
  sim.xpTierLabel = function (xp, config) {
    return sim.worldLabel(sim.xpTierFor(xp, config), config) || "";
  };

  // 目录真作不是玩家立项，只吃工作室经验平加；玩家熟练度一概不进 live 底。
  function liveFromTitle(st, title, config) {
    var base, spec, studioId, gxp, pxp, per, bonus, cap, dims, i;
    if (title && title.virtual) return sim.cloneTitleStats(title.stats, config);
    base = sim.catalogTitleBaseStats(title, config);
    spec = sim.careerWorld(config).companyXp || {};
    studioId = (title && title.studioId) || (st.career && st.career.studioId);
    gxp = sim.studioXpValue(st, studioId, "genre", title && title.genreId);
    pxp = sim.studioXpValue(st, studioId, "gameplay", title && title.gameplayId);
    per = spec.statBonusPerXp;
    if (per == null) per = 0;
    bonus = Math.floor(gxp * per) + Math.floor(pxp * per);
    cap = spec.statBonusCap;
    if (cap != null && bonus > cap) bonus = cap;
    dims = sim.titleDims(config);
    for (i = 0; i < dims.length; i++) base[dims[i]] = num(base[dims[i]], 0) + bonus;
    return base;
  }

  sim.careerLiveFromTitle = liveFromTitle;

  function initPlayerXp(role, spec) {
    var genreXp = cloneXpMap(spec && spec.startingGenreXp);
    var gameplayXp = cloneXpMap(spec && spec.startingGameplayXp);
    var byRole = spec && spec.startingByRole && role && spec.startingByRole[role.id];
    if (byRole) {
      mergeXpMap(genreXp, byRole.genreXp);
      mergeXpMap(gameplayXp, byRole.gameplayXp);
    }
    return { genreXp: genreXp, gameplayXp: gameplayXp };
  }

  function startingAbleXpValue(config) {
    var spec = (sim.careerWorld(config).playerXp) || {};
    var tiers;
    if (spec.startingAbleXp != null) return num(spec.startingAbleXp, 0);
    tiers = sim.xpTiers(config);
    if (tiers[0] && tiers[0].until != null) return num(tiers[0].until, 0) + 1;
    return 0;
  }

  function grantStartingAbleSkills(st, config) {
    var spec = (sim.careerWorld(config).playerXp) || {};
    var xp = startingAbleXpValue(config);
    var content = config.content || {};
    function fill(kind, pool, count) {
      var left = (pool || []).filter(function (row) {
        return row && row.id && !sim.playerXpValue(st, kind, row.id);
      });
      var i, hit;
      for (i = 0; i < count && left.length; i++) {
        hit = sim.pick(st, left);
        left = left.filter(function (x) { return x.id !== hit.id; });
        if (kind === "gameplay") sim.addPlayerXp(st, null, hit.id, xp);
        else sim.addPlayerXp(st, hit.id, null, xp);
      }
    }
    if (!xp) return;
    fill("genre", content.genres, num(spec.startingAbleGenreCount, 0));
    fill("gameplay", content.gameplay, num(spec.startingAbleGameplayCount, 0));
  }

  function pickAbleIds(st, pool, count) {
    var left = (pool || []).filter(function (row) { return row && row.id; });
    var out = [];
    var i, hit;
    for (i = 0; i < count && left.length; i++) {
      hit = sim.pick(st, left);
      out.push(hit.id);
      left = left.filter(function (x) { return x.id !== hit.id; });
    }
    return out;
  }

  function applyStartXpIds(st, config, start) {
    var xp = startingAbleXpValue(config);
    var content = config.content || {};
    function inPool(list, id) {
      return (list || []).some(function (row) { return row && row.id === id; });
    }
    (start.genreIds || []).forEach(function (id) {
      if (inPool(content.genres, id)) sim.addPlayerXp(st, id, null, xp);
    });
    (start.gameplayIds || []).forEach(function (id) {
      if (inPool(content.gameplay, id)) sim.addPlayerXp(st, null, id, xp);
    });
  }

  function grantPlayerTitleXp(st, title, amount) {
    if (!title) return;
    sim.addPlayerXp(st, title.genreId, title.gameplayId, amount);
  }

  function seedCompanyXp(st, config) {
    var world = sim.careerWorld(config);
    var spec = world.companyXp || {};
    var now = sim.monthIndex(st.year, st.month);
    (world.titles || []).forEach(function (t) {
      var past = sim.monthIndex(t.releaseYear, t.releaseMonth) < now;
      var amt = past ? num(spec.seedPerPastRelease, 0) : num(spec.seedPerCatalogTitle, 0);
      sim.addCompanyXp(st, t.companyId, t.genreId, t.gameplayId, amt);
      if (t.studioId) sim.addStudioXp(st, t.studioId, t.genreId, t.gameplayId, amt);
    });
  }

  function grantReleaseXp(st, rec, config, player) {
    var spec = sim.careerWorld(config).companyXp || {};
    var amt = rec.virtual ? num(spec.xpPerVirtualRelease, 0) : num(spec.xpPerHistoricalRelease, 0);
    if (player) amt += num(spec.xpPerPlayerCredit, 0);
    sim.addCompanyXp(st, rec.companyId, rec.genreId, rec.gameplayId, amt);
    if (rec.studioId) sim.addStudioXp(st, rec.studioId, rec.genreId, rec.gameplayId, amt);
  }

  function seedWorldReleasedBeforeStart(st, config) {
    var world = sim.careerWorld(config);
    var titles = world.titles || [];
    var now = sim.monthIndex(st.year, st.month);
    titles.forEach(function (t) {
      if (sim.monthIndex(t.releaseYear, t.releaseMonth) < now) {
        pushWorldReleased(st, t, config, false);
      }
    });
  }

  function pushWorldReleased(st, title, config, player) {
    var rec;
    if (!st.worldReleased) st.worldReleased = [];
    rec = {
      id: title.id,
      name: title.name,
      alias: title.alias,
      companyId: title.companyId,
      studioId: title.studioId || null,
      genreId: title.genreId,
      gameplayId: title.gameplayId,
      platforms: title.platforms ? title.platforms.slice() : [],
      platformId: title.platformId || ((title.platforms && title.platforms[0]) || ""),
      releaseYear: title.releaseYear,
      releaseMonth: title.releaseMonth,
      releasedYear: title.releaseYear,
      releasedMonth: title.releaseMonth,
      score: title.score,
      avg: title.score,
      stats: catalogStatsForWorld(st, title, config),
      prestige: title.prestige || 0,
      releaseType: title.releaseType || (sim.isLiveOpsTitle(title) ? "liveops" : "boxed"),
      live: sim.isLiveOpsTitle(title),
      versionName: title.versionName || "",
      player: !!player,
      virtual: !!title.virtual,
      mau: num(title.mau, 0)
    };
    // 长线标记作和盒装走同一条生命周期，所以一样盖 baselineSales/launchSales，
    // 月销量排行与畅销榜才能算出当月销量。
    var packed = sim.careerLaunchSales(title, rec.avg != null ? rec.avg : rec.score, config, rec.stats);
    rec.baselineSales = packed.baselineSales;
    rec.launchSales = packed.launchSales;
    st.worldReleased.push(rec);
    grantReleaseXp(st, rec, config, player);
    return rec;
  }

  function findWorldReleased(st, titleId) {
    var i, list = st.worldReleased || [];
    for (i = 0; i < list.length; i++) if (list[i].id === titleId) return list[i];
    return null;
  }

  sim.rollOpeningOffers = function (st, roleId, config) {
    var world = sim.careerWorld(config);
    var spec = world.openingOffer || {};
    var tiers = spec.tiers || ["small", "stable", "wild"];
    var companies = world.companies || [];
    var role = sim.careerRole(roleId, config) || sim.careerPlayableRoles(config)[0];
    var out = [];
    var i, tier, pool, co, risk, weighted, picked, powerKey;
    if (!role) return out;
    for (i = 0; i < tiers.length; i++) {
      tier = tiers[i];
      pool = companies.filter(function (c) {
        return c.openingOffer && c.starterTier === tier && sim.companyJoinable(c, st.year);
      });
      if (!pool.length) continue;
      weighted = pool.map(function (c) {
        powerKey = c.power != null ? String(c.power) : "2";
        return {
          company: c,
          weight: (spec.weightByPower && spec.weightByPower[powerKey] != null)
            ? spec.weightByPower[powerKey]
            : 1
        };
      });
      picked = sim.pickWeighted(st, weighted);
      co = picked && picked.company;
      if (!co) continue;
      risk = (spec.riskByTier && spec.riskByTier[tier]) || "";
      out.push({
        id: "open-" + tier,
        tier: tier,
        companyId: co.id,
        studioId: sim.defaultStudioId(co),
        roleId: role.id,
        risk: risk
      });
    }
    return out;
  };

  sim.createCareerGame = function (characterName, roleId, config, start) {
    start = start || {};
    var world = sim.careerWorld(config);
    var cal = world.timeline || {};
    var player = world.player || {};
    var copy = sim.careerCopy(config);
    var name = characterName && String(characterName).replace(/^\s+|\s+$/g, "");
    var playable = sim.careerPlayableRoles(config);
    var role = sim.careerRole(roleId, config);
    var st, xp0;
    if (!name) name = copy.defaultName;
    if (!role || PLAYABLE.indexOf(role.id) < 0 || !role.stat) role = playable[0];
    xp0 = initPlayerXp(role, world.playerXp);
    st = {
      saveVersion: (world.save && world.save.version) || 6,
      mode: "career",
      phase: "OFFER",
      rngSeed: (Date.now() % 100000) + 17,
      rngCount: 0,
      year: cal.startYear,
      month: cal.startMonth,
      company: {
        name: name,
        scale: (config.company && config.company.startingScale) || "small",
        fans: player.startingFame || 0,
        adOn: false,
        ownConsole: false
      },
      staff: [],
      studios: [],
      projects: [],
      readyToShip: [],
      released: [],
      series: [],
      talentMarket: [],
      trend: null,
      trendWait: 0,
      firedEventIds: [],
      rivalWait: {},
      rivalSequel: {},
      rivalWindow: [],
      rivalMonth: [],
      rivalReleased: [],
      rivalForceSeries: {},
      rivalPlan: {},
      rivalLifetimeByPlatform: {},
      monthSales: 0,
      monthChart: [],
      lastMedia: null,
      lastAwards: null,
      awardsHistory: [],
      talentStamp: cal.startYear + "-" + cal.startMonth,
      worldReleased: [],
      companyXp: {},
      studioXp: {},
      career: {
        characterName: name,
        roleId: role ? role.id : null,
        companyId: null,
        studioId: null,
        fame: player.startingFame || 0,
        honor: player.startingHonor || 0,
        growthStage: "employee",
        jobRank: (world.jobRanks && world.jobRanks.start) || 1,
        jobTitleId: (sim.careerJobTitleDef(role && role.id, (world.jobRanks && world.jobRanks.start) || 1, config) || {}).id || null,
        jobXp: 0,
        tenures: [],
        monthsInRank: 0,
        promotionsThisYear: 0,
        lastPromotionYear: null,
        titleId: null,
        liveStats: null,
        stats: start.stats ? cloneStats(start.stats) : initPlayerStats(role, player),
        colleagues: [],
        colleaguePool: {},
        credits: [],
        openingOffers: [],
        yearEndOffers: [],
        invites: [],
        firedTitleEvents: [],
        virtualProjects: [],
        virtualDetails: [],
        idleMonths: 0,
        virtualSeq: 0,
        inviteYearStamp: 0,
        invitesRolledThisYear: 0,
        inviteYearHit: false,
        hopFailedYear: null,
        hopNotice: "",
        leftProjectLive: {},
        postLaunch: null,
        genreXp: xp0.genreXp,
        gameplayXp: xp0.gameplayXp,
        offerYear: null,
        lines: {},
        bonds: { mentor: null, peer: null, junior: null },
        lineStartRolls: {},
        lineForkYear: null,
        awaitingProducerPitch: false,
        producerPitchOptions: null,
        producerReleaseBias: 0,
        producerAskCount: 0,
        priorRoleId: null,
        traits: [],
        traitsLocked: false,
        inspirationMonth: false,
        inspirationCount: 0
      }
    };
    if (start.genreIds || start.gameplayIds) applyStartXpIds(st, config, start);
    else grantStartingAbleSkills(st, config);
    if (start.traitIds && start.traitIds.length) {
      st.career.traits = start.traitIds.filter(function (id) {
        var t = sim.traitDef(id, config);
        return t && (t.scope || "staff") === "career";
      });
      st.career.traitsLocked = true;
    }
    st.career.openingOffers = sim.rollOpeningOffers(st, st.career.roleId, config);
    seedCompanyXp(st, config);
    seedWorldReleasedBeforeStart(st, config);
    return st;
  };

  function addCredit(st, titleId, config, joining) {
    var i, list, rec, title, detail, late;
    if (!titleId || !st.career) return null;
    list = st.career.credits || (st.career.credits = []);
    title = sim.careerTitle(titleId, config, st);
    detail = sim.careerTitleDetail(titleId, config, st);
    late = joining && sim.careerTitleIsLate(title, detail, st.year, st.month, config);
    for (i = 0; i < list.length; i++) {
      if (list[i].titleId === titleId) {
        rec = list[i];
        if (rec.leftYear != null && !rec.shipped) {
          rec.leftYear = null;
          rec.leftMonth = null;
          rec.joinYear = st.year;
          rec.joinMonth = st.month;
          rec.jobRank = sim.careerJobRank(st.career, config);
          rec.companyId = st.career.companyId;
          rec.studioId = st.career.studioId || rec.studioId;
          if (joining) rec.signedEligible = !late;
        }
        return rec;
      }
    }
    rec = {
      titleId: titleId,
      companyId: st.career.companyId,
      studioId: st.career.studioId || null,
      roleId: st.career.roleId,
      jobRank: sim.careerJobRank(st.career, config),
      joinYear: st.year,
      joinMonth: st.month,
      leftYear: null,
      leftMonth: null,
      shipped: false,
      supported: false,
      signedEligible: !late,
      virtual: !!(title && title.virtual),
      score: null,
      mainStatDelta: 0,
      awards: []
    };
    list.push(rec);
    return rec;
  }

  function queueIdleGapChoice(st, config, queue, next) {
    var spec = idleGapSpec(config);
    var copy = sim.careerCopy(config);
    var nextDet, eventId, startIdx, startParts;
    if (!st.career) return;
    if (st.career.idleGap && st.career.idleGap.prompted) return;
    nextDet = next ? sim.careerTitleDetail(next.id, config, st) : null;
    // 开工月走 cycleMult 换算（P2c）：空窗到哪天结束以「实际开工月」为准。
    startIdx = next ? sim.titleDevStart(next, nextDet, config) : null;
    startParts = startIdx == null ? null : sim.monthFromIndex(startIdx);
    st.career.idleGap = {
      prompted: true,
      settled: false,
      choiceId: null,
      companyId: st.career.companyId,
      nextTitleId: next && next.id,
      untilYear: startParts ? startParts.year : null,
      untilMonth: startParts ? startParts.month : null
    };
    if (!queue) return;
    eventId = spec.eventId || "idle-gap";
    queue.push({
      type: "event",
      kind: "event",
      presentation: "choice",
      eventId: eventId,
      kicker: spec.kicker || copy.idleHint || "空窗",
      title: spec.title || copy.idleHint || "空窗",
      body: spec.text || "",
      options: (spec.choices || []).map(function (c) {
        return { id: c.id, label: c.label };
      })
    });
  }

  sim.assignCareerProject = function (st, config, queue) {
    var picked, pool, idleMax, cur, det, next, gap, minDev, cand, prodSpec;
    sim.ensureCareerExtras(st);
    if (sim.careerPostLaunch(st)) return st;
    if (!st.career || !st.career.companyId) {
      if (st.career) {
        st.career.titleId = null;
        st.career.liveStats = null;
      }
      return st;
    }
    if (st.career.awaitingProducerPitch) return st;
    if (st.career.titleId) {
      cur = sim.careerTitle(st.career.titleId, config, st);
      if (cur && findWorldReleased(st, cur.id)) {
        persistProjectLive(st, config);
        st.career.titleId = null;
        st.career.liveStats = null;
        st.career.postLaunch = null;
      }
    }
    picked = sim.pickCareerAssignment(st.career.companyId, st.year, st.month, config, st, st.career.studioId);
    // 玩家正在做一部"本公司当年月还在开发"的目录作时，不要因为同公司别部开工（prestige 更高
    // 的 landmark 排前面）就把人静默顶走。只有目录作受保护：池作本来就是填空窗的，按设计
    // 让位给下一档真作（titlePool.comment：发售不得压过下一档真作开工月）。
    if (picked) {
      cur = sim.careerTitle(st.career.titleId, config, st);
      det = sim.careerTitleDetail(st.career.titleId, config, st);
      if (cur && !cur.virtual && cur.id !== picked.id &&
          cur.companyId === st.career.companyId &&
          det && sim.titleCoversMonth(cur, det, st.year, st.month, config) &&
          !findWorldReleased(st, cur.id)) {
        picked = cur;
      }
    }
    // A（节奏修复）：不接「别人快做完了」的候选——宁可等下一部新作开工，也别去给人收尾。
    // 手上那部不算候选（picked.id === titleId 是「继续做」，不是换档）。拒收后由下面的
    // 池作 / 空窗分支兜底：池作天然从当月 0% 开始，空窗则等到下一部目录作开工。
    if (picked && picked.id !== st.career.titleId && deepCandidateRejected(picked, st, config)) {
      picked = null;
    }
    pool = titlePoolSpec(config);
    idleMax = num(pool.idleMaxMonths, 1);
    minDev = poolMinFillMonths(config);
    if (!picked) {
      if (st.career.titleId && sim.careerTitle(st.career.titleId, config, st)) {
        cur = sim.careerTitle(st.career.titleId, config, st);
        det = sim.careerTitleDetail(st.career.titleId, config, st);
        if (cur && det && sim.titleCoversMonth(cur, det, st.year, st.month, config) && !findWorldReleased(st, cur.id)) {
          st.career.waitingForStart = null;
          return st;
        }
      }
      next = sim.nextCatalogTitle(st, config, st.career.companyId, st.career.studioId);
      gap = sim.catalogGapMonths(st, config, st.career.companyId, st.career.studioId);
      // P2-fix：游戏池优先。公司某月排不出目录真作时，直接从池里抽一部顶上——
      // 新入职当月也走这条（R2 入职兜底），不再先站着等 idleMaxMonths。
      if (canStartCareerVirtual(st, config)) {
        cand = sim.poolCandidateAt(st, config, st.career.companyId, st.career.studioId, st.year, st.month);
        if (cand) {
          prodSpec = sim.careerWorld(config).producerCareer || {};
          if (sim.isCareerProducer && sim.isCareerProducer(st) &&
              sim.queueProducerVirtualPitch && prodSpec.canPickVirtualGenreGameplay &&
              num(cand.detail.devMonths, 0) >= num(prodSpec.pitchMinFillMonths, 18)) {
            // 顶的是一段长空窗，让制作人自己挑题材/玩法（等于立项会）；短的直接开，不打扰。
            sim.queueProducerVirtualPitch(st, config, queue);
            return st;
          }
          picked = sim.startPoolProject(st, config);
        }
      }
      if (!picked) {
        // 池不可用，或空窗太短抽不出池作（gap < minDev，开了也会被下一档真作开工月截断）。
        // 短空窗交给推进吸收，静默过月；长空窗、或本公司已排不出下一档（gap == null，
        // 该考虑跳槽了）才弹一次抉择覆盖整段空窗。idleGap 一旦 prompted 就留着，
        // 别在这里清掉，否则每月都会重弹。
        if (gap == null || gap >= minDev) queueIdleGapChoice(st, config, queue, next);
        // 空窗也分两种：公司还有下一部要开工 = 等立项；公司排不出下一部 = 真没活。
        st.career.waitingForStart = next ? waitingForStartOf(st, config, next) : null;
        st.career.titleId = null;
        st.career.liveStats = null;
        return st;
      }
    }
    if (picked) {
      st.career.idleMonths = 0;
      st.career.idleGap = null;
      st.career.waitingForStart = null;
    }
    if (!picked) {
      st.career.titleId = null;
      st.career.liveStats = null;
      return st;
    }
    if (st.career.titleId !== picked.id) {
      st.career.titleId = picked.id;
      st.career.liveStats = liveFromTitle(st, picked, config);
      addCredit(st, picked.id, config, true);
    }
    if (!st.career.liveStats) st.career.liveStats = liveFromTitle(st, picked, config);
    return st;
  };

  function persistProjectLive(st, config) {
    var id = st.career && st.career.titleId;
    var live = st.career && st.career.liveStats;
    var title;
    if (!id || !live) return;
    if (!st.career.leftProjectLive) st.career.leftProjectLive = {};
    st.career.leftProjectLive[id] = sim.cloneTitleStats(live, config);
    title = sim.findById(virtualList(st, "virtualProjects"), id);
    if (title) title.stats = sim.cloneTitleStats(live, config);
  }

  function markCreditLeft(st, titleId) {
    var rec, world;
    if (!titleId || !st.career) return;
    rec = findCredit(st, titleId);
    if (rec && rec.leftYear == null && !rec.shipped) {
      rec.leftYear = st.year;
      rec.leftMonth = st.month;
      rec.shipped = false;
    }
    world = findWorldReleased(st, titleId);
    if (world) world.player = false;
  }

  function detachFromProject(st, config) {
    var id = st.career && st.career.titleId;
    persistProjectLive(st, config);
    if (id) markCreditLeft(st, id);
    st.career.titleId = null;
    st.career.liveStats = null;
    st.career.postLaunch = null;
    st.career.idleGap = null;
  }

  function joinCompany(st, companyId, roleId, titleId, config, studioId, source, offeredRank) {
    var co = sim.careerCompany(companyId, config);
    var studio = sim.careerStudio(companyId, studioId, config);
    var prevRank = sim.careerJobRank(st.career, config);
    var titleDef;
    closeTenure(st);
    if (offeredRank != null && offeredRank > prevRank) {
      st.career.jobRank = clampJobRank(offeredRank, config);
      st.career.monthsInRank = 0;
      st.career.promotionsThisYear = num(st.career.promotionsThisYear, 0) + 1;
      st.career.lastPromotionYear = st.year;
    }
    st.career.companyId = companyId;
    st.career.studioId = (studio && studio.id) || sim.defaultStudioId(co);
    if (roleId) st.career.roleId = roleId;
    if (st.career.roleId === "producer") st.career.growthStage = "producer";
    else st.career.growthStage = "employee";
    titleDef = sim.careerJobTitle(st, config);
    st.career.jobTitleId = titleDef && titleDef.id;
    st.career.yearEndOffers = [];
    st.career.invites = [];
    st.career.hopNotice = "";
    openTenure(st, source || "hop", config);
    if (titleId) {
      st.career.titleId = titleId;
      st.career.liveStats = liveFromTitle(st, sim.careerTitle(titleId, config, st), config);
      addCredit(st, titleId, config, true);
      st.career.idleMonths = 0;
      st.career.idleGap = null;
    } else {
      st.career.titleId = null;
      st.career.liveStats = null;
      // 刚入职不继承上一家的空窗计数：否则进一家"当月没有在研目录作"的公司会当场开出虚拟作。
      st.career.idleMonths = 0;
      st.career.idleGap = null;
      sim.assignCareerProject(st, config);
    }
    sim.ensureCareerColleagues(st, config);
    sim.pinCareerBonds(st, config);
    return st;
  }

  sim.acceptOpeningOffer = function (state, offerId, config) {
    var offer = null;
    var st;
    if (!sim.isCareerMode(state)) return sim.fail(state, sim.ERR.CAREER_NOT_CAREER);
    if (state.phase === "PLAYING" && state.career && state.career.companyId) {
      return sim.fail(state, sim.ERR.CAREER_ALREADY_HIRED);
    }
    (state.career.openingOffers || []).forEach(function (o) {
      if (o.id === offerId) offer = o;
    });
    if (!offer) return sim.fail(state, sim.ERR.CAREER_OFFER_NOT_FOUND);
    st = sim.clone(state);
    sim.ensureCareerExtras(st);
    st.phase = "PLAYING";
    joinCompany(st, offer.companyId, offer.roleId, null, config, offer.studioId, "opening");
    return sim.ok(st);
  };

  sim.careerInDev = function (state, config) {
    var view = sim.careerProjectView(state, config);
    return !!(view && !view.idle);
  };

  sim.canCareerHop = function (state, config) {
    var spec = sim.careerWorld(config).mobility || {};
    if (!state || !state.career) return false;
    if (state.career.hopFailedYear === state.year) return false;
    if (!state.career.companyId) return true;
    if (spec.allowMidProject) return true;
    return !sim.careerInDev(state, config);
  };

  sim.careerProjectView = function (state, config) {
    var title, detail, progress, phase, copy, idleMax, preparing, waiting, pl, plSpec;
    var genreXp, playXp, playerGenreXp, playerPlayXp;
    sim.ensureCareerExtras(state);
    copy = sim.careerCopy(config);
    idleMax = num(titlePoolSpec(config).idleMaxMonths, 1);
    pl = sim.careerPostLaunch(state);
    if (!state || !state.career || !state.career.titleId) {
      preparing = num(state && state.career && state.career.idleMonths, 0) < idleMax;
      // 等下一部新作开工的空窗要跟「组里真没活」分开说：前者是蓄势，后者是凉了。
      waiting = !!(state && state.career && state.career.waitingForStart);
      return {
        title: null,
        phase: null,
        progress: 0,
        idle: true,
        preparing: preparing || waiting,
        waitingForStart: waiting ? state.career.waitingForStart : null,
        postLaunch: false,
        liveStats: null,
        idleLabel: waiting
          ? (copy.waitingHint || copy.preparingHint || copy.idleHint || "筹备")
          : (preparing ? (copy.preparingHint || copy.idleHint || "筹备") : (copy.idleHint || "待命"))
      };
    }
    title = sim.careerTitle(state.career.titleId, config, state);
    detail = sim.careerTitleDetail(state.career.titleId, config, state);
    progress = sim.titleProgress(title, detail, state.year, state.month, config);
    phase = sim.careerPhaseAt(progress, config);
    if (pl) {
      plSpec = sim.careerWorld(config).postLaunch || {};
      phase = plSpec.phase || phase;
      progress = 1;
    }
    genreXp = title ? sim.studioXpValue(state, title.studioId || state.career.studioId, "genre", title.genreId) : 0;
    playXp = title ? sim.studioXpValue(state, title.studioId || state.career.studioId, "gameplay", title.gameplayId) : 0;
    playerGenreXp = title ? sim.playerXpValue(state, "genre", title.genreId) : 0;
    playerPlayXp = title ? sim.playerXpValue(state, "gameplay", title.gameplayId) : 0;
    return {
      title: title,
      detail: detail,
      phase: phase,
      progress: progress,
      idle: false,
      preparing: false,
      waitingForStart: null,
      postLaunch: !!pl,
      monthsLeft: pl ? pl.monthsLeft : 0,
      liveStats: state.career.liveStats,
      genreId: title && title.genreId,
      gameplayId: title && title.gameplayId,
      genreXp: genreXp,
      gameplayXp: playXp,
      genreTier: sim.xpTierLabel(genreXp, config),
      gameplayTier: sim.xpTierLabel(playXp, config),
      playerGenreXp: playerGenreXp,
      playerGameplayXp: playerPlayXp,
      playerGenreTier: sim.xpTierLabel(playerGenreXp, config),
      playerGameplayTier: sim.xpTierLabel(playerPlayXp, config),
      virtual: !!(title && title.virtual)
    };
  };

  sim.careerSkillLines = function (state, config) {
    var spec = (sim.careerWorld(config).playerXp) || {};
    var showTop = num(spec.showTop, 0);
    var lines = [];
    var seen = {};
    var title, list, i, row, k;
    sim.ensureCareerExtras(state);
    function pushKind(kind, id) {
      var label, xpVal, pool;
      if (!id || seen[kind + ":" + id]) return;
      seen[kind + ":" + id] = true;
      pool = kind === "gameplay" ? (config.content && config.content.gameplay) : (config.content && config.content.genres);
      label = sim.contentName(pool, id);
      xpVal = sim.playerXpValue(state, kind, id);
      lines.push({
        kind: kind,
        id: id,
        label: label,
        xp: xpVal,
        tier: sim.xpTierLabel(xpVal, config)
      });
    }
    title = state && state.career && state.career.titleId ? sim.careerTitle(state.career.titleId, config, state) : null;
    if (title) {
      pushKind("genre", title.genreId);
      pushKind("gameplay", title.gameplayId);
    }
    list = [];
    if (state && state.career) {
      for (k in (state.career.genreXp || {})) {
        if (Object.prototype.hasOwnProperty.call(state.career.genreXp, k)) {
          list.push({ kind: "genre", id: k, xp: num(state.career.genreXp[k], 0) });
        }
      }
      for (k in (state.career.gameplayXp || {})) {
        if (Object.prototype.hasOwnProperty.call(state.career.gameplayXp, k)) {
          list.push({ kind: "gameplay", id: k, xp: num(state.career.gameplayXp[k], 0) });
        }
      }
    }
    list.sort(function (a, b) { return b.xp - a.xp; });
    for (i = 0; i < list.length && lines.length < (title ? 2 : 0) + showTop; i++) {
      row = list[i];
      if (!row.xp) continue;
      pushKind(row.kind, row.id);
    }
    return lines;
  };

  sim.careerSkillSheet = function (state, config) {
    var content = (config && config.content) || {};
    function rows(pool, kind) {
      return (pool || []).map(function (item) {
        var xpVal = sim.playerXpValue(state, kind, item.id);
        var tier = sim.xpTierFor(xpVal, config);
        return {
          kind: kind,
          id: item.id,
          label: sim.worldLabel(item, config) || sim.contentName(pool, item.id),
          tier: sim.worldLabel(tier, config) || "",
          tierId: (tier && tier.id) || ""
        };
      });
    }
    return {
      genres: rows(content.genres, "genre"),
      gameplay: rows(content.gameplay, "gameplay")
    };
  };

  sim.shipPlayerTitle = function (st, config, notes, queue) {
    var title = sim.careerTitle(st.career.titleId, config, st);
    var copy = sim.careerCopy(config);
    var avg, pub, rec, label, media;
    if (!title) return;
    label = sim.worldLabel(title, config);
    // pub 是「对外口碑」= 媒体分的抖动中心，只用于生成四家分数，不再直接当作品评分。
    pub = sim.liveToPublicScore(st.career.liveStats, title.score, config, st, title);
    rec = findWorldReleased(st, title.id);
    if (!rec) rec = pushWorldReleased(st, title, config, false);
    rec.stats = sim.cloneTitleStats(st.career.liveStats || title.stats, config);
    rec.liveStats = sim.cloneTitleStats(st.career.liveStats, config);
    rec.genreId = title.genreId;
    rec.gameplayId = title.gameplayId;
    media = scoreCareerMedia(st, pub, config);
    rec.media = media;
    // 作品的评分取四家媒体分的算术平均（media.avg）：玩家唯一看得见的分数就是这四行 + 均分，
    // 榜单 / 奖项 / 销量曲线 / 履历 / 情报条再读别的数就会自相矛盾（2026-09-18 的
    // 「四家都不是 10 分、均分却写 10」就是 rec.avg 存了口碑、面板拿它当均分显示）。
    // 抖动是零和的，所以这个均分仍然≈口碑，只差四舍五入。
    avg = media.avg;
    rec.score = avg;
    rec.avg = avg;
    rec.title = label;
    stampCareerLaunchSales(rec, title, avg, config, rec.liveStats || rec.stats);
    (function markShippedCredit() {
      var cred = addCredit(st, title.id, config) || findCredit(st, title.id);
      if (!cred) {
        rec.player = false;
        return;
      }
      cred.supported = false;
      cred.score = avg;
      cred.leftYear = null;
      cred.leftMonth = null;
      cred.virtual = !!title.virtual;
      if (cred.signedEligible === false) {
        cred.shipped = false;
        rec.player = false;
        return;
      }
      cred.shipped = true;
      rec.player = true;
    })();
    grantMainStatAndXp(st, "release", config, title);
    if (notes) notes.push((copy.shipKicker || "发售") + "《" + label + "》 " + avg);
    if (queue) {
      queue.push({
        type: "media",
        kind: "info",
        kicker: copy.shipKicker || "发售",
        title: label,
        body: "",
        rec: rec
      });
      if (sim.canPromoteCareer(st, config) && ((jobRankSpec(config).promotion || {}).onShip !== false)) {
        (function queuePromo() {
          var view = sim.careerPromotionView(st, config);
          var copyP = copy;
          if (sim.markCareerLineShip) sim.markCareerLineShip(st);
          if (sim.hasActiveExclusiveGroup && sim.hasActiveExclusiveGroup(st, "careerPath", config)) return;
          if (sim.hasPendingCareerLine && sim.hasPendingCareerLine(st)) return;
          if (sim.promotionUsesEventLine && sim.promotionUsesEventLine(st, config)) {
            if (sim.processCareerLines) sim.processCareerLines(st, config, queue, notes);
            return;
          }
          queue.push({
            type: "promotion",
            kind: "event",
            presentation: "choice",
            kicker: copyP.promoteKicker || "内部晋升",
            title: copyP.promoteTitle || "可以升一级",
            body: (view.currentLabel || "") + " → " + (view.nextLabel || "") + "。" + (copyP.promoteHint || ""),
            options: [
              { id: "promote", label: copyP.promoteButton || "申请晋升" },
              { id: "stay", label: copyP.promoteStay || "先不升" }
            ]
          });
        })();
      } else if (sim.markCareerLineShip) {
        sim.markCareerLineShip(st);
      }
    }
    st.lastMedia = rec;
    grantPlayerTitleXp(st, title, num((sim.careerWorld(config).playerXp || {}).xpPerRelease, 0));
    persistProjectLive(st, config);
    (function beginPostLaunch() {
      var spec = sim.careerWorld(config).postLaunch || {};
      var min = num(spec.monthsMin, 0);
      var max = num(spec.monthsMax, 0);
      st.career.postLaunch = null;
      if (min <= 0 && max <= 0) return;
      if (min > max) {
        min = spec.monthsMax;
        max = spec.monthsMin;
      }
      st.career.postLaunch = {
        titleId: title.id,
        monthsLeft: sim.irand(st, min, max)
      };
    })();
  };

  function skillHireSpec(config) {
    return ((sim.careerWorld(config).mobility) || {}).skillHire || {};
  }

  function skillHireWeight(state, config, company, studio, title) {
    var spec = skillHireSpec(config);
    var bonus = sim.careerSkillHireBonus(state, config, company, studio, title);
    var per = spec.offerWeightPerBonus;
    if (per == null) per = 0;
    return Math.max(0.1, 1 + bonus * per);
  }

  // 中期跳槽/挖人去国内厂商（region=cn）的概率提升：仅在年份窗口内对匹配 region 的公司加权。
  function domesticBoostMul(st, co, config) {
    var spec = ((sim.careerWorld(config).mobility) || {}).domesticBoost;
    if (!spec || !co) return 1;
    var region = spec.region || "cn";
    if (co.region !== region) return 1;
    var year = st && st.year;
    if (year == null) return 1;
    if (spec.startYear != null && year < spec.startYear) return 1;
    if (spec.endYear != null && year > spec.endYear) return 1;
    var mul = num(spec.weightMul, 1);
    return mul > 0 ? mul : 1;
  }

  function requireInDevTitle(config, kind) {
    var mob = (sim.careerWorld(config).mobility) || {};
    var spec = mob.requireInDevTitle;
    if (spec === false) return false;
    if (!spec || spec === true || typeof spec !== "object") return true;
    if (spec.all === false) return false;
    if (kind && spec[kind] === false) return false;
    return true;
  }

  function producerOfferUnlocked(st, config) {
    var mob = (sim.careerWorld(config).mobility) || {};
    if (mob.producerOfferRequiresLineDone === false) return true;
    if (sim.hasCompletedBecomeProducerLine) {
      return !!sim.hasCompletedBecomeProducerLine(st, config);
    }
    return false;
  }

  function mobilityRoleWeightTable(config, kind) {
    var mob = (sim.careerWorld(config).mobility) || {};
    if (kind === "hop" && mob.hopRoleWeights) return mob.hopRoleWeights;
    if (mob.inviteRoleWeights) return mob.inviteRoleWeights;
    return mob.hopRoleWeights || {};
  }

  function buildMobilityRolePool(st, config, kind, allowedStaff) {
    var weights = mobilityRoleWeightTable(config, kind);
    var mob = (sim.careerWorld(config).mobility) || {};
    var curRole = st && st.career && st.career.roleId;
    // 当前岗位优先：当前 roleId 权重乘 currentRoleWeightMul，其它岗位乘 otherRoleWeightMul。
    // 这样「现在是程序」时跳槽/挖人主要给程序岗，仍有概率出现其它岗位，职级仍按玩家属性。
    var curMul = num(mob.currentRoleWeightMul, 1);
    var otherMul = num(mob.otherRoleWeightMul, 1);
    var staff = allowedStaff && allowedStaff.length ? allowedStaff : PLAYABLE.slice();
    var pool = [];
    var i, rid, w, mul;
    for (i = 0; i < staff.length; i++) {
      rid = staff[i];
      if (rid === "producer") continue;
      w = weights[rid];
      if (w == null) w = 1;
      mul = (rid === curRole) ? curMul : otherMul;
      w = w * mul;
      if (w > 0) pool.push({ id: rid, weight: w });
    }
    if (producerOfferUnlocked(st, config)) {
      w = weights.producer;
      if (w == null) w = 0.35;
      mul = ("producer" === curRole) ? curMul : otherMul;
      w = w * mul;
      if (w > 0) pool.push({ id: "producer", weight: w });
    }
    return pool;
  }

  function pickMobilityRole(st, config, kind, allowedStaff) {
    var pool = buildMobilityRolePool(st, config, kind, allowedStaff);
    var hit;
    if (!pool.length) return PLAYABLE[0] || "programmer";
    hit = sim.pickWeighted(st, pool);
    return (hit && hit.id) || pool[0].id;
  }

  function fillPaceTemplate(tpl, map) {
    var out = String(tpl || "");
    Object.keys(map || {}).forEach(function (k) {
      out = out.split("{" + k + "}").join(String(map[k]));
    });
    return out;
  }

  function dateLabel(year, month) {
    return year + "." + (month < 10 ? "0" : "") + month;
  }


  // ── 共享基座 sim._（供拆分出去的域文件取用，勿在别处重复定义）──
  sim._ = sim._ || {};
  (function exposeShared() {
    var _ = sim._;
    if (typeof num !== 'undefined') _.num = num;
    if (typeof isArr !== 'undefined') _.isArr = isArr;
    if (typeof cloneStats !== 'undefined') _.cloneStats = cloneStats;
    if (typeof DIMS !== 'undefined') _.DIMS = DIMS;
    if (typeof PLAYABLE !== 'undefined') _.PLAYABLE = PLAYABLE;
    if (typeof clampJobRank !== 'undefined') _.clampJobRank = clampJobRank;
    if (typeof jobRankSpec !== 'undefined') _.jobRankSpec = jobRankSpec;
    if (typeof rankTableVal !== 'undefined') _.rankTableVal = rankTableVal;
    if (typeof mainStatValue !== 'undefined') _.mainStatValue = mainStatValue;
    if (typeof findCredit !== 'undefined') _.findCredit = findCredit;
    if (typeof creditIsSigned !== 'undefined') _.creditIsSigned = creditIsSigned;
    if (typeof cloneXpMap !== 'undefined') _.cloneXpMap = cloneXpMap;
    if (typeof mergeXpMap !== 'undefined') _.mergeXpMap = mergeXpMap;
    if (typeof scoreFromLiveSpec !== 'undefined') _.scoreFromLiveSpec = scoreFromLiveSpec;
    if (typeof idleGapSpec !== 'undefined') _.idleGapSpec = idleGapSpec;
    if (typeof virtualList !== 'undefined') _.virtualList = virtualList;
    if (typeof careerTraits !== 'undefined') _.careerTraits = careerTraits;
    if (typeof findWorldReleased !== 'undefined') _.findWorldReleased = findWorldReleased;
    if (typeof attrRefOf !== 'undefined') _.attrRefOf = attrRefOf;
    if (typeof tableMult !== 'undefined') _.tableMult = tableMult;
    if (typeof requireInDevTitle !== 'undefined') _.requireInDevTitle = requireInDevTitle;
    if (typeof scaleQualityAmount !== 'undefined') _.scaleQualityAmount = scaleQualityAmount;
    if (typeof promotionReq !== 'undefined') _.promotionReq = promotionReq;
    if (typeof promotionGaps !== 'undefined') _.promotionGaps = promotionGaps;
    if (typeof fillPaceTemplate !== 'undefined') _.fillPaceTemplate = fillPaceTemplate;
    if (typeof dateLabel !== 'undefined') _.dateLabel = dateLabel;
    if (typeof applyPromotion !== 'undefined') _.applyPromotion = applyPromotion;
    if (typeof detachFromProject !== 'undefined') _.detachFromProject = detachFromProject;
    if (typeof joinCompany !== 'undefined') _.joinCompany = joinCompany;
    if (typeof closeTenure !== 'undefined') _.closeTenure = closeTenure;
    if (typeof lateJoinSpec !== 'undefined') _.lateJoinSpec = lateJoinSpec;
    if (typeof producerOfferUnlocked !== 'undefined') _.producerOfferUnlocked = producerOfferUnlocked;
    if (typeof domesticBoostMul !== 'undefined') _.domesticBoostMul = domesticBoostMul;
    if (typeof skillHireSpec !== 'undefined') _.skillHireSpec = skillHireSpec;
    if (typeof skillHireWeight !== 'undefined') _.skillHireWeight = skillHireWeight;
    if (typeof pickMobilityRole !== 'undefined') _.pickMobilityRole = pickMobilityRole;
    if (typeof bondHomeCompanyId !== 'undefined') _.bondHomeCompanyId = bondHomeCompanyId;
    if (typeof bondRoleForLine !== 'undefined') _.bondRoleForLine = bondRoleForLine;
    if (typeof peerEpicPool !== 'undefined') _.peerEpicPool = peerEpicPool;
    if (typeof pickReturnInviteTarget !== 'undefined') _.pickReturnInviteTarget = pickReturnInviteTarget;
    if (typeof canStartCareerVirtual !== 'undefined') _.canStartCareerVirtual = canStartCareerVirtual;
    if (typeof virtualMinDevMonths !== 'undefined') _.virtualMinDevMonths = virtualMinDevMonths;
    if (typeof liveFromTitle !== 'undefined') _.liveFromTitle = liveFromTitle;
    if (typeof pushWorldReleased !== 'undefined') _.pushWorldReleased = pushWorldReleased;
    if (typeof grantMainStatAndXp !== 'undefined') _.grantMainStatAndXp = grantMainStatAndXp;
    if (typeof persistProjectLive !== 'undefined') _.persistProjectLive = persistProjectLive;
    if (typeof grantPlayerTitleXp !== 'undefined') _.grantPlayerTitleXp = grantPlayerTitleXp;
  })();

})(typeof globalThis !== "undefined" ? globalThis : this);
