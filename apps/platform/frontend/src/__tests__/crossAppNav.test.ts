import { describe, it, expect } from 'vitest'
import { buildCrossAppUrl, buildSpaContextUrl } from '../shell/crossAppNav'
import { MODULES } from '../shell/modules'

const traceModule = MODULES.find((m) => m.moduleId === 'trace')!
const orderModule = MODULES.find((m) => m.moduleId === 'order-list')!

const ctx = {
  entity: 'processOrder' as const,
  processOrderId: '1001234',
  from: 'trace',
}

describe('buildCrossAppUrl', () => {
  it('sets module and entity params', () => {
    const url = buildCrossAppUrl(orderModule, ctx, 'trace')
    const params = new URLSearchParams(url.slice(1))
    expect(params.get('module')).toBe('order-list')
    expect(params.get('entity')).toBe('processOrder')
    expect(params.get('from')).toBe('trace')
  })

  it('includes processOrderId when provided', () => {
    const url = buildCrossAppUrl(orderModule, ctx, 'trace')
    const params = new URLSearchParams(url.slice(1))
    expect(params.get('processOrderId')).toBe('1001234')
  })

  it('includes defaultTab when module has tabs', () => {
    const url = buildCrossAppUrl(orderModule, ctx, 'trace')
    const params = new URLSearchParams(url.slice(1))
    expect(params.get('tab')).toBe('orders')
  })

  it('omits tab param for modules with no tabs', () => {
    const lab = MODULES.find((m) => m.moduleId === 'lab')!
    const url = buildCrossAppUrl(lab, ctx, 'trace')
    const params = new URLSearchParams(url.slice(1))
    expect(params.has('tab')).toBe(false)
  })
})

describe('buildSpaContextUrl', () => {
  it('appends context params to integrated SPA URL', () => {
    const url = buildSpaContextUrl(traceModule, ctx)
    expect(url).toContain('/cq/?module=trace')
    expect(url).toContain('entity=processOrder')
    expect(url).toContain('from=trace')
    expect(url).toContain('processOrderId=1001234')
  })

  it('uses default tab when no activeTabId given', () => {
    const url = buildSpaContextUrl(traceModule, ctx)
    expect(url).toContain('tab=header')
  })

  it('uses provided activeTabId', () => {
    const url = buildSpaContextUrl(traceModule, ctx, 'tree')
    expect(url).toContain('tab=tree')
  })

  it('returns standalone href for standalone apps', () => {
    const enzymes = MODULES.find((m) => m.moduleId === 'enzymes')!
    const url = buildSpaContextUrl(enzymes, ctx)
    expect(url).toContain('/enzymes/')
  })
})
