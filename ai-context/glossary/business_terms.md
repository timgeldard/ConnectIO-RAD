# Business Terms Glossary

> Canonical definitions for domain terms used across apps and agents.
> When a human or agent uses any of these terms, THIS is the definition.

## Batch & Traceability

| Term | Definition | Synonyms |
|---|---|---|
| **Batch** | A uniquely identified quantity of material produced or received together, sharing identical manufacturing conditions. Identified by BATCH_ID (10-char, SAP format). | lot, charge, lot number |
| **Material** | A product, raw material, intermediate, or packaging item tracked in the system. Identified by MATERIAL_ID (18-char SAP material number). | product, SKU, item, matnr |
| **Lineage** | The parent-child graph connecting input batches to output batches through production, transfer, or STO movements. | traceability, genealogy, batch tree |
| **Forward Trace** | Following a batch DOWNSTREAM — from input material through production to finished goods and deliveries. Answers: "Where did this batch end up?" | top-down trace, downstream trace |
| **Reverse Trace** | Following a batch UPSTREAM — from finished good back through production to raw material inputs. Answers: "What went into this batch?" | bottom-up trace, upstream trace |
| **Exposure** | The set of downstream batches, customers, and countries that are affected if a specific batch is recalled or blocked. | blast radius, impact scope |
| **Process Order** | An SAP production order that records the consumption of inputs and receipt of outputs for one production run. | production order, aufnr, manufacturing order |
| **BOM** | Bill of Materials — the recipe/formula listing input materials and quantities needed to produce one unit of output. | recipe, formula, formulation |

## Stock & Inventory

| Term | Definition | Synonyms |
|---|---|---|
| **Unrestricted Stock** | Inventory that is freely available for consumption, transfer, or shipment. No quality or regulatory hold. | free stock, available stock |
| **Blocked Stock** | Inventory that is held and cannot be used. Requires explicit release. | held stock, quarantine |
| **QI Stock** | Inventory in Quality Inspection hold — pending a quality decision (release or reject). | quality hold, QI hold, inspection stock |
| **Mass Balance** | The reconciliation of all goods movements for a batch: produced - consumed - shipped - adjusted = current stock. Variance indicates untracked loss/gain. | material balance, stock reconciliation |
| **Goods Receipt (GR)** | A movement recording material received into inventory (e.g., production output, purchase order receipt). | receipt, GR, inbound |
| **Goods Issue (GI)** | A movement recording material removed from inventory (e.g., delivery to customer, consumption in production). | issue, GI, outbound |

## Quality

| Term | Definition | Synonyms |
|---|---|---|
| **MIC** | Master Inspection Characteristic — a specific quality test or measurement (e.g., moisture %, fat %, pH, colour). | characteristic, test parameter, merknr |
| **Inspection Lot** | A quality inspection event for a specific batch, containing one or more MIC measurements. Created automatically on goods receipt or manually. | lot, inspection, prueflos |
| **First Pass Yield (FPY)** | The percentage of batches that pass all quality checks on the first inspection without rework. | first-time-right, FTR |
| **Cpk** | Process Capability Index — statistical measure of how well a process fits within specification limits. Cpk >= 1.33 is generally acceptable. | process capability |
| **Control Limits (UCL/LCL)** | Statistical limits (mean ± 3*sigma) on a control chart. Points beyond these limits indicate special-cause variation. NOT the same as specification limits. | 3-sigma limits |
| **Specification Limits (USL/LSL)** | Customer or regulatory limits that define acceptable product. Distinct from control limits. | spec limits, tolerance |

## Manufacturing KPIs

| Term | Definition | Synonyms |
|---|---|---|
| **OEE** | Overall Equipment Effectiveness = Availability × Performance × Quality. Standard manufacturing efficiency metric. | overall equipment effectiveness |
| **Schedule Adherence** | Percentage of production orders completed on or before the planned completion date. | on-time completion, OTIF |
| **Yield** | Ratio of actual output to expected output for a production run. Usually expressed as percentage. | production yield, output ratio |
| **Cycle Time** | Time elapsed from first production receipt to last goods issue for a batch. Measures manufacturing velocity. | lead time, throughput time |

## SAP-Specific Terms

| Term | Definition | Notes |
|---|---|---|
| **Plant (Werk)** | A manufacturing site, distribution center, or organizational unit in SAP. 4-char code. | Examples: C351 = Olesnica |
| **Movement Type (BWART)** | 3-digit SAP code classifying the type of inventory movement. See sap_code_meanings.md for full list. | 101 = Production receipt, 601 = Delivery |
| **CHVW** | SAP batch where-used transaction — the source for lineage/traceability data. | |
| **Usage Decision** | The quality management step where a batch is accepted, rejected, or sent for rework based on inspection results. | UD, quality decision |
