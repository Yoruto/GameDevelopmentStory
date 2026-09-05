#!/usr/bin/env node
/**
 * 只读查询活动云环境现状（绝不开通、绝不修改任何资源）。
 *
 *   node skills/act-cloudbase/scripts/query-cloudbase.js
 *
 * - 全部参数（projectId / shaperToken / 后台地址）在技能包打包时已写死进脚本，
 *   零参数固定执行：AI 无需传参、无需读环境变量；明细固定落盘 env-detail.json
 * - 技能包未绑定活动（PACKAGED_PROJECT_ID 占位符未替换）时直接报错退出，
 *   绝不使用默认身份（如 workspace）查询/开通
 *
 * - 固定行为：查询该活动是否已有云环境（基础拓扑 + 环境明细），输出摘要并落盘 env-detail.json
 * - 需要开通/复用环境时请用 create-cloudbase.js（唯一开通入口）；本脚本永远不触发开通
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

const ALLOWED_FLAGS = new Set(["--help", "-h"]);

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
    console.error(`[query] 未知参数: ${unknown.join(" ")}`);
    console.error("[query] 本脚本只读查询，不支持开通/修改参数。开通请用：node skills/act-cloudbase/scripts/create-cloudbase.js");
    usage();
    process.exit(1);
  }
}

function usage() {
  console.error(`用法:
  node query-cloudbase.js
  零参数固定执行（projectId / token / 后台地址已打包写死），明细落盘 env-detail.json；
  只读查询：绝不开通、绝不修改任何资源；开通请用 create-cloudbase.js`);
}

function headers(token) {
  const h = { "Content-Type": "application/json" };
  if (token) h["X-Shaper-Token"] = token;
  return h;
}

async function fetchJson(url, token) {
  const res = await fetch(url, { method: "GET", headers: headers(token) });
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
    throw new Error(`后台请求失败 [${code}] ${message}`);
  }
  return json && typeof json === "object" && "data" in json ? json.data : json;
}

async function main() {
  validateArgs();
  const projectId = packagedProjectId();
  const token = resolveShaperToken();
  const apiBase = DEFAULT_API.replace(/\/+$/, "");

  if (!projectId) {
    console.error("[query] 技能包未绑定活动身份：PACKAGED_PROJECT_ID 未被替换（下载时未绑定 workspaceId），");
    console.error("[query] 禁止使用默认身份查询/开通云环境。请从平台重新下载绑定活动的技能包。");
    usage();
    process.exit(1);
  }
  if (!token) {
    console.error("[query] 缺少 shaperToken：PACKAGED_SHAPER_TOKEN 未被替换（技能包下载时应自动带上）。");
    usage();
    process.exit(1);
  }

  console.error(`[query] 只读查询 projectId=${projectId} api=${apiBase}（不会触发开通）`);
  const topo = await fetchJson(`${apiBase}/api/v1/cloudbase/projects/${encodeURIComponent(projectId)}`, token);
  const record = topo.record ?? null;
  console.error(`[query] 基础拓扑：activated=${topo.activated} envId=${topo.envId || "(无)"} record=${record ? record.status : "无记录"}`);

  let detail = {};
  const outPath = path.resolve(process.cwd(), "env-detail.json");
  try {
    detail = await fetchJson(`${apiBase}/api/v1/cloudbase/projects/${encodeURIComponent(projectId)}/inspect`, token);
    fs.writeFileSync(outPath, `${JSON.stringify(detail, null, 2)}\n`, "utf8");
    console.error(`[query] 明细已落盘 → ${outPath}`);
  } catch (e) {
    console.warn(`[query] 明细拉取失败（不影响基础结论）: ${e.message}`);
  }

  console.log(JSON.stringify({
    ok: true,
    projectId,
    activated: topo.activated === true,
    envId: topo.envId || detail.envId || "",
    envStatus: detail.envStatus?.status || topo.envStatus || null,
    recordStatus: record?.status || null,
    note: topo.activated === true ? "已有环境，直接复用" : "尚无环境，需开通（用 create-cloudbase.js）",
    detailOut: fs.existsSync(outPath) ? outPath : null,
    gatewayRoutes: (detail.routes || []).length,
    functions: (detail.functions || []).length,
    tables: (detail.tables || []).map((t) => `${t.schema}.${t.table}`)
  }, null, 2));
}

main().catch((e) => {
  const cause = e && e.cause
    ? `（${e.cause.code || ""}${e.cause.address ? ` ${e.cause.address}:${e.cause.port || ""}` : ""} ${e.cause.message || ""}）`
    : "";
  console.error(`[query] 后台请求失败: ${e.message || e}${cause}`);
  console.error(`[query] 后台不可达时先确认后台服务在线后再重试；本脚本只读，不会触发任何开通`);
  process.exit(1);
});
