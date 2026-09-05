# -*- coding: utf-8 -*-
"""基础类型定义。

阶段顺序不在此硬编码：流程定义见 PROCESS.md（唯一事实源，
domain/process.py 解析），激活链 = 非可选阶段的文件顺序。
身份与凭据分离：IdentityData 仅活动身份；云凭据见 core/io.load_credentials。
"""
from __future__ import annotations

from typing import NamedTuple, TypedDict


class GateResult(NamedTuple):
    """阶段门禁检查结果。"""
    ok: bool
    reasons: list[str]


class IdentityData(TypedDict, total=False):
    """活动身份（activity.json，非敏感，可随仓库）。"""
    activityId: str
    activityName: str
    alias: str


class HistoryRecord(TypedDict, total=False):
    at: str
    action: str
    from_phase: str  # JSON key is "from"
    to_phase: str    # JSON key is "to"
    note: str
