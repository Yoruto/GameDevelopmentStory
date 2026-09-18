(function (root) {
  var GDS = root.GDS;
  var ui = GDS.ui;
  var sim = GDS.sim;
  var doc = root.document;

  function cfg() { return GDS.CONFIG; }

  ui.applySim = function (result, okMsg, after) {
    if (!result || !result.ok) {
      ui.toast(sim.errorMessage(result && result.error));
      return;
    }
    ui.session.state = result.state;
    GDS.save.persist(result.state);
    if (okMsg) ui.toast(okMsg);
    if (after) after();
  };

  ui.goBack = function () {
    if (ui.l2Open()) { ui.closeDockSheets(); return; }
    ui.paintHq();
    ui.show("sc-hq");
  };

  ui.captureCareerStatSnap = function () {
    var state = ui.session.state;
    var live;
    var self;
    if (!state || !state.career || !sim.isCareerMode || !sim.isCareerMode(state)) {
      ui.session.statSnap = null;
      return;
    }
    live = state.career.liveStats || null;
    self = state.career.stats || null;
    ui.session.statSnap = {
      titleId: state.career.titleId || null,
      // liveStats 是作品维，career.stats 是人物维——两套键不能共用一个循环。
      live: live ? sim.cloneTitleStats(live, GDS.CONFIG) : null,
      self: self ? {
        program: self.program,
        design: self.design,
        art: self.art,
        music: self.music
      } : null
    };
  };

  ui.flashStatDelta = function (elId, before, after) {
    var el = ui.$(elId);
    var parent;
    var floater;
    var delta;
    if (!el || before == null || after == null) return;
    delta = Math.round(after) - Math.round(before);
    if (!delta) return;
    parent = el.parentNode;
    if (!parent) return;
    floater = doc.createElement("span");
    floater.className = "stat-float";
    floater.textContent = (delta > 0 ? "+" : "") + delta;
    parent.appendChild(floater);
    root.setTimeout(function () {
      if (floater.parentNode) floater.parentNode.removeChild(floater);
    }, 500);
  };

  ui.flashCareerStatDeltas = function () {
    var snap = ui.session.statSnap;
    var state = ui.session.state;
    var live;
    var self;
    ui.session.statSnap = null;
    if (!snap || !state || !state.career) return;
    self = state.career.stats || {};
    if (snap.self) {
      ui.flashStatDelta("hq-self-p", snap.self.program, self.program);
      ui.flashStatDelta("hq-self-d", snap.self.design, self.design);
      ui.flashStatDelta("hq-self-a", snap.self.art, self.art);
      ui.flashStatDelta("hq-self-m", snap.self.music, self.music);
    }
    live = state.career.liveStats;
    if (snap.live && live && snap.titleId && snap.titleId === state.career.titleId) {
      ["p", "d", "a", "m"].forEach(function (suffix, i) {
        var d = sim.titleDims(GDS.CONFIG)[i];
        ui.flashStatDelta("hq-live-" + suffix, snap.live[d], live[d]);
      });
    }
  };

  ui.finishTickUi = function () {
    ui.closeDlg();
    ui.$("btn-tick").disabled = false;
    if (ui.$("btn-tick-skip")) ui.$("btn-tick-skip").disabled = false;
    GDS.save.persist(ui.session.state);
    ui.paintHq();
    ui.paintTga();
    ui.flashCareerStatDeltas();
    if (ui.session.state.phase === "SETTLED") ui.show("sc-settled");
    else ui.show("sc-hq");
  };

  ui.runTickResult = function (tick) {
    ui.session.state = tick.state;
    ui.session.tickPages = tick.queue || [];
    ui.session.tickStep = 0;
    if (!ui.session.tickPages.length) {
      ui.finishTickUi();
      return;
    }
    ui.showTickPage();
  };

  ui.showTickPage = function () {
    var page = ui.session.tickPages[ui.session.tickStep];
    var hopOffers;
    if (!page) {
      ui.finishTickUi();
      return;
    }
    hopOffers = ui.session.state && ui.session.state.career && ui.session.state.career.yearEndOffers;
    if (page.type === "hop" && (!hopOffers || !hopOffers.length)) {
      ui.advanceTickQueue();
      return;
    }
    var last = ui.session.tickStep >= ui.session.tickPages.length - 1;
    var nodes = [];
    var isChoice = page.presentation === "choice" && page.options && page.options.length;
    var copyC = (cfg() && cfg().copy) || {};
    var okText = last ? "好的" : "继续";
    if (page.bits) {
      var bits = doc.createElement("p");
      bits.className = "hint";
      bits.textContent = page.bits;
      nodes.push(bits);
    }
    if (isChoice) {
      var box = doc.createElement("div");
      box.className = "dlg-choices";
      page.options.forEach(function (opt) {
        var btn = doc.createElement("button");
        var main, title, meta, pct;
        btn.type = "button";
        btn.className = "btn ghost";
        btn.setAttribute("data-event-opt", opt.id);
        if (opt.hopView) {
          btn.className += " hop-opt";
          main = doc.createElement("span");
          main.className = "hop-opt-main";
          title = doc.createElement("span");
          title.className = "hop-opt-title";
          title.textContent = opt.hopView.title || "";
          main.appendChild(title);
          if (opt.hopView.meta) {
            meta = doc.createElement("span");
            meta.className = "hop-opt-meta";
            meta.textContent = opt.hopView.meta;
            main.appendChild(meta);
          }
          pct = doc.createElement("span");
          pct.className = "hop-opt-pct";
          pct.textContent = opt.hopView.pct || "";
          btn.appendChild(main);
          btn.appendChild(pct);
        } else {
          btn.textContent = opt.label;
        }
        box.appendChild(btn);
      });
      nodes.push(box);
    }
    if (page.rec && page.rec.media && ui.startMediaReveal) {
      ui.openDlg({
        mode: "tick",
        kind: page.kind || "info",
        kicker: page.kicker || "过月",
        title: page.title,
        body: copyC.mediaRevealHint || page.body || "",
        nodes: nodes,
        hideOk: true,
        hideActions: true,
        okText: okText
      });
      ui.startMediaReveal(page.rec, {
        hint: copyC.mediaRevealHint || "",
        onDone: function () { ui.unlockDlgOk(okText); }
      });
      return;
    }
    if (page.awards && ui.startAwardReveal) {
      ui.openDlg({
        mode: "tick",
        kind: page.kind || "event",
        kicker: page.kicker || "年度盛典",
        title: page.title,
        body: copyC.awardRevealHint || page.body || "",
        nodes: nodes,
        hideOk: true,
        hideActions: true,
        okText: okText
      });
      ui.startAwardReveal(page.awards, {
        hint: copyC.awardRevealHint || page.body || "",
        onDone: function () { ui.unlockDlgOk(okText); }
      });
      return;
    }
    if (page.rec && page.rec.media) nodes = ui.mediaNodes(page.rec).concat(nodes);
    if (page.awards) nodes = ui.awardNodes(page.awards).concat(nodes);
    ui.openDlg({
      mode: isChoice ? "tick-choice" : "tick",
      kind: page.kind || "info",
      kicker: page.kicker || (page.kind === "event" ? "本月事件" : "过月"),
      title: page.title,
      body: page.body,
      nodes: nodes,
      hideOk: isChoice,
      hideActions: isChoice,
      okText: okText
    });
  };

  ui.advanceTickQueue = function () {
    ui.session.tickStep += 1;
    if (ui.session.tickStep < ui.session.tickPages.length) { ui.showTickPage(); return; }
    ui.finishTickUi();
  };

  function bind() {
    var config = cfg();
    ui.paintStaticCopy();
    ui.$("name-input").value = (cfg().copy && cfg().copy.career && cfg().copy.career.defaultName) || "";

    ui.$("btn-start").addEventListener("click", function () {
      var copyC = sim.careerCopy(config);
      var v = ui.$("name-input").value.replace(/^\s+|\s+$/g, "") || copyC.defaultName;
      ui.$("name-input").value = v;
      ui.showPreviewFlag();
      GDS.bridge.auditText(v).then(function (res) {
        if (!res.ok) { ui.toast(res.message); return; }
        GDS.save.restoreOrNull().then(function (saved) {
          if (saved && saved.mode === "career" && saved.phase === "PLAYING" && saved.career) {
            ui.session.state = saved;
            ui.paintStaticCopy();
            ui.paintHq();
            ui.show("sc-hq");
            GDS.save.persist(saved);
            ui.toast("读到云端/缓存进度，接着玩");
            return;
          }
          if (saved && saved.mode === "career" && saved.phase === "OFFER" && saved.career) {
            ui.session.state = saved;
            ui.$("name-input").value = saved.career.characterName || copyC.defaultName;
            ui.paintCareerOffers();
            ui.show("sc-offer");
            return;
          }
          ui.enterCareerFromStart(v, config);
        });
      });
    });

    ui.$("btn-reroll").addEventListener("click", function () {
      ui.rerollCareerStart(config);
    });

    function startRollRerolls(config) {
      var spec = ((config.careerWorld || {}).player || {}).startRoll || {};
      return spec.rerolls != null ? spec.rerolls : 3;
    }

    function scratchRng() {
      return { rngSeed: (Date.now() % 100000) + 17, rngCount: 0 };
    }

    ui.enterCareerFromStart = function (name, config) {
      var draft = ui.session.startRoll || {};
      if (!draft.roleId) { ui.toast(sim.errorMessage(sim.ERR.CAREER_ROLE_INVALID)); return; }
      ui.session.state = sim.createCareerGame(name, draft.roleId, config, {
        stats: draft.stats,
        genreIds: draft.genreIds,
        gameplayIds: draft.gameplayIds,
        traitIds: draft.traitIds || (draft.traitId ? [draft.traitId] : [])
      });
      ui.session.startRoll = null;
      ui.session.rollsLeft = null;
      ui.paintCareerOffers();
      ui.show("sc-offer");
      GDS.save.persist(ui.session.state);
    };

    ui.rerollCareerStart = function (config) {
      var copyC = sim.careerCopy(config);
      if ((ui.session.rollsLeft || 0) <= 0) {
        ui.toast(copyC.rollEmpty || "重掷机会用完了。");
        return;
      }
      ui.session.rollsLeft -= 1;
      ui.session.startRoll = sim.rollCareerStart(scratchRng(), config);
      ui.paintCareerStartRoll();
    };

    ui.prepareCareerStart = function () {
      var config = cfg();
      if (!ui.session.startRoll) {
        ui.session.rollsLeft = startRollRerolls(config);
        ui.session.startRoll = sim.rollCareerStart(scratchRng(), config);
      }
      ui.paintCareerStartRoll();
    };

    ui.prepareCareerStart();

    function backToBoot() {
      ui.session.state = null;
      ui.session.startRoll = null;
      ui.session.rollsLeft = null;
      ui.prepareCareerStart();
      ui.show("sc-boot");
    }
    ui.$("btn-restart").addEventListener("click", backToBoot);
    ui.$("btn-again1").addEventListener("click", backToBoot);

    doc.querySelectorAll("[data-go]").forEach(function (el) {
      el.addEventListener("click", function () {
        if (!ui.session.state) { ui.toast("先开张"); return; }
        var go = el.getAttribute("data-go");
        ui.closeDockSheets();
        if (go === "share") ui.paintShare();
        if (go === "tga") ui.paintTga();
        if (go === "calendar") ui.paintCalendar();
        if (go === "resume") ui.paintResume && ui.paintResume();
        if (go === "player") ui.paintPlayer && ui.paintPlayer();
        if (go === "settled") ui.paintEnds();
        ui.show("sc-" + go);
      });
    });
    doc.querySelectorAll("[data-sheet]").forEach(function (el) {
      el.addEventListener("click", function () {
        ui.toggleDockSheet(el.getAttribute("data-sheet"));
      });
    });
    ui.$("btn-dock-back").addEventListener("click", ui.goBack);

    ui.$("btn-tick").addEventListener("click", function () {
      if (ui.$("btn-tick").classList.contains("off") || ui.$("btn-tick").disabled) return;
      if (!ui.session.state || ui.session.state.phase !== "PLAYING") { ui.toast("这一局已经结束"); return; }
      ui.closeDockSheets();
      ui.$("btn-tick").disabled = true;
      if (ui.$("btn-tick-skip")) ui.$("btn-tick-skip").disabled = true;
      try {
        ui.captureCareerStatSnap();
        ui.runTickResult(sim.tickMonth(ui.session.state, config));
      } catch (err) {
        ui.session.statSnap = null;
        ui.$("btn-tick").disabled = false;
        if (ui.$("btn-tick-skip")) ui.$("btn-tick-skip").disabled = false;
        ui.toast("过月没走完，再点一次");
      }
    });

    if (ui.$("btn-tick-skip")) {
      ui.$("btn-tick-skip").addEventListener("click", function () {
        if (ui.$("btn-tick-skip").classList.contains("off") || ui.$("btn-tick-skip").disabled) return;
        if (!ui.session.state || ui.session.state.phase !== "PLAYING") { ui.toast("这一局已经结束"); return; }
        if (!sim.isCareerMode || !sim.isCareerMode(ui.session.state)) return;
        ui.closeDockSheets();
        ui.$("btn-tick").disabled = true;
        ui.$("btn-tick-skip").disabled = true;
        try {
          ui.captureCareerStatSnap();
          ui.runTickResult(sim.tickCareerToDecision(ui.session.state, config));
        } catch (err) {
          ui.session.statSnap = null;
          ui.$("btn-tick").disabled = false;
          ui.$("btn-tick-skip").disabled = false;
          ui.toast("过月没走完，再点一次");
        }
      });
    }

    ui.$("dlg-ok").addEventListener("click", function () {
      if (ui.session.dlgHook.mode === "tick") {
        ui.advanceTickQueue();
        return;
      }
      var fn = ui.session.dlgHook.onOk;
      ui.closeDlg();
      if (fn) fn();
    });
    ui.$("dlg-cancel").addEventListener("click", function () {
      var fn = ui.session.dlgHook.onCancel;
      ui.closeDlg();
      if (fn) fn();
    });

    doc.addEventListener("click", function (ev) {
      var t = ev.target;
      if (!t) return;
      if (t.nodeType !== 1 && t.parentElement) t = t.parentElement;
      if (!t || !t.getAttribute) return;
      if (t.closest) {
        var bound = t.closest("[data-offer],[data-tga-year],[data-hop-pick],[data-hop-apply],[data-hop-offer],[data-promote],[data-event-opt]");
        if (bound) t = bound;
      }
      var offerId = t.getAttribute("data-offer");
      if (offerId) {
        ui.applySim(sim.acceptOpeningOffer(ui.session.state, offerId, config), "", function () {
          ui.paintHq();
          ui.show("sc-hq");
        });
        return;
      }
      var yearChip = t.closest ? t.closest("[data-tga-year]") : null;
      var tgaYear = yearChip ? yearChip.getAttribute("data-tga-year") : t.getAttribute("data-tga-year");
      if (tgaYear) {
        ui.session.tgaYear = Number(tgaYear);
        ui.paintTga();
        return;
      }
      var hopPick = t.getAttribute("data-hop-pick");
      if (hopPick) {
        ui.session.pickedHopOffer = hopPick;
        ui.paintHq();
        return;
      }
      var hopApply = t.getAttribute("data-hop-apply");
      if (hopApply) {
        var hopId = ui.session.pickedHopOffer;
        var hopCopy = sim.careerCopy(config);
        if (!hopId) {
          ui.toast(hopCopy.hopPickHint || "先选一家再申请");
          return;
        }
        var hopResult = sim.applyYearEndOffer(ui.session.state, hopId, config);
        ui.applySim(hopResult, (hopResult && hopResult.notice) || "", function () {
          ui.session.pickedHopOffer = null;
          ui.paintHq();
          ui.show("sc-hq");
        });
        return;
      }
      var hopOffer = t.getAttribute("data-hop-offer");
      if (hopOffer) {
        var hopResult2 = sim.applyYearEndOffer(ui.session.state, hopOffer, config);
        ui.applySim(hopResult2, (hopResult2 && hopResult2.notice) || "", function () {
          ui.paintHq();
          ui.show("sc-hq");
        });
        return;
      }
      var promoteBtn = t.getAttribute("data-promote");
      if (promoteBtn) {
        var promoRes = sim.requestCareerPromotion
          ? sim.requestCareerPromotion(ui.session.state, config)
          : sim.promoteCareer(ui.session.state, config);
        var promoNotice = (sim.careerCopy(config).promoteOk) || "晋升成功。";
        if (promoRes && promoRes.queue && promoRes.queue.length) {
          ui.applySim(promoRes, (sim.careerCopy(config).lineStarted) || promoNotice, function () {
            ui.session.tickPages = (ui.session.tickPages || []).concat(promoRes.queue);
            if (!ui.session.tickPages.length) {
              ui.paintHq();
              ui.show("sc-hq");
              return;
            }
            ui.session.tickStep = ui.session.tickPages.length - promoRes.queue.length;
            if (ui.session.tickStep < 0) ui.session.tickStep = 0;
            ui.showTickPage();
          });
          return;
        }
        ui.applySim(promoRes, promoNotice, function () {
          ui.paintHq();
          ui.show("sc-hq");
        });
        return;
      }
      var optId = t.getAttribute("data-event-opt");
      if (optId && ui.session.dlgHook.mode === "tick-choice") {
        var page = ui.session.tickPages[ui.session.tickStep];
        if (!page) return;
        var picked;
        if (page.type === "hop") {
          if (optId === "stay") picked = sim.declineYearEndOffers(ui.session.state, config);
          else picked = sim.applyYearEndOffer(ui.session.state, optId, config);
        } else if (page.type === "promotion") {
          if (optId === "promote") {
            picked = sim.requestCareerPromotion
              ? sim.requestCareerPromotion(ui.session.state, config)
              : sim.promoteCareer(ui.session.state, config);
          } else picked = { ok: true, state: ui.session.state };
        } else if (page.type === "invite") {
          if (optId === "accept") picked = sim.acceptCareerInvite(ui.session.state, page.inviteId, config);
          else if (optId === "counter") picked = sim.counterCareerInvite(ui.session.state, page.inviteId, config);
          else picked = sim.declineCareerInvite(ui.session.state, page.inviteId, config);
        } else if (page.type === "careerLineFork") {
          picked = sim.resolveCareerPathFork(ui.session.state, optId, config);
        } else if (page.type === "careerLine") {
          picked = sim.resolveCareerLineChoice(ui.session.state, page.lineId, page.beatId, optId, config);
        } else if (page.type === "producerPitch") {
          picked = sim.resolveProducerPitch(ui.session.state, optId, config);
        } else {
          if (!page.eventId) return;
          picked = sim.resolveEventChoice(ui.session.state, page.eventId, optId, config);
        }
        if (!picked || !picked.ok) {
          ui.toast(sim.errorMessage(picked && picked.error));
          return;
        }
        ui.session.state = picked.state;
        GDS.save.persist(picked.state);
        if (picked.notice) ui.toast(picked.notice);
        if (picked.queue && picked.queue.length) {
          ui.session.tickPages = ui.session.tickPages.slice(0, ui.session.tickStep + 1).concat(picked.queue).concat(ui.session.tickPages.slice(ui.session.tickStep + 1));
        }
        ui.advanceTickQueue();
      }
    });

    ui.showPreviewFlag();
    GDS.save.restoreOrNull().then(function (saved) {
      var copyC = sim.careerCopy(config);
      if (saved && saved.mode === "career" && saved.career) {
        ui.$("name-input").value = saved.career.characterName || copyC.defaultName || "";
      } else {
        ui.$("name-input").value = copyC.defaultName || ui.$("name-input").value;
      }
    });
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", bind);
  else bind();
})(typeof globalThis !== "undefined" ? globalThis : this);
