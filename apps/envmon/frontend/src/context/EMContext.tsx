/* eslint-disable jsdoc/require-jsdoc */
/**
 * Global state for the EM app.
 * Adds multi-level navigation (view) and persona gating on top of the original
 * filter state. Theme removed (Kerry design system, no dark mode toggle).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { usePlantSelection } from '@connectio/shared-app-context';
import type { HeatmapMode, TimeWindow, ViewState, PersonaId } from '~/types';

interface EMState {
  // Navigation
  view: ViewState;
  personaId: PersonaId;
  // Portfolio-level filter (days picker on GlobalView)
  portfolioDays: number;
  // Floor-level filters
  activeFloor: string | null;
  timeWindow: TimeWindow;
  heatmapMode: HeatmapMode;
  selectedLocId: string | null;
  adminMode: boolean;
  sidePanelExpanded: boolean;
  historicalDate: string | null;
  decayLambda: number;
  selectedMics: string[];
  /** Whether the Spatial Studio authoring overlay is open (admin-only). */
  spatialStudioOpen: boolean;
}

interface EMActions {
  setView: (v: ViewState) => void;
  setPersonaId: (id: PersonaId) => void;
  setPortfolioDays: (days: number) => void;
  setActiveFloor: (floor: string | null) => void;
  setTimeWindow: (tw: TimeWindow) => void;
  setHeatmapMode: (mode: HeatmapMode) => void;
  setSelectedLocId: (id: string | null) => void;
  setAdminMode: (on: boolean) => void;
  setSidePanelExpanded: (on: boolean) => void;
  setHistoricalDate: (date: string | null) => void;
  setDecayLambda: (val: number) => void;
  setSelectedMics: (mics: string[]) => void;
  setSpatialStudioOpen: (on: boolean) => void;
}

const EMContext = createContext<(EMState & EMActions) | null>(null);
const EM_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const EM_SESSION_KEYS = ['em_view', 'em_persona', 'em_portfolio_days'] as const;

/** Stored session value wrapped with an absolute expiry timestamp. */
interface StoredValue<T> {
  value: T;
  expiresAt: number;
}

function readSearchParam<T extends string>(key: string, fallback: T, valid: T[]): T {
  if (typeof window === 'undefined') return fallback;
  const v = new URLSearchParams(window.location.search).get(key) as T | null;
  return v && valid.includes(v) ? v : fallback;
}

/** Clear all Environmental Monitoring session state from browser storage. */
function clearEMSessionState() {
  if (typeof window === 'undefined') return;
  for (const key of EM_SESSION_KEYS) {
    window.sessionStorage.removeItem(key);
  }
}

/**
 * Read a TTL-bound value from session storage.
 *
 * @param key - Session storage key.
 * @param fallback - Value to use when the key is missing, expired, or malformed.
 * @returns The stored value when valid, otherwise the fallback.
 */
function readSessionStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw) as Partial<StoredValue<T>> | null;
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      typeof parsed.expiresAt !== 'number' ||
      !Number.isFinite(parsed.expiresAt) ||
      !('value' in parsed)
    ) {
      window.sessionStorage.removeItem(key);
      return fallback;
    }
    if (parsed.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(key);
      return fallback;
    }
    return parsed.value as T;
  } catch {
    return fallback;
  }
}

/**
 * Write a TTL-bound value to session storage.
 *
 * @param key - Session storage key.
 * @param value - Value to persist.
 */
function writeSessionStorage<T>(key: string, value: T) {
  try {
    const payload: StoredValue<T> = {
      value,
      expiresAt: Date.now() + EM_SESSION_TTL_MS,
    };
    window.sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Session persistence is best-effort.
  }
}

/**
 * Provide Environmental Monitoring UI state and navigation actions.
 *
 * @param props - Provider props.
 * @param props.children - Descendant components that consume the EM context.
 * @returns The EM context provider tree.
 */
