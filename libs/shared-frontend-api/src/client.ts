/**
 * Custom error class for API response errors.
 */
export class ApiError extends Error {
  /** HTTP status code */
  status: number;
  /** Detailed error message or object from the server */
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === 'string' ? detail : `Error ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => ({}));
  }
  return response.text().catch(() => response.statusText);
}

function errorDetail(body: unknown, status: number): unknown {
  if (body && typeof body === 'object' && 'detail' in body) {
    return (body as { detail?: unknown }).detail ?? `Error ${status}`;
  }
  return body ?? `Error ${status}`;
}

/**
 * Standardized fetch wrapper for JSON responses.
 * Handles 204 No Content, parse errors, and maps non-OK responses to ApiError.
 * 
 * @param input - The URL or Request object
 * @param init - Fetch options
 * @returns Parsed JSON response body
 * @throws {ApiError} on non-200 responses
 */
export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (response.status === 204) {
    return undefined as T;
  }
  const body = await readResponseBody(response);
  if (!response.ok) {
    throw new ApiError(response.status, errorDetail(body, response.status));
  }
  return body as T;
}

/**
 * Helper for POSTing JSON data.
 * Automatically sets Content-Type header and stringifies the body.
 * 
 * @param path - The target API endpoint
 * @param body - The object to be sent as JSON
 * @param init - Optional fetch overrides
 * @returns Parsed JSON response body
 */
export async function postJson<T>(
  path: string,
  body: unknown,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  return fetchJson<T>(path, {
    ...init,
    method: 'POST',
    credentials: init?.credentials ?? 'include',
    headers,
    body: JSON.stringify(body),
  });
}

/**
 * Helper for DELETE requests returning JSON.
 * 
 * @param input - The URL or Request object
 * @param init - Optional fetch overrides
 * @returns Parsed JSON response body
 */
export async function deleteJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  return fetchJson<T>(input, { ...init, method: 'DELETE', credentials: init?.credentials ?? 'include' });
}
