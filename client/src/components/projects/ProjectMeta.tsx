'use client';

import type { Project, ProjectHealth, ProjectMember, ProjectStatus, ProjectUserRef } from '@/api/projects';

export const statusChip: Record<ProjectStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PLANNED: 'bg-blue-100 text-blue-700',
  ACTIVE: 'bg-green-100 text-green-700',
  ON_HOLD: 'bg-orange-100 text-orange-700',
  AT_RISK: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-purple-100 text-purple-700',
  CANCELLED: 'bg-red-100 text-red-700',
  ARCHIVED: 'bg-gray-200 text-gray-800',
};

export const healthChip: Record<ProjectHealth, string> = {
  ON_TRACK: 'bg-green-100 text-green-700',
  AT_RISK: 'bg-amber-100 text-amber-800',
  DELAYED: 'bg-red-100 text-red-700',
};

export const priorityChip: Record<string, string> = {
  LOW: 'bg-blue-100 text-blue-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
};

/** A resolved person, or a placeholder when the id no longer maps to a user. */
export function userName(user?: ProjectUserRef | null) {
  return user?.full_name ?? 'Unknown';
}

export function fmtDate(date?: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(date?: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Whole days from today to `date`. Negative once the date has passed. */
export function daysUntil(date?: string | null) {
  if (!date) return null;
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return null;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - startOfToday.getTime()) / 86_400_000);
}

const SETTLED: ProjectStatus[] = ['COMPLETED', 'CANCELLED', 'ARCHIVED'];

/** A project is overdue when its deadline has passed and it has not been settled. */
export function isOverdue(project: Pick<Project, 'deadline' | 'status'>) {
  const days = daysUntil(project.deadline);
  return days !== null && days < 0 && !SETTLED.includes(project.status);
}

export function isDueThisWeek(project: Pick<Project, 'deadline' | 'status'>) {
  const days = daysUntil(project.deadline);
  return days !== null && days >= 0 && days <= 7 && !SETTLED.includes(project.status);
}

export function checklistProgress(done?: number, total?: number) {
  const completed = done ?? 0;
  const count = total ?? 0;
  return { done: completed, total: count, pct: count === 0 ? 0 : Math.round((completed / count) * 100) };
}

export function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>{children}</span>
  );
}

export function StatusChip({ status }: { status: ProjectStatus }) {
  return <Chip className={statusChip[status] ?? 'bg-gray-100 text-gray-700'}>{status.replace(/_/g, ' ')}</Chip>;
}

export function HealthChip({ health }: { health: ProjectHealth }) {
  return <Chip className={healthChip[health] ?? 'bg-gray-100 text-gray-700'}>{health.replace(/_/g, ' ')}</Chip>;
}

export function PriorityChip({ priority }: { priority: string }) {
  return <Chip className={priorityChip[priority] ?? 'bg-gray-100 text-gray-700'}>{priority}</Chip>;
}

export function DeadlineLabel({ project }: { project: Pick<Project, 'deadline' | 'status'> }) {
  const overdue = isOverdue(project);
  const days = daysUntil(project.deadline);

  return (
    <span className={`whitespace-nowrap ${overdue ? 'font-semibold text-red-600' : 'text-gray-600'}`}>
      {fmtDate(project.deadline)}
      {overdue && ` (${Math.abs(days ?? 0)}d overdue)`}
    </span>
  );
}

export function ProgressBar({ done, total }: { done?: number; total?: number }) {
  const { pct, done: completed, total: count } = checklistProgress(done, total);

  return (
    <div className="min-w-[110px]">
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span className="font-medium">
          {completed}/{count}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-gray-200">
        <div className="h-1.5 rounded-full bg-green-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function MemberAvatars({ members = [], max = 4 }: { members?: ProjectMember[]; max?: number }) {
  if (members.length === 0) return <span className="text-xs italic text-gray-400">No members</span>;

  const shown = members.slice(0, max);
  const rest = members.length - shown.length;

  return (
    <div className="flex items-center -space-x-2">
      {shown.map((member) => {
        const name = userName(member.user_id_user);
        return (
          <span
            key={member.id}
            title={`${name} · ${member.role.replace(/_/g, ' ')}`}
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-green-100 text-[11px] font-semibold text-green-700"
          >
            {initials(name)}
          </span>
        );
      })}
      {rest > 0 && (
        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-[11px] font-semibold text-gray-600">
          +{rest}
        </span>
      )}
    </div>
  );
}
