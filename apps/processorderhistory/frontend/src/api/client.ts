import { fetchJson as baseFetch, postJson as basePost, deleteJson as baseDelete } from '@connectio/shared-frontend-api'
import { resolvePohApiPath } from './apiBase'

export { ApiError } from '@connectio/shared-frontend-api'

export const fetchJson = <T>(path: string, init?: RequestInit) => 
  baseFetch<T>(resolvePohApiPath(path), init)

export const postJson = <T>(path: string, body: unknown, init?: RequestInit) =>
  basePost<T>(resolvePohApiPath(path), body, init)

export const deleteJson = <T>(path: string, init?: RequestInit) =>
  baseDelete<T>(resolvePohApiPath(path), init)
