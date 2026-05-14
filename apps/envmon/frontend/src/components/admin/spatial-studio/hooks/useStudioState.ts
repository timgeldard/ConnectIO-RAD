import { useState, useCallback } from 'react';
import type { StudioMode } from '~/types';

export interface StudioState {
  activeMode: StudioMode;
  selectedZoneId: string | null;
  selectedPointId: string | null;
  isDirty: boolean;
}

export interface StudioActions {
  setMode: (mode: StudioMode) => void;
  selectZone: (zoneId: string | null) => void;
  selectPoint: (funcLocId: string | null) => void;
  markDirty: () => void;
  clearDirty: () => void;
  reset: () => void;
}

const INITIAL_STATE: StudioState = {
  activeMode: 'structure',
  selectedZoneId: null,
  selectedPointId: null,
  isDirty: false,
};

/** Local ephemeral state for the Spatial Studio authoring session. */
export function useStudioState(): StudioState & StudioActions {
  const [state, setState] = useState<StudioState>(INITIAL_STATE);

  const setMode = useCallback((mode: StudioMode) => {
    setState(s => ({ ...s, activeMode: mode, selectedZoneId: null, selectedPointId: null }));
  }, []);

  const selectZone = useCallback((zoneId: string | null) => {
    setState(s => ({ ...s, selectedZoneId: zoneId, selectedPointId: null }));
  }, []);

  const selectPoint = useCallback((funcLocId: string | null) => {
    setState(s => ({ ...s, selectedPointId: funcLocId }));
  }, []);

  const markDirty = useCallback(() => {
    setState(s => ({ ...s, isDirty: true }));
  }, []);

  const clearDirty = useCallback(() => {
    setState(s => ({ ...s, isDirty: false }));
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return { ...state, setMode, selectZone, selectPoint, markDirty, clearDirty, reset };
}
