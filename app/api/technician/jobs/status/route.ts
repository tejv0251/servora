import { requireContext } from '@/db/session';
import {
  errorResponse,
  json,
  readJsonObject,
  requiredString,
} from '@/lib/api-response';
import type { JobStatus } from '@/lib/contracts';
import {
  existingTechnicianOperation,
  requireAccessibleJob,
  requireIdempotencyKey,
} from '@/lib/job-access';
import { canTransitionJob } from '@/lib/job-state';

export async function POST(request: Request) {
  try {
    const context = await requireContext(request, ['technician']);
    const body = await readJsonObject(request);
    const jobId = requiredString(body, 'jobId');
    const status = requiredString(body, 'status', 30) as JobStatus;
    const idempotencyKey = requireIdempotencyKey(body.idempotencyKey);
    const existing = await existingTechnicianOperation(context, idempotencyKey);
    if (existing) return json(existing);
    const job = await requireAccessibleJob(context, jobId);
    if (!canTransitionJob(job.status as JobStatus, status)) {
      return json(
        {
          error: `This job cannot move from ${job.status} to ${status}. Refresh before retrying.`,
        },
        { status: 409 },
      );
    }
    const result = { id: job.id, status };
    try {
      await context.db.batch([
        context.db
          .prepare(`UPDATE jobs SET status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND workspace_id = ? AND status = ?`)
          .bind(status, job.id, context.workspace.id, job.status),
        context.db
          .prepare(`INSERT INTO activities
          (id, workspace_id, actor_id, entity_type, entity_id, action, message)
          VALUES (?, ?, ?, 'job', ?, 'job.status_changed', ?)`)
          .bind(
            crypto.randomUUID(),
            context.workspace.id,
            context.user.id,
            job.id,
            `${job.service} moved to ${status} by ${context.user.displayName}`,
          ),
        context.db
          .prepare(`INSERT INTO technician_operations
          (id, workspace_id, user_id, job_id, idempotency_key, kind, result_json)
          VALUES (?, ?, ?, ?, ?, 'status', ?)`)
          .bind(
            crypto.randomUUID(),
            context.workspace.id,
            context.user.id,
            job.id,
            idempotencyKey,
            JSON.stringify(result),
          ),
      ]);
    } catch (error) {
      const replay = await existingTechnicianOperation(context, idempotencyKey);
      if (replay) return json(replay);
      throw error;
    }
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
