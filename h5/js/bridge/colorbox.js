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
        return { ok: true, preview: true };
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
      return res.data || null;
    },
    cloudPutSave: async function (st) {
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
          saveJson: JSON.stringify(st)
        },
        envId: e.envId,
        auth: true
      });
      if (res.statusCode === 401 || res.code === 401) throw new Error(res.message || "请先登录");
      if (res.code !== 200 && res.code !== 0) throw new Error(res.message || "存档失败");
      return true;
    },
    storageSet: async function (st) {
      if (!(window.ColorboxAI && window.ColorboxAI.storage && window.ColorboxAI.storage.setValue)) return;
      try {
        await window.ColorboxAI.storage.setValue({ gdsSave: st });
      } catch (e) { /* 预览可无容器存储 */ }
    },
    storageGet: async function () {
      if (!(window.ColorboxAI && window.ColorboxAI.storage && window.ColorboxAI.storage.getValue)) return null;
      try {
        var val = await window.ColorboxAI.storage.getValue("gdsSave");
        return val || null;
      } catch (e) {
        return null;
      }
    }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
