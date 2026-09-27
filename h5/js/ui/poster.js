(function (root) {
  var GDS = root.GDS;
  var ui = GDS.ui;
  var sim = GDS.sim;
  var doc = root.document;
  var W = 900;
  var H = 1600;
  var ink = "#211a1c";
  var red = "#ad4e35";
  var muted = "#74675f";
  var paper = "#f5efdf";
  var page = 0;
  var model = null;
  var returnFocus = null;

  function font(ctx, size, weight, family) {
    ctx.font = (weight || 400) + " " + size + "px " + (family || '"PingFang SC", "Microsoft YaHei", sans-serif');
    ctx.textBaseline = "top";
  }

  function text(ctx, value, x, y, size, color, weight, maxWidth) {
    var label = String(value == null ? "" : value);
    var px = size;
    ctx.fillStyle = color || ink;
    font(ctx, px, weight || 400);
    while (maxWidth && ctx.measureText(label).width > maxWidth && px > 22) {
      px -= 2;
      font(ctx, px, weight || 400);
    }
    ctx.fillText(label, x, y);
  }

  function wrapped(ctx, value, x, y, maxWidth, lineHeight, maxLines, size, color, weight) {
    var source = String(value == null ? "" : value).replace(/\s+/g, " ");
    var lines = [];
    var line = "";
    var i;
    font(ctx, size, weight || 400);
    for (i = 0; i < source.length; i++) {
      var next = line + source.charAt(i);
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = source.charAt(i);
      } else line = next;
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      var last = lines[maxLines - 1];
      while (last && ctx.measureText(last + "…").width > maxWidth) last = last.slice(0, -1);
      lines[maxLines - 1] = last + "…";
    }
    ctx.fillStyle = color || ink;
    lines.forEach(function (part, index) { ctx.fillText(part, x, y + index * lineHeight); });
    return lines.length;
  }

  function base(ctx, section, index) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#dbcdb9";
    ctx.lineWidth = 6;
    ctx.strokeRect(25, 25, W - 50, H - 50);
    ctx.fillStyle = ink;
    ctx.fillRect(58, 58, 784, 74);
    text(ctx, "GAME MAKER DAILY", 77, 74, 34, "#fffaf0", 900);
    text(ctx, section, 594, 84, 17, "#d9b46b", 800, 230);
    ctx.fillStyle = red;
    ctx.fillRect(58, 136, 784, 6);
    ctx.fillStyle = "#b8aa93";
    ctx.fillRect(58, 1505, 784, 2);
    text(ctx, "游戏开发物语 · 游戏作者生涯", 60, 1520, 21, muted, 400);
    text(ctx, index + " / 02", 772, 1520, 21, muted, 700);
  }

  function metric(ctx, x, y, value, label) {
    ctx.fillStyle = "#fcf9f1";
    ctx.fillRect(x, y, 381, 135);
    ctx.strokeStyle = "#ddcfbb";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 381, 135);
    text(ctx, value, x + 23, y + 17, 60, ink, 900, 335);
    text(ctx, label, x + 24, y + 90, 23, muted, 500);
  }

  function drawArchive(ctx, view) {
    base(ctx, "CAREER FILE · 01", "01");
    text(ctx, "一个游戏作者的生涯", 62, 185, 26, red, 900);
    text(ctx, view.name || "游戏创作者", 58, 229, 96, ink, 900, 782);
    text(ctx, view.endingTitle || "生涯终章", 62, 336, 30, ink, 700, 775);
    ctx.fillStyle = "#e8d8bf";
    ctx.fillRect(58, 405, 784, 256);
    ctx.fillStyle = red;
    ctx.fillRect(58, 405, 9, 256);
    text(ctx, "GM", 94, 459, 106, red, 900);
    text(ctx, view.startYear + " — " + view.endYear, 334, 445, 43, ink, 800, 467);
    text(ctx, "游戏创作旅程", 336, 508, 27, ink, 700);
    wrapped(ctx, "最后任职：" + view.employer, 336, 559, 465, 36, 2, 26, muted, 500);
    text(ctx, "生涯数字", 60, 700, 30, red, 900);
    ctx.fillStyle = "#c7b9a4";
    ctx.fillRect(190, 720, 652, 2);
    metric(ctx, 58, 755, view.signedCount, "署名发售作品");
    metric(ctx, 461, 755, view.topScore == null ? view.transitionCount : view.topScore.toFixed(1),
      view.topScore == null ? "过渡项目" : "作品最高评分");
    metric(ctx, 58, 908, view.fame, "最终声望");
    metric(ctx, 461, 908, view.honor, "生涯荣誉");
    ctx.fillStyle = ink;
    ctx.fillRect(58, 1058, 784, 118);
    text(ctx, "生涯总销量", 82, 1079, 30, "#fffaf0", 900);
    text(ctx, view.totalSales == null ? "署名作品销量记录不完整" : "署名发售作品合计", 83, 1124, 21, "#d7c5aa", 500);
    text(ctx, view.totalSales == null ? "—" : sim.formatUnits(view.totalSales),
      458, 1078, 65, "#e8b765", 900, 355);
    ctx.fillStyle = ink;
    ctx.fillRect(58, 1195, 784, 3);
    text(ctx, view.bestKind === "score" ? "最高评分作品" :
      view.bestKind === "sales" ? "销量最高作品" :
      view.bestKind === "last" ? "最后署名作品" : "创作记录", 62, 1220, 22, red, 900);
    wrapped(ctx, view.best ? "《" + (view.best.title || "未命名作品") + "》" : "暂无署名作品", 62, 1254, 356, 34, 2, 29, ink, 800);
    text(ctx, "最终职称", 465, 1220, 22, red, 900);
    wrapped(ctx, view.job, 465, 1254, 360, 34, 2, 29, ink, 800);
    ctx.fillStyle = "#eee0c9";
    ctx.fillRect(58, 1350, 784, 118);
    wrapped(ctx, view.endingBody || "这一段创作旅程，已经写下了自己的结尾。", 82, 1366, 737, 31, 3, 23, ink, 600);
  }

  function moment(ctx, moment, y) {
    var item = moment.item;
    var detail = [];
    ctx.fillStyle = red;
    ctx.beginPath();
    ctx.arc(108, y + 29, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fcf9f1";
    ctx.fillRect(146, y, 696, 220);
    ctx.strokeStyle = "#d9c9b0";
    ctx.lineWidth = 2;
    ctx.strokeRect(146, y, 696, 220);
    var label = moment.label === "first" ? "首次署名" :
      moment.label === "last" ? "最终署名" :
      moment.item.score != null ? "生涯高峰" : "代表作品";
    text(ctx, (item.year || "—") + " · " + label, 169, y + 20, 26, red, 900, 645);
    wrapped(ctx, "《" + (item.title || "未命名作品") + "》", 169, y + 66, 648, 44, 2, 36, ink, 800);
    if (item.score != null) detail.push("评分 " + item.score.toFixed(1));
    if (item.sales != null) detail.push("累计销量 " + sim.formatUnits(item.sales));
    wrapped(ctx, detail.length ? detail.join(" · ") : "一部署名发售的作品", 169, y + 165, 647, 28, 1, 23, muted, 500);
  }

  function drawTimeline(ctx, view) {
    base(ctx, "WORKS ARCHIVE · 02", "02");
    text(ctx, view.name + "的创作轨迹", 62, 186, 27, red, 900, 772);
    text(ctx, "作品年表", 58, 236, 78, ink, 900);
    wrapped(ctx, "从第一部署名作品，到这段生涯的最后一页。", 62, 336, 773, 34, 2, 27, muted, 500);
    if (!view.moments.length) {
      ctx.fillStyle = "#fcf9f1";
      ctx.fillRect(58, 536, 784, 550);
      text(ctx, "这段生涯没有署名发售作品", 92, 708, 37, ink, 800, 712);
      wrapped(ctx, "海报仍会记住你的名字，以及走过的创作旅程。", 92, 777, 710, 40, 3, 29, muted, 500);
    } else {
      var ys = view.moments.length === 1 ? [681] : view.moments.length === 2 ? [522, 925] : [432, 717, 1002];
      ctx.fillStyle = red;
      ctx.fillRect(106, ys[0] + 25, 4, ys[ys.length - 1] - ys[0] + 12);
      view.moments.forEach(function (part, i) { moment(ctx, part, ys[i]); });
    }
    ctx.fillStyle = ink;
    ctx.fillRect(58, 1341, 784, 3);
    wrapped(ctx, "每一部作品，都是这段生涯留下的一页。", 62, 1373, 776, 38, 2, 30, ink, 700);
  }

  function render() {
    if (!model) return;
    var canvas = ui.$("poster-canvas");
    var ctx = canvas.getContext("2d");
    if (page === 0) drawArchive(ctx, model);
    else drawTimeline(ctx, model);
    ui.$("poster-image").src = canvas.toDataURL("image/png");
    ui.$("poster-image").alt = (page === 0 ? "作者生涯档案" : "作品年表") + "，可长按保存";
    ui.$("poster-count").textContent = (page + 1) + " / 2";
    ui.$("poster-prev").disabled = page === 0;
    ui.$("poster-next").disabled = page === 1;
  }

  function go(next) {
    if (next < 0 || next > 1 || next === page) return;
    page = next;
    render();
  }

  ui.openCareerPoster = function () {
    var state = ui.session.state;
    if (!state || state.phase !== "SETTLED" || !sim.careerPosterView) return;
    model = sim.careerPosterView(state, GDS.CONFIG);
    page = 0;
    returnFocus = doc.activeElement;
    render();
    ui.$("poster-overlay").hidden = false;
    ui.$("poster-close").focus();
  };

  ui.closeCareerPoster = function () {
    ui.$("poster-overlay").hidden = true;
    if (returnFocus && returnFocus.focus) returnFocus.focus();
    returnFocus = null;
  };

  function bind() {
    ui.$("btn-career-poster").addEventListener("click", ui.openCareerPoster);
    ui.$("poster-close").addEventListener("click", ui.closeCareerPoster);
    ui.$("poster-prev").addEventListener("click", function () { go(page - 1); });
    ui.$("poster-next").addEventListener("click", function () { go(page + 1); });
    doc.addEventListener("keydown", function (event) {
      if (ui.$("poster-overlay").hidden) return;
      if (event.key === "Escape") { event.preventDefault(); ui.closeCareerPoster(); }
      else if (event.key === "ArrowLeft") go(page - 1);
      else if (event.key === "ArrowRight") go(page + 1);
    });
    var startX = null;
    ui.$("poster-image").addEventListener("touchstart", function (event) {
      startX = event.touches && event.touches[0] ? event.touches[0].clientX : null;
    }, { passive: true });
    ui.$("poster-image").addEventListener("touchend", function (event) {
      if (startX == null || !event.changedTouches || !event.changedTouches[0]) return;
      var delta = event.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(delta) > 45) go(page + (delta < 0 ? 1 : -1));
    }, { passive: true });
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", bind);
  else bind();
})(typeof globalThis !== "undefined" ? globalThis : this);
