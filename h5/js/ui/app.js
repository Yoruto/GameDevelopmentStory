(function (root) {
  var GDS = root.GDS;
  var ui = GDS.ui;
  var sim = GDS.sim;
  var doc = root.document;

  function cfg() { return GDS.CONFIG; }

  function paceSnapshot(state) {
    var career = state && state.career;
    var stats = career && career.stats || {};
    var view = career && sim.careerProjectView(state, cfg());
    return career ? {
      fame: Number(career.fame) || 0,
      health: Number(career.health) || 0,
      stats: { program: Number(stats.program) || 0, design: Number(stats.design) || 0,
        art: Number(stats.art) || 0, music: Number(stats.music) || 0 },
      titleId: career.titleId || null,
      progress: view && !view.idle ? Number(view.progress) || 0 : null
    } : null;
  }

  function paceRecap(before, after, meta) {
    var changes = [];
    var statNames = { program: "程序", design: "策划", art: "美术", music: "音乐" };
    var monthCount = meta && meta.months || 1;
    function add(label, a, b) {
      var delta = Math.round(b) - Math.round(a);
      if (delta) changes.push(label + " " + (delta > 0 ? "+" : "") + delta);
    }
    if (!before || !after) return null;
    if (after.health < before.health) add("健康", before.health, after.health);
    if (before.titleId && before.titleId === after.titleId && before.progress != null && after.progress != null) {
      var progressDelta = Math.round(after.progress * 100) - Math.round(before.progress * 100);
      if (progressDelta) changes.push("作品进度 " + (progressDelta > 0 ? "+" : "") + progressDelta + "%");
    }
    add("声望", before.fame, after.fame);
    if (after.health >= before.health) add("健康", before.health, after.health);
    Object.keys(statNames).forEach(function (key) {
      add(statNames[key], before.stats[key], after.stats[key]);
    });
    return {
      head: "本次进展 · " + monthCount + " 个月",
      main: changes.slice(0, 3).join(" · ") || "稳步前进",
      detail: changes.slice(3).join(" · ")
    };
  }

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
      live: live ? sim.cloneTitleStats(live, cfg()) : null,
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
    var delta;
    if (!el || before == null || after == null) return;
    delta = Math.round(after) - Math.round(before);
    if (!delta) return;
    ui.motion.floatText(el.parentNode, (delta > 0 ? "+" : "") + delta);
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
        var d = sim.titleDims(cfg())[i];
        ui.flashStatDelta("hq-live-" + suffix, snap.live[d], live[d]);
      });
    }
  };

  ui.finishTickUi = function () {
    var dateEl, fromText, routine = !(ui.session.tickPages || []).length;
    ui.closeDlg();
    GDS.save.persist(ui.session.state);
    ui.session.recap = paceRecap(ui.session.paceBefore, paceSnapshot(ui.session.state), ui.session.paceMeta);
    ui.session.paceBefore = null;
    ui.session.paceMeta = null;
    ui.session.tickPages = [];
    ui.session.tickStep = 0;
    // 收口拍：队列走完（事件选择的属性加成已全部落定）才刷新面板——过月成长与事件
    // 效果在这一次 paint 里一起落新值；普通节点缩短日期翻牌，重要事件沿用 1s。
    dateEl = ui.$("hq-date");
    fromText = ui.motion.text(dateEl);
    ui.paintHq();
    ui.paintTga();
    ui.flashCareerStatDeltas();
    // UI completion follows the actual animation end (with a WebView fallback).
    // Cancellation on restart suppresses this callback and any stale scene jump.
    ui.motion.rollText(dateEl, fromText, function () {
      ui.$("btn-tick").disabled = false;
      // 只有结算才切换场景；普通过月留在当前主界面，不重播整页进场动画。
      var phase = ui.session.state && ui.session.state.phase;
      if (phase === "SETTLED") {
        ui.paintEnds();
        ui.show("sc-settled");
        if (ui.openCareerPoster) ui.openCareerPoster();
      }
    }, routine ? 350 : 1000);
  };

  ui.runTickResult = function (tick) {
    ui.session.state = tick.state;
    ui.session.tickPages = (tick.queue || []).filter(function (page) {
      return page.type !== "yearBanner";
    });
    ui.session.paceMeta = {
      months: tick.skippedMonths || 1
    };
    ui.session.tickStep = 0;
    // 事件队列是一个事务：选项未答完时不保存已推进的月份。
    // 刷新后从上一个完整存档重放，避免必选事件被跳过。
    // Master 2026-09-22 拍板：先弹队列（事件/发售/颁奖——含属性加成的选择都在这里落定，
    // 此时面板保持旧值不动），队列走完进 finishTickUi 统一放日期动画 + 属性浮字。
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
        var lockHint = null;
        btn.type = "button";
        btn.className = "btn ghost";
        btn.setAttribute("data-event-opt", opt.id);
        // P4a：不满足 req 的选项置灰 + 一行解锁提示（不隐藏）。判定 RNG-free。
        if (opt.req && ui.session.state && sim.careerOptionLockHint) {
          lockHint = sim.careerOptionLockHint(ui.session.state, cfg(), opt.req);
        }
        btn.disabled = !!lockHint;
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
        if (lockHint) {
          // 置灰提示独立成行，别把选项文案挤变形。
          var lockEl = doc.createElement("span");
          lockEl.className = "opt-lock";
          lockEl.textContent = lockHint;
          btn.appendChild(lockEl);
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
    var bootRestore = GDS.save.restoreOrNull();
    ui.paintStaticCopy();

    GDS.save.onStatus(function (status) {
      ui.$("save-status-boot").textContent = status.message || "";
      ["btn-save-retry", "btn-save-retry-boot"].forEach(function (id) {
        ui.$(id).hidden = status.kind !== "error" &&
          !(id === "btn-save-retry-boot" && status.kind === "local" && GDS.bridge.canCloud());
      });
      ["btn-cloud-boot", "btn-cloud-hq"].forEach(function (id) {
        ui.$(id).hidden = status.kind !== "conflict";
      });
      ui.$("hq-save-actions").hidden = ui.$("btn-save-retry").hidden && ui.$("btn-cloud-hq").hidden;
    });
    ["btn-save-retry", "btn-save-retry-boot"].forEach(function (id) {
      ui.$(id).addEventListener("click", function () { GDS.save.retry(); });
    });

    function showContinue(saved) {
      ui.session.savedState = GDS.save.validState(saved) ? saved : null;
      ui.$("btn-continue").hidden = !ui.session.savedState;
      ui.$("btn-continue").textContent = saved && saved.phase === "SETTLED" ? "查看上局结算" : "继续旧档";
    }

    function enterSaved(saved) {
      if (!GDS.save.validState(saved)) { ui.toast("存档无法继续，原数据未删除"); return; }
      ui.session.recap = null;
      ui.session.paceBefore = null;
      ui.session.paceMeta = null;
      ui.session.state = saved;
      if (saved.phase === "OFFER") {
        ui.paintCareerOffers();
        ui.show("sc-offer");
      } else if (saved.phase === "SETTLED") {
        ui.paintEnds();
        ui.show("sc-settled");
      } else {
        ui.paintHq();
        ui.show("sc-hq");
      }
    }

    ui.$("btn-continue").addEventListener("click", function () {
      bootRestore.then(function () { return enterSaved(ui.session.savedState); })
        .catch(function (error) { ui.toast(error.message || "读取存档失败"); });
    });

    function chooseCloud() {
      ui.openDlg({ kind: "confirm", title: "载入云端存档？",
        body: "这会用云端进度替换本机的冲突进度。",
        cancel: true, okText: "载入云端", onOk: function () {
          GDS.save.loadCloud().then(function (saved) {
            showContinue(saved);
            return enterSaved(saved);
          }).catch(function (error) { ui.toast(error.message || "载入云端失败"); });
        } });
    }
    ui.$("btn-cloud-boot").addEventListener("click", chooseCloud);
    ui.$("btn-cloud-hq").addEventListener("click", chooseCloud);

    ui.$("btn-start").addEventListener("click", function () {
      bootRestore.then(function () {
        function begin() {
          showContinue(null);
          ui.enterCareerFromStart(config);
        }
        if (ui.session.savedState) {
          ui.openDlg({ kind: "confirm", title: "开始新局？",
            body: "当前进度会被新局覆盖。确认后才会创建新存档。",
            cancel: true, okText: "覆盖并开始", onOk: begin });
        } else begin();
      }).catch(function (error) { ui.toast(error.message || "读档尚未完成，请重试"); });
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

    ui.enterCareerFromStart = function (config) {
      var draft = ui.session.startRoll || {};
      if (!draft.roleId) { ui.toast(sim.errorMessage(sim.ERR.CAREER_ROLE_INVALID)); return; }
      ui.session.recap = null;
      ui.session.paceBefore = null;
      ui.session.paceMeta = null;
      ui.session.state = sim.createCareerGame("我", draft.roleId, config, {
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
      // A cancelled animation must not complete the previous game's tick.
      ui.motion.cancel(ui.$("hq-date"));
      showContinue(ui.session.state);
      ui.session.state = null;
      ui.session.startRoll = null;
      ui.session.rollsLeft = null;
      ui.session.tickPages = null;
      ui.session.tickStep = 0;
      ui.session.recap = null;
      ui.session.paceBefore = null;
      ui.session.paceMeta = null;
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
      try {
        ui.captureCareerStatSnap();
        ui.session.paceBefore = paceSnapshot(ui.session.state);
        // P3：唯一推进按钮 = 「继续」，快进到下一个节点（与逐月共用同一条 tick 路径）。
        ui.runTickResult(sim.skipToNextNode(ui.session.state, config));
      } catch (err) {
        ui.session.statSnap = null;
        ui.session.paceBefore = null;
        ui.session.paceMeta = null;
        ui.$("btn-tick").disabled = false;
        ui.toast("推进没走完，再点一次");
      }
    });

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
        // P3：选项落地统一走 sim.resolveCareerQueueChoice（与测试自动应答同一条路径）。
        picked = sim.resolveCareerQueueChoice(ui.session.state, page, optId, config);
        if (!picked || !picked.ok) {
          ui.toast(sim.errorMessage(picked && picked.error));
          return;
        }
        ui.session.state = picked.state;
        if (picked.notice) ui.toast(picked.notice);
        if (picked.queue && picked.queue.length) {
          ui.session.tickPages = ui.session.tickPages.slice(0, ui.session.tickStep + 1).concat(picked.queue).concat(ui.session.tickPages.slice(ui.session.tickStep + 1));
        }
        ui.advanceTickQueue();
      }
    });

    // webview 被杀兜底：页面隐藏/关闭时把当前档立即写一次存档（双写之一；常规写入
    // 已在 applySim / runTickResult / finishTickUi 覆盖）。localStorage 写入是同步的，
    // pagehide 场景也能落盘。
    function persistOnHide() {
      if (ui.session.state && !(ui.session.tickPages &&
          ui.session.tickStep < ui.session.tickPages.length)) {
        GDS.save.persist(ui.session.state);
      }
    }
    doc.addEventListener("visibilitychange", function () {
      if (doc.visibilityState === "hidden") persistOnHide();
    });
    root.addEventListener("pagehide", persistOnHide);
    bootRestore.then(function (saved) {
      showContinue(saved);
      if (saved && GDS.save.validState(saved)) {
        // 冲突时留在开局页，让玩家先选择本机或云端进度。
        if (GDS.save.status().kind !== "conflict") return enterSaved(saved);
      }
      if (GDS.save.restoreIssue()) ui.toast(GDS.save.restoreIssue());
    }).catch(function (error) { ui.toast(error.message || "读取存档失败，请重试"); });
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", bind);
  else bind();
})(typeof globalThis !== "undefined" ? globalThis : this);
