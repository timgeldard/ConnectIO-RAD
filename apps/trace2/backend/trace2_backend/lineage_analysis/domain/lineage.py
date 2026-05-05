"""
Domain models for lineage analysis.
"""

from typing import Literal


LineageDirection = Literal["bottom_up", "top_down"]


class LineageDepth(int):
    """
    Value object for lineage depth.
    Clamps value between 1 and 10.
    """
    def __new__(cls, value: int = 4):
        clamped_value = max(1, min(10, value))
        return super().__new__(cls, clamped_value)
