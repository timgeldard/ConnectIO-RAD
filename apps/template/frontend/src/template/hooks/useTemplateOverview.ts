import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import type { TemplateOverview, TemplateSignal } from '../types'

/**
 * Hook to fetch the Template Module overview read model.
 *
 * @param plantId - Optional SAP plant identifier to filter the overview metrics.
 * @returns React Query result containing the TemplateOverview snapshot.
 */
export function useTemplateOverview(plantId?: string) {
  return useQuery({
    queryKey: ['template', 'overview', plantId ?? 'demo'],
    queryFn: () => api.get<TemplateOverview>('/overview', { query: { plant_id: plantId } }),
  })
}

/**
 * Hook to list actionable signals for the current plant scope.
 *
 * @param plantId - Optional SAP plant identifier to filter the list of signals.
 * @returns React Query result containing an array of TemplateSignal entities.
 */
export function useTemplateSignals(plantId?: string) {
  return useQuery({
    queryKey: ['template', 'signals', plantId ?? 'demo'],
    queryFn: () => api.get<TemplateSignal[]>('/signals', { query: { plant_id: plantId } }),
  })
}
