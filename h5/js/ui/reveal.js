(function (root) {
  var GDS = root.GDS;
  var ui = GDS.ui;
  var sim = GDS.sim;
  var doc = root.document;
  var timers = [];
  var running = null;
  var skipBound = false;

  function fxCfg() {
    return (GDS.CONFIG && GDS.CONFIG.fx) || {};
  }

  function ms(key, fallback) {
    var n = Number(fxCfg()[key]);
    return n > 0 ? n : fallback;
  }

  function copy() {
    return (GDS.CONFIG && GDS.CONFIG.copy) || {};
  }

  function reduced() {
    return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function extra() {
    return ui.$("dlg-extra");
  }

  function clearTimers() {
    timers.forEach(function (id) {
      root.clearTimeout(id);
      root.clearInterval(id);
    });
    timers = [];
  }

  function later(fn, delay) {
    var id = root.setTimeout(function () {
      timers = timers.filter(function (x) { return x !== id; });
      fn();
    }, delay);
    timers.push(id);
    return id;
  }

  function every(fn, delay) {
    var id = root.setInterval(fn, delay);
    timers.push(id);
    return id;
  }

  function scrollExtra() {
    var box = extra();
    if (box) box.scrollTop = box.scrollHeight;
  }

  function setBusy(on) {
    var mask = ui.$("dlg-mask");
    if (mask) mask.classList.toggle("fx-busy", !!on);
  }

  function bindSkip() {
    var mask;
    if (skipBound) return;
    skipBound = true;
    mask = ui.$("dlg-mask");
    if (!mask) return;
    mask.addEventListener("click", function (ev) {
      var t = ev.target;
      if (!running) return;
      if (t && t.nodeType !== 1) t = t.parentElement;
      if (t && t.closest && (t.closest("#dlg-ok") || t.closest("#dlg-cancel") || t.closest(".dlg-choices"))) return;
      ui.skipReveal();
    });
  }

  ui.unlockDlgOk = function (okText) {
    if (okText) ui.$("dlg-ok").textContent = okText;
    ui.$("dlg-ok").classList.remove("off");
    ui.$("dlg-actions").classList.remove("off");
  };

  ui.stopReveal = function () {
    clearTimers();
    running = null;
    setBusy(false);
  };

  ui.skipReveal = function () {
    if (running && running.skip) running.skip();
  };

  // 大奖 = 配置里标了 ceremonyLast 的奖项（年度游戏），滚幕 2 秒；其余小奖项 1 秒。
  function isGrandAward(a) {
    return !!(a && (a.ceremonyLast || a.id === "goty"));
  }

  ui.ceremonyAwards = function (list) {
    var rest = [];
    var last = [];
    (list || []).forEach(function (a) {
      if (isGrandAward(a)) last.push(a);
      else rest.push(a);
    });
    return rest.concat(last);
  };

  function nomineeLabel(n) {
    if (!n) return "";
    return (n.label || "") + (n.player ? " · 你" : "");
  }

  function uniqueNomineeLabels(awards) {
    var seen = {};
    var out = [];
    (awards || []).forEach(function (a) {
      (a.nominees || []).forEach(function (n) {
        var lab = nomineeLabel(n);
        if (!lab || seen[lab]) return;
        seen[lab] = true;
        out.push(lab);
      });
    });
    return out;
  }

  function finishReveal(onDone) {
    ui.stopReveal();
    if (onDone) onDone();
  }

  ui.awardPlayerWon = function (a) {
    var i, n;
    if (!a) return false;
    if (a.playerWon) return true;
    for (i = 0; i < (a.nominees || []).length; i++) {
      n = a.nominees[i];
      if (n && n.player && (i === 0 || n.label === a.w)) return true;
    }
    return false;
  };

  ui.startMediaReveal = function (rec, opts) {
    var rows, i, inst, instant, salesAmt;
    opts = opts || {};
    ui.stopReveal();
    bindSkip();
    rec = rec || {};
    rows = (rec.media && rec.media.rows) || rec.rows || [];
    extra().textContent = "";
    if (opts.hint) ui.$("dlg-body").textContent = opts.hint;
    ui.$("dlg").classList.add("dlg-fx");
    salesAmt = rec.launchSales != null && rec.launchSales !== "" ? Number(rec.launchSales) : null;
    if (salesAmt != null && isNaN(salesAmt)) salesAmt = null;
    instant = reduced() || (!rows.length && salesAmt == null);
    inst = { kind: "media", skip: null };
    running = inst;
    setBusy(!instant);

    function summary() {
      // 「均分」必须是玩家能拿上面那几行手算出来的数：优先读四家媒体分的平均
      // （media.avg 就是 rows 的算术平均），没有媒体行的记录才回退 rec.avg。
      // 结算时 rec.avg 已对齐成 media.avg（sim/career.js 的 shipPlayerTitle），
      // 两边不会打架——见 tests 里的 mediaAvgIsMeanOfOutlets。
      var avg = (rec.media && rec.media.avg != null) ? rec.media.avg : rec.avg;
      if (avg != null) ui.$("dlg-body").textContent = "均分 " + avg;
      finishReveal(opts.onDone);
    }

    function appendOutlet(r, scored) {
      var row = doc.createElement("div");
      var name = doc.createElement("p");
      var q, score;
      row.className = "media-outlet fx-outlet";
      name.className = "fx-outlet-name";
      name.textContent = r.n || "";
      row.appendChild(name);
      q = doc.createElement("p");
      q.className = "quote fx-quote";
      if (r.quote) q.appendChild(doc.createTextNode(r.quote + " "));
      score = doc.createElement("b");
      score.className = "stars fx-score" + (scored ? " on" : "");
      score.textContent = String(r.score);
      q.appendChild(score);
      row.appendChild(q);
      extra().appendChild(row);
      scrollExtra();
      return score;
    }

    function appendSales(scored) {
      var c, row, name, q, score;
      if (salesAmt == null) return null;
      c = copy();
      row = doc.createElement("div");
      name = doc.createElement("p");
      row.className = "media-outlet fx-outlet fx-sales";
      name.className = "fx-outlet-name";
      name.textContent = c.launchSalesReveal || c.launchActualSalesLabel || "首月销量";
      row.appendChild(name);
      q = doc.createElement("p");
      q.className = "quote fx-quote";
      score = doc.createElement("b");
      score.className = "stars fx-score" + (scored ? " on" : "");
      score.textContent = sim.formatUnits(salesAmt);
      q.appendChild(score);
      row.appendChild(q);
      extra().appendChild(row);
      scrollExtra();
      return score;
    }

    function playSales() {
      var score, phase;
      if (!running || running !== inst) return;
      if (salesAmt == null) {
        summary();
        return;
      }
      // 只揭晓月销量（rec.launchSales = 发售当月实销）。首周行于 2026-09-18 删除。
      score = appendSales(false);
      phase = "quote";
      inst.skip = function () {
        if (!running || running !== inst) return;
        if (phase === "quote") {
          phase = "score";
          clearTimers();
          if (score) score.classList.add("on");
          later(function () {
            summary();
          }, ms("mediaGapMs", 420));
          return;
        }
        clearTimers();
        summary();
      };
      later(function () {
        if (!running || running !== inst || phase !== "quote") return;
        phase = "score";
        if (score) score.classList.add("on");
        later(function () {
          if (!running || running !== inst) return;
          summary();
        }, ms("mediaStampMs", 520) + ms("mediaGapMs", 420));
      }, ms("mediaQuoteMs", 700));
    }

    if (instant) {
      rows.forEach(function (r) { appendOutlet(r, true); });
      appendSales(true);
      summary();
      return;
    }

    i = 0;
    function playOutlet() {
      var score, phase;
      if (!running || running !== inst) return;
      if (i >= rows.length) {
        playSales();
        return;
      }
      score = appendOutlet(rows[i], false);
      phase = "quote";
      inst.skip = function () {
        if (!running || running !== inst) return;
        if (phase === "quote") {
          phase = "score";
          clearTimers();
          score.classList.add("on");
          later(function () {
            i += 1;
            playOutlet();
          }, ms("mediaGapMs", 420));
          return;
        }
        clearTimers();
        i += 1;
        playOutlet();
      };
      later(function () {
        if (!running || running !== inst || phase !== "quote") return;
        phase = "score";
        score.classList.add("on");
        later(function () {
          if (!running || running !== inst) return;
          i += 1;
          playOutlet();
        }, ms("mediaStampMs", 520) + ms("mediaGapMs", 420));
      }, ms("mediaQuoteMs", 700));
    }
    playOutlet();
  };

  ui.startAwardReveal = function (list, opts) {
    var awards, i, inst, instant, poolAll;
    opts = opts || {};
    ui.stopReveal();
    bindSkip();
    awards = ui.ceremonyAwards(list || []);
    extra().textContent = "";
    if (opts.hint) ui.$("dlg-body").textContent = opts.hint;
    ui.$("dlg").classList.add("dlg-fx", "dlg-awards");
    poolAll = uniqueNomineeLabels(awards);
    instant = reduced() || !awards.length;
    inst = { kind: "awards", skip: null };
    running = inst;
    setBusy(!instant);

    function markMine(el, a) {
      if (el && ui.awardPlayerWon(a)) el.classList.add("award-mine");
    }

    function appendStatic(a) {
      var wrap = doc.createElement("div");
      var name = doc.createElement("p");
      var win = doc.createElement("p");
      wrap.className = "fx-award" + (isGrandAward(a) ? " goty" : "");
      name.className = "fx-award-name";
      name.textContent = a.n || "";
      win.className = "fx-award-win";
      win.textContent = a.w || "—";
      markMine(win, a);
      wrap.appendChild(name);
      wrap.appendChild(win);
      extra().appendChild(wrap);
    }

    function done() {
      finishReveal(opts.onDone);
    }

    if (instant) {
      awards.forEach(appendStatic);
      done();
      return;
    }

    i = 0;
    function playAward() {
      var a, wrap, nameEl, reel, labels, tick, idx, phase, reelMs;
      if (!running || running !== inst) return;
      if (i >= awards.length) {
        done();
        return;
      }
      a = awards[i];
      wrap = doc.createElement("div");
      wrap.className = "fx-award" + (isGrandAward(a) ? " goty" : "");
      nameEl = doc.createElement("p");
      nameEl.className = "fx-award-name";
      nameEl.textContent = a.n || "";
      reel = doc.createElement("div");
      reel.className = "fx-reel";
      wrap.appendChild(nameEl);
      wrap.appendChild(reel);
      extra().appendChild(wrap);
      scrollExtra();

      labels = (a.nominees || []).map(nomineeLabel).filter(Boolean);
      if (i === 0 && poolAll.length > labels.length) labels = poolAll.slice();
      if (a.w && labels.indexOf(a.w) < 0) labels.push(a.w);
      if (labels.length < 2) {
        reel.textContent = a.w || "—";
        reel.classList.add("done");
        markMine(reel, a);
        phase = "hold";
        inst.skip = function () {
          if (!running || running !== inst) return;
          clearTimers();
          i += 1;
          playAward();
        };
        later(function () {
          if (!running || running !== inst) return;
          i += 1;
          playAward();
        }, ms("awardHoldMs", 800));
        return;
      }

      idx = 0;
      reel.textContent = labels[0];
      phase = "reel";
      tick = every(function () {
        idx = (idx + 1) % labels.length;
        reel.textContent = labels[idx];
      }, ms("awardReelTickMs", 70));

      function reveal() {
        if (phase !== "reel") return;
        phase = "hold";
        root.clearInterval(tick);
        timers = timers.filter(function (x) { return x !== tick; });
        reel.textContent = a.w || "—";
        reel.classList.add("done");
        markMine(reel, a);
        inst.skip = function () {
          if (!running || running !== inst) return;
          clearTimers();
          i += 1;
          playAward();
        };
        later(function () {
          if (!running || running !== inst) return;
          i += 1;
          playAward();
        }, ms("awardStampMs", 600) + ms("awardHoldMs", 800));
      }

      inst.skip = reveal;
      // 滚幕时长只按奖项大小分档（小 1 秒 / 大奖 2 秒），与这是第几个奖项无关。
      reelMs = isGrandAward(a)
        ? ms("awardReelMs", 2000)
        : ms("awardSmallReelMs", 1000);
      later(reveal, reelMs);
    }
    playAward();
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
