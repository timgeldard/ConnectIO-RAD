/* eslint-disable jsdoc/require-jsdoc */
import type { WidgetComponent } from './types'

export interface WidgetRegistry {
  get(type: string): WidgetComponent | undefined
  list(): string[]
  register(type: string, component: WidgetComponent): WidgetRegistry
}

export function createWidgetRegistry(initialWidgets: Record<string, WidgetComponent> = {}): WidgetRegistry {
  const widgets = new Map<string, WidgetComponent>(Object.entries(initialWidgets))

  return {
    get(type) {
      return widgets.get(type)
    },
    list() {
      return Array.from(widgets.keys()).sort()
    },
    register(type, component) {
      if (!type.trim()) {
        throw new Error('Widget type must be a non-empty string.')
      }
      widgets.set(type, component)
      return this
    },
  }
}
