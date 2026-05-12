export interface PropertyFormProps<T = Record<string, unknown>> {
  widgetId: string
  props: T
  onChange: (updates: Partial<T>) => void
}

export type BaseWidgetProps = Record<string, unknown>
