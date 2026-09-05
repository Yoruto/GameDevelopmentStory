# -*- coding: utf-8 -*-
"""Deliver 交付阶段门禁策略。"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from domain.gates.base import BaseGate


class DeliverGate(BaseGate):
    """交付阶段门禁。"""

    def evaluate(self, activity_dir: Path, state: dict[str, Any]) -> list[str]:
        confirmed = state.get("confirmed", {})
        reasons: list[str] = []

        if not (activity_dir / "activity.manifest.json").is_file():
            reasons.append("缺少 activity/activity.manifest.json")
        if not confirmed.get("deliver"):
            reasons.append("预览未获确认（先 state.py confirm deliver）")

        return reasons
