import type { RequestContext } from '@/db/session';

export type AccessibleJob = { id: string; service: string; status: string };

export async function requireAccessibleJob(
  context: RequestContext,
  jobId: string,
): Promise<AccessibleJob> {
  const assignmentJoin =
    context.role === 'technician'
      ? 'JOIN job_assignments ja ON ja.job_id = j.id AND ja.workspace_id = j.workspace_id AND ja.technician_user_id = ?'
      : '';
  const values =
    context.role === 'technician'
      ? [context.user.id, jobId, context.workspace.id]
      : [jobId, context.workspace.id];
  const job = await context.db
    .prepare(`SELECT j.id, j.service, j.status FROM jobs j ${assignmentJoin}
      WHERE j.id = ? AND j.workspace_id = ? LIMIT 1`)
    .bind(...values)
    .first<AccessibleJob>();
  if (!job) {
    throw new Response('Job not found or not assigned to you.', {
      status: 404,
    });
  }
  return job;
}

export async function existingTechnicianOperation(
  context: RequestContext,
  idempotencyKey: string,
) {
  const row = await context.db
    .prepare(`SELECT result_json AS resultJson FROM technician_operations
      WHERE workspace_id = ? AND user_id = ? AND idempotency_key = ? LIMIT 1`)
    .bind(context.workspace.id, context.user.id, idempotencyKey)
    .first<{ resultJson: string }>();
  return row ? (JSON.parse(row.resultJson) as unknown) : null;
}

export function requireIdempotencyKey(value: unknown) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(value)) {
    throw new Response('A valid idempotency key is required.', { status: 400 });
  }
  return value;
}
