import { getD1 } from '@/db';
import { json } from '@/lib/api-response';
import { createRequestId, logEvent } from '@/lib/observability';

export async function GET(request: Request) {
  const requestId = createRequestId(request);
  try {
    await getD1().prepare('SELECT 1 AS ready').first();
    return json(
      {
        status: 'ok',
        service: 'servora-web',
        checks: { database: 'up' },
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
      requestId,
    );
  } catch (error) {
    logEvent('error', 'health.database.failed', { requestId, error });
    return json(
      {
        status: 'degraded',
        service: 'servora-web',
        checks: { database: 'down' },
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
      requestId,
    );
  }
}
