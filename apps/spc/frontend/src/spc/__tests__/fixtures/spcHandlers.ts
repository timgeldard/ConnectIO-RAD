/* eslint-disable jsdoc/require-jsdoc */
import { http, HttpResponse } from 'msw'
import type { PlantRef, MicRef, ScorecardRow } from '../../types'

export const FIXTURE_PLANTS: PlantRef[] = [
  { plant_id: 'P001', plant_name: 'Kerry Shillelagh' },
  { plant_id: 'P002', plant_name: 'Kerry Charleville' },
]

export const FIXTURE_CHARACTERISTICS: MicRef[] = [
  { mic_id: 'MIC001', mic_name: 'Moisture %', chart_type: 'imr', batch_count: 42 },
  { mic_id: 'MIC002', mic_name: 'Protein %', chart_type: 'imr', batch_count: 38 },
  { mic_id: 'MIC003', mic_name: 'Fat %', chart_type: 'xbar_r', batch_count: 25 },
]

export const FIXTURE_SCORECARD: ScorecardRow[] = [
  {
    mic_id: 'MIC001',
    mic_name: 'Moisture %',
    batch_count: 42,
    cpk: 1.45,
    ppk: 1.38,
    ooc_rate: 0,
    capability_status: 'good',
    is_stable: true,
  },
  {
    mic_id: 'MIC002',
    mic_name: 'Protein %',
    batch_count: 38,
    cpk: 1.12,
    ppk: 1.09,
    ooc_rate: 0.05,
    capability_status: 'marginal',
    is_stable: true,
  },
  {
    mic_id: 'MIC003',
    mic_name: 'Fat %',
    batch_count: 25,
    cpk: 0.82,
    ppk: 0.79,
    ooc_rate: 0.12,
    capability_status: 'poor',
    is_stable: false,
  },
]

export const spcHandlers = [
  http.get('/api/spc/plants', () =>
    HttpResponse.json({ plants: FIXTURE_PLANTS }),
  ),

  http.post('/api/spc/characteristics', () =>
    HttpResponse.json({
      characteristics: FIXTURE_CHARACTERISTICS,
      attr_characteristics: [],
    }),
  ),

  http.post('/api/spc/scorecard', () =>
    HttpResponse.json({ scorecard: FIXTURE_SCORECARD }),
  ),
]
