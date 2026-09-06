import { createRequestId, logEvent } from '@/lib/observability';

const API_SECURITY_HEADERS = {
  'cross-origin-resource-policy': 'same-origin',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

export function json(data: unknown, init?: ResponseInit, requestId?: string) {
  const headers = new Headers(init?.headers);
  headers.set('cache-control', 'no-store');
  for (const [name, value] of Object.entries(API_SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  if (requestId) headers.set('x-request-id', requestId);
  return Response.json(data, {
    ...init,
    headers,
  });
}

export async function errorResponse(error: unknown, request?: Request) {
  const requestId = createRequestId(request);
  if (error instanceof Response) {
    const message = await error.text();
    return json(
      { error: message || 'The request was rejected.' },
      { status: error.status },
      requestId,
    );
  }
  logEvent('error', 'api.request.failed', {
    requestId,
    method: request?.method,
    pathname: request ? new URL(request.url).pathname : undefined,
    error,
  });
  return json(
    { error: 'The server could not complete this request.' },
    { status: 500 },
    requestId,
  );
}

export async function readJsonObject(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Response('Content-Type must be application/json.', {
      status: 415,
    });
  }
  const text = await readTextBody(request, 64 * 1024);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Response('Request body must contain valid JSON.', { status: 400 });
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Response('Expected a JSON object.', { status: 400 });
  }
  return value as Record<string, unknown>;
}

export async function readTextBody(request: Request, maxBytes: number) {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Response('Request body is too large.', { status: 413 });
  }
  if (!request.body) return '';

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let body = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        throw new Response('Request body is too large.', { status: 413 });
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return body;
  } finally {
    reader.releaseLock();
  }
}

export function requiredString(
  record: Record<string, unknown>,
  key: string,
  maxLength = 160,
) {
  const value = record[key];
  if (typeof value !== 'string' || !value.trim())
    throw new Response(`${key} is required.`, { status: 400 });
  const normalized = value.trim();
  if (normalized.length > maxLength)
    throw new Response(`${key} is too long.`, { status: 400 });
  return normalized;
}

export function requiredMoney(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value <= 0 ||
    value > 100_000_000
  ) {
    throw new Response(`${key} must be a positive integer number of cents.`, {
      status: 400,
    });
  }
  return value;
}
