# -*- coding: utf-8 -*-
"""安全 I/O 与持久化模块。

身份与凭据分离：
- load_identity()    → activity.json（可选；旧 meta.json 兼容回退），仅活动身份
- load_credentials() → credentials.json（可选；旧 meta.json 云字段兼容回退），仅部署阶段
- resolve_identity() → 状态身份：有 activityId 用之，否则 'workspace'
状态机日常命令只碰身份，不碰凭据。
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from core.paths import ACTIVITY_FILE, CREDENTIALS_FILE, STATE_DIR, get_decisions_path, get_state_path


def now() -> str:
    """返回当前 UTC ISO 8601 时间戳。"""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def err(msg: str) -> int:
    """输出错误提示并返回错误码 1。"""
    print(f"✗ {msg}", file=sys.stderr)
    return 1


def _read_json_file(p: Path) -> dict[str, Any] | None:
    """读取 JSON 文件；不存在/解析失败返回 None。"""
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return data if isinstance(data, dict) else None


def load_identity() -> dict[str, Any] | None:
    """读取活动身份（activityId/activityName/alias）。

    来源：activity.json（推荐）或旧 meta.json（兼容回退）。
    文件缺失/损坏/无 activityId 均返回 None——状态机仍可运行（默认身份）。
    """
    if ACTIVITY_FILE is None:
        return None
    data = _read_json_file(ACTIVITY_FILE)
    if data is None:
        return None
    project = data.get("project") if isinstance(data.get("project"), dict) else {}
    identity = {
        "activityId": str(project.get("id") or data.get("activityId") or "").strip(),
        "activityName": str(project.get("name") or data.get("activityName") or "").strip(),
        "alias": str(project.get("alias") or data.get("alias") or "").strip(),
    }
    return identity if identity["activityId"] else None


def load_credentials() -> dict[str, Any] | None:
    """读取云服务凭据（envId/apiKey/stsCredentials/icebergServerUrl）。

    来源：credentials.json（推荐）或旧 meta.json 的云字段（兼容回退）。
    仅部署/冒烟阶段调用；日常状态机命令不要读取。
    缺失时返回 None，表示「本任务不需要云服务或凭据未注入」。
    """
    source = CREDENTIALS_FILE if CREDENTIALS_FILE is not None else ACTIVITY_FILE
    if source is None:
        return None
    data = _read_json_file(source)
    if data is None:
        return None
    creds = {
        "envId": str(data.get("envId") or "").strip(),
        "apiKey": str(data.get("apiKey") or "").strip(),
        "stsCredentials": data.get("stsCredentials") or None,
        "icebergServerUrl": str(data.get("icebergServerUrl") or "").strip(),
    }
    return creds if (creds["envId"] or creds["apiKey"] or creds["icebergServerUrl"]) else None


def resolve_identity() -> str:
    """返回状态身份：有活动身份用 activityId，否则用固定默认 'workspace'。"""
    identity = load_identity()
    return identity["activityId"] if identity else "workspace"


def load_state(identity: str) -> dict[str, Any]:
    """读取已保存的任务状态文件。"""
    p = get_state_path(identity)
    if not p.is_file():
        sys.exit(err(f"状态未初始化：{p}（先运行 state.py init）"))
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        sys.exit(err(f"状态文件损坏：{p}"))


def save_state(identity: str, state: dict[str, Any]) -> None:
    """原子化更新并保存任务状态文件。"""
    state["updatedAt"] = now()
    p = get_state_path(identity)
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_decisions(activity_dir: Path) -> dict[str, Any] | None:
    """读取 activity/decisions.json。不存在或损坏返回 None。"""
    p = get_decisions_path(activity_dir)
    if not p.is_file():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def save_decisions(activity_dir: Path, dec: dict[str, Any]) -> None:
    """保存决策树数据至 activity/decisions.json。"""
    p = get_decisions_path(activity_dir)
    activity_dir.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(dec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
