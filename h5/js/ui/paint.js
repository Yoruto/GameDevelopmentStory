(function (root) {
  var GDS = root.GDS;
  var ui = GDS.ui;
  var sim = GDS.sim;
  var doc = root.document;

  function cfg() { return GDS.CONFIG; }
  function st() { return ui.session.state; }

  ui.paintCalendar = function () {
    var state = st();
    var config = cfg();
    if (!state) return;
    var copy = config.copy || {};
    var careerCopy = sim.careerCopy ? sim.careerCopy(config) : {};
    var head = ui.$("calendar-head");
    var hint = ui.$("calendar-hint");
    var grid = ui.$("calendar-grid");
    var m, cell, lab, empty, line, pack, plans, titles, shipped, cal;
    if (!grid) return;
    grid.textContent = "";
    if (sim.isCareerMode && sim.isCareerMode(state)) {
      pack = sim.careerYearReleases(state.year, config, state);
      if (head) head.textContent = (careerCopy.calendarEntry || copy.calendarTitle || "发售情报") + " · " + pack.year;
      if (hint) hint.textContent = copy.calendarHint || hint.textContent;
      shipped = {};
      (state.worldReleased || []).forEach(function (g) { shipped[g.id] = true; });
      for (m = 1; m <= 12; m++) {
        cell = doc.createElement("div");
        cell.className = "cal-cell";
        if (m === state.month) cell.classList.add("now");
        if (m < state.month) cell.classList.add("past");
        lab = doc.createElement("div");
        lab.className = "cal-m";
        lab.textContent = m + "月";
        cell.appendChild(lab);
        titles = (pack.months && pack.months[m]) || [];
        if (!titles.length) {
          empty = doc.createElement("span");
          empty.className = "cal-g cal-tag";
          empty.textContent = copy.calendarEmpty || "暂无";
          cell.appendChild(empty);
        } else {
          titles.slice(0, 4).forEach(function (t) {
            line = doc.createElement("span");
            line.className = "cal-g";
            if (t.isVersion) {
              if (m < state.month) line.className += " shipped";
              line.textContent = (t.label || sim.worldLabel(t, config)) +
                (m < state.month ? (" · " + (copy.calendarShipped || "已发")) : "") +
                " · " + (copy.liveopsVersionTag || "版本");
            } else if (shipped[t.id] || m < state.month) {
              line.className += " shipped";
              line.textContent = sim.worldLabel(t, config) + " · " + (copy.calendarShipped || "已发");
              if (sim.isLiveOpsTitle && sim.isLiveOpsTitle(t)) {
                line.textContent += " · " + (((copy.releaseTypes || {}).liveops) || "");
              }
            } else {
              line.textContent = sim.worldLabel(t, config);
              if (sim.isLiveOpsTitle && sim.isLiveOpsTitle(t)) {
                line.textContent += " · " + (((copy.releaseTypes || {}).liveops) || "");
              }
            }
            cell.appendChild(line);
          });
        }
        grid.appendChild(cell);
      }
      return;
    }
    cal = sim.getRivalCalendar(state, state.year);
    if (head) head.textContent = (copy.calendarTitle || "发售日历") + " · " + cal.year;
    if (hint) hint.textContent = copy.calendarHint || hint.textContent;
    var grid = ui.$("calendar-grid");
    if (!grid) return;
    grid.textContent = "";
    var m;
    for (m = 1; m <= 12; m++) {
      var cell = doc.createElement("div");
      cell.className = "cal-cell";
      if (m === state.month) cell.classList.add("now");
      if (m < state.month) cell.classList.add("past");
      var lab = doc.createElement("div");
      lab.className = "cal-m";
      lab.textContent = m + "月";
      cell.appendChild(lab);
      var plans = (cal.months[m] || []).slice();
      if (sim.listLiveOpsVersionDrops) {
        sim.listLiveOpsVersionDrops(state, state.year, config).forEach(function (d) {
          if (d.month !== m) return;
          plans.push(d);
        });
      }
      if (!plans.length) {
        var empty = doc.createElement("span");
        empty.className = "cal-g cal-tag";
        empty.textContent = copy.calendarEmpty || "暂无";
        cell.appendChild(empty);
      } else {
        plans.forEach(function (plan) {
          var line = doc.createElement("span");
          line.className = "cal-g";
          var mark = "";
          if (plan.isVersion) {
            if (m < state.month) line.className += " shipped";
            line.textContent = (plan.label || plan.title || "") +
              (m < state.month ? (" · " + (copy.calendarShipped || "已发")) : "") +
              " · " + (copy.liveopsVersionTag || "版本") +
              (plan.source === "player" ? (" · " + (copy.chartPlayerTag || "本公司")) : "");
            cell.appendChild(line);
            return;
          }
          if (plan.status === "shipped") {
            mark = " · " + (copy.calendarShipped || "已发");
            line.className += " shipped";
          } else if (plan.status === "moved") {
            mark = " · " + (copy.calendarMoved || "已改期");
            line.className += " moved";
          } else if (m < state.month) {
            mark = " · " + (copy.calendarShipped || "已发");
          }
          var plat = plan.platformId
            ? sim.contentName(config.content.platforms, plan.platformId)
            : "";
          line.textContent = sim.calendarPlanLabel(plan) + (plat ? " · " + plat : "") + mark;
          cell.appendChild(line);
        });
      }
      grid.appendChild(cell);
    }
  };

  ui.paintChart = function () {
    var state = st();
    var config = cfg();
    if (!state) return;
    var copy = config.copy || {};
    var box = ui.$("month-chart");
    if (!box) return;
    box.textContent = "";
    var list = sim.monthlyChart(state, config);
    if (!list.length) {
      var empty = doc.createElement("p");
      empty.className = "hint";
      empty.textContent = copy.chartEmpty || "这个月还没有在售作品上榜。";
      box.appendChild(empty);
      return;
    }
    var per = 5;
    var pages = Math.ceil(list.length / per);
    if (ui.session.uiPage.chart >= pages) ui.session.uiPage.chart = pages - 1;
    if (ui.session.uiPage.chart == null || ui.session.uiPage.chart < 0) ui.session.uiPage.chart = 0;
    list.slice(ui.session.uiPage.chart * per, ui.session.uiPage.chart * per + per).forEach(function (row) {
      var it = doc.createElement("div");
      it.className = "item";
      var left = doc.createElement("span");
      var who = row.source === "player"
        ? (copy.chartPlayerTag || "本公司")
        : (row.pub || copy.chartFillerTag || "");
      left.textContent = row.rank + ". " + (who ? who + " · " : "") + "《" + row.title + "》";
      var b = doc.createElement("b");
      b.textContent = row.monthSales + (row.avg ? " · " + row.avg : "");
      it.appendChild(left);
      it.appendChild(b);
      box.appendChild(it);
    });
    ui.addPager(box, ui.session.uiPage.chart, pages, function (p) {
      ui.session.uiPage.chart = p;
      ui.paintChart();
    });
  };

  ui.paintShare = function () {
    var state = st();
    var config = cfg();
    if (!state) return;
    sim.ensureRivals(state, config);
    ui.paintChart();
    ui.$("hq-mysales").textContent = String(state.monthSales || 0);
    var shareBox = ui.$("hq-share-rows");
    if (shareBox) {
      shareBox.textContent = "";
      sim.marketShares(state, config).forEach(function (row) {
        var it = doc.createElement("div");
        it.className = "row item";
        var l = doc.createElement("span");
        l.textContent = row.displayName + "份额";
        var b = doc.createElement("b");
        b.textContent = sim.formatSharePercent(row.share, config) +
          " · 我方 " + row.playerSales + " / 全市场 " + (row.playerSales + row.rivalSales);
        it.appendChild(l); it.appendChild(b); shareBox.appendChild(it);
      });
    }
    var box = ui.$("rival-month");
    if (box) {
      box.textContent = "";
      var list = state.rivalMonth || [];
      if (!list.length) {
        var empty = doc.createElement("p");
        empty.className = "hint";
        empty.textContent = "这个月没有大厂新作上线。点「下一月」他们也会推进开发。";
        box.appendChild(empty);
      } else {
        var per = 3;
        var pages = Math.ceil(list.length / per);
        if (ui.session.uiPage.rival >= pages) ui.session.uiPage.rival = pages - 1;
        list.slice(ui.session.uiPage.rival * per, ui.session.uiPage.rival * per + per).forEach(function (g) {
        var it = doc.createElement("div");
        it.className = "item";
        var left = doc.createElement("span");
        left.textContent = g.pub + " · " + g.series +
          (g.platformId ? " · " + sim.contentName(config.content.platforms, g.platformId) : "");
        var b = doc.createElement("b");
        b.textContent = (g.genreId ? sim.contentName(config.content.genres, g.genreId) : "") + "/" +
          (g.gameplayId ? sim.contentName(config.content.gameplay, g.gameplayId) : "") + " · " + g.avg +
          (g.mau ? " · " + ((config.copy && config.copy.mauLabel) || "月活") + " " + sim.formatMau(g.mau) : "");
        it.appendChild(left); it.appendChild(b); box.appendChild(it);
        });
        ui.addPager(box, ui.session.uiPage.rival, pages, function (p) {
          ui.session.uiPage.rival = p; ui.paintShare();
        });
      }
    }
    var mauBox = ui.$("rival-mau");
    if (mauBox) {
      mauBox.textContent = "";
      var hits = (state.rivalReleased || []).filter(function (g) { return g.mau > 0; });
      if (!hits.length) {
        var noHit = doc.createElement("p");
        noHit.className = "hint";
        noHit.textContent = "还没有爆款月活可看。历史级大作会把月活写在这里。";
        mauBox.appendChild(noHit);
      } else {
        hits.forEach(function (g) {
          var it = doc.createElement("div");
          it.className = "item";
          var left = doc.createElement("span");
          left.textContent = (g.pub ? g.pub + " · " : "") + "《" + (g.title || g.series) + "》";
          var b = doc.createElement("b");
          b.textContent = ((config.copy && config.copy.mauLabel) || "月活") + " " + sim.formatMau(g.mau);
          it.appendChild(left); it.appendChild(b); mauBox.appendChild(it);
        });
      }
    }
    var platsBox = ui.$("hq-plats");
    platsBox.textContent = "";
    sim.platformsNow(state, config).forEach(function (p) {
      var sp = doc.createElement("span");
      sp.className = "pill";
      sp.textContent = sim.displayName(p);
      platsBox.appendChild(sp);
    });
    ui.$("hq-console").textContent = state.company.ownConsole
      ? ("自研主机已解锁，并入" +
        sim.contentName(config.content.platforms, config.company.ownConsoleFoldIntoPlatformId || "console") +
        "加成。")
      : ("自研主机：大公司且粉丝够 " + config.company.unlockOwnConsoleMinFans + " 才并入主机端加成。");
  };

  ui.paintCareerRoles = function () {
    var config = cfg();
    var copy = sim.careerCopy(config);
    var box = ui.$("role-box");
    var roles, title, hint, btn;
    if (!box) return;
    box.textContent = "";
    roles = sim.careerPlayableRoles(config);
    if (!ui.session.pendingRole && roles[0]) ui.session.pendingRole = roles[0].id;
    title = ui.$("role-title");
    hint = ui.$("role-hint");
    btn = ui.$("btn-role");
    if (title) title.textContent = copy.roleTitle || "擅长";
    if (hint) hint.textContent = copy.roleHint || "";
    if (btn) btn.textContent = copy.roleNext || "看 offer";
    roles.forEach(function (r) {
      var chip = doc.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (r.id === ui.session.pendingRole ? " on" : "");
      chip.textContent = sim.worldLabel(r, config);
      chip.setAttribute("data-role", r.id);
      box.appendChild(chip);
    });
  };

  ui.paintCareerOffers = function () {
    var state = st();
    var config = cfg();
    var copy = sim.careerCopy(config);
    var box = ui.$("offer-list");
    var title, hint;
    if (!box || !state || !state.career) return;
    box.textContent = "";
    title = ui.$("offer-title");
    hint = ui.$("offer-hint");
    if (title) title.textContent = copy.offerTitle || "三份 offer";
    if (hint) hint.textContent = copy.offerHint || "";
    (state.career.openingOffers || []).forEach(function (o) {
      var co = sim.careerCompany(o.companyId, config);
      var role = sim.careerRole(o.roleId, config);
      var card = doc.createElement("div");
      var name = doc.createElement("div");
      var meta = doc.createElement("p");
      var risk = doc.createElement("p");
      var go = doc.createElement("button");
      card.className = "offer-card";
      name.className = "name";
      name.textContent = co ? sim.worldLabel(co, config) : o.companyId;
      meta.className = "hint";
      meta.textContent = (role ? sim.worldLabel(role, config) : "") +
        " · " + (copy.salaryLabel || "月薪") + " " + o.salary;
      risk.className = "hint";
      risk.textContent = (copy.riskLabel || "风险") + "：" + (o.risk || "");
      go.type = "button";
      go.className = "btn wide mt-8";
      go.textContent = copy.acceptButton || "入职";
      go.setAttribute("data-offer", o.id);
      card.appendChild(name);
      card.appendChild(meta);
      card.appendChild(risk);
      card.appendChild(go);
      box.appendChild(card);
    });
  };

  ui.paintCareerHq = function () {
    var state = st();
    var config = cfg();
    var copy = sim.careerCopy(config);
    var career, co, role, view, live, job, box, tickBtn, self, head, stats;
    var hopCard, hopList, hopMonth, payEl, roleEl, nameEl, metaEl, xpEl;
    if (!state || !state.career) return;
    sim.ensureCareerExtras(state);
    career = state.career;
    co = sim.careerCompany(career.companyId, config);
    role = sim.careerRole(career.roleId, config);
    view = sim.careerProjectView(state, config);
    live = view.liveStats;
    stats = career.stats || {};
    ui.$("hq-name").textContent = career.characterName;
    ui.$("end-name").textContent = career.characterName;
    ui.$("hq-date").textContent = sim.dateText(state);
    ui.$("hq-funds").textContent = (copy.savingsLabel || "积蓄") + " " + career.savings;
    payEl = ui.$("hq-pay-delta");
    if (payEl) {
      if (career.lastPay) {
        payEl.hidden = false;
        payEl.textContent = (copy.payDeltaPrefix || "+") + career.lastPay;
      } else {
        payEl.hidden = true;
        payEl.textContent = "";
      }
    }
    ui.$("hq-fans").textContent = (copy.fameLabel || "声望") + " " + career.fame;
    ui.$("hq-scale").textContent = co
      ? (sim.worldLabel(co, config) + (function () {
        var studio = sim.careerStudio(career.companyId, career.studioId, config);
        return studio ? (" / " + sim.worldLabel(studio, config)) : "";
      })())
      : (copy.waitRole || "待命");
    ui.$("hq-cap").textContent = (copy.roleChipLabel || "岗位") + " " + (role ? sim.worldLabel(role, config) : "");
    ui.$("hq-plats-chip").textContent = view.idle
      ? (view.idleLabel || copy.idleHint || "待命")
      : ((copy.phasePrefix || "阶段") + " " + (view.phase ? sim.worldLabel(view.phase, config) : ""));
    roleEl = ui.$("hq-player-role");
    if (roleEl) roleEl.textContent = role ? sim.worldLabel(role, config) : "";
    head = ui.$("hq-player-head");
    if (head) head.textContent = copy.playerHead || "自身";
    function showNum(id, val) {
      var el = ui.$(id);
      if (el) el.textContent = val != null ? String(Math.round(val)) : "—";
    }
    showNum("hq-self-p", stats.program);
    showNum("hq-self-d", stats.design);
    showNum("hq-self-a", stats.art);
    showNum("hq-self-m", stats.music);
    (function paintSkills() {
      var skillEl = ui.$("hq-player-skills");
      var bits;
      if (!skillEl || !sim.careerSkillLines) return;
      bits = sim.careerSkillLines(state, config);
      if (!bits.length) {
        skillEl.textContent = copy.skillEmpty || "";
        return;
      }
      skillEl.textContent = (copy.skillLabel || "熟练度") + " · " + bits.map(function (row) {
        return row.label + " " + (row.tier || "");
      }).join(" · ");
    })();
    head = ui.$("hq-project-head");
    if (head) head.textContent = copy.projectHead || "在研作品";
    nameEl = ui.$("hq-project-name");
    metaEl = ui.$("hq-project-meta");
    xpEl = ui.$("hq-project-xp");
    if (view.idle) {
      if (nameEl) nameEl.textContent = view.idleLabel || copy.idleHint || "待命";
      if (metaEl) metaEl.textContent = "";
      if (xpEl) xpEl.textContent = "";
    } else {
      if (nameEl) {
        nameEl.textContent = sim.worldLabel(view.title, config) +
          (view.phase ? (" · " + sim.worldLabel(view.phase, config)) : "") +
          " · " + Math.round((view.progress || 0) * 100) + "%";
      }
      if (metaEl) {
        metaEl.textContent = (copy.genreLabel || "题材") + " " +
          sim.contentName(config.content.genres, view.genreId) +
          " · " + (copy.gameplayLabel || "玩法") + " " +
          sim.contentName(config.content.gameplay, view.gameplayId) +
          (view.title && sim.releaseTypeLabel
            ? (" · " + sim.releaseTypeLabel(view.title.releaseType, config))
            : "");
      }
      if (xpEl) {
        xpEl.textContent = (copy.xpLabel || "工作室经验") + " · " +
          sim.contentName(config.content.genres, view.genreId) + " " + (view.genreTier || "") +
          " · " + sim.contentName(config.content.gameplay, view.gameplayId) + " " + (view.gameplayTier || "");
      }
    }
    job = ui.$("hq-career-job");
    if (job) job.textContent = "";
    (function paintSiblings() {
      var sib = ui.$("hq-sib-studios");
      var views, lines, i, row, label, titleLabel;
      if (!sib || !sim.listCompanyStudioViews) {
        if (sib) sib.textContent = "";
        return;
      }
      views = sim.listCompanyStudioViews(state, config).filter(function (v) { return !v.mine; });
      if (!views.length) {
        sib.textContent = "";
        return;
      }
      lines = [];
      for (i = 0; i < views.length; i++) {
        row = views[i];
        label = sim.worldLabel(row.studio, config);
        if (row.inDevTitle) {
          titleLabel = sim.worldLabel(row.inDevTitle, config);
          lines.push(label + " · " + (copy.inDevLabel || "在研") + "《" + titleLabel + "》");
        } else if (row.selling) {
          titleLabel = sim.worldLabel(row.selling, config);
          lines.push(label + " · " +
            ((sim.isLiveOpsTitle && sim.isLiveOpsTitle(row.selling)
              ? (copy.liveopsActiveLabel || config.copy.liveopsActiveLabel)
              : (copy.onSaleLabel || config.copy.onSaleLabel)) || "在售") +
            "《" + titleLabel + "》");
        } else {
          lines.push(label + " · " + (copy.idleHint || "待命"));
        }
      }
      sib.textContent = (copy.siblingStudios || "本公司其他工作室") + "：" + lines.join("；");
    })();
    showNum("hq-live-p", live && live.program);
    showNum("hq-live-d", live && live.design);
    showNum("hq-live-a", live && live.art);
    showNum("hq-live-m", live && live.music);
    hopMonth = ((config.careerWorld && config.careerWorld.mobility) || {}).hopMonth || 12;
    hopCard = ui.$("hq-hop-card");
    hopList = ui.$("hq-hop-list");
    if (hopCard && hopList) {
      var hopSpec = (config.careerWorld && config.careerWorld.mobility) || {};
      var showHop = (career.yearEndOffers || []).length &&
        (state.month === hopMonth || hopSpec.allowMidProject);
      var hopApply = ui.$("hq-hop-apply");
      var hopResult = ui.$("hq-hop-result");
      if (showHop) {
        hopCard.hidden = false;
        ui.$("hq-hop-head").textContent = copy.hopTitle || "全球 offer";
        ui.$("hq-hop-hint").textContent = sim.canCareerHop(state, config)
          ? (copy.hopBody || "")
          : (copy.hopLocked || "");
        if (hopResult) hopResult.textContent = career.hopNotice || "";
        hopList.textContent = "";
        (career.yearEndOffers || []).forEach(function (o) {
          var card = doc.createElement("div");
          var cco = sim.careerCompany(o.companyId, config);
          var studio = sim.careerStudio(o.companyId, o.studioId, config);
          var pct = o.successPct != null ? o.successPct : Math.round((o.successChance || 0) * 100);
          card.className = "offer-card";
          if (ui.session.pickedHopOffer === o.id) card.className += " picked";
          card.setAttribute("data-hop-pick", o.id);
          card.appendChild(doc.createTextNode(
            (o.internal ? ((copy.hopInternal || "内部调动") + " · ") : "") +
            (cco ? sim.worldLabel(cco, config) : o.companyId) +
            (studio ? (" / " + sim.worldLabel(studio, config)) : "") +
            " · " + (copy.hopChance || "通过率") + " " + pct + "%" +
            " · " + o.currentSalary + "→" + o.salary +
            (o.titleName ? (" · " + o.titleName) : "")
          ));
          hopList.appendChild(card);
        });
        if (hopApply) {
          hopApply.hidden = !ui.session.pickedHopOffer;
          hopApply.textContent = copy.hopAccept || "申请";
          hopApply.setAttribute("data-hop-apply", "1");
          hopApply.disabled = !sim.canCareerHop(state, config);
        }
      } else {
        hopCard.hidden = true;
        hopList.textContent = "";
        if (hopApply) hopApply.hidden = true;
        if (hopResult) hopResult.textContent = career.hopNotice || "";
      }
    }
    head = ui.$("hq-team-head");
    if (head) head.textContent = copy.colleagueTitle || "制作组";
    box = ui.$("hq-staff");
    if (box) {
      box.textContent = "";
      self = doc.createElement("span");
      self.className = "staff-chip";
      self.textContent = career.characterName + (role ? (" · " + sim.worldLabel(role, config)) : "");
      box.appendChild(self);
      (career.colleagues || []).forEach(function (s) {
        var chip = doc.createElement("span");
        var rr = sim.careerRole(s.roleId, config);
        chip.className = "staff-chip";
        chip.textContent = s.n + (rr ? (" · " + sim.worldLabel(rr, config)) : "");
        box.appendChild(chip);
      });
    }
    tickBtn = ui.$("btn-tick");
    if (tickBtn && !ui.$("dlg-mask").classList.contains("on")) {
      tickBtn.disabled = state.phase !== "PLAYING";
    }
    ui.paintEnds();
  };

  ui.paintEnds = function () {
    var state = st();
    var config = cfg();
    var copy, career, role, co;
    if (!state) return;
    if (sim.isCareerMode && sim.isCareerMode(state) && state.career) {
      copy = sim.careerCopy(config);
      career = state.career;
      role = sim.careerRole(career.roleId, config);
      co = sim.careerCompany(career.companyId, config);
      ui.$("end-name").textContent = career.characterName;
      ui.$("end-scale").textContent = role ? sim.worldLabel(role, config) : "—";
      ui.$("end-fans").textContent = String(career.fame || 0);
      ui.$("end-games").textContent = String((career.credits || []).length);
      ui.$("end-series").textContent = co ? sim.worldLabel(co, config) : "—";
      ui.$("end-avg").textContent = String(career.honor || 0);
      ui.$("end-sales").textContent = String(career.savings || 0);
      ui.$("end-live").textContent = copy.waitRole || "职员";
      ui.$("end-console").textContent = career.growthStage || "employee";
      return;
    }
    ui.$("end-scale").textContent = sim.scaleLabel(state.company.scale, config);
    ui.$("end-fans").textContent = String(state.company.fans);
    ui.$("end-games").textContent = String(state.released.length);
    ui.$("end-series").textContent = String(state.series.length);
    var bestA = 0, bestS = 0, bestL = 0;
    state.released.forEach(function (g) {
      if (g.avg > bestA) bestA = g.avg;
      if (g.launchSales > bestS) bestS = g.launchSales;
      if (g.liveOps && g.liveOps.peak > bestL) bestL = g.liveOps.peak;
    });
    ui.$("end-avg").textContent = bestA ? String(bestA) : "—";
    ui.$("end-sales").textContent = bestS ? String(bestS) : "—";
    ui.$("end-live").textContent = bestL ? String(bestL) : "—";
    ui.$("end-console").textContent = state.company.ownConsole ? "摸到门槛了" : "本局没有";
    ui.$("brk-date").textContent = sim.dateText(state);
    ui.$("brk-funds").textContent = String(state.company.funds);
  };

  ui.paintHq = function () {
    var state = st();
    var config = cfg();
    if (!state) return;
    if (sim.isCareerMode && sim.isCareerMode(state)) {
      ui.paintCareerHq();
      return;
    }
    sim.ensureRivals(state, config);
    ui.$("hq-name").textContent = state.company.name;
    ui.$("end-name").textContent = state.company.name;
    ui.$("hq-date").textContent = sim.dateText(state);
    ui.$("hq-funds").textContent = config.economy.currencyName + " " + state.company.funds;
    ui.$("hq-fans").textContent = "粉丝 " + state.company.fans;
    ui.$("hq-scale").textContent = sim.scaleLabel(state.company.scale, config);
    ui.$("hq-cap").textContent = "编制 " + state.staff.length + "/" + sim.maxStaff(state, config);
    ui.$("hq-plats-chip").textContent = "平台 " + sim.platformsNow(state, config).map(function (p) {
      return sim.displayName(p);
    }).join(" · ");
    ui.$("hq-ad").textContent = state.company.adOn ? "广告加持中：下一款发售会更好卖" : "本月没有广告加持";
    var tickBtn = ui.$("btn-tick");
    if (tickBtn && !ui.$("dlg-mask").classList.contains("on")) {
      tickBtn.disabled = state.phase !== "PLAYING";
    }
    var box = ui.$("hq-staff");
    box.textContent = "";
    var staffWarn = ui.$("hq-staff-warn");
    if (staffWarn) staffWarn.hidden = !!state.staff.length;
    state.staff.forEach(function (s) {
      var chip = doc.createElement("span");
      chip.className = "staff-chip";
      chip.textContent = s.n + " · Lv" + s.level +
        ((s.traits || []).length ? " · " + (s.traits || []).map(function (id) { return sim.traitName(id, config); }).join("/") : "");
      box.appendChild(chip);
    });
    var lives = state.released.filter(function (g) { return g.liveOps && g.liveOps.active; });
    ui.$("hq-dev-n").textContent = String(state.projects.length);
    var sumDev = ui.$("hq-sum-dev");
    if (sumDev) sumDev.classList.toggle("empty", !state.projects.length);
    ui.$("hq-dev-one").textContent = state.projects[0]
      ? (state.projects[0].title + " · " + sim.releaseTypeLabel(state.projects[0].releaseType, config) + " · 剩" + state.projects[0].monthsLeft + "月")
      : "还没有立项";
    ui.$("hq-live-n").textContent = String(lives.length);
    ui.$("hq-live-one").textContent = lives[0] ? lives[0].title : "暂无";
    ui.$("hq-ship-n").textContent = String(state.released.length);
    ui.$("hq-ship-one").textContent = state.released[0] ? state.released[0].title : "暂无";
    ui.$("studio-lock").style.display = state.company.scale === "large" ? "none" : "block";
    ui.$("studio-ok").style.display = state.company.scale === "large" ? "block" : "none";
    ui.$("hq-trend").textContent = sim.trendText(state.trend, config);
    var readyN = (state.readyToShip || []).length;
    var readyEl = ui.$("hq-ready");
    if (readyEl) {
      var readyCopy = (config.copy && config.copy.readyToShipLabel) || "待发售";
      readyEl.textContent = readyN
        ? (readyCopy + " " + readyN + " 部 · " + state.readyToShip[0].title + (readyN > 1 ? " 等" : "") + "，点发布才上架")
        : (readyCopy + "：无");
    }
    var chartEl = ui.$("hq-chart");
    if (chartEl) {
      var top = sim.monthlyChart(state, config)[0];
      var chartCopy = config.copy || {};
      if (top) {
        chartEl.hidden = false;
        chartEl.textContent = (chartCopy.chartTitle || "本月畅销榜") + " 1. " +
          (top.source === "player" ? (chartCopy.chartPlayerTag || "本公司") + " " : (top.pub ? top.pub + " " : "")) +
          "《" + top.title + "》 " + top.monthSales;
      } else {
        chartEl.hidden = true;
        chartEl.textContent = "";
      }
    }
    var mauEl = ui.$("hq-mau");
    if (mauEl) {
      var topMau = (state.rivalReleased || []).filter(function (g) { return g.mau > 0; })
        .sort(function (a, b) { return (b.mau || 0) - (a.mau || 0); })[0];
      if (topMau) {
        mauEl.hidden = false;
        mauEl.textContent = "《" + (topMau.title || topMau.series) + "》" +
          ((config.copy && config.copy.mauLabel) || "月活") + " " + sim.formatMau(topMau.mau);
      } else {
        mauEl.hidden = true;
        mauEl.textContent = "";
      }
    }
    ui.paintShare();
    ui.paintEnds();
    if (state.phase === "BANKRUPT") ui.show("sc-bankrupt");
    if (state.phase === "SETTLED") ui.show("sc-settled");
  };

  ui.paintStaticCopy = function () {
    var config = cfg();
    var n = config.staff.talentMarket.refreshCount;
    var capHint = config.company.scales.small.maxStaff + "/" + config.company.scales.medium.maxStaff;
    ui.$("market-head").textContent = "人才市场 · 本月 " + n + " 人";
    ui.$("market-hint").textContent = "编制 " + capHint + "。招满就不能再雇。特性入职就带，不靠培训。";
    var s2m = config.economy.relocateSmallToMedium;
    var m2l = config.economy.relocateMediumToLarge;
    ui.$("relocate-copy").textContent = "小工作室花 " + s2m + " 升中等（才能做长线）。中等再花 " + m2l + " 升大公司，才能开内部工作室、才有机会摸自研主机。";
    var state = st();
    var nextCost = !state || state.company.scale === "small" ? s2m : m2l;
    var nextLabel = !state || state.company.scale === "small" ? "中等" : "大公司";
    ui.$("btn-relocate").textContent = state && state.company.scale === "large"
      ? "已经是大公司"
      : ("花 " + nextCost + " 升到" + nextLabel);
    var ad = config.economy.advertising;
    ui.$("ad-copy").textContent = "花 " + ad.cost + "：立刻加粉丝，并加持下一款真正发售的那一部销量。发售后这次加持就没了。";
    var cal = config.calendar;
    var span = ui.$("boot-span");
    var copyC = sim.careerCopy ? sim.careerCopy(config) : {};
    var world = config.careerWorld || {};
    var tl = world.timeline || cal;
    if (span) span.textContent = copyC.bootPill || (tl.startYear + " — " + tl.endYear);
    var bootLead = ui.$("boot-lead");
    if (bootLead && copyC.bootLead) bootLead.textContent = copyC.bootLead;
    var nameLab = ui.$("boot-name-label");
    if (nameLab && copyC.nameLabel) nameLab.textContent = copyC.nameLabel;
    var startBtn = ui.$("btn-start");
    if (startBtn && copyC.startButton) startBtn.textContent = copyC.startButton;
    var intelBtn = ui.$("btn-sheet-intel");
    if (intelBtn && copyC.intel) intelBtn.textContent = copyC.intel;
    var tickBtnCopy = ui.$("btn-tick");
    if (tickBtnCopy && copyC.nextMonth) tickBtnCopy.textContent = copyC.nextMonth;
    var tgaBtn = ui.$("dock-tga");
    if (tgaBtn && copyC.tgaEntry) tgaBtn.textContent = copyC.tgaEntry;
    var calDock = ui.$("dock-cal");
    if (calDock && copyC.calendarEntry) calDock.textContent = copyC.calendarEntry;
    var dimP = ui.$("hq-dim-p");
    var dimD = ui.$("hq-dim-d");
    var dimA = ui.$("hq-dim-a");
    var dimM = ui.$("hq-dim-m");
    if (dimP && copyC.dimProgram) dimP.textContent = copyC.dimProgram;
    if (dimD && copyC.dimDesign) dimD.textContent = copyC.dimDesign;
    if (dimA && copyC.dimArt) dimA.textContent = copyC.dimArt;
    if (dimM && copyC.dimMusic) dimM.textContent = copyC.dimMusic;
    var selfP = ui.$("hq-self-dim-p");
    var selfD = ui.$("hq-self-dim-d");
    var selfA = ui.$("hq-self-dim-a");
    var selfM = ui.$("hq-self-dim-m");
    if (selfP && copyC.dimProgram) selfP.textContent = copyC.dimProgram;
    if (selfD && copyC.dimDesign) selfD.textContent = copyC.dimDesign;
    if (selfA && copyC.dimArt) selfA.textContent = copyC.dimArt;
    if (selfM && copyC.dimMusic) selfM.textContent = copyC.dimMusic;
    var shareHint = ui.$("share-hint");
    if (shareHint) shareHint.textContent = (config.copy && config.copy.shareHint) || shareHint.textContent;
    var chartHead = ui.$("chart-head");
    if (chartHead && config.copy && config.copy.chartTitle) chartHead.textContent = config.copy.chartTitle;
    var chartHint = ui.$("chart-hint");
    if (chartHint && config.copy && config.copy.chartHint) chartHint.textContent = config.copy.chartHint;
    var bl = ui.$("media-baseline-label");
    if (bl && config.copy && config.copy.baselineSalesLabel) bl.textContent = config.copy.baselineSalesLabel;
    var sl = ui.$("media-sales-label");
    if (sl && config.copy && config.copy.monthActualSalesLabel) sl.textContent = config.copy.monthActualSalesLabel;
    var sh = ui.$("media-sales-hint");
    if (sh && config.copy && config.copy.mediaSalesHint) sh.textContent = config.copy.mediaSalesHint;
    var calBtn = doc.querySelector('[data-go="calendar"]');
    if (calBtn) calBtn.textContent = copyC.calendarEntry || (config.copy && config.copy.calendarEntry) || "日历";
    var calHint = ui.$("calendar-hint");
    if (calHint && config.copy && config.copy.calendarHint) calHint.textContent = config.copy.calendarHint;
    var nameInput = ui.$("name-input");
    if (nameInput) {
      var defName = copyC.defaultName || config.company.defaultName;
      nameInput.setAttribute("placeholder", defName);
      if (!nameInput.value) nameInput.value = defName;
    }
  };

  ui.paintReleased = function () {
    var state = st();
    var config = cfg();
    if (!state) return;
    var per = 4;
    var box = ui.$("released-list");
    box.textContent = "";
    if (!state.released.length) {
      var empty = doc.createElement("p");
      empty.className = "hint";
      empty.textContent = "还没有发售作品。";
      box.appendChild(empty);
    } else {
      var pages = Math.ceil(state.released.length / per);
      if (ui.session.uiPage.released >= pages) ui.session.uiPage.released = pages - 1;
      state.released.slice(ui.session.uiPage.released * per, ui.session.uiPage.released * per + per).forEach(function (g) {
        var it = doc.createElement("div");
        it.className = "item";
        var left = doc.createElement("span");
        var saleTag = "";
        if (g.releaseType === "boxed") {
          saleTag = g.onSale === false
            ? (" · " + ((config.copy && config.copy.offSaleLabel) || "已停售"))
            : (" · " + ((config.copy && config.copy.onSaleLabel) || "在售"));
        }
        var shownTitle = g.title;
        if (g.releaseType === "liveops" && sim.liveOpsUsesVersions && sim.liveOpsUsesVersions(g, config) && sim.liveOpsVersionLabel) {
          shownTitle = sim.liveOpsVersionLabel(g.title, sim.liveOpsCurrentVersion(g, config), config);
        }
        left.textContent = shownTitle + " · " + sim.releaseTypeLabel(g.releaseType, config) +
          (g.releaseType === "outsource"
            ? (" · 外包费 " + (g.outsourceFee || 0))
            : (g.releaseType === "boxed"
              ? (" · 均分 " + g.avg +
                " · " + ((config.copy && config.copy.baselineSalesLabel) || "基准") + " " + (g.baselineSales != null ? g.baselineSales : (g.launchSales || 0)) +
                " · " + ((config.copy && config.copy.monthActualSalesLabel) || "本月实销") + " " + (g.monthSales || 0) +
                saleTag)
              : (g.releaseType === "liveops"
                ? (" · 均分 " + g.avg +
                  " · " + ((config.copy && config.copy.liveopsPeakLabel) || "最高月收") + " " + ((g.liveOps && g.liveOps.peak) || 0) +
                  " · " + ((config.copy && config.copy.liveopsMonthsLabel) || "已运营") + " " + ((g.liveOps && g.liveOps.monthsLive) || 0) +
                  " · " + (g.liveOps && g.liveOps.active
                    ? ((config.copy && config.copy.liveopsActiveLabel) || "运营中")
                    : ((config.copy && config.copy.liveopsClosedLabel) || "已关服")))
                : (" · 均分 " + g.avg + " · 首发 " + (g.launchSales || g.sales || 0) + saleTag))));
        it.appendChild(left);
        box.appendChild(it);
      });
      ui.addPager(box, ui.session.uiPage.released, pages, function (p) {
        ui.session.uiPage.released = p; ui.paintReleased();
      });
    }
    var sb = ui.$("series-list");
    sb.textContent = "";
    if (!state.series.length) {
      var sh = doc.createElement("p");
      sh.className = "hint";
      sh.textContent = "还没有系列。均分够高会自动开。";
      sb.appendChild(sh);
      ui.paintReadyLists();
      return;
    }
    var sp = Math.ceil(state.series.length / per);
    if (ui.session.uiPage.series >= sp) ui.session.uiPage.series = sp - 1;
    state.series.slice(ui.session.uiPage.series * per, ui.session.uiPage.series * per + per).forEach(function (s) {
      var it = doc.createElement("div");
      it.className = "item";
      var left = doc.createElement("span");
      left.textContent = s.name + " · 作品 " + (s.gameIds ? s.gameIds.length : 0);
      it.appendChild(left);
      sb.appendChild(it);
    });
    ui.addPager(sb, ui.session.uiPage.series, sp, function (p) {
      ui.session.uiPage.series = p; ui.paintReleased();
    });
    ui.paintReadyLists();
  };

  ui.paintProject = function () {
    var state = st();
    var config = cfg();
    var list = (state && state.projects) || [];
    if (ui.session.uiPage.project >= list.length) ui.session.uiPage.project = Math.max(0, list.length - 1);
    var p = list[ui.session.uiPage.project];
    var host = ui.$("pj-card");
    var oldPager = host && host.querySelector(".pager");
    if (oldPager) oldPager.parentNode.removeChild(oldPager);
    ui.$("pj-title").textContent = p ? p.title : "没有在研";
    if (!p) {
      ui.$("pj-meta").textContent = "招人后去立项。所有工作室的在研会跟着同一次点月走。";
      ui.$("pj-bar").style.width = "0";
      ui.$("pj-p").textContent = ui.$("pj-s").textContent = ui.$("pj-a").textContent = ui.$("pj-m").textContent = "—";
      ui.$("pj-team").textContent = "";
      return;
    }
    ui.$("pj-meta").textContent = sim.contentName(config.content.genres, p.genreId) + " · " +
      sim.contentName(config.content.gameplay, p.gameplayId) + " · " +
      sim.contentName(config.content.platforms, p.platformId) + " · " +
      sim.releaseTypeLabel(p.releaseType, config) + " · 还剩 " + p.monthsLeft + " 月";
    ui.$("pj-bar").style.width = Math.round((1 - p.monthsLeft / p.totalMonths) * 100) + "%";
    ui.$("pj-p").textContent = String(p.stats.program);
    ui.$("pj-s").textContent = String(p.stats.script);
    ui.$("pj-a").textContent = String(p.stats.art);
    ui.$("pj-m").textContent = String(p.stats.music);
    var names = p.memberIds.map(function (id) { var s = sim.findStaff(state, id); return s ? s.n : ""; }).filter(Boolean);
    ui.$("pj-team").textContent = "制作人 " + ((sim.findStaff(state, p.producerId) || {}).n || "") + " · 成员 " + names.join("、");
    if (host) {
      ui.addPager(host, ui.session.uiPage.project, list.length, function (page) {
        ui.session.uiPage.project = page; ui.paintProject();
      });
    }
    ui.paintReadyLists();
  };

  ui.paintReadyLists = function () {
    var state = st();
    var config = cfg();
    var copy = (config && config.copy) || {};
    var hint = copy.readyToShipHint || "制作完成，尚未发布。";
    var btnText = copy.releaseButton || "发布";
    var emptyText = "没有待发售的游戏。";
    ["ready-hint", "released-ready-hint"].forEach(function (id) {
      var el = ui.$(id);
      if (el) el.textContent = hint;
    });
    function fill(boxId) {
      var box = ui.$(boxId);
      if (!box) return;
      box.textContent = "";
      var list = (state && state.readyToShip) || [];
      if (!list.length) {
        var empty = doc.createElement("p");
        empty.className = "hint";
        empty.textContent = emptyText;
        box.appendChild(empty);
        return;
      }
      list.forEach(function (p) {
        var it = doc.createElement("div");
        it.className = "item";
        var left = doc.createElement("span");
        left.textContent = p.title + " · " + sim.releaseTypeLabel(p.releaseType, config) +
          " · " + sim.contentName(config.content.platforms, p.platformId);
        var btn = doc.createElement("button");
        btn.type = "button";
        btn.className = "btn tiny";
        btn.setAttribute("data-release", p.id);
        btn.textContent = btnText;
        it.appendChild(left);
        it.appendChild(btn);
        box.appendChild(it);
      });
    }
    fill("pj-ready-list");
    fill("released-ready-list");
  };

  ui.paintMedia = function (rec) {
    rec = rec || (st() && st().lastMedia);
    ui.$("media-title").textContent = rec ? ("媒体评分 · " + rec.title) : "还没有发售记录";
    var box = ui.$("media-rows");
    box.textContent = "";
    if (!rec || !rec.media) {
      ui.$("media-quote").textContent = "";
      ui.$("media-avg").textContent = "—";
      var mb0 = ui.$("media-baseline");
      if (mb0) mb0.textContent = "—";
      ui.$("media-sales").textContent = "—";
      return;
    }
    rec.media.rows.forEach(function (r) {
      var row = doc.createElement("div");
      var l = doc.createElement("span");
      var b = doc.createElement("b");
      var q;
      row.className = "media-outlet";
      l.textContent = r.n;
      b.className = "stars";
      b.textContent = String(r.score);
      row.appendChild(l);
      row.appendChild(b);
      if (r.quote) {
        q = doc.createElement("p");
        q.className = "quote";
        q.textContent = r.quote;
        row.appendChild(q);
      }
      box.appendChild(row);
    });
    ui.$("media-quote").textContent = "";
    ui.$("media-avg").textContent = String(rec.avg);
    var mb = ui.$("media-baseline");
    if (mb) mb.textContent = rec.baselineSales != null ? String(rec.baselineSales) : "—";
    ui.$("media-sales").textContent = String(rec.monthSales != null ? rec.monthSales : rec.launchSales);
  };

  ui.paintTga = function () {
    var box = ui.$("tga-rows");
    var copy = (cfg() && cfg().copy) || {};
    box.textContent = "";
    var list = (st() && st().lastAwards) || [];
    if (!list.length) {
      var p = doc.createElement("p");
      p.className = "hint";
      p.textContent = copy.awardsHint || "每年 11 月过月时评选。窗口是去年 12 月到今年 11 月发售的游戏，对手大厂同期作品也参赛。";
      box.appendChild(p);
      return;
    }
    list.forEach(function (a) {
      var wrap = doc.createElement("div");
      var row = doc.createElement("div");
      var l = doc.createElement("span");
      var b = doc.createElement("b");
      wrap.className = "media-outlet";
      row.className = "row item";
      l.textContent = a.n;
      b.textContent = a.w;
      row.appendChild(l);
      row.appendChild(b);
      wrap.appendChild(row);
      (a.nominees || []).forEach(function (n) {
        var nom = doc.createElement("p");
        nom.className = "hint";
        nom.textContent = (n.label || "") + (n.player ? " · 你" : "");
        wrap.appendChild(nom);
      });
      box.appendChild(wrap);
    });
  };

  ui.mediaNodes = function (rec) {
    var nodes = [];
    var media = rec.media || rec;
    (media.rows || []).forEach(function (r) {
      var row = doc.createElement("div");
      var head = doc.createElement("div");
      var l = doc.createElement("span");
      var b = doc.createElement("b");
      var q;
      row.className = "media-outlet";
      head.className = "row item";
      l.textContent = r.n;
      b.className = "stars";
      b.textContent = String(r.score);
      head.appendChild(l);
      head.appendChild(b);
      row.appendChild(head);
      if (r.quote) {
        q = doc.createElement("p");
        q.className = "quote";
        q.textContent = r.quote;
        row.appendChild(q);
      }
      nodes.push(row);
    });
    var copy = (cfg() && cfg().copy) || {};
    if (rec.baselineSales != null) {
      var br = doc.createElement("div");
      br.className = "row item";
      var bl = doc.createElement("span"); bl.textContent = copy.baselineSalesLabel || "基准（首月参照）";
      var bb = doc.createElement("b"); bb.textContent = String(rec.baselineSales);
      br.appendChild(bl); br.appendChild(bb); nodes.push(br);
    }
    if (rec.monthSales != null || rec.launchSales != null) {
      var sr = doc.createElement("div");
      sr.className = "row item";
      var sl = doc.createElement("span"); sl.textContent = copy.monthActualSalesLabel || "本月实销";
      var sb = doc.createElement("b"); sb.textContent = String(rec.monthSales != null ? rec.monthSales : rec.launchSales);
      sr.appendChild(sl); sr.appendChild(sb); nodes.push(sr);
    }
    return nodes;
  };

  ui.awardNodes = function (list) {
    return list.map(function (a) {
      var wrap = doc.createElement("div");
      var row = doc.createElement("div");
      var l = doc.createElement("span");
      var b = doc.createElement("b");
      wrap.className = "media-outlet";
      row.className = "row item";
      l.textContent = a.n;
      b.textContent = a.w;
      row.appendChild(l);
      row.appendChild(b);
      wrap.appendChild(row);
      (a.nominees || []).forEach(function (n) {
        var nom = doc.createElement("p");
        nom.className = "hint";
        nom.textContent = (n.label || "") + (n.player ? " · 你" : "");
        wrap.appendChild(nom);
      });
      return wrap;
    });
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
