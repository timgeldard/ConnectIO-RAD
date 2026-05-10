import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import type { TemplateOverview, TemplateSignal } from '../types'

export function useTemplateOverview(plantId?: string) {
  return useQuery({
    queryKey: ['template', 'overview', plantId ?? 'demo'],
    queryFn: () => api.get<TemplateOverview>('/overview', { query: { plant_id: plantId } }),
  })
}

export function useTemplateSignals(plantId?: string) {
  return useQuery({
    queryKey: ['template', 'signals', plantId ?? 'demo'],
    queryFn: () => api.get<TemplateSignal[]>('/signals', { query: { plant_id: plantId } }),
  })
}
