export class ApiError extends Error {
  status: number;
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
  return body || `Error ${status}`;
}

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

export async function postJson<T>(
  path: string,
  body: unknown,
  init?: RequestInit,
): Promise<T> {
  return fetchJson<T>(path, {
    ...init,
    method: 'POST',
    credentials: init?.credentials ?? 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    body: JSON.stringify(body),
  });
}

export async function deleteJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  return fetchJson<T>(input, { ...init, method: 'DELETE' });
}
