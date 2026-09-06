import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Miniflare } from 'miniflare';

import type { RequestContext } from '../db/session';
import {
  existingTechnicianOperation,
  requireAccessibleJob,
} from '../lib/job-access';

async function database() {
  const miniflare = new Miniflare({
    compatibilityDate: '2026-05-15',
    d1Databases: { DB: 'servora-field-test' },
    modules: true,
    script: 'export default { fetch() { return new Response("ok") } }',
  });
  const db = await miniflare.getD1Database('DB');
  for (const migration of [
    'drizzle/0000_silent_chronomancer.sql',
    'drizzle/0001_flat_gladiator.sql',
    'drizzle/0002_messy_wrecking_crew.sql',
    'drizzle/0003_smooth_leper_queen.sql',
  ]) {
    const sql = await readFile(
      new URL(`../${migration}`, import.meta.url),
      'utf8',
    );
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) await db.prepare(statement).run();
    }
  }
  await db.batch([
    db.prepare(
      "INSERT INTO users (id, email, display_name) VALUES ('owner', 'owner@example.com', 'Owner')",
    ),
    db.prepare(
      "INSERT INTO users (id, email, display_name) VALUES ('tech_a', 'a@example.com', 'Tech A')",
    ),
    db.prepare(
      "INSERT INTO users (id, email, display_name) VALUES ('tech_b', 'b@example.com', 'Tech B')",
    ),
    db.prepare(
      "INSERT INTO workspaces (id, name, slug) VALUES ('ws', 'Services', 'services')",
    ),
    db.prepare(
      "INSERT INTO memberships (id, workspace_id, user_id, role) VALUES ('m_owner', 'ws', 'owner', 'owner')",
    ),
    db.prepare(
      "INSERT INTO memberships (id, workspace_id, user_id, role) VALUES ('m_a', 'ws', 'tech_a', 'technician')",
    ),
    db.prepare(
      "INSERT INTO memberships (id, workspace_id, user_id, role) VALUES ('m_b', 'ws', 'tech_b', 'technician')",
    ),
    db.prepare(
      "INSERT INTO customers (id, workspace_id, name, contact_name, email, phone, city) VALUES ('customer', 'ws', 'Customer', 'Pat', 'p@example.com', '1', 'Chicago')",
    ),
    db.prepare(
      "INSERT INTO jobs (id, workspace_id, customer_id, service, city, technician, scheduled_at, priority, status, created_by) VALUES ('job_a', 'ws', 'customer', 'Repair', 'Chicago', 'Tech A', '2026-09-06T10:00:00.000Z', 'High', 'Scheduled', 'owner')",
    ),
    db.prepare(
      "INSERT INTO jobs (id, workspace_id, customer_id, service, city, technician, scheduled_at, priority, status, created_by) VALUES ('job_b', 'ws', 'customer', 'Install', 'Chicago', 'Tech B', '2026-09-06T12:00:00.000Z', 'Medium', 'Scheduled', 'owner')",
    ),
    db.prepare(
      "INSERT INTO job_assignments (id, workspace_id, job_id, technician_user_id, assigned_by) VALUES ('ja', 'ws', 'job_a', 'tech_a', 'owner')",
    ),
  ]);
  return { db, miniflare };
}

function context(db: D1Database, userId: string): RequestContext {
  return {
    db,
    user: { id: userId, email: `${userId}@example.com`, displayName: userId },
    workspace: { id: 'ws', name: 'Services', slug: 'services' },
    role: 'technician',
  };
}

test('technicians can access only explicitly assigned jobs', async () => {
  const { db, miniflare } = await database();
  try {
    assert.equal(
      (await requireAccessibleJob(context(db, 'tech_a'), 'job_a')).id,
      'job_a',
    );
    await assert.rejects(
      () => requireAccessibleJob(context(db, 'tech_a'), 'job_b'),
      (error: unknown) => error instanceof Response && error.status === 404,
    );
    await assert.rejects(
      () => requireAccessibleJob(context(db, 'tech_b'), 'job_a'),
      (error: unknown) => error instanceof Response && error.status === 404,
    );
  } finally {
    await miniflare.dispose();
  }
});

test('technician replay keys are scoped and deduplicated by user', async () => {
  const { db, miniflare } = await database();
  try {
    const result = JSON.stringify({ id: 'job_a', status: 'En route' });
    await db
      .prepare(
        "INSERT INTO technician_operations (id, workspace_id, user_id, job_id, idempotency_key, kind, result_json) VALUES ('op', 'ws', 'tech_a', 'job_a', 'retry_key_1', 'status', ?)",
      )
      .bind(result)
      .run();
    assert.deepEqual(
      await existingTechnicianOperation(context(db, 'tech_a'), 'retry_key_1'),
      { id: 'job_a', status: 'En route' },
    );
    assert.equal(
      await existingTechnicianOperation(context(db, 'tech_b'), 'retry_key_1'),
      null,
    );
    await assert.rejects(() =>
      db
        .prepare(
          "INSERT INTO technician_operations (id, workspace_id, user_id, job_id, idempotency_key, kind, result_json) VALUES ('op2', 'ws', 'tech_a', 'job_a', 'retry_key_1', 'status', '{}')",
        )
        .run(),
    );
  } finally {
    await miniflare.dispose();
  }
});
