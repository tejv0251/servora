'use client';

import { useState, type SyntheticEvent } from 'react';
import { UserRoundCheck } from 'lucide-react';

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
import type { DashboardJob, TechnicianOption } from '@/lib/contracts';

export function JobAssignmentDialog({
  job,
  technicians,
  onAssign,
}: {
  job: DashboardJob;
  technicians: TechnicianOption[];
  onAssign: (jobId: string, technicianUserId: string) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(job.assignedUserId ?? '');
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      setFailure('Choose a technician before assigning this job.');
      return;
    }
    setSaving(true);
    setFailure('');
    try {
      await onAssign(job.id, selected);
      setOpen(false);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Assignment failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setSelected(job.assignedUserId ?? '');
          setFailure('');
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <UserRoundCheck /> {job.assignedUserId ? 'Reassign' : 'Assign'}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Assign field technician</DialogTitle>
          <DialogDescription>
            The selected technician will see this job in their private field
            app.
          </DialogDescription>
        </DialogHeader>
        <form
          className="form-grid form-grid--single"
          noValidate
          onSubmit={submit}
        >
          <label htmlFor={`assignment-${job.id}`}>
            Technician
            <select
              id={`assignment-${job.id}`}
              value={selected}
              disabled={saving || technicians.length === 0}
              onChange={(event) => {
                setSelected(event.target.value);
                setFailure('');
              }}
            >
              <option value="">Choose a technician</option>
              {technicians.map((technician) => (
                <option key={technician.userId} value={technician.userId}>
                  {technician.displayName} · {technician.email}
                </option>
              ))}
            </select>
          </label>
          {technicians.length === 0 ? (
            <p className="form-help">
              Invite a technician in Team & access, then have them sign in to
              accept before assigning work.
            </p>
          ) : null}
          {failure ? (
            <p className="form-alert" role="alert">
              {failure}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="primary-button"
              type="submit"
              disabled={saving || !selected}
              aria-busy={saving}
            >
              {saving ? 'Assigning…' : 'Assign technician'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
