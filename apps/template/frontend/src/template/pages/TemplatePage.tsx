import { TemplateMetricGrid } from '../components/TemplateMetricGrid'
import { useTemplateOverview } from '../hooks/useTemplateOverview'

/** Demo-ready first page for Template Module. */
export function TemplatePage() {
  const overview = useTemplateOverview()

  if (overview.isLoading) {
    return <main className="rad-page"><p>Loading</p></main>
  }

  if (overview.isError || !overview.data?.data_available) {
    return (
      <main className="rad-page">
        <h1>Template Module</h1>
        <p>Demo data is not available for this module yet.</p>
      </main>
    )
  }

  return (
    <main className="rad-page">
      <header className="rad-page__header">
        <div>
          <p className="rad-page__eyebrow">demo</p>
          <h1>Template Module</h1>
        </div>
      </header>
      <TemplateMetricGrid metrics={overview.data.metrics} />
    </main>
  )
}
