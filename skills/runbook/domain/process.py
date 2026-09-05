# -*- coding: utf-8 -*-
"""流程定义：PROCESS.md 是唯一事实源（trellis 风格，无独立机器文件）。

机器从 PROCESS.md 的 `[phase:名称]` 块解析阶段顺序与字段；阶段顺序 = 文件顺序，
不存在多流程选择（无 flow 概念）。门禁由 domain/gates/ 手写 Gate 按阶段名评估。

阶段块字段：
    目标 / 产出 / 产出文件 / 禁止 / 参考 / 输入 / 为什么
    可选: 是  → 不在 advance 链上，仅 goto 进入
"""
from __future__ import annotations

import re
import sys
from typing import Any

from core.io import err
from core.paths import get_process_file

_PHASE_RE = re.compile(r"\[phase:([^\]]+)\](.*?)\[/phase:\1\]", re.DOTALL)
_FIELD_RE = re.compile(r"^([^:：]{1,20}):\s*(.*)$")

_FIELD_KEY_MAP = {
    "目标": "goal",
    "执行步骤": "steps",
    "产出": "outputs",
    "产出文件": "artifacts",
    "禁止": "forbidden",
    "参考": "references",
    "输入": "read_scope",
    "为什么": "why",
    "可选": "optional",
    "确认": "confirm_kind",
}


def _parse_phase_block(name: str, body: str) -> dict[str, Any]:
    phase: dict[str, Any] = {"name": name, "artifacts": [], "optional": False}
    for raw in body.splitlines():
        line = raw.strip()
        if not line:
            continue
        m = _FIELD_RE.match(line)
        if not m:
            continue
        key = _FIELD_KEY_MAP.get(m.group(1).strip())
        if key is None:
            continue
        value = m.group(2).strip()
        if key == "artifacts":
            phase["artifacts"] = [p.strip() for p in value.split(",") if p.strip()]
        elif key == "optional":
            phase["optional"] = "是" in value
        else:
            phase[key] = value
    return phase


def load_process() -> dict[str, Any]:
    """从 PROCESS.md 解析流程定义。缺失/损坏时报错退出。"""
    p = get_process_file()
    if not p.is_file():
        sys.exit(err(f"缺少流程定义文件：{p}"))
    try:
        text = p.read_text(encoding="utf-8")
    except OSError as exc:
        sys.exit(err(f"流程定义读取失败：{p}（{exc}）"))

    phases = [
        _parse_phase_block(name, body)
        for name, body in _PHASE_RE.findall(text)
    ]
    if not phases:
        sys.exit(err(f"流程定义中没有 [phase:...] 块：{p}"))
    return {
        "id": "process",
        "name": p.stem,
        "phases": phases,
    }


def phase_map(flow: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {p["name"]: p for p in flow["phases"] if p.get("name")}


def resolve_chain(flow: dict[str, Any], ctx: dict[str, Any] | None = None) -> list[str]:
    """激活链 = 文件中非可选阶段的顺序（可选阶段仅 goto 进入）。"""
    return [p["name"] for p in flow["phases"] if not p.get("optional")]


def all_phase_names(flow: dict[str, Any]) -> list[str]:
    """全部阶段名（含 optional），供 confirm/goto 校验。"""
    return [p["name"] for p in flow["phases"] if p.get("name")]


def chain_next(chain: list[str], phase: str) -> str | None:
    try:
        i = chain.index(phase)
    except ValueError:
        return None
    return chain[i + 1] if i + 1 < len(chain) else None


def chain_prev(chain: list[str], phase: str) -> str | None:
    try:
        i = chain.index(phase)
    except ValueError:
        return None
    return chain[i - 1] if i > 0 else None


def render_phase(phase: dict[str, Any]) -> str:
    """把阶段渲染成 current 注入/advance 后展示的指引文本。"""
    lines = []
    goal = phase.get("goal", "")
    if goal:
        lines.append(f"目标: {goal}")
    steps = phase.get("steps", "")
    if steps:
        lines.append("执行步骤:")
        for i, step in enumerate(s.strip() for s in steps.split("|") if s.strip()):
            lines.append(f"  {i + 1}. {step}")
    fields = [
        ("产出", phase.get("outputs", "")),
        ("产出文件", ", ".join(phase.get("artifacts") or [])),
        ("禁止", phase.get("forbidden", "")),
        ("参考", phase.get("references", "")),
        ("输入", phase.get("read_scope", "")),
        ("确认", phase.get("confirm_kind", "")),
    ]
    lines.extend(f"{k}: {v}" for k, v in fields if v)
    why = phase.get("why")
    if why:
        lines.append(f"为什么: {why}")
    return "\n".join(lines)
