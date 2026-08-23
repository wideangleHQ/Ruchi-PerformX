'use client';

import { ReactNode, useState } from 'react';
import type { ZodTypeAny } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * One dialog for all five vendor work forms.
 *
 * They differ only in their fields: same shell, same validate-then-submit, same
 * error placement. Five bespoke dialogs would be five copies of the same
 * seventy lines, and the fifth would drift from the first the week somebody
 * fixes a bug in one of them.
 *
 * The field spec is deliberately small. When a form needs something this cannot
 * express, that form gets its own component rather than this growing a branch.
 */
export type WorkField =
  | {
      kind: 'text' | 'date' | 'number' | 'url';
      name: string;
      label: string;
      hint?: string;
      placeholder?: string;
      min?: number;
      max?: number;
      /** Full width in the two-column grid. */
      wide?: boolean;
    }
  | { kind: 'textarea'; name: string; label: string; hint?: string; wide?: true }
  | {
      kind: 'select';
      name: string;
      label: string;
      options: { value: string; label: string }[];
      hint?: string;
      wide?: boolean;
    };

interface Props {
  title: string;
  /** Shown above the fields when the form has a constraint worth stating. */
  note?: ReactNode;
  fields: WorkField[];
  initial: Record<string, unknown>;
  schema: ZodTypeAny;
  submitLabel: string;
  busy: boolean;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}

export function VendorWorkDialog({
  title, note, fields, initial, schema, submitLabel, busy, onSubmit, onClose,
}: Props) {
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (name: string, value: unknown) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  const submit = async () => {
    const parsed = schema.safeParse(values);
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
      await onSubmit(parsed.data as Record<string, unknown>);
      onClose();
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : 'Could not save' });
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {note ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{note}</p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => {
            const error = errors[field.name];
            const value = values[field.name];
            return (
              <div
                key={field.name}
                className={`flex flex-col gap-1.5 ${field.wide ? 'sm:col-span-2' : ''}`}
              >
                <Label htmlFor={`vw-${field.name}`}>{field.label}</Label>

                {field.kind === 'textarea' ? (
                  <Textarea
                    id={`vw-${field.name}`}
                    rows={3}
                    value={String(value ?? '')}
                    onChange={(e) => set(field.name, e.target.value)}
                  />
                ) : field.kind === 'select' ? (
                  <select
                    id={`vw-${field.name}`}
                    value={String(value ?? '')}
                    onChange={(e) => set(field.name, e.target.value)}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  >
                    <option value="">Select...</option>
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={`vw-${field.name}`}
                    type={field.kind === 'text' || field.kind === 'url' ? 'text' : field.kind}
                    placeholder={field.placeholder}
                    min={field.min}
                    max={field.max}
                    value={String(value ?? '')}
                    onChange={(e) =>
                      set(
                        field.name,
                        field.kind === 'number' && e.target.value !== ''
                          ? Number(e.target.value)
                          : e.target.value,
                      )
                    }
                  />
                )}

                {field.hint && !error ? (
                  <p className="text-xs text-slate-500">{field.hint}</p>
                ) : null}
                {error ? <p className="text-xs text-red-600">{error}</p> : null}
              </div>
            );
          })}
        </div>

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
            {busy ? 'Saving...' : submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
