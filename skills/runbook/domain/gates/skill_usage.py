# -*- coding: utf-8 -*-
"""技能使用统计门禁：h5/index.html 内嵌技能使用数据块必须真实描述页面用到的技能。

技能使用 JSON 以 `<script type="application/json" id="colorbox-skill-usage">` 数据块内嵌在
h5/index.html（单一来源：审核/门禁都从 HTML 提取，避免与独立 JSON 文件重复失步）。

检查项（implement 阶段执行）：
1. 数据块存在且可解析，结构为 {"skills": ["colorbox-...", ...]}；
2. 动态范围：skills 内每个值必须是本工作区 skills/ 下**已交付且可调用**的 ColorboxAI
   运行时技能（目录存在且 SKILL.md 带 JS Path）。范围随工作区技能清单运行期动态得出
   （技能目录由技能包打包写入，非 AI 生成），不再维护硬编码检查表，SDK 增删技能无需再生成；
3. 无重复；
4. 双向真实核对：声明了的技能必须真的在 h5/index.html 调用了对应 window.ColorboxAI API，
   且 index.html 实际调用到的技能必须全部声明。
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from domain.gates.base import BaseGate

USAGE_BLOCK_RE = re.compile(
    r"""<script\b(?=[^>]*\btype=["']application/json["'])(?=[^>]*\bid=["']colorbox-skill-usage["'])[^>]*>([\s\S]*?)</script>""",
    re.IGNORECASE,
)
JS_PATH_RE = re.compile(r"^-\s*JS Path:\s*`(window\.ColorboxAI[^`]*)`\s*$", re.MULTILINE)


def _extract_usage_data(html: str) -> dict[str, Any] | None:
    """从 HTML 提取内嵌技能使用 JSON；无数据块或解析失败返回 None。"""
    match = USAGE_BLOCK_RE.search(html)
    if match is None:
        return None
    try:
        data = json.loads(match.group(1).strip())
    except (ValueError, TypeError):
        return None
    return data if isinstance(data, dict) else None


def _js_path_from_skill_md(skill_md: str) -> str | None:
    """从 SKILL.md 提取 window.ColorboxAI JS Path（去除 (params) 占位）。"""
    match = JS_PATH_RE.search(skill_md)
    if match is None:
        return None
    return match.group(1).removesuffix("(params)")


def collect_shipped_js_paths(skills_dir: Path) -> dict[str, str]:
    """运行期收集工作区已交付且可调用的技能：{技能 ID（skills/ 下目录名）: JS Path}。

    仅收录 SKILL.md 带 JS Path 的运行时技能；交付技能（act-cloudbase）、审查技能
    （audit-hupu-web-security）与总览（colorbox-skill）没有 JS Path，天然不入列。
    """
    if not skills_dir.is_dir():
        return {}
    paths: dict[str, str] = {}
    for child in skills_dir.iterdir():
        if not child.is_dir():
            continue
        skill_md = child / "SKILL.md"
        if not skill_md.is_file():
            continue
        js_path = _js_path_from_skill_md(skill_md.read_text(encoding="utf-8", errors="replace"))
        if js_path is not None:
            paths[child.name] = js_path
    return paths


def _api_used(html: str, token: str) -> bool:
    """index.html 是否真实调用了该 API（排除子能力前缀干扰，如 request 不匹配 request.basketball.xx）。"""
    return re.search(re.escape(token) + r"(?![\w.])", html) is not None


class SkillUsageGate(BaseGate):
    """技能使用统计门禁。"""

    def evaluate(self, activity_dir: Path, state: dict[str, Any]) -> list[str]:
        del state  # 本门禁只看产物，不依赖确认状态
        reasons: list[str] = []
        workspace_root = activity_dir.parent
        index_html = workspace_root / "h5" / "index.html"

        if not index_html.is_file():
            reasons.append("缺少 h5/index.html（技能使用统计以该文件为准）")
            return reasons

        html = index_html.read_text(encoding="utf-8", errors="replace")
        data = _extract_usage_data(html)
        if data is None:
            reasons.append(
                'h5/index.html 缺少可解析的技能使用数据块（<script type="application/json" '
                'id="colorbox-skill-usage">{"skills": [...]}</script>；先运行 scripts/scan-skill-usage.mjs 生成）'
            )
            return reasons

        declared = data.get("skills")
        if not isinstance(declared, list) or not all(isinstance(item, str) and item.strip() for item in declared):
            reasons.append('h5/index.html 技能使用数据块必须为 {"skills": ["colorbox-...", ...]} 结构（skills 为技能 ID 字符串数组）')
            return reasons

        if len(set(declared)) != len(declared):
            reasons.append("h5/index.html 技能使用数据块的 skills 存在重复技能")

        # 动态范围：声明必须对应本工作区已交付且可调用的运行时技能（范围随技能包动态得出）
        shipped_paths = collect_shipped_js_paths(workspace_root / "skills")
        for skill_id in declared:
            if not (workspace_root / "skills" / skill_id / "SKILL.md").is_file():
                reasons.append(f"h5/index.html 技能使用数据块声明了技能 {skill_id!r}，但本工作区 skills/ 下未交付该技能（未选中的技能不得声明）")
            elif skill_id not in shipped_paths:
                reasons.append(f"h5/index.html 技能使用数据块声明了技能 {skill_id!r}，但其不是可调用的 ColorboxAI 运行时技能（SKILL.md 缺少 JS Path）")

        # 双向真实核对：声明须真实调用，调用须已声明
        for skill_id in declared:
            token = shipped_paths.get(skill_id)
            if token is None:
                continue  # 未交付/非运行时技能已在上面单独报
            if not _api_used(html, token):
                reasons.append(f"h5/index.html 技能使用数据块声明了 {skill_id}，但页面未调用 {token}")

        used_but_undeclared = sorted(
            skill_id for skill_id, token in shipped_paths.items()
            if _api_used(html, token) and skill_id not in declared
        )
        if used_but_undeclared:
            reasons.append(f"h5/index.html 实际调用了未声明技能：{', '.join(used_but_undeclared)}（请补入技能使用数据块的 skills）")

        return reasons
