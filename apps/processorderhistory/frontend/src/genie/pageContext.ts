import type { GeniePageContext } from '../api/genie'

function qp(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name)
}

function clean(value: unknown): string | null {
  if (value == null) return null
  const text = String(value).trim()
  return text && text !== 'ALL' ? text : null
}

export function buildGeniePageContext(view: any, lineFilter?: string): GeniePageContext {
  const queryPlant = clean(qp('plant'))
  const queryMaterial = clean(qp('material'))
  const queryLine = clean(qp('line'))
  const dateFrom = clean(qp('from'))
  const dateTo = clean(qp('to'))

  if (view?.name === 'detail') {
    const order = view.order || {}
    return {
      mode: 'process_order',
      selected_process_order: clean(order.id ?? order.processOrderId),
      selected_material: clean(order.materialId ?? order.product?.sku ?? queryMaterial),
      selected_plant: clean(order.plantId ?? order.plant?.code ?? queryPlant),
      selected_batch: clean(order.batchId ?? order.lot),
      active_date_range: dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : null,
      active_filters: `detail view for process order ${clean(order.id ?? order.processOrderId) || 'unknown'}`,
      selected_row_count: 1,
    }
  }

  const filters = [
    queryPlant ? `plant ${queryPlant}` : null,
    queryMaterial ? `material ${queryMaterial}` : null,
    queryLine ? `line ${queryLine}` : null,
    lineFilter && lineFilter !== 'ALL' ? `line filter ${lineFilter}` : null,
  ].filter(Boolean)

  if (view?.name === 'list' || view?.name === 'pours' || view?.name === 'yield' || view?.name === 'quality') {
    return {
      mode: 'filtered_result_set',
      selected_process_order: null,
      selected_material: queryMaterial,
      selected_plant: queryPlant,
      selected_batch: null,
      active_date_range: dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : null,
      active_filters: filters.length ? filters.join(', ') : `${view.name} page, no explicit filters`,
      selected_row_count: null,
    }
  }

  return {
    mode: 'global',
    selected_process_order: null,
    selected_material: queryMaterial,
    selected_plant: queryPlant,
    selected_batch: null,
    active_date_range: dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : null,
    active_filters: filters.length ? filters.join(', ') : 'global process order history context',
    selected_row_count: null,
  }
}
