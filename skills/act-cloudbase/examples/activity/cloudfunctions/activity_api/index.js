const http = require("http");
const zlib = require("zlib");
const tcb = require("@cloudbase/node-sdk");

const accessKey = process.env.COLORBOX__ACCESS_KEY;

const app = tcb.init({
  env: process.env.CLOUDBASE_ENV_ID || process.env.TCB_ENV,
  accessKey: accessKey
});
const rdb = app.rdb({ database: "public" });

// 剥离网关前缀 /api
function apiPath(req) {
  const pathname = new URL(req.url, "http://localhost").pathname || "/";
  return pathname.replace(/^\/api(?=\/|$)/, "") || "/";
}

// 网关 enableAuth: true 时，从上下文读取用户 puid
function readPuid(req) {
  const raw = req.headers["x-cloudbase-context"];
  if (!raw) {
    const err = new Error("unauthorized");
    err.statusCode = 401;
    throw err;
  }
  let buf = Buffer.from(String(raw).trim(), "base64");
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    buf = zlib.gunzipSync(buf);
  }
  const ctx = JSON.parse(buf.toString("utf8"));
  const puid = ctx.customUserId || ctx.userId || ctx.uid;
  if (!puid) {
    const err = new Error("unauthorized");
    err.statusCode = 401;
    throw err;
  }
  return String(puid);
}

// 解析 JSON Body
function getJsonBody(req) {
  return new Promise(resolve => {
    let data = "";
    req.on("data", chunk => data += chunk);
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); }
    });
  });
}

// 兼容 rdb 返回结构，统一取行数组
function queryRows(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.rows)) return result.rows;
  return [];
}

// TTL 内存微缓存助手 (用于公开读高频接口，削减高并发数据库读负载)
function createMemoryCache(ttlMs = 5000) {
  let cacheData = null;
  let lastFetchTime = 0;
  return (fetcher) => async () => {
    const now = Date.now();
    if (cacheData && (now - lastFetchTime < ttlMs)) {
      return cacheData;
    }
    cacheData = await fetcher();
    lastFetchTime = now;
    return cacheData;
  };
}

const getDemoListCached = createMemoryCache(5000)(async () => {
  const result = await rdb
    .from("demo_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  return queryRows(result);
});

async function handle(req, res) {
  // CORS：Access-Control-Allow-Origin 由网关按安全域名白名单统一注入，函数禁止自设
  const cors = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-Id, X-CloudBase-Context",
    "Content-Type": "application/json; charset=utf-8"
  };

  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    return res.end();
  }

  const path = apiPath(req);

  try {
    // 1. 健康检查 (公开读, enableAuth: false)
    if (req.method === "GET" && path === "/health") {
      res.writeHead(200, cors);
      return res.end(JSON.stringify({ code: 0, message: "ok" }));
    }

    // 2. 公开读：demo 列表 (enableAuth: false，5 秒 TTL 读缓存兜底)
    if (req.method === "GET" && path === "/demo/list") {
      const data = await getDemoListCached();
      res.writeHead(200, cors);
      return res.end(JSON.stringify({ code: 0, message: "success", data }));
    }

    // 3. 用户写：demo 提交 (网关 enableAuth: true 注入上下文)
    if (req.method === "POST" && path === "/demo/submit") {
      const puid = readPuid(req);
      const body = await getJsonBody(req);

      const record = {
        puid: puid,
        title: body.title || "无标题",
        content: body.content || "",
        created_at: new Date().toISOString()
      };

      const { data: dbData, error: dbError } = await rdb.from("demo_items").insert([record]);
      if (dbError) {
        const err = new Error(`Database Insert Failed: ${dbError.message || JSON.stringify(dbError)}`);
        err.statusCode = 500;
        throw err;
      }

      res.writeHead(200, cors);
      return res.end(JSON.stringify({ code: 0, message: "success", data: record }));
    }

    res.writeHead(404, cors);
    return res.end(JSON.stringify({ code: 404, message: "not found" }));
  } catch (err) {
    console.error("[Activity API Error]", err);
    const statusCode = err.statusCode || 500;
    // 4xx 业务/鉴权异常保留友善提示，5xx 内部/数据库错误统一脱敏，防止泄露底层 SQL 与敏感结构
    const userMessage = statusCode < 500 ? (err.message || "bad request") : "internal server error";
    res.writeHead(statusCode, cors);
    return res.end(JSON.stringify({ code: statusCode, message: userMessage }));
  }
}

http.createServer(handle).listen(process.env.PORT || 9000);
