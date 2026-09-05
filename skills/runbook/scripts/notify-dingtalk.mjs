#!/usr/bin/env node
/**
 * Send an audit notification via ai-game service after activity deployment.
 * ai-game service holds the DingTalk robot token and pushes to the robot webhook.
 *
 * Usage:
 *   node skills/runbook/scripts/notify-dingtalk.mjs [manifestPath]
 *
 * Requires Node.js 20+. No npm dependencies.
 * Endpoint resolution order:
 *   1. DINGTALK_NOTIFY_URL / ICEBERG_API_URL env (full URL override)
 *   2. icebergServerUrl from meta.json/credentials.json (legacy Iceberg backend, backward compatible)
 *   3. AI_GAME_SERVER_URL env
 *   4. ai-game service base URL baked in at skill package time
 *   5. http://127.0.0.1:3301 (local ai-game service dev)
 * The shaper token is also baked in at skill package time;
 * scripts never read credentials.json to resolve the token.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_MANIFEST = "activity/activity.manifest.json";
const DEFAULT_AI_GAME_SERVICE_URL = "http://127.0.0.1:3301";
const PACKAGED_API_BASE = "https://shaper.hupu.com";
const PACKAGED_SHAPER_TOKEN = "shaper_tk_283a5bfdbd1b1d10fcd5bf92d573d1a96aa5d61b908b7f933922bdc78d372f75";
const PACKAGED_PROJECT_ID = "app_3c72f55c0c";
const DINGTALK_NOTIFY_PATH = "/api/ai-code/capabilities/cloudbase/dingtalk-notify";
const EVENT_PATH = "/api/ai-code/capabilities/cloudbase/event";
const TIMEOUT_MS = 5_000;

function trimBase(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function isPackagedBase() {
  return (
    typeof PACKAGED_API_BASE === "string" &&
    (PACKAGED_API_BASE.startsWith("http://") || PACKAGED_API_BASE.startsWith("https://"))
  );
}

function packagedProjectId() {
  const raw = typeof PACKAGED_PROJECT_ID === "string" ? PACKAGED_PROJECT_ID.trim() : "";
  if (!raw || raw.startsWith("__") || raw === "workspace" || /[\s/]/.test(raw)) return "";
  return raw;
}

function resolveBaseAndUrls(payload) {
  const notifyOverride =
    process.env.DINGTALK_NOTIFY_URL?.trim() || process.env.ICEBERG_API_URL?.trim();
  if (notifyOverride) {
    return {
      base: null,
      notifyUrl: notifyOverride,
      eventUrl: notifyOverride.replace(/\/dingtalk-notify$/, "/event"),
    };
  }

  // Legacy Iceberg backend (old workspaces with icebergServerUrl in meta.json).
  if (payload?.icebergServerUrl && !process.env.AI_GAME_SERVER_URL?.trim() && !isPackagedBase()) {
    const base = trimBase(payload.icebergServerUrl);
    return {
      base,
      notifyUrl: `${base}/api/dingtalk/notify`,
      eventUrl: `${base}${EVENT_PATH}`,
    };
  }

  const base = process.env.AI_GAME_SERVER_URL?.trim()
    ? trimBase(process.env.AI_GAME_SERVER_URL)
    : isPackagedBase()
      ? trimBase(PACKAGED_API_BASE)
      : DEFAULT_AI_GAME_SERVICE_URL;
  return {
    base,
    notifyUrl: `${base}${DINGTALK_NOTIFY_PATH}`,
    eventUrl: `${base}${EVENT_PATH}`,
  };
}

function resolveShaperToken() {
  if (process.env.SHAPER_TOKEN?.trim()) {
    return process.env.SHAPER_TOKEN.trim();
  }
  return typeof PACKAGED_SHAPER_TOKEN === "string" &&
    PACKAGED_SHAPER_TOKEN.startsWith("shaper_tk_")
    ? PACKAGED_SHAPER_TOKEN.trim()
    : "";
}

function readJson(path) {
  const text = readFileSync(path, "utf8");
  return JSON.parse(text);
}

function asString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function resolveMetaPath(manifestPath) {
  const candidates = [
    resolve(process.cwd(), "credentials.json"),
    resolve(process.cwd(), "activity.json"),
    resolve(process.cwd(), "meta.json"),
    resolve(dirname(manifestPath), "..", "meta.json"),
    resolve(dirname(manifestPath), "meta.json"),
  ];
  for (const candidate of candidates) {
    try {
      readFileSync(candidate, "utf8");
      return candidate;
    } catch {
      // try next
    }
  }
  return null;
}

function loadAuditPayload(manifestPath) {
  const manifest = readJson(manifestPath);
  const activityName =
    asString(manifest.activityName) ??
    asString(manifest.activity?.name) ??
    null;

  let metaActivityId = asString(manifest.metaActivityId);
  let resolvedActivityName = activityName;
  let icebergServerUrl = asString(manifest.icebergServerUrl);
  metaActivityId = metaActivityId ?? packagedProjectId();

  const metaPath = resolveMetaPath(manifestPath);
  if (metaPath) {
    try {
      const meta = readJson(metaPath);
      metaActivityId = metaActivityId ?? asString(meta.activityId);
      resolvedActivityName =
        resolvedActivityName ?? asString(meta.activityName);
      icebergServerUrl = icebergServerUrl ?? asString(meta.icebergServerUrl);
    } catch {
      // manifest alone is enough
    }
  }

  return {
    activityId: metaActivityId,
    activityName: resolvedActivityName,
    alias: asString(manifest.alias),
    envId: asString(manifest.envId),
    status: asString(manifest.activity?.status),
    publicBaseUrl: asString(manifest.publicBaseUrl),
    tables: asStringArray(manifest.resources?.tables),
    functions: asStringArray(manifest.resources?.functions),
    routes: asStringArray(manifest.resources?.routes),
    verificationOk: manifest.verification?.ok === true,
    manifestPath,
    icebergServerUrl,
  };
}

function shouldNotify(payload) {
  if (!payload.verificationOk) {
    return { notify: false, reason: "verification.ok is not true" };
  }
  if (payload.status && payload.status !== "verified") {
    return {
      notify: false,
      reason: `activity.status is "${payload.status}", expected "verified"`,
    };
  }
  if (!payload.activityId) {
    return { notify: false, reason: "metaActivityId is missing" };
  }
  return { notify: true };
}

async function notifyViaService(notifyUrl, eventUrl, payload) {
  const shaperToken = resolveShaperToken();
  const headers = { "content-type": "application/json" };
  if (shaperToken) {
    headers["X-Shaper-Token"] = shaperToken;
  }

  const response = await fetch(notifyUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `ai-game notification service returned HTTP ${response.status} ${response.statusText}`,
    );
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("ai-game notification service returned invalid JSON");
  }

  if (!result || !(result.ok === true || result.success === true)) {
    throw new Error(result?.error || result?.message || "Unknown service error");
  }

  // 同步发送事件给 ai-game 服务事件接口，打通项目云服务与审计看板
  try {
    await fetch(eventUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        activityId: payload.activityId,
        activityName: payload.activityName,
        alias: payload.alias,
        envId: payload.envId,
        eventType: "verification_completed",
        tables: payload.tables,
        functions: payload.functions,
        routes: payload.routes,
        verificationOk: payload.verificationOk,
        status: payload.status,
        publicBaseUrl: payload.publicBaseUrl,
        apiKey: payload.apiKey,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch(() => {});
  } catch {}

  return result;
}

function printJson(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function fail(message, details) {
  printJson({ ok: false, error: message, ...details });
  process.exit(1);
}

async function main() {
  const manifestArg = process.argv[2];
  const manifestPath = resolve(
    process.cwd(),
    manifestArg && !manifestArg.startsWith("-")
      ? manifestArg
      : DEFAULT_MANIFEST,
  );

  let payload;
  try {
    payload = loadAuditPayload(manifestPath);
  } catch (error) {
    fail("failed to read manifest", {
      manifestPath,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const gate = shouldNotify(payload);
  if (!gate.notify) {
    printJson({ ok: true, skipped: true, reason: gate.reason, manifestPath });
    return;
  }

  const { notifyUrl, eventUrl } = resolveBaseAndUrls(payload);

  try {
    const res = await notifyViaService(notifyUrl, eventUrl, payload);
    printJson({
      ok: true,
      skipped: res.skipped ?? false,
      activityId: payload.activityId,
      notifyUrl,
      manifestPath,
    });
  } catch (error) {
    fail("DingTalk notification failed via ai-game service", {
      manifestPath,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    fail("unexpected error", {
      message: error instanceof Error ? error.message : String(error),
    });
  });
}
