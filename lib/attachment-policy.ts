const MIME_EXTENSIONS: Record<string, readonly string[]> = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
};

export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const MAX_ATTACHMENT_BATCH = 5;
export const ATTACHMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp';

export function safeAttachmentName(value: string) {
  const normalized = value
    .normalize('NFKC')
    .replace(/\p{Cc}/gu, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return (normalized || 'attachment').slice(0, 120);
}

export function validateAttachment(file: {
  name: string;
  type: string;
  size: number;
}) {
  if (!file.size) return 'The file is empty.';
  if (file.size > MAX_ATTACHMENT_BYTES)
    return 'The file exceeds the 8 MB limit.';
  const extension = file.name.split('.').at(-1)?.toLowerCase() ?? '';
  const allowedExtensions = MIME_EXTENSIONS[file.type];
  if (!allowedExtensions?.includes(extension)) {
    return 'Choose a PDF, JPG, PNG, or WebP file.';
  }
  return null;
}

export function attachmentObjectKey(
  workspaceId: string,
  jobId: string,
  attachmentId: string,
  fileName: string,
) {
  return `workspaces/${workspaceId}/jobs/${jobId}/${attachmentId}-${safeAttachmentName(fileName)}`;
}

export function contentDisposition(fileName: string) {
  const safe = safeAttachmentName(fileName);
  const ascii = safe.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}
