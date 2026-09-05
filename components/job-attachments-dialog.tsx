'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import {
  Download,
  FileImage,
  FileText,
  Paperclip,
  RotateCcw,
  Trash2,
  UploadCloud,
} from 'lucide-react';

import {
  Attachment,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from '@/components/ui/attachment';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENT_BATCH,
  validateAttachment,
} from '@/lib/attachment-policy';
import type { DashboardJob, JobAttachment } from '@/lib/contracts';

type QueueItem = {
  id: string;
  file: File;
  progress: number;
  status: 'queued' | 'uploading' | 'error';
  retryable: boolean;
  error?: string;
};

function fileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function uploadFile(
  jobId: string,
  file: File,
  onProgress: (progress: number) => void,
  onReady: (xhr: XMLHttpRequest) => void,
) {
  return new Promise<JobAttachment>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    onReady(xhr);
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    xhr.addEventListener('load', () => {
      let payload = {} as JobAttachment & { error?: string };
      try {
        payload = JSON.parse(xhr.responseText || '{}') as JobAttachment & {
          error?: string;
        };
      } catch {
        reject(new Error(`Upload failed (${xhr.status}).`));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(payload);
      else reject(new Error(payload.error || `Upload failed (${xhr.status}).`));
    });
    xhr.addEventListener('error', () =>
      reject(new Error('The upload connection failed.')),
    );
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled.')));
    const form = new FormData();
    form.append('jobId', jobId);
    form.append('file', file);
    xhr.open('POST', '/api/jobs/attachments');
    xhr.send(form);
  });
}

