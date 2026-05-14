import { useState, useCallback } from 'react';
import type { StudioMode } from '~/types';

/**
 * Ephemeral UI state for the Spatial Studio authoring session.
 * Holds the active editing mode and the current selection.
 */
export interface StudioState {
  /** Currently active editing mode — `'structure'`, `'place'`, or `'inspect'`. */
  activeMode: StudioMode;
  /** Currently selected L4 zone_id, or null when nothing is selected. */
  selectedZoneId: string | null;
  /** Currently selected L5 func_loc_id, or null when nothing is selected. */
  selectedPointId: string | null;
  /** True when unsaved zone/point changes exist in the open draft. */
  isDirty: boolean;
}

/**
 * Mutators for {@link StudioState}, returned alongside state by {@link useStudioState}.
 * All actions are stable callback refs (never change identity between renders).
 */
export interface StudioActions {
  /** Switch to a new mode; clears the current zone and point selection. */
  setMode: (mode: StudioMode) => void;
  /** Set the selected L4 zone; clears selectedPointId. */
  selectZone: (zoneId: string | null) => void;
  /** Set the selected L5 point. */
  selectPoint: (funcLocId: string | null) => void;
  /** Mark the draft as having unsaved changes. */
  markDirty: () => void;
  /** Clear the dirty flag (e.g. after a successful save). */
  clearDirty: () => void;
  /** Reset all state to the initial values (called when closing a draft). */
  reset: () => void;
}

const INITIAL_STATE: StudioState = {
  activeMode: 'structure',
  selectedZoneId: null,
  selectedPointId: null,
  isDirty: false,
};

/**
 * Local ephemeral state for the Spatial Studio authoring session.
 *
 * Merges {@link StudioState} and {@link StudioActions} into a single return value
 * so callers can destructure only what they need. State resets to
 * {@link INITIAL_STATE} on `reset()` — call this when a floor is deselected or
 * a draft is discarded.
 *
 * @returns Combined state and actions object.
 */
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
