/* career-events.js —— 自 career.js 迁出的独立域（开发事件 / 发售后期事件 / 选项结算（P4 req 门禁落点））。
   跨域纯工具从 career.js 的共享基座 sim._ 取用，见 scripts/split_career.py。 */
(function (root) {
  var sim = root.GDS.sim;

  // 共享基座绑定（career.js 先加载，此处仅取引用，勿重复定义）
  var DIMS, cloneStats, findWorldReleased, idleGapSpec, isArr, jobRankSpec, num, rankTableVal, scaleQualityAmount;
  (function bindShared() {
    var _ = sim._ || (sim._ = {});
    DIMS = _.DIMS;
    cloneStats = _.cloneStats;
    findWorldReleased = _.findWorldReleased;
    idleGapSpec = _.idleGapSpec;
    isArr = _.isArr;
    jobRankSpec = _.jobRankSpec;
    num = _.num;
    rankTableVal = _.rankTableVal;
    scaleQualityAmount = _.scaleQualityAmount;
  })();

  // ── 以下符号自 career.js 原样迁出（行序保持）──────────────────

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
    if (num(opt.healthDelta, 0)) sim.applyCareerHealthDelta(st, num(opt.healthDelta, 0), config);
    gap = st.career.idleGap || {};
    nextTitle = gap.nextTitleId ? sim.careerTitle(gap.nextTitleId, config, st) : sim.nextCatalogTitle(st, config, st.career.companyId, st.career.studioId);
    applyPlayerSkillFx(st, opt, config, nextTitle);
  }


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
      if (ev.manualOnly) continue; // 关怀拍等只由触发器投递，不进随机池
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


  // P7 speaker: cast-backed speaker for dev events, follows careerWorld.nameMode.
  function speakerFallback(spec, config) {
    var copy = sim.careerCopy(config) || {};
    if (spec && spec.fallback) return spec.fallback;
    return copy.eventSpeakerFallback || "";
  }

  sim.eventSpeakerName = function (ev, st, config) {
    var spec, roleId, p;
    if (!ev || !ev.speakerCast || !st || !st.career) return "";
    spec = ev.speakerCast;
    roleId = spec.roleId || ev.role || st.career.roleId;
    p = sim.castFor({ companyId: st.career.companyId, roleId: roleId, year: st.year }, config);
    if (p) return sim.castName(p, config);
    return speakerFallback(spec, config);
  };

  sim.eventSpeakerFill = function (text, name) {
    if (!text || !name) return text;
    return String(text).split("{speaker}").join(name);
  };

  // P7 callback: an option writes a flag, the matching echo event is queued N months later.
  // Delay is hashed (never sim.rand) so it stays deterministic and consumes no RNG.
  function callbackHash(s) {
    var h = 2166136261, i;
    s = String(s);
    for (i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h;
  }

  function careerEventFlags(st) {
    if (!st.career.eventFlags) st.career.eventFlags = {};
    return st.career.eventFlags;
  }

  function pendingCallbackIndex(st, eventId) {
    var list = st.career.pendingCallbacks || [], i;
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].eventId === eventId) return i;
    }
    return -1;
  }

  sim.scheduleEventCallbacks = function (st, config, setFlags) {
    var list, i, ev, min, max, span, delay, now;
    if (!st || !st.career || !setFlags) return 0;
    list = ((sim.careerWorld(config).devEvents) || {}).list || [];
    now = sim.monthIndex(st.year, st.month);
    for (i = 0; i < list.length; i++) {
      ev = list[i];
      if (!ev.triggerFlag || !setFlags[ev.triggerFlag]) continue;
      if (pendingCallbackIndex(st, ev.id) >= 0) continue;
      if ((st.career.firedCallbacks || []).indexOf(ev.id) >= 0) continue;
      if (!st.career.pendingCallbacks) st.career.pendingCallbacks = [];
      min = num(ev.triggerDelayMonths && ev.triggerDelayMonths[0], 3);
      max = num(ev.triggerDelayMonths && ev.triggerDelayMonths[1], min);
      span = max - min;
      delay = min + (span > 0 ? (callbackHash(ev.id + "|" + st.career.companyId + "|" + now) % (span + 1)) : 0);
      st.career.pendingCallbacks.push({ eventId: ev.id, due: now + delay });
    }
    return (st.career.pendingCallbacks || []).length;
  };

  sim.dueEventCallback = function (st, config) {
    var pending, i, now, ev, item;
    if (!st || !st.career) return null;
    pending = st.career.pendingCallbacks;
    if (!pending || !pending.length) return null;
    now = sim.monthIndex(st.year, st.month);
    for (i = 0; i < pending.length; i++) {
      item = pending[i];
      if (!item || item.due > now) continue;
      pending.splice(i, 1);
      ev = sim.findById(((sim.careerWorld(config).devEvents) || {}).list || [], item.eventId);
      if (!ev || (st.career.firedCallbacks || []).indexOf(ev.id) >= 0) {
        i -= 1;
        continue;
      }
      if (!st.career.firedCallbacks) st.career.firedCallbacks = [];
      st.career.firedCallbacks.push(ev.id);
      return ev;
    }
    return null;
  };

  sim.resolveCareerEventChoice = function (state, eventId, optionId, config) {
    var ev, opt, st, parts, k, flags;
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
    if (num(opt.healthDelta, 0)) sim.applyCareerHealthDelta(st, num(opt.healthDelta, 0), config);
    if (opt.setFlags) {
      flags = careerEventFlags(st);
      for (k in opt.setFlags) {
        if (Object.prototype.hasOwnProperty.call(opt.setFlags, k)) flags[k] = opt.setFlags[k];
      }
      sim.scheduleEventCallbacks(st, config, opt.setFlags);
    }
    return { ok: true, state: st, optionId: optionId };
  };

})(typeof globalThis !== "undefined" ? globalThis : this);
