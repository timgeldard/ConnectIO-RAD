import React from 'react';

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

/**
 * Shared Tabs component.
 */
export function Tabs({ tabs, activeId, onChange, className }: TabsProps) {
  return (
    <div className={className} style={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      borderBottom: '1px solid var(--line-1)',
      padding: '0 20px',
      background: 'var(--surface-1)',
    }}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              padding: '12px 16px',
              fontSize: 'var(--fs-14)',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--brand)' : 'var(--text-3)',
              borderBottom: `2px solid ${isActive ? 'var(--brand)' : 'transparent'}`,
              marginBottom: -1,
              transition: 'all 140ms ease',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
