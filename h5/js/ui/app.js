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

  ui.finishTickUi = function () {
    ui.closeDlg();
    ui.$("btn-tick").disabled = false;
    GDS.save.persist(ui.session.state);
    ui.paintHq();
    ui.paintMedia();
    ui.paintTga();
    if (ui.session.state.phase === "BANKRUPT") ui.show("sc-bankrupt");
    else if (ui.session.state.phase === "SETTLED") ui.show("sc-settled");
    else ui.show("sc-hq");
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

  ui.releaseReadyGame = function (gameId) {
    var config = cfg();
    if (!ui.session.state) return;
    var result = sim.releaseGame(ui.session.state, gameId, config);
    if (!result || !result.ok) {
      ui.toast(sim.errorMessage(result && result.error));
      return;
    }
    ui.session.state = result.state;
    GDS.save.persist(result.state);
    var rec = result.rec;
    ui.paintHq();
    ui.paintProject();
    ui.paintReleased();
    ui.paintMedia();
    if (rec && rec.media) {
      var copy = config.copy || {};
      ui.openDlg({
        mode: "once",
        kind: "info",
        kicker: "发售",
        title: "媒体评分 · " + rec.title,
        body: copy.mediaRevealHint || "",
        hideOk: true,
        hideActions: true,
        okText: "好的"
      });
      ui.startMediaReveal(rec, {
        hint: copy.mediaRevealHint || "",
        onDone: function () { ui.unlockDlgOk("好的"); }
      });
    } else {
      ui.toast("发布了《" + ((rec && rec.title) || "") + "》");
    }
  };

  function idOf(list, name) {
    for (var i = 0; i < list.length; i++) if (sim.displayName(list[i]) === name) return list[i].id;
    return list[0] && list[0].id;
  }

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
            ui.session.pendingName = saved.career.characterName;
            ui.session.pendingRole = saved.career.roleId;
            ui.paintCareerOffers();
            ui.show("sc-offer");
            return;
          }
          ui.session.pendingName = v;
          ui.paintCareerRoles();
          ui.show("sc-role");
        });
      });
    });

    ui.$("btn-role").addEventListener("click", function () {
      var copyC = sim.careerCopy(config);
      var roleId = ui.session.pendingRole;
      var name = ui.session.pendingName || copyC.defaultName;
      if (!roleId) { ui.toast(sim.errorMessage(sim.ERR.CAREER_ROLE_INVALID)); return; }
      ui.session.state = sim.createCareerGame(name, roleId, config);
      ui.paintCareerOffers();
      ui.show("sc-offer");
      GDS.save.persist(ui.session.state);
    });

    function backToBoot() { ui.show("sc-boot"); }
    ui.$("btn-restart").addEventListener("click", backToBoot);
    ui.$("btn-again1").addEventListener("click", backToBoot);
    ui.$("btn-again2").addEventListener("click", backToBoot);

    doc.querySelectorAll("[data-go]").forEach(function (el) {
      el.addEventListener("click", function () {
        if (!ui.session.state) { ui.toast("先开张"); return; }
        var go = el.getAttribute("data-go");
        var blocked = {
          market: 1, pitch: 1, relocate: 1, ad: 1, studio: 1, liveops: 1,
          released: 1, project: 1, bankrupt: 1
        };
        if (sim.isCareerMode(ui.session.state) && blocked[go]) return;
        ui.closeDockSheets();
        if (go === "market") ui.paintMarket();
        if (go === "pitch") ui.paintPitch();
        if (go === "project") ui.paintProject();
        if (go === "liveops") ui.paintLiveops();
        if (go === "studio") ui.paintStudio();
        if (go === "media") ui.paintMedia();
        if (go === "tga") ui.paintTga();
        if (go === "released") ui.paintReleased();
        if (go === "share") ui.paintShare();
        if (go === "calendar") ui.paintCalendar();
        if (go === "resume") ui.paintResume && ui.paintResume();
        if (go === "player") ui.paintPlayer && ui.paintPlayer();
        if (go === "settled") ui.paintEnds();
        if (go === "bankrupt") ui.paintEnds();
        if (go === "relocate" || go === "ad") ui.paintStaticCopy();
        ui.show("sc-" + go);
      });
    });
    doc.querySelectorAll("[data-sheet]").forEach(function (el) {
      el.addEventListener("click", function () {
        ui.toggleDockSheet(el.getAttribute("data-sheet"));
      });
    });
    ui.$("btn-dock-back").addEventListener("click", ui.goBack);

    ui.$("btn-relocate").addEventListener("click", function () {
      if (!ui.session.state) return;
      var scale = ui.session.state.company.scale;
      ui.applySim(sim.relocate(ui.session.state, config), "换了场地，现在是" + sim.scaleLabel(scale === "small" ? "medium" : "large", config), function () {
        ui.paintStaticCopy();
        ui.paintHq();
        ui.show("sc-hq");
      });
    });

    ui.$("btn-ad").addEventListener("click", function () {
      if (!ui.session.state) return;
      ui.applySim(sim.buyAd(ui.session.state, config), "粉丝涨了，加持挂在下一款发售上", function () {
        ui.paintHq();
        ui.show("sc-hq");
      });
    });

    doc.querySelectorAll("[data-type]").forEach(function (el) {
      el.addEventListener("click", function () {
        doc.querySelectorAll("[data-type]").forEach(function (x) { x.classList.remove("on"); });
        el.classList.add("on");
      });
    });
    doc.querySelectorAll("[data-cyc]").forEach(function (el) {
      el.addEventListener("click", function () {
        doc.querySelectorAll("[data-cyc]").forEach(function (x) { x.classList.remove("on"); });
        el.classList.add("on");
      });
    });

    ui.$("btn-pitch").addEventListener("click", function () {
      if (!ui.session.state) return;
      var title = ui.$("game-title").value.replace(/^\s+|\s+$/g, "") || "未命名游戏";
      var typeEl = doc.querySelector("[data-type].on");
      var cycEl = doc.querySelector("[data-cyc].on");
      var releaseType = typeEl ? typeEl.getAttribute("data-type") : "boxed";
      var picked = [];
      ui.$("pitch-team").querySelectorAll(".chip.on").forEach(function (b) {
        picked.push(b.getAttribute("data-sid"));
      });
      GDS.bridge.auditText(title).then(function (res) {
        if (!res.ok) { ui.toast(res.message); return; }
        var gName = ui.session.pitchPick.genre;
        var pName = ui.session.pitchPick.play;
        var platName = ui.session.pitchPick.plat;
        var studio = ui.session.state.studios[0];
        var producerId = (studio && studio.leadId && picked.indexOf(studio.leadId) >= 0) ? studio.leadId : picked[0];
        var result = sim.pitchProject(ui.session.state, {
          title: title,
          genreId: idOf(config.content.genres, gName),
          gameplayId: idOf(config.content.gameplay, pName),
          platformId: idOf(sim.platformsNow(ui.session.state, config), platName),
          releaseType: releaseType,
          cycle: cycEl ? cycEl.getAttribute("data-cyc") : "medium",
          producerId: producerId,
          memberIds: picked,
          studioId: studio ? studio.id : null
        }, config);
        var months = result.ok ? sim.cycleMonths(cycEl ? cycEl.getAttribute("data-cyc") : "medium", config, releaseType) : 0;
        ui.applySim(result, result.ok ? ("「" + title + "」开工了，做 " + months + " 个月") : "", function () {
          ui.paintHq();
          ui.show("sc-hq");
        });
      });
    });

    ui.$("btn-studio").addEventListener("click", function () {
      if (!ui.session.state) return;
      var nm = ui.$("studio-name").value.replace(/^\s+|\s+$/g, "") || "夜猫组";
      var leadChip = ui.$("studio-leads").querySelector(".chip.on");
      var leadId = leadChip ? leadChip.getAttribute("data-lead") : (ui.session.state.staff[0] && ui.session.state.staff[0].id);
      GDS.bridge.auditText(nm).then(function (res) {
        if (!res.ok) { ui.toast(res.message); return; }
        ui.applySim(sim.foundStudio(ui.session.state, nm, leadId, config), "工作室「" + nm + "」成立，负责人默认当制作人", function () {
          ui.paintStudio();
        });
      });
    });

    ui.$("btn-tick").addEventListener("click", function () {
      if (ui.$("btn-tick").classList.contains("off") || ui.$("btn-tick").disabled) return;
      if (!ui.session.state || ui.session.state.phase !== "PLAYING") { ui.toast("这一局已经结束"); return; }
      ui.closeDockSheets();
      ui.$("btn-tick").disabled = true;
      try {
        var tick = sim.tickMonth(ui.session.state, config);
        ui.session.state = tick.state;
        ui.session.tickPages = tick.queue || [];
        ui.session.tickStep = 0;
        if (!ui.session.tickPages.length) {
          ui.finishTickUi();
          return;
        }
        ui.showTickPage();
      } catch (err) {
        ui.$("btn-tick").disabled = false;
        ui.toast("过月没走完，再点一次");
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
        var bound = t.closest("[data-offer],[data-role],[data-release],[data-tga-year],[data-hop-pick],[data-hop-apply],[data-hop-offer],[data-promote],[data-event-opt]");
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
      var rolePick = t.getAttribute("data-role");
      if (rolePick) {
        ui.session.pendingRole = rolePick;
        ui.paintCareerRoles();
        return;
      }
      var releaseId = t.getAttribute("data-release");
      if (releaseId) {
        ui.releaseReadyGame(releaseId);
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
