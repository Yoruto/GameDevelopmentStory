# -*- coding: utf-8 -*-
"""Implement 代码实现阶段门禁策略。"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from core.io import load_decisions
from domain.decisions import DEPLOYMENT_CLOUD, DEPLOYMENT_UNRESOLVED, deployment_mode
from domain.gates.base import BaseGate
from domain.gates.business_rules import BusinessRulesGate
from domain.gates.skill_usage import SkillUsageGate


class ImplementGate(BaseGate):
    """代码实现阶段门禁。"""

    def evaluate(self, activity_dir: Path, state: dict[str, Any]) -> list[str]:
        confirmed = state.get("confirmed", {})
        reasons: list[str] = []

        mode = deployment_mode(load_decisions(activity_dir) or {})
        if mode == DEPLOYMENT_UNRESOLVED:
            reasons.append("部署模式未决（先 state.py decide 确认「云服务：需要/不需要」）")
        elif mode == DEPLOYMENT_CLOUD:
            migs = list((activity_dir / "migrations").glob("*.sql")) if (activity_dir / "migrations").is_dir() else []
            if not migs:
                reasons.append("activity/migrations/ 下没有迁移 SQL")
            if not (activity_dir / "cloudfunctions" / "activity_api").is_dir():
                reasons.append("缺少 activity/cloudfunctions/activity_api/")
        else:
            # h5/ 位于工作区根目录（activity_dir 的上一级），不在 activity/ 产物目录下
            if not (activity_dir.parent / "h5" / "index.html").is_file():
                reasons.append("缺少 h5/index.html（无云模式需完成纯静态 H5）")

        # 技能使用统计：无论部署模式，h5/index.html 都要有真实的内嵌技能使用数据块
        reasons.extend(SkillUsageGate().evaluate(activity_dir, state))

        # 业务默认规则（R-01）：页面含用户文本输入必须接入内容安全检测（机器强制）
        reasons.extend(BusinessRulesGate().evaluate(activity_dir, state))

        if not confirmed.get("implement"):
            reasons.append("自检未确认（先 state.py confirm implement）")

        return reasons
