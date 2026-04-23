# SAP Code Meanings

> Quick reference for SAP codes that appear in gold-layer data.
> Agents should use this to translate codes in queries and UI labels.

## Movement Types (BWART)

### Production
| Code | Meaning | Category | Effect |
|---|---|---|---|
| 101 | Goods Receipt from Production | Production | +Stock |
| 102 | GR Production Reversal | Production | -Stock |

### Consumption
| Code | Meaning | Category | Effect |
|---|---|---|---|
| 201 | Goods Issue for Cost Center | Consumption | -Stock |
| 202 | GI Cost Center Reversal | Consumption | +Stock |
| 261 | Goods Issue for Process Order | Consumption | -Stock |
| 262 | GI Process Order Reversal | Consumption | +Stock |

### Customer Delivery
| Code | Meaning | Category | Effect |
|---|---|---|---|
| 601 | Goods Issue for Delivery (Sales) | Shipment | -Stock |
| 602 | GI Delivery Reversal | Shipment | +Stock |

### Transfers
| Code | Meaning | Category | Effect |
|---|---|---|---|
| 301 | Transfer Posting Plant-to-Plant | Transfer | -/+ |
| 302 | Transfer Posting Reversal | Transfer | +/- |
| 311 | Transfer to QI Stock | Transfer | Reclassify |
| 312 | Transfer from QI Stock | Transfer | Reclassify |
| 321 | Transfer to Blocked Stock | Transfer | Reclassify |
| 322 | Transfer from Blocked Stock | Transfer | Reclassify |
| 641 | Goods Issue for STO Delivery | STO Transfer | -Stock |
| 642 | GI STO Delivery Reversal | STO Transfer | +Stock |

### Adjustments
| Code | Meaning | Category | Effect |
|---|---|---|---|
| 531 | Scrapping | Adjustment | -Stock |
| 532 | Scrapping Reversal | Adjustment | +Stock |
| 701 | Physical Inventory Surplus | Adjustment | +Stock |
| 702 | Physical Inventory Deficit | Adjustment | -Stock |
| 711 | Inventory Adjustment Gain | Adjustment | +Stock |
| 712 | Inventory Adjustment Loss | Adjustment | -Stock |

## Inspection Result Valuations

| Code | Meaning | Description |
|---|---|---|
| A | Accepted | Result within specification limits |
| R | Rejected | Result outside specification limits |
| F | Failed | Inspection could not be completed (equipment failure, etc.) |

## Common Movement Category Groupings

When writing SQL, use these groupings for the `MOVEMENT_CATEGORY` column:

```sql
-- Production volume
WHERE MOVEMENT_CATEGORY = 'Production'

-- Customer shipments (exclude STO)
WHERE MOVEMENT_CATEGORY = 'Shipment'

-- Internal consumption
WHERE MOVEMENT_CATEGORY = 'Consumption'
-- or by movement type:
WHERE MOVEMENT_TYPE IN ('261', '262', '201', '202')

-- Adjustments (scrap, PI, corrections)
WHERE MOVEMENT_TYPE IN ('531', '532', '701', '702', '711', '712')

-- Exclude inter-plant STO from mass balance
WHERE MOVEMENT_CATEGORY NOT LIKE 'STO%'
```

## Plant Code Examples

| Code | Name | Type | Country |
|---|---|---|---|
| C351 | Olesnica | Manufacturing | PL |

> **Note**: Add your plant codes here as you onboard new sites.
> This table should be maintained alongside gold_plant dimension updates.
