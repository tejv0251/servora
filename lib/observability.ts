type LogLevel = 'info' | 'warn' | 'error';

type LogDetails = Record<string, unknown>;

function normalizeError(value: unknown) {
  if (!(value instanceof Error)) return value;
  return { name: value.name, message: value.message };
}

export function createRequestId(request?: Request) {
  const candidate = request?.headers.get('x-request-id')?.trim();
  if (candidate && /^[a-zA-Z0-9._:-]{1,80}$/.test(candidate)) return candidate;
  return crypto.randomUUID();
}

export function logEvent(
  level: LogLevel,
  event: string,
  details: LogDetails = {},
) {
  const normalized = Object.fromEntries(
    Object.entries(details)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, normalizeError(value)]),
  );
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    service: 'servora-web',
    level,
    event,
    ...normalized,
  });
  if (level === 'error') console.error(record);
  else if (level === 'warn') console.warn(record);
  else console.info(record);
}
