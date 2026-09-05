# -*- coding: utf-8 -*-
"""门禁中央注册表与调度器（手写 Gate 模式）。

每个阶段一个专属 Gate；未注册阶段（如 done）默认直接通过。
新增阶段 = 在 PROCESS.md 加块 + （如需机器硬检查）在此登记对应 Gate。
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from core.types import GateResult
from domain.gates.base import BaseGate
from domain.gates.deliver import DeliverGate
from domain.gates.deploy import DeployGate
from domain.gates.implement import ImplementGate
from domain.gates.plan import PlanGate
from domain.gates.requirements import RequirementsGate
from domain.gates.security_review import SecurityReviewGate
from domain.gates.test import TestGate


class GateRegistry:
    """门禁策略注册表。"""

    _GATES: dict[str, BaseGate] = {
        "requirements": RequirementsGate(),
        "security-review": SecurityReviewGate(),
        "plan": PlanGate(),
        "implement": ImplementGate(),
        "deploy": DeployGate(),
        "test": TestGate(),
        "deliver": DeliverGate(),
    }

    @classmethod
    def evaluate(cls, phase: str, activity_dir: Path, state: dict[str, Any]) -> GateResult:
        """评估指定阶段的门禁是否满足。"""
        strategy = cls._GATES.get(phase)
        if not strategy:
            # 未配置特有门禁的阶段（如 done）默认直接通过
            return GateResult(ok=True, reasons=[])
        reasons = strategy.evaluate(activity_dir, state)
        return GateResult(ok=len(reasons) == 0, reasons=reasons)
