import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import {
  buildExportFilename,
  downloadBlob,
  pngDataUrlToBlob,
  svgStringToBlob,
} from '../exportHelpers'

describe('buildExportFilename', () => {
  test('embeds material + batch + view + timestamp', () => {
    const out = buildExportFilename(
      { material_id: 'MAT-A', batch_id: 'B1' },
      'advanced',
      'png',
      new Date('2026-05-12T13:45:00Z'),
    )
    // Date is locale-dependent; assert the structural pieces are present.
    expect(out).toMatch(/^lineage-MAT-A-B1-advanced-\d{8}T\d{4}\.png$/)
  })

  test('sanitises filesystem-unsafe characters', () => {
    const out = buildExportFilename(
      { material_id: 'MAT/A:1', batch_id: 'B 1' },
      'sankey',
      'svg',
    )
    expect(out).toMatch(/MAT_A_1/)
    expect(out).toMatch(/B_1/)
    expect(out).not.toMatch(/[\/: ]/)
  })

  test('falls back to placeholders when ids are empty', () => {
    const out = buildExportFilename(
      { material_id: '', batch_id: '' },
      '',
      'png',
    )
    expect(out).toContain('material')
    expect(out).toContain('batch')
    expect(out).toContain('view')
  })
})

describe('pngDataUrlToBlob', () => {
  test('decodes a base64 PNG into a Blob', () => {
    // 1x1 transparent PNG
    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='
    const blob = pngDataUrlToBlob(dataUrl)
    expect(blob.type).toBe('image/png')
    expect(blob.size).toBeGreaterThan(0)
  })

  test('rejects non-PNG data URIs', () => {
    expect(() => pngDataUrlToBlob('data:image/jpeg;base64,abc==')).toThrow(/PNG/)
    expect(() => pngDataUrlToBlob('not a data uri')).toThrow(/PNG/)
  })
})

describe('svgStringToBlob', () => {
  test('produces a Blob with the SVG mime type', () => {
    const blob = svgStringToBlob('<svg></svg>')
    expect(blob.type).toBe('image/svg+xml;charset=utf-8')
    expect(blob.size).toBeGreaterThan(0)
  })
})

describe('downloadBlob', () => {
  let createUrl: ReturnType<typeof vi.spyOn>
  let revokeUrl: ReturnType<typeof vi.spyOn>
  let clickSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:fake')
    revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    clickSpy = vi.fn()
    // Patch anchor creation so we can spy on click().  The cast through
    // `unknown` reconciles vi.fn()'s broad signature with the
    // HTMLAnchorElement.click() return type without losing the spy wiring.
    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag) as HTMLAnchorElement
      if (tag === 'a') {
        el.click = clickSpy as unknown as HTMLAnchorElement['click']
      }
      return el
    })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  test('triggers an anchor click with the given filename', () => {
    downloadBlob(new Blob(['x']), 'test.png')
    expect(createUrl).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  test('revokes the object URL after a short delay', () => {
    downloadBlob(new Blob(['x']), 'test.png')
    expect(revokeUrl).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(revokeUrl).toHaveBeenCalledWith('blob:fake')
  })
})
