# -*- coding: utf-8 -*-
"""业务默认规则门禁（当前检查 R-01 文本输入风控）。

R-01 属「必接」安全红线，机器强制：只要页面包含可提交的文本输入（<textarea>、文本类
<input>、contenteditable），就必须真实调用 window.ColorboxAI.security.checkAudit。
技能声明一致性由 SkillUsageGate 双向核对（调用未声明 / 声明未调用都会拦截），此处只补
「有输入就必须接」这一条业务规则；R-02 分享提醒属体验默认规则，不设硬门禁
（无分享按钮的页面会误报），由 test 阶段「规则对齐」自检。
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from domain.gates.base import BaseGate

CHECK_AUDIT_TOKEN = "window.ColorboxAI.security.checkAudit"

_TEXT_INPUT_TYPES = {"text", "search", "email", "url", "tel", "number", "password"}

_INPUT_TAG_RE = re.compile(r"<input\b[^>]*>", re.IGNORECASE)
_INPUT_TYPE_RE = re.compile(
    r"""type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))""",
    re.IGNORECASE,
)
_CONTENTEDITABLE_RE = re.compile(r"\bcontenteditable\b", re.IGNORECASE)
_CONTENTEDITABLE_FALSE_RE = re.compile(
    r"""\bcontenteditable\s*=\s*(?:"false"|'false'|false(?=[\s>]))""",
    re.IGNORECASE,
)


def _has_text_input(html: str) -> bool:
    """页面是否存在用户可提交的文本输入（保守启发式：无 type 的 input 默认是 text）。"""
    if "<textarea" in html.lower():
        return True
    # contenteditable 显式 =false（编辑器禁用）不算可输入区域
    stripped = _CONTENTEDITABLE_FALSE_RE.sub("", html)
    if _CONTENTEDITABLE_RE.search(stripped):
        return True
    for tag in _INPUT_TAG_RE.findall(html):
        m = _INPUT_TYPE_RE.search(tag)
        if m is None:
            return True
        input_type = (m.group(1) or m.group(2) or m.group(3) or "").lower()
        if input_type in _TEXT_INPUT_TYPES:
            return True
    return False


def _api_used(html: str, token: str) -> bool:
    """h5/index.html 是否真实调用了该 API（排除子能力前缀干扰）。"""
    return re.search(re.escape(token) + r"(?![\w.])", html) is not None


class BusinessRulesGate(BaseGate):
    """业务默认规则门禁（R-01：文本输入必须接入内容安全检测）。"""

    def evaluate(self, activity_dir: Path, state: dict[str, Any]) -> list[str]:
        del state  # 只读产物，不依赖确认状态
        index_html = activity_dir.parent / "h5" / "index.html"
        if not index_html.is_file():
            return []  # 缺 h5/index.html 已由 ImplementGate / SkillUsageGate 覆盖
        html = index_html.read_text(encoding="utf-8", errors="replace")
        if not _has_text_input(html):
            return []
        if _api_used(html, CHECK_AUDIT_TOKEN):
            return []
        return [
            "R-01 文本输入风控（业务默认规则，门禁强制）：h5/index.html 含用户文本输入"
            "（<textarea>/文本类 <input>/contenteditable）但未调用 "
            f"{CHECK_AUDIT_TOKEN}，提交前必须接入内容安全检测"
            "（规则与失败兜底见 references/business-rules.md R-01；"
            "技能使用声明一致性由技能使用门禁双向核对）"
        ]
