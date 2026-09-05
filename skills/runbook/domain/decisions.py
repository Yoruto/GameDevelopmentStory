# -*- coding: utf-8 -*-
"""runbook 决策树与依赖图引擎。"""
from __future__ import annotations

from pathlib import Path
from typing import Any

# 云服务部署技能目录名（活动云交付技能 act-cloudbase）。技能包按用户选择打包：
# 选中才出现在 <workspace>/skills/<id>/，未选中则用户没有云部署能力。
CLOUD_SKILL_DIR = "act-cloudbase"


def by_id(dec: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """将决策字典列表转换为按 ID 索引的映射。"""
    return {d["id"]: d for d in dec.get("decisions", [])}


def frontier(dec: dict[str, Any]) -> list[str]:
    """计算当前处于前沿、可供提问的 open 状态决策列表。

    排序规则：业务决策在前、雏形引导（kind=prototype）在后——只要还有其它
    open 决策未定，雏形节点就不进入前沿，保证需求轮第一轮只问业务、
    第二轮才问「要不要先看个雏形模板」。
    """
    mapping = by_id(dec)
    others: list[str] = []
    prototypes: list[str] = []
    for d in dec.get("decisions", []):
        if d.get("status") != "open":
            continue
        # 前置依赖必须均为 resolved
        if not all(mapping.get(dep, {}).get("status") == "resolved" for dep in d.get("depends_on", [])):
            continue
        # 条件依赖 (if_choice) 必须匹配
        ic = d.get("if_choice") or {}
        if not all(mapping.get(k, {}).get("choice") == v for k, v in ic.items()):
            continue
        (prototypes if d.get("kind") == PROTOTYPE_KIND else others).append(d["id"])
    return others + prototypes


def prune_inapplicable(dec: dict[str, Any]) -> list[str]:
    """把条件不适用/前置被跳过的 open 决策级联标记为 skipped。

    仅在决策 resolve 后调用：某个决策落定后，if_choice 条件不再匹配
    或依赖链上出现 skipped 的 open 决策，永远不可能被提问，必须跳过，
    否则 open_count 会把它们算作未决导致门禁死锁。
    返回本次被跳过（或保持 skipped）的决策 id 列表。
    """
    mapping = by_id(dec)
    skipped: list[str] = []
    changed = True
    while changed:
        changed = False
        for d in dec.get("decisions", []):
            if d.get("status") != "open":
                continue
            deps = d.get("depends_on", [])
            dep_states = [mapping.get(x, {}).get("status") for x in deps]
            if "skipped" in dep_states:
                d["status"] = "skipped"
                d["note"] = "前置决策不适用，级联跳过"
                skipped.append(d["id"])
                changed = True
                continue
            if not all(st == "resolved" for st in dep_states):
                continue  # 前置未决，继续等待
            ic = d.get("if_choice") or {}
            if not all(mapping.get(k, {}).get("choice") == v for k, v in ic.items()):
                d["status"] = "skipped"
                d["note"] = "条件不适用（决策已落定且未满足 if_choice）"
                skipped.append(d["id"])
                changed = True
    return skipped


def open_count(dec: dict[str, Any]) -> int:
    """统计当前尚未决定的 open 决策总数。"""
    return sum(1 for d in dec.get("decisions", []) if d.get("status") == "open")


DEPLOYMENT_CLOUD = "CLOUD"
DEPLOYMENT_STATIC = "STATIC"
DEPLOYMENT_UNRESOLVED = "UNRESOLVED"
# 部署节点专用状态：静态预览确认后再向开发者引导式确认存储方式（云端保存/本地保存），
# 需求阶段不进入前沿、不计数。
DEPLOYMENT_DEFERRED = "deferred"

# 雏形引导决策节点：新建场景（工作区无既有 h5/index.html）必须问「要不要先看个雏形模板」，
# 由 state.py decide 落定后才允许收敛进 plan；已有 HTML 的改造场景不生成该节点。
PROTOTYPE_KIND = "prototype"


def deployment_mode(dec: dict[str, Any]) -> str:
    """返回部署模式：CLOUD / STATIC / UNRESOLVED。

    - resolved 且 choice=A → CLOUD（云端保存，需云服务能力）
    - resolved 且 choice=B → STATIC（本地保存；无云技能预填时必须带 note 依据）
    - deferred / 缺失 / 未决 / 非法选项 → UNRESOLVED（fail-closed；deferred 表示
      预览确认后再问，未落定前禁止静默按云模式走）
    """
    for d in dec.get("decisions", []):
        if d.get("kind") == "deployment":
            if d.get("status") != "resolved":
                return DEPLOYMENT_UNRESOLVED
            choice = d.get("choice")
            if choice == "A":
                return DEPLOYMENT_CLOUD
            if choice == "B":
                return DEPLOYMENT_STATIC
            return DEPLOYMENT_UNRESOLVED
    return DEPLOYMENT_UNRESOLVED


def deployment_node(dec: dict[str, Any]) -> dict[str, Any] | None:
    """返回部署决策节点（kind=deployment）；不存在返回 None。"""
    for d in dec.get("decisions", []):
        if d.get("kind") == "deployment":
            return d
    return None


def deployment_deferred(dec: dict[str, Any]) -> bool:
    """部署节点是否已推迟到静态预览确认后（status=deferred）。"""
    d = deployment_node(dec)
    return d is not None and d.get("status") == DEPLOYMENT_DEFERRED


def deployment_skipped(dec: dict[str, Any]) -> bool:
    """部署节点是否处于 skipped（异常态）。

    部署决策不允许条件剪枝：只要技能包含云服务能力就必问，部署节点禁止配置
    if_choice；若节点意外被 prune/手改标记为 skipped，说明 decisions.json 被
    破坏，门禁应 fail-loud 给出明确提示，而不是把它当作「无需确认」放行。
    """
    d = deployment_node(dec)
    return d is not None and d.get("status") == "skipped"


def prototype_node(dec: dict[str, Any]) -> dict[str, Any] | None:
    """返回雏形引导决策节点（kind=prototype）；不存在返回 None。"""
    for d in dec.get("decisions", []):
        if d.get("kind") == PROTOTYPE_KIND:
            return d
    return None


def prototype_resolved(dec: dict[str, Any]) -> bool:
    """雏形引导是否已由开发者落定（resolved）。

    新建场景门禁要求：开发者明确答复「要不要先看个雏形模板」并 decide 后才能收敛；
    未落定（缺失/未决/异常）一律视为未问。
    """
    d = prototype_node(dec)
    return d is not None and d.get("status") == "resolved"


def is_new_generation(activity_dir: Path | None) -> bool:
    """是否为新建场景（工作区根目录尚无 h5/index.html）。

    已有改造（开发者主动给了例子 HTML）→ 文件已存在 → 不需要雏形引导提问；
    新建 → 文件不存在 → 必须先问雏形再生成预览。
    """
    if activity_dir is None:
        return True
    return not (activity_dir.parent / "h5" / "index.html").is_file()


def has_cloud_skill(activity_dir: Path | None) -> bool:
    """用户技能包是否包含云服务部署技能（act-cloudbase）。

    打包工作区布局：技能位于 <workspace>/skills/<skill-id>/，runbook 引擎在
    <workspace>/skills/runbook/ 下；activity_dir（默认 <workspace>/activity）的上一级
    即工作区根。技能未选中 → 不进包 → 用户没有云部署能力，此时部署决策不问、
    默认本地存储，并必须主动告知用户（写入需求单「本地存储告知」，门禁强制）。
    """
    if activity_dir is None:
        return False
    return (activity_dir.parent / "skills" / CLOUD_SKILL_DIR).is_dir()


def deployment_confirmed(dec: dict[str, Any]) -> bool:
    """部署决策是否已由开发者确认（resolved 且已 present）。

    用户技能包含云服务能力时，门禁要求部署决策必须经过 present → decide 落定，
    禁止 Agent 用「推导依据」预填 choice=B 代开发者拍板。
    """
    for d in dec.get("decisions", []):
        if d.get("kind") == "deployment":
            return d.get("status") == "resolved" and d.get("presented") is True
    return False
