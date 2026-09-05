const http = require("http");
const zlib = require("zlib");
const tcb = require("@cloudbase/node-sdk");

const app = tcb.init({
  env: process.env.CLOUDBASE_ENV_ID || process.env.TCB_ENV,
  accessKey: process.env.COLORBOX__ACCESS_KEY
});
const rdb = app.rdb({ database: "public" });
const RESULT_TABLE = "result_poster_results";

function apiPath(req) {
  const pathname = new URL(req.url, "http://localhost").pathname || "/";
  return pathname.replace(/^\/api(?=\/|$)/, "") || "/";
}

function readPuid(req) {
  const raw = req.headers["x-cloudbase-context"];
  if (!raw) {
    const error = new Error("请先登录");
    error.statusCode = 401;
    throw error;
  }
  let buffer = Buffer.from(String(raw).trim(), "base64");
  if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
    buffer = zlib.gunzipSync(buffer);
  }
  const context = JSON.parse(buffer.toString("utf8"));
  const puid = context.customUserId || context.userId || context.uid;
  if (!puid) {
    const error = new Error("请先登录");
    error.statusCode = 401;
    throw error;
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

function getJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
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

function resultData(row) {
  if (!row) return null;
  return {
    id: row.id,
    nickname: row.nickname,
    rank: Number(row.rank),
    score: Number(row.score),
    percentile: row.percentile,
    date: row.result_date,
    shareCount: Number(row.share_count || 0),
    updatedAt: row.updated_at
  };
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

async function saveResult(puid, payload) {
  const token = await getRdbServiceToken();
  const envId = process.env.CLOUDBASE_ENV_ID || process.env.TCB_ENV;
  const response = await fetch(
    `https://${envId}.api.tcloudbasegateway.com/v1/rdb/rest/rpc/save_result_poster_result`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "X-Db-Instance": "default",
        "Accept-Profile": "public",
        "Content-Profile": "public",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        p_puid: puid,
        p_nickname: payload.nickname,
        p_rank: payload.rank,
        p_score: payload.score,
        p_percentile: payload.percentile,
        p_result_date: payload.date
      })
    }
  );
  const raw = await response.text();
  let data = raw;
  try { data = raw ? JSON.parse(raw) : null; } catch { /* preserve text for logs */ }
  if (!response.ok) {
    console.error("[Result Poster RPC Error]", response.status, data);
    const error = new Error("结果暂时无法保存");
    error.statusCode = 500;
    throw error;
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

    if (req.method === "GET" && path === "/result/me") {
      const puid = readPuid(req);
      const result = await rdb.from(RESULT_TABLE)
        .select("id, nickname, rank, score, percentile, result_date, share_count, updated_at")
        .eq("puid", puid)
        .limit(1);
      const rows = queryRows(result);
      res.writeHead(200, headers);
      return res.end(JSON.stringify({ code: 0, message: "success", data: resultData(rows[0]) }));
    }

    if (req.method === "POST" && path === "/result/save") {
      const puid = readPuid(req);
      const body = await getJsonBody(req);
      const rank = Number(body.rank);
      const score = Number(body.score);
      if (!Number.isSafeInteger(rank) || rank < 1 || rank > 2147483647) {
        const error = new Error("排名格式不正确");
        error.statusCode = 400;
        throw error;
      }
      if (!Number.isSafeInteger(score) || score < 0 || score > 2147483647) {
        const error = new Error("积分格式不正确");
        error.statusCode = 400;
        throw error;
      }
      const nickname = typeof body.nickname === "string" && body.nickname.trim()
        ? body.nickname.trim().slice(0, 40)
        : "Hupu User";
      const percentile = typeof body.percentile === "string" ? body.percentile.trim().slice(0, 20) : "";
      const date = typeof body.date === "string" ? body.date.trim().slice(0, 32) : "";
      const row = await saveResult(puid, { nickname, rank, score, percentile, date });
      res.writeHead(200, headers);
      return res.end(JSON.stringify({ code: 0, message: "success", data: resultData(row) }));
    }

    res.writeHead(404, headers);
    return res.end(JSON.stringify({ code: 404, message: "not found" }));
  } catch (error) {
    console.error("[Result Poster API Error]", error);
    const statusCode = error.statusCode || 500;
    const message = statusCode < 500 ? (error.message || "请求失败") : "服务暂时不可用";
    res.writeHead(statusCode, headers);
    return res.end(JSON.stringify({ code: statusCode, message }));
  }
}

http.createServer(handle).listen(process.env.PORT || 9000);
