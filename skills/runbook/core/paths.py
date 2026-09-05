# -*- coding: utf-8 -*-
"""统一路径解析器（兼容独立技能目录与 skill zip 工作区两种布局）。

身份文件（activity.json）与凭据文件（credentials.json）都是可选的：
- 有身份文件 → 状态文件名 = activityId；
- 无身份文件 → 状态机仍可运行（默认身份 workspace，见 core/io.resolve_identity）。
旧工作区的 meta.json 仅作为身份/凭据的兼容回退，不再是状态机入场券。
"""
from __future__ import annotations

from pathlib import Path

# 项目根目录（state.py / PROCESS.md 所在目录，即 runbook/ 引擎根）
PROJECT_ROOT = Path(__file__).resolve().parent.parent

PROCESS_FILE = PROJECT_ROOT / "PROCESS.md"
STATE_DIR = PROJECT_ROOT / "state"
DECISIONS_FILE_NAME = "decisions.json"


def get_process_file() -> Path:
    """流程定义文件固定为 PROCESS.md（唯一事实源，无多流程选择）。"""
    return PROCESS_FILE


def _find_up(filename: str) -> Path | None:
    """从项目根目录向上查找指定文件（最多 3 层）。

    兼容两种布局：
    - 独立技能目录：文件与 state.py 同级（runbook/ 布局）；
    - skill zip 工作区：文件在 skills/runbook/ 上一级（由宿主打包生成）。
    最多向上找 3 层，避免误食工作区之外的文件。
    """
    for depth in range(4):
        candidate = PROJECT_ROOT if depth == 0 else PROJECT_ROOT.parents[depth - 1]
        p = candidate / filename
        if p.is_file():
            return p
    return None


# 身份文件：优先 activity.json（新）；meta.json 仅作旧工作区兼容回退
ACTIVITY_FILE = _find_up("activity.json") or _find_up("meta.json")
# 云凭据文件：独立、可 gitignore、可按需轮换；不参与状态机日常命令
CREDENTIALS_FILE = _find_up("credentials.json")


def resolve_activity_dir(cli_dir: str) -> Path:
    """根据 CLI 传入的 activity_dir 路径计算绝对路径。"""
    d = Path(cli_dir)
    return d if d.is_absolute() else (Path.cwd() / d)


def get_state_path(identity: str) -> Path:
    """获取任务状态 JSON 文件路径（身份缺省时为 workspace.json）。"""
    return STATE_DIR / f"{identity}.json"


def get_decisions_path(activity_dir: Path) -> Path:
    """获取活动决策树 JSON 文件路径。"""
    return activity_dir / DECISIONS_FILE_NAME
