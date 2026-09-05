import { getAttachmentBucket } from '@/db';
import { requireContext } from '@/db/session';
import { contentDisposition } from '@/lib/attachment-policy';
import { errorResponse, json } from '@/lib/api-response';

export async function GET(request: Request) {
  try {
    const { db, workspace } = await requireContext(request, [
      'owner',
      'dispatcher',
    ]);
    const id = new URL(request.url).searchParams.get('id')?.trim();
    if (!id)
      return json({ error: 'Attachment id is required.' }, { status: 400 });
    const attachment = await db
      .prepare(`SELECT a.object_key AS objectKey, a.file_name AS fileName,
        a.content_type AS contentType FROM job_attachments a
        JOIN jobs j ON j.id = a.job_id AND j.workspace_id = a.workspace_id
        WHERE a.id = ? AND a.workspace_id = ? LIMIT 1`)
      .bind(id, workspace.id)
      .first<{ objectKey: string; fileName: string; contentType: string }>();
    if (!attachment)
      return json({ error: 'Attachment not found.' }, { status: 404 });
    const object = await getAttachmentBucket().get(attachment.objectKey);
    if (!object)
      return json(
        { error: 'Attachment file is unavailable.' },
        { status: 404 },
      );
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('content-type', attachment.contentType);
    headers.set('content-disposition', contentDisposition(attachment.fileName));
    headers.set('cache-control', 'private, no-store');
    headers.set('x-content-type-options', 'nosniff');
    headers.set('content-security-policy', "default-src 'none'; sandbox");
    return new Response(object.body, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}
