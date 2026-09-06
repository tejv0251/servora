import { requireContext } from '@/db/session';
import {
  errorResponse,
  json,
  readJsonObject,
  requiredString,
} from '@/lib/api-response';
import {
  existingTechnicianOperation,
  requireAccessibleJob,
  requireIdempotencyKey,
} from '@/lib/job-access';

export async function POST(request: Request) {
  try {
    const context = await requireContext(request, ['technician']);
    const body = await readJsonObject(request);
    const jobId = requiredString(body, 'jobId');
    const noteBody = requiredString(body, 'body', 2000);
    const idempotencyKey = requireIdempotencyKey(body.idempotencyKey);
    const existing = await existingTechnicianOperation(context, idempotencyKey);
    if (existing) return json(existing);
    const job = await requireAccessibleJob(context, jobId);
    const result = {
      id: crypto.randomUUID(),
      jobId: job.id,
      author: context.user.displayName,
      body: noteBody,
      createdAt: new Date().toISOString(),
    };
    try {
      await context.db.batch([
        context.db
          .prepare(`INSERT INTO job_notes
          (id, workspace_id, job_id, author_id, body, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`)
          .bind(
            result.id,
            context.workspace.id,
            job.id,
            context.user.id,
            noteBody,
            result.createdAt,
          ),
        context.db
          .prepare(`INSERT INTO activities
          (id, workspace_id, actor_id, entity_type, entity_id, action, message)
          VALUES (?, ?, ?, 'job', ?, 'job.note_added', ?)`)
          .bind(
            crypto.randomUUID(),
            context.workspace.id,
            context.user.id,
            job.id,
            `Field note added to ${job.service}`,
          ),
        context.db
          .prepare(`INSERT INTO technician_operations
          (id, workspace_id, user_id, job_id, idempotency_key, kind, result_json)
          VALUES (?, ?, ?, ?, ?, 'note', ?)`)
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
    return json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
