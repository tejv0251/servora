export function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('cache-control', 'no-store');
  return Response.json(data, {
    ...init,
    headers,
  });
}

export async function errorResponse(error: unknown) {
  if (error instanceof Response) {
    const message = await error.text();
    return json({ error: message || 'The request was rejected.' }, { status: error.status });
  }
  console.error(error);
  return json({ error: 'The server could not complete this request.' }, { status: 500 });
}

export async function readJsonObject(request: Request) {
  const value: unknown = await request.json();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Response('Expected a JSON object.', { status: 400 });
  }
  return value as Record<string, unknown>;
}

export function requiredString(record: Record<string, unknown>, key: string, maxLength = 160) {
  const value = record[key];
  if (typeof value !== 'string' || !value.trim()) throw new Response(`${key} is required.`, { status: 400 });
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new Response(`${key} is too long.`, { status: 400 });
  return normalized;
}

export function requiredMoney(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0 || value > 100_000_000) {
    throw new Response(`${key} must be a positive integer number of cents.`, { status: 400 });
  }
  return value;
}
