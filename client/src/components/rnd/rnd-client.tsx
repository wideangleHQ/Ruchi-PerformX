'use client';

import { useMemo, useState } from 'react';
import {
  Clock3,
  FlaskConical,
  Layers,
  MailWarning,
  Plus,
  RefreshCcw,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { CreateRndReportPayload, RndReport } from '@/api/rnd';
import {
  useCreateRndReport,
  useRndCategories,
  useRndMembership,
  useRndReports,
  useUpdateRndReport,
} from '@/hooks/useRnd';
import { RndReportHistory } from '@/components/rnd/report-history';
import { RndReportFormDialog } from '@/components/rnd/report-form-dialog';
import { RndReportDetailsSheet } from '@/components/rnd/report-details-sheet';
import { RndTeamPanel } from '@/components/rnd/rnd-team-panel';

const OVERSIGHT_ROLES = ['MD', 'EA', 'PA'];

function errorMessage(error: unknown) {
  const response = (error as { response?: { data?: { message?: string | string[] } } })
    .response;
  const message = response?.data?.message;
  return Array.isArray(message) ? message[0] : message || 'Something went wrong';
}

/**
 * One page for the module. The MD office gets every category plus the roster
 * tab; a team member gets the categories they research and the submit button.
 * Anyone else never reaches here, because the sidebar item is gated on
 * GET /rnd/team/me.
 */
export function RndClient() {
  const { user } = useAuth();
  const isOversight = !!user && OVERSIGHT_ROLES.includes(user.role);

  const { data: membership } = useRndMembership();
  const { data: reports = [], isLoading, isError, refetch } = useRndReports();
  const { data: categories = [] } = useRndCategories();
  const createMutation = useCreateRndReport();
  const updateMutation = useUpdateRndReport();

  const [tab, setTab] = useState<'history' | 'team'>('history');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RndReport | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const isMember = membership?.isMember === true;

  const stats = useMemo(
    () => ({
      reports: reports.length,
      categories: new Set(reports.map((report) => report.category)).size,
      unread: reports.filter((report) => !report.md_viewed_at).length,
    }),
    [reports],
  );

  const currentDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  const submit = async (values: CreateRndReportPayload) => {
    setFormError(null);
    try {
      if (editing) {
        // The category is not on UpdateRndReportDto, and forbidNonWhitelisted
        // turns sending it anyway into a 400.
        await updateMutation.mutateAsync({
          id: editing.id,
          data: {
            product_area: values.product_area,
            findings: values.findings,
            recommendation: values.recommendation,
            supporting_data: values.supporting_data,
          },
        });
      } else {
        await createMutation.mutateAsync(values);
      }
      setFormOpen(false);
      setEditing(null);
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  const cards = [
    { label: 'Reports', value: stats.reports, icon: FlaskConical },
    { label: 'Research Categories', value: stats.categories, icon: Layers },
    {
      label: isOversight ? 'Unread Reports' : 'Awaiting MD Review',
      value: stats.unread,
      icon: MailWarning,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
            <FlaskConical size={14} />
            Innovation and R&D
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Research and Development
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isOversight
              ? 'Every research thread across the company, newest first.'
              : 'Your research threads, kept comparable report to report.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <Clock3 size={16} className="text-green-600" />
            <span>{currentDate}</span>
          </div>
          {isMember ? (
            <Button
              type="button"
              className="gap-2 bg-green-600 hover:bg-green-700"
              onClick={() => {
                setFormError(null);
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus size={16} />
              Submit Report
            </Button>
          ) : null}
        </div>
      </div>

      {isOversight ? (
        <div
          className="flex w-fit items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
          role="tablist"
          aria-label="R&D view"
        >
          {(
            [
              ['history', 'Research History'],
              ['team', 'R&D Team'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === key
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {tab === 'team' && isOversight ? (
        <RndTeamPanel />
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-700">
                  <Icon size={22} />
                </div>
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                  {value.toLocaleString()}
                </p>
              </div>
            ))}
          </section>

          {!isMember && !isOversight ? (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
              <Users size={16} className="text-green-600" />
              You are not on the R&D team, so you can read but not submit. The MD
              office adds members.
            </div>
          ) : null}

          {isError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
              <div className="font-semibold">Failed to load R&D reports.</div>
              <Button variant="outline" className="mt-3" onClick={() => refetch()}>
                <RefreshCcw size={14} className="mr-2" />
                Retry
              </Button>
            </div>
          ) : (
            <RndReportHistory
              reports={reports}
              isLoading={isLoading}
              isOversight={isOversight}
              onOpen={(report) => setDetailsId(report.id)}
            />
          )}
        </>
      )}

      <RndReportFormDialog
        open={formOpen}
        report={editing}
        categories={categories}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          setFormError(null);
        }}
        onSubmit={submit}
        isPending={createMutation.isPending || updateMutation.isPending}
        error={formError}
      />

      <RndReportDetailsSheet
        reportId={detailsId}
        currentUserId={user?.id}
        onClose={() => setDetailsId(null)}
        onEdit={(report) => {
          setDetailsId(null);
          setEditing(report);
          setFormError(null);
          setFormOpen(true);
        }}
      />
    </div>
  );
}
