'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/api/users';
import type {
  ChecklistItem,
  Milestone,
  Project,
  ProjectKpi,
  ProjectMemberRole,
  SuccessCriterion,
} from '@/api/projects';
import { useAddProjectMember, useCreateSuccessCriterion, useRemoveProjectMember } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KpiRows } from '@/components/projects/KpisPanel';
import { Chip, daysUntil, fmtDate, userName } from '@/components/projects/ProjectMeta';
import { CheckCircle2, Circle, Plus, X } from 'lucide-react';

const roles: ProjectMemberRole[] = ['MEMBER', 'OBSERVER', 'CO_LEAD', 'PROJECT_LEAD'];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/** The dashboard fields: everything needed to answer "is this project okay". */
export function OverviewPanel({
  project,
  checklist,
  milestones,
  kpis,
  criteria,
  canManage,
}: {
  project: Project;
  checklist: ChecklistItem[];
  milestones: Milestone[];
  kpis: ProjectKpi[];
  criteria: SuccessCriterion[];
  canManage: boolean;
}) {
  const [memberId, setMemberId] = useState('');
  const [memberRole, setMemberRole] = useState<ProjectMemberRole>('MEMBER');
  const [criterion, setCriterion] = useState('');

  const addMember = useAddProjectMember(project.id);
  const removeMember = useRemoveProjectMember(project.id);
  const addCriterion = useCreateSuccessCriterion(project.id);

  const { data: userPage } = useQuery({
    queryKey: ['users', { limit: 200 }],
    queryFn: () => usersApi.getUsers({ limit: 200 }),
    enabled: canManage,
  });
  const users = Array.isArray(userPage) ? userPage : (userPage?.data ?? []);

  const overdueItems = checklist.filter((item) => !item.is_done && (daysUntil(item.due_date) ?? 1) < 0);
  const overdueMilestones = milestones.filter(
    (milestone) => milestone.status !== 'DONE' && (daysUntil(milestone.due_date) ?? 1) < 0,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card title="About">
          <p className="whitespace-pre-wrap text-sm text-gray-700">{project.description}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-gray-500">Type</p>
              <p className="mt-1 text-sm text-gray-900">{project.project_type ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Category</p>
              <p className="mt-1 text-sm text-gray-900">{project.category ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Start date</p>
              <p className="mt-1 text-sm text-gray-900">{fmtDate(project.start_date)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Created</p>
              <p className="mt-1 text-sm text-gray-900">{fmtDate(project.created_at)}</p>
            </div>
          </div>
          {project.tags?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <Chip key={tag} className="bg-gray-100 text-gray-700">
                  {tag}
                </Chip>
              ))}
            </div>
          )}
        </Card>

        <Card title="KPI performance">
          <KpiRows kpis={kpis} />
        </Card>

        <Card title="Success criteria">
          {criteria.length === 0 ? (
            <p className="text-sm text-gray-500">No success criteria recorded</p>
          ) : (
            <ul className="space-y-2">
              {criteria.map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-sm text-gray-800">
                  {item.is_met ? (
                    <CheckCircle2 size={16} className="mt-0.5 text-green-600" />
                  ) : (
                    <Circle size={16} className="mt-0.5 text-gray-300" />
                  )}
                  <span>{item.criterion}</span>
                </li>
              ))}
            </ul>
          )}

          {canManage && (
            <div className="mt-4 flex gap-2">
              <Input
                value={criterion}
                onChange={(event) => setCriterion(event.target.value)}
                placeholder="Add a measurable criterion"
              />
              <Button
                type="button"
                variant="outline"
                disabled={!criterion.trim() || addCriterion.isPending}
                onClick={async () => {
                  await addCriterion.mutateAsync({ criterion: criterion.trim() });
                  setCriterion('');
                }}
                className="gap-2"
              >
                <Plus size={14} />
                Add
              </Button>
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Attention">
          <div className="space-y-2 text-sm">
            <p className={overdueItems.length ? 'font-semibold text-red-600' : 'text-gray-600'}>
              {overdueItems.length} overdue checklist item{overdueItems.length === 1 ? '' : 's'}
            </p>
            <p className={overdueMilestones.length ? 'font-semibold text-red-600' : 'text-gray-600'}>
              {overdueMilestones.length} overdue milestone{overdueMilestones.length === 1 ? '' : 's'}
            </p>
            <p className="text-gray-600">
              {milestones.filter((milestone) => milestone.status === 'DONE').length} of {milestones.length} milestones
              done
            </p>
          </div>
        </Card>

        <Card title="Team">
          <div className="space-y-2">
            {(project.members ?? []).map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-gray-900">{userName(member.user_id_user)}</p>
                  <p className="text-xs text-gray-500">{member.role.replace(/_/g, ' ')}</p>
                </div>
                {canManage && member.role !== 'PROJECT_LEAD' && (
                  <button
                    type="button"
                    onClick={() => removeMember.mutate(member.user_id)}
                    className="text-gray-400 transition-colors hover:text-red-600"
                    title="Remove member"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
            {(project.members ?? []).length === 0 && <p className="text-sm text-gray-500">No members yet</p>}
          </div>

          {canManage && (
            <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
              <select
                value={memberId}
                onChange={(event) => setMemberId(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select a person</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName}
                  </option>
                ))}
              </select>
              <select
                value={memberRole}
                onChange={(event) => setMemberRole(event.target.value as ProjectMemberRole)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={!memberId || addMember.isPending}
                onClick={async () => {
                  await addMember.mutateAsync({ user_id: memberId, role: memberRole });
                  setMemberId('');
                }}
              >
                <Plus size={14} />
                Add member
              </Button>
              <p className="text-xs text-gray-500">
                Anyone can join from any department — the picker lists every active user.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
