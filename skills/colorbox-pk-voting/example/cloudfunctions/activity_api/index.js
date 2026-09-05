const crypto = require("crypto");
const http = require("http");
const zlib = require("zlib");
const tcb = require("@cloudbase/node-sdk");

const app = tcb.init({
  env: process.env.CLOUDBASE_ENV_ID || process.env.TCB_ENV,
  accessKey: process.env.COLORBOX__ACCESS_KEY
});
const rdb = app.rdb({ database: "public" });
const MATCH_TABLE = "pk_matches";
const CANDIDATE_TABLE = "pk_candidates";
const VOTE_TABLE = "pk_votes";
const MAX_BODY_BYTES = 64 * 1024;
const MATCH_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const SIDES = new Set(["left", "right"]);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

const matchCache = new Map();
const voteAttempts = new Map();

function requestId(req) {
  return String(req.headers["x-request-id"] || crypto.randomUUID()).slice(0, 128);
}

function responseHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-Id, X-CloudBase-Context",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, responseHeaders());
  res.end(JSON.stringify(payload));
}

function success(res, statusCode, data, rid) {
  sendJson(res, statusCode, { code: 0, message: "success", data, requestId: rid });
}

function failure(res, statusCode, code, message, rid) {
  sendJson(res, statusCode, { code, message, data: null, requestId: rid });
}

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

function httpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code || statusCode;
  return error;
}

function readPuid(req) {
  const raw = req.headers["x-cloudbase-context"];
  if (!raw) throw httpError(401, "请先登录", "UNAUTHORIZED");

  try {
    let buffer = Buffer.from(String(raw).trim(), "base64");
    if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
      buffer = zlib.gunzipSync(buffer);
    }
    const context = JSON.parse(buffer.toString("utf8"));
    const puid = context.customUserId || context.userId || context.uid;
    if (!puid) throw new Error("missing user id");
    const normalized = String(puid).trim();
    if (!normalized || normalized.length > 128) throw new Error("invalid user id");
    return normalized;
  } catch (error) {
    throw httpError(401, "登录状态无效，请重新登录", "UNAUTHORIZED");
  }
}

function validateMatchId(value) {
  const matchId = typeof value === "string" ? value.trim() : "";
  if (!MATCH_ID_PATTERN.test(matchId)) {
    throw httpError(400, "对阵 ID 格式不正确", "INVALID_MATCH_ID");
  }
  return matchId;
}

function validateProofUrl(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 2048) {
    throw httpError(400, "应援图地址格式不正确", "INVALID_PROOF_URL");
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
      throw new Error("invalid url");
    }
    return url.toString();
  } catch (error) {
    throw httpError(400, "应援图必须使用 HTTPS 地址", "INVALID_PROOF_URL");
  }
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw httpError(413, "请求内容过大", "BODY_TOO_LARGE");
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    throw httpError(400, "请求格式不正确", "INVALID_JSON");
  }
}

function candidateData(row) {
  return {
    side: row.side,
    name: row.name,
    description: row.description || "",
    imageUrl: row.image_url || null,
    voteCount: Number(row.vote_count || 0)
  };
}

function effectiveStatus(match) {
  const now = Date.now();
  if (match.status === "ended" || now >= new Date(match.ends_at).getTime()) return "ended";
  if (match.status === "draft" || match.status === "scheduled" || now < new Date(match.starts_at).getTime()) {
    return "scheduled";
  }
  return "live";
}

