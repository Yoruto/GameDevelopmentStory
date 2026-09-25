"use strict";

const MAX_SAVE_BYTES = 2 * 1024 * 1024;
const MAX_BODY_BYTES = Math.ceil(2.5 * 1024 * 1024);
const SAVE_VERSION = 10;

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateSave(body) {
  if (!body || typeof body !== "object") throw httpError("invalid body", 400);
  if (typeof body.saveJson !== "string") throw httpError("invalid save", 400);
  if (Buffer.byteLength(body.saveJson, "utf8") > MAX_SAVE_BYTES) throw httpError("save too large", 413);
  let state;
  try { state = JSON.parse(body.saveJson); } catch (e) { throw httpError("invalid save JSON", 400); }
  if (!state || state.mode !== "career" || state.saveVersion !== SAVE_VERSION ||
      !state.career || typeof state.career !== "object" || Array.isArray(state.career) ||
      typeof state.career.characterName !== "string" || typeof state.career.roleId !== "string" ||
      !state.company || typeof state.company !== "object" ||
      !Number.isSafeInteger(state.rngSeed) || !Number.isSafeInteger(state.rngCount)) {
    throw httpError("unsupported save", 400);
  }
  const year = Number(body.year);
  const month = Number(body.month);
  const phase = body.phase;
  const normalDate = Number.isInteger(year) && year >= 1995 && year <= 2025 &&
    Number.isInteger(month) && month >= 1 && month <= 12;
  const settledDate = year === 2026 && month === 1 && phase === "SETTLED";
  if ((!normalDate && !settledDate) || !["OFFER", "PLAYING", "SETTLED"].includes(phase) ||
      state.year !== year || state.month !== month || state.phase !== phase) {
    throw httpError("invalid save date or phase", 400);
  }
  const expectedRevision = Number(body.expectedRevision);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw httpError("invalid revision", 400);
  }
  return {
    companyName: String(body.companyName || state.career.characterName || "").slice(0, 32),
    year, month, phase, saveJson: body.saveJson, expectedRevision
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let done = false;
    req.on("data", (chunk) => {
      if (done) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        done = true;
        reject(httpError("request too large", 413));
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (done) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
      catch (e) { reject(httpError("invalid JSON", 400)); }
    });
    req.on("error", reject);
  });
}

module.exports = { MAX_SAVE_BYTES, MAX_BODY_BYTES, validateSave, readJsonBody };
