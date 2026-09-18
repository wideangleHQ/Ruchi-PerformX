'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, History, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { KpiStatus, RecordKpiUpdatePayload } from '@/api/kpi';
import {
  useChangeKpiStatus,
  useKpi,
  useRecordKpiUpdate,
  useTickKpiMilestone,
} from '@/hooks/useKpi';
import {
  MODE_LABELS,
  NEXT_STATUSES,
  formatNumber,
  formatPercent,
  formatValue,
  statusLabel,
  statusTone,
} from '@/components/kpi/display';

function errorMessage(error: unknown) {
  const response = (error as { response?: { data?: { message?: string | string[] } } })
    .response;
  const message = response?.data?.message;
  return Array.isArray(message) ? message[0] : message || 'Something went wrong';
}

/**
 * One KPI, end to end: what it asks for, what has been entered, what that
 * scores, and where it is in its lifecycle.
 *
 * Achievement and score are shown as separate figures rather than one number,
 * because they are separate: the same 80% achievement is 80 under a direct rule
 * and can be 100 under a threshold, and an employee asking why deserves to see
 * both halves.
 */
export function KpiDetailSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: kpi, isLoading } = useKpi(id);
  const recordUpdate = useRecordKpiUpdate();
  const tickMilestone = useTickKpiMilestone();
  const changeStatus = useChangeKpiStatus();

  const [actual, setActual] = useState('');
  const [remarks, setRemarks] = useState('');
  const [evidence, setEvidence] = useState('');
  const [rating, setRating] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [pendingStatus, setPendingStatus] = useState<KpiStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitUpdate = async (payload: RecordKpiUpdatePayload) => {
    setError(null);
    try {
      await recordUpdate.mutateAsync({
        id,
        data: {
          ...payload,
          ...(remarks.trim() && { remarks: remarks.trim() }),
          ...(evidence.trim() && { evidence_url: evidence.trim() }),
        },
      });
      setActual('');
      setRemarks('');
      setEvidence('');
      setRating('');
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const move = async (status: KpiStatus) => {
    setError(null);
    if (status === 'CANCELLED' && !cancelReason.trim()) {
      setPendingStatus('CANCELLED');
      return;
    }
    try {
      await changeStatus.mutateAsync({
        id,
        data: {
          status,
          ...(status === 'CANCELLED' && { reason: cancelReason.trim() }),
        },
      });
      setCancelReason('');
      setPendingStatus(null);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40">
      <aside className="flex h-full w-full max-w-xl flex-col bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {kpi?.name ?? 'Loading...'}
            </h2>
            {kpi ? (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 ${statusTone(kpi.status)}`}>
                  {statusLabel(kpi.status)}
                </span>
                <span className="text-slate-500">{MODE_LABELS[kpi.mode]}</span>
                <span className="text-slate-500">
                  {kpi.period_start.slice(0, 10)} to {kpi.period_end.slice(0, 10)}
                </span>
                <span className="text-slate-500">weight {formatNumber(kpi.weight)}%</span>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          {isLoading || !kpi ? (
            <p className="text-sm text-slate-500">Loading the KPI...</p>
          ) : (
            <>
              {kpi.description ? (
                <p className="text-sm text-slate-600">{kpi.description}</p>
              ) : null}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Target" value={formatValue(kpi.target_value, kpi.unit_symbol)} />
                <Stat
                  label="Actual"
                  value={formatValue(kpi.actual_value, kpi.unit_symbol)}
                />
                <Stat label="Achievement" value={formatPercent(kpi.achievement)} />
                <Stat
                  label="KPI score"
                  value={kpi.score === null ? 'Not scored' : formatNumber(kpi.score)}
                />
              </div>

              {kpi.cancel_reason ? (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  Cancelled: {kpi.cancel_reason}. It is excluded from the PS Score
                  rather than counted as a failure.
                </p>
              ) : null}

              {kpi.mode === 'MILESTONE' ? (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-slate-900">Stages</h3>
                  <ul className="space-y-1">
                    {kpi.milestones.map((milestone) => (
                      <li key={milestone.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50"
                          onClick={() =>
                            tickMilestone
                              .mutateAsync({ id, milestoneId: milestone.id })
                              .catch((caught) => setError(errorMessage(caught)))
                          }
                        >
                          {milestone.completed_at ? (
                            <CheckCircle2 size={16} className="text-emerald-600" />
                          ) : (
                            <Circle size={16} className="text-slate-300" />
                          )}
                          <span className="flex-1 text-slate-800">{milestone.title}</span>
                          <span className="text-xs text-slate-500">
                            {formatNumber(milestone.weight)}%
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {kpi.mode !== 'MILESTONE' ? (
                <section className="space-y-3 rounded-xl bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {kpi.mode === 'RATING' ? 'Reviewer rating' : 'Enter what happened'}
                  </h3>

                  {kpi.mode === 'QUANTITATIVE' ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="any"
                        placeholder={`Actual in ${kpi.unit_label ?? 'units'}`}
                        value={actual}
                        onChange={(event) => setActual(event.target.value)}
                      />
                      <Button
                        type="button"
                        disabled={!actual.trim() || recordUpdate.isPending}
                        onClick={() => submitUpdate({ actual_value: Number(actual) })}
                      >
                        Save
                      </Button>
                    </div>
                  ) : null}

                  {kpi.mode === 'BINARY' ? (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => submitUpdate({ binary_done: false })}
                      >
                        Not completed
                      </Button>
                      <Button
                        type="button"
                        onClick={() => submitUpdate({ binary_done: true })}
                      >
                        Completed
                      </Button>
                    </div>
                  ) : null}

                  {kpi.mode === 'RATING' ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        max={kpi.scoring_config?.max_rating ?? 5}
                        placeholder={`1 to ${kpi.scoring_config?.max_rating ?? 5}`}
                        value={rating}
                        onChange={(event) => setRating(event.target.value)}
                      />
                      <Button
                        type="button"
                        disabled={!rating.trim() || recordUpdate.isPending}
                        onClick={() => submitUpdate({ rating: Number(rating) })}
                      >
                        Save rating
                      </Button>
                    </div>
                  ) : null}

                  <Input
                    placeholder="Remarks (optional)"
                    value={remarks}
                    onChange={(event) => setRemarks(event.target.value)}
                  />
                  {kpi.evidence_required ? (
                    <Input
                      placeholder="Evidence link (required for this KPI)"
                      value={evidence}
                      onChange={(event) => setEvidence(event.target.value)}
                    />
                  ) : null}
                  <p className="text-xs text-slate-500">
                    Enter the figure, not a percentage. PerformX works out the rest.
                  </p>
                </section>
              ) : null}

              {kpi.contributions.length > 0 ? (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-slate-900">
                    Contribution allocation
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {kpi.contributions.map((entry) => (
                      <li key={entry.id} className="flex justify-between text-slate-700">
                        <span>{entry.user_id_user?.full_name ?? entry.user_id}</span>
                        <span>{formatNumber(entry.share)}%</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-slate-500">
                    Each person is credited with their share, never the whole
                    outcome each.
                  </p>
                </section>
              ) : null}

              {kpi.revisions.length > 0 ? (
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <History size={14} /> Revisions
                  </h3>
                  <ul className="space-y-2 text-sm">
                    {kpi.revisions.map((revision) => (
                      <li key={revision.id} className="rounded-lg bg-slate-50 p-3">
                        <p className="text-slate-800">
                          Target {formatNumber(revision.old_target)} to{' '}
                          {formatNumber(revision.new_target)}, effective{' '}
                          {revision.effective_from.slice(0, 10)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {revision.reason} &middot;{' '}
                          {revision.changed_by_id_user?.full_name ?? 'Unknown'}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {kpi.updates.length > 0 ? (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-slate-900">
                    Update history
                  </h3>
                  <ul className="space-y-2 text-sm">
                    {kpi.updates.map((update) => (
                      <li key={update.id} className="rounded-lg border border-slate-100 p-3">
                        <div className="flex justify-between">
                          <span className="text-slate-800">
                            {update.actual_value !== null
                              ? formatValue(update.actual_value, kpi.unit_symbol)
                              : update.binary_done !== null
                                ? update.binary_done
                                  ? 'Completed'
                                  : 'Not completed'
                                : `Rated ${update.rating}`}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(update.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {update.entered_by_id_user?.full_name ?? 'Unknown'}
                          {update.remarks ? ` — ${update.remarks}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-slate-500">
                    The most recent update is what scores. Earlier ones are kept.
                  </p>
                </section>
              ) : null}
            </>
          )}
        </div>

        {kpi && NEXT_STATUSES[kpi.status].length > 0 ? (
          <div className="space-y-2 border-t border-slate-200 px-5 py-4">
            {pendingStatus === 'CANCELLED' ? (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Why is this KPI being cancelled?"
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!cancelReason.trim() || changeStatus.isPending}
                  onClick={() => move('CANCELLED')}
                >
                  Confirm
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPendingStatus(null);
                    setCancelReason('');
                  }}
                >
                  Back
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Move to</span>
                <div className="w-48">
                  <Select
                    value={null}
                    onValueChange={(status) => {
                      if (status) move(status as KpiStatus);
                    }}
                    disabled={changeStatus.isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a status" />
                    </SelectTrigger>
                    <SelectContent>
                      {NEXT_STATUSES[kpi.status].map((status) => (
                        <SelectItem key={status} value={status}>
                          {statusLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