async function readMatch(matchId) {
  const cached = matchCache.get(matchId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const [matchResult, candidateResult] = await Promise.all([
    rdb.from(MATCH_TABLE)
      .select("id, title, description, starts_at, ends_at, status")
      .eq("id", matchId)
      .limit(1),
    rdb.from(CANDIDATE_TABLE)
      .select("side, name, description, image_url, vote_count")
      .eq("match_id", matchId)
      .order("side", { ascending: true })
      .limit(2)
  ]);
  const matches = queryRows(matchResult);
  if (!matches.length) throw httpError(404, "未找到该场对阵", "MATCH_NOT_FOUND");

  const candidates = queryRows(candidateResult).map(candidateData);
  if (candidates.length !== 2) {
    throw httpError(503, "对阵配置尚未完成", "MATCH_NOT_READY");
  }
  const row = matches[0];
  const value = {
    id: row.id,
    title: row.title,
    description: row.description || "",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: effectiveStatus(row),
    candidates
  };

  if (matchCache.size >= 100) matchCache.delete(matchCache.keys().next().value);
  matchCache.set(matchId, { value, expiresAt: Date.now() + 3000 });
  return value;
}

async function readResults(matchId) {
  const result = await rdb.from(CANDIDATE_TABLE)
    .select("side, vote_count")
    .eq("match_id", matchId)
    .order("side", { ascending: true })
    .limit(2);
  const rows = queryRows(result);
  if (rows.length !== 2) throw httpError(404, "未找到该场对阵", "MATCH_NOT_FOUND");

  const totalVotes = rows.reduce((sum, row) => sum + Number(row.vote_count || 0), 0);
  return {
    candidates: rows.map((row) => {
      const voteCount = Number(row.vote_count || 0);
      return {
        side: row.side,
        voteCount,
        percentage: totalVotes ? Math.round((voteCount / totalVotes) * 1000) / 10 : 0
      };
    }),
    totalVotes
  };
}

async function readMyVote(matchId, puid) {
  const result = await rdb.from(VOTE_TABLE)
    .select("side, proof_url, created_at")
    .eq("match_id", matchId)
    .eq("puid", puid)
    .limit(1);
  const rows = queryRows(result);
  if (!rows.length) return { voted: false, side: null, remaining: 1 };
  return {
    voted: true,
    side: rows[0].side,
    remaining: 0,
    proofUrl: rows[0].proof_url || null,
    votedAt: rows[0].created_at
  };
}

function enforceVoteRateLimit(puid) {
  const now = Date.now();
  const previous = voteAttempts.get(puid) || 0;
  if (now - previous < 1500) {
    throw httpError(429, "操作太频繁，请稍后再试", "RATE_LIMITED");
  }
  if (voteAttempts.size >= 10000) voteAttempts.clear();
  voteAttempts.set(puid, now);
}

async function getRdbServiceToken() {
  const credential = await app.auth().getClientCredential();
  if (typeof credential === "string" && credential.trim()) return credential.trim();
  if (credential && typeof credential.access_token === "string" && credential.access_token.trim()) {
    return credential.access_token.trim();
  }
  const accessKey = process.env.COLORBOX__ACCESS_KEY;
  if (accessKey && accessKey.trim()) return accessKey.trim();
  throw new Error("database credential unavailable");
}

function rpcFailure(data) {
  const errors = {
    INVALID_MATCH_ID: [400, "对阵 ID 格式不正确"],
    INVALID_SIDE: [400, "投票选项不正确"],
    INVALID_IDENTITY: [401, "请重新登录后投票"],
    INVALID_PROOF_URL: [400, "应援图地址格式不正确"],
    MATCH_NOT_FOUND: [404, "未找到该场对阵"],
    MATCH_NOT_STARTED: [409, "投票尚未开始"],
    MATCH_ENDED: [409, "投票已经结束"],
    ALREADY_VOTED: [409, "你已经投过票了"],
    CANDIDATE_NOT_FOUND: [409, "投票选项暂不可用"]
  };
  if (!data || !data.error || !errors[data.error]) return null;
  const [statusCode, message] = errors[data.error];
  return httpError(statusCode, message, data.error);
}

async function submitVote(puid, matchId, side, proofUrl) {
  const token = await getRdbServiceToken();
  const envId = process.env.CLOUDBASE_ENV_ID || process.env.TCB_ENV;
  if (!envId) throw new Error("CloudBase environment is missing");

  const response = await fetch(
    `https://${envId}.api.tcloudbasegateway.com/v1/rdb/rest/rpc/submit_pk_vote`,
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
        p_match_id: matchId,
        p_side: side,
        p_puid: puid,
        p_proof_url: proofUrl
      })
    }
  );
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch (error) { /* keep response private */ }
  if (!response.ok) {
    console.error("[PK Vote RPC Error]", response.status, data);
    throw httpError(500, "投票暂时无法提交", "VOTE_WRITE_FAILED");
  }
  const value = Array.isArray(data) ? data[0] : data;
  const businessError = rpcFailure(value);
  if (businessError) throw businessError;
  return value;
}

async function handle(req, res) {
  const rid = requestId(req);
  const startedAt = Date.now();

  if (req.method === "OPTIONS") {
    res.writeHead(204, responseHeaders());
    return res.end();
  }

  const path = apiPath(req);
  const url = new URL(req.url, "http://localhost");
  try {
    if (req.method === "GET" && path === "/health") {
      return success(res, 200, { status: "ok" }, rid);
    }

    const resultMatch = path.match(/^\/pk\/matches\/([^/]+)\/results$/);
    if (req.method === "GET" && resultMatch) {
      const matchId = validateMatchId(decodeURIComponent(resultMatch[1]));
      await readMatch(matchId);
      return success(res, 200, await readResults(matchId), rid);
    }

    const detailMatch = path.match(/^\/pk\/matches\/([^/]+)$/);
    if (req.method === "GET" && detailMatch) {
      const matchId = validateMatchId(decodeURIComponent(detailMatch[1]));
      return success(res, 200, { match: await readMatch(matchId) }, rid);
    }

    if (req.method === "GET" && path === "/pk/me") {
      const puid = readPuid(req);
      const matchId = validateMatchId(url.searchParams.get("matchId"));
      await readMatch(matchId);
      return success(res, 200, await readMyVote(matchId, puid), rid);
    }

    if (req.method === "POST" && path === "/pk/votes") {
      const puid = readPuid(req);
      enforceVoteRateLimit(puid);
      const body = await readJsonBody(req);
      const matchId = validateMatchId(body.matchId);
      const side = typeof body.side === "string" ? body.side : "";
      if (!SIDES.has(side)) throw httpError(400, "投票选项不正确", "INVALID_SIDE");
      const proofUrl = validateProofUrl(body.proofUrl);
      const data = await submitVote(puid, matchId, side, proofUrl);
      matchCache.delete(matchId);
      return success(res, 201, data, rid);
    }

    if (path === "/pk/votes" || path === "/pk/me" || path.startsWith("/pk/matches/")) {
      return failure(res, 405, "METHOD_NOT_ALLOWED", "请求方法不支持", rid);
    }
    return failure(res, 404, "NOT_FOUND", "接口不存在", rid);
  } catch (error) {
    const statusCode = Number(error.statusCode) || 500;
    const message = statusCode < 500 ? (error.message || "请求失败") : "服务暂时不可用";
    console.error(JSON.stringify({
      requestId: rid,
      path,
      statusCode,
      code: error.code || "INTERNAL_ERROR",
      message: error.message,
      durationMs: Date.now() - startedAt
    }));
    return failure(res, statusCode, error.code || statusCode, message, rid);
  }
}

http.createServer(handle).listen(process.env.PORT || 9000);
