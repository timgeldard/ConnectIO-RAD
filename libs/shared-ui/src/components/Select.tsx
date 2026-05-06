interface Option {
  label: string;
  value: string;
}

interface SelectProps {
  label?: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Shared Select component for dropdown selection.
 */
export function Select({ label, options, value, onChange, className, disabled }: SelectProps) {
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
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          padding: '8px 12px',
          background: 'var(--surface-1)',
          border: '1px solid var(--line-2)',
          borderRadius: 'var(--r-sm)',
          fontSize: 'var(--fs-14)',
          color: 'var(--text-1)',
          width: '100%',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
