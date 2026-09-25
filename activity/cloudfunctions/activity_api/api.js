"use strict";

const zlib = require("zlib");
const { validateSave, readJsonBody } = require("./save-core");
const SAVE_CHUNK_BYTES = 384 * 1024;

function apiPath(req) {
  const pathname = new URL(req.url, "http://localhost").pathname || "/";
  return pathname.replace(/^\/api(?=\/|$)/, "") || "/";
}

function readPuid(req) {
  const raw = req.headers["x-cloudbase-context"];
  if (!raw) throw Object.assign(new Error("unauthorized"), { statusCode: 401 });
  let buf = Buffer.from(String(raw).trim(), "base64");
  if (buf.length > 16384) throw Object.assign(new Error("invalid context"), { statusCode: 400 });
  try {
    if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
      buf = zlib.gunzipSync(buf, { maxOutputLength: 16384 });
    }
    if (buf.length > 16384) throw new Error("context too large");
    var ctx = JSON.parse(buf.toString("utf8"));
  } catch (error) {
    throw Object.assign(new Error("invalid context"), { statusCode: 400 });
  }
  const puid = ctx.customUserId || ctx.userId || ctx.uid;
  if (!puid) throw Object.assign(new Error("unauthorized"), { statusCode: 401 });
  return String(puid);
}

function createHandler(store) {
  if (!store || !store.getSave || !store.upsertSave) throw new Error("save store required");
  return async function handle(req, res) {
    const headers = {
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-Id, X-CloudBase-Context",
      "Content-Type": "application/json; charset=utf-8"
    };
    function send(status, payload) {
      const body = Buffer.from(JSON.stringify(payload));
      if (body.length > 64 * 1024 && /\bgzip\b/i.test(req.headers["accept-encoding"] || "")) {
        headers["Content-Encoding"] = "gzip";
        headers.Vary = "Accept-Encoding";
        res.writeHead(status, headers);
        res.end(zlib.gzipSync(body));
        return;
      }
      res.writeHead(status, headers);
      res.end(body);
    }
    if (req.method === "OPTIONS") return send(204, {});
    try {
      const path = apiPath(req);
      if (req.method === "GET" && path === "/health") return send(200, { code: 0, message: "ok" });
      if (req.method === "GET" && path === "/my/save") {
        const row = await store.getSave(readPuid(req));
        if (!row || !row.saveJson || Buffer.byteLength(row.saveJson, "utf8") <= SAVE_CHUNK_BYTES) {
          return send(200, { code: 0, message: "success", data: row || null });
        }
        const query = new URL(req.url, "http://localhost").searchParams;
        const rawPart = query.get("part");
        const part = rawPart === null ? 0 : Number(rawPart);
        const bytes = Buffer.from(row.saveJson, "utf8");
        const count = Math.ceil(bytes.length / SAVE_CHUNK_BYTES);
        if (!Number.isSafeInteger(part) || part < 0 || part >= count) {
          return send(400, { code: 400, message: "invalid save part" });
        }
        if (part > 0 && Number(query.get("revision")) !== Number(row.revision)) {
          return send(409, { code: 409, message: "save changed during read" });
        }
        return send(200, { code: 0, message: "success", data: {
          companyName: row.companyName, year: row.year, month: row.month,
          phase: row.phase, revision: row.revision, updatedAt: row.updatedAt,
          saveJson: null, saveChunks: count, chunkIndex: part,
          saveChunk: bytes.subarray(part * SAVE_CHUNK_BYTES, (part + 1) * SAVE_CHUNK_BYTES).toString("base64")
        } });
      }
      if (req.method === "POST" && path === "/save/upsert") {
        const puid = readPuid(req);
        const save = validateSave(await readJsonBody(req));
        const result = await store.upsertSave(puid, save);
        if (result.conflicted) return send(409, { code: 409, message: "save conflict" });
        return send(200, { code: 0, message: "success", data: {
          revision: Number(result.revision), updatedAt: result.updatedAt
        } });
      }
      return send(404, { code: 404, message: "not found" });
    } catch (error) {
      const status = error.statusCode || 500;
      if (status >= 500) console.error("[Activity API Error]", error);
      return send(status, {
        code: status,
        message: status < 500 ? error.message || "bad request" : "internal server error"
      });
    }
  };
}

module.exports = { createHandler, readPuid };
