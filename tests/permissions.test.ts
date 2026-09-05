import assert from 'node:assert/strict';
import test from 'node:test';

import { can, rolesFor } from '../lib/permissions';

test('only owners can change team access', () => {
  assert.deepEqual(rolesFor('team.manage'), ['owner']);
  assert.equal(can('owner', 'team.manage'), true);
  assert.equal(can('dispatcher', 'team.manage'), false);
  assert.equal(can('technician', 'team.manage'), false);
});

test('dispatchers can read team access while technicians cannot', () => {
  assert.equal(can('owner', 'team.read'), true);
  assert.equal(can('dispatcher', 'team.read'), true);
  assert.equal(can('technician', 'team.read'), false);
});

test('technicians cannot use unassigned operational mutations', () => {
  assert.equal(can('owner', 'operations.manage'), true);
  assert.equal(can('dispatcher', 'operations.manage'), true);
  assert.equal(can('technician', 'operations.manage'), false);
});
