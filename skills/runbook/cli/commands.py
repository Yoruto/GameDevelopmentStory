# -*- coding: utf-8 -*-
"""CLI 命令逻辑处理器。"""
from __future__ import annotations

import json
import sys

from core.io import err, load_decisions, load_identity, load_state, resolve_identity, save_decisions
from core.paths import get_state_path, resolve_activity_dir
from domain.decisions import (
    by_id,
    deployment_mode,
    frontier,
    open_count,
    prune_inapplicable,
)
from domain.gates.registry import GateRegistry
from domain.process import (
    chain_next,
    load_process,
    phase_map,
    render_phase,
    resolve_chain,
)
from domain.state_machine import (
    advance_phase,
    confirm_phase,
    goto_phase,
    init_state,
    log_note,
    reject_phase,
)


def cmd_init(cli_dir: str) -> int:
    ok, msg, p = init_state()
    if not ok:
        return err(msg)
    flow = load_process()
    chain = resolve_chain(flow)
    print(msg)
    print(f"流程：{' → '.join(chain)}")
    print(f"下一步：进入 {chain[0]} 阶段，先读对应 references 澄清需求")
    return 0


def cmd_current(json_out: bool, cli_dir: str) -> int:
    identity = resolve_identity()
    p = get_state_path(identity)
    if not p.is_file():
        return err(f"状态未初始化：{p}（先运行 state.py init）")

    s = load_state(identity)
    phase = s["status"]
    adir = resolve_activity_dir(cli_dir)

    flow = load_process()
    pmap = phase_map(flow)
    phase_def = pmap.get(phase, {})
    chain = resolve_chain(flow)
    body = render_phase(phase_def) or "Refer to PROCESS.md 中该阶段定义。"
    gate_res = GateRegistry.evaluate(phase, adir, s)
    mode = deployment_mode(load_decisions(adir) or {})
    mode_label = {"CLOUD": "需要云", "STATIC": "不需要云", "UNRESOLVED": "未定"}.get(mode, mode)
    ident = load_identity() or {}
    nxt = chain_next(chain, phase)
    if not gate_res.ok:
        next_command = "补齐门禁缺口后重跑 state.py current"
    elif nxt:
        next_command = f"state.py advance（进入 {nxt}）"
    else:
        next_command = "已是最终阶段（done）"

    if json_out:
        out = {
            "activityId": identity,
            "activityName": s.get("activityName") or ident.get("activityName") or "",
            "alias": ident.get("alias") or "",
            "chain": chain,
            "next": nxt,
            "phase": phase,
            "mode": mode,
            "guidance": body,
            "gate_ok": gate_res.ok,
            "gate_reasons": gate_res.reasons,
            "confirmed": s.get("confirmed", {}),
            "next_command": next_command,
        }
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 0

    print("<workflow-state>")
    print(f"Activity: {identity}（{s.get('activityName') or '未绑定活动身份'}）")
    print(f"Phase: {phase}（链：{' → '.join(chain)}）")
    print(f"部署模式: {mode_label}")
    print(body)
    print("</workflow-state>")

    if phase == "requirements":
        dec = load_decisions(adir)
        if dec is not None:
            fr = frontier(dec)
            print(f"[决策树] 未决 {open_count(dec)}，前沿 {fr if fr else '∅（可确认需求）'}")

    if not gate_res.ok:
        print("\n门禁未满足，禁止 advance：")
        for r in gate_res.reasons:
            print(f"  - {r}")
    else:
        print("\n门禁已满足")
    print(f"下一步命令: {next_command}")
    return 0


def cmd_confirm(phase: str, cli_dir: str) -> int:
    adir = resolve_activity_dir(cli_dir)
    ok, msg = confirm_phase(phase, adir)
    if not ok:
        return err(msg)
    print(msg)
    return 0


def cmd_advance(note: str, cli_dir: str) -> int:
    adir = resolve_activity_dir(cli_dir)
    ok, msg, reasons, old_p, new_p = advance_phase(adir, note)
    if not ok:
        print(msg)
        for r in reasons:
            print(f"  - {r}")
        return 1

    print(msg)
    body = render_phase(phase_map(load_process()).get(new_p, {}))
    if body:
        print(body)
    return 0


def cmd_reject(to_phase: str | None, note: str, cli_dir: str) -> int:
    ok, msg, old_p, new_p = reject_phase(to_phase, note)
    if not ok:
        return err(msg)
    print(msg)
    return 0


def cmd_goto(phase: str, note: str, cli_dir: str) -> int:
    ok, msg, old_p, new_p = goto_phase(phase, note)
    if not ok:
        return err(msg)
    print(msg)
    return 0


def cmd_log(note: str, cli_dir: str) -> int:
    ok, msg = log_note(note)
    if not ok:
        return err(msg)
    print(msg)
    return 0


def cmd_tree(json_out: bool, cli_dir: str) -> int:
    adir = resolve_activity_dir(cli_dir)
    dec = load_decisions(adir)
    if dec is None:
        return err("缺少 activity/decisions.json（requirements 阶段用 state.py decide 记录决策树）")

    fr = frontier(dec)
    if json_out:
        out = {
            "destination": dec.get("destination"),
            "open": open_count(dec),
            "frontier": fr,
            "decisions": dec.get("decisions", []),
        }
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 0

    print(f"目的地: {dec.get('destination') or '（未填）'}")
    n_skipped = sum(1 for d in dec.get("decisions", []) if d.get("status") == "skipped")
    fr_txt = fr if fr else ('∅（无待问，可确认需求）' if n_skipped == 0 else f'∅（{n_skipped} 项条件不适用已跳过，可确认需求）')
    print(f"未决: {open_count(dec)}  前沿: {fr_txt}")
    for d in dec.get("decisions", []):
        dep = ",".join(d.get("depends_on", [])) or "-"
        ch = f" → 选 {d['choice']}" if d.get("choice") else ""
        shown = "" if d.get("presented") else " ·未展示"
        skip_note = f"（{d['note']}）" if d.get("status") == "skipped" and d.get("note") else ""
        print(f"  [{d['id']}]{shown} {d['question']}  [{d['status']}]{ch}{skip_note}  依赖:{dep}")

    if fr:
        first = next(d for d in dec["decisions"] if d["id"] == fr[0])
        print(f"下一个该问: {first['id']} {first['question']}（推荐 {first.get('recommend')}）")
    return 0


