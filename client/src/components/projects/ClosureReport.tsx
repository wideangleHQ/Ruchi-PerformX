'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ClosureReport as ClosureReportRecord, ClosureReportPayload, Project } from '@/api/projects';
import { useCloseProject, useSubmitClosureReport } from '@/hooks/useProjects';
import { closureReportSchema, compactPayload, type ClosureReportFormData } from '@/lib/projectValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fmtDateTime, userName } from '@/components/projects/ProjectMeta';
import { Plus, X } from 'lucide-react';

const fields: Array<{ name: keyof ClosureReportFormData; label: string; rows: number; required?: boolean }> = [
  { name: 'executiveSummary', label: 'Executive Summary', rows: 4, required: true },
  { name: 'objective', label: 'Objective', rows: 3, required: true },
  { name: 'finalOutcome', label: 'Final Outcome', rows: 4, required: true },
  { name: 'achievements', label: 'Achievements', rows: 3 },
  { name: 'failures', label: 'Failures', rows: 3 },
  { name: 'learnings', label: 'Learnings', rows: 3 },
  { name: 'kpiResults', label: 'KPI Results', rows: 3 },
  { name: 'recommendations', label: 'Recommendations', rows: 3 },
];

const readOnlyFields: Array<{ key: keyof ClosureReportRecord; label: string }> = [
  { key: 'executive_summary', label: 'Executive Summary' },
  { key: 'objective', label: 'Objective' },
  { key: 'final_outcome', label: 'Final Outcome' },
  { key: 'achievements', label: 'Achievements' },
  { key: 'failures', label: 'Failures' },
  { key: 'learnings', label: 'Learnings' },
  { key: 'kpi_results', label: 'KPI Results' },
  { key: 'recommendations', label: 'Recommendations' },
];

/**
 * Reachable by the Lead and Co-Lead while the project is ACTIVE. Once a report
 * exists this becomes the read-only record and the only remaining action is
 * moving the project to COMPLETED.
 */
export function ClosureReport({
  project,
  report,
  canManage,
}: {
  project: Project;
  report: ClosureReportRecord | null;
  canManage: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<string[]>([]);
  const submitReport = useSubmitClosureReport(project.id);
  const closeProject = useCloseProject(project.id);

  const form = useForm<ClosureReportFormData>({
    resolver: zodResolver(closureReportSchema),
    defaultValues: {
      executiveSummary: '',
      objective: project.objective,
      finalOutcome: '',
      achievements: '',
      failures: '',
      learnings: '',
      kpiResults: '',
      recommendations: '',
    },
  });

  const onSubmit = async (values: ClosureReportFormData) => {
    setError(null);
    try {
      await submitReport.mutateAsync(
        compactPayload({ ...values, attachments: attachments.filter(Boolean) }) as ClosureReportPayload,
      );
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
      setError(Array.isArray(message) ? message.join(', ') : (message ?? 'Failed to submit closure report'));
    }
  };

  if (report) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Closure Report</h2>
            <p className="text-xs text-gray-500">
              Submitted by {userName(report.submitted_by_id_user)} on {fmtDateTime(report.submitted_at)}
            </p>
          </div>

          <div className="mt-4 space-y-4">
            {readOnlyFields.map((field) => (
              <div key={field.key}>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{field.label}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900">
                  {(report[field.key] as string | null) || '—'}
                </p>
              </div>
            ))}

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Attachments</p>
              {report.attachments?.length ? (
                <ul className="mt-1 space-y-1">
                  {report.attachments.map((url) => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-green-700 hover:underline"
                      >
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-gray-900">None</p>
              )}
            </div>
          </div>
        </div>

        {canManage && project.status !== 'COMPLETED' && (
          <div className="flex justify-end">
            <Button
              onClick={() => closeProject.mutate()}
              disabled={closeProject.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {closeProject.isPending ? 'Completing...' : 'Mark project completed'}
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-gray-600">Only the Project Lead or Co-Lead can submit the closure report.</p>
      </div>
    );
  }

  if (project.status !== 'ACTIVE') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-gray-600">
          The closure report opens while the project is ACTIVE. This one is {project.status.replace(/_/g, ' ')}.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">{error}</div>}

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        {fields.map((field) => (
          <div key={field.name}>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              {field.label}
              {field.required && <span className="ml-1 text-red-500">*</span>}
            </label>
            <textarea
              {...form.register(field.name)}
              rows={field.rows}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            />
            {form.formState.errors[field.name] && (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors[field.name]?.message as string}</p>
            )}
          </div>
        ))}

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Attachments</label>
          {/* ponytail: links rather than uploads, because the closure record stores
              string URLs. Swap for the shared upload flow when the API grows one. */}
          <div className="space-y-2">
            {attachments.map((url, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={url}
                  onChange={(event) =>
                    setAttachments(attachments.map((item, i) => (i === index ? event.target.value : item)))
                  }
                  placeholder="Link to a document"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAttachments(attachments.filter((_, i) => i !== index))}
                >
                  <X size={14} />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" className="gap-2" onClick={() => setAttachments([...attachments, ''])}>
              <Plus size={14} />
              Add attachment link
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={form.formState.isSubmitting} className="bg-green-600 hover:bg-green-700">
          {form.formState.isSubmitting ? 'Submitting...' : 'Submit closure report'}
        </Button>
      </div>
    </form>
  );
}
