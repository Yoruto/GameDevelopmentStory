#!/usr/bin/env node
/**
 * 开通/复用活动 CloudBase 环境并写回凭据（唯一写入口：只负责开通，不提供查询模式）。
 *
 *   node skills/act-cloudbase/scripts/create-cloudbase.js [--force]
 *
 * - 全部参数（projectId / alias / shaperToken / 后台地址）在技能包打包时已写死进脚本，
 *   零参数固定执行：AI 无需传参、无需读环境变量
 * - 技能包未绑定活动（PACKAGED_PROJECT_ID 占位符未替换）时直接报错退出，
 *   绝不使用默认身份（如 workspace）误开通云环境
 *
 * - 固定行为（复用判断是开通流程的一部分，不是查询服务）：
 *   已有且已激活：直接复用并写回凭据；
 *   无环境：调用后台 POST /api/v1/cloudbase/projects/:projectId/activate 开通，轮询直至 activated
 * - 开通是真实变更，运行前必须先获得开发者确认（runbook deploy 阶段门禁）
 * - 只读查询请用 query-cloudbase.js；本脚本拒绝所有非开通参数（如 --check），未知参数直接报错退出
 * - projectId 与 shaperToken 在技能包打包时已写死进脚本（PACKAGED_PROJECT_ID / PACKAGED_SHAPER_TOKEN），
 *   无需传参、无需读 activity.json / credentials.json 解析身份
 * - 后台地址在技能包打包时已按环境写死（DEFAULT_API），无需传参、无需读环境变量
 */
const fs = require("fs");
const path = require("path");

/** 后台地址：技能包打包时按环境替换为固定字符串，AI 无需关心环境 */
const DEFAULT_API = "https://shaper.hupu.com";
/** 活动 ID：技能包打包时替换为实际 projectId */
const PACKAGED_PROJECT_ID = "app_3c72f55c0c";
/** 代理 token：技能包打包时替换为实际 shaperToken */
const PACKAGED_SHAPER_TOKEN = "shaper_tk_283a5bfdbd1b1d10fcd5bf92d573d1a96aa5d61b908b7f933922bdc78d372f75";

const POLL_INTERVAL_SEC = 10;
const POLL_TIMEOUT_SEC = 600;

function readJsonCandidates(candidates) {
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, "utf8"));
      }
    } catch {}
  }
  return null;
}

function readCredentials() {
  return readJsonCandidates([
    path.resolve(process.cwd(), "credentials.json"),
    path.resolve(process.cwd(), "..", "credentials.json"),
  ]) || {};
}

function readActivity() {
  return readJsonCandidates([
    path.resolve(process.cwd(), "activity.json"),
    path.resolve(process.cwd(), "..", "activity.json"),
  ]) || {};
}

function packagedProjectId() {
  const raw = typeof PACKAGED_PROJECT_ID === "string" ? PACKAGED_PROJECT_ID.trim() : "";
  if (!raw || raw.startsWith("__") || raw === "workspace" || /[\s/]/.test(raw)) return "";
  return raw;
}

function resolveShaperToken() {
  return typeof PACKAGED_SHAPER_TOKEN === "string" && PACKAGED_SHAPER_TOKEN.startsWith("shaper_tk_")
    ? PACKAGED_SHAPER_TOKEN.trim()
    : "";
}

function hasFlag(name) {
  return process.argv.includes(name);
}

const ALLOWED_FLAGS = new Set(["--force", "--help", "-h"]);

function unknownFlags(argv) {
  const unknown = [];
  for (const token of argv) {
    if (!token.startsWith("-")) continue;
    if (ALLOWED_FLAGS.has(token)) continue;
    unknown.push(token);
  }
  return unknown;
}

function validateArgs() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) { usage(); process.exit(0); }
  const unknown = unknownFlags(argv);
  if (unknown.length > 0) {
    console.error(`[create] 未知参数: ${unknown.join(" ")}`);
    console.error("[create] 本脚本只负责开通/复用云环境（写操作），不支持查询参数（如 --check）。");
    console.error("[create] 只读查询请用：node skills/act-cloudbase/scripts/query-cloudbase.js");
    usage();
    process.exit(1);
  }
}


