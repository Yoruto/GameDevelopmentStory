#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");
const zlib = require("node:zlib");
const { createHandler } = require("../activity/cloudfunctions/activity_api/api");
const { validateSave, MAX_SAVE_BYTES, MAX_BODY_BYTES } = require("../activity/cloudfunctions/activity_api/save-core");
const harness = require("./_harness").createContext();

function stateAt(year, month, phase) {
  const state = harness.sim.createCareerGame("测试", "programmer", harness.config);
  state.year = year;
  state.month = month;
  state.phase = phase;
  return state;
}

function bodyFor(state, revision) {
  return { companyName: "测试", year: state.year, month: state.month,
    phase: state.phase, saveJson: JSON.stringify(state), expectedRevision: revision };
}

function invoke(handler, method, url, body, uid, extraHeaders) {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = url;
    req.headers = { ...(uid ? { "x-cloudbase-context": Buffer.from(JSON.stringify({ customUserId: uid })).toString("base64") } : {}), ...(extraHeaders || {}) };
    req.resume = function () {};
    const res = {
      status: 0,
      writeHead: function (status, headers) { this.status = status; this.headers = headers || {}; },
      end: function (text) {
        try {
          const encoded = Buffer.isBuffer(text) ? text : Buffer.from(text || "");
          const decoded = this.headers["Content-Encoding"] === "gzip" ? zlib.gunzipSync(encoded) : encoded;
          resolve({ status: this.status, body: decoded.length ? JSON.parse(decoded.toString("utf8")) : null,
            headers: this.headers });
        }
        catch (error) { reject(error); }
      }
    };
    Promise.resolve(handler(req, res)).catch(reject);
    process.nextTick(() => {
      if (body !== undefined) req.emit("data", Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body)));
      req.emit("end");
    });
  });
}

function makeStore() {
  const rows = new Map();
  return {
    getSave: async (uid) => rows.get(uid) || null,
    upsertSave: async (uid, save) => {
      const old = rows.get(uid);
      if ((old ? old.revision : 0) !== save.expectedRevision) return { conflicted: true };
      const revision = save.expectedRevision + 1;
      const updatedAt = new Date().toISOString();
      rows.set(uid, { saveJson: save.saveJson, year: save.year, month: save.month,
        phase: save.phase, revision, updatedAt });
      return { conflicted: false, revision, updatedAt };
    }
  };
}

function makeBridge(cache, server, online) {
  return {
    canCloud: () => online.value,
    storageSet: async (value) => { cache.value = JSON.parse(JSON.stringify(value)); return true; },
    storageGet: async () => cache.value,
    cloudGetSave: async () => server.row,
    cloudPutSave: async (state, expectedRevision) => {
      if (server.fail) throw new Error("offline");
      if ((server.row ? server.row.revision : 0) !== expectedRevision) {
        const error = new Error("conflict"); error.code = 409; throw error;
      }
      const revision = expectedRevision + 1;
      server.row = { saveJson: JSON.stringify(state), revision, updatedAt: new Date().toISOString() };
      return { revision, updatedAt: server.row.updatedAt };
    }
  };
}

function makePort(bridge) {
  const root = { GDS: { bridge }, Date, Promise, Number, console };
  root.globalThis = root;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../h5/js/save/port.js"), "utf8"), root);
  return root.GDS.save;
}

