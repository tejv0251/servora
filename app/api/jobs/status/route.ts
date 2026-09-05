import { requireContext } from '@/db/session';
import { errorResponse, json, readJsonObject, requiredString } from '@/lib/api-response';
import type { JobStatus } from '@/lib/contracts';
import { canTransitionJob } from '@/lib/job-state';

export async function POST(request: Request) {
  try {
    const { db, workspace, user } = await requireContext(request);
    const body = await readJsonObject(request);
    const jobId = requiredString(body, 'jobId');
    const status = requiredString(body, 'status', 30) as JobStatus;
    const job = await db.prepare('SELECT id, service, status FROM jobs WHERE id = ? AND workspace_id = ? LIMIT 1').bind(jobId, workspace.id).first<{ id: string; service: string; status: JobStatus }>();
    if (!job) return json({ error: 'Job not found in this workspace.' }, { status: 404 });
    if (!canTransitionJob(job.status, status)) return json({ error: `A job cannot move from ${job.status} to ${status}.` }, { status: 409 });

    const updated = await db.prepare('UPDATE jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ? AND status = ?').bind(status, job.id, workspace.id, job.status).run();
    if (updated.meta.changes !== 1) return json({ error: 'The job changed before this update. Refresh and try again.' }, { status: 409 });
    await db.prepare('INSERT INTO activities (id, workspace_id, actor_id, entity_type, entity_id, action, message) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), workspace.id, user.id, 'job', job.id, 'job.status_changed', `${job.service} moved to ${status}`).run();
    return json({ id: job.id, status });
  } catch (error) {
    return errorResponse(error);
  }
}

