# warehouse360 — Warehouse Operations Cockpit

A live-wired warehouse operations cockpit for inbound, outbound, inventory, production staging, dispensary, and IM/WM reconciliation workflows.

## 📚 Documentation

Detailed documentation is available in the `docs/` folder:

- [**Architecture Overview**](./docs/architecture.md): Overview of the frontend modules and backend bounded contexts.
- [**Local Setup Guide**](./docs/setup.md): Prerequisites and step-by-step instructions for running the app locally.
- [**API Reference**](./docs/api.md): Information on the live Warehouse360 API surface.

## 🚀 Features

- **Control Tower**: Real-time operational metrics and alerts.
- **Inbound/Outbound Tracking**: Monitor shipments and schedules.
- **Inventory Visibility**: View stock levels across storage locations.
- **Inventory Cockpit**: Reconcile SAP IM and WM stock using live backend endpoints.
- **Production Staging**: Material flow monitoring for production lines.
- **Dispensary Management**: Weighing and dispensing raw materials.

## Data contract

SQL queries assume Unity Catalog views resolved via `WH360_SCHEMA`
(see `app.template.yaml`). `WH360_SCHEMA` defaults to `wh360` in the UAT
catalog. The IMWM views live in the same schema.

```
wh360_bin_stock_v               bin-level stock by storage type and batch
wh360_lineside_stock_v          lineside/staging stock by production line
wh360_inbound_v                 inbound transfer orders and GR status
wh360_deliveries_v              outbound deliveries with CUSTOMER_ID and schedule
wh360_transfer_orders_v         inter-plant transfer orders
wh360_transfer_requirements_v   open transfer requirements (MRP-driven)
wh360_handling_units_v          handling unit details for deliveries
wh360_process_orders_v          production orders with status and quantities
wh360_dispensary_tasks_v        dispensary weighing tasks with status and material
wh360_kpi_snapshot_v            operations control tower — pre-computed KPI snapshot

imwm_stock_comparison_v         IM vs WM stock comparison (reconciliation)
imwm_movements_v                goods movements for the IMWM cockpit
imwm_exceptions_v               stock discrepancies flagged as exceptions
imwm_analytics_aging_v          aging analysis for slow-moving and blocked stock
```