export function JobAttachmentsDialog({
  job,
  onChanged,
}: {
  job: DashboardJob;
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState('');
  const [attachments, setAttachments] = useState<JobAttachment[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRequest = useRef<XMLHttpRequest | null>(null);
  const cancelRequested = useRef(false);

  const loadAttachments = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setFailure('');
      try {
        const response = await fetch(
          `/api/jobs/attachments?jobId=${encodeURIComponent(job.id)}`,
          { signal, headers: { accept: 'application/json' } },
        );
        const payload = (await response.json().catch(() => ({}))) as {
          attachments?: JobAttachment[];
          error?: string;
        };
        if (!response.ok)
          throw new Error(payload.error || 'Could not load job files.');
        setAttachments(payload.attachments ?? []);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError')
          return;
        setFailure(
          error instanceof Error ? error.message : 'Could not load job files.',
        );
      } finally {
        setLoading(false);
      }
    },
    [job.id],
  );

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void loadAttachments(controller.signal);
    return () => controller.abort();
  }, [loadAttachments, open]);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    setFailure('');
    const incoming = Array.from(fileList);
    if (queue.length + incoming.length > MAX_ATTACHMENT_BATCH) {
      setFailure(
        `Choose no more than ${MAX_ATTACHMENT_BATCH} files at a time.`,
      );
      return;
    }
    const next: QueueItem[] = [];
    for (const file of incoming) {
      const error = validateAttachment(file);
      next.push({
        id: crypto.randomUUID(),
        file,
        progress: 0,
        status: error ? 'error' : 'queued',
        retryable: false,
        error: error ?? undefined,
      });
    }
    setQueue((current) => [...current, ...next]);
  }

  async function startUpload() {
    const uploadable = queue.filter((item) => item.status === 'queued');
    if (!uploadable.length) {
      setFailure('Choose at least one valid file to upload.');
      return;
    }
    setUploading(true);
    cancelRequested.current = false;
    setFailure('');
    let changed = false;
    for (const item of uploadable) {
      if (cancelRequested.current) break;
      setQueue((current) =>
        current.map((candidate) =>
          candidate.id === item.id
            ? {
                ...candidate,
                status: 'uploading',
                progress: 0,
                error: undefined,
              }
            : candidate,
        ),
      );
      try {
        const uploaded = await uploadFile(
          job.id,
          item.file,
          (progress) =>
            setQueue((current) =>
              current.map((candidate) =>
                candidate.id === item.id
                  ? { ...candidate, progress }
                  : candidate,
              ),
            ),
          (xhr) => {
            activeRequest.current = xhr;
          },
        );
        changed = true;
        setAttachments((current) => [uploaded, ...current]);
        setQueue((current) =>
          current.filter((candidate) => candidate.id !== item.id),
        );
      } catch (error) {
        setQueue((current) =>
          current.map((candidate) =>
            candidate.id === item.id
              ? {
                  ...candidate,
                  status: 'error',
                  retryable: true,
                  error:
                    error instanceof Error ? error.message : 'Upload failed.',
                }
              : candidate,
          ),
        );
      } finally {
        activeRequest.current = null;
      }
    }
    setUploading(false);
    if (changed) await onChanged();
  }

  function close(nextOpen: boolean) {
    if (!nextOpen && uploading) return;
    setOpen(nextOpen);
    if (!nextOpen) {
      setQueue([]);
      setFailure('');
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Paperclip /> Files{' '}
        {job.attachmentCount ? `(${job.attachmentCount})` : ''}
      </DialogTrigger>
      <DialogContent className="job-files-dialog sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="text-lg">Photos & documents</DialogTitle>
          <DialogDescription>
            {job.service} for {job.customer}. Files are private to this
            workspace.
          </DialogDescription>
        </DialogHeader>

        <div
          className={`upload-zone ${dragging ? 'upload-zone--dragging' : ''}`}
          onDragOver={(event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            setDragging(false);
            addFiles(event.dataTransfer.files);
          }}
        >
          <UploadCloud aria-hidden="true" />
          <div>
            <strong>Add work-order files</strong>
            <p>PDF, JPG, PNG, or WebP · up to 8 MB each · 5 files per batch</p>
          </div>
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept={ATTACHMENT_ACCEPT}
            multiple
            aria-label="Choose work-order files"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              addFiles(event.target.files);
              event.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
          >
            Browse files
          </Button>
        </div>

        {failure ? (
          <p className="form-alert" role="alert">
            {failure}
          </p>
        ) : null}

        {queue.length ? (
          <section
            className="attachment-section"
            aria-labelledby={`queue-${job.id}`}
          >
            <div className="attachment-section-heading">
              <h3 id={`queue-${job.id}`}>Ready to upload</h3>
              <span>{queue.length} selected</span>
            </div>
            <div className="attachment-list" aria-live="polite">
              {queue.map((item) => (
                <Attachment
                  key={item.id}
                  state={item.status === 'queued' ? 'idle' : item.status}
                  className="attachment-row"
                >
                  <AttachmentMedia>
                    {item.file.type.startsWith('image/') ? (
                      <FileImage />
                    ) : (
                      <FileText />
                    )}
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>{item.file.name}</AttachmentTitle>
                    <AttachmentDescription>
                      {item.error ||
                        (item.status === 'uploading'
                          ? `Uploading · ${item.progress}%`
                          : `${fileSize(item.file.size)} · Ready`)}
                    </AttachmentDescription>
                    {item.status === 'uploading' ? (
                      <Progress
                        value={item.progress}
                        className="attachment-progress"
                      />
                    ) : null}
                  </AttachmentContent>
                  <AttachmentActions>
                    {item.retryable ? (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Retry ${item.file.name}`}
                        onClick={() =>
                          setQueue((current) =>
                            current.map((candidate) =>
                              candidate.id === item.id
                                ? {
                                    ...candidate,
                                    status: 'queued',
                                    progress: 0,
                                    retryable: false,
                                    error: undefined,
                                  }
                                : candidate,
                            ),
                          )
                        }
                      >
                        <RotateCcw />
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Remove ${item.file.name} from upload queue`}
                      disabled={item.status === 'uploading'}
                      onClick={() =>
                        setQueue((current) =>
                          current.filter(
                            (candidate) => candidate.id !== item.id,
                          ),
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  </AttachmentActions>
                </Attachment>
              ))}
            </div>
          </section>
        ) : null}

        <section
          className="attachment-section"
          aria-labelledby={`files-${job.id}`}
        >
          <div className="attachment-section-heading">
            <h3 id={`files-${job.id}`}>Saved files</h3>
            <span>{attachments.length}</span>
          </div>
          {loading ? (
            <div className="attachment-loading" role="status">
              Loading files…
            </div>
          ) : attachments.length ? (
            <div className="attachment-list">
              {attachments.map((attachment) => (
                <Attachment key={attachment.id} className="attachment-row">
                  <AttachmentMedia>
                    {attachment.contentType.startsWith('image/') ? (
                      <FileImage />
                    ) : (
                      <FileText />
                    )}
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>{attachment.fileName}</AttachmentTitle>
                    <AttachmentDescription>
                      {fileSize(attachment.sizeBytes)} · Added{' '}
                      {new Intl.DateTimeFormat('en-US', {
                        month: 'short',
                        day: 'numeric',
                      }).format(new Date(attachment.createdAt))}
                    </AttachmentDescription>
                  </AttachmentContent>
                  <AttachmentActions>
                    <a
                      className="attachment-download"
                      href={attachment.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${attachment.fileName}`}
                    >
                      <Download />
                    </a>
                  </AttachmentActions>
                </Attachment>
              ))}
            </div>
          ) : (
            <div className="empty-inline empty-inline--compact">
              <Paperclip />
              <div>
                <strong>No files yet</strong>
                <p>
                  Add completion photos, service reports, or signed documents.
                </p>
              </div>
            </div>
          )}
        </section>

        <DialogFooter>
          {uploading ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                cancelRequested.current = true;
                activeRequest.current?.abort();
              }}
            >
              Cancel upload
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => close(false)}
            >
              Close
            </Button>
          )}
          <Button
            type="button"
            className="primary-button"
            disabled={
              uploading || !queue.some((item) => item.status === 'queued')
            }
            aria-busy={uploading}
            onClick={() => void startUpload()}
          >
            {uploading ? 'Uploading…' : 'Upload files'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
