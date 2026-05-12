# Dashboard Query Catalog

The platform dashboard builder supports two different ways to shape widget output:

1. **Widget props** are the static properties stored on the widget itself, such as title, height, labels, and fixed chart data.
2. **Widget data binding** connects a widget to a named query registry entry and maps fields from the query response into widget props.

The manufacturing query catalog lives in `apps/platform/frontend/src/shell/queryCatalog/` and keeps domain-specific query knowledge in the platform app while `libs/shared-reporting` stays generic.

## Purpose

The query registry gives the property inspector a typed list of business-friendly manufacturing queries that users can bind to supported widgets without hand-editing raw dashboard JSON.

## Query naming

- Query keys use `domain.name` format, for example `poh.orderSummary` or `trace.massBalance`.
- The domain prefix groups queries by business area:
  - `poh.*`
  - `quality.*`
  - `spc.*`
  - `trace.*`
  - `wm.*`
  - `inventory.*`
  - `procurement.*`
  - `sales.*`
- Endpoints must align with real platform routes, for example `/api/orders`, `/api/quality/analytics`, `/api/spc/chart-data`, `/api/summary`, or `/api/wh/deliveries`.

## Required query fields

Every registry entry must define:

| Field | Meaning |
| --- | --- |
| `key` | Unique registry key |
| `label` | Business-friendly query name shown in the builder |
| `description` | Short explanation for the query selector |
| `endpoint` | Relative API path |
| `method` | HTTP method, currently standardized on `POST` |
| `compatibleWidgets` | Supported widget types |
| `params` | Allowed query parameters for dashboard/static binding |
| `fields` | Discoverable response fields for mapping |
| `sampleResponse` | Mock payload for previews and validation |

Each field definition inside `fields` must include:

- `path`
- `label`
- `type`
- optional `semantic`

## Supported widget types

- `kpi`
- `trend`
- `bar`
- `pareto`
- `spc-control`
- `drill-down-table`

## Supported mapping transforms

- `identity`
- `number`
- `string`
- `percentage`
- `timeseriesPoints`
- `paretoItems`
- `barSeries`
- `tableRows`
- `spcPoints`
- `spcLimits`

When a query is selected in the property inspector, the builder now seeds a sensible default mapping for the current widget type:

- KPI widgets prefer fields like `value`, `delta`, status-style subtext, and percentage progress fields.
- Trend widgets prefer `points` or time-series arrays such as `daily_history`.
- Bar widgets default to `categories` and `series`.
- Pareto widgets prefer `items`.
- Drill-down tables prefer `rows`.
- SPC widgets default to `points` and `summary.limits` / `limits`.

Users can still override any generated mapping manually.

## Example query entry

```ts
export const qualityQueries: QueryRegistry = {
  'quality.batchReleaseQueue': postQuery({
    key: 'quality.batchReleaseQueue',
    label: 'Batch Release Queue',
    description: 'Open inspection lots waiting for usage decision.',
    endpoint: endpoint('quality', 'batch-release-queue'),
    compatibleWidgets: widgetCompatibility.kpiBarTable,
    params: qualityParams,
    fields: [
      qualityField('value', 'Open lot count', 'number', 'count'),
      qualityField('open_lot_count', 'Open lot count', 'number', 'count'),
      qualityField('rows', 'Rows', 'array'),
    ],
    sampleResponse: {
      value: 14,
      open_lot_count: 14,
      rows: [{ inspection_lot_id: '050001284731', status: 'Awaiting release' }],
    },
  }),
}
```

## Example sample response

```json
{
  "value": 92.4,
  "unit": "%",
  "delta": "+1.8%",
  "trend": "up",
  "subtext": "vs previous 7 days",
  "progressBar": 92.4
}
```

## How to add a new query

1. Choose the correct domain file under `apps/platform/frontend/src/shell/queryCatalog/`.
2. Pick a `domain.name` key and map it to a real platform endpoint path.
3. Reuse `common.ts` helpers for shared params, fields, and widget compatibility where possible.
4. Define a complete `fields` list with mapping-friendly paths.
5. Add a realistic `sampleResponse`.
6. Make sure the query is exported through `queryCatalog/index.ts`.
7. Extend the platform registry tests if the new query shape adds a new contract expectation.

## How to test a new query in the dashboard builder

1. Run the platform registry test:
   - `cd apps/platform/frontend && npx vitest run src/shell/queryCatalog/__tests__/dashboardQueryRegistry.test.ts`
2. Run the shared-reporting binding tests:
   - `cd libs/shared-reporting && npx vitest run src/composable/__tests__`
3. Open the platform dashboard builder, add a supported widget, switch to **Data Binding**, and confirm the query picker offers the new query with a prefilled mapping.
