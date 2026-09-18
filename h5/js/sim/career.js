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

  sim.careerJobRank = function (career, config) {
    var cr = careerArg(career);
    var spec = jobRankSpec(config);
    return clampJobRank(cr && cr.jobRank, config) || (spec.start != null ? spec.start : 1);
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
    return (co && co.seniors) || [];
  };

  sim.careerSeniorLabel = function (senior, config) {
    var name, title;
    if (!senior) return "";
    name = sim.worldLabel(senior, config);
    title = senior.title || senior.role || "";
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
    var bits = [];
    var i, lab;
    for (i = 0; i < list.length; i++) {
      lab = sim.careerSeniorLabel(list[i], config);
      if (lab) bits.push(lab);
    }
    if (!bits.length) return "";
    return (copy.seniorLabel || "前辈") + "：" + bits.join("、");
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
    var main, jobXp, creditW, fameHonor, months, need;
    if (!cr) return [{ id: "noCareer", label: "还没有入职" }];
    if (rank >= max) return [];
    if (num(cr.promotionsThisYear, 0) >= maxPer) {
      gaps.push({ id: "year", label: "今年已经升过一级", have: num(cr.promotionsThisYear, 0), need: maxPer });
    }
    if (!req) return gaps;
    main = mainStatValue(st, config);
    jobXp = num(cr.jobXp, 0);
    need = num(req.mainStat, 0);
    if (need && main < need) {
      gaps.push({
        id: "stat",
        label: "主职能力",
        have: main,
        need: need
      });
    }
    need = num(req.mainStatOrJobXp, 0);
    if (need && main < need && jobXp < need) {
      gaps.push({
        id: "main",
        label: "主职维或职级经验",
        have: Math.max(main, jobXp),
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
        else if (g.id === "main") lines.push((copy.gapMain || "主职维/职级经验还差") + " " + Math.ceil(g.need - g.have));
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
    last.endSalary = st.career.salary;
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
      startSalary: cr.salary || 0,
      endSalary: null,
      source: source || "opening"
    });
  }

  function applyPromotion(st, config) {
    var spec = jobRankSpec(config);
    var next = sim.careerJobRank(st.career, config) + 1;
    var co, title;
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
    co = sim.careerCompany(st.career.companyId, config);
    if (co) st.career.salary = sim.careerSalaryFor(co, st.year, config, st.career);
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

  sim.applyCareerPromotion = function (st, config, opts) {
    var spec, max, rank, maxPer, story;
    if (!st || !st.career) return;
    opts = opts || {};
    story = !!(opts.story || opts.sponsored);
    spec = jobRankSpec(config);
    rank = sim.careerJobRank(st.career, config);
    max = spec.max != null ? spec.max : 6;
    if (rank >= max) return;
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
    var co, role, copy;
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
    co = sim.careerCompany(st.career.companyId, config);
    if (co) st.career.salary = sim.careerSalaryFor(co, st.year, config, st.career);
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
    if (preferred && det && sim.titleCoversMonth && sim.titleCoversMonth(preferred, det, st.year, st.month)) {
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

  function companyOrSuccessorMatch(homeId, playerCoId, config) {
    var home;
    if (!homeId || !playerCoId) return false;
    if (homeId === playerCoId) return true;
    home = sim.careerCompany(homeId, config);
    return !!(home && home.successorId && home.successorId === playerCoId);
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

  function noteBondRemoteFlip(st, role, wasColocated, nowColocated, config) {
    var list, i, def, prog;
    if (!wasColocated || nowColocated) return;
    if (!st.career.lines) return;
    list = (sim.eventLineDefs && config) ? sim.eventLineDefs(config) : [];
    for (i = 0; i < list.length; i++) {
      def = list[i];
      if (!def || def.kind !== "bond") continue;
      if (bondRoleForLine(def) !== role) continue;
      prog = st.career.lines[def.id];
      if (prog && prog.status === "active") prog.remotePending = true;
    }
  }

  sim.refreshCareerBondColocation = function (st, config) {
    var b, keys, i, k, bond, home, now, was, playerCo;
    if (!st || !st.career) return st;
    b = st.career.bonds;
    if (!b) return st;
    playerCo = st.career.companyId || null;
    keys = ["mentor", "peer", "junior"];
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      bond = b[k];
      if (!bond) continue;
      home = bondHomeCompanyId(bond);
      was = bond.colocated !== false;
      // bond.departed：剧情已经把这个人判成"离队"（如后辈线 juniorLeave）。
      // 离队是既成事实，不因为玩家还留在原公司就被重算拉回"坐在旁边"。
      now = bond.departed ? false : companyOrSuccessorMatch(home, playerCo, config);
      bond.colocated = now;
      noteBondRemoteFlip(st, k, was, now, config);
    }
    return st;
  };

  function stampBondHome(bond, st) {
    if (!bond || !st || !st.career) return bond;
    if (!bond.homeCompanyId) bond.homeCompanyId = st.career.companyId || bond.companyId || null;
    if (!bond.homeStudioId) bond.homeStudioId = st.career.studioId || null;
    if (bond.companyId == null) bond.companyId = bond.homeCompanyId;
    if (bond.colocated == null) bond.colocated = true;
    if (bond.monthsTogether == null) bond.monthsTogether = 0;
    if (bond.monthsApart == null) bond.monthsApart = 0;
    return bond;
  }

  sim.pinCareerBonds = function (st, config) {
    var co, seniors, senior, pool, mate, i;
    if (!st || !st.career) return st;
    if (!st.career.bonds) st.career.bonds = { mentor: null, peer: null, junior: null };
    co = sim.careerCompany(st.career.companyId, config);
    seniors = sim.careerSeniors(co, config);
    if (!st.career.bonds.mentor) {
      // 公司可无前辈：无前辈时建立“占位导师”（以公司名指代），保证师徒玩法不崩
      senior = seniors[0] || { id: null, name: (co && co.name) || "公司", alias: (co && co.alias) || (co && co.name) || "公司", title: "", departYear: null, successorCompanyId: null, successorSeniorId: null };
      st.career.bonds.mentor = stampBondHome({
        seniorId: senior.id,
        companyId: st.career.companyId,
        name: senior.name,
        alias: senior.alias || senior.name,
        title: senior.title || "",
        departYear: senior.departYear != null ? senior.departYear : null,
        successorCompanyId: senior.successorCompanyId || null,
        successorSeniorId: senior.successorSeniorId || null,
        monthsTogether: 0,
        monthsApart: 0,
        colocated: true
      }, st);
    }
    if (!st.career.bonds.peer) {
      pool = st.career.colleagues || [];
      mate = null;
      for (i = 0; i < pool.length; i++) {
        if (pool[i] && pool[i].roleId !== "producer" && pool[i].roleId !== st.career.roleId) {
          mate = pool[i];
          break;
        }
      }
      if (mate) {
        st.career.bonds.peer = stampBondHome({
          id: mate.id,
          name: mate.n,
          roleId: mate.roleId,
          jobRank: mate.jobRank,
          companyId: st.career.companyId,
          monthsTogether: 0,
          monthsApart: 0,
          colocated: true,
          epicTitleId: null,
          epicCompanyId: null
        }, st);
      }
    }
    if (st.career.bonds.mentor) stampBondHome(st.career.bonds.mentor, st);
    if (st.career.bonds.peer) stampBondHome(st.career.bonds.peer, st);
    if (st.career.bonds.junior) stampBondHome(st.career.bonds.junior, st);
    sim.refreshCareerBondColocation(st, config);
    return st;
  };

  sim.tickCareerBonds = function (st, config) {
    var b, keys, i, k, bond;
    if (!st || !st.career) return;
    if (config) sim.refreshCareerBondColocation(st, config);
    b = st.career.bonds;
    if (!b) return;
    keys = ["mentor", "peer", "junior"];
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      bond = b[k];
      if (!bond) continue;
      if (bond.colocated && st.career.companyId) {
        bond.monthsTogether = num(bond.monthsTogether, 0) +
          Math.max(0, 1 + sim.careerTraitSum(st, "bondTogetherBonus", config));
      } else {
        // bondApartDelta：分离月数增量的通用钩子（-1 即冻结）。当前没有天赋用它——
        // monthsApart 全仓还没有读取点，写进天赋等于白写（见 tests 的 careerTraitsStayOnLiveKeys）。
        bond.monthsApart = num(bond.monthsApart, 0) +
          Math.max(0, 1 + sim.careerTraitSum(st, "bondApartDelta", config));
      }
    }
  };

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

  sim.ensureCareerJuniorBond = function (st, config) {
    var spec = ((sim.careerWorld(config).eventLines) || {}).bonds || {};
    var pool = spec.juniorRevealPool || [];
    var hit, senior;
    if (!st || !st.career) return null;
    if (!st.career.bonds) st.career.bonds = { mentor: null, peer: null, junior: null };
    if (st.career.bonds.junior) return st.career.bonds.junior;
    hit = pool.length ? sim.pick(st, pool) : null;
    senior = hit ? sim.findCareerSeniorById(hit.seniorId, config) : null;
    st.career.bonds.junior = stampBondHome({
      id: "bond-junior",
      aliasThen: spec.juniorAliasThen || "小T",
      aliasNow: senior ? (senior.alias || senior.name) : null,
      revealSeniorId: hit && hit.seniorId,
      revealCompanyId: hit && hit.companyId,
      revealTitleId: hit && hit.titleId,
      monthsTogether: 0,
      monthsApart: 0,
      revealed: false,
      companyId: st.career.companyId || null
    }, st);
    sim.refreshCareerBondColocation(st, config);
    return st.career.bonds.junior;
  };

  sim.revealCareerJunior = function (st, config) {
    var junior, senior;
    if (!st || !st.career) return;
    junior = st.career.bonds && st.career.bonds.junior;
    if (!junior) sim.ensureCareerJuniorBond(st, config);
    junior = st.career.bonds && st.career.bonds.junior;
    if (!junior) return;
    senior = sim.findCareerSeniorById(junior.revealSeniorId, config);
    if (senior) junior.aliasNow = senior.alias || senior.name;
    junior.revealed = true;
  };

  sim.kickOutOfCareerCompany = function (st, config) {
    var copy;
    if (!st || !st.career) return st;
    sim.ensureCareerExtras(st, config);
    detachFromProject(st, config);
    closeTenure(st);
    st.career.companyId = null;
    st.career.studioId = null;
    st.career.salary = 0;
    st.career.colleagues = [];
    st.career.invites = [];
    st.career.yearEndOffers = [];
    copy = sim.careerCopy(config);
    st.career.hopNotice = copy.kickOutNotice || "被请出当前公司，先找下一份工作。";
    sim.refreshCareerBondColocation(st, config);
    return st;
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
        if (!det || !sim.titleCoversMonth(t, det, st.year, st.month)) continue;
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
  sim.hasPeerEpicTarget = function (st, config) {
    return peerEpicPool(st, config).length > 0;
  };

  // 回国线的落点。只有"当月真的在研一部目录作"的公司接得住这名回国的员工：
  // 挂进一家当月空着的公司，玩家过月就被判空窗，一两个月后被自动塞一部虚拟作
  // （"我明明在做暖暖环游世界，过月怎么变成一个没听过的游戏了"）。
  // 小T 所在的那家不成立就返回 null（回国线靠 when.requireInDevTarget 等它成立）。
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

  sim.hasCareerReturnTarget = function (st, config) {
    return !!pickReturnInviteTarget(st, config);
  };

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
    joinCompany(st, companyId, roleId, null, titleId, config, studioId, "invite", null);
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
    joinCompany(st, succId, st.career.roleId, null, null, config, null, "merger", null);
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

  sim.applyCareerPromotePeer = function (st, config) {
    var peer, spec, max, next, pool, k, mate;
    if (!st || !st.career || !st.career.bonds || !st.career.bonds.peer) return st;
    peer = st.career.bonds.peer;
    spec = jobRankSpec(config);
    max = spec.max != null ? spec.max : 6;
    next = num(peer.jobRank, sim.careerJobRank(st.career, config)) + 1;
    if (next > max) next = max;
    peer.jobRank = next;
    mate = null;
    (st.career.colleagues || []).forEach(function (c) {
      if (c && (c.id === peer.id || c.n === peer.name)) mate = c;
    });
    if (mate) mate.jobRank = next;
    pool = st.career.colleaguePool || {};
    for (k in pool) {
      if (!Object.prototype.hasOwnProperty.call(pool, k)) continue;
      (function bump(companyPool) {
        var rid, row;
        if (!companyPool) return;
        for (rid in companyPool) {
          if (!Object.prototype.hasOwnProperty.call(companyPool, rid)) continue;
          row = companyPool[rid];
          if (row && (row.id === peer.id || row.n === peer.name)) row.jobRank = next;
        }
      })(pool[k]);
    }
    return st;
  };

  sim.applyCareerInvitePeer = function (st, config) {
    var peer, pool, row;
    if (!st || !st.career || !st.career.companyId) return st;
    peer = st.career.bonds && st.career.bonds.peer;
    if (!peer) return st;
    peer.homeCompanyId = st.career.companyId;
    peer.companyId = st.career.companyId;
    peer.homeStudioId = st.career.studioId || null;
    peer.colocated = true;
    if (!st.career.colleaguePool) st.career.colleaguePool = {};
    pool = st.career.colleaguePool[st.career.companyId] || {};
    row = {
      id: peer.id || ("col-peer-" + st.career.companyId),
      n: peer.name,
      roleId: peer.roleId || "programmer",
      jobRank: peer.jobRank != null ? peer.jobRank : sim.careerJobRank(st.career, config),
      stats: null
    };
    pool[row.roleId] = row;
    st.career.colleaguePool[st.career.companyId] = pool;
    sim.ensureCareerColleagues(st, config);
    if ((st.career.colleagues || []).every(function (c) { return c.id !== row.id; })) {
      st.career.colleagues.push(row);
    }
    return st;
  };

  sim.applyCareerJuniorLeave = function (st, config) {
    var junior = st && st.career && st.career.bonds && st.career.bonds.junior;
    if (!junior) return st;
    // 必须落一个持久标记：refreshCareerBondColocation 每回合按"老家公司 == 现公司"重算
    // colocated，只设 colocated=false 会在下一回合被拉回 true（人走了又坐回旁边）。
    junior.departed = true;
    junior.colocated = false;
    void config;
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
        startSalary: t.startSalary,
        endSalary: t.endSalary,
        source: t.source
      });
    });
    ((cr && cr.credits) || []).forEach(function (c) {
      var title = sim.careerTitle(c.titleId, config, state);
      var rec = findWorldReleased(state, c.titleId);
      // 履历的「作品总销量」：首发簿记（stampCareerLaunchSales）盖的是 lifetimeSales，
      // 目录作 / 后期加入的作品只有 launchSales，兜底读它；两条都缺（没发售过）就不显示。
      var sales = rec ? num(rec.lifetimeSales != null ? rec.lifetimeSales : rec.launchSales, null) : null;
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
        virtual: !!c.virtual,
        unsigned: !c.shipped,
        score: c.score,
        sales: sales,
        mainStatDelta: c.mainStatDelta,
        awards: c.awards || [],
        statusLabel: c.shipped
          ? (copy.resumeShipped || "署名发售")
          : (copy.resumeUnsigned || "参与过、未署名发售")
      });
    });
    return {
      rank: sim.careerJobRank(cr, config),
      jobTitle: sim.careerJobTitle(state, config),
      jobLabel: sim.careerJobTitleDisplay(state, config),
      tenures: tenures,
      credits: credits
    };
  };

  sim.careerSettlementView = function (state, config) {
    var cr = state && state.career;
    var co = cr ? sim.careerCompany(cr.companyId, config) : null;
    var signed = 0;
    ((cr && cr.credits) || []).forEach(function (c) {
      if (creditIsSigned(c)) signed += 1;
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
      savings: num(cr && cr.savings, 0),
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
    var rankBonus, rk, offAmt, pdims, pi, dk;
    var rec;
    if (!st || !st.career) return;
    phaseMult = num(phaseMult, 1);
    if (kind === "dev") {
      statAmt = num(statGain.perDevMonth, 0);
      xpAmt = num(xpGain.perDevMonth, 0);
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

  function eventFitsRank(ev, rank) {
    if (!ev) return false;
    if (ev.minRank != null && rank < ev.minRank) return false;
    if (ev.maxRank != null && rank > ev.maxRank) return false;
    return true;
  }

  function eventIsNegative(ev) {
    var d;
    if (!ev) return false;
    if (ev.negative) return true;
    d = ev.qualityDelta;
    if (typeof d === "number") return d < 0;
    if (isArr(d)) {
      return d.some(function (x) { return x < 0; });
    }
    return false;
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

  sim.titleCoversMonth = function (title, detail, year, month) {
    var start, end, now;
    if (!title || !detail) return false;
    start = sim.monthIndex(detail.devStartYear, detail.devStartMonth);
    end = sim.monthIndex(title.releaseYear, title.releaseMonth);
    now = sim.monthIndex(year, month);
    return now >= start && now <= end;
  };

  sim.titleProgress = function (title, detail, year, month) {
    var start, end, now, span;
    if (!title || !detail) return 0;
    start = sim.monthIndex(detail.devStartYear, detail.devStartMonth);
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
    progress = sim.titleProgress(title, detail, year, month);
    if (spec.progressMin != null && progress >= spec.progressMin) return true;
    if (spec.remainingMonthsMax != null) {
      end = sim.monthIndex(title.releaseYear, title.releaseMonth);
      remain = end - sim.monthIndex(year, month);
      if (remain <= spec.remainingMonthsMax) return true;
    }
    return false;
  };

  sim.nextCatalogTitle = function (st, config, companyId, studioId) {
    var world = sim.careerWorld(config);
    var titles = world.titles || [];
    var details = world.titleDetails || [];
    var detailMap = {};
    var shipped = st ? shippedSet(st) : {};
    var now = sim.monthIndex(st && st.year, st && st.month);
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
      if (sim.titleCoversMonth(t, d, st.year, st.month)) continue;
      start = sim.monthIndex(d.devStartYear, d.devStartMonth);
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
    start = sim.monthIndex(d.devStartYear, d.devStartMonth);
    return start - sim.monthIndex(st.year, st.month);
  };

  function virtualMinDevMonths(config) {
    var pool = (sim.careerWorld(config).virtualPool) || {};
    var gap = idleGapSpec(config);
    if (pool.devMonthsMin != null) return num(pool.devMonthsMin, 0);
    return num(gap.minDevMonths, 0);
  }

  function canStartCareerVirtual(st, config) {
    var gap, minDev;
    if (!st || !st.career || !st.career.companyId) return false;
    minDev = num(idleGapSpec(config).minDevMonths, virtualMinDevMonths(config));
    gap = sim.catalogGapMonths(st, config, st.career.companyId, st.career.studioId);
    if (gap == null) return true;
    return gap >= minDev;
  }

  function shippedSet(st) {
    var set = {};
    (st.worldReleased || []).forEach(function (g) {
      set[g.id] = true;
    });
    return set;
  }

  sim.titlesInDevAt = function (companyId, year, month, config, st, studioId) {
    var titles = sim.allCareerTitles(config, st);
    var details = (sim.careerWorld(config).titleDetails || []).concat(virtualList(st, "virtualDetails"));
    var detailMap = {};
    var shipped = st ? shippedSet(st) : {};
    details.forEach(function (d) { detailMap[d.id] = d; });
    return titles.filter(function (t) {
      if (companyId && t.companyId !== companyId) return false;
      if (studioId && t.studioId && t.studioId !== studioId) return false;
      if (shipped[t.id]) return false;
      return sim.titleCoversMonth(t, detailMap[t.id], year, month);
    });
  };

  sim.pickCareerAssignment = function (companyId, year, month, config, st, studioId) {
    var list = sim.titlesInDevAt(companyId, year, month, config, st, studioId);
    var landmarks, pool;
    if (!list.length) return null;
    landmarks = list.filter(function (t) { return t.landmark && !t.virtual; });
    pool = landmarks.length ? landmarks : list.filter(function (t) { return !t.virtual; });
    if (!pool.length) pool = list;
    pool = pool.slice().sort(function (a, b) {
      var pd = num(b.prestige, 0) - num(a.prestige, 0);
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

  function salarySpec(config) {
    var eco = (sim.careerWorld(config).personalEconomy) || {};
    return eco.salary || {};
  }

  function salarySteps(config) {
    return salarySpec(config).steps || [];
  }

  function careerArg(career) {
    if (!career) return null;
    return career.career ? career.career : career;
  }

  function stepIndexOf(value, steps) {
    var i, best = 0;
    if (!steps.length) return 0;
    for (i = 0; i < steps.length; i++) {
      if (steps[i] === value) return i;
      if (steps[i] <= value) best = i;
    }
    return best;
  }

  sim.snapCareerSalary = function (raw, config) {
    var spec = salarySpec(config);
    var steps = spec.steps || [];
    var mode = spec.snap || "floor";
    var i, best, dist, d;
    if (!steps.length) return 0;
    if (raw <= steps[0]) return steps[0];
    if (raw >= steps[steps.length - 1]) return steps[steps.length - 1];
    if (mode === "nearest") {
      best = steps[0];
      dist = Math.abs(raw - best);
      for (i = 1; i < steps.length; i++) {
        d = Math.abs(raw - steps[i]);
        if (d < dist) {
          dist = d;
          best = steps[i];
        }
      }
      return best;
    }
    best = steps[0];
    for (i = 0; i < steps.length; i++) {
      if (steps[i] <= raw) best = steps[i];
      else break;
    }
    return best;
  };

  sim.careerSalaryStepUp = function (current, config, n) {
    var spec = salarySpec(config);
    var steps = spec.steps || [];
    var bump = n != null ? n : num(spec.counterSteps, 1);
    var idx;
    if (!steps.length) return current || 0;
    idx = stepIndexOf(current, steps) + bump;
    if (idx < 0) idx = 0;
    if (idx >= steps.length) idx = steps.length - 1;
    return steps[idx];
  };

  sim.careerSalaryFor = function (company, year, config, career) {
    var spec = salarySpec(config);
    var world = sim.careerWorld(config);
    var steps = spec.steps || [];
    var start = (world.timeline && world.timeline.startYear) || year;
    var years = Math.max(0, (year || start) - start);
    var cr = careerArg(career);
    var player = world.player || {};
    var stats = (cr && cr.stats) || player.startingStats || {};
    var role = sim.careerRole(cr && cr.roleId, config);
    var mainKey = (role && role.stat) || "program";
    var mainStat = num(stats[mainKey], 0);
    var avg = 0;
    var n = 0;
    var i, k, skill, inflation, raw, snapped, idx, power, powerShift, mult, multRef, per, multShift, stage, stageBonus, skillMin;
    for (i = 0; i < DIMS.length; i++) {
      k = DIMS[i];
      avg += num(stats[k], 0);
      n += 1;
    }
    avg = n ? avg / n : 0;
    stage = (cr && cr.growthStage) || "employee";
    stageBonus = (spec.stageBonus && spec.stageBonus[stage]) || 0;
    skill = 1
      + (mainStat - num(spec.statRef, 0)) * num(spec.mainStatPer, 0)
      + (avg - num(spec.avgRef, 0)) * num(spec.avgStatPer, 0)
      + num(cr && cr.fame, 0) * num(spec.famePer, 0)
      + num(cr && cr.honor, 0) * num(spec.honorPer, 0)
      + years * num(spec.yearsPer, 0)
      + stageBonus;
    skillMin = spec.skillMin;
    if (skillMin != null && skill < skillMin) skill = skillMin;
    inflation = Math.pow(1 + num(spec.yearInflation, 0), years);
    raw = num(spec.base, 0) * skill * inflation;
    snapped = sim.snapCareerSalary(raw, config);
    idx = stepIndexOf(snapped, steps);
    power = company && company.power != null ? String(company.power) : "2";
    powerShift = (spec.powerShift && spec.powerShift[power]) || 0;
    mult = (company && company.salaryMult != null) ? company.salaryMult : 1;
    multRef = spec.salaryMultRef != null ? spec.salaryMultRef : 1;
    per = spec.salaryMultPerStep;
    multShift = per ? Math.round((mult - multRef) / per) : 0;
    idx = idx + powerShift + multShift;
    if (idx < 0) idx = 0;
    if (idx >= steps.length) idx = steps.length - 1;
    (function applyRankFloor() {
      var floor = rankTableVal(jobRankSpec(config).salaryFloor, sim.careerJobRank(cr, config), 0);
      var floorIdx, i;
      if (!floor || !steps.length) return;
      floorIdx = 0;
      for (i = 0; i < steps.length; i++) {
        if (steps[i] >= floor) {
          floorIdx = i;
          break;
        }
        floorIdx = i;
      }
      if (idx < floorIdx) idx = floorIdx;
    })();
    return steps.length ? steps[idx] : 0;
  };

  sim.careerLivingCost = function (year, config) {
    var world = sim.careerWorld(config);
    var eco = world.personalEconomy || {};
    var start = (world.timeline && world.timeline.startYear) || year;
    var years = Math.max(0, year - start);
    return Math.round((eco.livingCostPerMonth || 0) * Math.pow(1 + (eco.livingCostYearGrowth || 0), years));
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
    return (sim.careerWorld(config).virtualPool || {}).craft || {};
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

  // 新作立项基础分：全员四维各取 virtualPool.teamStatShare（默认 10%）相加后向下取整，
  // 再乘工作室对题材 + 玩法的熟练度加成。玩家个人熟练度不进这里，改走开发月贡献。
  sim.careerCraftLiveStats = function (st, months, teamN, config, genreId, gameplayId) {
    var pool = sim.careerWorld(config).virtualPool || {};
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

  function applyDimDeltas(st, dims, deltas, config) {
    var i, dim, delta;
    if (dims == null) return;
    if (!isArr(dims)) {
      dims = [dims];
      deltas = [deltas];
    }
    if (!isArr(deltas)) deltas = [deltas];
    for (i = 0; i < dims.length; i++) {
      dim = dims[i];
      if (!dim) continue;
      delta = i < deltas.length ? deltas[i] : 0;
      sim.applyCareerLiveDelta(st, dim, delta, config);
    }
  }

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
    if (st.career.virtualSeq == null) st.career.virtualSeq = 0;
    if (st.career.lastPay == null) st.career.lastPay = 0;
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

  function currentSkillTitle(st, config) {
    if (!st || !st.career || !st.career.titleId) return null;
    return sim.careerTitle(st.career.titleId, config, st);
  }

  function skillFxAmounts(fx, config) {
    var spec = (sim.careerWorld(config).playerXp) || {};
    var grant = fx && fx.skillGrant;
    var g = fx && fx.genreXpDelta;
    var p = fx && fx.gameplayXpDelta;
    if (grant === "genre") {
      if (g == null) g = spec.eventGenreXp;
    } else if (grant === "gameplay") {
      if (p == null) p = spec.eventGameplayXp;
    } else if (grant === "both") {
      if (g == null) g = spec.eventSplitXp;
      if (p == null) p = spec.eventSplitXp;
    } else if (grant === "genreFocus") {
      if (g == null) g = spec.eventFocusXp;
    } else if (grant === "playFocus") {
      if (p == null) p = spec.eventFocusXp;
    }
    return { genre: num(g, 0), play: num(p, 0) };
  }

  function applyPlayerSkillFx(st, fx, config, title) {
    var amt;
    if (!fx) return;
    title = title || currentSkillTitle(st, config);
    if (!title) return;
    amt = skillFxAmounts(fx, config);
    if (amt.genre) sim.addPlayerXp(st, title.genreId, null, amt.genre);
    if (amt.play) sim.addPlayerXp(st, null, title.gameplayId, amt.play);
  }

  // 玩家熟练度只作用在开发月贡献上：档位加成乘全部四个维（制作人同样吃）。
  // 顺 / 逆潮流的特性倍率仍只放大「熟练度带来的那部分」。
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
  function applyMonthlyLiveContribution(st, config, mult) {
    var by = sim.careerMonthlyContributionByDim(st, config);
    var m = sim.careerTraitMult(st, "monthContributionMult", config, 1);
    var extra = num(mult, 1);
    var role = sim.careerRole(st && st.career && st.career.roleId, config);
    var mainDim = role && role.stat;
    var mainM = sim.careerTraitMult(st, "mainDimContributionMult", config, 1);
    var offM = sim.careerTraitMult(st, "offDimContributionMult", config, 1);
    var grindM = sim.careerGrindMult(st, config);
    var personGain = {};
    // by 是人物维的产出（主职维倍率已经算在里面），整块过 personToTitle 落到作品维。
    DIMS.forEach(function (dim) {
      personGain[dim] = num(by[dim], 0) * m * extra * grindM * (mainDim && dim === mainDim ? mainM : offM);
    });
    var titleGain = sim.titleStatsFromPerson(personGain, config);
    sim.titleDims(config).forEach(function (dim) {
      if (!titleGain[dim]) return;
      sim.applyCareerLiveDelta(st, dim, titleGain[dim], config);
    });
  }

  function rollInspirationMonth(st, config, notes) {
    var rate, bonus, dim;
    if (!st || !st.career) return;
    rate = sim.careerTraitMult(st, "inspirationRate", config, 0);
    bonus = sim.careerTraitSum(st, "inspirationDimBonus", config);
    if (rate <= 0 || bonus <= 0) return;
    if (sim.rand(st) >= rate) return;
    dim = sim.pick(st, sim.titleDims(config));
    sim.applyCareerLiveDelta(st, dim, bonus, config);
    st.career.inspirationMonth = true;
    st.career.inspirationCount = num(st.career.inspirationCount, 0) + 1;
    notes.push("灵感爆发：" + sim.titleDimLabel(dim, config) + " +" + bonus + "，但这个月学不进东西");
  }

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
        salary: sim.careerSalaryFor(co, st.year, config, st.career),
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
    var eco = world.personalEconomy || {};
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
        funds: eco.startingSavings || 0,
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
        savings: eco.startingSavings || 0,
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
        salary: 0,
        lastPay: 0,
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

  function landmarkMonthBlocked(st, companyId, year, month, config) {
    var spec = sim.careerWorld(config).virtualPool || {};
    var titles, i, t;
    if (spec.landmarkBlockSameMonth === false) return false;
    titles = sim.careerWorld(config).titles || [];
    for (i = 0; i < titles.length; i++) {
      t = titles[i];
      if (t.companyId === companyId && t.landmark && t.releaseYear === year && t.releaseMonth === month) {
        return true;
      }
    }
    return false;
  }

  function usedVirtualNames(st, config) {
    var used = {};
    var world = sim.careerWorld(config);
    var i, t, list;
    function mark(n) {
      if (n) used[String(n)] = true;
    }
    list = (world && world.titles) || [];
    for (i = 0; i < list.length; i++) {
      t = list[i];
      mark(t.name);
      mark(t.alias);
    }
    list = (st && st.career && st.career.virtualProjects) || [];
    for (i = 0; i < list.length; i++) {
      t = list[i];
      mark(t.name);
      mark(t.alias);
    }
    list = (st && st.worldReleased) || [];
    for (i = 0; i < list.length; i++) {
      t = list[i];
      mark(t.name);
      mark(t.alias);
      mark(t.title);
    }
    return used;
  }

  function collectGenreTitles(pool, genreId) {
    var byGenre = (pool && pool.titlesByGenre) || {};
    var out = [];
    var key, i, names;
    if (genreId && byGenre[genreId] && byGenre[genreId].length) {
      return byGenre[genreId].slice();
    }
    for (key in byGenre) {
      if (!Object.prototype.hasOwnProperty.call(byGenre, key)) continue;
      names = byGenre[key] || [];
      for (i = 0; i < names.length; i++) out.push(names[i]);
    }
    return out;
  }

  function pickVirtualTitle(st, genreId, config) {
    var pool = sim.careerWorld(config).virtualPool || {};
    var used = usedVirtualNames(st, config);
    var names = collectGenreTitles(pool, genreId);
    var free = [];
    var i, all, name;
    for (i = 0; i < names.length; i++) {
      if (!used[names[i]]) free.push(names[i]);
    }
    if (!free.length) {
      all = collectGenreTitles(pool, null);
      for (i = 0; i < all.length; i++) {
        if (!used[all[i]]) free.push(all[i]);
      }
    }
    if (free.length) {
      name = sim.pick(st, free);
      return { name: name, alias: name };
    }
    name = (pool.fallbackName || "未名计划") + (st.career && st.career.virtualSeq ? st.career.virtualSeq : 1);
    return { name: name, alias: name };
  }

  function pickWeightedId(st, weights, fallbackList) {
    var hit;
    if (weights && weights.length) {
      hit = sim.pickWeighted(st, weights);
      if (hit) return hit.id || hit;
    }
    if (fallbackList && fallbackList.length) return sim.pick(st, fallbackList).id;
    return null;
  }

  function pickStudioContentId(st, ids, weights, fallbackList) {
    var weighted, i;
    if (ids && ids.length) {
      weighted = [];
      for (i = 0; i < ids.length; i++) weighted.push({ id: ids[i], weight: 3 });
      return pickWeightedId(st, weighted, ids.map(function (id) { return { id: id }; }));
    }
    return pickWeightedId(st, weights, fallbackList);
  }

  sim.startVirtualProject = function (st, config, opts) {
    var world = sim.careerWorld(config);
    var pool = world.virtualPool || {};
    var companyId = st.career && st.career.companyId;
    var studio = sim.careerStudio(companyId, st.career && st.career.studioId, config);
    var studioId = studio && studio.id;
    var content = config.content || {};
    var genreId, gameplayId, months, relY, relM, tries, title, detail, seq, pickedName;
    var base, n, minM, maxM, next, nextDet, nextStart, gap, cap, relIndex;
    opts = opts || {};
    var isProd = !!(sim.isCareerProducer && sim.isCareerProducer(st));
    if (!companyId) return null;
    // 制作人可自定向下虚拟项目（无在制作品时）；职员仍受目录空窗约束。
    if (!sim.isCareerProducer(st) && !canStartCareerVirtual(st, config)) return null;
    sim.ensureCareerExtras(st);
    genreId = opts.genreId || pickStudioContentId(st, studio && studio.genreIds, pool.genreWeights, content.genres);
    gameplayId = opts.gameplayId || pickStudioContentId(st, studio && studio.gameplayIds, pool.gameplayWeights, content.gameplay);
    minM = num(pool.devMonthsMin, virtualMinDevMonths(config));
    maxM = num(pool.devMonthsMax, minM);
    next = sim.nextCatalogTitle(st, config, companyId, studioId);
    nextDet = next ? sim.careerTitleDetail(next.id, config, st) : null;
    nextStart = nextDet ? sim.monthIndex(nextDet.devStartYear, nextDet.devStartMonth) : null;
    if (nextStart != null) {
      gap = nextStart - sim.monthIndex(st.year, st.month);
      cap = Math.min(maxM, gap);
      if (cap < minM) return null;
      maxM = cap;
    }
    if (maxM < minM) return null;
    // devMonthsDelta：只用来拉长「空窗虚拟作」的周期——玩家在研目录作的档期由目录表钉死，
    // 改不到这里。事件选项可以传它；天赋侧已不使用（只影响虚拟作，作代价太弱）。
    months = sim.irand(st, minM, maxM) + Math.round(sim.careerTraitSum(st, "devMonthsDelta", config));
    if (months < 1) months = 1;
    relY = st.year;
    relM = st.month + months;
    while (relM > 12) { relM -= 12; relY += 1; }
    tries = 0;
    while (landmarkMonthBlocked(st, companyId, relY, relM, config) && tries < 12) {
      relIndex = sim.monthIndex(relY, relM) + 1;
      if (nextStart != null && relIndex >= nextStart) break;
      relM += 1;
      if (relM > 12) { relM = 1; relY += 1; }
      months += 1;
      tries += 1;
    }
    relIndex = sim.monthIndex(relY, relM);
    if (nextStart != null && !isProd && relIndex > nextStart) {
      months = nextStart - sim.monthIndex(st.year, st.month);
      if (months < minM) return null;
      relY = st.year;
      relM = st.month + months;
      while (relM > 12) { relM -= 12; relY += 1; }
    }
    st.career.virtualSeq = (st.career.virtualSeq || 0) + 1;
    seq = st.career.virtualSeq;
    pickedName = pickVirtualTitle(st, genreId, config);
    sim.ensureCareerColleagues(st, config);
    n = sim.careerTeamMembers(st, config).length;
    base = sim.careerCraftLiveStats(st, months, n, config, genreId, gameplayId);
    title = {
      id: "virt-" + companyId + "-" + st.year + "-" + st.month + "-" + seq,
      companyId: companyId,
      publisherId: companyId,
      studioId: studioId || null,
      name: pickedName.name,
      alias: pickedName.alias,
      releaseYear: relY,
      releaseMonth: relM,
      score: sim.careerCraftPublicScore(sim.titleQualityMean(base, config), config),
      platforms: ["pc"],
      genreId: genreId,
      gameplayId: gameplayId,
      releaseType: "boxed",
      landmark: false,
      prestige: num(pool.prestige, 2),
      stats: base,
      virtual: true
    };
    detail = {
      id: title.id,
      blurb: "",
      careerNote: "",
      devStartYear: st.year,
      devStartMonth: st.month,
      devMonths: months,
      inviteWindow: {
        startYear: st.year,
        startMonth: st.month,
        endYear: relY,
        endMonth: relM
      },
      inviteRoles: PLAYABLE.slice(),
      inviteMinFame: 0,
      inviteEligible: false,
      teamSize: 5,
      awards: [],
      liveAfterRelease: false,
      virtual: true
    };
    st.career.virtualProjects.push(title);
    st.career.virtualDetails.push(detail);
    return title;
  };

  sim.queueProducerVirtualPitch = function (st, config, queue) {
    var world, content, genres, gameplay, pairs, opts, i, j;
    if (!st || !st.career) return false;
    if (!(sim.isCareerProducer && sim.isCareerProducer(st))) return false;
    if (st.career.titleId) {
      var cur = sim.careerTitle(st.career.titleId, config, st);
      if (cur && !cur.virtual) return false;
    }
    world = sim.careerWorld(config);
    content = config.content || {};
    genres = (content.genres || []).slice();
    gameplay = (content.gameplay || []).slice();
    if (!genres.length || !gameplay.length) return false;
    pairs = [];
    for (i = 0; i < genres.length && pairs.length < 4; i++) {
      for (j = 0; j < gameplay.length && pairs.length < 4; j++) {
        pairs.push({ genre: genres[i], gameplay: gameplay[j] });
      }
    }
    if (!pairs.length) return false;
    opts = pairs.map(function (p, idx) {
      return { id: "pitch-" + idx, genreId: p.genre.id, gameplayId: p.gameplay.id };
    });
    st.career.producerPitchOptions = opts;
    st.career.awaitingProducerPitch = true;
    if (queue) {
      queue.push({
        type: "producerPitch",
        kind: "event",
        id: "producerPitch",
        options: opts,
        kicker: (world.producerCareer && world.producerCareer.pitchKicker) || "制作人企划",
        title: (world.producerCareer && world.producerCareer.pitchTitle) || "下一部作品方向",
        body: ""
      });
    }
    return true;
  };

  sim.resolveProducerPitch = function (st, optId, config) {
    var opts, chosen, title;
    if (!st || !st.career) return { ok: false };
    if (!(sim.isCareerProducer && sim.isCareerProducer(st))) return { ok: false };
    if (!st.career.awaitingProducerPitch) return { ok: false };
    opts = st.career.producerPitchOptions || [];
    chosen = null;
    for (var i = 0; i < opts.length; i++) { if (opts[i].id === optId) { chosen = opts[i]; break; } }
    if (!chosen) return { ok: false };
    title = sim.startVirtualProject(st, config, { genreId: chosen.genreId, gameplayId: chosen.gameplayId });
    if (!title || !title.virtual) return { ok: false };
    st.career.titleId = title.id;
    st.career.liveStats = liveFromTitle(st, title, config);
    st.career.awaitingProducerPitch = false;
    st.career.producerPitchOptions = null;
    st.career.idleMonths = 0;
    return { ok: true, virtual: true, state: st, titleId: title.id };
  };

  function queueIdleGapChoice(st, config, queue, next) {
    var spec = idleGapSpec(config);
    var copy = sim.careerCopy(config);
    var nextDet, eventId;
    if (!st.career) return;
    if (st.career.idleGap && st.career.idleGap.prompted) return;
    nextDet = next ? sim.careerTitleDetail(next.id, config, st) : null;
    st.career.idleGap = {
      prompted: true,
      settled: false,
      choiceId: null,
      companyId: st.career.companyId,
      nextTitleId: next && next.id,
      untilYear: nextDet && nextDet.devStartYear,
      untilMonth: nextDet && nextDet.devStartMonth
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

  function applyIdleGapChoice(st, opt, config) {
    var role, main, i, k, nextTitle, gap;
    if (!st.career || !opt) return;
    if (!st.career.stats) st.career.stats = cloneStats();
    role = sim.careerRole(st.career.roleId, config);
    main = role && role.stat;
    if (opt.stats) {
      for (k in opt.stats) {
        if (Object.prototype.hasOwnProperty.call(opt.stats, k)) {
          st.career.stats[k] = num(st.career.stats[k], 0) + num(opt.stats[k], 0);
        }
      }
    }
    if (opt.mainStatDelta && main) {
      st.career.stats[main] = num(st.career.stats[main], 0) + num(opt.mainStatDelta, 0);
    }
    if (opt.offStatDelta) {
      for (i = 0; i < DIMS.length; i++) {
        k = DIMS[i];
        if (k !== main) st.career.stats[k] = num(st.career.stats[k], 0) + num(opt.offStatDelta, 0);
      }
    }
    if (opt.jobXpDelta) st.career.jobXp = num(st.career.jobXp, 0) + num(opt.jobXpDelta, 0);
    gap = st.career.idleGap || {};
    nextTitle = gap.nextTitleId ? sim.careerTitle(gap.nextTitleId, config, st) : sim.nextCatalogTitle(st, config, st.career.companyId, st.career.studioId);
    applyPlayerSkillFx(st, opt, config, nextTitle);
  }

  sim.assignCareerProject = function (st, config, queue) {
    var picked, pool, idleMax, cur, det, next, gap, minDev;
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
    // 的 landmark 排前面）就把人静默顶走。只有目录作受保护：虚拟作本来就是填空窗的，按设计
    // 让位给下一档真作（virtualPool.comment：发售不得压过下一档真作开工月）。
    if (picked) {
      cur = sim.careerTitle(st.career.titleId, config, st);
      det = sim.careerTitleDetail(st.career.titleId, config, st);
      if (cur && !cur.virtual && cur.id !== picked.id &&
          cur.companyId === st.career.companyId &&
          det && sim.titleCoversMonth(cur, det, st.year, st.month) &&
          !findWorldReleased(st, cur.id)) {
        picked = cur;
      }
    }
    pool = sim.careerWorld(config).virtualPool || {};
    idleMax = num(pool.idleMaxMonths, 1);
    minDev = num(idleGapSpec(config).minDevMonths, virtualMinDevMonths(config));
    if (!picked) {
      if (st.career.titleId && sim.careerTitle(st.career.titleId, config, st)) {
        cur = sim.careerTitle(st.career.titleId, config, st);
        det = sim.careerTitleDetail(st.career.titleId, config, st);
        if (cur && det && sim.titleCoversMonth(cur, det, st.year, st.month) && !findWorldReleased(st, cur.id)) {
          return st;
        }
      }
      next = sim.nextCatalogTitle(st, config, st.career.companyId, st.career.studioId);
      gap = sim.catalogGapMonths(st, config, st.career.companyId, st.career.studioId);
      if (next && gap != null && gap < minDev) {
        queueIdleGapChoice(st, config, queue, next);
        st.career.titleId = null;
        st.career.liveStats = null;
        return st;
      }
      if (st.career.idleGap) st.career.idleGap = null;
      if (num(st.career.idleMonths, 0) >= idleMax) {
        if (sim.isCareerProducer && sim.isCareerProducer(st) &&
            sim.queueProducerVirtualPitch &&
            ((sim.careerWorld(config).producerCareer) || {}).canPickVirtualGenreGameplay &&
            canStartCareerVirtual(st, config)) {
          sim.queueProducerVirtualPitch(st, config, queue);
          return st;
        }
        picked = sim.startVirtualProject(st, config);
      } else {
        st.career.titleId = null;
        st.career.liveStats = null;
        return st;
      }
    }
    if (picked) {
      st.career.idleMonths = 0;
      st.career.idleGap = null;
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

  function colleagueBand(config, power) {
    var spec = (sim.careerWorld(config).colleagues) || {};
    var by = spec.byPower || {};
    var key = power != null ? String(power) : "2";
    return by[key] || by["2"] || {};
  }

  function colleaguePoolStale(pool) {
    var k;
    if (!pool) return true;
    for (k in pool) {
      if (Object.prototype.hasOwnProperty.call(pool, k)) {
        if (!pool[k] || pool[k].jobRank == null || !pool[k].stats) return true;
      }
    }
    return false;
  }

  function makeColleagueStats(st, roleId, band, config) {
    var q = (sim.careerWorld(config).quality) || {};
    var role = sim.careerRole(roleId, config);
    var dim = role && role.stat;
    var stats = cloneStats();
    var i, k, bonusMin, bonusMax, cap;
    var min = num(band.statMin, 0);
    var max = num(band.statMax, min);
    if (min > max) {
      cap = min;
      min = max;
      max = cap;
    }
    cap = q.statMax;
    for (i = 0; i < DIMS.length; i++) {
      k = DIMS[i];
      stats[k] = sim.irand(st, min, max);
    }
    if (dim) {
      bonusMin = num(band.specialtyBonusMin, 0);
      bonusMax = num(band.specialtyBonusMax, bonusMin);
      if (bonusMin > bonusMax) {
        k = bonusMin;
        bonusMin = bonusMax;
        bonusMax = k;
      }
      stats[dim] = num(stats[dim], 0) + sim.irand(st, bonusMin, bonusMax);
    }
    for (i = 0; i < DIMS.length; i++) {
      k = DIMS[i];
      if (stats[k] < 0) stats[k] = 0;
      if (cap != null && stats[k] > cap) stats[k] = cap;
    }
    return stats;
  }

  function makeColleagueRank(st, roleId, band, config) {
    var isProd = roleId === "producer";
    var min = isProd ? num(band.producerRankMin, band.specialistRankMin) : num(band.specialistRankMin, 1);
    var max = isProd ? num(band.producerRankMax, band.specialistRankMax) : num(band.specialistRankMax, min);
    if (min > max) {
      var tmp = min;
      min = max;
      max = tmp;
    }
    return clampJobRank(sim.irand(st, min, max), config);
  }

  sim.ensureCareerColleagues = function (st, config) {
    var names = (config.copy && config.copy.staffNamePool) || ["同事"];
    var companyId = st.career && st.career.companyId;
    var roleIds = ["producer", "programmer", "art", "design", "music"];
    var pool, co, band, i, rid, stats, mate;
    if (!st.career || !companyId) {
      if (st.career) st.career.colleagues = [];
      return st;
    }
    if (!st.career.colleaguePool) st.career.colleaguePool = {};
    pool = st.career.colleaguePool[companyId];
    co = sim.careerCompany(companyId, config);
    band = colleagueBand(config, co && co.power);
    if (colleaguePoolStale(pool)) {
      pool = {};
      for (i = 0; i < roleIds.length; i++) {
        rid = roleIds[i];
        stats = makeColleagueStats(st, rid, band, config);
        pool[rid] = {
          id: "col-" + companyId + "-" + rid,
          n: sim.pick(st, names),
          roleId: rid,
          jobRank: makeColleagueRank(st, rid, band, config),
          stats: stats
        };
      }
      st.career.colleaguePool[companyId] = pool;
    }
    st.career.colleagues = [];
    for (i = 0; i < roleIds.length; i++) {
      rid = roleIds[i];
      if (rid === st.career.roleId) continue;
      mate = pool[rid];
      if (mate) st.career.colleagues.push(mate);
    }
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

  function joinCompany(st, companyId, roleId, salary, titleId, config, studioId, source, offeredRank) {
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
    st.career.salary = salary != null ? salary : sim.careerSalaryFor(co, st.year, config, st.career);
    if (offeredRank != null && offeredRank > prevRank) {
      st.career.salary = sim.careerSalaryFor(co, st.year, config, st.career);
    }
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
    joinCompany(st, offer.companyId, offer.roleId, offer.salary, null, config, offer.studioId, "opening");
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
    var title, detail, progress, phase, copy, idleMax, preparing, pl, plSpec;
    var genreXp, playXp, playerGenreXp, playerPlayXp;
    sim.ensureCareerExtras(state);
    copy = sim.careerCopy(config);
    idleMax = num((sim.careerWorld(config).virtualPool || {}).idleMaxMonths, 1);
    pl = sim.careerPostLaunch(state);
    if (!state || !state.career || !state.career.titleId) {
      preparing = num(state && state.career && state.career.idleMonths, 0) < idleMax;
      return {
        title: null,
        phase: null,
        progress: 0,
        idle: true,
        preparing: preparing,
        postLaunch: false,
        liveStats: null,
        idleLabel: preparing ? (copy.preparingHint || copy.idleHint || "筹备") : (copy.idleHint || "待命")
      };
    }
    title = sim.careerTitle(state.career.titleId, config, state);
    detail = sim.careerTitleDetail(state.career.titleId, config, state);
    progress = sim.titleProgress(title, detail, state.year, state.month);
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

  function currentPhase(st, config) {
    var view = sim.careerProjectView(st, config);
    return view.phase;
  }

  sim.findCareerEventDef = function (config, eventId) {
    var world = sim.careerWorld(config);
    var list = ((world.devEvents) || {}).list || [];
    var hit = sim.findById(list, eventId);
    var parts, lineDef, beats, i, gap;
    gap = idleGapSpec(config);
    if (eventId && gap && (eventId === (gap.eventId || "idle-gap"))) {
      return {
        id: eventId,
        presentation: "choice",
        choices: gap.choices || [],
        displayName: gap.title,
        text: gap.text,
        idleGap: true
      };
    }
    if (hit) return hit;
    hit = sim.findById(((world.postLaunch) || {}).events || [], eventId);
    if (hit) return hit;
    hit = sim.findById(((world.producerEvents) || {}).list || [], eventId);
    if (hit) return hit;
    if (eventId && String(eventId).indexOf("line:") === 0) {
      parts = String(eventId).split(":");
      lineDef = sim.findEventLineDef && sim.findEventLineDef(config, parts[1]);
      beats = (lineDef && lineDef.beats) || [];
      for (i = 0; i < beats.length; i++) {
        if (beats[i].id === parts[2]) {
          return {
            id: eventId,
            lineId: parts[1],
            beatId: parts[2],
            presentation: beats[i].presentation || "notice",
            choices: beats[i].options || [],
            displayName: beats[i].title,
            text: beats[i].body,
            careerLine: true
          };
        }
      }
    }
    return null;
  };

  function applyQualityDimsMap(st, dimsMap, config, unscaled) {
    var k, scaled;
    if (!dimsMap) return;
    scaled = scaleQualityAmount(st, dimsMap, config, unscaled);
    for (k in scaled) {
      if (Object.prototype.hasOwnProperty.call(scaled, k)) {
        sim.applyCareerLiveDelta(st, k, scaled[k], config);
      }
    }
  }

  function applyProducerEventSideEffects(st, opt, config, unscaled) {
    var title, detail, detList, i;
    if (!opt) return;
    applyQualityDimsMap(st, opt.qualityDims, config, unscaled);
    if (opt.qualityDim) applyDimDeltas(st, opt.qualityDim, scaleQualityAmount(st, opt.qualityDelta, config, unscaled), config);
    if (opt.devMonthsDelta && st.career && st.career.titleId) {
      title = sim.careerTitle(st.career.titleId, config, st);
      detail = sim.careerTitleDetail(st.career.titleId, config, st);
      if (title && title.virtual && detail) {
        detail.devMonths = num(detail.devMonths, 0) + num(opt.devMonthsDelta, 0);
        if (detail.devMonths < 1) detail.devMonths = 1;
        (function shiftRelease() {
          var y = detail.devStartYear;
          var m = detail.devStartMonth + detail.devMonths;
          while (m > 12) { m -= 12; y += 1; }
          title.releaseYear = y;
          title.releaseMonth = m;
          if (detail.inviteWindow) {
            detail.inviteWindow.endYear = y;
            detail.inviteWindow.endMonth = m;
          }
        })();
      }
    }
    if (opt.releaseBiasDelta) {
      st.career.producerReleaseBias = num(st.career.producerReleaseBias, 0) + num(opt.releaseBiasDelta, 0);
    }
    if (opt.virtualGenreId || opt.virtualGameplayId || opt.virtualName) {
      title = sim.careerTitle(st.career.titleId, config, st);
      if (title && title.virtual) {
        if (opt.virtualGenreId) title.genreId = opt.virtualGenreId;
        if (opt.virtualGameplayId) title.gameplayId = opt.virtualGameplayId;
        if (opt.virtualName) {
          title.name = opt.virtualName;
          title.alias = opt.virtualName;
        }
      }
    }
    void detList; void i;
  }

  function devEventCadence(spec, world) {
    var base = (world && world.devEvents) || {};
    spec = spec || {};
    return {
      chance: spec.chance != null ? spec.chance : base.chance,
      minGapMonths: spec.minGapMonths != null ? spec.minGapMonths : num(base.minGapMonths, 0),
      pityMonths: spec.pityMonths != null ? spec.pityMonths : base.pityMonths,
      maxPerYear: spec.maxPerYear != null ? spec.maxPerYear : base.maxPerYear
    };
  }

  function monthsSinceLastDevEvent(st) {
    var last = st.career && st.career.lastDevEventYm;
    if (last == null) return 9999;
    return sim.monthIndex(st.year, st.month) - last;
  }

  function devEventsThisYear(st) {
    if (!st.career) return 0;
    if (st.career.devEventYear !== st.year) return 0;
    return num(st.career.devEventsThisYear, 0);
  }

  function stampCareerDevEvent(st) {
    if (!st || !st.career) return;
    st.career.lastDevEventYm = sim.monthIndex(st.year, st.month);
    if (st.career.devEventYear !== st.year) {
      st.career.devEventYear = st.year;
      st.career.devEventsThisYear = 0;
    }
    st.career.devEventsThisYear = num(st.career.devEventsThisYear, 0) + 1;
  }

  function cadenceAllowsDevEvent(st, cadence) {
    var gap, count, maxY, minGap, pity;
    if (!st || !st.career || !cadence) return { ok: false, pity: false };
    gap = monthsSinceLastDevEvent(st);
    count = devEventsThisYear(st);
    maxY = cadence.maxPerYear;
    minGap = num(cadence.minGapMonths, 0);
    pity = cadence.pityMonths;
    if (maxY != null && count >= maxY) return { ok: false, pity: false };
    if (pity != null && pity > 0 && gap >= pity) return { ok: true, pity: true };
    if (minGap && gap < minGap) return { ok: false, pity: false };
    return { ok: true, pity: false };
  }

  sim.rollCareerDevEvent = function (st, config, notes) {
    var world = sim.careerWorld(config);
    var isProd = sim.isCareerProducer && sim.isCareerProducer(st);
    var spec = isProd ? (world.producerEvents || {}) : (world.devEvents || {});
    var cadence = devEventCadence(spec, world);
    var chance = cadence.chance;
    var allow;
    var phase = currentPhase(st, config);
    var list = spec.list || [];
    var pool = [];
    var i, ev, w, hit, fired;
    if (!st.career || !st.career.titleId || !st.career.liveStats) return null;
    if (sim.careerPostLaunch(st)) return null;
    allow = cadenceAllowsDevEvent(st, cadence);
    if (!allow.ok) return null;
    if (!allow.pity && (chance == null || sim.rand(st) >= chance)) return null;
    fired = st.career.firedTitleEvents || [];
    for (i = 0; i < list.length; i++) {
      ev = list[i];
      if (ev.titleId && ev.titleId !== st.career.titleId) continue;
      if (ev.titleId && fired.indexOf(ev.id) >= 0) continue;
      if (!isProd && ev.role && ev.role !== st.career.roleId) continue;
      if (!isProd && !eventFitsRank(ev, sim.careerJobRank(st.career, config))) continue;
      if (ev.phase && (!phase || ev.phase !== phase.id)) continue;
      if ((ev.presentation || "notice") === "choice") {
        if (!ev.choices || !ev.choices.length) continue;
      } else if (!ev.qualityDim && !ev.qualityDims && !ev.skillGrant && ev.genreXpDelta == null && ev.gameplayXpDelta == null) {
        continue;
      }
      w = ev.weight != null ? ev.weight : 1;
      if (ev.titleId && ev.titleId === st.career.titleId) w += (world.devEvents || {}).titleWeightBonus || 0;
      if (!isProd) {
        w *= rankTableVal(jobRankSpec(config).negativeWeightByRank, sim.careerJobRank(st.career, config), 1) && eventIsNegative(ev)
          ? rankTableVal(jobRankSpec(config).negativeWeightByRank, sim.careerJobRank(st.career, config), 1)
          : 1;
      }
      pool.push({ ev: ev, weight: w });
    }
    if (!pool.length) return null;
    hit = sim.pickWeighted(st, pool);
    if (!hit || !hit.ev) return null;
    ev = hit.ev;
    stampCareerDevEvent(st);
    if ((ev.presentation || "notice") !== "choice") {
      if (ev.qualityDims) applyQualityDimsMap(st, ev.qualityDims, config, !!ev.titleId);
      else if (ev.qualityDim) applyDimDeltas(st, ev.qualityDim, scaleQualityAmount(st, ev.qualityDelta, config, !!ev.titleId), config);
      applyPlayerSkillFx(st, ev, config);
    }
    if (ev.titleId) {
      if (!st.career.firedTitleEvents) st.career.firedTitleEvents = [];
      st.career.firedTitleEvents.push(ev.id);
    }
    if (notes) notes.push(ev.displayName);
    return ev;
  };

  sim.rollPostLaunchEvent = function (st, config, notes) {
    var spec = sim.careerWorld(config).postLaunch || {};
    var chance = spec.eventChance;
    var list = spec.events || [];
    var pool = [];
    var i, ev, hit, rec;
    if (!sim.careerPostLaunch(st) || !st.career.liveStats) return null;
    if (!list.length) return null;
    if (chance == null || sim.rand(st) >= chance) return null;
    for (i = 0; i < list.length; i++) {
      ev = list[i];
      if (ev.role && ev.role !== st.career.roleId) continue;
      if (!eventFitsRank(ev, sim.careerJobRank(st.career, config))) continue;
      if ((ev.presentation || "notice") === "choice") {
        if (!ev.choices || !ev.choices.length) continue;
      }
      pool.push({ ev: ev, weight: ev.weight != null ? ev.weight : 1 });
    }
    if (!pool.length) return null;
    hit = sim.pickWeighted(st, pool);
    if (!hit || !hit.ev) return null;
    ev = hit.ev;
    if ((ev.presentation || "notice") !== "choice" && (ev.qualityDim || ev.skillGrant || ev.genreXpDelta || ev.gameplayXpDelta)) {
      if (ev.qualityDim) {
        applyDimDeltas(st, ev.qualityDim, scaleQualityAmount(st, ev.qualityDelta, config, !!ev.titleId), config);
      }
      applyPlayerSkillFx(st, ev, config);
      rec = findWorldReleased(st, st.career.titleId);
      if (rec) rec.stats = sim.cloneTitleStats(st.career.liveStats, config);
    }
    if (notes) notes.push(ev.displayName);
    return ev;
  };

  function careerEventQueueItem(ev, copy) {
    var pres = ev.presentation || "notice";
    return {
      type: "event",
      kind: "event",
      presentation: pres,
      eventId: ev.id,
      kicker: copy.eventKicker || "开发事件",
      title: ev.displayName,
      body: ev.text || ev.displayName,
      options: pres === "choice" ? (ev.choices || []).map(function (c) {
        return { id: c.id, label: c.label };
      }) : null
    };
  }

  sim.resolveCareerEventChoice = function (state, eventId, optionId, config) {
    var ev, opt, st, parts;
    if (eventId && String(eventId).indexOf("line-fork:") === 0) {
      return sim.resolveCareerPathFork(state, optionId, config);
    }
    if (eventId === "producer-pitch") {
      return sim.resolveProducerPitch(state, optionId, config);
    }
    if (eventId && String(eventId).indexOf("line:") === 0) {
      parts = String(eventId).split(":");
      return sim.resolveCareerLineChoice(state, parts[1], parts[2], optionId, config);
    }
    ev = sim.findCareerEventDef(config, eventId);
    opt = null;
    if (!ev) return sim.fail(state, sim.ERR.EVENT_NOT_FOUND);
    if ((ev.presentation || "notice") !== "choice") return sim.fail(state, sim.ERR.EVENT_NOT_CHOICE);
    if (ev.careerLine) {
      return sim.resolveCareerLineChoice(state, ev.lineId, ev.beatId, optionId, config);
    }
    (ev.choices || []).forEach(function (c) {
      if (c.id === optionId) opt = c;
    });
    if (!opt) return sim.fail(state, sim.ERR.EVENT_OPTION_INVALID);
    st = sim.clone(state);
    if (ev.idleGap) {
      if (st.career && st.career.idleGap && st.career.idleGap.settled) {
        return { ok: true, state: st, optionId: optionId };
      }
      applyIdleGapChoice(st, opt, config);
      if (st.career) {
        if (!st.career.idleGap) st.career.idleGap = { prompted: true };
        st.career.idleGap.settled = true;
        st.career.idleGap.choiceId = optionId;
      }
      return { ok: true, state: st, optionId: optionId };
    }
    if (opt.qualityDims || opt.devMonthsDelta != null || opt.releaseBiasDelta != null ||
        opt.virtualGenreId || opt.virtualGameplayId || opt.virtualName) {
      applyProducerEventSideEffects(st, opt, config, !!ev.titleId);
    } else {
      applyDimDeltas(st, opt.qualityDim, scaleQualityAmount(st, opt.qualityDelta, config, !!ev.titleId), config);
    }
    applyPlayerSkillFx(st, opt, config);
    return { ok: true, state: st, optionId: optionId };
  };

  function careerAwardCandidate(g, config) {
    var stats = sim.cloneTitleStats(g && g.stats, config);
    var score = g.score != null ? g.score : num(g.avg, 0);
    var out = {
      player: !!g.player,
      titleId: g.id,
      title: sim.worldLabel(g, config),
      label: sim.worldLabel(g, config),
      avg: score,
      score: score,
      qsum: sim.titleQualitySum(stats, config),
      stats: stats,
      prestige: num(g.prestige, 0),
      live: sim.isLiveOpsTitle(g),
      releaseType: g.releaseType,
      // 销量口径统一走 launchSales：worldReleased 上记的是首月实销，没有 sales 字段。
      // 之前只读 g.sales，候选的销量恒为 undefined，导致「玩家之选」回退到 prestige——
      // 奖项名不副实。
      sales: num(g.launchSales != null ? g.launchSales : g.sales, 0)
    };
    // 顶层再摊开一份作品维，供 readAwardStat 的 title[dim] 回退读取。
    sim.titleDims(config).forEach(function (d) { out[d] = num(stats[d], 0); });
    return out;
  }

  // ── TGA 评分子 ──────────────────────────────────────────────────────────
  // 归一化三部分（口碑 / 质量 / 商业，都是 0-100）才能加权比较。
  function awardScoreParts(c, config) {
    var spec = (config.awards && config.awards.score) || {};
    var dims = sim.titleDims(config).length || 4;
    var salesRef = num(spec.salesRef, 0);
    var salesCap = num(spec.salesScoreCap, 100);
    var sales = num(c.sales, 0);
    var salesPart = 0;
    if (sales > 0 && salesRef > 0) {
      salesPart = num(spec.salesLogScale, 0) * Math.log(1 + sales / salesRef) / Math.LN10;
      if (salesPart > salesCap) salesPart = salesCap;
    }
    return {
      score: Math.max(0, Math.min(100, num(c.score, 0) * 10)),
      quality: Math.max(0, Math.min(100, num(c.qsum, 0) / dims)),
      sales: Math.max(0, salesPart)
    };
  }

  function awardWeightsFor(a, config) {
    var spec = (config.awards && config.awards.score) || {};
    var weights = spec.weights || {};
    return (a && a.id && weights[a.id]) || weights.default || { score: 0.5, quality: 0.3, sales: 0.2 };
  }

  function awardScoreOf(c, a, config) {
    var w = awardWeightsFor(a, config);
    var p = c._parts || awardScoreParts(c, config);
    return num(w.score, 0) * p.score + num(w.quality, 0) * p.quality + num(w.sales, 0) * p.sales;
  }

  // 奖项专属分：stat 类看对应那一维、avg 看口碑、sales 看商业、qsum 看质量。
  function awardCategoryPart(c, a, config) {
    var from = a.scoreFrom || (a.stat ? "stat" : "");
    var p = c._parts || awardScoreParts(c, config);
    var v;
    if (from === "avg" || from === "score") return p.score;
    if (from === "sales") return p.sales;
    if (from === "qsum") return p.quality;
    if (a.stat) {
      v = sim.readAwardStat(c, a.stat, a.statAliases);
      return Math.max(0, Math.min(100, v));
    }
    return p.score;
  }

  // 提名与得奖的排序键。按奖项口径分三路，别一刀切：
  //   单一维度奖（stat）→ 0.8 × 该维 + 0.2 × 综合分，防止「一维极高、整体平庸」拿走单项奖；
  //   口碑/商业/四维合计（avg / sales / qsum）→ 直接用该奖项自己的评分子或专属分；
  //   真正需要跨维比较的（goty 这类无 stat 的 avg 奖）→ 用该奖项权重算出的综合分。
  function awardPickScore(c, a, config) {
    var spec = (config.awards && config.awards.score) || {};
    var from = a.scoreFrom || (a.stat ? "stat" : "");
    var cw = num(spec.categoryWeight, 0.8);
    if (!a.stat) {
      if (from === "qsum") return awardCategoryPart(c, a, config);
      // 现算该奖项自己的权重，不能复用按 default 权重缓存的 _awardScore——
      // 否则「玩家之选」这种商业权重 0.6 的奖项会退化成一个不含销量的分数。
      return awardScoreOf(c, a, config);
    }
    if (cw < 0) cw = 0;
    if (cw > 1) cw = 1;
    return awardCategoryPart(c, a, config) * cw + num(c._awardScore, 0) * (1 - cw);
  }

  // 提名门槛：绝对线与「当年池子中位数 × 系数」取严。池子小的时候不自动放宽，
  // 由调用方在达标数过少时回退，避免早期奖项长期空缺。
  function awardGateOf(pool, config) {
    var spec = (config.awards && config.awards.score) || {};
    var gate = spec.gate || {};
    var abs = num(gate.absolute, 0);
    var mul = num(gate.medianMul, 1);
    var vals = [];
    var i, mid;
    for (i = 0; i < (pool || []).length; i++) vals.push(num(pool[i]._awardScore, 0));
    if (!vals.length) return abs;
    vals.sort(function (x, y) { return x - y; });
    mid = vals.length % 2
      ? vals[(vals.length - 1) / 2]
      : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2;
    return Math.max(abs, mid * mul);
  }

  // 评审抖动：分差够大就让强者稳定胜出，只在前二咬得紧时才摇号——颁奖夜才有悬念。
  // 抖动幅度是归一化分制上的绝对分（jitter × 100）。
  function pickJuryWinner(st, noms, a, config) {
    var spec = (config.awards && config.awards.score) || {};
    var jitter = num(spec.juryJitter, 0);
    var gap = num(spec.jurySuppressGap, 0);
    var i, v, pick, wid;
    if (!noms || !noms.length) return null;
    if (!(jitter > 0) || noms.length < 2) return noms[0];
    if (awardPickScore(noms[0], a, config) - awardPickScore(noms[1], a, config) > gap) return noms[0];
    pick = -Infinity;
    wid = 0;
    for (i = 0; i < noms.length; i++) {
      v = awardPickScore(noms[i], a, config) + (sim.rand(st) - 0.5) * 2 * jitter * 100;
      if (v > pick) { pick = v; wid = i; }
    }
    return noms[wid];
  }

  // 同一奖项的历次获胜次数，用于重复获奖的名气衰减。
  function awardPriorWins(st, awardId) {
    var n = 0;
    ((st && st.awardsHistory) || []).forEach(function (h) {
      ((h && h.awards) || []).forEach(function (a) {
        if (a.id === awardId && a.playerWon) n += 1;
      });
    });
    return n;
  }

  sim.runCareerAwards = function (st, config, notes) {
    var world = sim.careerWorld(config);
    var windowGames = (st.worldReleased || []).filter(function (g) {
      return sim.inAwardWindow({
        releasedYear: g.releasedYear || g.releaseYear,
        releasedMonth: g.releasedMonth || g.releaseMonth
      }, st.year, config);
    });
    var liveGames = (st.worldReleased || []).filter(function (g) {
      return sim.liveOpsAwardEligible(g, st.year, config);
    });
    var pool = windowGames.map(function (g) { return careerAwardCandidate(g, config); });
    var livePool = liveGames.map(function (g) { return careerAwardCandidate(g, config); });
    var credits = {};
    var spec = world.awards || {};
    var fameWin = spec.famePerWin || 0;
    var honorWin = spec.honorPerWin || 0;
    var fameNom = spec.famePerNomination || 0;
    var honorNom = spec.honorPerNomination || 0;
    var scoreSpec = (config.awards && config.awards.score) || {};
    var repeatDecay = num(scoreSpec.repeatFameDecay, 0);
    var won = 0;
    var nominated = 0;
    var nomCount = (config.awards && config.awards.nomineeCount) || 5;
    var gate, liveGate;
    // 评分子只算一次，挂到候选上供门槛与各奖项共用。
    pool.concat(livePool).forEach(function (c) {
      c._parts = awardScoreParts(c, config);
      c._awardScore = awardScoreOf(c, null, config);
    });
    gate = awardGateOf(pool, config);
    liveGate = awardGateOf(livePool, config);
    (st.career.credits || []).forEach(function (c) {
      if (creditIsSigned(c)) credits[c.titleId] = true;
    });
    var awardPack = (config.awards.list || []).map(function (a) {
      var list = a.liveOnly ? livePool : pool;
      var useGate = a.liveOnly ? liveGate : gate;
      var eligible = list.filter(function (c) { return num(c._awardScore, 0) >= useGate; });
      var noms, hit, playerNom, playerWin, prior, decay;
      // 达标不足两部就保底取全池：早期作品池小，不能让奖项长期空缺。
      if (eligible.length < 2) eligible = list.slice();
      noms = sim.rankAwardCandidates(eligible, function (c) {
        return awardPickScore(c, a, config);
      }).slice(0, Math.max(1, a.nomineeCount || nomCount));
      hit = pickJuryWinner(st, noms, a, config);
      // 得主排到首位：揭晓动效与 nominees[0] 都当它是第一名在用。
      if (hit) noms = [hit].concat(noms.filter(function (c) { return c !== hit; }));
      playerNom = noms.some(function (c) { return c.titleId && credits[c.titleId]; });
      playerWin = !!(hit && hit.titleId && credits[hit.titleId]);
      if (playerNom) {
        nominated += 1;
        st.career.fame = (st.career.fame || 0) + fameNom;
        st.career.honor = (st.career.honor || 0) + honorNom;
      }
      if (playerWin) {
        won += 1;
        // 同一奖项拿得越多名气越不值钱：第 N 次拿同一奖 ×(1+历次数)^(−decay)。
        prior = awardPriorWins(st, a.id);
        decay = repeatDecay > 0 ? Math.pow(1 + prior, -repeatDecay) : 1;
        st.career.fame = (st.career.fame || 0) + Math.round(fameWin * decay);
        st.career.honor = (st.career.honor || 0) + honorWin;
      }
      if ((playerNom || playerWin) && hit && hit.titleId) {
        (st.career.credits || []).forEach(function (c) {
          if (c.titleId === hit.titleId && creditIsSigned(c)) {
            if (!c.awards) c.awards = [];
            c.awards.push({ id: a.id, name: a.displayName, won: playerWin, nominated: playerNom, year: st.year });
          }
        });
      }
      return {
        id: a.id,
        n: a.displayName,
        year: st.year,
        w: hit ? hit.label : "—",
        titleId: hit && hit.titleId,
        nominees: noms.map(function (c) {
          return {
            label: c.label,
            titleId: c.titleId,
            player: !!(c.player || (c.titleId && credits[c.titleId]))
          };
        }),
        playerNominated: playerNom,
        playerWon: playerWin
      };
    });
    if (notes) {
      notes.push(won || nominated ? ("年度盛典：提名 " + nominated + " / 获奖 " + won) : "年度盛典");
    }
    sim.recordAwardsHistory(st, awardPack);
    return awardPack;
  };

  // 玩家那部被提名/获奖的作品名：获奖直接读 a.w，只有提名时从 nominees 里找带 player 标记的那个。
  function awardStoryTitleOf(a) {
    var i, noms;
    if (!a) return "";
    if (a.playerWon && a.w && a.w !== "—") return a.w;
    noms = a.nominees || [];
    for (i = 0; i < noms.length; i++) {
      if (noms[i] && noms[i].player) return noms[i].label || "";
    }
    return "";
  }

  function awardStoryPage(a, kind, copy) {
    var isGoty = kind === "goty";
    var map = { title: awardStoryTitleOf(a), award: (a && a.n) || "" };
    var fallbackTitle = isGoty ? "年度游戏" : "提名名单上有你的名字";
    var fallbackBody = isGoty
      ? "《{title}》——{award}。台上念出这个名字时，掌声从很远的地方涌过来。你没有喊，只是坐在原地，想起凌晨四点还亮着的那盏灯。它陪了你两年，此刻终于有人替你鼓了掌。"
      : "电话是深夜打来的。对方念出《{title}》的名字，说它进了{award}的提名名单。办公室里静了一瞬。你想起那些被砍掉又捡回来的功能——原来真的有人在看。";
    return {
      type: "story",
      kind: "event",
      presentation: "notice",
      kicker: copy.awardKicker || "年度盛典",
      title: fillPaceTemplate(
        isGoty ? (copy.tgaGotyTitle || fallbackTitle) : (copy.tgaNomTitle || fallbackTitle), map),
      body: fillPaceTemplate(
        isGoty ? (copy.tgaGotyStory || fallbackBody) : (copy.tgaNomStory || fallbackBody), map)
    };
  }

  // 首次 TGA 提名 / 首次拿下年度游戏的叙事页。纯剧情，不动任何属性。
  // 同一年既被提名又拿了年度游戏时只出大奖那一条：flag.nominated 一并置位，提名剧情不再补播
  // （颁奖夜刚念过年度游戏，紧跟一条「提名」会显得倒叙）。
  // 持久标记落 st.career.awardStory，随存档走；每次只判「第一次」，之后不再重复。
  sim.collectCareerAwardStory = function (st, config, pack) {
    var copy = sim.careerCopy(config);
    var pages = [];
    var flag, goty = null, anyNom = null, i, a;
    if (!st || !st.career || !pack || !pack.length) return pages;
    flag = st.career.awardStory || (st.career.awardStory = {});
    for (i = 0; i < pack.length; i++) {
      a = pack[i];
      if (!a) continue;
      if (a.id === "goty" && a.playerWon && !goty) goty = a;
      if ((a.playerNominated || a.playerWon) && !anyNom) anyNom = a;
    }
    if (goty && !flag.goty) {
      flag.goty = true;
      flag.nominated = true;
      pages.push(awardStoryPage(goty, "goty", copy));
      return pages;
    }
    if (anyNom && !flag.nominated) {
      flag.nominated = true;
      pages.push(awardStoryPage(anyNom, "nom", copy));
    }
    return pages;
  };

  sim.shipWorldTitlesThisMonth = function (st, config) {
    var titles = sim.allCareerTitles(config, st);
    var skip = st.career && st.career.titleId;
    titles.forEach(function (t) {
      var rec, leftover, credited;
      if (skip && t.id === skip) return;
      if (t.releaseYear === st.year && t.releaseMonth === st.month && !findWorldReleased(st, t.id)) {
        leftover = st.career && st.career.leftProjectLive && st.career.leftProjectLive[t.id];
        credited = (st.career.credits || []).some(function (c) {
          return c.titleId === t.id && creditIsSigned(c);
        });
        rec = pushWorldReleased(st, t, config, credited);
        if (leftover) rec.stats = sim.cloneTitleStats(leftover, config);
        rec.player = !!credited;
      }
    });
  };

  sim.liveStatsForMedia = function (live, config) {
    return sim.cloneTitleStats(live, config);
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

  function uniqueIds(list) {
    var out = [];
    var seen = {};
    var i, id;
    for (i = 0; i < (list || []).length; i++) {
      id = list[i];
      if (!id || seen[id]) continue;
      seen[id] = true;
      out.push(id);
    }
    return out;
  }

  function skillTierBonus(xp, config) {
    var table = skillHireSpec(config).bonusByTier || {};
    var tier = sim.xpTierFor(xp, config);
    var id = tier && tier.id;
    if (!id || table[id] == null) return 0;
    return num(table[id], 0);
  }

  function maxSkillBonus(st, kind, ids, config) {
    var best = 0;
    var i, b;
    for (i = 0; i < (ids || []).length; i++) {
      b = skillTierBonus(sim.playerXpValue(st, kind, ids[i]), config);
      if (b > best) best = b;
    }
    return best;
  }

  function targetContentIds(st, company, studio, title, config) {
    var genreIds = [];
    var gameplayIds = [];
    var titles, i, t, studios, j, s;
    if (title && (title.genreId || title.gameplayId)) {
      if (title.genreId) genreIds.push(title.genreId);
      if (title.gameplayId) gameplayIds.push(title.gameplayId);
      return { genreIds: genreIds, gameplayIds: gameplayIds };
    }
    if (studio) {
      if (studio.genreIds && studio.genreIds.length) genreIds = studio.genreIds.slice();
      if (studio.gameplayIds && studio.gameplayIds.length) gameplayIds = studio.gameplayIds.slice();
    }
    if (!genreIds.length || !gameplayIds.length) {
      studios = sim.careerStudios(company);
      for (j = 0; j < studios.length; j++) {
        s = studios[j];
        if (!genreIds.length && s.genreIds && s.genreIds.length) genreIds = genreIds.concat(s.genreIds);
        if (!gameplayIds.length && s.gameplayIds && s.gameplayIds.length) gameplayIds = gameplayIds.concat(s.gameplayIds);
      }
    }
    if (!genreIds.length || !gameplayIds.length) {
      titles = (sim.careerWorld(config).titles) || [];
      for (i = 0; i < titles.length; i++) {
        t = titles[i];
        if (!company || t.companyId !== company.id) continue;
        if (t.genreId) genreIds.push(t.genreId);
        if (t.gameplayId) gameplayIds.push(t.gameplayId);
      }
    }
    return { genreIds: uniqueIds(genreIds), gameplayIds: uniqueIds(gameplayIds) };
  }

  sim.careerSkillHireBonus = function (state, config, company, studio, title) {
    var ids = targetContentIds(state, company, studio, title, config);
    return maxSkillBonus(state, "genre", ids.genreIds, config) +
      maxSkillBonus(state, "gameplay", ids.gameplayIds, config);
  };

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

  sim.careerHireChance = function (company, state, config, studio, title) {
    var spec = sim.careerWorld(config).mobility || {};
    var sal = salarySpec(config);
    var power = company && company.power != null ? String(company.power) : "2";
    var base = (studio && studio.hireChance != null) ? studio.hireChance : (company && company.hireChance);
    var cr = state && state.career;
    var role = sim.careerRole(cr && cr.roleId, config);
    var mainStat = 0;
    var chance, min, max, powMul;
    if (base == null) base = (spec.hireChanceByPower && spec.hireChanceByPower[power]);
    if (base == null) base = 0.5;
    if (role && cr && cr.stats) mainStat = num(cr.stats[role.stat], 0);
    chance = base
      + num(cr && cr.fame, 0) * num(spec.fameHirePer, 0)
      + Math.max(0, mainStat - num(sal.statRef, 0)) * num(spec.statHirePer, 0)
      + rankTableVal(jobRankSpec(config).hireChanceRankBonus, sim.careerJobRank(cr, config), 0)
      + sim.careerSkillHireBonus(state, config, company, studio, title);
    // 按公司体量对整条通过率打折（mobility.hireChancePowerMul）。
    // company.hireChance 已是 power 级基准，但上面四项加成会把它一路推到 hireChanceMax——
    // 不乘这一下，大厂到后期就是 92% 的保险箱。作用在夹取之前。
    powMul = tableMult(spec.hireChancePowerMul, power, 1);
    if (powMul >= 0 && powMul !== 1) chance = chance * powMul;
    min = spec.hireChanceMin;
    max = spec.hireChanceMax;
    if (min != null && chance < min) chance = min;
    if (max != null && chance > max) chance = max;
    (function applyMinRank() {
      var powerKey = company && company.power != null ? String(company.power) : "2";
      var minRank = (jobRankSpec(config).offerMinRankByPower || {})[powerKey];
      if (minRank != null && sim.careerJobRank(cr, config) < minRank) chance = 0;
    })();
    if (chance < 0) chance = 0;
    if (chance > 1) chance = 1;
    return chance;
  };

  function pickStudioForOffer(st, company, year, month, config) {
    var studios = sim.careerStudios(company);
    var i, s, title, busy = [];
    if (!studios.length) return null;
    for (i = 0; i < studios.length; i++) {
      s = studios[i];
      title = sim.pickCareerAssignment(company.id, year, month, config, st, s.id);
      if (title) busy.push(s);
    }
    if (busy.length) return sim.pick(st, busy);
    return sim.pick(st, studios);
  }

  // offer / 邀约的准入开关：mobility.requireInDevTitle
  //   true（默认）/ 省略 → 四面全开；false → 全关；
  //   { offer:false, invite:false, scripted:false, studioMove:false } → 分面关。
  // kind: "offer"（年底 offer 表）| "invite"（年中挖人）| "scripted"（剧情邀约：同事线跳槽/
  //       前辈线跟着走/搭史诗作/回国）| "studioMove"（剧情内部调岗）。
  function requireInDevTitle(config, kind) {
    var mob = (sim.careerWorld(config).mobility) || {};
    var spec = mob.requireInDevTitle;
    if (spec === false) return false;
    if (!spec || spec === true || typeof spec !== "object") return true;
    if (spec.all === false) return false;
    if (kind && spec[kind] === false) return false;
    return true;
  }

  sim.mobilityRequireInDevTitle = function (config, kind) {
    return requireInDevTitle(config, kind);
  };

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

  function salaryForMobilityOffer(st, co, year, config, roleId, rank) {
    var savedRole = st.career.roleId;
    var savedRank = st.career.jobRank;
    var savedStage = st.career.growthStage;
    var salary;
    st.career.roleId = roleId;
    st.career.jobRank = rank;
    st.career.growthStage = roleId === "producer" ? "producer" : "employee";
    salary = sim.careerSalaryFor(co, year, config, st.career);
    st.career.roleId = savedRole;
    st.career.jobRank = savedRank;
    st.career.growthStage = savedStage;
    return salary;
  }

  function makeHopOffer(st, config, co, studio, roleId, year, month, salaryYear, internal, index) {
    var title = sim.pickCareerAssignment(co.id, year, month, config, st, studio && studio.id);
    // 准入：这家（这个工作室）当月手上没活，就不该发 offer——进去就是空窗，过月被塞虚拟作。
    if (!title && requireInDevTitle(config, "offer")) return null;
    var chance = sim.careerHireChance(co, st, config, studio, title);
    var powerKey = co && co.power != null ? String(co.power) : "2";
    var minRank = (jobRankSpec(config).offerMinRankByPower || {})[powerKey] || 1;
    var rank = sim.careerJobRank(st.career, config);
    var late = lateJoinSpec(config);
    var mul;
    if (title && sim.careerTitleIsLate(title, sim.careerTitleDetail(title.id, config, st), year, month, config)) {
      mul = late.hopHireChanceMul;
      if (mul != null) chance *= mul;
      if (chance < 0) chance = 0;
      if (chance > 1) chance = 1;
    }
    // 通过率 0 的 offer 不占选项位：职级不够时大厂（offerMinRankByPower[3]=3）会被硬置 0，
    // 原先仍以「0%」挂在跳槽页上——玩家看着一整排进不去的公司，既挤掉稀缺选项位，
    // 又误导「这家可以试」。返回 null 由调用方跳过（调用方已标记 usedCo，不会重复抽同一家）。
    if (!(chance > 0)) return null;
    return {
      id: "ye-" + year + "-" + index + "-" + co.id + "-" + ((studio && studio.id) || "x"),
      offerYear: year,
      companyId: co.id,
      studioId: studio && studio.id,
      studioName: studio ? sim.worldLabel(studio, config) : "",
      internal: !!internal,
      roleId: roleId,
      jobRank: rank,
      minRank: minRank,
      salary: salaryForMobilityOffer(st, co, salaryYear, config, roleId, rank),
      currentSalary: (st.career && st.career.salary) || 0,
      titleId: title && title.id,
      titleName: title ? sim.worldLabel(title, config) : "",
      successChance: chance,
      successPct: Math.round(chance * 100),
      skillFit: sim.careerSkillHireBonus(st, config, co, studio, title) > 0
    };
  }

  sim.listYearEndOffers = function (state, config) {
    var world = sim.careerWorld(config);
    var spec = world.mobility || {};
    var companies = world.companies || [];
    var year = state.year;
    var month = state.month;
    var current = state.career && state.career.companyId;
    var currentStudio = state.career && state.career.studioId;
    var count = spec.offerCount != null ? spec.offerCount : 4;
    var internalMax = spec.internalOfferMax != null ? spec.internalOfferMax : 2;
    var salaryYear = year + (month === 12 ? 1 : 0);
    var curCo = sim.careerCompany(current, config);
    var out = [];
    var usedCo = {};
    var internals = [];
    var pool, i, s, co, studio, hiring, roleId, offer;
    // 准入（mobility.requireInDevTitle.offer）：当年月手上没有在研目录作的公司不进 offer 池——
    // 进去就是空窗，过月被塞虚拟作。抽公司前先过滤，免得权重抽签白抽在死公司上。
    var needsWork = requireInDevTitle(config, "offer");
    if (current) usedCo[current] = true;
    if (curCo) {
      (sim.careerStudios(curCo) || []).forEach(function (row) {
        if (row.id !== currentStudio) internals.push(row);
      });
    }
    pool = internals.slice();
    for (i = 0; i < internalMax && pool.length; i++) {
      s = sim.pick(state, pool);
      pool = pool.filter(function (x) { return x.id !== s.id; });
      roleId = pickMobilityRole(state, config, "hop");
      offer = makeHopOffer(state, config, curCo, s, roleId, year, month, salaryYear, true, out.length);
      if (offer) out.push(offer);
    }
    hiring = companies.filter(function (c) {
      if (usedCo[c.id] || !sim.companyJoinable(c, year)) return false;
      if (needsWork && !sim.companyInDevCatalogTitle(c.id, state, config, null)) return false;
      return true;
    });
    while (out.length < count) {
      pool = hiring.filter(function (c) { return !usedCo[c.id]; });
      if (!pool.length) break;
      (function pickExternal() {
        var weighted = pool.map(function (c) {
          return { co: c, weight: skillHireWeight(state, config, c, null, null) * domesticBoostMul(state, c, config) };
        });
        var hit = sim.pickWeighted(state, weighted) || weighted[0];
        co = hit.co;
      })();
      usedCo[co.id] = true;
      studio = pickStudioForOffer(state, co, year, month, config);
      roleId = pickMobilityRole(state, config, "hop");
      offer = makeHopOffer(state, config, co, studio, roleId, year, month, salaryYear, false, out.length);
      if (offer) out.push(offer);
    }
    if (((jobRankSpec(config).promotion || {}).yearEndSlot !== false) && sim.canPromoteCareer(state, config)) {
      (function unshiftPromo() {
        var view = sim.careerPromotionView(state, config);
        var copyP = sim.careerCopy(config);
        var nextSalary = (state.career && state.career.salary) || 0;
        var savedRank;
        var usesLine = sim.promotionUsesEventLine && sim.promotionUsesEventLine(state, config);
        var promoRole = state.career && state.career.roleId;
        if (sim.hasActiveExclusiveGroup && sim.hasActiveExclusiveGroup(state, "careerPath", config)) return;
        if (sim.hasPendingCareerLine && sim.hasPendingCareerLine(state)) return;
        if (curCo) {
          savedRank = state.career.jobRank;
          state.career.jobRank = view.nextRank;
          nextSalary = sim.careerSalaryFor(curCo, salaryYear, config, state.career);
          state.career.jobRank = savedRank;
        }
        if (usesLine) {
          out.unshift({
            id: "ye-promo-line-" + year,
            kind: "promotionLine",
            lineId: (sim.promotionEventLineDef(state, config) || {}).id,
            offerYear: year,
            companyId: current,
            studioId: currentStudio,
            internal: true,
            roleId: promoRole,
            jobRank: view.nextRank,
            salary: nextSalary,
            currentSalary: (state.career && state.career.salary) || 0,
            successChance: 1,
            successPct: 100,
            titleName: (copyP.promoteYearEnd || "内部晋升") + " · " + (view.currentLabel || "") + " → " + (view.nextLabel || "")
          });
          return;
        }
        out.unshift({
          id: "ye-promo-" + year,
          kind: "promotion",
          offerYear: year,
          companyId: current,
          studioId: currentStudio,
          internal: true,
          roleId: promoRole,
          jobRank: view.nextRank,
          salary: nextSalary,
          currentSalary: (state.career && state.career.salary) || 0,
          successChance: 1,
          successPct: 100,
          titleName: (copyP.promoteYearEnd || "内部晋升") + " · " + (view.currentLabel || "") + " → " + (view.nextLabel || "")
        });
      })();
    }
    if (out.length > count) out = out.slice(0, count);
    return out;
  };

  sim.listCompanyStudioViews = function (state, config) {
    var co = state && state.career ? sim.careerCompany(state.career.companyId, config) : null;
    var studios = sim.careerStudios(co);
    var mine = state.career && state.career.studioId;
    var year = state.year;
    var month = state.month;
    return studios.map(function (s) {
      var inDev = sim.titlesInDevAt(co.id, year, month, config, state, s.id);
      var selling = (state.worldReleased || []).filter(function (g) {
        return g.studioId === s.id;
      });
      var last = selling.length ? selling[selling.length - 1] : null;
      return {
        studio: s,
        studioId: s.id,
        mine: s.id === mine,
        inDev: inDev,
        inDevTitle: inDev[0] || null,
        selling: last
      };
    });
  };

  sim.ensureYearEndOffers = function (st, config) {
    if (!st.career) return st;
    if (st.career.yearEndOffers && st.career.yearEndOffers.length) return st;
    st.career.yearEndOffers = sim.listYearEndOffers(st, config);
    st.career.offerYear = st.year;
    return st;
  };

  sim.listCareerInvites = function (state, config) {
    var world = sim.careerWorld(config);
    var titles = world.titles || [];
    var details = world.titleDetails || [];
    var fame = (state.career && state.career.fame) || 0;
    var now = sim.monthIndex(state.year, state.month);
    var out = [];
    var i, d, t, w, co;
    for (i = 0; i < details.length; i++) {
      d = details[i];
      if (!d.inviteEligible || !d.inviteWindow) continue;
      if (num(d.inviteMinFame, 0) > fame) continue;
      w = d.inviteWindow;
      if (now < sim.monthIndex(w.startYear, w.startMonth) || now > sim.monthIndex(w.endYear, w.endMonth)) continue;
      if (state.career && state.career.titleId === d.id) continue;
      t = sim.findById(titles, d.id);
      if (!t) continue;
      // 准入：邀约必须挂着"当月真在开发"的作（inviteWindow 本来就落在开发窗口内，
      // 这里是硬约束，防止窗口与开发窗口改歪之后把人送进空窗）。
      if (requireInDevTitle(config, "invite") && !sim.titleCoversMonth(t, d, state.year, state.month)) continue;
      if (sim.careerTitleIsLate(t, d, state.year, state.month, config) && lateJoinSpec(config).inviteEligible !== true) continue;
      if (state.career && t.companyId === state.career.companyId) continue;
      co = sim.careerCompany(t.companyId, config);
      if (!sim.companyJoinable(co, state.year)) continue;
      (function pushInvite() {
        var staffRoles = (d.inviteRoles && d.inviteRoles.length) ? d.inviteRoles.filter(function (rid) {
          return PLAYABLE.indexOf(rid) >= 0;
        }) : PLAYABLE.slice();
        var roleId;
        var rankNow = sim.careerJobRank(state.career, config);
        var specR = jobRankSpec(config);
        var offered = rankNow;
        var salary;
        var maxR = specR.max != null ? specR.max : 6;
        var maxPer = (specR.promotion && specR.promotion.maxPerYear != null)
          ? specR.promotion.maxPerYear
          : num(specR.maxPromotionsPerYear, 1);
        if (!staffRoles.length && !producerOfferUnlocked(state, config)) return;
        roleId = pickMobilityRole(state, config, "invite", staffRoles);
        if (specR.inviteCanRaiseRank && rankNow < maxR && num(state.career.promotionsThisYear, 0) < maxPer) {
          if (sim.canPromoteCareer(state, config) || num(state.career.fame, 0) >= 8) offered = rankNow + 1;
        }
        salary = salaryForMobilityOffer(state, co, state.year, config, roleId, offered);
        out.push({
          id: "inv-" + d.id,
          titleId: d.id,
          companyId: t.companyId,
          studioId: t.studioId || sim.defaultStudioId(co),
          roleId: roleId,
          jobRank: offered,
          minFame: d.inviteMinFame,
          salary: salary,
          currentSalary: (state.career && state.career.salary) || 0,
          titleName: sim.worldLabel(t, config)
        });
      })();
    }
    return out;
  };

  // 邀约按「年」掷骰：每年只掷一次，inviteChance 直接就是「这一年会不会有厂商来挖」的概率。
  // 旧写法是每月独立掷一次（失败不消耗次数），12 次叠加后年内命中率 ≈ 99.8%，
  // 等于每年必被挖一次；而邀约是必成的（acceptCareerInvite 不掷骰），
  // 于是「进大厂」变成零门槛。现在改成年度单次判定，概率才可预期。
  function rollInvitesThisMonth(st, config) {
    var spec = sim.careerWorld(config).mobility || {};
    var max = spec.inviteMaxPerYear != null ? spec.inviteMaxPerYear : 1;
    var chance = spec.inviteChance;
    var eligible, picked;
    if (st.career.inviteYearStamp !== st.year) {
      st.career.inviteYearStamp = st.year;
      st.career.invitesRolledThisYear = 0;
      if (chance == null) chance = 1;
      st.career.inviteYearHit = sim.rand(st) < chance;
    }
    if (!st.career.inviteYearHit) return st.career.invites || [];
    if (st.career.invitesRolledThisYear >= max) return st.career.invites || [];
    eligible = sim.listCareerInvites(st, config);
    if (!eligible.length) return st.career.invites || [];
    (function pickInvite() {
      var weighted = eligible.map(function (inv) {
        var title = sim.careerTitle(inv.titleId, config, st);
        var co = sim.careerCompany(inv.companyId, config);
        var studio = sim.careerStudio(inv.companyId, inv.studioId, config);
        return { inv: inv, weight: skillHireWeight(st, config, co, studio, title) * domesticBoostMul(st, co, config) };
      });
      var hit = sim.pickWeighted(st, weighted) || weighted[0];
      picked = hit && hit.inv;
    })();
    if (!picked) return st.career.invites || [];
    st.career.invitesRolledThisYear += 1;
    st.career.invites = [picked];
    return st.career.invites;
  }

  sim.applyYearEndOffer = function (state, offerId, config) {
    var offer = null;
    var st, spec, copy, chance;
    if (!sim.isCareerMode(state)) return sim.fail(state, sim.ERR.CAREER_NOT_CAREER);
    (state.career.yearEndOffers || []).forEach(function (o) {
      if (o.id === offerId) offer = o;
    });
    if (!offer) return sim.fail(state, sim.ERR.CAREER_OFFER_NOT_FOUND);
    if (offer.kind === "promotion") {
      if (!sim.canPromoteCareer(state, config)) return sim.fail(state, sim.ERR.CAREER_PROMOTE_LOCKED);
      st = sim.clone(state);
      sim.ensureCareerExtras(st, config);
      applyPromotion(st, config);
      st.career.yearEndOffers = (st.career.yearEndOffers || []).filter(function (o) { return o.kind !== "promotion"; });
      copy = sim.careerCopy(config);
      return { ok: true, state: st, hopped: false, promoted: true, notice: copy.promoteOk || "晋升成功。" };
    }
    if (offer.kind === "promotionLine") {
      if (!offer.lineId) return sim.fail(state, sim.ERR.CAREER_LINE_LOCKED);
      st = sim.startCareerLine(state, offer.lineId, config);
      if (!st.ok) return st;
      st.state.career.yearEndOffers = (st.state.career.yearEndOffers || []).filter(function (o) {
        return o.kind !== "promotionLine" && o.kind !== "promotion";
      });
      copy = sim.careerCopy(config);
      return {
        ok: true,
        state: st.state,
        hopped: false,
        lineStarted: true,
        queue: st.queue || [],
        notice: copy.lineStarted || "晋升评审已开始。"
      };
    }
    if (state.career && state.career.hopFailedYear === state.year) {
      return sim.fail(state, sim.ERR.CAREER_HOP_WAIT);
    }
    if (!sim.canCareerHop(state, config)) {
      return sim.fail(state, state.career.hopFailedYear === state.year ? sim.ERR.CAREER_HOP_WAIT : sim.ERR.CAREER_BUSY);
    }
    st = sim.clone(state);
    sim.ensureCareerExtras(st, config);
    copy = sim.careerCopy(config);
    spec = sim.careerWorld(config).mobility || {};
    chance = offer.successChance;
    if (chance == null) {
      chance = sim.careerHireChance(sim.careerCompany(offer.companyId, config), st, config, sim.careerStudio(offer.companyId, offer.studioId, config));
    }
    if (sim.rand(st) >= chance) {
      st.career.hopFailedYear = st.year;
      st.career.hopNotice = copy.hopFailNotice || "没通过，明年再试。";
      return { ok: true, state: st, hopped: false, notice: st.career.hopNotice };
    }
    detachFromProject(st, config);
    st.career.fame = (st.career.fame || 0) + num(spec.fameOnAccept, 0);
    st.career.hopFailedYear = null;
    joinCompany(st, offer.companyId, offer.roleId, offer.salary, offer.titleId, config, offer.studioId, "hop", offer.jobRank);
    st.career.hopNotice = copy.hopOkNotice || "跳槽成功。";
    return { ok: true, state: st, hopped: true, notice: st.career.hopNotice };
  };

  sim.acceptYearEndOffer = function (state, offerId, config) {
    return sim.applyYearEndOffer(state, offerId, config);
  };

  sim.declineYearEndOffers = function (state, config) {
    var st;
    if (!sim.isCareerMode(state)) return sim.fail(state, sim.ERR.CAREER_NOT_CAREER);
    st = sim.clone(state);
    st.career.yearEndOffers = [];
    return sim.ok(st);
  };

  sim.acceptCareerInvite = function (state, inviteId, config) {
    var invite = null;
    var st, spec, copy;
    if (!sim.isCareerMode(state)) return sim.fail(state, sim.ERR.CAREER_NOT_CAREER);
    (state.career.invites || []).forEach(function (o) {
      if (o.id === inviteId) invite = o;
    });
    if (!invite) return sim.fail(state, sim.ERR.CAREER_INVITE_NOT_FOUND);
    st = sim.clone(state);
    sim.ensureCareerExtras(st);
    spec = sim.careerWorld(config).mobility || {};
    st.career.fame = (st.career.fame || 0) + num(spec.fameOnAccept, 0);
    detachFromProject(st, config);
    joinCompany(st, invite.companyId, invite.roleId, invite.salary, invite.titleId, config, invite.studioId, "invite", invite.jobRank);
    copy = sim.careerCopy(config);
    st.career.hopNotice = copy.inviteOkNotice || copy.hopOkNotice || "跳槽成功。";
    return { ok: true, state: st, notice: st.career.hopNotice };
  };

  sim.counterCareerInvite = function (state, inviteId, config) {
    var invite = null;
    var st, spec;
    if (!sim.isCareerMode(state)) return sim.fail(state, sim.ERR.CAREER_NOT_CAREER);
    spec = sim.careerWorld(config).mobility || {};
    if (spec.inviteCanCounter === false) return sim.fail(state, sim.ERR.CAREER_INVITE_NOT_FOUND);
    (state.career.invites || []).forEach(function (o) {
      if (o.id === inviteId) invite = o;
    });
    if (!invite) return sim.fail(state, sim.ERR.CAREER_INVITE_NOT_FOUND);
    st = sim.clone(state);
    st.career.salary = sim.careerSalaryStepUp(st.career.salary || 0, config, spec.counterSteps);
    st.career.fame = (st.career.fame || 0) + num(spec.stayPromiseFame, 0);
    st.career.invites = [];
    return sim.ok(st);
  };

  sim.declineCareerInvite = function (state, inviteId, config) {
    var st;
    if (!sim.isCareerMode(state)) return sim.fail(state, sim.ERR.CAREER_NOT_CAREER);
    st = sim.clone(state);
    st.career.invites = (st.career.invites || []).filter(function (o) { return o.id !== inviteId; });
    return sim.ok(st);
  };

  sim.careerYearReleases = function (year, config, st) {
    var titles = sim.allCareerTitles(config, st);
    var months = {};
    var m;
    for (m = 1; m <= 12; m++) months[m] = [];
    titles.forEach(function (t) {
      if (t.releaseYear === year) {
        months[t.releaseMonth] = months[t.releaseMonth] || [];
        months[t.releaseMonth].push(t);
      }
    });
    return { year: year, months: months };
  };

  function hopOfferCount(config) {
    var n = ((sim.careerWorld(config).mobility || {}).offerCount);
    return n != null ? n : 4;
  }

  function hopOfferChoice(o, config) {
    var copy = sim.careerCopy(config);
    var co = sim.careerCompany(o.companyId, config);
    var studio = sim.careerStudio(o.companyId, o.studioId, config);
    var isPromo = o.kind === "promotion" || o.kind === "promotionLine";
    var prefix = isPromo ? (copy.promoteYearEnd || "内部晋升") : (o.internal ? (copy.hopInternal || "内部调动") : "");
    var companyName = co ? sim.worldLabel(co, config) : (o.companyId || "");
    var studioName = studio ? sim.worldLabel(studio, config) : (o.studioName || "");
    var title = companyName + (studioName ? (" / " + studioName) : "");
    var pct = o.successPct != null ? o.successPct : Math.round((o.successChance || 0) * 100);
    var rankLabel = sim.formatCareerRankLabel(o.roleId, o.jobRank, config) || "";
    var metaBits = [];
    var labelBits = [];
    if (prefix) title = prefix + " · " + title;
    if (o.salary != null) metaBits.push(String(o.salary));
    if (rankLabel) metaBits.push(rankLabel);
    if (title) labelBits.push(title);
    if (metaBits.length) labelBits.push(metaBits.join(" · "));
    labelBits.push(pct + "%");
    return {
      id: o.id,
      label: labelBits.join(" · "),
      hopView: {
        title: title,
        meta: metaBits.join(" · "),
        pct: pct + "%"
      }
    };
  }

  function hopQueueItem(st, config) {
    var copy = sim.careerCopy(config);
    var offers = (st.career.yearEndOffers || []).slice(0, hopOfferCount(config));
    var can = sim.canCareerHop(st, config);
    return {
      type: "hop",
      kind: "event",
      presentation: "choice",
      kicker: copy.hopKicker || "年底跳槽",
      title: copy.hopTitle || "全球 offer",
      body: can ? (copy.hopBody || "") : (copy.hopLocked || "在研中途不能走。"),
      offers: offers,
      canHop: can,
      options: offers.map(function (o) {
        return hopOfferChoice(o, config);
      }).concat([{ id: "stay", label: copy.hopStay || "先留下" }])
    };
  }

  function inviteQueueItem(invite, config) {
    var copy = sim.careerCopy(config);
    var co = sim.careerCompany(invite.companyId, config);
    var role = sim.careerRole(invite.roleId, config);
    var seniorLine = sim.careerSeniorLine(co, config);
    var rankLabel = invite.jobRank ? (sim.formatCareerRankLabel(invite.roleId, invite.jobRank, config) || ("职级 Lv." + invite.jobRank)) : "";
    var spec = sim.careerWorld(config).mobility || {};
    var options = [
      { id: "accept", label: copy.inviteAccept || "跳槽加入" },
      { id: "decline", label: copy.inviteDecline || "留下" }
    ];
    if (spec.inviteCanCounter === true) {
      options.splice(1, 0, { id: "counter", label: copy.inviteCounter || "现公司还价" });
    }
    return {
      type: "invite",
      kind: "event",
      presentation: "choice",
      inviteId: invite.id,
      kicker: copy.inviteKicker || "挖人",
      title: copy.inviteTitle || "入职邀请",
      body: (co ? sim.worldLabel(co, config) : invite.companyId) +
        " 请你做" + (role ? sim.worldLabel(role, config) : "") +
        (invite.titleName ? ("，进组《" + invite.titleName + "》") : "") +
        (rankLabel ? ("，" + rankLabel) : "") +
        "。现薪 " + invite.currentSalary + " / 新薪 " + invite.salary +
        (seniorLine ? ("。" + seniorLine) : ""),
      options: options
    };
  }

  sim.tickCareerMonth = function (state, config) {
    var st = sim.clone(state);
    var notes = [];
    var queue = [];
    var copy = sim.careerCopy(config);
    var world = sim.careerWorld(config);
    var cal = world.timeline || {};
    var eco = world.personalEconomy || {};
    var mobility = world.mobility || {};
    var hopMonth = mobility.hopMonth || 12;
    var awardPack = null;
    var awardStory = [];
    var firedEvent = null;
    var lineFired = 0;
    var pay, living, co, view, projectView, phaseLabel, role, invites, supporting, titleNow, xpSpec, phaseMult;

    sim.ensureCareerExtras(st, config);
    if (st.career) st.career.inspirationMonth = false;
    if (st.month === 1 && sim.applyPendingStoryPromos) {
      sim.applyPendingStoryPromos(st, config);
    }
    if (st.career && st.career.companyId && !st.career.studioId) {
      st.career.studioId = sim.defaultStudioId(sim.careerCompany(st.career.companyId, config));
    }
    supporting = !!sim.careerPostLaunch(st);
    projectView = sim.careerProjectView(st, config);
    view = projectView;
    xpSpec = world.playerXp || {};
    titleNow = st.career.titleId ? sim.careerTitle(st.career.titleId, config, st) : null;
    if (sim.tickCareerGrind) {
      sim.tickCareerGrind(st, config, !!st.career.liveStats && (supporting || !projectView.idle));
    }
    if (supporting && st.career.liveStats) {
      grantPlayerTitleXp(st, titleNow, num(xpSpec.xpPerPostLaunchMonth, num(xpSpec.xpPerDevMonth, 0)));
      grantMainStatAndXp(st, "support", config, titleNow);
      role = sim.careerRole(st.career.roleId, config);
      // 长线运营月不吃阶段权重（那是开发期的节奏），只吃体量阻尼。
      applyMonthlyLiveContribution(st, config, sim.careerPowerContribMult(titleNow, config));
      (function markSupported() {
        var cred = findCredit(st, st.career.titleId);
        if (cred) cred.supported = true;
      })();
      phaseLabel = projectView.phase ? sim.worldLabel(projectView.phase, config) : "";
      if (phaseLabel) notes.push((copy.phasePrefix || "阶段") + " " + phaseLabel);
    } else if (!projectView.idle && st.career.liveStats) {
      role = sim.careerRole(st.career.roleId, config);
      if (st.career.burnoutMonth) notes.push("倦怠：连轴转太久了，这个月状态只剩一半");
      // 开发月的成长倍率：阶段权重（立项慢 / 填充·打磨快 / 金盘期 0）× 体量阻尼。
      // 同一个倍率同时管「属性成长」「职级经验」「作品月贡献」，玩家才对得上「这个月干了多少活」。
      phaseMult = sim.careerPhaseMult(projectView.phase && projectView.phase.id, config) *
        sim.careerPowerContribMult(titleNow, config);
      applyMonthlyLiveContribution(st, config, phaseMult);
      rollInspirationMonth(st, config, notes);
      grantPlayerTitleXp(st, titleNow, num(xpSpec.xpPerDevMonth, 0) * phaseMult);
      grantMainStatAndXp(st, "dev", config, titleNow, phaseMult);
      phaseLabel = projectView.phase ? sim.worldLabel(projectView.phase, config) : "";
      if (phaseLabel) notes.push((copy.phasePrefix || "阶段") + " " + phaseLabel);
    }

    sim.shipWorldTitlesThisMonth(st, config);

    if (st.career.titleId && !sim.careerPostLaunch(st)) {
      view = sim.careerTitle(st.career.titleId, config, st);
      if (view && view.releaseYear === st.year && view.releaseMonth === st.month) {
        sim.shipPlayerTitle(st, config, notes, queue);
      }
    }

    if (st.month === hopMonth && sim.markCareerLineYearEnd) {
      sim.markCareerLineYearEnd(st);
    }

    if (sim.processCareerLines) {
      lineFired = sim.processCareerLines(st, config, queue, notes) || 0;
    }

    if (!lineFired && supporting && st.career.liveStats) {
      firedEvent = sim.rollPostLaunchEvent(st, config, notes);
      if (firedEvent) {
        queue.push(careerEventQueueItem(firedEvent, copy));
      }
    } else if (!lineFired && !projectView.idle && st.career.liveStats && !sim.careerPostLaunch(st)) {
      firedEvent = sim.rollCareerDevEvent(st, config, notes);
      if (firedEvent) {
        queue.push(careerEventQueueItem(firedEvent, copy));
      }
    }

    pay = st.career.salary || 0;
    st.career.lastPay = pay;
    st.career.savings = (st.career.savings || 0) + pay;
    // ⚠️ 钱在生涯档目前没有出口：deductLivingCost=false，savings 只喂 UI 与结算页，
    // savingsGate 也没有消费方。要打开这个开关，先让「钱能买到什么」成立，否则只是数字变化；
    // 在那之前不要给天赋写 livingCostMult（守卫测试 careerTraitsStayOnLiveKeys 会拦）。
    if (eco.deductLivingCost) {
      living = sim.careerLivingCost(st.year, config) *
        sim.careerTraitMult(st, "livingCostMult", config, 1);
      st.career.savings -= living;
    }
    st.company.funds = st.career.savings;

    if (st.phase === "PLAYING") {
      st.career.monthsInRank = num(st.career.monthsInRank, 0) + (st.career.companyId ? 1 : 0);
      if (sim.tickCareerBonds) sim.tickCareerBonds(st, config);
    }

    if (st.phase === "PLAYING" && st.month === (config.awards.month || 11)) {
      awardPack = sim.runCareerAwards(st, config, notes);
      if (sim.collectCareerAwardStory) {
        awardStory = sim.collectCareerAwardStory(st, config, awardPack);
      }
    }

    invites = rollInvitesThisMonth(st, config);
    if (invites && invites.length) {
      queue.push(inviteQueueItem(invites[0], config));
    }

    if (st.month === hopMonth) {
      st.career.yearEndOffers = sim.listYearEndOffers(st, config);
      st.career.offerYear = st.year;
      if (!supporting && st.career.yearEndOffers.length) queue.push(hopQueueItem(st, config));
    }

    st.month += 1;
    if (st.month > 12) {
      st.month = 1;
      st.year += 1;
      st.career.promotionsThisYear = 0;
      co = sim.careerCompany(st.career.companyId, config);
      if (co) st.career.salary = sim.careerSalaryFor(co, st.year, config, st.career);
    }

    if (st.month === hopMonth) {
      st.career.yearEndOffers = sim.listYearEndOffers(st, config);
      st.career.offerYear = st.year;
    } else if (mobility.allowMidProject && st.phase === "PLAYING" && st.career.companyId) {
      sim.ensureYearEndOffers(st, config);
    }

    if (supporting && st.career.postLaunch) {
      st.career.postLaunch.monthsLeft = num(st.career.postLaunch.monthsLeft, 0) - 1;
      if (num(st.career.postLaunch.monthsLeft, 0) <= 0) {
        persistProjectLive(st, config);
        st.career.postLaunch = null;
        st.career.titleId = null;
        st.career.liveStats = null;
      }
    }
    if (!sim.careerPostLaunch(st) && !st.career.titleId) st.career.idleMonths = num(st.career.idleMonths, 0) + 1;
    sim.assignCareerProject(st, config, queue);
    sim.ensureCareerColleagues(st, config);

    if (st.phase === "PLAYING" && (st.year > cal.endYear || (st.year === cal.endYear && st.month > cal.endMonth))) {
      st.phase = "SETTLED";
    }

    if (awardPack) {
      queue.push({
        type: "awards",
        kind: "event",
        year: st.year,
        kicker: sim.fillAwardYear
          ? sim.fillAwardYear(copy.awardNightKicker, st.year, st.year + "年度盛典")
          : (copy.awardKicker || "年度盛典"),
        title: sim.fillAwardYear
          ? sim.fillAwardYear(copy.awardNightTitle, st.year, st.year + "颁奖夜")
          : (copy.awardTitle || "颁奖夜"),
        body: copy.awardBody || "",
        awards: awardPack
      });
      // 剧情页排在颁奖夜之后：先看滚幕揭晓，再读这一段。
      awardStory.forEach(function (p) { queue.push(p); });
    }
    return { state: st, queue: queue };
  };

  function careerPaceSpec(config) {
    return (sim.careerWorld(config).careerPace) || {};
  }

  function awardsInvolvePlayer(pack) {
    return (pack || []).some(function (a) {
      return !!(a && (a.playerWon || a.playerNominated));
    });
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

  sim.careerQueueNeedsDecision = function (queue, config) {
    var pace = careerPaceSpec(config);
    var stopTypes = pace.stopOnTypes || [
      "invite", "hop", "promotion", "media", "producerPitch", "careerLine", "careerLineFork"
    ];
    var stopOnChoice = pace.stopOnChoice !== false;
    var stopOnPlayerAwards = pace.stopOnPlayerAwards !== false;
    var i;
    var page;
    for (i = 0; i < (queue || []).length; i++) {
      page = queue[i];
      if (!page) continue;
      if (stopOnChoice && page.presentation === "choice") return true;
      if (page.type === "awards") {
        if (stopOnPlayerAwards && awardsInvolvePlayer(page.awards)) return true;
        continue;
      }
      if (stopTypes.indexOf(page.type) >= 0) return true;
    }
    return false;
  };

  sim.tickCareerToDecision = function (state, config) {
    var pace;
    var maxSkip;
    var summaryMin;
    var fromY;
    var fromM;
    var skipped;
    var st;
    var last;
    var queue;
    var copy;
    var summary;
    var toY;
    var toM;
    if (!state || state.mode !== "career") {
      return sim.tickMonth(state, config);
    }
    pace = careerPaceSpec(config);
    maxSkip = num(pace.maxSkipMonths, 12);
    if (maxSkip < 1) maxSkip = 1;
    summaryMin = num(pace.summaryMinSkipped, 2);
    if (summaryMin < 1) summaryMin = 1;
    fromY = state.year;
    fromM = state.month;
    skipped = 0;
    st = state;
    last = null;
    while (st.phase === "PLAYING") {
      last = sim.tickCareerMonth(st, config);
      st = last.state;
      skipped += 1;
      if (st.phase !== "PLAYING") break;
      if (sim.careerQueueNeedsDecision(last.queue, config)) break;
      if (skipped >= maxSkip) break;
    }
    queue = (last && last.queue) ? last.queue.slice() : [];
    toY = st.year;
    toM = st.month;
    if (skipped >= summaryMin) {
      copy = sim.careerCopy(config);
      summary = {
        type: "paceSkip",
        kind: "info",
        kicker: copy.paceSkipKicker || "时间飞逝",
        title: fillPaceTemplate(copy.paceSkipTitle || "推进了 {months} 个月", { months: skipped }),
        body: fillPaceTemplate(
          copy.paceSkipBody || "{from} → {to}。途中没有需要你当场决定的事。",
          { from: dateLabel(fromY, fromM), to: dateLabel(toY, toM), months: skipped }
        )
      };
      queue = [summary].concat(queue);
    }
    return {
      state: st,
      queue: queue,
      skippedMonths: skipped,
      from: { year: fromY, month: fromM },
      to: { year: toY, month: toM }
    };
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
