#!/usr/bin/env node
/**
 * 更新 Colorbox AI 项目 H5 页面，上传实时预览，并保存虎扑 Schema 二维码。
 *
 *   node act-cloudbase/scripts/update-activity-html.js
 *
 * - 全部参数在技能包打包时已写死：projectId（PACKAGED_PROJECT_ID）、后台地址（DEFAULT_API）、
 *   代理 token（PACKAGED_SHAPER_TOKEN）、上传目标 h5/、env=sit、本地产物 h5.zip、输出 preview-qr.png。
 *   零参数固定执行：AI 无需传参、无需读环境变量
 * - 技能包未绑定活动（PACKAGED_PROJECT_ID 占位符未替换）时直接报错退出，
 *   绝不使用默认身份（如 workspace）上传/开通
 *
 * - 后台地址在技能包打包时已按环境写死（DEFAULT_API），无需传 --api、无需读环境变量
 * - 上传目标固定为 h5 目录（默认）：脚本先把目录内 index.html + css/js/图片等静态资源打包成 zip，
 *   先写本地产物 ./h5.zip，再以 multipart 上传，后台按与发布一致的规则解压并把依赖资源一并落 OSS。
 * - 一次请求直出：POST 上传后，后台在 JSON 响应中直接返回 qrcodeDataUrl（data:image/png;base64,...），
 *   脚本解码并校验 PNG 魔数后写入 ./preview-qr.png。不依赖 CDN 二次下载、不需要 format=png，保证产物一定是真 PNG。
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

/** 后台地址：技能包打包时按环境替换为固定字符串，AI 无需关心环境 */
const DEFAULT_API = "https://shaper.hupu.com";
/** 代理 token：技能包打包时替换为实际 shaperToken，AI 无需读凭据文件 */
const PACKAGED_SHAPER_TOKEN = "shaper_tk_283a5bfdbd1b1d10fcd5bf92d573d1a96aa5d61b908b7f933922bdc78d372f75";
/** 活动 ID：技能包打包时替换为实际 projectId */
const PACKAGED_PROJECT_ID = "app_3c72f55c0c";
/** 默认上传目标：工作区根目录 h5/（含 index.html 与 css/js/图片等静态资源），脚本自动打包 zip */
const DEFAULT_HTML = "h5";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DATA_URL_PREFIX = "data:image/png;base64,";
const SKIP_NAMES = new Set([".DS_Store", "Thumbs.db"]);
const SKIP_DIRS = new Set(["node_modules", ".git", "__MACOSX"]);

// ---------- 纯 Node ZIP 打包（无外部依赖，跨平台） ----------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >>> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time: time & 0xffff, date: day & 0xffff };
}

function collectZipFiles(root) {
  const files = [];
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_NAMES.has(entry.name) || SKIP_DIRS.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(abs, name);
      else if (entry.isFile()) files.push({ name, buffer: fs.readFileSync(abs), date: fs.statSync(abs).mtime });
    }
  };
  walk(root, "");
  return files;
}

function zipFiles(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const nameBuf = Buffer.from(file.name, "utf8");
    const data = zlib.deflateRawSync(file.buffer, { level: 9 });
    const crc = crc32(file.buffer);
    const { time, date } = dosDateTime(file.date);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 文件名
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(file.buffer.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, data);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8); // UTF-8 文件名
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(time, 12);
    cd.writeUInt16LE(date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(file.buffer.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }

  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, centralBuf, eocd]);
}

