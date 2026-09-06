import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEMO_RESET_CONFIRMATION,
  requireDemoResetConfirmation,
} from '../lib/demo-reset';

test('demo reset requires an exact destructive-action confirmation', () => {
  assert.doesNotThrow(() =>
    requireDemoResetConfirmation(DEMO_RESET_CONFIRMATION),
  );
  assert.throws(() => requireDemoResetConfirmation('reset'));
  assert.throws(() => requireDemoResetConfirmation(undefined));
});
