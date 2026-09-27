(function (root) {
  var GDS = root.GDS = root.GDS || {};
  var win = typeof window !== "undefined" ? window : root;

  function cai() {
    return win.ColorboxAI || (win.window && win.window.ColorboxAI) || null;
  }

  function env() {
    return { apiBase: win.ACTIVITY_API_BASE || "", envId: win.ACTIVITY_ENV_ID || "" };
  }

  GDS.bridge = {
    hasBox: function () {
      var box = cai();
      return !!(box && (box.cloud || box.storage || box.security));
    },
    canCloud: function () {
      var box = cai();
      var e = env();
      return !!(box && box.cloud && e.envId && e.apiBase);
    },
    isPreview: function () {
      return !GDS.bridge.canCloud();
    },
    auditText: async function (text) {
      if (!(window.ColorboxAI && window.ColorboxAI.security && window.ColorboxAI.security.checkAudit)) {
        if (GDS.bridge.isPreview()) return { ok: true, preview: true };
        return { ok: false, message: "内容检查暂不可用，请稍后重试" };
      }
      try {
        var res = await window.ColorboxAI.security.checkAudit(text);
        if (res.code === 401 || res.code === 500) {
          if (GDS.bridge.isPreview()) return { ok: true, preview: true };
          return { ok: false, message: res.message || (res.code === 401 ? "请先登录" : "检查失败，先不提交") };
        }
        if (res.code !== 200 || res.data !== true) {
          return { ok: false, message: res.message || "名字不合适，换一个" };
        }
        return { ok: true };
      } catch (e) {
        if (GDS.bridge.isPreview()) return { ok: true, preview: true };
        return { ok: false, message: (e && e.message) || "检查失败，先不提交" };
      }
    },
    ensureCloud: async function () {
      if (!GDS.bridge.canCloud()) return false;
      var e = env();
      var authRes = await window.ColorboxAI.cloud.auth({ envId: e.envId });
      if (authRes.code !== 200) {
        if (GDS.bridge.isPreview()) return false;
        throw new Error(authRes.message || "请先登录");
      }
      return true;
    },
    cloudGetSave: async function () {
      if (!(await GDS.bridge.ensureCloud())) return null;
      var e = env();
      var res = await window.ColorboxAI.cloud.request({
        url: e.apiBase + "/my/save",
        method: "GET",
        envId: e.envId,
        auth: true
      });
      if (res.statusCode === 401 || res.code === 401) throw new Error(res.message || "请先登录");
      if (res.code !== 200 && res.code !== 0) throw new Error(res.message || "读档失败");
      var row = res.data || null;
      if (row && row.saveChunks) {
        if (!Number.isSafeInteger(row.saveChunks) || row.saveChunks < 2 || row.saveChunks > 8 ||
            row.chunkIndex !== 0 || typeof row.saveChunk !== "string") {
          throw new Error("云端存档分段信息无效");
        }
        var chunks = [row.saveChunk];
        for (var i = 1; i < row.saveChunks; i++) {
          var next = await window.ColorboxAI.cloud.request({
            url: e.apiBase + "/my/save?part=" + i + "&revision=" + row.revision,
            method: "GET", envId: e.envId, auth: true
          });
          if (next.statusCode === 409 || next.code === 409) throw new Error("读取时云端存档发生变更，请重试");
          if ((next.code !== 200 && next.code !== 0) || !next.data ||
              next.data.revision !== row.revision || next.data.chunkIndex !== i ||
              next.data.saveChunks !== row.saveChunks || typeof next.data.saveChunk !== "string") {
            throw new Error("云端存档分段读取失败");
          }
          chunks.push(next.data.saveChunk);
        }
        if (!win.TextDecoder || !win.atob) throw new Error("当前浏览器无法读取云端存档");
        var decoded = chunks.map(function (chunk) { return win.atob(chunk); });
        var size = decoded.reduce(function (sum, chunk) { return sum + chunk.length; }, 0);
        var bytes = new Uint8Array(size);
        var offset = 0;
        decoded.forEach(function (chunk) {
          for (var j = 0; j < chunk.length; j++) bytes[offset + j] = chunk.charCodeAt(j);
          offset += chunk.length;
        });
        row.saveJson = new win.TextDecoder("utf-8", { fatal: true }).decode(bytes);
      }
      return row;
    },
    cloudPutSave: async function (st, expectedRevision) {
      if (!(await GDS.bridge.ensureCloud())) return false;
      var e = env();
      var res = await window.ColorboxAI.cloud.request({
        url: e.apiBase + "/save/upsert",
        method: "POST",
        data: {
          companyName: st.company.name,
          year: st.year,
          month: st.month,
          phase: st.phase,
          saveJson: JSON.stringify(st),
          expectedRevision: expectedRevision
        },
        envId: e.envId,
        auth: true
      });
      if (res.statusCode === 409 || res.code === 409) {
        var conflict = new Error("云端有较新的存档");
        conflict.code = 409;
        throw conflict;
      }
      if (res.statusCode === 401 || res.code === 401) throw new Error(res.message || "请先登录");
      if (res.code !== 200 && res.code !== 0) throw new Error(res.message || "存档失败");
      return res.data || null;
    },
    storageSet: async function (st) {
      if (!(window.ColorboxAI && window.ColorboxAI.storage && window.ColorboxAI.storage.setValue)) return false;
      try {
        await window.ColorboxAI.storage.setValue({ gdsSave: st });
        return true;
      } catch (e) { return false; }
    },
    storageGet: async function () {
      if (!(window.ColorboxAI && window.ColorboxAI.storage && window.ColorboxAI.storage.getValue)) return null;
      try {
        var val = await window.ColorboxAI.storage.getValue("gdsSave");
        return val || null;
      } catch (e) {
        throw e;
      }
    }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
