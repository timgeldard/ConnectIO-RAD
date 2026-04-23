/**
 * Global state for the EM app.
 * Adds multi-level navigation (view) and persona gating on top of the original
 * filter state. Theme removed (Kerry design system, no dark mode toggle).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { HeatmapMode, TimeWindow, ViewState, PersonaId } from '~/types';

interface EMState {
  // Navigation
  view: ViewState;
  personaId: PersonaId;
  // Floor-level filters
  activeFloor: string;
  timeWindow: TimeWindow;
  heatmapMode: HeatmapMode;
  selectedLocId: string | null;
  adminMode: boolean;
  sidePanelExpanded: boolean;
  historicalDate: string | null;
  decayLambda: number;
  selectedMics: string[];
}

interface EMActions {
  setView: (v: ViewState) => void;
  setPersonaId: (id: PersonaId) => void;
  setActiveFloor: (floor: string) => void;
  setTimeWindow: (tw: TimeWindow) => void;
  setHeatmapMode: (mode: HeatmapMode) => void;
  setSelectedLocId: (id: string | null) => void;
  setAdminMode: (on: boolean) => void;
  setSidePanelExpanded: (on: boolean) => void;
  setHistoricalDate: (date: string | null) => void;
  setDecayLambda: (val: number) => void;
  setSelectedMics: (mics: string[]) => void;
}

const EMContext = createContext<(EMState & EMActions) | null>(null);

function readSearchParam<T extends string>(key: string, fallback: T, valid: T[]): T {
  if (typeof window === 'undefined') return fallback;
  const v = new URLSearchParams(window.location.search).get(key) as T | null;
  return v && valid.includes(v) ? v : fallback;
}

function readLocalStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function EMProvider({ children }: { children: React.ReactNode }) {
  const [view, setViewRaw] = useState<ViewState>(() =>
    readLocalStorage<ViewState>('em_view', { level: 'global', plantId: null, floorId: null }),
  );
  const [personaId, setPersonaIdRaw] = useState<PersonaId>(() =>
    readLocalStorage<PersonaId>('em_persona', 'regional'),
  );

  const [activeFloor, setActiveFloorRaw] = useState<string>(
    () => new URLSearchParams(window.location.search).get('floor') ?? view.floorId ?? 'F1',
  );
  const [timeWindow, setTimeWindowRaw] = useState<TimeWindow>(
    () =>
      (readSearchParam<string>('tw', '365', ['30', '60', '90', '180', '365']) as unknown as TimeWindow)
      ?? 365,
  );
  const [heatmapMode, setHeatmapModeRaw] = useState<HeatmapMode>(
    () => readSearchParam<HeatmapMode>('mode', 'deterministic', ['deterministic', 'continuous']),
  );
  const [selectedLocId, setSelectedLocId] = useState<string | null>(null);
  const [adminMode, setAdminMode] = useState(false);
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
    localStorage.setItem('em_view', JSON.stringify(v));
    // Sync activeFloor when navigating into a floor
    if (v.floorId) setActiveFloorRaw(v.floorId);
    setSelectedLocId(null);
  }, []);

  const setPersonaId = useCallback((id: PersonaId) => {
    setPersonaIdRaw(id);
    localStorage.setItem('em_persona', JSON.stringify(id));
  }, []);

  const setActiveFloor = useCallback(
    (floor: string) => {
      setActiveFloorRaw(floor);
      setSelectedLocId(null);
      pushParam('floor', floor);
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
      view, personaId,
      activeFloor, timeWindow, heatmapMode,
      selectedLocId, adminMode, sidePanelExpanded,
      historicalDate, decayLambda, selectedMics,
      setView, setPersonaId,
      setActiveFloor, setTimeWindow, setHeatmapMode,
      setSelectedLocId, setAdminMode, setSidePanelExpanded,
      setHistoricalDate, setDecayLambda, setSelectedMics,
    }),
    [
      view, personaId,
      activeFloor, timeWindow, heatmapMode,
      selectedLocId, adminMode, sidePanelExpanded,
      historicalDate, decayLambda, selectedMics,
      setView, setPersonaId,
      setActiveFloor, setTimeWindow, setHeatmapMode,
      setSelectedLocId, setSidePanelExpanded,
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
