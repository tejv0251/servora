import assert from 'node:assert/strict';
import test from 'node:test';

import { canTransitionJob, getNextJobStatus } from '../lib/job-state';

test('jobs move through the controlled service lifecycle', () => {
  assert.equal(getNextJobStatus('Scheduled'), 'En route');
  assert.equal(getNextJobStatus('En route'), 'In progress');
  assert.equal(getNextJobStatus('In progress'), 'Completed');
  assert.equal(getNextJobStatus('Completed'), null);
});

test('jobs cannot skip or reverse lifecycle states', () => {
  assert.equal(canTransitionJob('Scheduled', 'Completed'), false);
  assert.equal(canTransitionJob('In progress', 'En route'), false);
  assert.equal(canTransitionJob('Scheduled', 'En route'), true);
});