function usage() {
  console.error(`用法:
  node create-cloudbase.js [--force]
  零参数固定执行（projectId / alias / token / 后台地址已打包写死）；
  写操作：开通/复用云环境；只读查询请用 query-cloudbase.js`);
}

function writeBackCredentials(projectId, alias, data) {
  const credentialsPath = path.resolve(process.cwd(), "credentials.json");
  const current = readCredentials();
  const next = {
    ...current,
    ...(data.envId ? { envId: data.envId } : {}),
    ...(data.apiKey ? { apiKey: data.apiKey } : {}),
    ...(data.stsCredentials ? { stsCredentials: data.stsCredentials } : {}),
    ...(data.envStatus ? { envStatus: data.envStatus } : {}),
    ...(alias ? { alias } : {}),
    ...(projectId ? { projectId } : {}),
  };
  fs.writeFileSync(credentialsPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return credentialsPath;
}

function headers(token) {
  const h = { "Content-Type": "application/json" };
  if (token) h["X-Shaper-Token"] = token;
  return h;
}

async function parseResponse(res) {
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`非 JSON 响应 HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  if (!res.ok || (json && json.success === false)) {
    const code = json?.code || `HTTP_${res.status}`;
    const message = json?.message || JSON.stringify(json || { status: res.status });
    throw new Error(`开通失败 [${code}] ${message}`);
  }
  return json;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function terminalError(data) {
  if (data?.status !== "failed" && data?.record?.status !== "failed") return null;
  const error = data?.error;
  return {
    code: typeof error?.code === "string" && error.code ? error.code : "CLOUDBASE_ACTIVATION_FAILED",
    message: typeof error?.message === "string" && error.message
      ? error.message
      : "CloudBase 环境激活失败，请检查腾讯云环境状态和服务日志。",
  };
}

async function activate(apiBase, projectId, alias, token) {
  const url = `${apiBase}/api/v1/cloudbase/projects/${encodeURIComponent(projectId)}/activate`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ alias }),
  });
  const json = await parseResponse(res);
  return json.data || json;
}

async function topology(apiBase, projectId, token) {
  const url = `${apiBase}/api/v1/cloudbase/projects/${encodeURIComponent(projectId)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: headers(token),
  });
  const json = await parseResponse(res);
  return json.data || json;
}

