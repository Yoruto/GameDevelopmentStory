# -*- coding: utf-8 -*-
"""Requirements 需求阶段门禁策略。"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from core.io import load_decisions
from domain.decisions import (
    DEPLOYMENT_UNRESOLVED,
    deployment_confirmed,
    deployment_deferred,
    deployment_mode,
    deployment_skipped,
    has_cloud_skill,
    is_new_generation,
    open_count,
    prototype_resolved,
)
from domain.gates.base import BaseGate


class RequirementsGate(BaseGate):
    """需求阶段门禁。"""

    def evaluate(self, activity_dir: Path, state: dict[str, Any]) -> list[str]:
        confirmed = state.get("confirmed", {})
        reasons: list[str] = []

        req_file = activity_dir / "requirements.md"
        req_text = req_file.read_text(encoding="utf-8") if req_file.is_file() else ""
        if not req_text:
            reasons.append("缺少 activity/requirements.md")
        elif "静默假设" not in req_text:
            reasons.append("需求单缺少「静默假设」清单（未问即默认的假设必须呈现）")

        dec = load_decisions(activity_dir)
        if dec is None:
            reasons.append("缺少 activity/decisions.json（需求阶段用 state.py decide 维护决策树）")
        else:
            cloud_skill = has_cloud_skill(activity_dir)
            if deployment_skipped(dec):
                # 部署决策不允许条件剪枝：被 skipped 说明 decisions.json 异常（如误配
                # if_choice 或手改），fail-loud，禁止当作「无需确认」静默放行。
                reasons.append("部署节点状态异常（skipped）：部署决策不允许条件剪枝，请检查 activity/decisions.json（部署节点禁止配置 if_choice）")
            elif deployment_deferred(dec):
                # 部署/数据存储确认按设计推迟到静态预览确认后（技术方案设计前），
                # requirements 阶段不拦截，也禁止在此轮问雏形+存储两个问题。
                pass
            elif deployment_mode(dec) == DEPLOYMENT_UNRESOLVED:
                if cloud_skill:
                    reasons.append("部署节点应标记为 deferred（数据存储确认留到静态预览确认后的技术方案设计阶段，需求轮禁止同时问雏形+存储两个问题）")
                else:
                    reasons.append("部署决策未落定（技能包不含云服务技能：应预填 choice=B 并写 note 依据，禁止提问云服务）")
            elif cloud_skill and not deployment_confirmed(dec):
                reasons.append("部署决策未经开发者确认（技能包含云服务能力：必须 present 后 decide，禁止用推导依据代开发者拍板）")
            if not cloud_skill and "本地存储告知" not in req_text:
                reasons.append("技能包不含云服务技能：需求单「部署决策」节必须写入「本地存储告知」（无云服务能力必须主动告知用户只能本地存储，门禁强制，禁止静默）")
            # 雏形引导门禁：新建场景（工作区无既有 h5/index.html）必须先问
            # 「要不要先看个雏形模板」并由开发者落定，禁止一轮业务问题后直接收敛生成预览；
            # 已有 HTML 的改造场景不生成 prototype 节点，不受此限制。
            if is_new_generation(activity_dir) and not prototype_resolved(dec):
                reasons.append("新建场景必须先问「要不要先看个雏形模板」：决策树需含 kind=prototype 节点（A=要看/B=不用），present 后等开发者回复再 decide；已有 HTML 的改造场景不生成该节点")
            n = open_count(dec)
            if n > 0:
                reasons.append(f"仍有 {n} 个未决决策（先 state.py tree 看前沿，再用 state.py decide 逐项确认）")

        if not confirmed.get("requirements"):
            reasons.append("开发者未确认需求（先 state.py confirm requirements）")

        return reasons
