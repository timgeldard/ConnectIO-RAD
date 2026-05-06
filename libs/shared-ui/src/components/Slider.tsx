import React from 'react';

interface SliderProps {
  label?: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

/**
 * Shared Slider component for range selection.
 */
export function Slider({ label, min, max, step = 1, value, onChange, className }: SliderProps) {
  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label style={{
          fontSize: 'var(--fs-12)',
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-3)',
          fontWeight: 600,
        }}>
          {label}
        </label>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          accentColor: 'var(--brand)',
          cursor: 'pointer',
        }}
      />
    </div>
  );
}
