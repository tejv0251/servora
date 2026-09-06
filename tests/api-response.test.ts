import assert from 'node:assert/strict';
import test from 'node:test';

import { readJsonObject, readTextBody } from '../lib/api-response';

test('JSON request parsing enforces content type and size', async () => {
  const valid = new Request('https://servora.example/api/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ service: 'Inspection' }),
  });
  assert.deepEqual(await readJsonObject(valid), { service: 'Inspection' });

  const wrongType = new Request('https://servora.example/api/jobs', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: '{}',
  });
  await assert.rejects(() => readJsonObject(wrongType));

  const oversized = new Request('https://servora.example/api/webhook', {
    method: 'POST',
    body: 'x'.repeat(65),
  });
  await assert.rejects(() => readTextBody(oversized, 64));
});
