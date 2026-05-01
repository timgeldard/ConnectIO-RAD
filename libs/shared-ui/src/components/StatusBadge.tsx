import { Icon } from './Icon'

export type BadgeStatus = 'healthy' | 'warning' | 'critical'

const STATUS_CONFIG: Record<BadgeStatus, { chipClass: string; iconName: string }> = {
  healthy:  { chipClass: 'chip chip-ok',   iconName: 'check-circle' },
  warning:  { chipClass: 'chip chip-warn', iconName: 'alert-triangle' },
  critical: { chipClass: 'chip chip-risk', iconName: 'x-circle' },
}

interface StatusBadgeProps {
  status: BadgeStatus
  label: string
  className?: string
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const { chipClass, iconName } = STATUS_CONFIG[status]

  return (
    <span className={`${chipClass}${className ? ` ${className}` : ''}`} title={label}>
      <Icon name={iconName} size={12} />
      {label}
    </span>
  )
}
