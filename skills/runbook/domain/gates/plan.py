# -*- coding: utf-8 -*-
"""Plan 方案确认阶段门禁策略。"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from core.io import load_decisions
from domain.decisions import (
    DEPLOYMENT_UNRESOLVED,
    deployment_confirmed,
    deployment_mode,
    deployment_skipped,
    has_cloud_skill,
    prototype_node,
    prototype_resolved,
)
from domain.gates.base import BaseGate


class PlanGate(BaseGate):
    """方案确认阶段门禁。"""

    def evaluate(self, activity_dir: Path, state: dict[str, Any]) -> list[str]:
        confirmed = state.get("confirmed", {})
        reasons: list[str] = []

        # h5/ 位于工作区根目录（activity_dir 的上一级），不在 activity/ 产物目录下
        if not (activity_dir.parent / "h5" / "index.html").is_file():
            reasons.append("缺少 h5/index.html")
        if not confirmed.get("plan"):
            reasons.append("开发者未回复「确认」确认单（先 state.py confirm plan）")

        dec = load_decisions(activity_dir)
        if dec is not None:
            # 第二道防线：决策树里存在雏形节点（新建场景生成）但未落定 → 禁止进 implement。
            # plan 阶段 h5 已生成，无法再用文件存在性判断新建/改造，以节点存在性为准；
            # 已有改造场景不生成该节点，不受此限制。
            if prototype_node(dec) is not None and not prototype_resolved(dec):
                reasons.append("新建场景的雏形引导未落定：必须先向开发者问「要不要先看个雏形模板」并 decide（A=要看/B=不用）")
        if dec is not None and has_cloud_skill(activity_dir):
            if deployment_skipped(dec):
                reasons.append("部署节点状态异常（skipped）：部署决策不允许条件剪枝，请检查 activity/decisions.json（部署节点禁止配置 if_choice）")
            elif deployment_mode(dec) == DEPLOYMENT_UNRESOLVED:
                reasons.append("部署决策未确认（静态预览获得开发者确认后、进入技术方案设计前，必须先向开发者引导式确认存储方式——讲清云端保存/本地保存的区别并按实际给推荐，present 后等开发者回复再 decide）")
            elif not deployment_confirmed(dec):
                reasons.append("部署决策未经开发者确认（技能包含云服务能力：必须 present 后 decide，禁止用推导依据代开发者拍板）")

        return reasons
