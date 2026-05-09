import { PlantContextBar as SharedPlantContextBar } from '@connectio/shared-app-context'
import { useI18n } from '@connectio/shared-frontend-i18n'

/**
 * 40px context bar rendered in the PlatformShell contextBar slot.
 * Re-exports from @connectio/shared-app-context but with app-specific label.
 */
export function PlantContextBar() {
  const { t } = useI18n()
  return <SharedPlantContextBar label={t('warehouse.plant.selector')} />
}
