"""解析管道统一契约（对应 docs/PLAN.md §6.2 Parser Interface）。

所有解析器（RuleParser / AgnesParser / 未来的 VisionParser）都实现
ParserInterface.parse(content) -> ParseResult，业务层只依赖这个契约，
切换实现只需改配置，无需改动路由与数据层。
"""

from abc import ABC, abstractmethod
from typing import Any, TypedDict


class ParseResult(TypedDict):
    item: str | None
    location: str | None
    placed_at: str | None
    note: str | None
    confidence: float


class ParserInterface(ABC):
    """解析器接口：输入用户自然语言，输出结构化存放信息。"""

    name: str = "base"

    @abstractmethod
    def parse(self, content: str) -> dict[str, Any]:
        """返回 ParseResult 形状的 dict。"""
        raise NotImplementedError
