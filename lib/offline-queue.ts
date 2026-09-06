import type { JobStatus } from '@/lib/contracts';

export type PendingFieldOperation = {
  id: string;
  scopeKey: string;
  kind: 'status' | 'note' | 'attachment';
  jobId: string;
  createdAt: string;
  status?: JobStatus;
  body?: string;
  file?: Blob;
  fileName?: string;
  contentType?: string;
};

const DATABASE = 'servora-field-v1';
const STORE = 'pending-operations';

function openQueue() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('scopeKey', 'scopeKey');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transaction<T>(
  mode: IDBTransactionMode,
  action: (
    store: IDBObjectStore,
    resolve: (value: T) => void,
    reject: (reason?: unknown) => void,
  ) => void,
) {
  return openQueue().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        action(tx.objectStore(STORE), resolve, reject);
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

export function addPendingOperation(operation: PendingFieldOperation) {
  return transaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.put(operation);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function removePendingOperation(id: string) {
  return transaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function listPendingOperations(scopeKey: string) {
  return transaction<PendingFieldOperation[]>(
    'readonly',
    (store, resolve, reject) => {
      const request = store.index('scopeKey').getAll(scopeKey);
      request.onsuccess = () =>
        resolve(
          (request.result as PendingFieldOperation[]).sort((a, b) =>
            a.createdAt.localeCompare(b.createdAt),
          ),
        );
      request.onerror = () => reject(request.error);
    },
  );
}

export async function sendPendingOperation(operation: PendingFieldOperation) {
  let response: Response;
  if (operation.kind === 'attachment') {
    const form = new FormData();
    form.append('jobId', operation.jobId);
    form.append('idempotencyKey', operation.id);
    form.append(
      'file',
      operation.file ?? new Blob([], { type: operation.contentType }),
      operation.fileName ?? 'field-photo.jpg',
    );
    response = await fetch('/api/jobs/attachments', {
      method: 'POST',
      body: form,
    });
  } else {
    const path =
      operation.kind === 'status'
        ? '/api/technician/jobs/status'
        : '/api/technician/jobs/notes';
    response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jobId: operation.jobId,
        idempotencyKey: operation.id,
        ...(operation.kind === 'status'
          ? { status: operation.status }
          : { body: operation.body }),
      }),
    });
  }
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (!response.ok) {
    const error = new Error(
      payload.error || `Sync failed (${response.status}).`,
    ) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return payload;
}
