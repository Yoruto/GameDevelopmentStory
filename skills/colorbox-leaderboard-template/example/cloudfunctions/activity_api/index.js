const http = require("http");
const zlib = require("zlib");
const tcb = require("@cloudbase/node-sdk");

const app = tcb.init({
  env: process.env.CLOUDBASE_ENV_ID || process.env.TCB_ENV,
  accessKey: process.env.COLORBOX__ACCESS_KEY
});
const rdb = app.rdb({ database: "public" });
const LEADERBOARD_TABLE = "leaderboard_entries";

function apiPath(req) {
  const pathname = new URL(req.url, "http://localhost").pathname || "/";
  return pathname.replace(/^\/api(?=\/|$)/, "") || "/";
}

function readPuid(req) {
  const raw = req.headers["x-cloudbase-context"];
  if (!raw) {
    const err = new Error("请先登录");
    err.statusCode = 401;
    throw err;
  }
  let buf = Buffer.from(String(raw).trim(), "base64");
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    buf = zlib.gunzipSync(buf);
  }
  const context = JSON.parse(buf.toString("utf8"));
  const puid = context.customUserId || context.userId || context.uid;
  if (!puid) {
    const err = new Error("请先登录");
    err.statusCode = 401;
    throw err;
  }
  return String(puid);
}

function queryRows(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.rows)) return result.rows;
  return [];
}

function createMemoryCache(ttlMs) {
  let value = null;
  let expiresAt = 0;
  const cached = async (fetcher) => {
    if (value && Date.now() < expiresAt) return value;
    value = await fetcher();
    expiresAt = Date.now() + ttlMs;
    return value;
  };
  cached.clear = () => {
    value = null;
    expiresAt = 0;
  };
  return cached;
}

const readLeaderboard = createMemoryCache(5000);

async function loadLeaderboard() {
  return readLeaderboard(async () => {
    const result = await rdb
      .from(LEADERBOARD_TABLE)
      .select("id, display_name, score, updated_at")
      .order("score", { ascending: false })
      .order("updated_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(50);
    return queryRows(result);
  });
}

function getJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 65536) reject(new Error("请求内容过大"));
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch { reject(new Error("请求格式不正确")); }
    });
    req.on("error", reject);
  });
}

async function getRdbServiceToken() {
  const credential = await app.auth().getClientCredential();
  if (typeof credential === "string" && credential.trim()) return credential.trim();
  if (credential && typeof credential.access_token === "string" && credential.access_token.trim()) {
    return credential.access_token.trim();
  }
  const accessKey = process.env.COLORBOX__ACCESS_KEY;
  if (accessKey && accessKey.trim()) return accessKey.trim();
  throw new Error("数据库服务凭据不可用");
}

async function submitScore(puid, displayName, score) {
  const token = await getRdbServiceToken();
  const envId = process.env.CLOUDBASE_ENV_ID || process.env.TCB_ENV;
  const response = await fetch(
    `https://${envId}.api.tcloudbasegateway.com/v1/rdb/rest/rpc/submit_leaderboard_score`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "X-Db-Instance": "default",
        "Accept-Profile": "public",
        "Content-Profile": "public",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ p_puid: puid, p_display_name: displayName, p_score: score })
    }
  );
  const raw = await response.text();
  let data = raw;
  try { data = raw ? JSON.parse(raw) : null; } catch { /* preserve text for logs */ }
  if (!response.ok) {
    console.error("[Leaderboard RPC Error]", response.status, data);
    const err = new Error("成绩暂时无法保存");
    err.statusCode = 500;
    throw err;
  }
  return Array.isArray(data) ? data[0] : data;
}

async function handle(req, res) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-Id, X-CloudBase-Context",
    "Content-Type": "application/json; charset=utf-8"
  };
  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    return res.end();
  }

  const path = apiPath(req);
  try {
    if (req.method === "GET" && path === "/health") {
      res.writeHead(200, headers);
      return res.end(JSON.stringify({ code: 0, message: "ok" }));
    }

    if (req.method === "GET" && path === "/leaderboard") {
      const puid = readPuid(req);
      const rows = await loadLeaderboard();
      const data = rows.map((row, index) => ({
        rank: index + 1,
        displayName: row.display_name,
        score: Number(row.score),
        updatedAt: row.updated_at,
        isCurrent: false
      }));
      const mine = await rdb.from(LEADERBOARD_TABLE).select("score").eq("puid", puid).limit(1);
      const myRows = queryRows(mine);
      const myScore = myRows.length ? Number(myRows[0].score) : null;
      if (myScore !== null) {
        const higher = await rdb.from(LEADERBOARD_TABLE).select("score", { count: "exact" }).gt("score", myScore);
        const rank = (typeof higher.count === "number" ? higher.count : queryRows(higher).length) + 1;
        for (const entry of data) {
          if (entry.score === myScore && entry.rank === rank) entry.isCurrent = true;
        }
      }
      res.writeHead(200, headers);
      return res.end(JSON.stringify({ code: 0, message: "success", data }));
    }

    if (req.method === "GET" && path === "/leaderboard/me") {
      const puid = readPuid(req);
      const result = await rdb.from(LEADERBOARD_TABLE).select("score, display_name, updated_at").eq("puid", puid).limit(1);
      const rows = queryRows(result);
      if (!rows.length) {
        res.writeHead(200, headers);
        return res.end(JSON.stringify({ code: 0, message: "success", data: null }));
      }
      const score = Number(rows[0].score);
      const higher = await rdb.from(LEADERBOARD_TABLE).select("score", { count: "exact" }).gt("score", score);
      const rank = (typeof higher.count === "number" ? higher.count : queryRows(higher).length) + 1;
      res.writeHead(200, headers);
      return res.end(JSON.stringify({ code: 0, message: "success", data: { rank, score, displayName: rows[0].display_name } }));
    }

    if (req.method === "POST" && path === "/leaderboard/submit") {
      const puid = readPuid(req);
      const body = await getJsonBody(req);
      const score = Number(body.score);
      if (!Number.isSafeInteger(score) || score < 0 || score > 2147483647) {
        const err = new Error("成绩格式不正确");
        err.statusCode = 400;
        throw err;
      }
      const displayName = typeof body.displayName === "string" && body.displayName.trim()
        ? body.displayName.trim().slice(0, 40)
        : "Hupu User";
      const data = await submitScore(puid, displayName, score);
      readLeaderboard.clear();
      res.writeHead(200, headers);
      return res.end(JSON.stringify({ code: 0, message: "success", data: { score: Number(data.score), displayName: data.display_name } }));
    }

    res.writeHead(404, headers);
    return res.end(JSON.stringify({ code: 404, message: "not found" }));
  } catch (err) {
    console.error("[Activity API Error]", err);
    const statusCode = err.statusCode || 500;
    const message = statusCode < 500 ? (err.message || "请求失败") : "服务暂时不可用";
    res.writeHead(statusCode, headers);
    return res.end(JSON.stringify({ code: statusCode, message }));
  }
}

http.createServer(handle).listen(process.env.PORT || 9000);
