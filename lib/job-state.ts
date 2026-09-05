import type { JobStatus } from './contracts';

const nextStatus: Partial<Record<JobStatus, JobStatus>> = {
  Scheduled: 'En route',
  'En route': 'In progress',
  'In progress': 'Completed',
};

export function getNextJobStatus(status: JobStatus) {
  return nextStatus[status] ?? null;
}

export function canTransitionJob(current: JobStatus, next: JobStatus) {
  return nextStatus[current] === next;
}
