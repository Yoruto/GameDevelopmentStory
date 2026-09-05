const http = require("http");
const zlib = require("zlib");
const crypto = require("crypto");
const tcb = require("@cloudbase/node-sdk");

const app = tcb.init({
  env: process.env.CLOUDBASE_ENV_ID || process.env.TCB_ENV,
  accessKey: process.env.COLORBOX__ACCESS_KEY
});
const rdb = app.rdb({ database: "public" });
const DEFAULT_POOL_ID = process.env.DRAW_POOL_ID || "default";
const MAX_BODY_BYTES = 64 * 1024;
const MAX_DRAW_COUNT = 10;

function apiPath(req) {
  const pathname = new URL(req.url, "http://localhost").pathname || "/";
  return pathname.replace(/^\/api(?=\/|$)/, "") || "/";
}

function queryRows(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.rows)) return result.rows;
  return [];
}

function readPuid(req) {
  const raw = req.headers["x-cloudbase-context"];
  if (!raw) { const error = new Error("请先登录"); error.statusCode = 401; throw error; }
  let buffer = Buffer.from(String(raw).trim(), "base64");
  if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) buffer = zlib.gunzipSync(buffer);
  let context;
  try { context = JSON.parse(buffer.toString("utf8")); } catch (_) { const error = new Error("登录状态无效"); error.statusCode = 401; throw error; }
  const puid = context.customUserId || context.userId || context.uid;
  if (!puid) { const error = new Error("请先登录"); error.statusCode = 401; throw error; }
  return String(puid);
}

function readRequestId(req) {
  const value = String(req.headers["x-request-id"] || "").trim();
  if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    const error = new Error("请求 ID 格式不正确");
    error.statusCode = 400;
    throw error;
  }
  if (value) return value;
  return crypto.randomUUID();
}

function getJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (chunk) => { size += chunk.length; if (size > MAX_BODY_BYTES) { const error = new Error("请求内容过大"); error.statusCode = 413; reject(error); return; } chunks.push(chunk); });
    req.on("end", () => { if (!chunks.length) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch (_) { const error = new Error("请求格式不正确"); error.statusCode = 400; reject(error); } });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-Id, X-CloudBase-Context",
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(payload));
}

async function getRdbServiceToken() {
  const credential = await app.auth().getClientCredential();
  if (typeof credential === "string" && credential.trim()) return credential.trim();
  if (credential && typeof credential.access_token === "string" && credential.access_token.trim()) return credential.access_token.trim();
  if (process.env.COLORBOX__ACCESS_KEY) return process.env.COLORBOX__ACCESS_KEY;
  throw new Error("数据库服务凭据不可用");
}

async function drawRpc(puid, poolId, drawCount, proofUrl, requestId) {
  const envId = process.env.CLOUDBASE_ENV_ID || process.env.TCB_ENV;
  const token = await getRdbServiceToken();
  const response = await fetch(`https://${envId}.api.tcloudbasegateway.com/v1/rdb/rest/rpc/perform_draw`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "X-Db-Instance": "default", "Accept-Profile": "public", "Content-Profile": "public", "Content-Type": "application/json" },
    body: JSON.stringify({ p_puid: puid, p_pool_id: poolId, p_draw_count: drawCount, p_proof_url: proofUrl || "", p_request_id: requestId })
  });
  const raw = await response.text(); let data = raw; try { data = raw ? JSON.parse(raw) : null; } catch (_) { /* keep raw for logs */ }
  if (!response.ok) {
    console.error("[Draw RPC Error]", response.status, data);
    const rpcMessage = data && typeof data.message === "string" ? data.message : "抽卡暂时无法完成";
    const error = new Error(rpcMessage);
    error.statusCode = response.status >= 400 && response.status < 500 ? response.status : 500;
    throw error;
  }
  return queryRows(data);
}

function mapPrize(row) {
  return { drawId: row.draw_id || row.id, prizeCode: row.prize_code, prizeName: row.prize_name, rarity: row.rarity, description: row.description || "", createdAt: row.created_at };
}

