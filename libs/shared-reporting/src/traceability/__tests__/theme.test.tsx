import { describe, expect, test } from 'vitest'
import { render } from '@testing-library/react'

import { LineageTableView } from '../LineageTableView'
import { paletteFor } from '../nodes'
import type { AdvancedLineageData, AdvancedLineageNode } from '../types'

const focal = {
  id: 'F',
  material_id: 'MAT-A',
  material: 'Alpha',
  batch_id: 'B1',
  plant: 'RCN1',
  qty: 100,
  uom: 'KG',
}

function row(): AdvancedLineageNode {
  return {
    id: 'U1',
    level: 1,
    parent: focal.id,
    link: 'RECEIPT',
    material_id: 'MAT-X',
    material: 'X',
    batch: 'BX',
    plant: 'RCN1',
    qty: 50,
    uom: 'KG',
  }
}

const data: AdvancedLineageData = { focal, upstream: [row()], downstream: [] }

describe('paletteFor', () => {
  test('returns a distinct palette for high-contrast vs default', () => {
    const a = paletteFor('default')
    const b = paletteFor('high-contrast')
    expect(a.focalBg).not.toEqual(b.focalBg)
    expect(a.linkColors.RECEIPT).not.toEqual(b.linkColors.RECEIPT)
  })

  test('every required key is populated for both themes', () => {
    for (const theme of ['default', 'high-contrast'] as const) {
      const p = paletteFor(theme)
      expect(p.focalBg).toBeTruthy()
      expect(p.focalFg).toBeTruthy()
      expect(p.focalAccent).toBeTruthy()
      expect(p.upstreamBg).toBeTruthy()
      expect(p.downstreamBg).toBeTruthy()
      expect(p.linkColors.RECEIPT).toBeTruthy()
      expect(p.linkColors.SALES_ORDER).toBeTruthy()
    }
  })
})

describe('LineageTableView theme', () => {
  test('stamps data-theme on the root for QA + Playwright selectors', () => {
    const { getByTestId, rerender } = render(<LineageTableView data={data} />)
    expect(getByTestId('lineage-table-view').getAttribute('data-theme')).toBe('default')
    rerender(<LineageTableView data={data} theme="high-contrast" />)
    expect(getByTestId('lineage-table-view').getAttribute('data-theme')).toBe('high-contrast')
  })
})
