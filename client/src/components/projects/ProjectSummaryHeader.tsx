'use client';

import type { Project } from '@/api/projects';
import {
  DeadlineLabel,
  HealthChip,
  MemberAvatars,
  PriorityChip,
  ProgressBar,
  StatusChip,
  isOverdue,
  userName,
} from '@/components/projects/ProjectMeta';
import { AlertTriangle } from 'lucide-react';

/**
 * Progress, health and deadline stay on screen whichever panel is open. This is
 * the strip that answers "is this project okay" without opening a tab.
 */
export function ProjectSummaryHeader({
  project,
  done,
  total,
}: {
  project: Project;
  done: number;
  total: number;
}) {
  const overdue = isOverdue(project);

  return (
    <div className="sticky top-0 z-10 mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>
            <span className="text-xs text-gray-400">{project.project_code}</span>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">{project.objective}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={project.status} />
          <HealthChip health={project.health} />
          <PriorityChip priority={project.priority} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Checklist progress</p>
          <div className="mt-2">
            <ProgressBar done={done} total={total} />
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Deadline</p>
          <p className="mt-2 flex items-center gap-2 text-sm">
            <DeadlineLabel project={project} />
            {overdue && <AlertTriangle size={14} className="text-red-600" />}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Lead</p>
          <p className="mt-2 text-sm text-gray-900">{userName(project.lead_id_user)}</p>
          {project.co_lead_id_user && (
            <p className="text-xs text-gray-500">Co-Lead: {userName(project.co_lead_id_user)}</p>
          )}
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Members</p>
          <div className="mt-2">
            <MemberAvatars members={project.members} max={6} />
          </div>
        </div>
      </div>
    </div>
  );
}
