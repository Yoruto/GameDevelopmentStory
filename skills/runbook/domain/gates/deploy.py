# -*- coding: utf-8 -*-
"""Deploy 部署阶段门禁策略。"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from core.io import load_credentials, load_decisions, load_identity
from domain.decisions import DEPLOYMENT_CLOUD, DEPLOYMENT_STATIC, DEPLOYMENT_UNRESOLVED, deployment_mode
from domain.gates.base import BaseGate


def is_real_activity_identity(activity_id: str) -> bool:
    """判定活动身份是否真实（可安全用于云开通）。

    技能包打包时把活动 ID 硬编码进脚本与 activity.json：
    - 未绑定活动时占位符 `app_3c72f55c0c` 未被替换 → 拒绝；
    - 旧工作区默认身份 `workspace` → 拒绝（曾导致误开通远程环境）；
    - 合法活动 ID 形如 `app_*` / `project-*`，仅需排除占位符与默认值。
    """
    raw = str(activity_id or "").strip()
    if not raw:
        return False
    if raw.startswith("__") or raw == "workspace":
        return False
    if any(ch.isspace() for ch in raw) or "/" in raw:
        return False
    return True


class DeployGate(BaseGate):
    """部署阶段门禁。

    只拦「云部署且无真实活动身份/部署目标」：
    - 纯静态（STATIC）不拦云身份——允许不使用云部署的包正常走预览/交付；
    - 云部署（CLOUD）必须同时满足：真实活动身份（activity.json） + 明确的部署目标（credentials.json.envId）。
    """

    def evaluate(self, activity_dir: Path, state: dict[str, Any]) -> list[str]:
        confirmed = state.get("confirmed", {})
        reasons: list[str] = []

        mode = deployment_mode(load_decisions(activity_dir) or {})
        if mode == DEPLOYMENT_UNRESOLVED:
            reasons.append("部署模式未决（先 state.py decide 确认「云服务：需要/不需要」）")
        elif mode == DEPLOYMENT_STATIC and not (activity_dir / "deploy-note.md").is_file():
            reasons.append("缺少 activity/deploy-note.md（无云模式需声明无需部署）")
        elif mode == DEPLOYMENT_CLOUD:
            identity = load_identity() or {}
            activity_id = str(identity.get("activityId") or "").strip()
            if not is_real_activity_identity(activity_id):
                reasons.append(
                    "云部署缺少真实活动身份：activity.json 的 activityId 未绑定（占位符未替换或为默认 workspace），"
                    "禁止用默认身份开通云环境；请从平台重新下载绑定活动的技能包"
                )
            creds = load_credentials() or {}
            env_id = str(creds.get("envId") or "").strip()
            if not env_id:
                reasons.append("部署目标未明确：缺少 credentials.json 的 envId（先运行 query-cloudbase.js 只读复用环境，或向开发者索取环境链接/ID 后回写 envId）")

        if not confirmed.get("deploy"):
            reasons.append("部署自检未确认（先 state.py confirm deploy）")

        return reasons