async function main() {
  validateArgs();
  const activity = readActivity();
  const credentials = readCredentials();
  const projectId = packagedProjectId();
  const alias = activity.alias || activity.activityName || projectId;
  const apiBase = DEFAULT_API.replace(/\/+$/, "");
  const token = resolveShaperToken();
  const force = hasFlag("--force");

  if (!projectId) {
    console.error("[create] 技能包未绑定活动身份：PACKAGED_PROJECT_ID 未被替换（下载时未绑定 workspaceId），");
    console.error("[create] 禁止使用默认身份开通云环境。请从平台重新下载绑定活动的技能包，或向开发者确认活动后再打包。");
    usage();
    process.exit(1);
  }
  if (!token) {
    console.error("[create] 缺少 shaperToken：PACKAGED_SHAPER_TOKEN 未被替换（技能包下载时应自动带上）。");
    usage();
    process.exit(1);
  }

  const printResult = (payload) => console.log(JSON.stringify(payload, null, 2));

  console.error(`[create] 查询已有环境 projectId=${projectId} alias=${alias} api=${apiBase}`);
  const current = await topology(apiBase, projectId, token);
  const record = current.record ?? null;
  const hasEnv = record !== null;

  if (hasEnv && current.activated === true) {
    const credentialsPath = writeBackCredentials(projectId, alias, current);
    console.error(`[create] 已有已激活环境 envId=${current.envId}，直接复用，不重新开通`);
    printResult({ ok: true, projectId, reused: true, envId: current.envId || "", status: "activated", credentialsPath });
    return;
  }

  if (hasEnv && current.envId) {
    const credentialsPath = writeBackCredentials(projectId, alias, current);
    console.error(`[create] 环境已存在（status=${record.status} envId=${current.envId}），等待就绪，不重复开通`);
    const deadline = Date.now() + POLL_TIMEOUT_SEC * 1000;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_SEC * 1000);
      const polled = await topology(apiBase, projectId, token);
      writeBackCredentials(projectId, alias, polled);
      console.error(`[create] 轮询 status=${polled.status || "creating"} activated=${polled.activated === true} envId=${polled.envId || ""}`);
      const failure = terminalError(polled);
      if (failure) {
        printResult({ ok: false, projectId, activated: false, envId: polled.envId || "", status: "failed", error: failure, credentialsPath });
        process.exitCode = 1;
        return;
      }
      if (polled.activated === true) {
        printResult({ ok: true, projectId, reused: true, envId: polled.envId || "", status: polled.status || "activated", credentialsPath });
        return;
      }
    }
    console.error(`[create] 超时（${POLL_TIMEOUT_SEC}s）仍未 activated，可稍后重跑本脚本续查`);
    printResult({ ok: false, projectId, activated: false, status: "timeout", credentialsPath });
    process.exitCode = 1;
    return;
  }

  if (hasEnv && !current.envId) {
    if (!force) {
      console.error(`[create] 项目已有环境记录但未就绪（status=${record.status}），请先处理既有环境，或加 --force 重新开通`);
      printResult({ ok: false, projectId, activated: false, status: record.status, note: "既有环境未就绪，未触发开通" });
      process.exitCode = 1;
      return;
    }
    console.error(`[create] 既有环境未就绪（status=${record.status}），--force 强制重新开通`);
  }

  console.error(`[create] 未发现已有环境，发起开通（运行前需已获开发者确认）...`);
  const activated = await activate(apiBase, projectId, alias, token);
  const credentialsPath = writeBackCredentials(projectId, alias, activated);
  console.error(`[create] 已写回凭据 → ${credentialsPath} status=${activated.status || "activated"} activated=${activated.activated === true}`);

  const initialFailure = terminalError(activated);
  if (initialFailure) {
    printResult({ ok: false, projectId, activated: false, envId: activated.envId || "", status: "failed", error: initialFailure, credentialsPath });
    process.exitCode = 1;
    return;
  }

  if (activated.activated === true) {
    printResult({ ok: true, projectId, envId: activated.envId || "", status: activated.status || "activated", credentialsPath });
    return;
  }

  const deadline = Date.now() + POLL_TIMEOUT_SEC * 1000;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_SEC * 1000);
    const polled = await topology(apiBase, projectId, token);
    writeBackCredentials(projectId, alias, polled);
    console.error(`[create] 轮询 status=${polled.status || "creating"} activated=${polled.activated === true} envId=${polled.envId || ""}`);
    const failure = terminalError(polled);
    if (failure) {
      printResult({ ok: false, projectId, activated: false, envId: polled.envId || "", status: "failed", error: failure, credentialsPath });
      process.exitCode = 1;
      return;
    }
    if (polled.activated === true) {
      printResult({ ok: true, projectId, envId: polled.envId || "", status: polled.status || "activated", credentialsPath });
      return;
    }
  }

  console.error(`[create] 超时（${POLL_TIMEOUT_SEC}s）仍未 activated，可稍后重跑本脚本续查`);
  printResult({ ok: false, projectId, activated: false, status: "timeout", credentialsPath });
  process.exitCode = 1;
}

main().catch((e) => {
  const cause = e && e.cause
    ? `（${e.cause.code || ""}${e.cause.address ? ` ${e.cause.address}:${e.cause.port || ""}` : ""} ${e.cause.message || ""}）`
    : "";
  console.error(`[create] 后台请求失败: ${e.message || e}${cause}`);
  console.error(`[create] 后台不可达时，先确认后台服务在线后再重试，自愈后再判定部署目标；禁止把「后台未启动」当作需要开发者提供环境链接/ID 的问题抛给开发者`);
  process.exit(1);
});