def cmd_decide(did: str, choice: str, note: str, cli_dir: str) -> int:
    adir = resolve_activity_dir(cli_dir)
    dec = load_decisions(adir)
    if dec is None:
        return err("缺少 activity/decisions.json")

    mapping = by_id(dec)
    d = mapping.get(did)
    if d is None:
        return err(f"未知决策：{did}")

    if choice not in d.get("options", {}):
        return err(f"非法选项：{choice}（可选：{', '.join(d['options'])}）")

    for dep in d.get("depends_on", []):
        if mapping.get(dep, {}).get("status") != "resolved":
            return err(f"前置决策未定：{dep}（先 state.py decide {dep} …）")

    ic = d.get("if_choice") or {}
    for k, v in ic.items():
        if mapping.get(k, {}).get("choice") != v:
            return err(f"决策 {k} 未按「{v}」选择，本决策不适用（{did}）")

    if d.get("presented") is not True:
        return err(
            f"该问题尚未向开发者展示：{did}（先 state.py present {did}，"
            f"或 state.py present --frontier 标记当前前沿；未展示的决策禁止代答）"
        )

    d["status"] = "resolved"
    d["choice"] = choice
    d["note"] = note or d.get("note", "")
    skipped = prune_inapplicable(dec)
    save_decisions(adir, dec)

    print(f"✓ {did} → {choice}（{d['options'][choice]}）")
    if skipped:
        print(f"↷ 条件不适用，自动跳过: {', '.join(skipped)}")
    fr = frontier(dec)
    if fr:
        first = next(x for x in dec["decisions"] if x["id"] == fr[0])
        print(f"新前沿: {fr}")
        print(f"下一个该问: {first['id']} {first['question']}（推荐 {first.get('recommend')}）")
    else:
        print("✓ 待定已清空，可确认需求单（requirements 门禁该条已满足）")
    return 0


def cmd_present(ids: list[str] | None, frontier_flag: bool, cli_dir: str) -> int:
    """把决策标记为「已向开发者展示」。ids 为空且 --frontier 时标记当前前沿全部。"""
    adir = resolve_activity_dir(cli_dir)
    dec = load_decisions(adir)
    if dec is None:
        return err("缺少 activity/decisions.json")

    mapping = by_id(dec)
    target: list[str] = []
    if frontier_flag:
        target = frontier(dec)
    elif ids:
        target = ids
    else:
        return err("用法：state.py present <id...>（如 present D1 D2）或 state.py present --frontier")

    if frontier_flag and not target:
        print("当前前沿为空，无需标记展示。")
        return 0

    unknown = [i for i in target if i not in mapping]
    if unknown:
        return err(f"未知决策：{', '.join(unknown)}")

    for i in target:
        mapping[i]["presented"] = True
    save_decisions(adir, dec)

    shown = ", ".join(f"{i}·{mapping[i]['question'][:14]}…" if len(mapping[i]['question']) > 14 else f"{i}·{mapping[i]['question']}" for i in target)
    print(f"✓ 已标记展示：{', '.join(target)}")
    fr = frontier(dec)
    unpresented = [i for i in fr if mapping[i].get("presented") is not True]
    if unpresented:
        print(f"仍有未展示的前沿：{unpresented}（先 present 再 decide）")
    else:
        print("前沿均已展示，可等开发者回复后 decide。")
    return 0


def main() -> int:
    from cli.parser import build_parser

    parser = build_parser()
    args = parser.parse_args()

    if args.command == "init":
        return cmd_init(args.activity_dir)
    if args.command == "current":
        return cmd_current(args.json, args.activity_dir)
    if args.command == "confirm":
        if not args.arg:
            return err("用法：state.py confirm <phase>")
        return cmd_confirm(args.arg, args.activity_dir)
    if args.command == "advance":
        return cmd_advance(args.note, args.activity_dir)
    if args.command == "reject":
        return cmd_reject(args.to, args.note, args.activity_dir)
    if args.command == "goto":
        if not args.arg:
            return err("用法：state.py goto <phase>")
        return cmd_goto(args.arg, args.note, args.activity_dir)
    if args.command == "log":
        if not args.arg:
            return err("用法：state.py log <备注>")
        return cmd_log(args.arg, args.activity_dir)
    if args.command == "tree":
        return cmd_tree(args.json, args.activity_dir)
    if args.command == "present":
        ids = [args.arg] + ([args.arg2] if args.arg2 else [])
        return cmd_present([i for i in ids if i] or None, args.frontier, args.activity_dir)
    if args.command == "decide":
        if not args.arg or not args.arg2:
            return err("用法：state.py decide <决策id> <选项>，如 state.py decide D3 A")
        return cmd_decide(args.arg, args.arg2, args.note, args.activity_dir)
    if args.command == "clean":
        from scripts.clean import clean_environment
        return clean_environment(args.activity_dir)

    return 0
