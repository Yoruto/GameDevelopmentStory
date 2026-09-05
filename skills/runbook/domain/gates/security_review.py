# -*- coding: utf-8 -*-
"""Security-review 发布安全审查阶段门禁策略。"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from domain.gates.base import BaseGate


class SecurityReviewGate(BaseGate):
    """发布安全审查阶段门禁：报告必须存在、协议合法且 decision=passed。"""

    def evaluate(self, activity_dir: Path, state: dict[str, Any]) -> list[str]:
        confirmed = state.get("confirmed", {})
        reasons: list[str] = []

        report = activity_dir / "security-review.json"
        if not report.is_file():
            reasons.append("缺少 activity/security-review.json（先按审查协议产出并原样落盘）")
            return reasons

        try:
            data = json.loads(report.read_text(encoding="utf-8"))
        except (OSError, ValueError) as error:
            reasons.append(f"activity/security-review.json 无法解析（{error}）")
            return reasons

        if data.get("schemaVersion") != "security_review_json_v1":
            reasons.append("security-review.json 的 schemaVersion 必须为 security_review_json_v1")
        decision = data.get("decision")
        if decision not in {"passed", "needs_review", "blocked"}:
            reasons.append(f"security-review.json 的 decision 非法：{decision!r}")
        elif decision != "passed":
            reasons.append(f"发布安全审查未通过（decision={decision}），先 state.py reject 回 implement 整改")

        if not confirmed.get("security-review"):
            reasons.append("安全审查结果未确认（先 state.py confirm security-review）")

        return reasons
