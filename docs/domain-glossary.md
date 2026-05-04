# Domain Glossary & DDD Status

This document catalogs the current state of Domain-Driven Design (DDD) adoption across the ConnectIO-RAD monorepo. It serves as a central inventory of our bounded contexts, aggregates, entities, and value objects.

## 📊 Application DDD Status

| Application | Architecture Style | Domain Model Richness | Notes |
| :--- | :--- | :--- | :--- |
| **`trace2`** | Modular Monolith / CQRS | High | Refactored into bounded contexts. Strong value objects for identity and risk. |
| **`spc`** | Modular Monolith / CQRS | Medium | Domain rules extracted for MSA, Capability, and Exclusions. Needs base entity classes. |
| **`envmon`** | Modular Monolith / CQRS | Medium | Strong value objects for spatial coordinates and inspection risk. |
| **`processorderhistory`**| Modular Monolith / CQRS | Anemic | Folders structure exists (`domain/`, `application/`, `dal/`), but no extracted pure domain models yet. |
| **`warehouse360`** | Modular Monolith / CQRS | Anemic | Structure exists, but domain logic is still trapped in DAL or routers. |
| **`connectedquality`** | BFF / Integration | N/A | Gateway app. Minimal domain logic. `user_preferences` is isolated. |

---

## 📚 Bounded Contexts & Models Inventory

### 1. Statistical Process Control (`spc`)

**Context: `chart_config`**
- **Value Objects:** 
  - `Exclusion` (`exclusion.py`)
  - `LockedLimits` (`locked_limits.py`)

**Context: `process_control`**
- **Domain Services / Policies:**
  - `MSA` (`msa.py`)
  - `Control Charts` (`control_charts.py`)
  - `Capability` (`capability.py`)
  - `Multivariate` (`multivariate.py`)

### 2. Environmental Monitoring (`envmon`)

**Context: `inspection_analysis`**
- **Policies / Rules:**
  - `Valuation` (`valuation.py`)
  - `SPC` (`spc.py`)
  - `Risk` (`risk.py`)
  - `Status` (`status.py`)

**Context: `spatial_config`**
- **Value Objects:**
  - `Coordinate` (`coordinate.py`)
  - `PlantGeo` (`plant_geo.py`)

### 3. Batch Traceability (`trace2`)

**Context: `batch_trace`**
- **Value Objects:**
  - `BatchIdentity`, `BatchId`, `MaterialId` (`identity.py`)
- **Domain Services:**
  - `TraceTree` builder (`trace_tree.py`)

**Context: `lineage_analysis`**
- **Value Objects:**
  - `LineageDepth` (`lineage.py`)
- **Policies:**
  - `ExposureRisk`, `supplier_risk_score` (`risk.py`)

**Context: `quality_record`**
- **Value Objects / Policies:**
  - `QualityStatus`, `batch_status_from_quality_stock` (`status.py`)
  - `MassBalance` variance logic (`mass_balance.py`)

### 4. Shared Libraries (`libs/`)

- **`shared-trace`**: Currently acts as a monolithic read-model engine (DAL) with giant recursive SQL queries (`shared_trace/dal.py`). This needs to be decomposed in future phases into standard domain components.

---

## 🎯 Next Steps (Phase 1 & 2)

As part of the ongoing DDD stabilization plan, our focus is to:
1. **Establish DDD Foundations**: Introduce standard `Entity`, `AggregateRoot`, `ValueObject`, and `Repository` base classes into a shared library.
2. **Enrich Anemic Models**: Migrate the empty domain layers in `warehouse360` and `processorderhistory` to use these foundations.
3. **Push Logic Inwards**: Continue moving business rules (like SPC chart rules, risk decay logic) out of DALs/Routers and into pure domain models.
