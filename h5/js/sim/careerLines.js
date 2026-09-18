(function (root) {
  var sim = root.GDS.sim;
  var DIMS = ["program", "design", "art", "music"];

  function num(v, d) {
    v = Number(v);
    return isFinite(v) ? v : (d != null ? d : 0);
  }

  function eventLinesSpec(config) {
    return (sim.careerWorld(config).eventLines) || {};
  }

  function producerSpec(config) {
    return (sim.careerWorld(config).producerCareer) || {};
  }

  function lineDefs(config) {
    return eventLinesSpec(config).lines || [];
  }

  function findLineDef(config, lineId) {
    return sim.findById(lineDefs(config), lineId);
  }

  function lineProgress(st, lineId) {
    if (!st || !st.career) return null;
    if (!st.career.lines) st.career.lines = {};
    return st.career.lines[lineId] || null;
  }

  function ensureLineProgress(st, lineId) {
    if (!st.career.lines) st.career.lines = {};
    if (!st.career.lines[lineId]) {
      st.career.lines[lineId] = {
        beat: 0,
        flags: {},
        startedAt: null,
        status: "active",
        waitUntil: null,
        waitingFor: null,
        pending: false,
        abortedYear: null,
        remotePending: false,
        waitUntilYear: null
      };
    }
    return st.career.lines[lineId];
  }

  sim.isCareerProducer = function (state) {
    var cr = state && state.career;
    return !!(cr && (cr.roleId === "producer" || cr.growthStage === "producer"));
  };

  sim.hasCompletedBecomeProducerLine = function (state, config) {
    var def = findLineDef(config, "become-producer") ||
      lineDefs(config).filter(function (l) { return l.kind === "becomeProducer"; })[0];
    var mob = (sim.careerWorld(config).mobility) || {};
    var lineId;
    var prog;
    if (mob.producerOfferLineId) {
      def = findLineDef(config, mob.producerOfferLineId) || def;
    }
    lineId = def && def.id;
    if (!lineId || !state || !state.career || !state.career.lines) return false;
    prog = state.career.lines[lineId];
    return !!(prog && prog.status === "done");
  };

  sim.careerProducerSpec = producerSpec;

  sim.eventLineDefs = lineDefs;

  sim.findEventLineDef = findLineDef;

  function linePriority(def) {
    return num(def && def.priority, 0);
  }

  function lineGroup(def) {
    return (def && def.exclusiveGroup) || null;
  }

  sim.activeCareerLineIds = function (state) {
    var lines, id, row, out;
    out = [];
    if (!state || !state.career || !state.career.lines) return out;
    lines = state.career.lines;
    for (id in lines) {
      if (!Object.prototype.hasOwnProperty.call(lines, id)) continue;
      row = lines[id];
      if (row && row.status === "active") out.push(id);
    }
    return out;
  };

  sim.activeCareerLineId = function (state, config) {
    var ids = sim.activeCareerLineIds(state);
    var best = null;
    var bestPri = -1;
    var i, def, pri;
    if (!ids.length) return null;
    if (!config) return ids[0];
    for (i = 0; i < ids.length; i++) {
      def = findLineDef(config, ids[i]);
      pri = linePriority(def);
      if (best == null || pri > bestPri) {
        best = ids[i];
        bestPri = pri;
      }
    }
    return best;
  };

  sim.hasActiveCareerLine = function (state) {
    return sim.activeCareerLineIds(state).length > 0;
  };

  sim.hasPendingCareerLine = function (state) {
    var ids, i, prog;
    ids = sim.activeCareerLineIds(state);
    for (i = 0; i < ids.length; i++) {
      prog = lineProgress(state, ids[i]);
      if (prog && prog.pending) return true;
    }
    return false;
  };

  sim.hasActiveExclusiveGroup = function (state, group, config) {
    var ids, i, def;
    if (!group) return false;
    ids = sim.activeCareerLineIds(state);
    for (i = 0; i < ids.length; i++) {
      def = findLineDef(config, ids[i]);
      if (lineGroup(def) === group) return true;
    }
    return false;
  };

  function exclusiveBlocked(st, def, config) {
    var group = lineGroup(def);
    var ids, i, other;
    if (!group) return false;
    ids = sim.activeCareerLineIds(st);
    for (i = 0; i < ids.length; i++) {
      if (ids[i] === def.id) continue;
      other = findLineDef(config, ids[i]);
      if (lineGroup(other) === group) return true;
    }
    return false;
  }

  function reopenOk(prog, def, st) {
    var reopen = def.reopen;
    if (!prog) return true;
    if (prog.status === "done") return false;
    if (prog.status === "active") return false;
    if (prog.status === "aborted") {
      if (reopen === false) return false;
      reopen = reopen || {};
      if (reopen.nextCalendarYear) {
        return prog.abortedYear == null || num(prog.abortedYear, 0) < st.year;
      }
      return true;
    }
    return true;
  }

  function producerLineDef(config) {
    return findLineDef(config, "become-producer") ||
      lineDefs(config).filter(function (l) { return l.kind === "becomeProducer"; })[0];
  }

  function producerAskCap(config) {
    var def = producerLineDef(config);
    if (def && def.maxAsks != null) return num(def.maxAsks, 2);
    if (def && def.reopen && def.reopen.maxAsks != null) return num(def.reopen.maxAsks, 2);
    return num(eventLinesSpec(config).becomeProducerMaxAsks, 2);
  }

  function producerAsksUsed(st) {
    return num(st && st.career && st.career.producerAskCount, 0);
  }

  function producerAsksExhausted(st, config) {
    return producerAsksUsed(st) >= producerAskCap(config);
  }

  function noteProducerAsk(st) {
    if (!st || !st.career) return;
    if (st.career.producerAskYear === st.year && st.career.producerAskMonth === st.month) return;
    st.career.producerAskCount = producerAsksUsed(st) + 1;
    st.career.producerAskYear = st.year;
    st.career.producerAskMonth = st.month;
  }

  function isProducerAskBeat(def, beat) {
    if (!def || !beat || def.kind !== "becomeProducer") return false;
    return beat.id === (def.askBeatId || "invite");
  }

  sim.canStartBecomeProducerLine = function (state, config, opts) {
    var cr = state && state.career;
    var def = producerLineDef(config);
    var minRank, prog;
    opts = opts || {};
    if (!sim.isCareerMode(state) || !cr || !cr.companyId) return false;
    if (sim.isCareerProducer(state)) return false;
    if (!def) return false;
    if (producerAsksExhausted(state, config)) return false;
    minRank = def.minRank != null ? def.minRank : num(producerSpec(config).minJobRank, 4);
    if (!opts.ignoreMinRank && !opts.mentorSponsor && sim.careerJobRank(cr, config) < minRank) return false;
    if (exclusiveBlocked(state, def, config)) return false;
    prog = lineProgress(state, def.id);
    return reopenOk(prog, def, state);
  };

  sim.promotionEventLineDef = function (state, config) {
    var rank = sim.careerJobRank(state && state.career, config);
    var list = lineDefs(config);
    var i, def;
    for (i = 0; i < list.length; i++) {
      def = list[i];
      if (def.kind === "promotion" && def.fromRank === rank) return def;
    }
    return null;
  };

  sim.promotionUsesEventLine = function (state, config) {
    return !!sim.promotionEventLineDef(state, config);
  };

  sim.canStartPromotionLine = function (state, config) {
    var def = sim.promotionEventLineDef(state, config);
    var prog;
    if (!def) return false;
    if (!sim.canPromoteCareer(state, config)) return false;
    if (sim.isCareerProducer(state)) return false;
    if (exclusiveBlocked(state, def, config)) return false;
    prog = lineProgress(state, def.id);
    return reopenOk(prog, def, state);
  };

  function bondRecord(st, role) {
    return st && st.career && st.career.bonds ? st.career.bonds[role] : null;
  }

  function bondDisplayName(st, role) {
    var b = bondRecord(st, role);
    if (!b) return "";
    if (role === "junior") {
      if (b.revealed && b.aliasNow) return b.aliasNow;
      return b.aliasThen || b.aliasNow || "";
    }
    return b.alias || b.name || "";
  }

  function speakerLabel(st, beat, config) {
    var co, seniors, i, s, tag, bond, senior;
    if (!beat) return "";
    if (beat.speaker) return String(beat.speaker);
    if (beat.speakerBond) {
      bond = bondRecord(st, beat.speakerBond);
      if (beat.speakerBond === "junior" && bond) {
        return bondDisplayName(st, "junior");
      }
      if (bond && (bond.alias || bond.name)) {
        return (bond.alias || bond.name) + (bond.title ? (" · " + bond.title) : "");
      }
    }
    tag = beat.speakerSeniorTag || beat.speakerSeniorId;
    if (!tag) return "";
    if (beat.speakerSeniorId && sim.findCareerSeniorById) {
      senior = sim.findCareerSeniorById(beat.speakerSeniorId, config);
      if (senior) return sim.careerSeniorLabel(senior, config);
    }
    co = sim.careerCompany(st.career && st.career.companyId, config);
    seniors = sim.careerSeniors(co, config);
    for (i = 0; i < seniors.length; i++) {
      s = seniors[i];
      if (beat.speakerSeniorId && s.id === beat.speakerSeniorId) {
        return sim.careerSeniorLabel(s, config);
      }
      if (beat.speakerSeniorTag && (s.tags || []).indexOf(beat.speakerSeniorTag) >= 0) {
        return sim.careerSeniorLabel(s, config);
      }
    }
    if (seniors.length) return sim.careerSeniorLabel(seniors[0], config);
    return "";
  }

  function lineBondRole(def) {
    if (!def) return null;
    if (def.bond) return def.bond;
    if (def.startWhen && def.startWhen.requireBond) return def.startWhen.requireBond;
    if (def.ensureBond) return def.ensureBond;
    if (def.id === "bond-mentor") return "mentor";
    if (def.id === "bond-peer") return "peer";
    if (def.id === "bond-junior") return "junior";
    return null;
  }

  function lineBond(st, def) {
    return bondRecord(st, lineBondRole(def));
  }

  function isLineColocated(st, def) {
    var b = lineBond(st, def);
    if (!b) return !!(st.career && st.career.companyId);
    return b.colocated !== false;
  }

  function fillBody(text, st, config) {
    var view, title, co, succ, peer, mentor, companySucc;
    text = text || "";
    view = sim.careerPromotionView(st, config);
    text = text.replace(/\{currentLabel\}/g, view.currentLabel || "");
    text = text.replace(/\{nextLabel\}/g, view.nextLabel || "");
    text = text.replace(/\{name\}/g, (st.career && st.career.characterName) || "");
    text = text.replace(/\{mentorName\}/g, bondDisplayName(st, "mentor"));
    text = text.replace(/\{peerName\}/g, bondDisplayName(st, "peer"));
    text = text.replace(/\{juniorName\}/g, bondDisplayName(st, "junior"));
    mentor = bondRecord(st, "mentor");
    succ = mentor && mentor.successorCompanyId ? sim.careerCompany(mentor.successorCompanyId, config) : null;
    text = text.replace(/\{successorCompany\}/g, succ ? sim.worldLabel(succ, config) : "");
    co = st.career ? sim.careerCompany(st.career.companyId, config) : null;
    companySucc = co && co.successorId ? sim.careerCompany(co.successorId, config) : null;
    text = text.replace(/\{companySuccessor\}/g, companySucc ? sim.worldLabel(companySucc, config) : "");
    peer = bondRecord(st, "peer");
    title = null;
    if (peer && peer.epicTitleId) title = sim.careerTitle(peer.epicTitleId, config, st);
    if (!title && st.career && st.career.titleId) title = sim.careerTitle(st.career.titleId, config, st);
    text = text.replace(/\{titleName\}/g, title ? sim.worldLabel(title, config) : "");
    text = text.replace(/\{companyName\}/g, co ? sim.worldLabel(co, config) : "");
    if (peer && peer.epicCompanyId) {
      co = sim.careerCompany(peer.epicCompanyId, config);
      text = text.replace(/\{epicCompany\}/g, co ? sim.worldLabel(co, config) : "");
    } else {
      text = text.replace(/\{epicCompany\}/g, "");
    }
    return text;
  }

  // 后辈电话的准入：他所在的公司必须**已经成立**、且**当月确有在研目录作**，
  // 「某天深夜一个陌生号码打来」这通电话才站得住——他得有拿得出手的新作。
  // 只按作品窗口判不够：暖暖环游世界的开发期从 2012-06 起，而叠纸 2013 才成立，
  // 不判成立年就会造出「他 2012 年就在叠纸做暖暖」。
  // 返回 null = 没有绑定（配置异常）→ 调用方放行，避免把线永久卡死。
  function juniorCallGate(st, config) {
    var spec = eventLinesSpec(config);
    var rule = (spec.bonds || {}).juniorCall || {};
    var junior = bondRecord(st, "junior");
    var co;
    if (!junior || !junior.revealCompanyId) return null;
    co = sim.careerCompany(junior.revealCompanyId, config);
    if (!co) return null;
    if (rule.requireFounded !== false && st.year < num(co.foundedYear, 0)) return false;
    if (rule.requireInDev !== false && sim.companyInDevCatalogTitle &&
        !sim.companyInDevCatalogTitle(junior.revealCompanyId, st, config, null)) {
      return false;
    }
    return true;
  }

  // 那家公司是不是「再也不会有新作在研了」：已成立、当月没活，且它所有目录作的
  // 发售月都已过去。用来收掉等不到的电话——线不能永久挂在 call 拍上。
  // 必须 RNG-free（skipIf 用）；没有绑定、或无法判定时不跳（返回 false）。
  function juniorCallWindowGone(st, config) {
    var junior = bondRecord(st, "junior");
    var gate, co, titles, i, t, last, idx;
    if (!junior || !junior.revealCompanyId) return false;
    co = sim.careerCompany(junior.revealCompanyId, config);
    if (!co) return false;
    if (st.year < num(co.foundedYear, 0)) return false;
    gate = juniorCallGate(st, config);
    if (gate === null || gate === true) return false;
    titles = sim.careerWorld(config).titles || [];
    last = null;
    for (i = 0; i < titles.length; i++) {
      t = titles[i];
      if (!t || t.virtual || t.companyId !== junior.revealCompanyId) continue;
      if (t.releaseYear == null) continue;
      idx = sim.monthIndex(t.releaseYear, t.releaseMonth || 1);
      if (last == null || idx > last) last = idx;
    }
    if (last == null) return false;
    return sim.monthIndex(st.year, st.month) > last;
  }

  function beatWaitReady(st, prog, beat, config) {
    var wait, now, hopMonth, mentor, peer, title, spec, minYear;
    if (!beat) return false;
    if (prog.pending) return false;
    wait = beat.wait || { type: "immediate" };
    if (wait.type === "immediate" || wait.type === "sameMonthChain") return true;
    if (wait.type === "months") {
      if (prog.waitUntil == null) return false;
      now = sim.monthIndex(st.year, st.month);
      if (now < num(prog.waitUntil, 0)) return false;
      // 后辈电话：等够了还要把门（公司已成立 + 当月有在研目录作）。每月复查，
      // 不满足就继续挂在这一拍上；彻底没活时由 skipIf.juniorCallGone 收掉。
      if (wait.juniorInDev && juniorCallGate(st, config) === false) return false;
      if (wait.pathClearOrNextYear) {
        if (sim.isCareerProducer(st) || sim.careerJobRank(st.career, config) < 3) return true;
        if (!sim.hasActiveExclusiveGroup(st, "careerPath", config)) return true;
        if (prog.waitUntilYear == null) prog.waitUntilYear = st.year;
        return st.year > num(prog.waitUntilYear, st.year);
      }
      return true;
    }
    if (wait.type === "onShip") {
      return prog.waitingFor === "shipReady";
    }
    if (wait.type === "yearEnd") {
      hopMonth = ((sim.careerWorld(config).mobility) || {}).hopMonth || 12;
      return st.month === hopMonth && prog.waitingFor === "yearEndReady";
    }
    if (wait.type === "promotionEligible") {
      return sim.canPromoteCareer(st, config);
    }
    if (wait.type === "yearAtLeast") {
      return st.year >= num(wait.year, 0);
    }
    if (wait.type === "pathClearOrNextYear") {
      if (sim.isCareerProducer(st) || sim.careerJobRank(st.career, config) < 3) return true;
      if (!sim.hasActiveExclusiveGroup(st, "careerPath", config)) return true;
      if (prog.waitUntilYear != null && st.year > num(prog.waitUntilYear, st.year)) return true;
      return false;
    }
    if (wait.type === "onShipOrMonths") {
      if (prog.waitingFor === "shipReady") return true;
      if (prog.waitUntil == null) return false;
      now = sim.monthIndex(st.year, st.month);
      return now >= num(prog.waitUntil, 0);
    }
    if (wait.type === "bondDepart") {
      mentor = bondRecord(st, wait.bond || "mentor");
      if (!mentor || !mentor.successorCompanyId) return false;
      if (!(mentor.departYear == null || st.year >= num(mentor.departYear, 0))) return false;
      // 准入：前辈的新东家当月得真有在研目录作才开这一拍。否则"跟着走"＝进空窗，
      // 过月就被判空窗、一两个月后被塞一部虚拟作。没活就先挂着，等它有活再拍。
      if (sim.mobilityRequireInDevTitle && sim.mobilityRequireInDevTitle(config, "scripted") &&
          sim.companyInDevCatalogTitle && !sim.companyInDevCatalogTitle(mentor.successorCompanyId, st, config, null)) {
        return false;
      }
      return true;
    }
    if (wait.type === "peerEpicReady") {
      spec = ((eventLinesSpec(config).bonds) || {}).peerEpic || {};
      minYear = spec.minYear != null ? spec.minYear : 2004;
      if (st.year < minYear) return false;
      peer = bondRecord(st, "peer");
      if (peer && peer.epicTitleId) return true;
      title = null;
      if (sim.applyScriptedCareerInvite) {
        /* pick is done at join; readiness = a joinable landmark exists elsewhere */
        (function findEpic() {
          var titles = sim.careerWorld(config).titles || [];
          var minP = spec.minPrestige != null ? spec.minPrestige : 4;
          var i, t, co;
          for (i = 0; i < titles.length; i++) {
            t = titles[i];
            if (!t || t.virtual) continue;
            if (spec.landmarkOnly !== false && !t.landmark) continue;
            if (num(t.prestige, 0) < minP) continue;
            if (st.career && t.companyId === st.career.companyId) continue;
            co = sim.careerCompany(t.companyId, config);
            if (!sim.companyJoinable(co, st.year)) continue;
            if (sim.mobilityRequireInDevTitle && sim.mobilityRequireInDevTitle(config, "scripted")) {
              // 只认当月正在开发的史诗作（与 sim.pickPeerEpicTarget 同规则）。
              if (!sim.titleCoversMonth(t, sim.careerTitleDetail(t.id, config, st), st.year, st.month)) continue;
            } else if (t.releaseYear != null && t.releaseYear < st.year) {
              continue;
            }
            title = t;
            break;
          }
        })();
      }
      if (title && peer) {
        peer.epicTitleId = title.id;
        peer.epicCompanyId = title.companyId;
      }
      return !!title;
    }
    return true;
  }

  function skipCondHits(skip, st, def, beat, prog, config) {
    var mentor, rank, key, roll;
    if (!skip) return false;
    rank = sim.careerJobRank(st.career, config);
    if (skip.noMentorSuccessor) {
      mentor = bondRecord(st, "mentor");
      if (!(mentor && mentor.successorCompanyId)) return true;
    }
    if (skip.noJunior && !bondRecord(st, "junior")) return true;
    // 后辈身份已经揭晓过就不再重复演一遍（回国线是"兜底"路径，后辈线自己会收束）
    if (skip.juniorRevealed && (bondRecord(st, "junior") || {}).revealed) return true;
    // 后辈那家已经不出新作了 → 这通电话不会来。与 wait.juniorInDev 互补：
    // 一个负责"等到他有新作"，一个负责"永远没有就别把线永久挂着"。必须 RNG-free。
    if (skip.juniorCallGone && juniorCallWindowGone(st, config)) return true;
    if (skip.notHeld && (!prog.flags || !prog.flags.held)) return true;
    if (skip.notCollapse && (!prog.flags || !prog.flags.collapse)) return true;
    if (skip.flagOff && (!prog.flags || !prog.flags[skip.flagOff])) return true;
    if (skip.flagOn && prog.flags && prog.flags[skip.flagOn]) return true;
    if (skip.colocated && isLineColocated(st, def)) return true;
    if (skip.notColocated && !isLineColocated(st, def)) return true;
    if (skip.isProducer && sim.isCareerProducer(st)) return true;
    if (skip.notProducer && !sim.isCareerProducer(st)) return true;
    if (skip.careerPathOccupied && sim.hasActiveExclusiveGroup(st, "careerPath", config)) return true;
    if (skip.noOtherStudio && !(sim.careerHasOtherStudio && sim.careerHasOtherStudio(st, config))) return true;
    // offer/邀约的准入：没有"当月真有在研目录作"的落点时，干脆不给这个选项
    //（否则点了要么原地不动、要么进空窗被塞虚拟作）。判定函数都要求 RNG-free。
    if (skip.noOtherStudioInDev && !(sim.careerOtherStudioPool && sim.careerOtherStudioPool(st, config).length)) return true;
    if (skip.noStrongHopTarget && !(sim.hasStrongHopTarget && sim.hasStrongHopTarget(st, config))) return true;
    if (skip.noPeerEpicTarget && !(sim.hasPeerEpicTarget && sim.hasPeerEpicTarget(st, config))) return true;
    if (skip.noJoinableEmployer && !(st.career && st.career.companyId && sim.careerEmployerJoinable && sim.careerEmployerJoinable(st, config))) return true;
    if (skip.hasJoinableEmployer && st.career && st.career.companyId && sim.careerEmployerJoinable && sim.careerEmployerJoinable(st, config)) return true;
    if (skip.noCompany && !(st.career && st.career.companyId)) return true;
    if (skip.hasCompany && st.career && st.career.companyId) return true;
    if (skip.jobRankLt != null && rank < num(skip.jobRankLt, 0)) return true;
    if (skip.jobRankLte != null && rank <= num(skip.jobRankLte, 0)) return true;
    if (skip.jobRankGte != null && rank >= num(skip.jobRankGte, 0)) return true;
    if (skip.jobRankGt != null && rank > num(skip.jobRankGt, 0)) return true;
    if (skip.chance != null) {
      key = "skipRoll:" + ((beat && beat.id) || "opt");
      if (!prog.flags) prog.flags = {};
      if (prog.flags[key] == null) prog.flags[key] = sim.rand(st);
      roll = num(prog.flags[key], 1);
      if (roll >= num(skip.chance, 1)) return true;
    }
    void beat;
    return false;
  }

  function beatShouldSkip(st, def, beat, prog, config) {
    return skipCondHits(beat && beat.skipIf, st, def, beat, prog, config);
  }

  function advanceSkippedBeats(st, def, prog, config) {
    var beats = def.beats || [];
    var beat;
    while (prog.status === "active" && prog.beat < beats.length) {
      beat = beats[prog.beat];
      if (!beatShouldSkip(st, def, beat, prog, config)) break;
      if (beat.complete || prog.beat >= beats.length - 1) {
        completeLine(prog, "done", st);
        return;
      }
      prog.beat += 1;
      armWaitAfterAdvance(st, prog, beats[prog.beat]);
    }
  }

  function armWaitAfterAdvance(st, prog, nextBeat) {
    var wait, n;
    prog.waitingFor = null;
    prog.waitUntil = null;
    if (!nextBeat) return;
    wait = nextBeat.wait || { type: "immediate" };
    if (wait.type === "months") {
      n = num(wait.n, 1);
      prog.waitUntil = sim.monthIndex(st.year, st.month) + n;
      if (wait.pathClearOrNextYear) prog.waitUntilYear = null;
    } else if (wait.type === "onShip") {
      prog.waitingFor = "ship";
    } else if (wait.type === "yearEnd") {
      prog.waitingFor = "yearEnd";
    } else if (wait.type === "pathClearOrNextYear") {
      prog.waitUntilYear = st.year;
    } else if (wait.type === "onShipOrMonths") {
      n = num(wait.n, 1);
      prog.waitUntil = sim.monthIndex(st.year, st.month) + n;
      prog.waitingFor = "ship";
    }
  }

  function optionVisible(st, def, opt, config) {
    var prog;
    if (!opt) return false;
    if (opt.ifProducerOffer) {
      if (def && def.allowProducerInvite) return true;
      if (opt.allowProducerInvite) return true;
      return !!(sim.hasCompletedBecomeProducerLine && sim.hasCompletedBecomeProducerLine(st, config));
    }
    prog = def && def.id ? lineProgress(st, def.id) : { flags: {} };
    if (!prog) prog = { flags: {} };
    if (skipCondHits(opt.skipIf, st, def, opt, prog, config)) return false;
    return true;
  }

  function queueItemForBeat(st, def, beat, config) {
    var copy = sim.careerCopy(config);
    var speaker = speakerLabel(st, beat, config);
    var bodySrc = beat.body;
    if (beat.bodyRemote && !isLineColocated(st, def)) bodySrc = beat.bodyRemote;
    var body = fillBody(bodySrc, st, config);
    var pres = beat.presentation || "notice";
    var opts;
    if (speaker) body = speaker + "：「" + body + "」";
    opts = null;
    if (pres === "choice") {
      opts = (beat.options || []).filter(function (o) {
        return optionVisible(st, def, o, config);
      }).map(function (o) {
        return { id: o.id, label: fillBody(o.label, st, config) };
      });
    }
    return {
      type: "careerLine",
      kind: "event",
      presentation: pres,
      lineId: def.id,
      beatId: beat.id,
      eventId: "line:" + def.id + ":" + beat.id,
      kicker: beat.kicker || copy.lineKicker || "事件线",
      title: fillBody(beat.title, st, config),
      body: body,
      speakerLabel: speaker,
      options: opts
    };
  }

  sim.markCareerLineDone = function (st, lineId, config) {
    var prog;
    if (!st || !st.career || !lineId) return;
    prog = ensureLineProgress(st, lineId);
    completeLine(prog, "done", st);
    void config;
  };

  function startBecomeProducerFromEffect(st, config, queue, spec) {
    var def = findLineDef(config, "become-producer") ||
      lineDefs(config).filter(function (l) { return l.kind === "becomeProducer"; })[0];
    var ignore = spec === true || !!(spec && (spec.ignoreMinRank || spec.mentorSponsor));
    var prog;
    if (!def || sim.isCareerProducer(st)) return;
    if (exclusiveBlocked(st, def, config) || !reopenOk(lineProgress(st, def.id), def, st)) {
      st.career.pendingMentorProducer = { year: st.year, ignoreMinRank: ignore };
      return;
    }
    prog = lineProgress(st, def.id);
    if (prog && prog.status === "active") return;
    activateLineInPlace(st, def, config, queue, null);
  }

  function applyLineEffects(st, effects, config, queue) {
    var dims, k, f, role, dim, story;
    if (!effects) return;
    if (effects.fame) st.career.fame = num(st.career.fame, 0) + num(effects.fame, 0);
    if (effects.honor) st.career.honor = num(st.career.honor, 0) + num(effects.honor, 0);
    if (effects.jobXp) st.career.jobXp = num(st.career.jobXp, 0) + num(effects.jobXp, 0);
    if (effects.mainStat) {
      role = sim.careerRole(st.career.roleId, config);
      dim = role && role.stat;
      if (dim) {
        if (!st.career.stats) st.career.stats = {};
        st.career.stats[dim] = num(st.career.stats[dim], 0) + num(effects.mainStat, 0);
      }
    }
    if (effects.promote && sim.applyCareerPromotion) {
      story = !!(effects.storyPromo || effects.sponsored || (effects.promote && effects.promote.story));
      sim.applyCareerPromotion(st, config, { story: story, sponsored: story });
    }
    if (effects.becomeProducer && sim.applyCareerBecomeProducer) {
      sim.applyCareerBecomeProducer(st, config);
    }
    if (effects.startBecomeProducer) {
      startBecomeProducerFromEffect(st, config, queue, effects.startBecomeProducer);
    }
    if (effects.changeRole && sim.applyCareerChangeRole) {
      sim.applyCareerChangeRole(st, config);
    }
    if (effects.moveStudio && sim.applyCareerMoveStudio) {
      sim.applyCareerMoveStudio(st, config);
    }
    if (effects.promotePeer && sim.applyCareerPromotePeer) {
      sim.applyCareerPromotePeer(st, config);
    }
    if (effects.scriptedHop && sim.applyScriptedCareerInvite) {
      sim.applyScriptedCareerInvite(st, "strongHop", config);
    }
    if (effects.invitePeer && sim.applyCareerInvitePeer) {
      sim.applyCareerInvitePeer(st, config);
    }
    if (effects.joinSuccessor && sim.applyCareerJoinSuccessor) {
      sim.applyCareerJoinSuccessor(st, config);
    }
    if (effects.markMergedCurrent && st.career && st.career.companyId) {
      if (!st.career.mergedFromIds) st.career.mergedFromIds = [];
      if (st.career.mergedFromIds.indexOf(st.career.companyId) < 0) {
        st.career.mergedFromIds.push(st.career.companyId);
      }
    }
    if (effects.juniorLeave && sim.applyCareerJuniorLeave) {
      sim.applyCareerJuniorLeave(st, config);
    }
    if (effects.markLineDone) {
      sim.markCareerLineDone(st, effects.markLineDone, config);
    }
    if (effects.qualityDims) {
      dims = effects.qualityDims;
      f = sim.careerPlayerImpactFactor ? sim.careerPlayerImpactFactor(st, config) : 1;
      for (k in dims) {
        if (Object.prototype.hasOwnProperty.call(dims, k)) {
          sim.applyCareerLiveDelta(st, k, num(dims[k], 0) * f, config);
        }
      }
    }
    if (effects.releaseBiasDelta) {
      st.career.producerReleaseBias = num(st.career.producerReleaseBias, 0) + num(effects.releaseBiasDelta, 0);
    }
    if (effects.kickOut && sim.kickOutOfCareerCompany) {
      sim.kickOutOfCareerCompany(st, config);
    }
    if (effects.revealJunior && sim.revealCareerJunior) {
      sim.revealCareerJunior(st, config);
    }
    if (effects.ensureJunior && sim.ensureCareerJuniorBond) {
      sim.ensureCareerJuniorBond(st, config);
    }
    if (effects.followMentor && sim.applyScriptedCareerInvite) {
      sim.applyScriptedCareerInvite(st, "mentorSuccessor", config);
    }
    if (effects.joinPeerEpic && sim.applyScriptedCareerInvite) {
      sim.applyScriptedCareerInvite(st, "peerEpic", config);
    }
    if (effects.returnInvite && sim.applyScriptedCareerInvite) {
      sim.applyScriptedCareerInvite(
        st,
        effects.returnInvite === "producer" ? "returnProducer" : "returnStaff",
        config
      );
    }
  }

  function mergeFlags(prog, setFlags) {
    var k;
    if (!setFlags) return;
    if (!prog.flags) prog.flags = {};
    for (k in setFlags) {
      if (Object.prototype.hasOwnProperty.call(setFlags, k)) prog.flags[k] = setFlags[k];
    }
  }

  function completeLine(prog, status, st) {
    prog.status = status;
    prog.pending = false;
    prog.waitingFor = null;
    prog.waitUntil = null;
    prog.remotePending = false;
    prog.waitUntilYear = null;
    if (status === "aborted") prog.abortedYear = st.year;
  }

  function fireBeat(st, def, beatIndex, config, queue, notes) {
    var beats = def.beats || [];
    var beat;
    var prog = ensureLineProgress(st, def.id);
    var item;
    prog.beat = beatIndex;
    advanceSkippedBeats(st, def, prog, config);
    if (prog.status !== "active") return 0;
    beat = beats[prog.beat];
    if (!beat) {
      completeLine(prog, "done", st);
      return 0;
    }
    if (!beatWaitReady(st, prog, beat, config)) return 0;
    if (beat.effects && beat.effects.revealJunior && sim.revealCareerJunior) {
      sim.revealCareerJunior(st, config);
    }
    if (beat.effects && beat.effects.ensureJunior && sim.ensureCareerJuniorBond) {
      sim.ensureCareerJuniorBond(st, config);
    }
    item = queueItemForBeat(st, def, beat, config);
    if (isProducerAskBeat(def, beat)) noteProducerAsk(st);
    if ((beat.presentation || "notice") === "choice") {
      prog.pending = true;
      if (queue) queue.push(item);
      return 1;
    }
    applyLineEffects(st, beat.effects, config, queue);
    if (beat.setFlags) mergeFlags(prog, beat.setFlags);
    if (beat.complete || prog.beat >= beats.length - 1) {
      completeLine(prog, "done", st);
    } else {
      prog.beat = prog.beat + 1;
      armWaitAfterAdvance(st, prog, beats[prog.beat]);
    }
    if (queue) queue.push(item);
    if (notes) notes.push(item.title);
    if (beats[prog.beat] && (beats[prog.beat].wait || {}).type === "sameMonthChain" && prog.status === "active") {
      return 1 + fireBeat(st, def, prog.beat, config, queue, notes);
    }
    return 1;
  }

  sim.startCareerLine = function (state, lineId, config, opts) {
    var st, def, prog, queue, fired;
    opts = opts || {};
    if (!sim.isCareerMode(state)) return sim.fail(state, sim.ERR.CAREER_NOT_CAREER);
    def = findLineDef(config, lineId);
    if (!def) return sim.fail(state, sim.ERR.EVENT_NOT_FOUND);
    if (def.kind === "becomeProducer" && !sim.canStartBecomeProducerLine(state, config, opts)) {
      return sim.fail(state, sim.ERR.CAREER_LINE_LOCKED);
    }
    if (def.kind === "promotion" && !sim.canStartPromotionLine(state, config) &&
        !(sim.canPromoteCareer(state, config) && !exclusiveBlocked(state, def, config) && reopenOk(lineProgress(state, def.id), def, state))) {
      return sim.fail(state, sim.ERR.CAREER_LINE_LOCKED);
    }
    if (exclusiveBlocked(state, def, config)) return sim.fail(state, sim.ERR.CAREER_LINE_LOCKED);
    st = sim.clone(state);
    sim.ensureCareerExtras(st, config);
    prog = ensureLineProgress(st, def.id);
    if (!reopenOk(prog, def, st) && prog.status !== "active") {
      return sim.fail(state, sim.ERR.CAREER_LINE_LOCKED);
    }
    prog.status = "active";
    prog.beat = 0;
    prog.flags = {};
    prog.pending = false;
    prog.startedAt = { year: st.year, month: st.month };
    prog.abortedYear = null;
    prog.remotePending = false;
    prog.waitUntilYear = null;
    if (def.ensureBond === "junior" && sim.ensureCareerJuniorBond) {
      sim.ensureCareerJuniorBond(st, config);
    }
    armWaitAfterAdvance(st, prog, (def.beats || [])[0]);
    prog.waitUntil = null;
    prog.waitingFor = null;
    queue = [];
    fired = fireBeat(st, def, 0, config, queue, null);
    return { ok: true, state: st, queue: queue, fired: fired, lineId: def.id };
  };

  sim.resolveCareerLineChoice = function (state, lineId, beatId, optionId, config) {
    var st, def, prog, beat, opt, beats, i, queue, chained;
    if (!sim.isCareerMode(state)) return sim.fail(state, sim.ERR.CAREER_NOT_CAREER);
    def = findLineDef(config, lineId);
    if (!def) return sim.fail(state, sim.ERR.EVENT_NOT_FOUND);
    st = sim.clone(state);
    sim.ensureCareerExtras(st, config);
    prog = lineProgress(st, lineId);
    if (!prog || prog.status !== "active") return sim.fail(state, sim.ERR.CAREER_LINE_LOCKED);
    beats = def.beats || [];
    beat = null;
    if (def.remoteBeat && def.remoteBeat.id === beatId) {
      beat = def.remoteBeat;
      i = -1;
    } else {
      for (i = 0; i < beats.length; i++) {
        if (beats[i].id === beatId) {
          beat = beats[i];
          break;
        }
      }
    }
    if (!beat) return sim.fail(state, sim.ERR.EVENT_NOT_FOUND);
    if ((beat.presentation || "notice") !== "choice") return sim.fail(state, sim.ERR.EVENT_NOT_CHOICE);
    opt = null;
    (beat.options || []).forEach(function (o) {
      if (o.id === optionId) opt = o;
    });
    if (!opt || !optionVisible(st, def, opt, config)) return sim.fail(state, sim.ERR.EVENT_OPTION_INVALID);
    prog.pending = false;
    queue = [];
    if (opt.abort) {
      if (i < 0) prog.remotePending = false;
      completeLine(prog, "aborted", st);
      return { ok: true, state: st, aborted: true, lineId: lineId, optionId: optionId, queue: queue };
    }
    mergeFlags(prog, opt.setFlags);
    applyLineEffects(st, opt.effects, config, queue);
    if (i < 0) {
      prog.remotePending = false;
      if (opt.complete) {
        completeLine(prog, "done", st);
        return { ok: true, state: st, done: true, lineId: lineId, optionId: optionId, queue: queue };
      }
      return { ok: true, state: st, lineId: lineId, optionId: optionId, queue: queue };
    }
    if (opt.complete || beat.complete || i >= beats.length - 1) {
      completeLine(prog, "done", st);
      return { ok: true, state: st, done: true, lineId: lineId, optionId: optionId, queue: queue };
    }
    if (opt.advance !== false) {
      prog.beat = i + 1;
      armWaitAfterAdvance(st, prog, beats[prog.beat]);
    }
    if (beats[prog.beat] && (beats[prog.beat].wait || {}).type === "sameMonthChain" && prog.status === "active") {
      chained = fireBeat(st, def, prog.beat, config, queue, null);
    }
    return {
      ok: true,
      state: st,
      lineId: lineId,
      optionId: optionId,
      queue: queue,
      chained: !!chained
    };
  };

  sim.resolveCareerPathFork = function (state, optionId, config) {
    var st, fork, opt, i, prefer, list, def, started;
    fork = eventLinesSpec(config).pathFork;
    if (!fork) return sim.fail(state, sim.ERR.EVENT_NOT_FOUND);
    opt = null;
    (fork.options || []).forEach(function (o) {
      if (o.id === optionId) opt = o;
    });
    if (!opt) return sim.fail(state, sim.ERR.EVENT_OPTION_INVALID);
    st = sim.clone(state);
    sim.ensureCareerExtras(st, config);
    st.career.lineForkYear = st.year;
    if (!opt.preferKind) return { ok: true, state: st, deferred: true };
    list = lineDefs(config);
    def = null;
    for (i = 0; i < list.length; i++) {
      prefer = list[i];
      if (prefer.kind === opt.preferKind) {
        if (opt.preferKind === "promotion" && prefer.fromRank !== sim.careerJobRank(st.career, config)) continue;
        def = prefer;
        break;
      }
    }
    if (!def) return { ok: true, state: st, deferred: true };
    started = sim.startCareerLine(st, def.id, config);
    if (!started.ok) return started;
    return {
      ok: true,
      state: started.state,
      queue: started.queue || [],
      lineId: def.id,
      started: true
    };
  };

  function pathForkQueueItem(config) {
    var fork = eventLinesSpec(config).pathFork;
    if (!fork) return null;
    return {
      type: "careerLineFork",
      kind: "event",
      presentation: "choice",
      eventId: "line-fork:" + (fork.id || "career-path-fork"),
      forkId: fork.id || "career-path-fork",
      kicker: fork.kicker || "职业分叉",
      title: fork.title || "下一段怎么走？",
      body: fork.body || "",
      options: (fork.options || []).map(function (o) {
        return { id: o.id, label: o.label };
      })
    };
  }

  sim.markCareerLineShip = function (st) {
    var ids, i, prog;
    ids = sim.activeCareerLineIds(st);
    for (i = 0; i < ids.length; i++) {
      prog = lineProgress(st, ids[i]);
      if (prog && prog.status === "active" && prog.waitingFor === "ship") {
        prog.waitingFor = "shipReady";
      }
    }
  };

  sim.markCareerLineYearEnd = function (st) {
    var ids, i, prog;
    ids = sim.activeCareerLineIds(st);
    for (i = 0; i < ids.length; i++) {
      prog = lineProgress(st, ids[i]);
      if (prog && prog.status === "active" && prog.waitingFor === "yearEnd") {
        prog.waitingFor = "yearEndReady";
      }
    }
  };

  function careerMonths(st, config) {
    var cal = (sim.careerWorld(config).timeline) || {};
    var startY = cal.startYear != null ? cal.startYear : 1995;
    var startM = cal.startMonth != null ? cal.startMonth : 1;
    return sim.monthIndex(st.year, st.month) - sim.monthIndex(startY, startM);
  }

  function monthsOnCurrentTitle(st) {
    var list, i, rec;
    if (!st.career || !st.career.titleId) return 0;
    list = st.career.credits || [];
    for (i = 0; i < list.length; i++) {
      rec = list[i];
      if (rec.titleId === st.career.titleId && rec.leftYear == null) {
        return sim.monthIndex(st.year, st.month) - sim.monthIndex(rec.joinYear || st.year, rec.joinMonth || st.month);
      }
    }
    return 0;
  }

  function whenClauseMet(st, when, config) {
    var bond, title, together, co;
    if (!when) return true;
    if (when.minYear != null && st.year < when.minYear) return false;
    if (when.maxYear != null && st.year > when.maxYear) return false;
    if (when.minJobRank != null && sim.careerJobRank(st.career, config) < when.minJobRank) return false;
    if (when.minMonthsInCareer != null && careerMonths(st, config) < when.minMonthsInCareer) return false;
    if (when.minSignedCredits != null && (sim.careerSignedCreditCount ? sim.careerSignedCreditCount(st) : 0) < when.minSignedCredits) return false;
    if (when.requireBond) {
      bond = bondRecord(st, when.requireBond);
      if (!bond) return false;
    }
    if (when.minMonthsTogether) {
      bond = bondRecord(st, when.minMonthsTogether.bond || when.requireBond);
      together = bond ? num(bond.monthsTogether, 0) : 0;
      if (together < num(when.minMonthsTogether.n, 0)) return false;
    }
    if (when.employerIds && when.employerIds.length) {
      if (when.employerIds.indexOf(st.career && st.career.companyId) < 0) return false;
    }
    if (when.companyRegions && when.companyRegions.length) {
      co = sim.careerCompany(st.career && st.career.companyId, config);
      if (!co || when.companyRegions.indexOf(co.region) < 0) return false;
    }
    if (when.onTitle) {
      if (!st.career || !st.career.titleId) return false;
      title = sim.careerTitle(st.career.titleId, config, st);
      if (!title || title.virtual) return false;
      if (when.onTitle.landmark && !title.landmark) return false;
      if (when.onTitle.minPrestige != null && num(title.prestige, 0) < when.onTitle.minPrestige) return false;
    }
    if (when.minMonthsOnTitle != null && monthsOnCurrentTitle(st) < when.minMonthsOnTitle) return false;
    // 邀约线（回国线）专用：目标公司当月得真的有在研目录作，"进组当组员 / 当制作人去"
    // 才有组可进。否则线先不开（retryNextYear 会年复一年地等），别把玩家挂进一家空公司。
    if (when.requireInDevTarget && !(sim.hasCareerReturnTarget && sim.hasCareerReturnTarget(st, config))) {
      return false;
    }
    return true;
  }

  function startWhenMet(st, def, config) {
    var when = def.startWhen || {};
    var i, any;
    if (when.anyOf && when.anyOf.length) {
      any = false;
      for (i = 0; i < when.anyOf.length; i++) {
        if (whenClauseMet(st, when.anyOf[i], config)) {
          any = true;
          break;
        }
      }
      if (!any) return false;
    }
    return whenClauseMet(st, when, config);
  }

  function optionalLineKind(def) {
    return def && (def.kind === "bond" || def.kind === "epic" || def.kind === "era");
  }

  function canStartOptionalLine(st, def, config) {
    var prog;
    if (!def || !optionalLineKind(def)) return false;
    if (!sim.isCareerMode(st) || !st.career) return false;
    if (exclusiveBlocked(st, def, config)) return false;
    prog = lineProgress(st, def.id);
    if (!reopenOk(prog, def, st)) return false;
    return startWhenMet(st, def, config);
  }

  function rollOptionalStart(st, def, config) {
    var when = def.startWhen || {};
    var chance = when.startChance;
    var rolls;
    if (chance == null) chance = 1;
    if (chance >= 1) return true;
    if (!st.career.lineStartRolls) st.career.lineStartRolls = {};
    rolls = st.career.lineStartRolls;
    if (when.retryNextYear) {
      if (rolls[def.id] === st.year) return false;
      rolls[def.id] = st.year;
    } else {
      if (rolls[def.id] != null) return false;
      rolls[def.id] = st.year;
    }
    return sim.rand(st) < chance;
  }

  function activateLineInPlace(st, def, config, queue, notes) {
    var prog;
    prog = ensureLineProgress(st, def.id);
    prog.status = "active";
    prog.beat = 0;
    prog.flags = {};
    prog.pending = false;
    prog.startedAt = { year: st.year, month: st.month };
    prog.abortedYear = null;
    prog.waitUntil = null;
    prog.waitingFor = null;
    prog.remotePending = false;
    prog.waitUntilYear = null;
    if (def.ensureBond === "junior" && sim.ensureCareerJuniorBond) {
      sim.ensureCareerJuniorBond(st, config);
    }
    return fireBeat(st, def, 0, config, queue, notes);
  }

  function compareLinePri(a, b) {
    var pa = linePriority(a.def);
    var pb = linePriority(b.def);
    if (pb !== pa) return pb - pa;
    return String(a.def.id).localeCompare(String(b.def.id));
  }

  function tryStartCareerPath(st, config, queue, notes) {
    var canPromo, canProd, forkItem, def, fired;
    fired = 0;
    if (sim.hasActiveExclusiveGroup(st, "careerPath", config)) return 0;
    canPromo = sim.canStartPromotionLine(st, config);
    canProd = sim.canStartBecomeProducerLine(st, config);
    if (canPromo && canProd && eventLinesSpec(config).pathFork) {
      if (st.career.lineForkYear !== st.year) {
        forkItem = pathForkQueueItem(config);
        if (forkItem && queue) {
          queue.push(forkItem);
          st.career.lineForkYear = st.year;
          noteProducerAsk(st);
          fired += 1;
        }
      }
      return fired;
    }
    if (canProd) {
      def = findLineDef(config, "become-producer") ||
        lineDefs(config).filter(function (l) { return l.kind === "becomeProducer"; })[0];
      if (def) fired += activateLineInPlace(st, def, config, queue, notes);
      return fired;
    }
    if (canPromo) {
      def = sim.promotionEventLineDef(st, config);
      if (def) fired += activateLineInPlace(st, def, config, queue, notes);
    }
    return fired;
  }

  function tryStartOptionalLines(st, config, queue, notes, budget) {
    var spec = eventLinesSpec(config);
    var maxNew = num(spec.maxNewLinesPerMonth, 1);
    var list = lineDefs(config);
    var eligible = [];
    var fired = 0;
    var started = 0;
    var i, def;
    if (budget <= 0) return 0;
    for (i = 0; i < list.length; i++) {
      def = list[i];
      if (canStartOptionalLine(st, def, config)) eligible.push({ def: def });
    }
    eligible.sort(compareLinePri);
    for (i = 0; i < eligible.length && fired < budget && started < maxNew; i++) {
      if (!rollOptionalStart(st, eligible[i].def, config)) continue;
      fired += activateLineInPlace(st, eligible[i].def, config, queue, notes);
      started += 1;
    }
    return fired;
  }

  function fireRemoteBeat(st, def, prog, config, queue, notes) {
    var beat = def && def.remoteBeat;
    var item;
    if (!beat) {
      prog.remotePending = false;
      return 0;
    }
    item = queueItemForBeat(st, def, beat, config);
    if ((beat.presentation || "notice") === "choice") {
      prog.pending = true;
      if (queue) queue.push(item);
      return 1;
    }
    applyLineEffects(st, beat.effects, config, queue);
    if (beat.setFlags) mergeFlags(prog, beat.setFlags);
    prog.remotePending = false;
    if (beat.complete) completeLine(prog, "done", st);
    if (queue) queue.push(item);
    if (notes) notes.push(item.title);
    return 1;
  }

  function tryFireMerger(st, config, queue, notes) {
    var def, co;
    if (!(sim.mergerCompanyDue && sim.mergerCompanyDue(st, config))) return 0;
    def = findLineDef(config, "company-merger") ||
      lineDefs(config).filter(function (l) { return l.kind === "merger" || l.kind === "interrupt"; })[0];
    if (!def) return 0;
    if (lineProgress(st, def.id) && lineProgress(st, def.id).status === "active") return 0;
    void co;
    return activateLineInPlace(st, def, config, queue, notes);
  }

  function tryFireRemoteBeats(st, config, queue, notes, budget) {
    var ids, i, def, prog, fired;
    fired = 0;
    if (budget <= 0) return 0;
    ids = sim.activeCareerLineIds(st);
    for (i = 0; i < ids.length && fired < budget; i++) {
      def = findLineDef(config, ids[i]);
      prog = lineProgress(st, ids[i]);
      if (!def || !prog || !prog.remotePending || prog.pending) continue;
      fired += fireRemoteBeat(st, def, prog, config, queue, notes);
    }
    return fired;
  }

  function tryStartPendingMentorProducer(st, config, queue, notes) {
    var pending = st.career && st.career.pendingMentorProducer;
    var def, opts;
    if (!pending) return 0;
    def = findLineDef(config, "become-producer") ||
      lineDefs(config).filter(function (l) { return l.kind === "becomeProducer"; })[0];
    if (!def) {
      st.career.pendingMentorProducer = null;
      return 0;
    }
    opts = { ignoreMinRank: !!(pending.ignoreMinRank || pending.mentorSponsor), mentorSponsor: true };
    if (producerAsksExhausted(st, config)) {
      st.career.pendingMentorProducer = null;
      return 0;
    }
    if (!sim.canStartBecomeProducerLine(st, config, opts)) return 0;
    st.career.pendingMentorProducer = null;
    return activateLineInPlace(st, def, config, queue, notes);
  }

  sim.processCareerLines = function (st, config, queue, notes) {
    var spec = eventLinesSpec(config);
    var maxPer = num(spec.maxBeatsPerMonth, 1);
    var fired = 0;
    var ready = [];
    var ids, i, def, prog, beats;

    if (!st.career) return 0;
    if (sim.hasPendingCareerLine(st)) return 0;

    fired += tryFireMerger(st, config, queue, notes);
    if (fired >= maxPer) return fired;
    fired += tryFireRemoteBeats(st, config, queue, notes, maxPer - fired);
    if (fired >= maxPer) return fired;

    ids = sim.activeCareerLineIds(st);
    for (i = 0; i < ids.length; i++) {
      def = findLineDef(config, ids[i]);
      prog = lineProgress(st, ids[i]);
      if (!def || !prog) continue;
      if (def.kind === "merger" || def.kind === "interrupt") continue;
      advanceSkippedBeats(st, def, prog, config);
      if (prog.status !== "active" || prog.pending) continue;
      beats = def.beats || [];
      if (prog.beat < beats.length && beatWaitReady(st, prog, beats[prog.beat], config)) {
        ready.push({ def: def, prog: prog });
      }
    }
    ready.sort(compareLinePri);
    for (i = 0; i < ready.length && fired < maxPer; i++) {
      fired += fireBeat(st, ready[i].def, ready[i].prog.beat, config, queue, notes);
    }
    if (fired >= maxPer) return fired;
    fired += tryStartPendingMentorProducer(st, config, queue, notes);
    if (fired >= maxPer) return fired;
    fired += tryStartCareerPath(st, config, queue, notes);
    if (fired >= maxPer) return fired;
    fired += tryStartOptionalLines(st, config, queue, notes, maxPer - fired);
    return fired;
  };

  sim.requestCareerPromotion = function (state, config) {
    var def;
    if (!sim.isCareerMode(state)) return sim.fail(state, sim.ERR.CAREER_NOT_CAREER);
    if (sim.isCareerProducer(state)) return sim.fail(state, sim.ERR.CAREER_PROMOTE_LOCKED);
    if (sim.promotionUsesEventLine(state, config)) {
      if (!sim.canPromoteCareer(state, config)) return sim.fail(state, sim.ERR.CAREER_PROMOTE_LOCKED);
      def = sim.promotionEventLineDef(state, config);
      if (!def) return sim.fail(state, sim.ERR.CAREER_PROMOTE_LOCKED);
      if (sim.hasActiveExclusiveGroup && sim.hasActiveExclusiveGroup(state, "careerPath", config)) {
        return sim.fail(state, sim.ERR.CAREER_LINE_LOCKED);
      }
      return sim.startCareerLine(state, def.id, config);
    }
    return sim.promoteCareer(state, config);
  };

  sim.rollProducerPitchOptions = function (st, config) {
    var spec = producerSpec(config);
    var count = num(spec.virtualPitchOptionCount, 3);
    var content = config.content || {};
    var genres = content.genres || [];
    var plays = content.gameplay || [];
    var out = [];
    var i, g, p, used = {};
    var key;
    if (!genres.length || !plays.length) return out;
    for (i = 0; i < count * 4 && out.length < count; i++) {
      g = sim.pick(st, genres);
      p = sim.pick(st, plays);
      if (!g || !p) continue;
      key = g.id + ":" + p.id;
      if (used[key]) continue;
      used[key] = true;
      out.push({
        id: "pitch-" + out.length,
        label: (sim.worldLabel(g, config) || g.id) + " · " + (sim.worldLabel(p, config) || p.id),
        genreId: g.id,
        gameplayId: p.id
      });
    }
    return out;
  };

  sim.queueProducerVirtualPitch = function (st, config, queue) {
    var copy = sim.careerCopy(config);
    var opts;
    var cur;
    if (!sim.isCareerProducer(st)) return false;
    if (!producerSpec(config).canPickVirtualGenreGameplay) return false;
    if (st.career.awaitingProducerPitch) return true;
    cur = st.career.titleId ? sim.careerTitle(st.career.titleId, config, st) : null;
    if (cur && !cur.virtual) return false;
    opts = sim.rollProducerPitchOptions(st, config);
    if (!opts.length) return false;
    st.career.awaitingProducerPitch = true;
    st.career.producerPitchOptions = opts;
    if (queue) {
      queue.push({
        type: "producerPitch",
        kind: "event",
        presentation: "choice",
        eventId: "producer-pitch",
        kicker: copy.producerPitchKicker || "制作人立项",
        title: copy.producerPitchTitle || "选题材和玩法",
        body: copy.producerPitchBody || "虚拟项目由你定调。目录 landmark 不会改写历史题材玩法。",
        options: opts.map(function (o) {
          return { id: o.id, label: o.label };
        })
      });
    }
    return true;
  };

  sim.resolveProducerPitch = function (state, optionId, config) {
    var st, opts, hit, i, title, prior, snap;
    if (!sim.isCareerMode(state)) return sim.fail(state, sim.ERR.CAREER_NOT_CAREER);
    st = sim.clone(state);
    sim.ensureCareerExtras(st, config);
    opts = st.career.producerPitchOptions || [];
    hit = null;
    for (i = 0; i < opts.length; i++) {
      if (opts[i].id === optionId) hit = opts[i];
    }
    if (!hit) return sim.fail(state, sim.ERR.EVENT_OPTION_INVALID);
    prior = st.career.titleId ? sim.careerTitle(st.career.titleId, config, st) : null;
    if (prior && !prior.virtual) {
      snap = {
        name: prior.name,
        alias: prior.alias,
        genreId: prior.genreId,
        gameplayId: prior.gameplayId
      };
    }
    st.career.awaitingProducerPitch = false;
    st.career.producerPitchOptions = null;
    st.career.idleMonths = num(st.career.idleMonths, 0);
    if (st.career.idleMonths < 1) st.career.idleMonths = 1;
    title = sim.startVirtualProject(st, config, {
      genreId: hit.genreId,
      gameplayId: hit.gameplayId
    });
    if (prior && !prior.virtual && snap) {
      prior.name = snap.name;
      prior.alias = snap.alias;
      prior.genreId = snap.genreId;
      prior.gameplayId = snap.gameplayId;
    }
    if (title) {
      st.career.titleId = title.id;
      st.career.liveStats = sim.careerLiveFromTitle(st, title, config);
      st.career.idleMonths = 0;
    }
    return { ok: true, state: st, titleId: title && title.id, virtual: !!(title && title.virtual) };
  };

  void DIMS;
})(typeof globalThis !== "undefined" ? globalThis : this);
