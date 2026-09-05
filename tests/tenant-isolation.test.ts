import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Miniflare } from 'miniflare';

import { findWorkspaceCustomer, listWorkspaceCustomerIds } from '../db/tenant';

async function database() {
  const miniflare = new Miniflare({
    compatibilityDate: '2026-05-15',
    d1Databases: { DB: 'servora-test' },
    modules: true,
    script: 'export default { fetch() { return new Response("ok") } }',
  });
  try {
    const db = await miniflare.getD1Database('DB');
    for (const migration of [
      'drizzle/0000_silent_chronomancer.sql',
      'drizzle/0001_flat_gladiator.sql',
      'drizzle/0002_messy_wrecking_crew.sql',
    ]) {
      const sql = await readFile(
        new URL(`../${migration}`, import.meta.url),
        'utf8',
      );
      for (const statement of sql.split('--> statement-breakpoint')) {
        if (statement.trim()) await db.prepare(statement).run();
      }
    }
    return { db, miniflare };
  } catch (error) {
    await miniflare.dispose();
    throw error;
  }
}

test('customer reads remain inside the authenticated workspace', async () => {
  const { db, miniflare } = await database();
  try {
    await db.batch([
      db.prepare(
        "INSERT INTO users (id, email, display_name) VALUES ('alice', 'alice@example.com', 'Alice')",
      ),
      db.prepare(
        "INSERT INTO users (id, email, display_name) VALUES ('charlie', 'charlie@example.com', 'Charlie')",
      ),
      db.prepare(
        "INSERT INTO workspaces (id, name, slug) VALUES ('ws_a', 'Alpha Services', 'alpha')",
      ),
      db.prepare(
        "INSERT INTO workspaces (id, name, slug) VALUES ('ws_b', 'Beta Services', 'beta')",
      ),
      db.prepare(
        "INSERT INTO memberships (id, workspace_id, user_id, role) VALUES ('mem_a', 'ws_a', 'alice', 'owner')",
      ),
      db.prepare(
        "INSERT INTO memberships (id, workspace_id, user_id, role) VALUES ('mem_b', 'ws_b', 'charlie', 'owner')",
      ),
      db.prepare(
        "INSERT INTO customers (id, workspace_id, name, contact_name, email, phone, city) VALUES ('cus_a', 'ws_a', 'Alpha Dental', 'A. Owner', 'a@alpha.example', '1', 'Chicago')",
      ),
      db.prepare(
        "INSERT INTO customers (id, workspace_id, name, contact_name, email, phone, city) VALUES ('cus_b', 'ws_b', 'Beta Dental', 'B. Owner', 'b@beta.example', '2', 'Evanston')",
      ),
    ]);

    assert.deepEqual(await listWorkspaceCustomerIds(db, 'ws_a'), ['cus_a']);
    assert.deepEqual(await listWorkspaceCustomerIds(db, 'ws_b'), ['cus_b']);
    assert.equal(
      (await findWorkspaceCustomer(db, 'ws_a', 'cus_a'))?.name,
      'Alpha Dental',
    );
    assert.equal(await findWorkspaceCustomer(db, 'ws_b', 'cus_a'), null);
    assert.equal(await findWorkspaceCustomer(db, 'ws_a', 'cus_b'), null);
  } finally {
    await miniflare.dispose();
  }
});

test('only one pending invitation can exist per email and workspace', async () => {
  const { db, miniflare } = await database();
  try {
    await db.batch([
      db.prepare(
        "INSERT INTO users (id, email, display_name) VALUES ('owner', 'owner@example.com', 'Owner')",
      ),
      db.prepare(
        "INSERT INTO workspaces (id, name, slug) VALUES ('ws', 'Services', 'services')",
      ),
      db.prepare(
        "INSERT INTO invitations (id, workspace_id, email, role, invited_by, expires_at) VALUES ('inv_1', 'ws', 'new@example.com', 'dispatcher', 'owner', '2099-01-01T00:00:00.000Z')",
      ),
    ]);
    await assert.rejects(() =>
      db
        .prepare(
          "INSERT INTO invitations (id, workspace_id, email, role, invited_by, expires_at) VALUES ('inv_2', 'ws', 'new@example.com', 'technician', 'owner', '2099-01-01T00:00:00.000Z')",
        )
        .run(),
    );
    await db
      .prepare("UPDATE invitations SET status = 'revoked' WHERE id = 'inv_1'")
      .run();
    const result = await db
      .prepare(
        "INSERT INTO invitations (id, workspace_id, email, role, invited_by, expires_at) VALUES ('inv_2', 'ws', 'new@example.com', 'technician', 'owner', '2099-01-01T00:00:00.000Z')",
      )
      .run();
    assert.equal(result.meta.changes, 1);
  } finally {
    await miniflare.dispose();
  }
});
