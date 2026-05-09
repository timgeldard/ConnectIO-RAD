from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Optional

from shared_db.core import sql_param

_IDENTIFIER_RE = re.compile(r"^[A-Za-z0-9_.]+$")


@dataclass
class QueryBuilder:
    """
    Standardized query builder for Databricks SQL cockpits.
    Handles plant filtering, pagination, and Liquid Clustering hints.
    """
    base_table: str
    columns: list[str] = field(default_factory=lambda: ["*"])
    filters: list[str] = field(default_factory=list)
    params: list[dict[str, Any]] = field(default_factory=list)
    order_by: Optional[str] = None
    limit: Optional[int] = None
    offset: Optional[int] = None
    clustering_columns: list[str] = field(default_factory=list)

    def __post_init__(self):
        if not _IDENTIFIER_RE.match(self.base_table.replace("`", "")):
            raise ValueError(f"Invalid base table identifier: {self.base_table!r}")

    def with_plant_filter(self, plant_id: Optional[str]) -> QueryBuilder:
        """Adds a PLANT_ID filter if plant_id is provided."""
        if plant_id:
            self.filters.append("PLANT_ID = :plant_id")
            self.params.append(sql_param("plant_id", plant_id))
        return self

    def with_pagination(self, limit: int, offset: int = 0) -> QueryBuilder:
        """Sets LIMIT and OFFSET."""
        self.limit = limit
        self.offset = offset
        return self

    def with_order_by(self, order_by: str) -> QueryBuilder:
        """Sets ORDER BY clause."""
        self.order_by = order_by
        return self

    def with_clustering_hint(self, *columns: str) -> QueryBuilder:
        """Adds Liquid Clustering column hints for Databricks optimization."""
        self.clustering_columns.extend(columns)
        return self

    def build(self) -> tuple[str, list[dict[str, Any]]]:
        """Returns the SQL statement and parameters."""
        cols = ", ".join(self.columns)
        
        # Liquid Clustering / Optimization hints (injected as comments or specific syntax if supported)
        # Note: Databricks Liquid Clustering is a table property, but we can add hints for the optimizer.
        hints = ""
        if self.clustering_columns:
            hints = f"/* CLUSTER BY {', '.join(self.clustering_columns)} */\n"

        sql = f"{hints}SELECT {cols}\nFROM {self.base_table}"
        
        if self.filters:
            sql += "\nWHERE " + " AND ".join(self.filters)
        
        if self.order_by:
            sql += f"\nORDER BY {self.order_by}"
            
        if self.limit is not None:
            sql += f"\nLIMIT {self.limit}"
            if self.offset is not None and self.offset > 0:
                sql += f" OFFSET {self.offset}"
                
        return sql, self.params
