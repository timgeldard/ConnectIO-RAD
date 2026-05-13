# Dashboard Builder & Data Binding Design Plan

## 1. Context and Current State
ConnectIO-RAD currently contains a composable dashboard builder located in `libs/shared-reporting/src/composable`.

**Current Architecture:**
- **Widgets:** Defined by `composableWidgetSchema` (`id`, `type`, `title`, `layout`, `props`, `data`). The current layout relies on `react-grid-layout`.
- **Property Inspector:** `PropertyInspector.tsx` exists, along with typed widget property editors (`KpiWidgetForm`, `TrendWidgetForm`, `BarWidgetForm`, `ParetoWidgetForm`, `SpcWidgetForm`, `TableWidgetForm`) and an advanced JSON fallback.
- **Data Layer:** Uses a static client-side `QueryRegistry` (`src/data/queryRegistry.ts`) mapped via REST API endpoints. Widgets define a `WidgetDataBinding` consisting of `queryKey`, `params`, and `mapping`. At runtime, `useWidgetDataBinding` calls the associated API endpoints and maps fields via `mapResponseToWidgetProps`.

**Goal:** Move away from hand-edited raw JSON props and static REST `queryKey`s toward a proper data binding model supporting robust data sources (like Databricks SQL), user-defined Datasets, static props, and improved field mapping with refresh behavior.

## 2. Proposed Data Model

### A. Widget Model Evolution
Currently, widgets use:
```json
{
  "id": "w1",
  "type": "kpi",
  "props": { ... },
  "data": { "queryKey": "poh.oeeAnalytics", "params": { ... }, "mapping": { ... } }
}
```

**Proposed Evolution:**
```json
{
  "id": "w1",
  "type": "kpi",
  "props": { ... },
  "data": {
    "datasetId": "uuid-of-dataset",
    "queryKey": "poh.oeeAnalytics", // Kept for backwards compatibility
    "params": { ... },
    "mapping": { ... },
    "refreshSeconds": 300
  }
}
```
*Note: We introduce `datasetId` and `refreshSeconds` while keeping `queryKey` optional to prevent breaking existing dashboard configs.*

### B. DataSource Model
DataSources represent physical connections to backend systems (e.g., Databricks SQL warehouses, Postgres, or legacy REST endpoints).
```typescript
interface DataSource {
  id: string;
  name: string;
  type: 'databricks-sql' | 'postgres' | 'rest';
  connectionConfig: Record<string, unknown>; // e.g. hostname, httpPath, auth mechanism
  createdAt: string;
}
```

### C. Dataset / Query Model
Datasets represent reusable logical sets of data backed by a SQL query or a stored procedure executed against a DataSource.
```typescript
interface Dataset {
  id: string;
  dataSourceId: string;
  name: string;
  description?: string;
  sqlQuery: string;
  parameters: DatasetParameter[];
  schema: DatasetSchemaField[]; // Inferred columns & types
  createdAt: string;
}

interface DatasetParameter {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  defaultValue?: unknown;
}

interface DatasetSchemaField {
  path: string; // e.g., "avg_oee_pct"
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array';
}
```

### D. Field Binding Model
The current `mapping` architecture is robust, utilizing dot-paths and transform functions (`MappingTransform`).
```typescript
// Existing MappingValue
export type MappingValue = string | {
  path: string;
  transform?: MappingTransform;
  config?: Record<string, any>;
};
```
No major structural changes are needed for the UI binding logic. However, the dropdowns in the Property Inspector will populate their options from the dynamically inferred `Dataset.schema` instead of the static `QueryRegistry.fields`.

## 3. Property Inspector UX

**Data Binding Section Enhancements:**
1. **Source Selection:** Replace the static "Query" dropdown with a "Dataset" selector.
2. **Schema Inference:** Once a dataset is selected, ping the backend to retrieve the schema (or read from the cached dataset definition).
3. **Parameter Mapping:** Display parameters defined in the `Dataset.parameters` list. Allow binding to static values or Global Dashboard Parameters.
4. **Field Mapping:** Map widget props (e.g., "value", "delta", "progressBar") to the dataset columns.
5. **Refresh Behavior:** Add an input for `refreshSeconds` allowing widgets to self-update independently.

## 4. Migration Path

1. **Phase 1 (Non-Breaking Schema Changes):** Add `datasetId` and `refreshSeconds` to `WidgetDataBinding`. Make `queryKey` optional. (Covered in the immediate implementation step).
2. **Phase 2 (Backend Entities):** Implement CRUD operations for `DataSource` and `Dataset` models in the backend (using FastAPI + SQLAlchemy/Databricks).
3. **Phase 3 (Frontend Integration):** Update `useWidgetDataBinding` hook. If `datasetId` is present, route the execution to a new Databricks SQL execution endpoint (`/api/v1/datasets/{id}/execute`). Fallback to `queryKey` REST fetching if present.
4. **Phase 4 (Property Inspector):** Update `DataBindingSection.tsx` to toggle between legacy queries and the new Dataset selection.
5. **Phase 5 (Deprecation):** After all dashboards are migrated to Datasets, remove `queryKey` and `QueryRegistry`.

## 5. Risks & Considerations (Databricks SQL Integration)

1. **Latency:** Databricks SQL queries might take longer to initialize or execute than traditional REST calls.
   - *Mitigation:* Implement backend caching (e.g., Redis or SQL cache table) for frequent dashboard queries.
2. **Concurrency & Warehouse Sizing:** High refresh rates across many users may saturate the Databricks SQL warehouse.
   - *Mitigation:* Restrict `refreshSeconds` minimums (e.g., no less than 60 seconds) and utilize Serverless compute to autoscale.
3. **Security:** Exposing raw SQL execution APIs is dangerous.
   - *Mitigation:* Ensure the `Dataset` API validates parameters and only executes predefined `sqlQuery` statements. Avoid allowing the frontend to send raw SQL.

## 6. Backlog Split (Jules-sized Tasks)

- **Task 1 (Current):** Schema evolution for `WidgetDataBinding` (`datasetId`, `refreshSeconds`).
- **Task 2:** Backend definition of `DataSource` and `Dataset` SQLAlchemy models.
- **Task 3:** Implement Databricks execution endpoint (`/api/v1/datasets/{id}/execute`).
- **Task 4:** Update frontend `useWidgetDataBinding` to support `datasetId` execution.
- **Task 5:** Build CRUD UI for managing Datasets (Dataset Builder).
- **Task 6:** Update Dashboard `PropertyInspector` UX to select Datasets.