async function main() {
  let count = 0;
  for (const [year, month, phase] of [[1995, 1, "OFFER"], [2005, 6, "PLAYING"],
    [2025, 12, "PLAYING"], [2026, 1, "SETTLED"]]) {
    const state = stateAt(year, month, phase);
    assert.equal(validateSave(bodyFor(state, 0)).year, year);
    count++;
  }
  assert.throws(() => validateSave({ ...bodyFor(stateAt(1995, 1, "OFFER"), 0), year: 2015 }), /date/);
  assert.throws(() => validateSave({ ...bodyFor(stateAt(1995, 1, "OFFER"), 0), expectedRevision: -1 }), /revision/);
  assert.throws(() => validateSave({ ...bodyFor(stateAt(1995, 1, "OFFER"), 0), saveJson: "{" }), /JSON/);
  assert.throws(() => validateSave({ ...bodyFor(stateAt(1995, 1, "OFFER"), 0), saveJson: "x".repeat(MAX_SAVE_BYTES + 1) }), /large/);
  count += 4;
  const sized = stateAt(2025, 12, "PLAYING");
  sized.padding = "";
  const overhead = Buffer.byteLength(JSON.stringify(sized), "utf8");
  sized.padding = "x".repeat(MAX_SAVE_BYTES - overhead);
  const atLimit = bodyFor(sized, 0);
  assert.equal(Buffer.byteLength(atLimit.saveJson, "utf8"), MAX_SAVE_BYTES);
  assert.equal(validateSave(atLimit).year, 2025);
  sized.padding += "x";
  assert.throws(() => validateSave(bodyFor(sized, 0)), /large/);
  count += 3;

  const store = makeStore();
  const handler = createHandler(store);
  const opening = stateAt(1995, 1, "OFFER");
  assert.equal((await invoke(handler, "GET", "/my/save", undefined, null)).status, 401);
  assert.equal((await invoke(handler, "POST", "/save/upsert", bodyFor(opening, 0), "u1")).body.data.revision, 1);
  assert.equal((await invoke(handler, "GET", "/my/save", undefined, "u1")).body.data.revision, 1);
  assert.equal((await invoke(handler, "POST", "/save/upsert", bodyFor(opening, 0), "u1")).status, 409);
  assert.equal((await invoke(handler, "POST", "/save/upsert", bodyFor(stateAt(2005, 6, "PLAYING"), 1), "u1")).body.data.revision, 2);
  assert.equal((await invoke(handler, "POST", "/save/upsert", bodyFor(stateAt(2025, 12, "PLAYING"), 2), "u1")).body.data.revision, 3);
  assert.equal((await invoke(handler, "POST", "/save/upsert", bodyFor(stateAt(2026, 1, "SETTLED"), 3), "u1")).body.data.revision, 4);
  assert.equal(JSON.parse((await invoke(handler, "GET", "/my/save", undefined, "u1")).body.data.saveJson).phase, "SETTLED");
  const minimumBody = Buffer.from(JSON.stringify(bodyFor(opening, 0)));
  const exactBody = Buffer.concat([minimumBody, Buffer.alloc(MAX_BODY_BYTES - minimumBody.length, 0x20)]);
  assert.equal((await invoke(handler, "POST", "/save/upsert", exactBody, "u1")).status, 409);
  assert.equal((await invoke(handler, "POST", "/save/upsert", Buffer.alloc(MAX_BODY_BYTES + 1), "u1")).status, 413);
  count += 10;
  assert.equal((await invoke(handler, "POST", "/save/upsert", atLimit, "u1")).status, 409);
  const zippedStore = makeStore();
  const zippedHandler = createHandler(zippedStore);
  assert.equal((await invoke(zippedHandler, "POST", "/save/upsert", atLimit, "u2")).status, 200);
  const zipped = await invoke(zippedHandler, "GET", "/my/save", undefined, "u2", { "accept-encoding": "gzip" });
  assert.equal(zipped.headers["Content-Encoding"], "gzip");
  assert.equal(zipped.body.data.saveJson, null);
  assert.equal(zipped.body.data.saveChunks, Math.ceil(MAX_SAVE_BYTES / (384 * 1024)));
  const fakeWindow = { GDS: {}, ACTIVITY_API_BASE: "https://test", ACTIVITY_ENV_ID: "test",
    TextDecoder, atob };
  fakeWindow.window = fakeWindow;
  fakeWindow.ColorboxAI = { cloud: {
    auth: async () => ({ code: 200 }),
    request: async ({ url, method }) => {
      const response = await invoke(zippedHandler, method, url, undefined, "u2");
      return { statusCode: response.status, code: response.body.code,
        data: response.body.data, message: response.body.message };
    }
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../h5/js/bridge/colorbox.js"), "utf8"), fakeWindow);
  assert.equal((await fakeWindow.GDS.bridge.auditText("测试名字")).ok, false);
  fakeWindow.ACTIVITY_API_BASE = "";
  assert.equal((await fakeWindow.GDS.bridge.auditText("测试名字")).preview, true);
  fakeWindow.ACTIVITY_API_BASE = "https://test";
  fakeWindow.ColorboxAI.security = { checkAudit: async () => ({ code: 200, data: true }) };
  assert.equal((await fakeWindow.GDS.bridge.auditText("测试名字")).ok, true);
  const assembled = await fakeWindow.GDS.bridge.cloudGetSave();
  assert.equal(Buffer.byteLength(assembled.saveJson), MAX_SAVE_BYTES);
  assert.equal(JSON.parse(assembled.saveJson).year, 2025);
  assert.equal((await invoke(zippedHandler, "GET", "/my/save?part=1&revision=0", undefined, "u2")).status, 409);
  count += 11;

  const cache = { value: null }, server = { row: null, fail: false }, online = { value: false };
  const port = makePort(makeBridge(cache, server, online));
  await port.persist(opening);
  assert.equal(port.status().kind, "local");
  assert.equal(cache.value.state.year, 1995);
  online.value = true;
  await port.retry();
  assert.equal(port.status().kind, "saved");
  assert.equal(server.row.revision, 1);
  count += 4;

  server.fail = true;
  await port.persist(stateAt(2005, 6, "PLAYING"));
  assert.equal(port.status().kind, "error");
  assert.equal(cache.value.state.year, 2005);
  server.fail = false;
  await port.retry();
  assert.equal(server.row.revision, 2);
  const restored = makePort(makeBridge(cache, server, online));
  assert.equal((await restored.restoreOrNull()).year, 2005);
  count += 4;

  online.value = false;
  await port.persist(stateAt(2025, 12, "PLAYING"));
  server.row.revision = 3;
  online.value = true;
  const conflicting = makePort(makeBridge(cache, server, online));
  assert.equal((await conflicting.restoreOrNull()).year, 2025);
  assert.equal(conflicting.status().kind, "conflict");
  assert.equal(server.row.revision, 3);
  count += 3;
  assert.equal((await conflicting.loadCloud()).year, 2005);
  assert.equal(conflicting.status().kind, "saved");
  assert.equal(cache.value.state.year, 2005);
  count += 3;

  const rapidCache = { value: null }, rapidServer = { row: null, fail: false };
  const rapid = makePort(makeBridge(rapidCache, rapidServer, { value: true }));
  await Promise.all([rapid.persist(stateAt(1995, 1, "OFFER")),
    rapid.persist(stateAt(2005, 6, "PLAYING")),
    rapid.persist(stateAt(2025, 12, "PLAYING"))]);
  assert.equal(rapidServer.row.revision, 1);
  assert.equal(JSON.parse(rapidServer.row.saveJson).year, 2025);
  assert.equal(rapidCache.value.state.year, 2025);
  count += 3;

  const restartCache = { value: null }, restartServer = { row: null, fail: false };
  const offline = { value: false };
  const restartPort = makePort(makeBridge(restartCache, restartServer, offline));
  await restartPort.persist(stateAt(2005, 6, "PLAYING"));
  await restartPort.persist(stateAt(1995, 1, "OFFER"));
  const afterRefresh = makePort(makeBridge(restartCache, restartServer, offline));
  assert.equal((await afterRefresh.restoreOrNull()).year, 1995);
  assert.equal(restartCache.value.pending, true);
  offline.value = true;
  await afterRefresh.retry();
  assert.equal(JSON.parse(restartServer.row.saveJson).year, 1995);
  count += 3;

  const settledCache = { value: null }, settledServer = { row: null, fail: false };
  const settledBridge = makeBridge(settledCache, settledServer, { value: true });
  const settledPort = makePort(settledBridge);
  await settledPort.persist(stateAt(2026, 1, "SETTLED"));
  assert.equal((await makePort(settledBridge).restoreOrNull()).phase, "SETTLED");
  count++;

  const badCache = { value: { saveVersion: 9, mode: "career" } };
  const bad = makePort(makeBridge(badCache, { row: null }, { value: false }));
  assert.equal(await bad.restoreOrNull(), null);
  assert.match(bad.restoreIssue(), /旧版|损坏/);
  assert.equal(badCache.value.saveVersion, 9);
  count += 3;
  const broken = makePort(makeBridge({ value: { corruptLocalSave: true } },
    { row: null }, { value: false }));
  assert.equal(await broken.restoreOrNull(), null);
  assert.match(broken.restoreIssue(), /损坏/);
  count += 2;
  console.log(`${count} save checks passed`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
