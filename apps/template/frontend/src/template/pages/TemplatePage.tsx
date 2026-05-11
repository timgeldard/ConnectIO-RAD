/* eslint-disable jsdoc/require-jsdoc */
import { useI18n } from '@connectio/shared-frontend-i18n'
import { TemplateMetricGrid } from '../components/TemplateMetricGrid'
import { useTemplateOverview } from '../hooks/useTemplateOverview'

/** Demo-ready first page for Template Module. */
export function TemplatePage() {
  const { t } = useI18n()
  const overview = useTemplateOverview()

  if (overview.isLoading) {
    return <main className="rad-page"><p>{t('loading')}</p></main>
  }

  if (overview.isError || !overview.data?.data_available) {
    return (
      <main className="rad-page">
        <h1>{t('title')}</h1>
        <p>{t('empty')}</p>
      </main>
    )
  }

  return (
    <main className="rad-page">
      <header className="rad-page__header">
        <div>
          <p className="rad-page__eyebrow">demo</p>
          <h1>{t('title')}</h1>
        </div>
      </header>
      <TemplateMetricGrid metrics={overview.data.metrics} />
    </main>
  )
}
