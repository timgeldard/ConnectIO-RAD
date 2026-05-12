import { describe, expect, test } from 'vitest'

import { buildLineageContext, buildTransferContext } from '../pageContext'
import type { Batch, FocalNode, LineageNode } from '../../types'

const focalNode: FocalNode = {
  id: 'MAT-A::B1',
  material_id: 'MAT-A',
  material: 'Alpha',
  batch_id: 'B1',
  plant: 'RCN1',
  qty: 100,
  uom: 'KG',
  kind: 'focal',
}

const batch: Batch = {
  material_id: 'MAT-B',
  material_name: 'Beta',
  material_desc40: 'Beta material',
  batch_id: 'B2',
  process_order: '',
  plant_id: 'RCN2',
  plant_name: 'Plant RCN2',
  manufacture_date: '',
  expiry_date: '',
  days_to_expiry: 0,
  shelf_life_status: 'UNKNOWN',
  batch_status: 'UNRESTRICTED',
  uom: 'KG',
  qty_produced: 0,
  qty_shipped: 0,
  qty_consumed: 0,
  qty_adjusted: 0,
  current_stock: 0,
  variance: 0,
  mass_balance_kg: 0,
  unrestricted: 0,
  blocked: 0,
  qi: 0,
  transit: 0,
  restricted: 0,
  customers_affected: 0,
  countries_affected: 0,
  total_shipped_kg: 0,
  total_deliveries: 0,
  total_consumed: 0,
  consuming_pos: 0,
}

const lineageRow: LineageNode = {
  id: 'MAT-X::BX',
  level: 1,
  material_id: 'MAT-X',
  material: 'Aroma',
  batch: 'BX',
  plant: 'RCN1',
  qty: 50,
  uom: 'KG',
  link: 'RECEIPT',
  parent: focalNode.id,
}

describe('buildLineageContext', () => {
  test('extracts focal identity from a FocalNode unchanged', () => {
    const ctx = buildLineageContext({ view: 'top-down', batch: focalNode })
    expect(ctx.mode).toBe('lineage')
    expect(ctx.view).toBe('top-down')
    expect(ctx.selected).toBeNull()
    expect(ctx.focal).toEqual({
      material_id: 'MAT-A',
      material: 'Alpha',
      batch_id: 'B1',
      plant: 'RCN1',
    })
  })

  test('flattens a full Batch into the compact focal shape', () => {
    const ctx = buildLineageContext({ view: 'bottom-up', batch })
    expect(ctx.focal).toEqual({
      material_id: 'MAT-B',
      material: 'Beta',
      batch_id: 'B2',
      plant: 'Plant RCN2',
    })
  })

  test('falls back to material_id and plant_id when names are missing', () => {
    const sparse: Batch = { ...batch, material_name: '', plant_name: '' }
    const ctx = buildLineageContext({ view: 'overview', batch: sparse })
    expect(ctx.focal.material).toBe('MAT-B')
    expect(ctx.focal.plant).toBe('RCN2')
  })
})

describe('buildTransferContext', () => {
  test('carries the selected node identity + side into the context', () => {
    const ctx = buildTransferContext(
      { view: 'bottom-up', batch: focalNode },
      lineageRow,
      'upstream',
    )
    expect(ctx.mode).toBe('lineage_transfer')
    expect(ctx.selected?.material_id).toBe('MAT-X')
    expect(ctx.selected?.batch_id).toBe('BX')
    expect(ctx.selected?.side).toBe('upstream')
    expect(ctx.selected?.link).toBe('RECEIPT')
    expect(ctx.selected?.qty).toBe(50)
    expect(ctx.selected?.uom).toBe('KG')
  })

  test('flow_qty is null when the row does not carry it', () => {
    // LineageNode (pre-PR #54) has no flow_qty field — the builder
    // must defend against that gracefully without crashing.
    const ctx = buildTransferContext(
      { view: 'top-down', batch: focalNode },
      lineageRow,
      'downstream',
    )
    expect(ctx.selected?.flow_qty).toBeNull()
  })

  test('flow_qty surfaces when the row carries a finite numeric value', () => {
    const withFlow = { ...lineageRow } as LineageNode & { flow_qty: number }
    withFlow.flow_qty = 1234.5
    const ctx = buildTransferContext(
      { view: 'bottom-up', batch: focalNode },
      withFlow,
      'upstream',
    )
    expect(ctx.selected?.flow_qty).toBe(1234.5)
  })

  test('non-finite flow_qty is dropped to null (no NaN in prompts)', () => {
    const withNaN = { ...lineageRow } as LineageNode & { flow_qty: number }
    withNaN.flow_qty = Number.NaN
    const ctx = buildTransferContext(
      { view: 'bottom-up', batch: focalNode },
      withNaN,
      'upstream',
    )
    expect(ctx.selected?.flow_qty).toBeNull()
  })
})
