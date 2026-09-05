# -*- coding: utf-8 -*-
"""门禁抽象基类（手写 Gate 模式）。"""
from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any


class BaseGate(ABC):
    """阶段门禁校验策略接口。"""

    @abstractmethod
    def evaluate(self, activity_dir: Path, state: dict[str, Any]) -> list[str]:
        """校验门禁条件。返回未满足的原因列表（若为空代表完全通过）。"""
        pass
