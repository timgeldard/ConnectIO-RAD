import { QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '@connectio/shared-frontend-i18n'
import { PlantProvider } from '@connectio/shared-app-context'
import { queryClient } from './queryClient'
import { TemplatePage } from './template/pages/TemplatePage'

/** Root application providers for Template Module. */
export function Root() {
  return (
    <I18nProvider appName="template">
      <PlantProvider appName="template">
        <QueryClientProvider client={queryClient}>
          <TemplatePage />
        </QueryClientProvider>
      </PlantProvider>
    </I18nProvider>
  )
}
