/**
 * FloorPlan — renders the SVG floor plan for the active floor and overlays
 * heatmap markers. Sanitation persona gets blast-radius halos on FAIL markers.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useEM } from '~/context/EMContext';
import { useHeatmap, useFloors } from '~/api/client';
import Marker from './Marker';
import Tooltip from './Tooltip';
import type { MarkerData, PersonaId } from '~/types';

const DEFAULT_WIDTH = 1000;
const DEFAULT_HEIGHT = 700;

interface Props {
  personaId?: PersonaId;
}

export default function FloorPlan({ personaId }: Props) {
  const { view, activeFloor, heatmapMode, timeWindow, setSelectedLocId, historicalDate, decayLambda, selectedMics } = useEM();
  const plantId = view.plantId;
  const { data: floors = [] } = useFloors(plantId);

  const currentFloor = useMemo(
    () => floors.find((f) => f.floor_id === activeFloor) || floors[0],
    [floors, activeFloor],
  );

  const [tooltip, setTooltip] = useState<{ marker: MarkerData; x: number; y: number } | null>(null);

  const { data, isLoading, isError, error } = useHeatmap(
    plantId, activeFloor, heatmapMode, timeWindow, historicalDate, decayLambda, selectedMics,
  );

  const handleMarkerClick = useCallback(
    (marker: MarkerData) => setSelectedLocId(marker.func_loc_id),
    [setSelectedLocId],
  );

  const handleMouseEnter = useCallback(
    (marker: MarkerData, e: React.MouseEvent) => setTooltip({ marker, x: e.clientX, y: e.clientY }),
    [],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  const svgUrl = currentFloor?.svg_url;
  const viewWidth = currentFloor?.svg_width || DEFAULT_WIDTH;
  const viewHeight = currentFloor?.svg_height || DEFAULT_HEIGHT;

  const failMarkers = data?.markers.filter((m) => m.status === 'FAIL') ?? [];
  const showBlastRadius = personaId === 'sanitation';
  const blastR = Math.min(viewWidth, viewHeight) * 0.06;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: 'var(--stone)' }}>

      {/* Loading overlay */}
      {isLoading && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(241,241,229,0.7)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Loading…
          </div>
        </div>
      )}

      {/* Error banner */}
      {isError && (
        <div style={{ position: 'absolute', top: 16, left: 16, right: 16, zIndex: 10, background: 'color-mix(in srgb, var(--sunset) 12%, white)', border: '1px solid var(--sunset)', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: 'var(--forest)' }}>
          <strong>Failed to load heatmap:</strong> {(error as Error).message}
        </div>
      )}

      {/* Floor plan background */}
      {svgUrl ? (
        <img
          key={svgUrl}
          src={svgUrl}
          alt={`Floor plan for ${activeFloor}`}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', display: 'block' }}
        />
      ) : (
        /* Grid fallback */
        <svg
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          aria-hidden="true"
        >
          {[...Array(Math.floor(viewWidth / 80))].map((_, i) => (
            <line key={`gx${i}`} x1={i * 80} y1={0} x2={i * 80} y2={viewHeight} className="grid-line" />
          ))}
          {[...Array(Math.floor(viewHeight / 80))].map((_, i) => (
            <line key={`gy${i}`} x1={0} y1={i * 80} x2={viewWidth} y2={i * 80} className="grid-line" />
          ))}
          <rect x={2} y={2} width={viewWidth - 4} height={viewHeight - 4} fill="none" stroke="rgba(20,55,0,0.12)" strokeWidth="2" />
        </svg>
      )}

      {/* Marker overlay SVG */}
      <svg
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        preserveAspectRatio="xMidYMid meet"
        aria-label={`Heatmap markers for floor ${activeFloor}`}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
      >
        {/* Blast radius halos — sanitation persona only */}
        {showBlastRadius && failMarkers.map((m) => {
          const cx = (m.x_pos / 100) * viewWidth;
          const cy = (m.y_pos / 100) * viewHeight;
          return (
            <g key={`halo-${m.func_loc_id}`}>
              <circle cx={cx} cy={cy} r={blastR} fill="#F24A00" opacity="0.08" />
              <circle cx={cx} cy={cy} r={blastR * 0.55} fill="#F24A00" opacity="0.13" />
            </g>
          );
        })}

        {data?.markers.map((marker) => (
          <Marker
            key={marker.func_loc_id}
            marker={marker}
            mode={heatmapMode}
            svgWidth={viewWidth}
            svgHeight={viewHeight}
            onClick={handleMarkerClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          />
        ))}
      </svg>

      {/* Tooltip */}
      {tooltip && <Tooltip marker={tooltip.marker} x={tooltip.x} y={tooltip.y} />}

      {/* Legend */}
      <div style={{ position: 'absolute', bottom: 12, right: 12, background: 'white', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--stroke)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="legend">
          <span className="item"><span className="sw" style={{ background: '#F24A00' }} />FAIL</span>
          <span className="item"><span className="sw" style={{ background: '#F9C20A' }} />WARN</span>
          <span className="item"><span className="sw" style={{ background: '#B7B7A8' }} />PEND</span>
          <span className="item"><span className="sw" style={{ background: '#44CF93' }} />PASS</span>
          {heatmapMode === 'continuous' && (
            <span className="item"><span className="sw" style={{ background: '#D9D9CB' }} />N/A</span>
          )}
        </div>
      </div>
    </div>
  );
}
