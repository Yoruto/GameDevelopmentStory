# -*- coding: utf-8 -*-
"""工作流状态机引擎（链驱动）。

激活链 = PROCESS.md 中非可选阶段的顺序（domain/process.py），advance/reject 沿链走；
confirm/goto 用流程定义的全部阶段（含 optional）校验。
状态身份 = activity.json 的 activityId，缺省 'workspace'（无活动身份也可运行）；
状态文件只存任务状态（activityId/status/confirmed/history），不含 flow/phases/凭据。
"""
from __future__ import annotations

from pathlib import Path

from core.io import err, load_identity, load_state, now, resolve_identity, save_state
from core.paths import get_state_path
from domain.gates.registry import GateRegistry
from domain.process import (
    all_phase_names,
    chain_next,
    chain_prev,
    load_process,
    phase_map,
    resolve_chain,
)


def init_state() -> tuple[bool, str, Path | None]:
    """初始化任务状态（不依赖 activity.json；无身份用默认 workspace）。"""
    identity = resolve_identity()
    p = get_state_path(identity)
    if p.is_file():
        return False, f"状态已存在：{p}（如需重来请人工删除该文件）", p

    flow = load_process()
    chain = resolve_chain(flow)
    first = chain[0] if chain else None
    if not first:
        return False, "流程激活链为空（检查 PROCESS.md 阶段定义）", p

    ident = load_identity() or {}
    s = {
        "activityId": identity,
        "activityName": ident.get("activityName") or "",
        "status": first,
        "confirmed": {ph: False for ph in all_phase_names(flow)},
        "history": [{
            "at": now(),
            "action": "init",
            "from": None,
            "to": first,
            "note": f"初始化任务状态（链：{' → '.join(chain)}）"
        }],
    }
    save_state(identity, s)
    return True, f"✓ 已初始化：{p}（status={first}）", p


CONFIRM_REQUIRED_KW = ("开发者", "用户")


def _evidence_from_file(activity_dir: Path, phase: str) -> bool:
    """确认记录通道：activity/confirmations/<phase>.md 存在且内容非空。"""
    try:
        f = Path(activity_dir) / "confirmations" / f"{phase}.md"
        if not f.is_file():
            return False
        return len(f.read_text(encoding="utf-8").strip()) >= 5
    except OSError:
        return False


def confirm_phase(phase: str, activity_dir: Path) -> tuple[bool, str]:
    """标记某阶段为确认状态。

    - PROCESS.md 中该阶段带「确认: 开发者确认」→ 必须提供开发者输入证据：
      activity/confirmations/<phase>.md（开发者原话）；缺证据直接拒绝，防止 Agent 自答自确认。
    - 其余阶段（自检语义）照常放行，提示中标注确认来源。
    """
    identity = resolve_identity()
    flow = load_process()
    if phase not in all_phase_names(flow):
        return False, f"未知阶段：{phase}（可选：{', '.join(all_phase_names(flow))}）"

    pdef = phase_map(flow).get(phase, {})
    confirm_kind = pdef.get("confirm_kind", "")
    needs_user = any(k in confirm_kind for k in CONFIRM_REQUIRED_KW)

    if needs_user:
        if not _evidence_from_file(activity_dir, phase):
            return False, (
                f"{phase} 需要开发者确认，但缺少确认证据。"
                f"请先获得开发者明确回复，并把其原话写入 activity/confirmations/{phase}.md，"
                f"再执行 state.py confirm {phase}。"
            )

    s = load_state(identity)
    s["confirmed"][phase] = True
    source = "开发者确认" if needs_user else "自检确认"
    s["history"].append({
        "at": now(),
        "action": f"confirm:{phase}",
        "from": s["status"],
        "to": s["status"],
        "note": source
    })
    save_state(identity, s)
    return True, f"✓ 已确认 {phase}（{source}，门禁条件之一已满足）"


def advance_phase(activity_dir: Path, note: str) -> tuple[bool, str, list[str], str, str]:
    """门禁校验通过后推进到下一个阶段。

    返回: (success, message, gate_reasons, old_phase, new_phase)
    """
    identity = resolve_identity()
    s = load_state(identity)
    flow = load_process()
    chain = resolve_chain(flow)
    phase = s["status"]
    nxt = chain_next(chain, phase)

    if nxt is None:
        return False, "已是最终阶段（done），无需 advance", [], phase, phase

    gate_res = GateRegistry.evaluate(phase, activity_dir, s)
    if not gate_res.ok:
        return False, "✗ 门禁未满足，禁止翻牌：", gate_res.reasons, phase, nxt

    s["status"] = nxt
    s["history"].append({
        "at": now(),
        "action": "advance",
        "from": phase,
        "to": nxt,
        "note": note or ""
    })
    save_state(identity, s)
    return True, f"✓ {phase} → {nxt}", [], phase, nxt


def reject_phase(to_phase: str | None, note: str) -> tuple[bool, str, str, str]:
    """阶段打回/回退。"""
    identity = resolve_identity()
    s = load_state(identity)
    flow = load_process()
    frm = s["status"]
    names = all_phase_names(flow)

    target = to_phase or chain_prev(resolve_chain(flow), frm)
    if not target:
        return False, "无可回退阶段（已是链首或处于可选阶段）", frm, frm
    if target not in names:
        return False, f"未知阶段：{target}", frm, frm

    s["status"] = target
    s["history"].append({
        "at": now(),
        "action": "reject",
        "from": frm,
        "to": target,
        "note": note or ""
    })
    save_state(identity, s)
    return True, f"↩ {frm} → {target}", frm, target


def goto_phase(target_phase: str, note: str) -> tuple[bool, str, str, str]:
    """显式跳转到任意阶段（防错/清理）。"""
    identity = resolve_identity()
    s = load_state(identity)
    flow = load_process()
    frm = s["status"]
    names = all_phase_names(flow)

    if target_phase not in names:
        return False, f"未知阶段：{target_phase}（可选：{', '.join(names)}）", "", ""

    s["status"] = target_phase
    s["history"].append({
        "at": now(),
        "action": "goto",
        "from": frm,
        "to": target_phase,
        "note": note or "显式跳转"
    })
    save_state(identity, s)
    return True, f"→ {frm} → {target_phase}", frm, target_phase


def log_note(note: str) -> tuple[bool, str]:
    """记录操作日志追加至历史。"""
    identity = resolve_identity()
    s = load_state(identity)

    s["history"].append({
        "at": now(),
        "action": "log",
        "from": s["status"],
        "to": s["status"],
        "note": note
    })
    save_state(identity, s)
    return True, "✓ 已记录"
