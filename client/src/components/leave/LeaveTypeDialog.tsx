'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { LeaveType, LeaveTypePayload } from '@/api/leave';
import { leaveTypeSchema } from '@/lib/leaveValidation';
import { useCreateLeaveType, useUpdateLeaveType } from '@/hooks/useLeave';

interface Props {
  /** Absent means create. */
  type?: LeaveType | null;
  open: boolean;
  onClose: () => void;
}

const BLANK: LeaveTypePayload = {
  name: '',
  annual_entitlement: 0,
  is_paid: true,
  carry_forward: false,
  max_carry_forward: 0,
  requires_proof: false,
  is_active: true,
};

/**
 * Create or edit one leave type.
 *
 * Editing `annual_entitlement` does not restate balances that already exist:
 * the server sets the column and leaves `leave_balances` alone. The form says
 * so rather than leaving HR to find out from a number that did not move.
 */
export function LeaveTypeDialog({ type, open, onClose }: Props) {
  const [form, setForm] = useState<LeaveTypePayload>(type ?? BLANK);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useCreateLeaveType();
  const update = useUpdateLeaveType();
  const busy = create.isPending || update.isPending;

  const set = <K extends keyof LeaveTypePayload>(key: K, value: LeaveTypePayload[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    const parsed = leaveTypeSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((i) => [String(i.path[0] ?? 'form'), i.message]),
        ),
      );
      return;
    }
    setErrors({});
    try {
      if (type) await update.mutateAsync({ id: type.id, payload: parsed.data });
      else await create.mutateAsync(parsed.data);
      onClose();
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : 'Could not save' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{type ? `Edit ${type.name}` : 'New leave type'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lt-name">Name</Label>
            <Input
              id="lt-name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Casual"
            />
            {errors.name ? <p className="text-xs text-red-600">{errors.name}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lt-entitlement">Days a year</Label>
              <Input
                id="lt-entitlement"
                type="number"
                min={0}
                value={form.annual_entitlement}
                onChange={(e) => set('annual_entitlement', Number(e.target.value))}
              />
              {errors.annual_entitlement ? (
                <p className="text-xs text-red-600">{errors.annual_entitlement}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lt-carry">Max carry forward</Label>
              <Input
                id="lt-carry"
                type="number"
                min={0}
                disabled={!form.carry_forward}
                value={form.max_carry_forward}
                onChange={(e) => set('max_carry_forward', Number(e.target.value))}
              />
              {errors.max_carry_forward ? (
                <p className="text-xs text-red-600">{errors.max_carry_forward}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3">
            {(
              [
                ['is_paid', 'Paid leave', 'Unpaid types are counted separately in the monthly report'],
                ['carry_forward', 'Carries forward', 'Unused days roll into next financial year'],
                ['requires_proof', 'Needs proof', 'The applicant must attach a document'],
                ['is_active', 'Active', 'Inactive types cannot be applied for'],
              ] as const
            ).map(([key, label, hint]) => (
              <label key={key} className="flex items-start gap-3 text-sm">
                <Checkbox
                  checked={form[key]}
                  onCheckedChange={(next) => set(key, next === true)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium text-slate-800">{label}</span>
                  <span className="block text-xs text-slate-500">{hint}</span>
                </span>
              </label>
            ))}
          </div>

          {type ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Changing the entitlement does not restate balances that already exist.
              Correct those on the Balances screen.
            </p>
          ) : null}

          {errors.form ? <p className="text-sm text-red-600">{errors.form}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submit}
              disabled={busy}
              className="bg-green-600 hover:bg-green-700"
            >
              {busy ? 'Saving...' : type ? 'Save changes' : 'Create type'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