function buildMultipart(zipBuf, filename, env) {
  const boundary = `----colorbox-ai-${Date.now().toString(36)}`;
  const head = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="env"\r\n\r\n${env}\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: application/zip\r\n\r\n`,
    "utf8"
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  return { body: Buffer.concat([head, zipBuf, tail]), boundary };
}

// ---------- 参数解析与上传 ----------

function packagedProjectId() {
  const raw = typeof PACKAGED_PROJECT_ID === "string" ? PACKAGED_PROJECT_ID.trim() : "";
  if (!raw || raw.startsWith("__") || raw === "workspace" || /[\s/]/.test(raw)) return "";
  return raw;
}

function resolveShaperToken() {
  return typeof PACKAGED_SHAPER_TOKEN === "string" &&
    PACKAGED_SHAPER_TOKEN.startsWith("shaper_tk_")
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
    console.error(`[update] 未知参数: ${unknown.join(" ")}`);
    console.error("[update] 本脚本零参数固定执行（projectId / html / env / token / 输出路径均已打包写死），不支持任何参数。");
    console.error("[update] 只读查询请用：node skills/act-cloudbase/scripts/query-cloudbase.js");
    usage();
    process.exit(1);
  }
}

function usage() {
  console.error(`用法:
  node update-activity-html.js
  零参数固定执行（projectId / html=h5 / env=sit / 本地产物=h5.zip / 输出=preview-qr.png / token 均已打包写死）；
  上传目标固定为 ./h5 目录，自动打包 zip：先写本地 ./h5.zip 再上传，含 css/js/图片等依赖资源`);
}

function isPng(buf) {
  return Buffer.isBuffer(buf) && buf.length >= PNG_SIGNATURE.length && buf.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
}

function writePng(buf, outPath) {
  if (!isPng(buf)) {
    const preview = buf && buf.length > 0 ? JSON.stringify(buf.subarray(0, 64).toString("utf8")) : "";
    throw new Error(`接口未返回 PNG（收到 ${buf ? buf.length : 0} 字节，疑似 JSON/错误页，开头: ${preview}），已拒绝写入 ${outPath}`);
  }
  fs.writeFileSync(outPath, buf);
}

function decodeDataUrl(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith(DATA_URL_PREFIX)) return null;
  return Buffer.from(dataUrl.slice(DATA_URL_PREFIX.length), "base64");
}

async function downloadToFile(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`下载二维码失败 HTTP ${res.status}: ${url}`);
  }
  writePng(Buffer.from(await res.arrayBuffer()), outPath);
}

function prepareUploadPayload(targetPath) {
  const absTarget = path.resolve(targetPath);
  if (!fs.existsSync(absTarget)) {
    throw new Error(`上传目标不存在: ${absTarget}（默认 ./h5 目录）`);
  }
  const stat = fs.statSync(absTarget);
  if (stat.isDirectory()) {
    if (!fs.existsSync(path.join(absTarget, "index.html"))) {
      throw new Error(`目录缺少入口文件 index.html: ${absTarget}（h5 目录需包含 index.html）`);
    }
    const files = collectZipFiles(absTarget);
    if (files.length === 0) throw new Error(`目录为空，没有可上传的文件: ${absTarget}`);
    const zipBuf = zipFiles(files);
    const zipOut = path.resolve(process.cwd(), "h5.zip");
    fs.writeFileSync(zipOut, zipBuf);
    return { kind: "zip", files, zipBytes: zipBuf.length, zipOut, payload: (env) => buildMultipart(zipBuf, path.basename(zipOut), env) };
  }
  if (stat.isFile() && absTarget.toLowerCase().endsWith(".html")) {
    const html = fs.readFileSync(absTarget, "utf8");
    return { kind: "html", files: 1, zipBytes: 0, payload: (env) => JSON.stringify({ html, env }) };
  }
  throw new Error(`上传目标必须是 h5 目录或单个 .html 文件: ${absTarget}`);
}

async function main() {
  validateArgs();
  const projectId = packagedProjectId();
  const targetPath = DEFAULT_HTML;
  const env = "sit";
  const apiBase = DEFAULT_API.replace(/\/+$/, "");
  const outPath = path.resolve(process.cwd(), "preview-qr.png");
  const shaperToken = resolveShaperToken();

  if (!projectId) {
    console.error("[update] 技能包未绑定活动身份：PACKAGED_PROJECT_ID 未被替换（下载时未绑定 workspaceId），");
    console.error("[update] 禁止使用默认身份上传/开通云服务。请从平台重新下载绑定活动的技能包。");
    usage();
    process.exit(1);
  }

  const upload = prepareUploadPayload(targetPath);
  const url = `${apiBase}/api/ai-code/projects/${encodeURIComponent(projectId)}/live-preview?env=${encodeURIComponent(env)}`;

  const headers = {
    "X-Colorbox-Env": env,
  };
  if (shaperToken) {
    headers["X-Shaper-Token"] = shaperToken;
  }

  let body;
  if (upload.kind === "zip") {
    const { body: multipartBody, boundary } = upload.payload(env);
    body = multipartBody;
    headers["Content-Type"] = `multipart/form-data; boundary=${boundary}`;
    console.error(`[update] 已生成本地打包产物 ${upload.zipOut}（${(upload.zipBytes / 1024).toFixed(1)}KB，${Array.isArray(upload.files) ? upload.files.length : upload.files} 个文件），开始上传`);
  } else {
    body = upload.payload(env);
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body,
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`非 JSON 响应 HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  if (!res.ok || (json && json.success === false)) {
    throw new Error(JSON.stringify(json || { status: res.status }, null, 2));
  }

  const data = json.data || json;
  const png = decodeDataUrl(data.qrcodeDataUrl);
  if (png) {
    writePng(png, outPath);
  } else if (data.qrcodeUrl) {
    // 兜底：仅当响应未内嵌 base64 时才回源下载，仍会校验 PNG 魔数
    await downloadToFile(data.qrcodeUrl, outPath);
  } else {
    throw new Error(`后台响应缺少 qrcodeDataUrl / qrcodeUrl，无法生成二维码: ${JSON.stringify(data).slice(0, 300)}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        projectId,
        env,
        target: path.resolve(targetPath),
        uploadMode: upload.kind,
        zipOut: upload.kind === "zip" ? upload.zipOut : undefined,
        out: outPath,
        previewUrl: data.previewUrl,
        schema: data.schema,
        qrcodeUrl: data.qrcodeUrl || "",
        updatedAt: data.updatedAt,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
