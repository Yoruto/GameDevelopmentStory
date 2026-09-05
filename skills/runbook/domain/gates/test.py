# -*- coding: utf-8 -*-
"""Test 测试阶段门禁策略。"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from domain.gates.base import BaseGate


class TestGate(BaseGate):
    """测试阶段门禁。"""

    def evaluate(self, activity_dir: Path, state: dict[str, Any]) -> list[str]:
        confirmed = state.get("confirmed", {})
        reasons: list[str] = []

        if not (activity_dir / "test-report.md").is_file():
            reasons.append("缺少 activity/test-report.md")
        if not confirmed.get("test"):
            reasons.append("测试结果未确认（先 state.py confirm test）")

        return reasons
