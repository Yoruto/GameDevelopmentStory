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
    var head = ui.$("calendar-head");
    var hint = ui.$("calendar-hint");
    var cal = sim.getRivalCalendar(state, state.year);
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
      var plans = cal.months[m] || [];
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
        : (row.pub || "");
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

  ui.paintEnds = function () {
    var state = st();
    var config = cfg();
    if (!state) return;
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
      chip.textContent = s.n + " · Lv" + s.level;
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
    if (span) span.textContent = cal.startYear + " — " + cal.endYear + " · 点月经营";
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
    if (calBtn) calBtn.textContent = (config.copy && config.copy.calendarEntry) || "日历";
    var calHint = ui.$("calendar-hint");
    if (calHint && config.copy && config.copy.calendarHint) calHint.textContent = config.copy.calendarHint;
    var nameInput = ui.$("name-input");
    if (nameInput) {
      nameInput.setAttribute("placeholder", config.company.defaultName);
      if (!nameInput.value) nameInput.value = config.company.defaultName;
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
        left.textContent = g.title + " · " + sim.releaseTypeLabel(g.releaseType, config) +
          (g.releaseType === "outsource"
            ? (" · 外包费 " + (g.outsourceFee || 0))
            : (g.releaseType === "boxed"
              ? (" · 均分 " + g.avg +
                " · " + ((config.copy && config.copy.baselineSalesLabel) || "基准") + " " + (g.baselineSales != null ? g.baselineSales : (g.launchSales || 0)) +
                " · " + ((config.copy && config.copy.monthActualSalesLabel) || "本月实销") + " " + (g.monthSales || 0) +
                saleTag)
              : (" · 均分 " + g.avg + " · 首发 " + (g.launchSales || g.sales || 0) + saleTag)));
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
      row.className = "row item";
      var l = doc.createElement("span"); l.textContent = r.n;
      var b = doc.createElement("b"); b.className = "stars"; b.textContent = String(r.score);
      row.appendChild(l); row.appendChild(b); box.appendChild(row);
    });
    ui.$("media-quote").textContent = rec.media.quote || "";
    ui.$("media-avg").textContent = String(rec.avg);
    var mb = ui.$("media-baseline");
    if (mb) mb.textContent = rec.baselineSales != null ? String(rec.baselineSales) : "—";
    ui.$("media-sales").textContent = String(rec.monthSales != null ? rec.monthSales : rec.launchSales);
  };

  ui.paintTga = function () {
    var box = ui.$("tga-rows");
    box.textContent = "";
    var list = (st() && st().lastAwards) || [];
    if (!list.length) {
      var p = doc.createElement("p");
      p.className = "hint";
      p.textContent = "每年 11 月过月时评选。窗口是去年 12 月到今年 11 月发售的游戏，对手大厂同期作品也参赛。";
      box.appendChild(p);
      return;
    }
    list.forEach(function (a) {
      var row = doc.createElement("div");
      row.className = "row item";
      var l = doc.createElement("span"); l.textContent = a.n;
      var b = doc.createElement("b"); b.textContent = a.w;
      row.appendChild(l); row.appendChild(b); box.appendChild(row);
    });
  };

  ui.mediaNodes = function (rec) {
    var nodes = [];
    rec.media.rows.forEach(function (r) {
      var row = doc.createElement("div");
      row.className = "row item";
      var l = doc.createElement("span"); l.textContent = r.n;
      var b = doc.createElement("b"); b.className = "stars"; b.textContent = String(r.score);
      row.appendChild(l); row.appendChild(b); nodes.push(row);
    });
    var q = doc.createElement("p"); q.className = "quote"; q.textContent = rec.media.quote;
    nodes.push(q);
    var copy = (cfg() && cfg().copy) || {};
    if (rec.baselineSales != null) {
      var br = doc.createElement("div");
      br.className = "row item";
      var bl = doc.createElement("span"); bl.textContent = copy.baselineSalesLabel || "基准（首月参照）";
      var bb = doc.createElement("b"); bb.textContent = String(rec.baselineSales);
      br.appendChild(bl); br.appendChild(bb); nodes.push(br);
    }
    var sr = doc.createElement("div");
    sr.className = "row item";
    var sl = doc.createElement("span"); sl.textContent = copy.monthActualSalesLabel || "本月实销";
    var sb = doc.createElement("b"); sb.textContent = String(rec.monthSales != null ? rec.monthSales : rec.launchSales);
    sr.appendChild(sl); sr.appendChild(sb); nodes.push(sr);
    return nodes;
  };

  ui.awardNodes = function (list) {
    return list.map(function (a) {
      var row = doc.createElement("div");
      row.className = "row item";
      var l = doc.createElement("span"); l.textContent = a.n;
      var b = doc.createElement("b"); b.textContent = a.w;
      row.appendChild(l); row.appendChild(b);
      return row;
    });
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
