import assert from 'node:assert/strict';
import test from 'node:test';

import { createRequestId } from '../lib/observability';

test('request IDs accept bounded safe values and reject unsafe input', () => {
  const accepted = new Request('https://servora.example/api/health', {
    headers: { 'x-request-id': 'edge-request_123' },
  });
  assert.equal(createRequestId(accepted), 'edge-request_123');

  const rejected = new Request('https://servora.example/api/health', {
    headers: { 'x-request-id': 'unsafe request id' },
  });
  assert.match(createRequestId(rejected), /^[0-9a-f-]{36}$/);
});
