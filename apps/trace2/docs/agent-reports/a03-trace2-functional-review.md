# Trace2 Functional Review & Backlog

## 1. Current Capability Map
The Trace2 application provides a comprehensive suite of traceability features, effectively dividing the domain into distinct contextual pages. The current implementation supports:
- **Recall Readiness**: End-to-end impact map simulating downstream product exposure.
- **Top-Down Trace**: Downstream graph of where a batch was consumed and distributed.
- **Bottom-Up Trace**: Upstream graph of material inputs for a batch.
- **Mass Balance**: Input vs. output volume reconciliation over time.
- **Quality**: Inspection lots and metric (MIC) pass/fail statuses.
- **Production History**: Context on prior production run volumes and batch sizes.
- **Batch Compare**: Benchmarking a batch against historically similar runs.
- **Supplier Risk**: Aggregated supplier quality insights for material inputs.
- **Certificate of Analysis (CoA)**: Release documentation ready for export.

## 2. Missing Recall-Investigator Workflows
While the current features provide robust single-batch visibility, actual recall investigations often span multiple dimensions. Critical gaps include:
1. **Multi-Batch Origin Selection**: The UX heavily anchors on an individual suspect `(material_id, batch_id)`. Investigators often need to select a group of batches or an entire time window (e.g., all batches from Plant X on Tuesday).
2. **Actionability/Hold Execution**: The system maps the exposure radius and flags risk, but there is no mechanism to actually block stock (e.g., trigger a HOLD status in SAP/ERP) directly from the simulation view.
3. **Cross-Plant Transit Visibility**: The system displays "deliveries" and "exposed stock", but lacks clear signaling for stock currently in-transit between company-owned plants (STOs).
4. **Geospatial Concentration**: Data shows `byCountry` and `customersAffected`, but lacks a live geographic map layout for rapid containment decision-making.

## 3. Data Contract Risks
1. **Missing Flow Quantities**: The frontend component `LineageGraph.tsx` relies on `flow_qty` (from `edge_agg` CTE) for correct graph edge weighting. However, older data or specific backend queries may omit this, leading to zero-weighted edges. `coerceOptionalFlowQty` attempts to handle this, but it highlights a weak contract.
2. **Missing Lineage Parents**: The `LineageGraph` implementation silently drops edges if a `child.parent` does not exist in the node set (with only a console warning). This could lead to a false sense of security during a recall if a broken data relationship hides a downstream branch.
3. **Status String Fragility**: Functions like `statusFromQuality` rely on string-matching (`includes("pass")`) to infer strict `BatchStatus` types. If the underlying ERP terminology shifts (e.g., "accepted" instead of "pass"), the UI will incorrectly categorize the batch.

## 4. UX Gaps
- **Missing Data States**: Empty states use a generic `EmptyBlock`, but could provide better context as to *why* it's empty (e.g., "No upstream inputs because this is a purchased raw material").
- **Overly Dense Views**: The Recall Readiness view displays many KPIs and tables. Without sorting/filtering beyond simple risk levels, investigators might struggle to identify the most critical actions.
- **Simulation Feedback**: Entering "Simulation" mode turns the UI colors red (sunset), but does not clarify what specifically changes about the underlying data (it only applies a visual emphasis filter).

## 5. Candidate Backlog Items
### High Priority
- **H1: Multi-Batch Suspicion List** - Allow users to add multiple batches to a "suspect list" and run a combined Recall Readiness simulation.
- **H2: Lineage Graph Orphan Warning** - Display a visible UI warning (not just a console log) if `LineageGraph` drops nodes due to missing parents, as this is critical compliance risk.

### Medium Priority
- **M1: Quality Status Enum Mapping** - Refactor `statusFromQuality` on the frontend (or move the mapping to the backend) to use explicit, contracted status codes instead of substring matching.
- **M2: Actionable Blocks** - Add a "Request Block" integration on the Recall Readiness page for identified critical batches.
- **M3: Geographic Impact Map** - Convert the "Shipped by Country" bar chart into an interactive world map.

### Low Priority
- **L1: Better Empty States** - Differentiate empty states based on material type (e.g., "Raw materials have no upstream lineage" vs "No data found").
- **L2: CoA Export** - Implement real PDF generation for the CoA page (currently just a UI mock/placeholder).

## 6. Changes Made
During this review, the following low-risk improvements were implemented:
1. **Clearer Empty States (`LoadFrame.tsx`)**: Upgraded `EmptyBlock` to accept an optional `title` parameter alongside the `message` to allow for visually distinct titles on empty frames.
2. **Missing Parents Warning (`LineageGraph.tsx`)**: Replaced the silent `console.warn` for dropped edges (due to missing parent records) with a highly visible `absolute` positioned UI warning banner overlay on top of the graph, ensuring investigators are aware if data relationships are broken.
3. **Defensive Missing Optional Fields (`api.ts`)**: Fortified `coerceOptionalFlowQty` to handle empty strings (`""`), cleanly parsing missing `flow_qty` parameters to `undefined` (which signals the renderer to safely fall back to the default `qty`).
