'use client';

import { lazy, Suspense, useEffect, useState } from 'react';
import { FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { SessionData } from '@/lib/contracts';

const ServoraDashboard = lazy(() =>
  import('@/components/servora-dashboard').then((module) => ({
    default: module.ServoraDashboard,
  })),
);
const TechnicianMobile = lazy(() =>
  import('@/components/technician-mobile').then((module) => ({
    default: module.TechnicianMobile,
  })),
);

export function ServoraApp() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [failure, setFailure] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadSession() {
      try {
        const response = await fetch('/api/session', {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        });
        const payload = (await response.json().catch(() => ({}))) as
          | SessionData
          | { error?: string };
        if (!response.ok) {
          throw new Error(
            'error' in payload && payload.error
              ? payload.error
              : 'Could not open Servora.',
          );
        }
        setSession(payload as SessionData);
        setFailure('');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError')
          return;
        setFailure(
          error instanceof Error ? error.message : 'Could not open Servora.',
        );
      }
    }
    void loadSession();
    return () => controller.abort();
  }, [attempt]);

  if (failure)
    return (
      <div className="feature-state">
        <FileText />
        <h1>Workspace unavailable</h1>
        <p>{failure}</p>
        <Button
          className="primary-button"
          onClick={() => setAttempt((value) => value + 1)}
        >
          Retry
        </Button>
      </div>
    );
  if (!session)
    return <output className="app-loading">Opening Servora…</output>;
  return (
    <Suspense fallback={<output className="app-loading">Opening workspace…</output>}>
      {session.role === 'technician' ? (
        <TechnicianMobile session={session} />
      ) : (
        <ServoraDashboard />
      )}
    </Suspense>
  );
}
