import { getAttachmentBucket } from '@/db';
import { requireContext } from '@/db/session';
import { errorResponse, json } from '@/lib/api-response';
import {
  attachmentObjectKey,
  safeAttachmentName,
  validateAttachment,
} from '@/lib/attachment-policy';
import type { JobAttachment } from '@/lib/contracts';
import {
  existingTechnicianOperation,
  requireAccessibleJob,
  requireIdempotencyKey,
} from '@/lib/job-access';

export async function GET(request: Request) {
  try {
    const context = await requireContext(request);
    const { db, workspace } = context;
    const jobId = new URL(request.url).searchParams.get('jobId')?.trim();
    if (!jobId) return json({ error: 'jobId is required.' }, { status: 400 });
    await requireAccessibleJob(context, jobId);
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
    const context = await requireContext(request);
    const { db, workspace, user } = context;
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
    const job = await requireAccessibleJob(context, jobId);
    const idempotencyValue = form.get('idempotencyKey');
    const idempotencyKey =
      context.role === 'technician'
        ? requireIdempotencyKey(idempotencyValue)
        : typeof idempotencyValue === 'string' && idempotencyValue
          ? requireIdempotencyKey(idempotencyValue)
          : null;
    if (idempotencyKey) {
      const existing = await existingTechnicianOperation(
        context,
        idempotencyKey,
      );
      if (existing) return json(existing);
    }
    const id = idempotencyKey ?? crypto.randomUUID();
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
      const result: JobAttachment = {
        id,
        jobId: job.id,
        fileName,
        contentType: fileValue.type,
        sizeBytes: fileValue.size,
        createdAt,
        downloadUrl: `/api/jobs/attachments/download?id=${encodeURIComponent(id)}`,
      };
      const statements = [
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
      ];
      if (context.role === 'technician' && idempotencyKey) {
        statements.push(
          db
            .prepare(`INSERT INTO technician_operations
              (id, workspace_id, user_id, job_id, idempotency_key, kind, result_json)
              VALUES (?, ?, ?, ?, ?, 'attachment', ?)`)
            .bind(
              crypto.randomUUID(),
              workspace.id,
              user.id,
              job.id,
              idempotencyKey,
              JSON.stringify(result),
            ),
        );
      }
      await db.batch(statements);
      return json(result, { status: 201 });
    } catch (error) {
      if (idempotencyKey) {
        const replay = await existingTechnicianOperation(
          context,
          idempotencyKey,
        );
        if (replay) return json(replay);
      }
      await bucket.delete(objectKey);
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
