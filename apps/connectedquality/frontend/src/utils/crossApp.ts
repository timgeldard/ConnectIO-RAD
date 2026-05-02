/**
 * Cross-app navigation helpers.
 *
 * When CQ is deployed inside the ConnectIO Platform (VITE_BASE_PATH=/cq/),
 * POH lives at /poh/ on the same origin and can be navigated to via URL
 * params. When CQ runs standalone, pohOrderUrl returns null so callers
 * can suppress links to POH.
 */

const POH_BASE: string | null =
  import.meta.env.VITE_BASE_PATH === '/cq/' ? '/poh' : null

/** Returns the POH order detail URL for a given process order ID, or null when not in platform mode. */
export function pohOrderUrl(processOrderId: string, from: string): string | null {
  if (!POH_BASE) return null
  return `${POH_BASE}/?entity=processOrder&processOrderId=${encodeURIComponent(processOrderId)}&from=${encodeURIComponent(from)}`
}
