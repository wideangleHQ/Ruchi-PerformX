'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CreateKpiPayload,
  Kpi,
  KpiDirection,
  KpiMode,
  KpiPeriod,
  KpiScope,
  KpiScoringMethod,
  ThresholdBand,
} from '@/api/kpi';
import { useDepartmentOptions, useUserOptions } from '@/components/pickers';
import { useProjects } from '@/hooks/useProjects';
import { useKpiAllocation } from '@/hooks/useKpi';
import { UnitSearch } from '@/components/kpi/unit-search';
import { MODE_LABELS, formatNumber } from '@/components/kpi/display';

type MilestoneRow = { title: string; weight: string };

/** Numbers live as strings while they are being typed, so a half typed target
 * does not become NaN on every keystroke. */
interface FormValues {
  scope: KpiScope;
  owner_user_id: string;
  department_id: string;
  project_id: string;
  name: string;
  description: string;
  mode: KpiMode;
  unit_label: string;
  unit_symbol: string;
  target_value: string;
  baseline_value: string;
  direction: KpiDirection;
  scoring_method: KpiScoringMethod;
  bands: ThresholdBand[];
  rating_scores: string;
  cap_at: string;
  weight: string;
  period: KpiPeriod;
  period_start: string;
  period_end: string;
  evidence_required: boolean;
  review_required: boolean;
  milestones: MilestoneRow[];
}

/** The method each mode is scored by, and the only alternative it allows. */
const METHODS_BY_MODE: Record<KpiMode, KpiScoringMethod[]> = {
  QUANTITATIVE: ['DIRECT', 'THRESHOLD'],
  BINARY: ['DIRECT', 'THRESHOLD'],
  MILESTONE: ['MILESTONE'],
  RATING: ['RATING'],
};

function firstOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

function lastOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}

const EMPTY: FormValues = {
  scope: 'INDIVIDUAL',
  owner_user_id: '',
  department_id: '',
  project_id: '',
  name: '',
  description: '',
  mode: 'QUANTITATIVE',
  unit_label: '',
  unit_symbol: '',
  target_value: '',
  baseline_value: '',
  direction: 'HIGHER_IS_BETTER',
  scoring_method: 'DIRECT',
  bands: [
    { min_achievement: 90, score: 100 },
    { min_achievement: 70, score: 80 },
  ],
  rating_scores: '0, 40, 70, 90, 100',
  cap_at: '',
  weight: '',
  period: 'MONTHLY',
  period_start: firstOfMonth(new Date()),
  period_end: lastOfMonth(new Date()),
  evidence_required: false,
  review_required: false,
  milestones: [{ title: '', weight: '' }],
};

/** An existing KPI as form values, for editing. Bands and the rating rubric
 * come back from `scoring_config`; milestones are not edited here. */
function fromKpi(kpi: Kpi): FormValues {
  const text = (value: string | null) => (value === null ? '' : String(Number(value)));
  return {
    ...EMPTY,
    scope: kpi.scope,
    owner_user_id: kpi.owner_user_id ?? '',
    department_id: kpi.department_id ?? '',
    project_id: kpi.project_id ?? '',
    name: kpi.name,
    description: kpi.description ?? '',
    mode: kpi.mode,
    unit_label: kpi.unit_label ?? '',
    unit_symbol: kpi.unit_symbol ?? '',
    target_value: text(kpi.target_value),
    baseline_value: text(kpi.baseline_value),
    direction: kpi.direction ?? 'HIGHER_IS_BETTER',
    scoring_method: kpi.scoring_method,
    bands: kpi.scoring_config?.bands ?? EMPTY.bands,
    rating_scores: kpi.scoring_config?.rating_scores?.join(', ') ?? EMPTY.rating_scores,
    cap_at: kpi.scoring_config?.cap_at === undefined ? '' : String(kpi.scoring_config.cap_at),
    weight: text(kpi.weight),
    period: kpi.period,
    period_start: kpi.period_start.slice(0, 10),
    period_end: kpi.period_end.slice(0, 10),
    evidence_required: kpi.evidence_required,
    review_required: kpi.review_required,
    milestones: [],
  };
}

/**
 * The ten steps of creating a KPI, on one screen.
 *
 * The mode decides what the rest of the form asks for, because the alternative
 * is a form that asks a binary KPI for a direction and a rating KPI for a unit.
 * Everything the framework calls configurable is here; everything it calls
 * consistent is not, because those are not choices.
 *
 * Three uses. An employee defines their own KPI, which goes for approval. An
 * authority defines their own, which publishes, or assigns one to somebody
 * else against that person's remaining weight. With `initial`, it edits an
 * existing KPI, and what the KPI measures and whose it is stay locked.
 */
