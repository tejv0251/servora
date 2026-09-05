import { getAttachmentBucket } from '@/db';
import { requireContext } from '@/db/session';
import { errorResponse, json } from '@/lib/api-response';
import {
  attachmentObjectKey,
  safeAttachmentName,
  validateAttachment,
} from '@/lib/attachment-policy';
import type { JobAttachment } from '@/lib/contracts';

async function requireWorkspaceJob(
  db: D1Database,
  workspaceId: string,
  jobId: string,
) {
  const job = await db
    .prepare(
      'SELECT id, service FROM jobs WHERE id = ? AND workspace_id = ? LIMIT 1',
    )
    .bind(jobId, workspaceId)
    .first<{ id: string; service: string }>();
  if (!job)
    throw new Response('Job not found in this workspace.', { status: 404 });
  return job;
}

export async function GET(request: Request) {
  try {
    const { db, workspace } = await requireContext(request, [
      'owner',
      'dispatcher',
    ]);
    const jobId = new URL(request.url).searchParams.get('jobId')?.trim();
    if (!jobId) return json({ error: 'jobId is required.' }, { status: 400 });
    await requireWorkspaceJob(db, workspace.id, jobId);
    const rows = await db
      .prepare(`SELECT id, job_id AS jobId, file_name AS fileName, content_type AS contentType,
        size_bytes AS sizeBytes, created_at AS createdAt
        FROM job_attachments WHERE workspace_id = ? AND job_id = ?
        ORDER BY created_at DESC LIMIT 100`)
      .bind(workspace.id, jobId)
      .all<Omit<JobAttachment, 'downloadUrl'>>();
    return json({
      attachments: rows.results.map((row) => ({
        ...row,
        downloadUrl: `/api/jobs/attachments/download?id=${encodeURIComponent(row.id)}`,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { db, workspace, user } = await requireContext(request, [
      'owner',
      'dispatcher',
    ]);
    const form = await request.formData();
    const jobIdValue = form.get('jobId');
    const fileValue = form.get('file');
    const jobId = typeof jobIdValue === 'string' ? jobIdValue.trim() : '';
    if (!jobId) return json({ error: 'jobId is required.' }, { status: 400 });
    if (!(fileValue instanceof File)) {
      return json({ error: 'Choose a file to upload.' }, { status: 400 });
    }
    const validationError = validateAttachment(fileValue);
    if (validationError) {
      return json(
        { error: validationError },
        { status: fileValue.size > 8 * 1024 * 1024 ? 413 : 400 },
      );
    }
    const job = await requireWorkspaceJob(db, workspace.id, jobId);
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const fileName = safeAttachmentName(fileValue.name);
    const objectKey = attachmentObjectKey(workspace.id, job.id, id, fileName);
    const bucket = getAttachmentBucket();
    await bucket.put(objectKey, await fileValue.arrayBuffer(), {
      httpMetadata: { contentType: fileValue.type },
      customMetadata: {
        workspaceId: workspace.id,
        jobId: job.id,
        attachmentId: id,
      },
    });
    try {
      await db.batch([
        db
          .prepare(`INSERT INTO job_attachments
            (id, workspace_id, job_id, object_key, file_name, content_type, size_bytes, uploaded_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(
            id,
            workspace.id,
            job.id,
            objectKey,
            fileName,
            fileValue.type,
            fileValue.size,
            user.id,
            createdAt,
          ),
        db
          .prepare(`INSERT INTO activities
            (id, workspace_id, actor_id, entity_type, entity_id, action, message)
            VALUES (?, ?, ?, 'job', ?, 'attachment.uploaded', ?)`)
          .bind(
            crypto.randomUUID(),
            workspace.id,
            user.id,
            job.id,
            `${fileName} added to ${job.service}`,
          ),
      ]);
    } catch (error) {
      await bucket.delete(objectKey);
      throw error;
    }
    return json(
      {
        id,
        jobId: job.id,
        fileName,
        contentType: fileValue.type,
        sizeBytes: fileValue.size,
        createdAt,
        downloadUrl: `/api/jobs/attachments/download?id=${encodeURIComponent(id)}`,
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
