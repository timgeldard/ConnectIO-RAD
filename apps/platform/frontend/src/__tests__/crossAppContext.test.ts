/* eslint-disable jsdoc/require-jsdoc */
import { describe, expect, it } from 'vitest'
import { parseCrossAppContext } from '@connectio/shared-ui/shell'

describe('parseCrossAppContext', () => {
  it('normalizes canonical and backend-style context aliases', () => {
    window.history.replaceState(
      {},
      '',
      '/?entity=batch&material_id=MAT-1&batch=BATCH-1&plant_id=PLANT-1&from=cq.trace',
    )

    expect(parseCrossAppContext()).toEqual({
      entity: 'batch',
      materialId: 'MAT-1',
      batchId: 'BATCH-1',
      plantId: 'PLANT-1',
      from: 'cq.trace',
    })
  })
})
