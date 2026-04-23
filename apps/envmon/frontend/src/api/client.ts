/**
 * React Query hooks for all EM API endpoints.
 * All fetches are unauthenticated from the frontend — the Databricks Apps
 * proxy injects the x-forwarded-access-token header on the backend.
 * Every plant-scoped hook requires plantId as its first argument.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '@connectio/shared-frontend-api';
import type {
  FloorInfo,
  LocationMeta,
  HeatmapResponse,
  HeatmapMode,
  TrendResponse,
  InspectionLot,
  LotDetailResponse,
  LocationSummary,
  CoordinateUpsertRequest,
  PlantInfo,
} from '~/types';

const apiFetch = fetchJson;

// ---------------------------------------------------------------------------
// Plants (portfolio — no plant_id needed, returns all active plants)
// ---------------------------------------------------------------------------

export function usePlants() {
  return useQuery<PlantInfo[]>({
    queryKey: ['plants'],
    queryFn: () => apiFetch('/api/em/plants'),
    staleTime: 5 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// Floors
// ---------------------------------------------------------------------------

export function useFloors(plantId: string | null) {
  return useQuery<FloorInfo[]>({
    queryKey: ['floors', plantId],
    queryFn: () => apiFetch(`/api/em/floors?plant_id=${encodeURIComponent(plantId!)}`),
    staleTime: 5 * 60_000,
    enabled: Boolean(plantId),
  });
}

export function useLocations(plantId: string | null, floorId?: string, mappedOnly = false) {
  const params = new URLSearchParams();
  if (plantId) params.set('plant_id', plantId);
  if (floorId) params.set('floor_id', floorId);
  if (mappedOnly) params.set('mapped_only', 'true');

  return useQuery<LocationMeta[]>({
    queryKey: ['locations', plantId, floorId, mappedOnly],
    queryFn: () => apiFetch(`/api/em/locations?${params}`),
    staleTime: 5 * 60_000,
    enabled: Boolean(plantId),
  });
}

// ---------------------------------------------------------------------------
// Heatmap
// ---------------------------------------------------------------------------

export function useHeatmap(
  plantId: string | null,
  floorId: string,
  mode: HeatmapMode,
  timeWindowDays: number,
  asOfDate?: string | null,
  decayLambda?: number,
  mics?: string[],
) {
  const params = new URLSearchParams({
    plant_id: plantId ?? '',
    floor_id: floorId,
    mode,
    time_window_days: String(timeWindowDays),
  });
  if (asOfDate) params.set('as_of_date', asOfDate);
  if (decayLambda !== undefined) params.set('decay_lambda', String(decayLambda));
  if (mics?.length) mics.forEach((m) => params.append('mics', m));

  return useQuery<HeatmapResponse>({
    queryKey: ['heatmap', plantId, floorId, mode, timeWindowDays, asOfDate, decayLambda, mics],
    queryFn: () => apiFetch(`/api/em/heatmap?${params}`),
    staleTime: 5 * 60_000,
    enabled: Boolean(plantId && floorId),
  });
}

// ---------------------------------------------------------------------------
// Trends
// ---------------------------------------------------------------------------

export function useMics(plantId: string | null, funcLocId: string | null = null) {
  const params = new URLSearchParams();
  if (plantId) params.set('plant_id', plantId);
  if (funcLocId) params.set('func_loc_id', funcLocId);

  return useQuery<string[]>({
    queryKey: ['mics', plantId, funcLocId],
    queryFn: () => apiFetch(`/api/em/mics?${params}`),
    staleTime: 10 * 60_000,
    enabled: Boolean(plantId),
  });
}

export function useTrends(
  plantId: string | null,
  funcLocId: string | null,
  micName: string | null,
  windowDays: number,
) {
  const params = new URLSearchParams();
  if (plantId)   params.set('plant_id',    plantId);
  if (funcLocId) params.set('func_loc_id', funcLocId);
  if (micName)   params.set('mic_name',    micName);
  params.set('window_days', String(windowDays));

  return useQuery<TrendResponse>({
    queryKey: ['trends', plantId, funcLocId, micName, windowDays],
    queryFn: () => apiFetch(`/api/em/trends?${params}`),
    enabled: Boolean(plantId && funcLocId && micName),
    staleTime: 5 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// Lots
// ---------------------------------------------------------------------------

export function useLots(plantId: string | null, funcLocId: string | null, timeWindowDays: number) {
  const params = new URLSearchParams();
  if (plantId)   params.set('plant_id',        plantId);
  if (funcLocId) params.set('func_loc_id',     funcLocId);
  params.set('time_window_days', String(timeWindowDays));

  return useQuery<InspectionLot[]>({
    queryKey: ['lots', plantId, funcLocId, timeWindowDays],
    queryFn: () => apiFetch(`/api/em/lots?${params}`),
    enabled: Boolean(plantId && funcLocId),
    staleTime: 5 * 60_000,
  });
}

export function useLotDetail(plantId: string | null, lotId: string | null) {
  const params = new URLSearchParams();
  if (plantId) params.set('plant_id', plantId);

  return useQuery<LotDetailResponse>({
    queryKey: ['lot-detail', plantId, lotId],
    queryFn: () => apiFetch(`/api/em/lots/${lotId}?${params}`),
    enabled: Boolean(plantId && lotId),
    staleTime: 5 * 60_000,
  });
}

export function useLocationSummary(plantId: string | null, funcLocId: string | null) {
  const params = new URLSearchParams();
  if (plantId) params.set('plant_id', plantId);

  return useQuery<LocationSummary>({
    queryKey: ['location-summary', plantId, funcLocId],
    queryFn: () => apiFetch(`/api/em/locations/${encodeURIComponent(funcLocId!)}/summary?${params}`),
    enabled: Boolean(plantId && funcLocId),
    staleTime: 5 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// Coordinates (admin)
// ---------------------------------------------------------------------------

export function useUnmappedLocations(plantId: string | null) {
  return useQuery<LocationMeta[]>({
    queryKey: ['coordinates', 'unmapped', plantId],
    queryFn: () => apiFetch(`/api/em/coordinates/unmapped?plant_id=${encodeURIComponent(plantId!)}`),
    staleTime: 60_000,
    enabled: Boolean(plantId),
  });
}

export function useMappedLocations(plantId: string | null) {
  return useQuery<LocationMeta[]>({
    queryKey: ['coordinates', 'mapped', plantId],
    queryFn: () => apiFetch(`/api/em/coordinates/mapped?plant_id=${encodeURIComponent(plantId!)}`),
    staleTime: 60_000,
    enabled: Boolean(plantId),
  });
}

export function useSaveCoordinate() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, CoordinateUpsertRequest>({
    mutationFn: (body) =>
      apiFetch('/api/em/coordinates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['coordinates', 'unmapped', variables.plant_id] });
      queryClient.invalidateQueries({ queryKey: ['coordinates', 'mapped',   variables.plant_id] });
      queryClient.invalidateQueries({ queryKey: ['locations',   variables.plant_id] });
      queryClient.invalidateQueries({ queryKey: ['heatmap',     variables.plant_id] });
    },
  });
}

export function useDeleteCoordinate() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, { plantId: string; funcLocId: string }>({
    mutationFn: ({ plantId, funcLocId }) =>
      apiFetch(`/api/em/coordinates/${encodeURIComponent(funcLocId)}?plant_id=${encodeURIComponent(plantId)}`, {
        method: 'DELETE',
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['coordinates', 'unmapped', variables.plantId] });
      queryClient.invalidateQueries({ queryKey: ['coordinates', 'mapped',   variables.plantId] });
      queryClient.invalidateQueries({ queryKey: ['locations',   variables.plantId] });
      queryClient.invalidateQueries({ queryKey: ['heatmap',     variables.plantId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Floor management (admin)
// ---------------------------------------------------------------------------

export interface FloorCreateBody {
  plant_id: string;
  floor_id: string;
  floor_name: string;
  svg_url?: string;
  svg_width?: number;
  svg_height?: number;
  sort_order?: number;
}

export function useAddFloor() {
  const queryClient = useQueryClient();
  return useMutation<FloorInfo, Error, FloorCreateBody>({
    mutationFn: (body) =>
      apiFetch('/api/em/floors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['floors', variables.plant_id] });
      queryClient.invalidateQueries({ queryKey: ['plants'] });
    },
  });
}

export function useDeleteFloor() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, { plantId: string; floorId: string }>({
    mutationFn: ({ plantId, floorId }) =>
      apiFetch(`/api/em/floors/${encodeURIComponent(floorId)}?plant_id=${encodeURIComponent(plantId)}`, {
        method: 'DELETE',
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['floors', variables.plantId] });
      queryClient.invalidateQueries({ queryKey: ['plants'] });
    },
  });
}
