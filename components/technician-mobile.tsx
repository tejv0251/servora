'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type SyntheticEvent,
} from 'react';
import {
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  CloudOff,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  Route,
  StickyNote,
  Wifi,
} from 'lucide-react';

import { JobAttachmentsDialog } from '@/components/job-attachments-dialog';
import { Button } from '@/components/ui/button';
import { validateAttachment } from '@/lib/attachment-policy';
import type {
  DashboardJob,
  JobStatus,
  SessionData,
  TechnicianDashboardData,
  TechnicianJob,
} from '@/lib/contracts';
import { getNextJobStatus } from '@/lib/job-state';
import {
  addPendingOperation,
  listPendingOperations,
  removePendingOperation,
  sendPendingOperation,
  type PendingFieldOperation,
} from '@/lib/offline-queue';

const statusAction: Partial<Record<JobStatus, string>> = {
  Scheduled: 'Start travel',
  'En route': 'Start work',
  'In progress': 'Complete job',
};
const timeFormat = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

function isToday(value: string) {
  const date = new Date(value);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

async function fetchDashboard(signal?: AbortSignal) {
  const response = await fetch('/api/technician/dashboard', {
    signal,
    headers: { accept: 'application/json' },
  });
  const payload = (await response.json().catch(() => ({}))) as
    | TechnicianDashboardData
    | { error?: string };
  if (!response.ok) {
    throw new Error(
      'error' in payload && payload.error
        ? payload.error
        : 'Could not load assigned jobs.',
    );
  }
  return payload as TechnicianDashboardData;
}

function attachmentJob(job: TechnicianJob): DashboardJob {
  return {
    ...job,
    customerId: '',
    technician: '',
    invoiceId: null,
    assignedUserId: null,
    assignedTechnician: null,
  };
}

export function TechnicianMobile({ session }: { session: SessionData }) {
  const scopeKey = `${session.workspace.id}:${session.user.id}`;
  const [data, setData] = useState<TechnicianDashboardData | null>(null);
  const [pending, setPending] = useState<PendingFieldOperation[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [view, setView] = useState<'today' | 'upcoming'>('today');
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [syncing, setSyncing] = useState(false);
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const photoInput = useRef<Record<string, HTMLInputElement | null>>({});
  const syncingRef = useRef(false);

  const refreshPending = useCallback(async () => {
    setPending(await listPendingOperations(scopeKey));
  }, [scopeKey]);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setData(await fetchDashboard(signal));
      setFailure('');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setFailure(
        error instanceof Error
          ? error.message
          : 'Could not load assigned jobs.',
      );
    }
  }, []);

  /* oxlint-disable react/react-compiler -- exhaustive deps require scopeKey; the compiler incorrectly reports it as extra. */
  const flush = useCallback(async () => {
    if (!navigator.onLine || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    setFailure('');
    try {
      const operations = await listPendingOperations(scopeKey);
      for (const operation of operations) {
        try {
          await sendPendingOperation(operation);
          await removePendingOperation(operation.id);
        } catch (error) {
          const status = (error as Error & { status?: number }).status;
          setFailure(
            status && status < 500
              ? error instanceof Error
                ? error.message
                : 'A queued update needs attention.'
              : 'Connection interrupted. Remaining updates are still queued.',
          );
          break;
        }
      }
      await refreshPending();
      await load();
      if (
        operations.length &&
        !(await listPendingOperations(scopeKey)).length
      ) {
        setNotice('Field updates synced.');
      }
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [load, refreshPending, scopeKey]);
  /* oxlint-enable react/react-compiler */

  useEffect(() => {
    document.title = 'My field jobs — Servora';
    const controller = new AbortController();
    queueMicrotask(
      () =>
        void Promise.all([load(controller.signal), refreshPending()]).then(() =>
          flush(),
        ),
    );
    const connected = () => {
      setOnline(true);
      void load().then(() => flush());
    };
    const disconnected = () => setOnline(false);
    window.addEventListener('online', connected);
    window.addEventListener('offline', disconnected);
    return () => {
      controller.abort();
      window.removeEventListener('online', connected);
      window.removeEventListener('offline', disconnected);
    };
  }, [flush, load, refreshPending]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function queue(
    operation: Omit<PendingFieldOperation, 'id' | 'scopeKey' | 'createdAt'>,
  ) {
    try {
      await addPendingOperation({
        ...operation,
        id: crypto.randomUUID(),
        scopeKey,
        createdAt: new Date().toISOString(),
      });
      await refreshPending();
      setNotice(
        navigator.onLine
          ? 'Update queued for sync.'
          : 'Saved on this device. It will sync when connected.',
      );
      if (navigator.onLine) void flush();
    } catch {
      setFailure(
        'This browser could not save an offline update. Keep this page open and try again after reconnecting.',
      );
    }
  }

  async function addNote(
    event: SyntheticEvent<HTMLFormElement>,
    jobId: string,
  ) {
    event.preventDefault();
    const body = (notes[jobId] ?? '').trim();
    if (!body) {
      setFailure('Write a note before saving it.');
      return;
    }
    await queue({ kind: 'note', jobId, body });
    setNotes((current) => ({ ...current, [jobId]: '' }));
  }

  async function addPhoto(event: ChangeEvent<HTMLInputElement>, jobId: string) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const validation = validateAttachment(file);
    if (validation) {
      setFailure(validation);
      return;
    }
    await queue({
      kind: 'attachment',
      jobId,
      file,
      fileName: file.name,
      contentType: file.type,
    });
  }

  const jobs = useMemo(() => {
    return (data?.jobs ?? [])
      .map((job) => {
        const statusUpdates = pending.filter(
          (item) => item.jobId === job.id && item.kind === 'status',
        );
        const queuedNotes = pending.filter(
          (item) => item.jobId === job.id && item.kind === 'note',
        );
        return {
          ...job,
          status: (statusUpdates.at(-1)?.status ?? job.status) as JobStatus,
          notes: [
            ...queuedNotes.map((item) => ({
              id: item.id,
              jobId: job.id,
              author: 'You · queued',
              body: item.body ?? '',
              createdAt: item.createdAt,
            })),
            ...job.notes,
          ],
        };
      })
      .filter((job) =>
        view === 'today' ? isToday(job.scheduledAt) : !isToday(job.scheduledAt),
      );
  }, [data, pending, view]);

  const activeCount = (data?.jobs ?? []).filter(
    (job) => !['Completed', 'Cancelled'].includes(job.status),
  ).length;
  const firstName = session.user.displayName.split(' ')[0];

  return (
    <div className="field-shell">
      <header className="field-topbar">
        <div className="field-brand">
          <span className="brand-mark" aria-hidden="true">
            S
          </span>
          <span>
            <strong>servora</strong>
            <small>field</small>
          </span>
        </div>
        <button
          className="sync-control"
          type="button"
          onClick={() => void flush()}
          disabled={!online || syncing}
          aria-label="Sync field updates"
        >
          {online ? <Wifi /> : <CloudOff />}
          <span>
            {syncing
              ? 'Syncing…'
              : pending.length
                ? `${pending.length} queued`
                : online
                  ? 'Synced'
                  : 'Offline'}
          </span>
        </button>
      </header>

      <main className="field-content">
        {!online ? (
          <output className="connectivity-banner">
            <CloudOff /> Offline. Status, notes, and photos stay on this device
            until sync succeeds.
          </output>
        ) : null}
        <section className="field-greeting">
          <p className="eyebrow">
            <Route /> Technician workspace
          </p>
          <h1>Good morning, {firstName}</h1>
          <p>
            {activeCount} active assignment{activeCount === 1 ? '' : 's'} for{' '}
            {session.workspace.name}
          </p>
        </section>
        <nav className="field-tabs" aria-label="Assignment dates">
          <button
            type="button"
            className={
              view === 'today' ? 'field-tab field-tab--active' : 'field-tab'
            }
            aria-current={view === 'today' ? 'page' : undefined}
            onClick={() => setView('today')}
          >
            Today
          </button>
          <button
            type="button"
            className={
              view === 'upcoming' ? 'field-tab field-tab--active' : 'field-tab'
            }
            aria-current={view === 'upcoming' ? 'page' : undefined}
            onClick={() => setView('upcoming')}
          >
            Other jobs
          </button>
        </nav>
        {failure ? (
          <div className="field-alert" role="alert">
            <span>{failure}</span>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              <RefreshCw /> Retry
            </Button>
          </div>
        ) : null}
        {!data ? (
          <output className="field-loading">Loading assigned work…</output>
        ) : jobs.length ? (
          <section className="field-job-list" aria-label="Field assignments">
            {jobs.map((job, index) => (
              <FieldJobCard
                key={job.id}
                job={job}
                index={index}
                open={expanded === job.id}
                queued={pending.filter((item) => item.jobId === job.id).length}
                note={notes[job.id] ?? ''}
                onToggle={() =>
                  setExpanded(expanded === job.id ? null : job.id)
                }
                onNoteChange={(value) =>
                  setNotes((current) => ({ ...current, [job.id]: value }))
                }
                onAddNote={(event) => void addNote(event, job.id)}
                onAdvance={(status) =>
                  void queue({ kind: 'status', jobId: job.id, status })
                }
                onPhoto={(event) => void addPhoto(event, job.id)}
                photoRef={(element) => {
                  photoInput.current[job.id] = element;
                }}
                openCamera={() => photoInput.current[job.id]?.click()}
                onRefresh={load}
              />
            ))}
          </section>
        ) : (
          <div className="field-empty">
            <CalendarDays />
            <h2>
              {view === 'today'
                ? 'No jobs assigned today'
                : 'No other assignments'}
            </h2>
            <p>New assignments from dispatch will appear here after refresh.</p>
            <Button variant="outline" onClick={() => void load()}>
              <RefreshCw /> Refresh jobs
            </Button>
          </div>
        )}
      </main>
      <output
        className={`toast-message ${notice ? 'toast-message--visible' : ''}`}
        aria-live="polite"
      >
        <Check /> {notice}
      </output>
    </div>
  );
}

function FieldJobCard({
  job,
  index,
  open,
  queued,
  note,
  onToggle,
  onNoteChange,
  onAddNote,
  onAdvance,
  onPhoto,
  photoRef,
  openCamera,
  onRefresh,
}: {
  job: TechnicianJob;
  index: number;
  open: boolean;
  queued: number;
  note: string;
  onToggle: () => void;
  onNoteChange: (value: string) => void;
  onAddNote: (event: SyntheticEvent<HTMLFormElement>) => void;
  onAdvance: (status: JobStatus) => void;
  onPhoto: (event: ChangeEvent<HTMLInputElement>) => void;
  photoRef: (element: HTMLInputElement | null) => void;
  openCamera: () => void;
  onRefresh: () => Promise<void>;
}) {
  const next = getNextJobStatus(job.status);
  return (
    <article
      className={`field-job ${job.status === 'In progress' ? 'field-job--active' : ''}`}
    >
      <div className="field-job-index">
        <span>{String(index + 1).padStart(2, '0')}</span>
        <i />
      </div>
      <div className="field-job-main">
        <div className="field-job-meta">
          <span>
            <Clock3 /> {timeFormat.format(new Date(job.scheduledAt))}
          </span>
          <span
            className={`field-status field-status--${job.status.toLowerCase().replaceAll(' ', '-')}`}
          >
            {job.status}
          </span>
        </div>
        <h2>{job.service}</h2>
        <p className="field-customer">
          {job.customer} · {job.contactName}
        </p>
        <p className="field-location">
          <MapPin /> {job.city}
        </p>
        <div className="field-quick-actions">
          <a href={`tel:${job.phone.replace(/\s/g, '')}`}>
            <Phone /> Call
          </a>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.city)}`}
            target="_blank"
            rel="noreferrer"
          >
            <Navigation /> Directions
          </a>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`field-details-${job.id}`}
            onClick={onToggle}
          >
            {open ? <ChevronUp /> : <ChevronDown />} Details
          </button>
        </div>
        {next ? (
          <Button
            className="field-primary-action"
            onClick={() => onAdvance(next)}
          >
            {next === 'Completed' ? <Check /> : <Navigation />}{' '}
            {statusAction[job.status]}
          </Button>
        ) : null}
        {open ? (
          <div className="field-details" id={`field-details-${job.id}`}>
            <section>
              <div className="field-section-heading">
                <span>
                  <StickyNote /> Field notes
                </span>
                <small>{job.notes.length}</small>
              </div>
              {job.notes.length ? (
                <ul className="field-note-list">
                  {job.notes.map((entry) => (
                    <li key={entry.id}>
                      <p>{entry.body}</p>
                      <small>
                        {entry.author} ·{' '}
                        {timeFormat.format(new Date(entry.createdAt))}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="field-empty-copy">No field notes yet.</p>
              )}
              <form className="field-note-form" noValidate onSubmit={onAddNote}>
                <label htmlFor={`note-${job.id}`}>Add a job note</label>
                <textarea
                  className="resize-none"
                  id={`note-${job.id}`}
                  maxLength={2000}
                  rows={3}
                  value={note}
                  onChange={(event) => onNoteChange(event.target.value)}
                  placeholder="Work completed, parts used, or follow-up needed…"
                />
                <div>
                  <small>{note.length} / 2,000</small>
                  <Button type="submit" size="sm" variant="outline">
                    Save note
                  </Button>
                </div>
              </form>
            </section>
            <section>
              <div className="field-section-heading">
                <span>
                  <Camera /> Photos & files
                </span>
                <small>{job.attachmentCount} saved</small>
              </div>
              <input
                ref={photoRef}
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                aria-label={`Take a photo for ${job.service}`}
                onChange={onPhoto}
              />
              <div className="field-file-actions">
                <Button type="button" variant="outline" onClick={openCamera}>
                  <Camera /> Take photo
                </Button>
                <JobAttachmentsDialog
                  job={attachmentJob(job)}
                  onChanged={onRefresh}
                  technicianMode
                />
              </div>
              <p className="field-help">
                JPG, PNG, WebP, or PDF up to 8 MB. Queued files remain private
                to this account.
              </p>
            </section>
            {queued ? (
              <p className="field-queued">
                <CloudOff /> {queued} update{queued === 1 ? '' : 's'} waiting to
                sync
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
