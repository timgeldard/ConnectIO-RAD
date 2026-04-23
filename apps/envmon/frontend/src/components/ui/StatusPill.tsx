import React from 'react';
import type { HeatmapStatus } from '~/types';

interface StatusPillProps {
  status: HeatmapStatus;
  label?: string;
}

const STATUS_LABELS: Record<HeatmapStatus, string> = {
  PASS:    'Pass',
  FAIL:    'Fail',
  WARNING: 'Warning',
  PENDING: 'Pending',
  NO_DATA: 'No data',
};

export default function StatusPill({ status, label }: StatusPillProps) {
  return (
    <span className={`pill status-${status}`}>
      <span className="dot" />
      {label ?? STATUS_LABELS[status] ?? status}
    </span>
  );
}
