import { describe, expect, test } from 'vitest'

import type { LineageNodeContext } from '../AdvancedLineageGraph'
import {
  buildExplainTransferContext,
  buildExplainTransferPrompt,
} from '../geniePrompt'

const baseCtx: LineageNodeContext = {
  id: 'MAT-X::BX',
  side: 'upstream',
  material_id: 'MAT-X',
  material: 'Aroma',
  batch_id: 'BX',
  plant: 'RCN1',
  link: 'RECEIPT',
  qty: 200,
  flow_qty: 150,
  uom: 'KG',
  focal: {
    id: 'MAT-A::B1',
    material_id: 'MAT-A',
    material: 'Alpha',
    batch_id: 'B1',
    plant: 'RCN2',
  },
}

describe('buildExplainTransferPrompt', () => {
  test('reads upstream-direction phrasing for upstream contexts', () => {
    const prompt = buildExplainTransferPrompt(baseCtx)
    expect(prompt).toMatch(/upstream batch Aroma \(BX\) at RCN1 fed into focal batch Alpha/)
    expect(prompt).toMatch(/RECEIPT link/)
    expect(prompt).toMatch(/recorded flow was 150 KG/)
  })

  test('reads downstream-direction phrasing for downstream contexts', () => {
    const prompt = buildExplainTransferPrompt({ ...baseCtx, side: 'downstream' })
    expect(prompt).toMatch(/focal batch Alpha \(B1\) at RCN2 produced downstream batch Aroma/)
  })

  test('omits the flow clause when flow_qty is undefined or non-finite', () => {
    expect(buildExplainTransferPrompt({ ...baseCtx, flow_qty: undefined })).not.toMatch(/recorded flow/)
    expect(buildExplainTransferPrompt({ ...baseCtx, flow_qty: Number.NaN })).not.toMatch(/recorded flow/)
  })

  test('asks for goods movement date and quality holds', () => {
    const prompt = buildExplainTransferPrompt(baseCtx)
    expect(prompt).toMatch(/goods movement date/)
    expect(prompt).toMatch(/quality holds/)
  })
})

describe('buildExplainTransferContext', () => {
  test('returns a deterministic, JSON-serialisable Genie page_context', () => {
    const ctx = buildExplainTransferContext(baseCtx)
    expect(ctx.mode).toBe('lineage_transfer')
    expect(ctx.side).toBe('upstream')
    expect(ctx.focal.batch_id).toBe('B1')
    expect(ctx.selected.batch_id).toBe('BX')
    expect(ctx.selected.flow_qty).toBe(150)
    // Round-trips through JSON cleanly (no Dates, Maps, etc.)
    const round = JSON.parse(JSON.stringify(ctx))
    expect(round).toEqual(ctx)
  })

  test('omits flow_qty cleanly when absent', () => {
    const ctx = buildExplainTransferContext({ ...baseCtx, flow_qty: undefined })
    expect(ctx.selected.flow_qty).toBeUndefined()
  })
})
