# 📊 Data Contracts & Unity Catalog Usage

This document defines how we interact with Databricks Unity Catalog and maintain high-fidelity data contracts between SAP and the ConnectIO-RAD platform.

---

## 🏛️ Unity Catalog Structure

We follow the **Medallion Architecture** (Bronze, Silver, Gold). ConnectIO-RAD primarily consumes data from the **Gold Layer**.

- **Catalog**: `connected_plant_uat` (Development/Test) or `connected_plant_prod` (Production).
- **Schemas**: 
    - `wh360`: Warehouse and inventory views.
    - `spc`: Statistical process control datasets.
    - `envmon`: Inspection result sets.

---

## 📜 Data Contracts

To ensure backend stability, we avoid querying raw tables. Instead, we consume **versioned SQL Views** maintained in the `sql/views/` directory of this repo.

### Standards for Views
1.  **Prefixing**: Use appropriate prefixes, e.g., `imwm_` for inventory mismatch logic.
2.  **ID Fidelity**: SAP Material, Batch, and Order IDs MUST be cast to `STRING` to preserve leading zeros.
3.  **Plant Scoping**: Every analytic view MUST include a `plant_id` column for row-level security.

---

## 🛠️ Working with Data Locally

### 1. Mocking for Local Development
Since we cannot always connect to the remote Warehouse from a local IDE, we use realistic JSON fixtures.
- **Reference**: `ai-context/samples/sap_materials.json`.

### 2. High-Fidelity Test Data
When writing unit tests, use the `shared_manufacturing.test_data` utility to generate valid IDs.
```python
from shared_ddd import ... and shared_manufacturing import test_data

def test_order_mapping():
    order_id = test_data.random_order_id()  # Generates a valid 12-digit PO string
    ...
```

---

## 🔄 Schema Evolution

1.  **Change View**: Update the DDL in `apps/<app>/sql/views/`.
2.  **Validate**: Run `python scripts/render_sql_views.py` to check for syntax errors.
3.  **Deploy**: Use Databricks Asset Bundles (DABs) to sync the views to the Unity Catalog.
4.  **Backend Sync**: Update the Pydantic models in `apps/<app>/backend/schemas.py` to reflect the change.
