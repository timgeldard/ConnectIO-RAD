import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  fetchPlants, 
  fetchCharacteristics, 
  fetchDataQuality,
  fetchCorrelation,
  fetchMultivariate,
  fetchLockedLimits
} from '../spc'
import { fetchJson } from '../client'

vi.mock('../client', () => ({
  fetchJson: vi.fn()
}))

describe('spc api client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchPlants handles successful response', async () => {
    const mockPlants = [{ plant_id: 'P1', plant_name: 'Plant 1' }]
    vi.mocked(fetchJson).mockResolvedValue({ plants: mockPlants })

    const result = await fetchPlants('M1')
    
    expect(result).toEqual(mockPlants)
    expect(fetchJson).toHaveBeenCalledWith('/api/spc/plants?material_id=M1', expect.any(Object))
  })

  it('fetchCharacteristics handles material and plant input', async () => {
    const mockMics = { characteristics: [{ mic_id: 'C1' }], attr_characteristics: [] }
    vi.mocked(fetchJson).mockResolvedValue(mockMics)

    const result = await fetchCharacteristics('M1', 'P1')
    
    expect(result.characteristics).toHaveLength(1)
    expect(fetchJson).toHaveBeenCalledWith('/api/spc/characteristics', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ material_id: 'M1', plant_id: 'P1' })
    }))
  })

  it('fetchDataQuality sends correct payload', async () => {
    const mockQuality = { n_samples: 100, n_batches: 10 }
    vi.mocked(fetchJson).mockResolvedValue(mockQuality)

    const result = await fetchDataQuality('M1', 'C1', 'P1', '2024-01-01', '2024-01-31', 'OP1')
    
    expect(result).toEqual(mockQuality)
    expect(fetchJson).toHaveBeenCalledWith('/api/spc/data-quality', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        material_id: 'M1',
        mic_id: 'C1',
        plant_id: 'P1',
        date_from: '2024-01-01',
        date_to: '2024-01-31',
        operation_id: 'OP1'
      })
    }))
  })

  it('fetchCorrelation handles success', async () => {
    const mockData = { pairs: [{ mic_a_id: 'C1', mic_b_id: 'C2', pearson_r: 0.8, shared_batches: 5 }] }
    vi.mocked(fetchJson).mockResolvedValue(mockData)

    const result = await fetchCorrelation('M1', 'P1', '2024-01-01', '2024-12-31', 5)
    
    expect(result.pairs).toHaveLength(1)
    expect(fetchJson).toHaveBeenCalledWith('/api/spc/correlation', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"min_batches":5')
    }))
  })

  it('fetchMultivariate sends correct data', async () => {
    vi.mocked(fetchJson).mockResolvedValue({ n_observations: 10 })

    await fetchMultivariate('M1', ['C1', 'C2'], 'P1', '2024-01-01', '2024-12-31')
    
    expect(fetchJson).toHaveBeenCalledWith('/api/spc/multivariate', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"mic_ids":["C1","C2"]')
    }))
  })

  it('fetchLockedLimits constructs query params', async () => {
    vi.mocked(fetchJson).mockResolvedValue({ locked_limits: { ucl: 10 } })

    const result = await fetchLockedLimits('M1', 'C1', 'IMR', 'P1', 'OP1', 'UK1')
    
    expect(result).toEqual({ ucl: 10 })
    const lastCall = vi.mocked(fetchJson).mock.calls.find(c => c[0].toString().includes('locked-limits'))
    expect(lastCall![0]).toContain('material_id=M1')
    expect(lastCall![0]).toContain('plant_id=P1')
  })
})
