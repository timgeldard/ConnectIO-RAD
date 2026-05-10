export interface Metric {
  name: string
  value: number
  unit: string
}

export interface TemplateSignal {
  signal_id: string
  plant_id: string
  title: string
  status: string
}

export interface TemplateOverview {
  data_available?: boolean
  reason?: string
  plant_id: string
  metrics: Metric[]
  signals: TemplateSignal[]
}