export function EMProvider({ children }: { children: React.ReactNode }) {
  const { selectedPlantId, setSelectedPlantId } = usePlantSelection();

  const [view, setViewRaw] = useState<ViewState>(() =>
    readSessionStorage<ViewState>('em_view', { level: 'global', plantId: null, floorId: null }),
  );

  useEffect(() => {
    window.addEventListener('connectio:logout', clearEMSessionState);
    return () => window.removeEventListener('connectio:logout', clearEMSessionState);
  }, []);

  // Sync shared PlantProvider state into EM view state when it changes
  useEffect(() => {
    if (selectedPlantId && view.plantId !== selectedPlantId) {
      setViewRaw(prev => {
        if (prev.level === 'global') return { level: 'site', plantId: selectedPlantId, floorId: null };
        return { ...prev, plantId: selectedPlantId };
      });
    } else if (!selectedPlantId && view.plantId !== null) {
       setViewRaw(prev => ({ ...prev, level: 'global', plantId: null, floorId: null }));
    }
  }, [selectedPlantId]);

  // Sync EM view state back to shared PlantProvider when user navigates
  useEffect(() => {
    if (view.plantId && view.plantId !== selectedPlantId) {
      setSelectedPlantId(view.plantId);
    }
  }, [view.plantId, selectedPlantId, setSelectedPlantId]);

  const [personaId, setPersonaIdRaw] = useState<PersonaId>(() =>
    readSessionStorage<PersonaId>('em_persona', 'regional'),
  );

  const [portfolioDays, setPortfolioDaysRaw] = useState<number>(() =>
    readSessionStorage<number>('em_portfolio_days', 30),
  );

  const [activeFloor, setActiveFloorRaw] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('floor') ?? view.floorId ?? null,
  );
  const [timeWindow, setTimeWindowRaw] = useState<TimeWindow>(
    () => {
      const raw = readSearchParam('tw', '365', ['30', '60', '90', '180', '365', '730']);
      return (parseInt(raw, 10) as TimeWindow) || 365;
    }
  );
  const [heatmapMode, setHeatmapModeRaw] = useState<HeatmapMode>(
    () => readSearchParam<HeatmapMode>('mode', 'deterministic', ['deterministic', 'continuous']),
  );
  const [selectedLocId, setSelectedLocId] = useState<string | null>(null);
  const [adminMode, setAdminMode] = useState(false);
  const [spatialStudioOpen, setSpatialStudioOpen] = useState(false);
  const [sidePanelExpanded, setSidePanelExpanded] = useState(false);
  const [historicalDate, setHistoricalDateRaw] = useState<string | null>(null);
  const [decayLambda, setDecayLambdaRaw] = useState<number>(() => {
    const raw = new URLSearchParams(window.location.search).get('lambda');
    const parsed = raw ? parseFloat(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : 0.1;
  });
  const [selectedMics, setSelectedMicsRaw] = useState<string[]>(
    () => new URLSearchParams(window.location.search).get('mics')?.split(',').filter(Boolean) || [],
  );

  const pushParam = useCallback((key: string, value: string) => {
    const sp = new URLSearchParams(window.location.search);
    if (value) sp.set(key, value); else sp.delete(key);
    window.history.replaceState(null, '', `?${sp}`);
  }, []);

  const setView = useCallback((v: ViewState) => {
    setViewRaw(v);
    writeSessionStorage('em_view', v);
    // Sync activeFloor when navigating into a floor
    if (v.floorId) setActiveFloorRaw(v.floorId);
    setSelectedLocId(null);
  }, []);

  const setPersonaId = useCallback((id: PersonaId) => {
    setPersonaIdRaw(id);
    writeSessionStorage('em_persona', id);
  }, []);

  const setPortfolioDays = useCallback((days: number) => {
    setPortfolioDaysRaw(days);
    writeSessionStorage('em_portfolio_days', days);
  }, []);

  const setActiveFloor = useCallback(
    (floor: string | null) => {
      setActiveFloorRaw(floor);
      setSelectedLocId(null);
      if (floor) {
        pushParam('floor', floor);
      } else {
        const sp = new URLSearchParams(window.location.search);
        sp.delete('floor');
        window.history.replaceState(null, '', `?${sp}`);
      }
      setViewRaw((prev) => ({ ...prev, floorId: floor }));
    },
    [pushParam],
  );

  const setTimeWindow = useCallback(
    (tw: TimeWindow) => { setTimeWindowRaw(tw); pushParam('tw', String(tw)); },
    [pushParam],
  );

  const setHeatmapMode = useCallback(
    (mode: HeatmapMode) => { setHeatmapModeRaw(mode); pushParam('mode', mode); },
    [pushParam],
  );

  const setHistoricalDate = useCallback((date: string | null) => {
    setHistoricalDateRaw(date);
  }, []);

  const setDecayLambda = useCallback(
    (val: number) => { setDecayLambdaRaw(val); pushParam('lambda', String(val)); },
    [pushParam],
  );

  const setSelectedMics = useCallback(
    (mics: string[]) => { setSelectedMicsRaw(mics); pushParam('mics', mics.join(',')); },
    [pushParam],
  );

  const value = useMemo(
    () => ({
      view, personaId, portfolioDays,
      activeFloor, timeWindow, heatmapMode,
      selectedLocId, adminMode, spatialStudioOpen, sidePanelExpanded,
      historicalDate, decayLambda, selectedMics,
      setView, setPersonaId, setPortfolioDays,
      setActiveFloor, setTimeWindow, setHeatmapMode,
      setSelectedLocId, setAdminMode, setSpatialStudioOpen, setSidePanelExpanded,
      setHistoricalDate, setDecayLambda, setSelectedMics,
    }),
    [
      view, personaId, portfolioDays,
      activeFloor, timeWindow, heatmapMode,
      selectedLocId, adminMode, spatialStudioOpen, sidePanelExpanded,
      historicalDate, decayLambda, selectedMics,
      setView, setPersonaId, setPortfolioDays,
      setActiveFloor, setTimeWindow, setHeatmapMode,
      setSelectedLocId, setAdminMode, setSpatialStudioOpen, setSidePanelExpanded,
      setHistoricalDate, setDecayLambda, setSelectedMics,
    ],
  );

  return <EMContext.Provider value={value}>{children}</EMContext.Provider>;
}

export function useEM(): EMState & EMActions {
  const ctx = useContext(EMContext);
  if (!ctx) throw new Error('useEM must be used inside <EMProvider>');
  return ctx;
}
