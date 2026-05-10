import { describe, expect, it } from 'vitest'
import { templateChartConfig } from '../chartConfig'

describe('templateChartConfig', () => {
  it('points to the generated overview endpoint', () => {
    expect(templateChartConfig.dataSource.endpoint).toBe('/api/module-template/overview')
  })
})
