"""Runtime settings for Template Module."""
from dataclasses import dataclass
import os


@dataclass(frozen=True)
class TemplateSettings:
    """Environment-backed settings for this bounded context."""

    catalog: str = os.environ.get("DATABRICKS_CATALOG", "main")
    schema: str = os.environ.get("DATABRICKS_SCHEMA", "template")
    demo_mode: bool = os.environ.get("TEMPLATE_DEMO_MODE", "1") == "1"
