import { useI18n } from '@connectio/shared-frontend-i18n';
import type { HeatmapStatus } from '~/types';

interface StatusPillProps {
  status: HeatmapStatus;
  label?: string;
}

/** Displays a coloured pill badge for a heatmap inspection status value. */
export default function StatusPill({ status, label }: StatusPillProps) {
  const { t } = useI18n();
  return (
    <span className={`pill status-${status}`}>
      <span className="dot" />
      {label ?? t(`envmon.status.${status}`)}
    </span>
  );
}
