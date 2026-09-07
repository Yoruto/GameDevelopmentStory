(function (root) {
  var sim = root.GDS.sim;
  var PLAYABLE = ["programmer", "art", "design", "music"];
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
    return steps.length ? steps[idx] : 0;
  };

  sim.careerLivingCost = function (year, config) {
    var world = sim.careerWorld(config);
    var eco = world.personalEconomy || {};
    var start = (world.timeline && world.timeline.startYear) || year;
    var years = Math.max(0, year - start);
    return Math.round((eco.livingCostPerMonth || 0) * Math.pow(1 + (eco.livingCostYearGrowth || 0), years));
  };

  sim.liveToPublicScore = function (liveStats, worldScore, config) {
    var world = sim.careerWorld(config);
    var m = world.scoreFromLive || {};
    var dims = (world.quality && world.quality.dims) || DIMS;
    var sum = 0, n = 0, i, avg, divisor, fromLive, w, mixed, min, max, dec, f;
    liveStats = liveStats || {};
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
    w = m.playerWeight;
    if (w == null) w = 0;
    mixed = (worldScore == null ? fromLive : worldScore) * (1 - w) + fromLive * w;
    min = m.min != null ? m.min : mixed;
    max = m.max != null ? m.max : mixed;
    if (mixed < min) mixed = min;
    if (mixed > max) mixed = max;
    dec = m.decimals != null ? m.decimals : 1;
    f = Math.pow(10, dec);
    return Math.round(mixed * f) / f;
  };

  sim.applyCareerLiveDelta = function (st, dim, delta, config) {
    var world, q, key, next, min;
    if (!st.career || !st.career.liveStats || !dim) return;
    world = sim.careerWorld(config);
    q = world.quality || {};
    key = dim === "script" ? "design" : dim;
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

  function initPlayerStats(role, player) {
    var stats = cloneStats(player.startingStats);
    var dim = role && role.stat;
    if (dim) stats[dim] = num(stats[dim], 0) + num(player.specialtyBonus, 0);
    return stats;
  }

  sim.ensureCareerExtras = function (st) {
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
    if (st.career.hopFailedYear == null) st.career.hopFailedYear = null;
    if (!st.career.leftProjectLive) st.career.leftProjectLive = {};
    if (!st.career.genreXp) st.career.genreXp = {};
    if (!st.career.gameplayXp) st.career.gameplayXp = {};
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

  function xpPairBonus(gxp, pxp, per, cap) {
    var bonus;
    if (per == null) per = 0;
    bonus = Math.floor(num(gxp, 0) * per) + Math.floor(num(pxp, 0) * per);
    if (cap != null && bonus > cap) bonus = cap;
    if (bonus < 0) bonus = 0;
    return bonus;
  }

  sim.playerSkillLiveBonus = function (st, genreId, gameplayId, config) {
    var spec = (sim.careerWorld(config).playerXp) || {};
    return xpPairBonus(
      sim.playerXpValue(st, "genre", genreId),
      sim.playerXpValue(st, "gameplay", gameplayId),
      spec.liveBonusPerXp,
      spec.liveBonusCap
    );
  };

  sim.playerSkillContribBonus = function (st, genreId, gameplayId, config) {
    var spec = (sim.careerWorld(config).playerXp) || {};
    return xpPairBonus(
      sim.playerXpValue(st, "genre", genreId),
      sim.playerXpValue(st, "gameplay", gameplayId),
      spec.contribBonusPerXp,
      spec.contribBonusCap
    );
  };

  sim.careerMonthlyContribution = function (st, config) {
    var world = sim.careerWorld(config);
    var base = num(world.player && world.player.monthlyContribution, 0);
    var title = st && st.career && st.career.titleId ? sim.careerTitle(st.career.titleId, config, st) : null;
    return base + sim.playerSkillContribBonus(st, title && title.genreId, title && title.gameplayId, config);
  };

  sim.xpTierLabel = function (xp, config) {
    return sim.worldLabel(sim.xpTierFor(xp, config), config) || "";
  };

  function liveFromTitle(st, title, config) {
    var base = cloneStats(title && title.stats);
    var spec = sim.careerWorld(config).companyXp || {};
    var studioId = (title && title.studioId) || (st.career && st.career.studioId);
    var gxp = sim.studioXpValue(st, studioId, "genre", title && title.genreId);
    var pxp = sim.studioXpValue(st, studioId, "gameplay", title && title.gameplayId);
    var per = spec.statBonusPerXp;
    var bonus, cap, i, role, main, playerBonus;
    if (per == null) per = 0;
    bonus = Math.floor(gxp * per) + Math.floor(pxp * per);
    cap = spec.statBonusCap;
    if (cap != null && bonus > cap) bonus = cap;
    for (i = 0; i < DIMS.length; i++) base[DIMS[i]] = num(base[DIMS[i]], 0) + bonus;
    role = sim.careerRole(st && st.career && st.career.roleId, config);
    main = role && role.stat;
    playerBonus = sim.playerSkillLiveBonus(st, title && title.genreId, title && title.gameplayId, config);
    if (main && playerBonus) base[main] = num(base[main], 0) + playerBonus;
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
      stats: cloneStats(title.stats),
      prestige: title.prestige || 0,
      releaseType: title.releaseType || (sim.isLiveOpsTitle(title) ? "liveops" : "boxed"),
      live: sim.isLiveOpsTitle(title),
      livePeak: sim.careerLivePeak(title, config),
      versionMajor: sim.isLiveOpsTitle(title) ? ((config.liveOps && config.liveOps.versions && config.liveOps.versions.startMajor) || 1) : 0,
      versionMinor: 0,
      player: !!player,
      virtual: !!title.virtual
    };
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
    var i, tier, pool, co, risk;
    if (!role) return out;
    for (i = 0; i < tiers.length; i++) {
      tier = tiers[i];
      pool = companies.filter(function (c) {
        return c.openingOffer && c.starterTier === tier && sim.companyJoinable(c, st.year);
      });
      if (!pool.length) continue;
      co = sim.pick(st, pool);
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

  sim.createCareerGame = function (characterName, roleId, config) {
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
        salary: 0,
        lastPay: 0,
        titleId: null,
        liveStats: null,
        stats: initPlayerStats(role, player),
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
        hopFailedYear: null,
        hopNotice: "",
        leftProjectLive: {},
        postLaunch: null,
        genreXp: xp0.genreXp,
        gameplayXp: xp0.gameplayXp,
        offerYear: null
      }
    };
    st.career.openingOffers = sim.rollOpeningOffers(st, st.career.roleId, config);
    seedCompanyXp(st, config);
    seedWorldReleasedBeforeStart(st, config);
    return st;
  };

  function addCredit(st, titleId) {
    var i, list;
    if (!titleId || !st.career) return;
    list = st.career.credits || (st.career.credits = []);
    for (i = 0; i < list.length; i++) if (list[i].titleId === titleId) return;
    list.push({
      titleId: titleId,
      companyId: st.career.companyId,
      studioId: st.career.studioId || null,
      roleId: st.career.roleId
    });
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

  sim.startVirtualProject = function (st, config) {
    var world = sim.careerWorld(config);
    var pool = world.virtualPool || {};
    var companyId = st.career && st.career.companyId;
    var studio = sim.careerStudio(companyId, st.career && st.career.studioId, config);
    var studioId = studio && studio.id;
    var content = config.content || {};
    var genreId, gameplayId, months, relY, relM, tries, stats, title, detail, seq, prefix, suffix;
    var base, jitter, i, k;
    if (!companyId) return null;
    sim.ensureCareerExtras(st);
    genreId = pickStudioContentId(st, studio && studio.genreIds, pool.genreWeights, content.genres);
    gameplayId = pickStudioContentId(st, studio && studio.gameplayIds, pool.gameplayWeights, content.gameplay);
    months = sim.irand(st, num(pool.devMonthsMin, 6), num(pool.devMonthsMax, 14));
    relY = st.year;
    relM = st.month + months;
    while (relM > 12) { relM -= 12; relY += 1; }
    tries = 0;
    while (landmarkMonthBlocked(st, companyId, relY, relM, config) && tries < 12) {
      relM += 1;
      if (relM > 12) { relM = 1; relY += 1; }
      months += 1;
      tries += 1;
    }
    st.career.virtualSeq = (st.career.virtualSeq || 0) + 1;
    seq = st.career.virtualSeq;
    prefix = sim.pick(st, pool.namePrefixes || ["未名"]);
    suffix = sim.pick(st, pool.nameSuffixes || ["计划"]);
    base = cloneStats(pool.baseStats);
    jitter = num(pool.statJitter, 0);
    for (i = 0; i < DIMS.length; i++) {
      k = DIMS[i];
      base[k] = num(base[k], 0) + (jitter ? sim.irand(st, -jitter, jitter) : 0);
      if (base[k] < 0) base[k] = 0;
    }
    title = {
      id: "virt-" + companyId + "-" + st.year + "-" + st.month + "-" + seq,
      companyId: companyId,
      publisherId: companyId,
      studioId: studioId || null,
      name: prefix + suffix,
      alias: (sim.pick(st, pool.aliasPrefixes || [prefix])) + (sim.pick(st, pool.aliasSuffixes || [suffix])),
      releaseYear: relY,
      releaseMonth: relM,
      score: num(pool.score, 7),
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

  sim.assignCareerProject = function (st, config) {
    var picked, pool, idleMax;
    sim.ensureCareerExtras(st);
    if (sim.careerPostLaunch(st)) return st;
    if (!st.career || !st.career.companyId) {
      if (st.career) {
        st.career.titleId = null;
        st.career.liveStats = null;
      }
      return st;
    }
    picked = sim.pickCareerAssignment(st.career.companyId, st.year, st.month, config, st, st.career.studioId);
    pool = sim.careerWorld(config).virtualPool || {};
    idleMax = num(pool.idleMaxMonths, 1);
    if (!picked) {
      if (st.career.titleId && sim.careerTitle(st.career.titleId, config, st)) {
        var cur = sim.careerTitle(st.career.titleId, config, st);
        var det = sim.careerTitleDetail(st.career.titleId, config, st);
        if (cur && det && sim.titleCoversMonth(cur, det, st.year, st.month) && !findWorldReleased(st, cur.id)) {
          return st;
        }
      }
      if (num(st.career.idleMonths, 0) >= idleMax) {
        picked = sim.startVirtualProject(st, config);
      } else {
        st.career.titleId = null;
        st.career.liveStats = null;
        return st;
      }
    }
    if (picked) st.career.idleMonths = 0;
    if (!picked) {
      st.career.titleId = null;
      st.career.liveStats = null;
      return st;
    }
    if (st.career.titleId !== picked.id) {
      st.career.titleId = picked.id;
      st.career.liveStats = liveFromTitle(st, picked, config);
      addCredit(st, picked.id);
    }
    if (!st.career.liveStats) st.career.liveStats = liveFromTitle(st, picked, config);
    return st;
  };

  function jitterStats(st, stats, variance) {
    var i, k, v;
    if (!variance) return;
    for (i = 0; i < DIMS.length; i++) {
      k = DIMS[i];
      v = num(stats[k], 0) + sim.irand(st, -variance, variance);
      if (v < 0) v = 0;
      stats[k] = v;
    }
  }

  sim.ensureCareerColleagues = function (st, config) {
    var world = sim.careerWorld(config);
    var names = (config.copy && config.copy.staffNamePool) || ["同事"];
    var companyId = st.career && st.career.companyId;
    var roleIds = ["producer", "programmer", "art", "design", "music"];
    var pool, title, base, variance, i, rid, stats, mate;
    if (!st.career || !companyId) {
      if (st.career) st.career.colleagues = [];
      return st;
    }
    if (!st.career.colleaguePool) st.career.colleaguePool = {};
    pool = st.career.colleaguePool[companyId];
    title = st.career.titleId ? sim.careerTitle(st.career.titleId, config, st) : null;
    base = (title && title.stats) || st.career.stats || {};
    variance = (world.colleagues && world.colleagues.statVariance) || 0;
    if (!pool) {
      pool = {};
      for (i = 0; i < roleIds.length; i++) {
        rid = roleIds[i];
        stats = cloneStats(base);
        jitterStats(st, stats, variance);
        pool[rid] = {
          id: "col-" + companyId + "-" + rid,
          n: sim.pick(st, names),
          roleId: rid,
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
    st.career.leftProjectLive[id] = cloneStats(live);
    title = sim.findById(virtualList(st, "virtualProjects"), id);
    if (title) title.stats = cloneStats(live);
    void config;
  }

  function stripPlayerCredit(st, titleId) {
    var list, rec, i;
    if (!titleId || !st.career) return;
    list = st.career.credits || [];
    for (i = list.length - 1; i >= 0; i--) {
      if (list[i].titleId === titleId) list.splice(i, 1);
    }
    rec = findWorldReleased(st, titleId);
    if (rec) rec.player = false;
  }

  function detachFromProject(st, config) {
    var id = st.career && st.career.titleId;
    persistProjectLive(st, config);
    if (id) stripPlayerCredit(st, id);
    st.career.titleId = null;
    st.career.liveStats = null;
    st.career.postLaunch = null;
  }

  function joinCompany(st, companyId, roleId, salary, titleId, config, studioId) {
    var co = sim.careerCompany(companyId, config);
    var studio = sim.careerStudio(companyId, studioId, config);
    st.career.companyId = companyId;
    st.career.studioId = (studio && studio.id) || sim.defaultStudioId(co);
    if (roleId) st.career.roleId = roleId;
    st.career.salary = salary != null ? salary : sim.careerSalaryFor(co, st.year, config, st.career);
    st.career.growthStage = "employee";
    st.career.yearEndOffers = [];
    st.career.invites = [];
    st.career.hopNotice = "";
    if (titleId) {
      st.career.titleId = titleId;
      st.career.liveStats = liveFromTitle(st, sim.careerTitle(titleId, config, st), config);
      addCredit(st, titleId);
      st.career.idleMonths = 0;
    } else {
      st.career.titleId = null;
      st.career.liveStats = null;
      sim.assignCareerProject(st, config);
    }
    sim.ensureCareerColleagues(st, config);
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
    joinCompany(st, offer.companyId, offer.roleId, offer.salary, null, config, offer.studioId);
    return sim.ok(st);
  };

  sim.careerInDev = function (state, config) {
    var view = sim.careerProjectView(state, config);
    return !!(view && !view.idle);
  };

  sim.canCareerHop = function (state, config) {
    var spec = sim.careerWorld(config).mobility || {};
    if (!state || !state.career || !state.career.companyId) return false;
    if (state.career.hopFailedYear === state.year) return false;
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

  function currentPhase(st, config) {
    var view = sim.careerProjectView(st, config);
    return view.phase;
  }

  sim.findCareerEventDef = function (config, eventId) {
    var world = sim.careerWorld(config);
    var list = ((world.devEvents) || {}).list || [];
    var hit = sim.findById(list, eventId);
    if (hit) return hit;
    return sim.findById(((world.postLaunch) || {}).events || [], eventId);
  };

  sim.rollCareerDevEvent = function (st, config, notes) {
    var spec = sim.careerWorld(config).devEvents || {};
    var chance = spec.chance;
    var phase = currentPhase(st, config);
    var list = spec.list || [];
    var pool = [];
    var i, ev, w, hit, fired;
    if (!st.career || !st.career.titleId || !st.career.liveStats) return null;
    if (sim.careerPostLaunch(st)) return null;
    if (chance == null || sim.rand(st) >= chance) return null;
    fired = st.career.firedTitleEvents || [];
    for (i = 0; i < list.length; i++) {
      ev = list[i];
      if (ev.titleId && ev.titleId !== st.career.titleId) continue;
      if (ev.titleId && fired.indexOf(ev.id) >= 0) continue;
      if (ev.role && ev.role !== st.career.roleId) continue;
      if (ev.phase && (!phase || ev.phase !== phase.id)) continue;
      if ((ev.presentation || "notice") === "choice") {
        if (!ev.choices || !ev.choices.length) continue;
      } else if (!ev.qualityDim) {
        continue;
      }
      w = 1;
      if (ev.titleId && ev.titleId === st.career.titleId) w += spec.titleWeightBonus || 0;
      pool.push({ ev: ev, weight: w });
    }
    if (!pool.length) return null;
    hit = sim.pickWeighted(st, pool);
    if (!hit || !hit.ev) return null;
    ev = hit.ev;
    if ((ev.presentation || "notice") !== "choice") {
      applyDimDeltas(st, ev.qualityDim, ev.qualityDelta, config);
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
      if ((ev.presentation || "notice") === "choice") {
        if (!ev.choices || !ev.choices.length) continue;
      }
      pool.push({ ev: ev, weight: ev.weight != null ? ev.weight : 1 });
    }
    if (!pool.length) return null;
    hit = sim.pickWeighted(st, pool);
    if (!hit || !hit.ev) return null;
    ev = hit.ev;
    if ((ev.presentation || "notice") !== "choice" && ev.qualityDim) {
      applyDimDeltas(st, ev.qualityDim, ev.qualityDelta, config);
      rec = findWorldReleased(st, st.career.titleId);
      if (rec) rec.stats = cloneStats(st.career.liveStats);
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
    var ev = sim.findCareerEventDef(config, eventId);
    var opt = null;
    var st;
    if (!ev) return sim.fail(state, sim.ERR.EVENT_NOT_FOUND);
    if ((ev.presentation || "notice") !== "choice") return sim.fail(state, sim.ERR.EVENT_NOT_CHOICE);
    (ev.choices || []).forEach(function (c) {
      if (c.id === optionId) opt = c;
    });
    if (!opt) return sim.fail(state, sim.ERR.EVENT_OPTION_INVALID);
    st = sim.clone(state);
    applyDimDeltas(st, opt.qualityDim, opt.qualityDelta, config);
    return { ok: true, state: st, optionId: optionId };
  };

  function careerAwardCandidate(g, config) {
    var stats = g.stats || {};
    var program = num(stats.program, 0);
    var design = num(stats.design, num(stats.script, 0));
    var art = num(stats.art, 0);
    var music = num(stats.music, 0);
    var score = g.score != null ? g.score : num(g.avg, 0);
    return {
      player: !!g.player,
      titleId: g.id,
      title: sim.worldLabel(g, config),
      label: sim.worldLabel(g, config),
      avg: score,
      score: score,
      qsum: program + design + art + music,
      stats: { program: program, design: design, script: design, art: art, music: music },
      prestige: num(g.prestige, 0),
      livePeak: sim.careerLivePeak(g, config),
      live: sim.isLiveOpsTitle(g),
      releaseType: g.releaseType,
      sales: g.sales
    };
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
    var won = 0;
    var nominated = 0;
    var nomCount = (config.awards && config.awards.nomineeCount) || 5;
    (st.career.credits || []).forEach(function (c) { credits[c.titleId] = true; });
    var awardPack = (config.awards.list || []).map(function (a) {
      var list = a.liveOnly ? livePool : pool;
      var noms, hit, playerNom, playerWin;
      noms = sim.pickAwardNominees(list, function (c) {
        return sim.scoreAwardCategory(c, a);
      }, a.nomineeCount || nomCount);
      hit = noms[0] || null;
      playerNom = noms.some(function (c) { return c.titleId && credits[c.titleId]; });
      playerWin = !!(hit && hit.titleId && credits[hit.titleId]);
      if (playerNom) {
        nominated += 1;
        st.career.fame = (st.career.fame || 0) + fameNom;
        st.career.honor = (st.career.honor || 0) + honorNom;
      }
      if (playerWin) {
        won += 1;
        st.career.fame = (st.career.fame || 0) + fameWin;
        st.career.honor = (st.career.honor || 0) + honorWin;
      }
      return {
        id: a.id,
        n: a.displayName,
        w: hit ? hit.label : "—",
        titleId: hit && hit.titleId,
        nominees: noms.map(function (c) {
          return { label: c.label, titleId: c.titleId, player: !!c.player };
        }),
        playerNominated: playerNom,
        playerWon: playerWin
      };
    });
    if (notes) {
      notes.push(won || nominated ? ("年度盛典：提名 " + nominated + " / 获奖 " + won) : "年度盛典");
    }
    st.lastAwards = awardPack;
    return awardPack;
  };

  sim.shipWorldTitlesThisMonth = function (st, config) {
    var titles = sim.allCareerTitles(config, st);
    var skip = st.career && st.career.titleId;
    titles.forEach(function (t) {
      var rec, leftover, credited;
      if (skip && t.id === skip) return;
      if (t.releaseYear === st.year && t.releaseMonth === st.month && !findWorldReleased(st, t.id)) {
        leftover = st.career && st.career.leftProjectLive && st.career.leftProjectLive[t.id];
        credited = (st.career.credits || []).some(function (c) { return c.titleId === t.id; });
        rec = pushWorldReleased(st, t, config, credited);
        if (leftover) rec.stats = cloneStats(leftover);
        rec.player = !!credited;
      }
    });
  };

  sim.liveStatsForMedia = function (live) {
    live = live || {};
    return {
      program: num(live.program, 0),
      script: num(live.design, num(live.script, 0)),
      design: num(live.design, num(live.script, 0)),
      art: num(live.art, 0),
      music: num(live.music, 0)
    };
  };

  sim.shipPlayerTitle = function (st, config, notes, queue) {
    var title = sim.careerTitle(st.career.titleId, config, st);
    var copy = sim.careerCopy(config);
    var avg, rec, label, media;
    if (!title) return;
    label = sim.worldLabel(title, config);
    avg = sim.liveToPublicScore(st.career.liveStats, title.score, config);
    rec = findWorldReleased(st, title.id);
    if (!rec) rec = pushWorldReleased(st, title, config, true);
    rec.player = true;
    rec.stats = cloneStats(st.career.liveStats || title.stats);
    rec.score = avg;
    rec.avg = avg;
    rec.liveStats = cloneStats(st.career.liveStats);
    rec.genreId = title.genreId;
    rec.gameplayId = title.gameplayId;
    media = sim.scoreMedia(st, sim.liveStatsForMedia(st.career.liveStats), [], config, null);
    rec.media = media;
    rec.title = label;
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
    }
    st.lastMedia = rec;
    grantPlayerTitleXp(st, title, num((sim.careerWorld(config).playerXp || {}).xpPerRelease, 0));
    persistProjectLive(st, config);
    (function beginPostLaunch() {
      var spec = sim.careerWorld(config).postLaunch || {};
      var min = spec.monthsMin;
      var max = spec.monthsMax;
      if (min == null || max == null) {
        st.career.titleId = null;
        st.career.liveStats = null;
        st.career.postLaunch = null;
        return;
      }
      st.career.postLaunch = {
        titleId: title.id,
        monthsLeft: sim.irand(st, min, max)
      };
    })();
  };

  sim.careerHireChance = function (company, state, config, studio) {
    var spec = sim.careerWorld(config).mobility || {};
    var sal = salarySpec(config);
    var power = company && company.power != null ? String(company.power) : "2";
    var base = (studio && studio.hireChance != null) ? studio.hireChance : (company && company.hireChance);
    var cr = state && state.career;
    var role = sim.careerRole(cr && cr.roleId, config);
    var mainStat = 0;
    var chance, min, max;
    if (base == null) base = (spec.hireChanceByPower && spec.hireChanceByPower[power]);
    if (base == null) base = 0.5;
    if (role && cr && cr.stats) mainStat = num(cr.stats[role.stat], 0);
    chance = base
      + num(cr && cr.fame, 0) * num(spec.fameHirePer, 0)
      + Math.max(0, mainStat - num(sal.statRef, 0)) * num(spec.statHirePer, 0);
    min = spec.hireChanceMin;
    max = spec.hireChanceMax;
    if (min != null && chance < min) chance = min;
    if (max != null && chance > max) chance = max;
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

  function makeHopOffer(st, config, co, studio, roleId, year, month, salaryYear, internal, index) {
    var title = sim.pickCareerAssignment(co.id, year, month, config, st, studio && studio.id);
    var chance = sim.careerHireChance(co, st, config, studio);
    return {
      id: "ye-" + year + "-" + index + "-" + co.id + "-" + ((studio && studio.id) || "x"),
      offerYear: year,
      companyId: co.id,
      studioId: studio && studio.id,
      studioName: studio ? sim.worldLabel(studio, config) : "",
      internal: !!internal,
      roleId: roleId,
      salary: sim.careerSalaryFor(co, salaryYear, config, st.career),
      currentSalary: (st.career && st.career.salary) || 0,
      titleId: title && title.id,
      titleName: title ? sim.worldLabel(title, config) : "",
      successChance: chance,
      successPct: Math.round(chance * 100)
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
    var roleId = state.career && state.career.roleId;
    var count = spec.offerCount != null ? spec.offerCount : 5;
    var internalMax = spec.internalOfferMax != null ? spec.internalOfferMax : 2;
    var salaryYear = year + (month === 12 ? 1 : 0);
    var curCo = sim.careerCompany(current, config);
    var out = [];
    var usedCo = {};
    var internals = [];
    var pool, i, s, co, studio, hiring;
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
      out.push(makeHopOffer(state, config, curCo, s, roleId, year, month, salaryYear, true, out.length));
    }
    hiring = companies.filter(function (c) {
      return !usedCo[c.id] && sim.companyJoinable(c, year);
    });
    while (out.length < count) {
      pool = hiring.filter(function (c) { return !usedCo[c.id]; });
      if (!pool.length) break;
      co = sim.pick(state, pool);
      usedCo[co.id] = true;
      studio = pickStudioForOffer(state, co, year, month, config);
      out.push(makeHopOffer(state, config, co, studio, roleId, year, month, salaryYear, false, out.length));
    }
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
    var roleId = state.career && state.career.roleId;
    var now = sim.monthIndex(state.year, state.month);
    var out = [];
    var i, d, t, w, co;
    for (i = 0; i < details.length; i++) {
      d = details[i];
      if (!d.inviteEligible || !d.inviteWindow) continue;
      if ((d.inviteRoles || []).indexOf(roleId) < 0) continue;
      if (num(d.inviteMinFame, 0) > fame) continue;
      w = d.inviteWindow;
      if (now < sim.monthIndex(w.startYear, w.startMonth) || now > sim.monthIndex(w.endYear, w.endMonth)) continue;
      if (state.career && state.career.titleId === d.id) continue;
      t = sim.findById(titles, d.id);
      if (!t) continue;
      if (state.career && t.companyId === state.career.companyId) continue;
      co = sim.careerCompany(t.companyId, config);
      if (!sim.companyJoinable(co, state.year)) continue;
      out.push({
        id: "inv-" + d.id,
        titleId: d.id,
        companyId: t.companyId,
        studioId: t.studioId || sim.defaultStudioId(co),
        roleId: roleId,
        minFame: d.inviteMinFame,
        salary: sim.careerSalaryFor(co, state.year, config, state.career),
        currentSalary: (state.career && state.career.salary) || 0,
        titleName: sim.worldLabel(t, config)
      });
    }
    return out;
  };

  function rollInvitesThisMonth(st, config) {
    var spec = sim.careerWorld(config).mobility || {};
    var max = spec.inviteMaxPerYear != null ? spec.inviteMaxPerYear : 1;
    var chance = spec.inviteChance;
    var eligible, picked;
    if (st.career.inviteYearStamp !== st.year) {
      st.career.inviteYearStamp = st.year;
      st.career.invitesRolledThisYear = 0;
    }
    eligible = sim.listCareerInvites(st, config);
    if (!eligible.length) return [];
    if (st.career.invitesRolledThisYear >= max) return st.career.invites || [];
    if (chance == null) chance = 1;
    if (sim.rand(st) >= chance) return st.career.invites || [];
    picked = sim.pick(st, eligible);
    st.career.invitesRolledThisYear += 1;
    st.career.invites = [picked];
    return st.career.invites;
  }

  sim.applyYearEndOffer = function (state, offerId, config) {
    var offer = null;
    var st, spec, copy, chance;
    if (!sim.isCareerMode(state)) return sim.fail(state, sim.ERR.CAREER_NOT_CAREER);
    if (state.career && state.career.hopFailedYear === state.year) {
      return sim.fail(state, sim.ERR.CAREER_HOP_WAIT);
    }
    (state.career.yearEndOffers || []).forEach(function (o) {
      if (o.id === offerId) offer = o;
    });
    if (!offer) return sim.fail(state, sim.ERR.CAREER_OFFER_NOT_FOUND);
    if (!sim.canCareerHop(state, config)) {
      return sim.fail(state, state.career.hopFailedYear === state.year ? sim.ERR.CAREER_HOP_WAIT : sim.ERR.CAREER_BUSY);
    }
    st = sim.clone(state);
    sim.ensureCareerExtras(st);
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
    st.career.hopNotice = copy.hopOkNotice || "跳槽成功。";
    joinCompany(st, offer.companyId, offer.roleId, offer.salary, offer.titleId, config, offer.studioId);
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
    var st, spec;
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
    joinCompany(st, invite.companyId, invite.roleId, invite.salary, invite.titleId, config, invite.studioId);
    return sim.ok(st);
  };

  sim.counterCareerInvite = function (state, inviteId, config) {
    var invite = null;
    var st, spec;
    if (!sim.isCareerMode(state)) return sim.fail(state, sim.ERR.CAREER_NOT_CAREER);
    (state.career.invites || []).forEach(function (o) {
      if (o.id === inviteId) invite = o;
    });
    if (!invite) return sim.fail(state, sim.ERR.CAREER_INVITE_NOT_FOUND);
    st = sim.clone(state);
    spec = sim.careerWorld(config).mobility || {};
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
    if (sim.listLiveOpsVersionDrops) {
      sim.listLiveOpsVersionDrops(st || { mode: "career" }, year, config).forEach(function (d) {
        if (!d.month) return;
        months[d.month] = months[d.month] || [];
        months[d.month].push(d);
      });
    }
    return { year: year, months: months };
  };

  function hopQueueItem(st, config) {
    var copy = sim.careerCopy(config);
    var offers = st.career.yearEndOffers || [];
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
        var co = sim.careerCompany(o.companyId, config);
        var studio = sim.careerStudio(o.companyId, o.studioId, config);
        var copyHop = copy;
        return {
          id: o.id,
          label: (o.internal ? ((copyHop.hopInternal || "内部调动") + " · ") : "") +
            (co ? sim.worldLabel(co, config) : o.companyId) +
            (studio ? (" / " + sim.worldLabel(studio, config)) : "") +
            " · " + (o.successPct != null ? o.successPct : Math.round((o.successChance || 0) * 100)) + "%" +
            " · " + o.currentSalary + "→" + o.salary +
            (o.titleName ? (" · " + o.titleName) : "")
        };
      }).concat([{ id: "stay", label: copy.hopStay || "先留下" }])
    };
  }

  function inviteQueueItem(invite, config) {
    var copy = sim.careerCopy(config);
    var co = sim.careerCompany(invite.companyId, config);
    var role = sim.careerRole(invite.roleId, config);
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
        "。现薪 " + invite.currentSalary + " / 新薪 " + invite.salary,
      options: [
        { id: "accept", label: copy.inviteAccept || "跳槽加入" },
        { id: "counter", label: copy.inviteCounter || "现公司还价" },
        { id: "decline", label: copy.inviteDecline || "留下" }
      ]
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
    var firedEvent = null;
    var pay, living, co, view, phaseLabel, role, invites, supporting, titleNow, xpSpec, contrib;

    sim.ensureCareerExtras(st);
    if (st.career && st.career.companyId && !st.career.studioId) {
      st.career.studioId = sim.defaultStudioId(sim.careerCompany(st.career.companyId, config));
    }
    supporting = !!sim.careerPostLaunch(st);
    view = sim.careerProjectView(st, config);
    xpSpec = world.playerXp || {};
    titleNow = st.career.titleId ? sim.careerTitle(st.career.titleId, config, st) : null;
    if (supporting && st.career.liveStats) {
      grantPlayerTitleXp(st, titleNow, num(xpSpec.xpPerPostLaunchMonth, 0));
      firedEvent = sim.rollPostLaunchEvent(st, config, notes);
      if (firedEvent && (firedEvent.presentation || "notice") === "choice") {
        queue.push(careerEventQueueItem(firedEvent, copy));
      }
      phaseLabel = view.phase ? sim.worldLabel(view.phase, config) : "";
      if (phaseLabel) notes.push((copy.phasePrefix || "阶段") + " " + phaseLabel);
    } else if (!view.idle && st.career.liveStats) {
      role = sim.careerRole(st.career.roleId, config);
      contrib = sim.careerMonthlyContribution(st, config);
      if (role && role.stat && contrib) {
        sim.applyCareerLiveDelta(st, role.stat, contrib, config);
      }
      grantPlayerTitleXp(st, titleNow, num(xpSpec.xpPerDevMonth, 0));
      firedEvent = sim.rollCareerDevEvent(st, config, notes);
      if (firedEvent && (firedEvent.presentation || "notice") === "choice") {
        queue.push(careerEventQueueItem(firedEvent, copy));
      }
      phaseLabel = view.phase ? sim.worldLabel(view.phase, config) : "";
      if (phaseLabel) notes.push((copy.phasePrefix || "阶段") + " " + phaseLabel);
    }

    sim.shipWorldTitlesThisMonth(st, config);
    if (sim.applyLiveOpsVersion) {
      (st.worldReleased || []).forEach(function (g) {
        sim.applyLiveOpsVersion(st, g, config, notes, null);
      });
    }

    if (st.career.titleId && !sim.careerPostLaunch(st)) {
      view = sim.careerTitle(st.career.titleId, config, st);
      if (view && view.releaseYear === st.year && view.releaseMonth === st.month) {
        sim.shipPlayerTitle(st, config, notes, queue);
      }
    }

    pay = st.career.salary || 0;
    st.career.lastPay = pay;
    st.career.savings = (st.career.savings || 0) + pay;
    if (eco.deductLivingCost) {
      living = sim.careerLivingCost(st.year, config);
      st.career.savings -= living;
    }
    st.company.funds = st.career.savings;

    if (st.phase === "PLAYING" && st.month === (config.awards.month || 11)) {
      awardPack = sim.runCareerAwards(st, config, notes);
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
    sim.assignCareerProject(st, config);
    sim.ensureCareerColleagues(st, config);

    if (st.phase === "PLAYING" && (st.year > cal.endYear || (st.year === cal.endYear && st.month > cal.endMonth))) {
      st.phase = "SETTLED";
    }

    if (awardPack) {
      queue.push({
        type: "awards",
        kind: "event",
        kicker: copy.awardKicker || "年度盛典",
        title: copy.awardTitle || "颁奖夜",
        body: copy.awardBody || "",
        awards: awardPack
      });
    }
    return { state: st, queue: queue };
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
