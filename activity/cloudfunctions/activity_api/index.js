const http = require("http");
const tcb = require("@cloudbase/node-sdk");
const zlib = require("zlib");

const app = tcb.init({
  env: process.env.CLOUDBASE_ENV_ID,
  accessKey: process.env.COLORBOX__ACCESS_KEY,
});
const rdb = app.rdb({ database: "public" });

function apiPath(req) {
  const pathname = new URL(req.url, "http://localhost").pathname || "/";
  return pathname.replace(/^\/api(?=\/|$)/, "") || "/";
}

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

function getJsonBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

function clampSave(body) {
  const year = Number(body.year);
  const month = Number(body.month);
  if (!Number.isInteger(year) || year < 2015 || year > 2026) {
    const err = new Error("invalid year");
    err.statusCode = 400;
    throw err;
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    const err = new Error("invalid month");
    err.statusCode = 400;
    throw err;
  }
  const phase = String(body.phase || "PLAYING").slice(0, 32);
  const companyName = String(body.companyName || "喵扑studio").slice(0, 32);
  const saveJson = typeof body.saveJson === "string" ? body.saveJson : JSON.stringify(body.saveJson || {});
  if (saveJson.length > 180000) {
    const err = new Error("save too large");
    err.statusCode = 400;
    throw err;
  }
  return { companyName, year, month, phase, saveJson };
}

async function handle(req, res) {
  const cors = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-Id, X-CloudBase-Context",
    "Content-Type": "application/json; charset=utf-8",
  };

  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    return res.end();
  }

  const path = apiPath(req);

  try {
    if (req.method === "GET" && path === "/health") {
      res.writeHead(200, cors);
      return res.end(JSON.stringify({ code: 0, message: "ok" }));
    }

    if (req.method === "GET" && path === "/my/save") {
      const puid = readPuid(req);
      const result = await rdb
        .from("game_saves")
        .select("company_name,year,month,phase,save_json,updated_at")
        .eq("puid", puid)
        .limit(1);
      if (result.error) {
        const err = new Error("Database Query Failed");
        err.statusCode = 500;
        throw err;
      }
      const row = (result.data && result.data[0]) || null;
      res.writeHead(200, cors);
      return res.end(
        JSON.stringify({
          code: 0,
          message: "success",
          data: row
            ? {
                companyName: row.company_name,
                year: row.year,
                month: row.month,
                phase: row.phase,
                saveJson: row.save_json,
                updatedAt: row.updated_at,
              }
            : null,
        })
      );
    }

    if (req.method === "POST" && path === "/save/upsert") {
      const puid = readPuid(req);
      const body = await getJsonBody(req);
      const save = clampSave(body);
      const record = {
        puid: puid,
        company_name: save.companyName,
        year: save.year,
        month: save.month,
        phase: save.phase,
        save_json: save.saveJson,
        updated_at: new Date().toISOString(),
      };
      const { error: dbError } = await rdb.from("game_saves").upsert([record], { onConflict: "puid" });
      if (dbError) {
        const err = new Error("Database Upsert Failed");
        err.statusCode = 500;
        throw err;
      }
      res.writeHead(200, cors);
      return res.end(JSON.stringify({ code: 0, message: "success" }));
    }

    res.writeHead(404, cors);
    return res.end(JSON.stringify({ code: 404, message: "not found" }));
  } catch (err) {
    console.error("[Activity API Error]", err);
    const statusCode = err.statusCode || 500;
    const userMessage = statusCode < 500 ? err.message || "bad request" : "internal server error";
    res.writeHead(statusCode, cors);
    return res.end(JSON.stringify({ code: statusCode, message: userMessage }));
  }
}

http.createServer(handle).listen(process.env.PORT || 9000);
