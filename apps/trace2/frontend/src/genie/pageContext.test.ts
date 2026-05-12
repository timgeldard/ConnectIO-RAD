import { describe, expect, it } from 'vitest'
import type { LineageNodeContext } from '@connectio/shared-reporting'

import { fromLineageNodeContext } from './pageContext'

const baseCtx: LineageNodeContext = {
  id: 'n-1',
  side: 'upstream',
  material_id: 'M-100',
  material: 'Whey Concentrate',
  batch_id: 'B-9001',
  plant: 'Charleville',
  link: 'INPUT_OF',
  flow_qty: 1200,
  qty: 1500,
  uom: 'KG',
  focal: {
    id: 'focal',
    material_id: 'M-FINAL',
    material: 'Finished Blend',
    batch_id: 'B-FINAL',
    plant: 'Listowel',
  },
}

describe('fromLineageNodeContext', () => {
  it('maps upstream context into the trace2 GeniePageContext shape', () => {
    const ctx = fromLineageNodeContext(baseCtx, 'bottom-up')
    expect(ctx).toEqual({
      mode: 'lineage_transfer',
      view: 'bottom-up',
      focal: {
        material_id: 'M-FINAL',
        material: 'Finished Blend',
        batch_id: 'B-FINAL',
        plant: 'Listowel',
      },
      selected: {
        material_id: 'M-100',
        material: 'Whey Concentrate',
        batch_id: 'B-9001',
        plant: 'Charleville',
        link: 'INPUT_OF',
        side: 'upstream',
        flow_qty: 1200,
        qty: 1500,
        uom: 'KG',
      },
    })
  })

  it('passes the host view label through verbatim', () => {
    const ctx = fromLineageNodeContext(
      { ...baseCtx, side: 'downstream' },
      'top-down',
    )
    expect(ctx.view).toBe('top-down')
    expect(ctx.selected?.side).toBe('downstream')
  })

  it('coerces NaN flow_qty to null without fabricating values', () => {
    const ctx = fromLineageNodeContext(
      { ...baseCtx, flow_qty: Number.NaN },
      'bottom-up',
    )
    expect(ctx.selected?.flow_qty).toBeNull()
  })

  it('coerces missing flow_qty (undefined) to null', () => {
    const { flow_qty: _omit, ...rest } = baseCtx
    void _omit
    const ctx = fromLineageNodeContext(rest as LineageNodeContext, 'bottom-up')
    expect(ctx.selected?.flow_qty).toBeNull()
  })

  it('preserves zero flow_qty (legitimate "no flow on this edge")', () => {
    const ctx = fromLineageNodeContext(
      { ...baseCtx, flow_qty: 0 },
      'bottom-up',
    )
    expect(ctx.selected?.flow_qty).toBe(0)
  })
})
