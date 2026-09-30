(function (root) {
  var GDS = root.GDS = root.GDS || {};
  var ui = GDS.ui = GDS.ui || {};
  var doc = root.document;

  ui.$ = function (id) {
    return doc.getElementById(id);
  };

  ui.focusWithoutScroll = function (el) {
    if (!el || !el.focus) return;
    try { el.focus({ preventScroll: true }); }
    catch (error) { el.focus(); }
  };

  ui.toast = function (msg) {
    var el = ui.$("toast");
    el.textContent = msg;
    el.style.display = "block";
    root.setTimeout(function () { el.style.display = "none"; }, 2200);
  };

  ui.session = {
    state: null,
    pendingName: "",
    startRoll: null,
    rollsLeft: null,
    uiPage: {},
    tickPages: [],
    tickStep: 0,
    tgaYear: null,
    dlgHook: { mode: null, onOk: null, onCancel: null }
  };

  ui.config = function () {
    return GDS.CONFIG;
  };

  ui.addPager = function (host, page, pages, onChange) {
    if (pages <= 1) return;
    var row = doc.createElement("div");
    row.className = "pager";
    var prev = doc.createElement("button");
    prev.type = "button";
    prev.textContent = "上页";
    prev.disabled = page <= 0;
    prev.addEventListener("click", function () { onChange(page - 1); });
    var lab = doc.createElement("span");
    lab.textContent = (page + 1) + "/" + pages;
    var next = doc.createElement("button");
    next.type = "button";
    next.textContent = "下页";
    next.disabled = page >= pages - 1;
    next.addEventListener("click", function () { onChange(page + 1); });
    row.appendChild(prev); row.appendChild(lab); row.appendChild(next);
    host.appendChild(row);
  };

  ui.fillDlgExtra = function (nodes) {
    var extra = ui.$("dlg-extra");
    extra.textContent = "";
    (nodes || []).forEach(function (n) { extra.appendChild(n); });
  };

  // Measure without height caps, then apply one of three viewport-aware caps.
  ui.fitDialogToContent = function (opts) {
    opts = opts || {};
    var dlg = ui.$("dlg");
    // Ordinary dialogs can use their natural height with the long viewport cap.
    // Only reveals need a measured height before their rows are cleared.
    if (!opts.lockHeight) {
      dlg.classList.remove("dlg-size-short", "dlg-size-medium", "dlg-size-long");
      dlg.classList.add("dlg-size-long");
      dlg.style.height = "";
      return "long";
    }
    var body = ui.$("dlg-body");
    var extra = ui.$("dlg-extra");
    var actions = ui.$("dlg-actions");
    var ok = ui.$("dlg-ok");
    var actionsHidden = actions.classList.contains("off");
    var okHidden = ok.classList.contains("off");
    var old = {
      height: dlg.style.height,
      maxHeight: dlg.style.maxHeight,
      overflow: dlg.style.overflow,
      bodyMaxHeight: body.style.maxHeight,
      bodyOverflow: body.style.overflow,
      extraFlex: extra.style.flex,
      extraOverflow: extra.style.overflow
    };
    var viewportHeight = root.innerHeight || doc.documentElement.clientHeight || 720;
    if (opts.reserveActions) {
      actions.classList.remove("off");
      ok.classList.remove("off");
    }
    dlg.classList.remove("dlg-size-short", "dlg-size-medium", "dlg-size-long");
    dlg.style.height = "auto";
    dlg.style.maxHeight = "none";
    dlg.style.overflow = "visible";
    body.style.maxHeight = "none";
    body.style.overflow = "visible";
    extra.style.flex = "none";
    extra.style.overflow = "visible";
    var naturalHeight = dlg.offsetHeight;
    var size = naturalHeight <= Math.min(320, viewportHeight * 0.46) ? "short"
      : naturalHeight <= Math.min(480, viewportHeight * 0.7) ? "medium" : "long";
    dlg.style.height = old.height;
    dlg.style.maxHeight = old.maxHeight;
    dlg.style.overflow = old.overflow;
    body.style.maxHeight = old.bodyMaxHeight;
    body.style.overflow = old.bodyOverflow;
    extra.style.flex = old.extraFlex;
    extra.style.overflow = old.extraOverflow;
    if (opts.reserveActions) {
      actions.classList.toggle("off", actionsHidden);
      ok.classList.toggle("off", okHidden);
    }
    dlg.classList.add("dlg-size-" + size);
    dlg.style.height = opts.lockHeight ? naturalHeight + "px" : "";
    return size;
  };

  ui.openDlg = function (opts) {
    opts = opts || {};
    var hook = ui.session.dlgHook;
    hook.mode = opts.mode || "once";
    hook.onOk = opts.onOk || null;
    hook.onCancel = opts.onCancel || null;
    hook.returnFocus = doc.activeElement;
    var dlg = ui.$("dlg");
    dlg.className = "dlg dlg-" + (opts.kind || "info") +
      ((hook.mode === "tick" || hook.mode === "tick-choice") ? " dlg-queue" : "");
    dlg.style.height = "";
    ui.$("dlg-kicker").textContent = opts.kicker || (opts.kind === "event" ? "本月事件" : (opts.kind === "confirm" ? "请确认" : "提示"));
    ui.$("dlg-title").textContent = opts.title || "";
    ui.$("dlg-body").textContent = opts.body || "";
    ui.fillDlgExtra(opts.nodes || []);
    ui.$("dlg-ok").textContent = opts.okText || "确定";
    ui.$("dlg-cancel").textContent = opts.cancelText || "取消";
    ui.$("dlg-cancel").classList.toggle("off", !opts.cancel);
    ui.$("dlg-ok").classList.toggle("off", !!opts.hideOk);
    ui.$("dlg-actions").classList.toggle("off", !!opts.hideActions);
    ui.$("dlg-mask").classList.add("on");
    ui.fitDialogToContent();
    root.setTimeout(function () {
      var first = ui.$("dlg").querySelector("[data-event-opt]:not([disabled]), #dlg-ok:not(.off), #dlg-cancel:not(.off)");
      if (ui.$("dlg-mask").classList.contains("on")) ui.focusWithoutScroll(first || ui.$("dlg"));
    }, 0);
  };

  ui.closeDlg = function () {
    if (ui.stopReveal) ui.stopReveal();
    ui.$("dlg-mask").classList.remove("on");
    var returnFocus = ui.session.dlgHook.returnFocus;
    ui.session.dlgHook.mode = null;
    ui.session.dlgHook.onOk = null;
    ui.session.dlgHook.onCancel = null;
    ui.session.dlgHook.returnFocus = null;
    ui.focusWithoutScroll(returnFocus);
  };

  doc.addEventListener("keydown", function (event) {
    if (!ui.$("dlg-mask").classList.contains("on")) return;
    var mode = ui.session.dlgHook.mode;
    if (event.key === "Escape" && mode !== "tick" && mode !== "tick-choice") {
      event.preventDefault();
      var cancel = ui.session.dlgHook.onCancel;
      ui.closeDlg();
      if (cancel) cancel();
      return;
    }
    if (event.key !== "Tab") return;
    var nodes = Array.prototype.slice.call(ui.$("dlg").querySelectorAll("button:not(:disabled)"))
      .filter(function (el) { return !el.classList.contains("off") && el.offsetParent !== null; });
    if (!nodes.length) { event.preventDefault(); ui.focusWithoutScroll(ui.$("dlg")); return; }
    var first = nodes[0], last = nodes[nodes.length - 1];
    if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  ui.l2Open = function () {
    var intel = ui.$("dock-intel");
    return !!(intel && intel.classList.contains("on"));
  };

  ui.syncDock = function () {
    var dock = ui.$("dock-shell");
    if (!dock) return;
    var boot = ui.$("sc-boot").classList.contains("on") ||
      (ui.$("sc-offer") && ui.$("sc-offer").classList.contains("on"));
    dock.classList.toggle("off", boot);
    var hq = ui.$("sc-hq").classList.contains("on");
    var sheet = ui.l2Open();
    ui.$("btn-dock-back").classList.toggle("off", hq && !sheet);
    ui.$("dock-l1").classList.toggle("off", !hq || sheet);
    ui.$("dock-sub-slot").classList.toggle("off", hq);
    // 履历整合进自身：在「自身」页的 dock 空槽放履历入口
    (function fillSubSlot() {
      var sub = ui.$("dock-sub-slot");
      var playerOn = ui.$("sc-player").classList.contains("on");
      if (!sub) return;
      if (playerOn && !sub.getAttribute("data-filled")) {
        var b = doc.createElement("button");
        b.type = "button";
        b.className = "career-only";
        b.textContent = "履历";
        b.addEventListener("click", function () {
          if (!ui.session.state) return;
          if (ui.paintResume) ui.paintResume();
          ui.show("sc-resume");
        });
        sub.textContent = "";
        sub.appendChild(b);
        sub.setAttribute("data-filled", "1");
      } else if (!playerOn && sub.getAttribute("data-filled")) {
        sub.textContent = "";
        sub.removeAttribute("data-filled");
      }
    })();
    ui.$("btn-tick").classList.toggle("off", !hq);
    if (ui.$("dock-ticks")) ui.$("dock-ticks").classList.toggle("off", !hq);
  };

  ui.closeDockSheets = function () {
    var intel = ui.$("dock-intel");
    if (intel) intel.classList.remove("on");
    var btn = ui.$("btn-sheet-intel");
    if (btn) btn.classList.remove("on");
    ui.syncDock();
  };

  ui.toggleDockSheet = function (name) {
    var panel = ui.$("dock-intel");
    var btn = ui.$("btn-sheet-intel");
    if (!panel || !btn) return;
    var already = panel.classList.contains("on");
    panel.classList.remove("on");
    btn.classList.remove("on");
    if (!already) {
      panel.classList.add("on");
      btn.classList.add("on");
    }
    ui.syncDock();
  };

  ui.show = function (id) {
    var target = ui.$(id);
    if (!target) return;
    var wasOn = target.classList.contains("on");
    if (!wasOn && ui.stopReveal) ui.stopReveal();
    // Only a real scene change may start an entrance animation. Repainting
    // the active scene must never replay a transform on the whole screen.
    var all = doc.querySelectorAll(".scene");
    for (var i = 0; i < all.length; i++) {
      if (all[i] !== target) {
        ui.motion.cancel(all[i]);
        all[i].classList.remove("on");
      }
    }
    if (!wasOn) {
      target.classList.add("on");
      ui.motion.play(target, target, "scene-enter", 220);
    }
    if (id !== "sc-hq") ui.closeDockSheets();
    else ui.syncDock();
  };

})(typeof globalThis !== "undefined" ? globalThis : this);
