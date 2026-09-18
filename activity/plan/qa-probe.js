/* QA 探针：注入到「游戏开发物语」页面。
 * 作用：把当前场景的布局与 sim 层榜单结果写进 document.title，
 *      用 `agent-browser get title` 读取即可（绕开 batch 命令行吞引号的问题）。
 *
 * 踩过的坑（已修）：
 *  1. 若监视 documentElement，写 document.title 会改 <title> 文本 → 触发自身的
 *     MutationObserver → 无限自激，页面永不空闲，daemon 连接直接超时。只监视 body。
 *  2. 报告内容不变时不写 title，避免无谓渲染。
 *  3. agent-browser batch 走命令行参数时会吃掉引号（`q('#x')` → `q(#x)`），
 *     所以命令改用 stdin JSON 传入。 */
(function () {
  var q = function (s) { return document.querySelector(s); };
  var last = "";

  // --- 生涯档 HQ「下月发售」：一行一款的实测（行数、卡内是否被迫滚动、名字被截多少） ---
  function measureHQ(out) {
    var box = q("#hq-next-releases");
    out.nrExists = box ? 1 : 0;
    if (!box) return;
    var rows = box.children, i, txt = [];
    for (i = 0; i < rows.length; i++) txt.push(rows[i].textContent);
    out.nrRows = rows.length;
    out.nrText = txt;
    out.nrRowH = rows.length ? Math.round(rows[0].getBoundingClientRect().height) : null;
    out.nrVisible = box.getClientRects().length > 0 ? 1 : 0;
    // 情报卡内部是否被迫滚动：一屏不滚动的硬约束下，卡内滚动同样算破功
    var ir = box.closest(".intel-rows");
    if (ir) {
      out.intelSH = ir.scrollHeight;
      out.intelCH = ir.clientHeight;
      out.intelOverflow = getComputedStyle(ir).overflowY;
      out.intelScrolls = ir.scrollHeight > ir.clientHeight + 0.5 ? 1 : 0;
    }
    var cut = 0, worst = 0;
    for (i = 0; i < rows.length; i++) {
      var r = rows[i].getBoundingClientRect();
      var el2 = rows[i].parentElement, clipped = false;
      while (el2 && el2 !== document.documentElement) {
        var s2 = getComputedStyle(el2);
        if (s2.overflowY !== "visible" || s2.overflowX !== "visible") {
          var er = el2.getBoundingClientRect();
          if (er.bottom < r.bottom - 0.5 || er.top > r.top + 0.5) { clipped = true; break; }
        }
        el2 = el2.parentElement;
      }
      if (clipped || r.bottom > window.innerHeight + 0.5) cut++;
      var n2 = rows[i].querySelector(".nr-name");
      if (n2) { var d2 = n2.scrollWidth - n2.clientWidth; if (d2 > worst) worst = d2; }
    }
    out.nrCut = cut;
    out.nrNameCutPx = worst;
  }

  function measure() {
    var G = window.GDS || {};
    var sim = G.sim;
    var state = G.ui && G.ui.session ? G.ui.session.state : null;
    var config = G.CONFIG;
    var active = q(".scene.on");
    var app = q("#app");
    var mc = q("#month-chart");
    var se = document.scrollingElement || document.documentElement;
    var out = {
      scene: active ? active.id : null,
      appClass: app ? app.className : null,
      stateMode: state ? state.mode : null,
      ym: state ? (state.year + "." + state.month) : null,
      vw: window.innerWidth,
      vh: window.innerHeight,
      docSH: se.scrollHeight,
      docCH: se.clientHeight,
      docSW: se.scrollWidth,
      docCW: se.clientWidth,
      appH: app ? Math.round(app.getBoundingClientRect().height) : null,
      appW: app ? Math.round(app.getBoundingClientRect().width) : null
    };
    measureHQ(out);
    if (!mc) { out.noChart = 1; return out; }
    var rows = mc.children;
    out.rows = rows.length;
    out.mcH = Math.round(mc.getBoundingClientRect().height);
    out.mcSH = mc.scrollHeight;
    out.mcCH = mc.clientHeight;
    out.mcOverflow = getComputedStyle(mc).overflowY;
    out.head = q("#chart-head") ? q("#chart-head").textContent : null;
    out.hint = q("#chart-hint") ? q("#chart-hint").textContent : null;
    out.oldMauBlock = q("#rival-mau") ? 1 : 0;
    out.oldMauHint = q("#mau-hint") ? 1 : 0;
    out.liveTags = document.querySelectorAll(".item .tag-live").length;
    out.firstRow = rows[0] ? rows[0].textContent : null;
    out.lastRow = rows.length ? rows[rows.length - 1].textContent : null;
    out.rowH = rows[0] ? Math.round(rows[0].getBoundingClientRect().height) : null;
    // 若首行是空态提示而非榜单行，标出来，避免把「空榜」误读成「1 行」
    out.isPlaceholder = rows.length === 1 && rows[0].className.indexOf("hint") >= 0 ? 1 : 0;

    // ---- 裁剪检测：只有「元素自身不溢出」不够，祖先 overflow 也会切掉行 ----
    var mcRect = mc.getBoundingClientRect();
    out.mcBottom = Math.round(mcRect.bottom);
    var vh = window.innerHeight;
    var fully = 0, cutoffAt = null;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i].getBoundingClientRect();
      var inside = r.bottom <= vh + 0.5;
      // 再判祖先裁剪
      var el = rows[i].parentElement, clipped = false, how = null;
      while (el && el !== document.documentElement) {
        var st2 = getComputedStyle(el);
        if (st2.overflowY !== "visible" || st2.overflowX !== "visible") {
          var er = el.getBoundingClientRect();
          if (er.bottom < r.bottom - 0.5 || er.top > r.top + 0.5) { clipped = true; how = (el.id || el.className) + ":" + st2.overflowY; break; }
        }
        el = el.parentElement;
      }
      if (inside && !clipped) { fully++; } else if (cutoffAt === null) { cutoffAt = i + 1; }
    }
    out.rowsFullyVisible = fully;
    out.firstCutRow = cutoffAt;
    // ---- 横向挤压检测：标题 / 发行商 各被省略号吃掉多少 ----
    var worstTtlCut = 0, worstTtlRow = null, worstPubCut = 0, liveInfo = null;
    for (var j = 0; j < rows.length; j++) {
      var nm = rows[j].querySelector(".nm");
      var ttl = rows[j].querySelector(".ttl");
      var pub = rows[j].querySelector(".pub");
      var bEl = rows[j].querySelector("b");
      var tg = rows[j].querySelector(".tag-live");
      if (ttl) {
        var tc = ttl.scrollWidth - ttl.clientWidth;
        if (tc > worstTtlCut) { worstTtlCut = tc; worstTtlRow = rows[j].textContent; }
      }
      if (pub) {
        var pc = pub.scrollWidth - pub.clientWidth;
        if (pc > worstPubCut) worstPubCut = pc;
      }
      if (tg && !liveInfo && ttl) {
        liveInfo = {
          ttlW: ttl.clientWidth, ttlScrollW: ttl.scrollWidth,
          pubW: pub ? pub.clientWidth : 0, pubScrollW: pub ? pub.scrollWidth : 0,
          nmW: nm ? nm.clientWidth : null,
          bW: bEl ? bEl.clientWidth : null, tagW: tg.clientWidth,
          txt: rows[j].textContent
        };
      }
    }
    out.worstTtlCutPx = worstTtlCut;
    out.worstTtlRow = worstTtlRow;
    out.worstPubCutPx = worstPubCut;
    out.liveRow = liveInfo;
    var dock = q(".dock-shell") || q(".dock-bar");
    out.dockH = dock ? Math.round(dock.getBoundingClientRect().height) : null;
    out.dockTop = dock ? Math.round(dock.getBoundingClientRect().top) : null;
    var sb = q(".scene.on .scene-body") || q(".scene.on");
    if (sb) {
      out.bodySH = sb.scrollHeight;
      out.bodyCH = sb.clientHeight;
      out.bodyOverflowY = getComputedStyle(sb).overflowY;
      out.bodyBottom = Math.round(sb.getBoundingClientRect().bottom);
    }

    // ---- sim 层事实：榜单到底出了几条、按什么排 ----
    if (sim && state && config) {
      try {
        out.playerReleased = (state.released || []).length;
        out.worldReleased = (state.worldReleased || []).length;
        out.rivalReleased = (state.rivalReleased || []).length;
        var board = sim.monthlySalesRanking(state, config);
        out.boardLen = board.length;
        out.boardTop = board.slice(0, 3).map(function (r) {
          return r.rank + ":" + r.title + ":" + r.monthSales + ":" + (r.live ? "live" : "solo");
        });
        out.boardTail = board.slice(-2).map(function (r) {
          return r.rank + ":" + r.title + ":" + r.monthSales + ":" + (r.live ? "live" : "solo");
        });
        out.boardLive = board.filter(function (r) { return r.live; }).length;
        out.chartCfgSize = config.lifecycle ? config.lifecycle.chartSize : null;
        out.rankingSize = config.ranking ? config.ranking.size : null;
      } catch (e) {
        out.simErr = String(e);
      }
    }
    return out;
  }

  function emit() {
    var rep;
    try { rep = measure(); } catch (e) { rep = { err: String(e) }; }
    var s = "QA " + JSON.stringify(rep);
    if (s !== last) { last = s; document.title = s; }
  }

  window.__qaEmit = emit;

  function boot() {
    emit();
    var mo = new MutationObserver(function () { emit(); });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
