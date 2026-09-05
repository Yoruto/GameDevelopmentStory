#!/usr/bin/env node
/**
 * 扫描 h5/index.html 真实调用的 window.ColorboxAI 技能，把技能使用 JSON 写入 HTML 内嵌数据块。
 *
 * 用法（工作区根目录下执行）：
 *     node skills/runbook/scripts/scan-skill-usage.mjs
 *
 * 规则：
 * - 技能使用 JSON 以 `<script type="application/json" id="colorbox-skill-usage">` 数据块
 *   内嵌在 h5/index.html（单一来源：审核/门禁都从 HTML 提取，避免与独立 JSON 文件重复失步）；
 * - 技能 ID = 工作区 skills/ 下目录名（如 colorbox-cloud-auth）；每个已交付技能的
 *   SKILL.md 提供 JS Path（如 window.ColorboxAI.cloud.auth），index.html 出现该调用前缀即视为真实使用；
 * - 子能力前缀不混淆：window.ColorboxAI.request 不会误判 window.ColorboxAI.request.basketball.playerInfo；
 * - 幂等更新：已存在同 id 数据块则原地替换内容，不存在才插入，重复运行不会产生重复块。
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const USAGE_BLOCK_RE = /<script\b(?=[^>]*\btype=["']application\/json["'])(?=[^>]*\bid=["']colorbox-skill-usage["'])[^>]*>([\s\S]*?)<\/script>/i
const JS_PATH_RE = /^-\s*JS Path:\s*`(window\.ColorboxAI[^`]*)`\s*$/gm

function renderUsageBlock (jsonText) {
  return `<script type="application/json" id="colorbox-skill-usage">\n${jsonText}\n</script>`
}

export function extractSkillUsage (html) {
  /** 从 HTML 提取技能使用 JSON；无数据块或解析失败返回 null。 */
  const match = USAGE_BLOCK_RE.exec(html)
  if (match === null) return null
  try {
    return JSON.parse(match[1].trim())
  } catch {
    return null
  }
}

export function updateSkillUsageInHtml (html, skills) {
  /** 把技能清单写入 HTML 内嵌数据块：存在则原地替换（不重复），不存在则插入 <head> 附近。 */
  const block = renderUsageBlock(JSON.stringify({ skills }, null, 2))
  const match = USAGE_BLOCK_RE.exec(html)
  if (match !== null) {
    return html.slice(0, match.index) + block + html.slice(match.index + match[0].length)
  }
  const headOpen = /<head\b[^>]*>/i.exec(html)
  if (headOpen !== null) {
    const at = headOpen.index + headOpen[0].length
    return html.slice(0, at) + `\n${block}` + html.slice(at)
  }
  const headClose = /<\/head\s*>/i.exec(html)
  if (headClose !== null) {
    return html.slice(0, headClose.index) + `${block}\n` + html.slice(headClose.index)
  }
  const htmlTag = /<html\b[^>]*>/i.exec(html)
  if (htmlTag !== null) {
    const at = htmlTag.index + htmlTag[0].length
    return html.slice(0, at) + `\n${block}` + html.slice(at)
  }
  return `${block}\n${html}`
}

function jsPathFromSkillMd (content) {
  const match = JS_PATH_RE.exec(content)
  JS_PATH_RE.lastIndex = 0
  return match ? match[1].replace(/\(params\)$/, '') : null
}

function escapeRegExp (text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function apiUsed (html, token) {
  return new RegExp(`${escapeRegExp(token)}(?![\\w.])`).test(html)
}

function collectShippedJsPaths (skillsDir) {
  const jsPaths = new Map()
  if (!existsSync(skillsDir)) return jsPaths
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const mdFile = join(skillsDir, entry.name, 'SKILL.md')
    if (!existsSync(mdFile)) continue
    const jsPath = jsPathFromSkillMd(readFileSync(mdFile, 'utf8'))
    if (jsPath !== null) jsPaths.set(entry.name, jsPath)
  }
  return jsPaths
}

function main () {
  const root = process.cwd()
  const indexHtmlPath = resolve(root, 'h5', 'index.html')
  if (!existsSync(indexHtmlPath)) {
    console.error(`✗ 缺少 ${indexHtmlPath}，先完成 h5/index.html 再扫描技能使用`)
    process.exit(1)
  }
  const html = readFileSync(indexHtmlPath, 'utf8')

  const jsPaths = collectShippedJsPaths(resolve(root, 'skills'))
  const used = [...jsPaths.entries()]
    .filter(([, token]) => apiUsed(html, token))
    .map(([id]) => id)
    .sort()

  const updated = updateSkillUsageInHtml(html, used)
  if (updated !== html) writeFileSync(indexHtmlPath, updated, 'utf8')

  if (used.length === 0) {
    console.log(`✓ h5/index.html 未调用 ColorboxAI 技能，已写入空技能使用数据块`)
  } else {
    console.log(`✓ 已扫描 h5/index.html 真实使用的技能并写入内嵌数据块:`)
    for (const id of used) console.log(`  - ${id} (${jsPaths.get(id)})`)
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