async function handle(req, res) {
  if (req.method === "OPTIONS") return sendJson(res, 204, null);
  const path = apiPath(req); const url = new URL(req.url, "http://localhost");
  try {
    if (req.method === "GET" && path === "/health") return sendJson(res, 200, { code: 0, message: "ok", data: null });
    if (req.method === "GET" && path === "/pool") {
      const poolId = url.searchParams.get("poolId") || DEFAULT_POOL_ID;
      const pools = queryRows(await rdb.from("draw_pools").select("pool_id, title, description, cover_url, starts_at, ends_at, draw_limit, pity_threshold, status").eq("pool_id", poolId).limit(1));
      if (!pools.length) { const error = new Error("卡池不存在"); error.statusCode = 404; throw error; }
      const pool = pools[0];
      const prizes = queryRows(await rdb.from("draw_prizes").select("prize_code, prize_name, rarity, description, weight, remaining_count").eq("pool_id", poolId).eq("status", "active").order("id", { ascending: true }).limit(100));
      const totalWeight = prizes.reduce((sum, item) => sum + Math.max(0, Number(item.weight) || 0), 0);
      const recent = queryRows(await rdb.from("draw_records").select("prize_name, rarity, created_at").eq("pool_id", poolId).order("created_at", { ascending: false }).limit(20));
      return sendJson(res, 200, { code: 0, message: "success", data: { poolId: pool.pool_id, title: pool.title, description: pool.description, coverUrl: pool.cover_url || null, startsAt: pool.starts_at, endsAt: pool.ends_at, drawLimit: Number(pool.draw_limit), pityThreshold: Number(pool.pity_threshold), prizes: prizes.map((item) => ({ code: item.prize_code, name: item.prize_name, rarity: item.rarity, description: item.description, weight: Number(item.weight), remainingCount: Number(item.remaining_count), odds: totalWeight ? Number(item.weight) / totalWeight : 0 })), recentResults: recent.map((item) => ({ prizeName: item.prize_name, rarity: item.rarity, createdAt: item.created_at })) } });
    }
    if (req.method === "GET" && path === "/draw/quota") {
      const puid = readPuid(req); const poolId = url.searchParams.get("poolId") || DEFAULT_POOL_ID;
      const rows = queryRows(await rdb.from("draw_user_quota").select("remaining_count, total_count, pity_count, updated_at").eq("pool_id", poolId).eq("puid", puid).limit(1));
      const row = rows[0];
      if (row) return sendJson(res, 200, { code: 0, message: "success", data: { remainingCount: Number(row.remaining_count), totalCount: Number(row.total_count), pityCount: Number(row.pity_count), updatedAt: row.updated_at } });
      const pools = queryRows(await rdb.from("draw_pools").select("draw_limit").eq("pool_id", poolId).limit(1));
      const initialCount = pools.length ? Number(pools[0].draw_limit || 0) : 0;
      return sendJson(res, 200, { code: 0, message: "success", data: { remainingCount: initialCount, totalCount: initialCount, pityCount: 0 } });
    }
    if (req.method === "GET" && path === "/draw/results") {
      const puid = readPuid(req); const poolId = url.searchParams.get("poolId") || DEFAULT_POOL_ID;
      const rows = queryRows(await rdb.from("draw_records").select("id, prize_code, prize_name, rarity, description, created_at").eq("pool_id", poolId).eq("puid", puid).order("created_at", { ascending: false }).limit(50));
      return sendJson(res, 200, { code: 0, message: "success", data: rows.map(mapPrize) });
    }
    if (req.method === "POST" && path === "/draw") {
      const puid = readPuid(req); const body = await getJsonBody(req); const poolId = typeof body.poolId === "string" && body.poolId.trim() ? body.poolId.trim().slice(0, 64) : DEFAULT_POOL_ID; const drawCount = Number(body.drawCount);
      if (!Number.isSafeInteger(drawCount) || drawCount < 1 || drawCount > MAX_DRAW_COUNT) { const error = new Error("抽卡次数必须是 1 到 10"); error.statusCode = 400; throw error; }
      const proofUrl = typeof body.proofUrl === "string" && body.proofUrl.trim() ? body.proofUrl.trim().slice(0, 2048) : "";
      if (proofUrl && !/^https:\/\/[^\s]+$/i.test(proofUrl)) { const error = new Error("素材地址无效"); error.statusCode = 400; throw error; }
      const rows = await drawRpc(puid, poolId, drawCount, proofUrl, readRequestId(req));
      const draws = rows.map(mapPrize); const last = rows[0] || {}; return sendJson(res, 200, { code: 0, message: "success", data: { sessionId: last.session_id || null, draws, remainingCount: last.remaining_count == null ? null : Number(last.remaining_count), pityProgress: last.pity_count == null ? null : Number(last.pity_count) } });
    }
    return sendJson(res, 404, { code: 404, message: "not found", data: null });
  } catch (error) { console.error("[Draw API Error]", error); const statusCode = error.statusCode || 500; return sendJson(res, statusCode, { code: statusCode, message: statusCode >= 500 ? "服务暂时不可用" : error.message, data: null }); }
}

http.createServer(handle).listen(process.env.PORT || 9000);