export function KpiFormDialog({
  open,
  onClose,
  onSubmit,
  isPending,
  error,
  selfId,
  canAssign,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateKpiPayload) => Promise<void>;
  isPending?: boolean;
  error?: string | null;
  selfId: string;
  canAssign: boolean;
  initial?: Kpi | null;
}) {
  const [values, setValues] = useState<FormValues>(EMPTY);
  const users = useUserOptions();
  const departments = useDepartmentOptions();
  const { data: projects = [] } = useProjects();
  const editing = Boolean(initial);

  useEffect(() => {
    if (open) setValues(initial ? fromKpi(initial) : { ...EMPTY, owner_user_id: selfId });
  }, [open, initial, selfId]);

  const allocationOwner =
    values.scope === 'INDIVIDUAL' && values.owner_user_id ? values.owner_user_id : null;
  const { data: allocation } = useKpiAllocation(
    open ? allocationOwner : null,
    values.period_start,
    values.period_end,
  );
  // Editing a KPI that already holds weight: its own share is free to move.
  const ownShare =
    initial && (initial.status === 'PENDING_APPROVAL' || initial.status === 'PUBLISHED')
      ? Number(initial.weight)
      : 0;

  if (!open) return null;

  const set = <K extends keyof FormValues>(field: K, value: FormValues[K]) =>
    setValues((current) => ({ ...current, [field]: value }));

  const setMode = (mode: KpiMode) =>
    setValues((current) => ({
      ...current,
      mode,
      scoring_method: METHODS_BY_MODE[mode][0] as KpiScoringMethod,
      review_required: mode === 'RATING' ? true : current.review_required,
    }));

  const milestoneTotal = values.milestones.reduce(
    (sum, row) => sum + (Number(row.weight) || 0),
    0,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-full w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {editing ? 'Edit KPI' : canAssign ? 'Define or assign a KPI' : 'Define your KPI'}
            </h2>
            <p className="text-sm text-slate-500">
              {editing
                ? canAssign
                  ? 'Saved as it stands. A target or weight change is kept as a revision.'
                  : 'A change to a published KPI goes back for approval.'
                : canAssign
                  ? 'Published straight away. It counts towards a PS Score from now.'
                  : 'Sent to your HOD for approval. It counts once approved.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <form
          className="flex-1 space-y-5 overflow-y-auto p-5"
          onSubmit={async (event) => {
            event.preventDefault();
            await onSubmit(toPayload(values));
          }}
        >
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="KPI name *" className="sm:col-span-2">
              <Input
                value={values.name}
                onChange={(event) => set('name', event.target.value)}
                placeholder="Monthly Sales Revenue"
                maxLength={255}
                required
              />
            </Field>

            <Field label="Description" className="sm:col-span-2">
              <textarea
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={2}
                value={values.description}
                onChange={(event) => set('description', event.target.value)}
              />
            </Field>

            {canAssign && !editing ? (
              <Field label="Whose outcome is this?">
                <Select
                  value={values.scope}
                  onChange={(value) => set('scope', value as KpiScope)}
                  options={[
                    ['INDIVIDUAL', 'An individual'],
                    ['DEPARTMENT', 'A department'],
                    ['PROJECT', 'A project'],
                  ]}
                />
              </Field>
            ) : null}

            {canAssign && !editing && values.scope === 'INDIVIDUAL' ? (
              <Field label="Owner *">
                <Select
                  value={values.owner_user_id}
                  onChange={(value) => set('owner_user_id', value)}
                  options={[
                    [selfId, 'Myself'],
                    ...users
                      .filter((user) => user.id !== selfId)
                      .map((user) => [user.id, user.fullName] as [string, string]),
                  ]}
                />
              </Field>
            ) : null}

            {canAssign && !editing && values.scope === 'DEPARTMENT' ? (
              <Field label="Department *">
                <Select
                  value={values.department_id}
                  onChange={(value) => set('department_id', value)}
                  options={[
                    ['', 'Select a department'],
                    ...departments.map((d) => [d.id, d.name] as [string, string]),
                  ]}
                />
              </Field>
            ) : null}

            {canAssign && !editing && values.scope === 'PROJECT' ? (
              <Field label="Project *">
                <Select
                  value={values.project_id}
                  onChange={(value) => set('project_id', value)}
                  options={[
                    ['', 'Select a project'],
                    ...projects.map((p) => [p.id, p.title] as [string, string]),
                  ]}
                />
              </Field>
            ) : null}

            {editing ? (
              <p className="text-sm text-slate-500 sm:col-span-2">
                {MODE_LABELS[values.mode]}, scored by{' '}
                {SCORING_LABELS[values.scoring_method].toLowerCase()}. What a KPI
                measures and whose it is cannot change; delete it and define a new one.
              </p>
            ) : (
              <>
                <Field label="How is it measured?">
                  <Select
                    value={values.mode}
                    onChange={(value) => setMode(value as KpiMode)}
                    options={Object.entries(MODE_LABELS) as [string, string][]}
                  />
                </Field>

                <Field label="Scored by">
                  <Select
                    value={values.scoring_method}
                    onChange={(value) => set('scoring_method', value as KpiScoringMethod)}
                    options={METHODS_BY_MODE[values.mode].map(
                      (method) => [method, SCORING_LABELS[method]] as [string, string],
                    )}
                  />
                </Field>
              </>
            )}
          </div>

          {values.mode === 'QUANTITATIVE' ? (
            <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
              <Field label="Target *">
                <Input
                  type="number"
                  step="any"
                  value={values.target_value}
                  onChange={(event) => set('target_value', event.target.value)}
                  required
                />
              </Field>

              <Field label="Unit *">
                <UnitSearch
                  value={values.unit_label}
                  onSelect={(unit) =>
                    setValues((current) => ({
                      ...current,
                      unit_label: unit.label,
                      unit_symbol: unit.symbol,
                    }))
                  }
                />
              </Field>

              <Field label="Direction">
                <Select
                  value={values.direction}
                  onChange={(value) => set('direction', value as KpiDirection)}
                  options={[
                    ['HIGHER_IS_BETTER', 'Higher is better'],
                    ['LOWER_IS_BETTER', 'Lower is better'],
                    ['EXACT_TARGET', 'Exact target'],
                  ]}
                />
              </Field>

              <Field label="Baseline (optional)">
                <Input
                  type="number"
                  step="any"
                  value={values.baseline_value}
                  onChange={(event) => set('baseline_value', event.target.value)}
                  placeholder="Measure improvement from here"
                />
              </Field>
            </div>
          ) : null}

          {values.scoring_method === 'THRESHOLD' ? (
            <div className="space-y-3 rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-700">Threshold bands</p>
              <p className="text-xs text-slate-500">
                Achievement at or above the first number scores the second. The
                highest band that qualifies wins.
              </p>
              {values.bands.map((band, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="w-28"
                    value={band.min_achievement}
                    onChange={(event) =>
                      set(
                        'bands',
                        values.bands.map((row, i) =>
                          i === index
                            ? { ...row, min_achievement: Number(event.target.value) }
                            : row,
                        ),
                      )
                    }
                  />
                  <span className="text-sm text-slate-500">% scores</span>
                  <Input
                    type="number"
                    className="w-28"
                    value={band.score}
                    onChange={(event) =>
                      set(
                        'bands',
                        values.bands.map((row, i) =>
                          i === index ? { ...row, score: Number(event.target.value) } : row,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-200"
                    onClick={() =>
                      set(
                        'bands',
                        values.bands.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  set('bands', [...values.bands, { min_achievement: 0, score: 0 }])
                }
              >
                <Plus size={14} /> Add band
              </Button>
            </div>
          ) : null}

          {values.mode === 'RATING' ? (
            <div className="rounded-xl bg-slate-50 p-4">
              <Field label="Score for each rating, lowest first">
                <Input
                  value={values.rating_scores}
                  onChange={(event) => set('rating_scores', event.target.value)}
                  placeholder="0, 40, 70, 90, 100"
                />
              </Field>
              <p className="mt-1 text-xs text-slate-500">
                Five numbers means a 1-5 scale. What each point means for this KPI
                is the department&rsquo;s own rubric, not a company-wide one.
              </p>
            </div>
          ) : null}

          {values.mode === 'MILESTONE' && !editing ? (
            <div className="space-y-3 rounded-xl bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">Stages</p>
                <p
                  className={`text-xs ${
                    Math.abs(milestoneTotal - 100) < 0.05
                      ? 'text-emerald-600'
                      : 'text-amber-600'
                  }`}
                >
                  {milestoneTotal}% of 100%
                </p>
              </div>
              {values.milestones.map((row, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    value={row.title}
                    placeholder="Requirement gathering"
                    onChange={(event) =>
                      set(
                        'milestones',
                        values.milestones.map((m, i) =>
                          i === index ? { ...m, title: event.target.value } : m,
                        ),
                      )
                    }
                  />
                  <Input
                    type="number"
                    className="w-24"
                    value={row.weight}
                    placeholder="%"
                    onChange={(event) =>
                      set(
                        'milestones',
                        values.milestones.map((m, i) =>
                          i === index ? { ...m, weight: event.target.value } : m,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-200"
                    onClick={() =>
                      set(
                        'milestones',
                        values.milestones.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  set('milestones', [...values.milestones, { title: '', weight: '' }])
                }
              >
                <Plus size={14} /> Add stage
              </Button>
              <p className="text-xs text-slate-500">
                Stages carry different weight, so three of five complete is not
                automatically 60%.
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Weight of this KPI *">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="any"
                  min="0.01"
                  max="100"
                  value={values.weight}
                  onChange={(event) => set('weight', event.target.value)}
                  required
                />
                <span className="text-sm text-slate-500">%</span>
              </div>
              {allocation ? (
                <p className="mt-1 text-xs text-slate-500">
                  {formatNumber(allocation.allocated - ownShare)}% already allocated,{' '}
                  {formatNumber(Math.min(100, allocation.remaining + ownShare))}% left in
                  this period. Below 100% in total is fine.
                </p>
              ) : null}
            </Field>

            <Field label="Cycle">
              <Select
                value={values.period}
                onChange={(value) => set('period', value as KpiPeriod)}
                options={[
                  ['MONTHLY', 'Monthly'],
                  ['QUARTERLY', 'Quarterly'],
                  ['ANNUAL', 'Annual'],
                ]}
              />
            </Field>

            <Field label="Cap overachievement at">
              <Input
                type="number"
                value={values.cap_at}
                onChange={(event) => set('cap_at', event.target.value)}
                placeholder="Leave blank to allow over 100"
              />
            </Field>

            <Field label="From">
              <Input
                type="date"
                value={values.period_start}
                onChange={(event) => set('period_start', event.target.value)}
                required
              />
            </Field>

            <Field label="To">
              <Input
                type="date"
                value={values.period_end}
                onChange={(event) => set('period_end', event.target.value)}
                required
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={values.evidence_required}
                onChange={(event) => set('evidence_required', event.target.checked)}
              />
              Evidence required with every update
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={values.review_required}
                disabled={values.mode === 'RATING'}
                onChange={(event) => set('review_required', event.target.checked)}
              />
              Reviewed before it is evaluated
            </label>
          </div>
        </form>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {editing ? null : (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={async () => {
                await onSubmit({ ...toPayload(values), save_as_draft: true });
              }}
            >
              Save draft
            </Button>
          )}
          <Button
            type="button"
            disabled={isPending}
            onClick={async () => {
              await onSubmit(toPayload(values));
            }}
          >
            {isPending
              ? 'Saving...'
              : editing
                ? 'Save changes'
                : canAssign
                  ? 'Publish'
                  : 'Submit for approval'}
          </Button>
        </div>
      </div>
    </div>
  );
}

const SCORING_LABELS: Record<KpiScoringMethod, string> = {
  DIRECT: 'Direct target achievement',
  THRESHOLD: 'Threshold bands',
  RATING: 'Reviewer rating',
  MILESTONE: 'Weighted milestones',
};

/**
 * Form values to the payload, in one place at the submit boundary.
 *
 * The form field names and the DTO field names match, and this is still a named
 * function rather than a cast, because the DTO rejects a key it does not
 * declare: a scope that carries the wrong target, or a binary KPI carrying a
 * direction, is a 400 with an unhelpful message. Everything a mode does not use
 * is dropped here instead.
 */
function toPayload(values: FormValues): CreateKpiPayload {
  const quantitative = values.mode === 'QUANTITATIVE';
  const config: CreateKpiPayload['scoring_config'] = {};

  if (values.scoring_method === 'THRESHOLD') config.bands = values.bands;
  if (values.mode === 'RATING') {
    const scores = values.rating_scores
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((score) => Number.isFinite(score));
    if (scores.length > 0) {
      config.rating_scores = scores;
      config.max_rating = scores.length;
    }
  }
  if (values.cap_at.trim()) config.cap_at = Number(values.cap_at);

  return {
    scope: values.scope,
    ...(values.scope === 'INDIVIDUAL' && { owner_user_id: values.owner_user_id }),
    ...(values.scope === 'DEPARTMENT' && { department_id: values.department_id }),
    ...(values.scope === 'PROJECT' && { project_id: values.project_id }),
    name: values.name.trim(),
    ...(values.description.trim() && { description: values.description.trim() }),
    mode: values.mode,
    ...(quantitative && {
      unit_label: values.unit_label,
      unit_symbol: values.unit_symbol,
      target_value: Number(values.target_value),
      direction: values.direction,
      ...(values.baseline_value.trim() && {
        baseline_value: Number(values.baseline_value),
      }),
    }),
    scoring_method: values.scoring_method,
    ...(Object.keys(config).length > 0 && { scoring_config: config }),
    weight: Number(values.weight),
    period: values.period,
    period_start: values.period_start,
    period_end: values.period_end,
    evidence_required: values.evidence_required,
    review_required: values.review_required,
    ...(values.mode === 'MILESTONE' && {
      milestones: values.milestones
        .filter((row) => row.title.trim())
        .map((row) => ({ title: row.title.trim(), weight: Number(row.weight) })),
    }),
  };
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}
