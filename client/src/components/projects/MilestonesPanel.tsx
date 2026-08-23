'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/api/users';
import type { Milestone, MilestonePayload, MilestoneStatus } from '@/api/projects';
import { useCreateMilestone, useDeleteMilestone, useUpdateMilestone } from '@/hooks/useProjects';
import { compactPayload, milestoneSchema, type MilestoneFormData } from '@/lib/projectValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Chip, daysUntil, fmtDate, userName } from '@/components/projects/ProjectMeta';
import { Plus, Trash2 } from 'lucide-react';

const milestoneChip: Record<MilestoneStatus, string> = {
  PLANNED: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  DONE: 'bg-green-100 text-green-700',
  MISSED: 'bg-red-100 text-red-700',
};

const statuses: MilestoneStatus[] = ['PLANNED', 'IN_PROGRESS', 'DONE', 'MISSED'];

/** The project timeline. Overdue milestones are flagged here, not in a separate report. */
export function MilestonesPanel({
  projectId,
  milestones,
  isLoading,
  canManage,
}: {
  projectId: string;
  milestones: Milestone[];
  isLoading?: boolean;
  canManage: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const createMilestone = useCreateMilestone(projectId);
  const updateMilestone = useUpdateMilestone(projectId);
  const deleteMilestone = useDeleteMilestone(projectId);

  const { data: userPage } = useQuery({
    queryKey: ['users', { limit: 200 }],
    queryFn: () => usersApi.getUsers({ limit: 200 }),
    enabled: canManage,
  });
  const users = Array.isArray(userPage) ? userPage : (userPage?.data ?? []);

  const form = useForm<MilestoneFormData>({
    resolver: zodResolver(milestoneSchema),
    defaultValues: { name: '', description: '', owner_id: '', start_date: '', due_date: '', status: 'PLANNED' },
  });

  const onAdd = async (values: MilestoneFormData) => {
    await createMilestone.mutateAsync(compactPayload(values) as MilestonePayload);
    form.reset();
    setShowAdd(false);
  };

  if (isLoading) {
    return <div className="py-12 text-center text-gray-500">Loading milestones...</div>;
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button
            variant={showAdd ? 'outline' : 'default'}
            className={showAdd ? '' : 'gap-2 bg-green-600 hover:bg-green-700'}
            onClick={() => setShowAdd(!showAdd)}
          >
            {showAdd ? (
              'Cancel'
            ) : (
              <>
                <Plus size={16} />
                Add milestone
              </>
            )}
          </Button>
        </div>
      )}

      {showAdd && canManage && (
        <form onSubmit={form.handleSubmit(onAdd)} className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
              <Input {...form.register('name')} placeholder="Milestone name" />
              {form.formState.errors.name && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Description</label>
              <textarea
                {...form.register('description')}
                rows={2}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Owner</label>
              <select {...form.register('owner_id')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
              <select {...form.register('status')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Start date</label>
              <Input type="date" {...form.register('start_date')} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Due date</label>
              <Input type="date" {...form.register('due_date')} />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={createMilestone.isPending} className="bg-green-600 hover:bg-green-700">
              {createMilestone.isPending ? 'Adding...' : 'Add milestone'}
            </Button>
          </div>
        </form>
      )}

      {milestones.length === 0 ? (
        <div className="rounded-lg bg-gray-50 py-16 text-center">
          <p className="text-gray-500">No milestones yet</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {milestones.map((milestone) => {
            const overdue = milestone.status !== 'DONE' && (daysUntil(milestone.due_date) ?? 1) < 0;
            return (
              <div key={milestone.id} className="flex items-start gap-4 px-4 py-3 transition-colors hover:bg-gray-50">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{milestone.name}</p>
                    <Chip className={milestoneChip[milestone.status] ?? 'bg-gray-100 text-gray-700'}>
                      {milestone.status.replace(/_/g, ' ')}
                    </Chip>
                    {overdue && <Chip className="bg-red-100 text-red-700">Overdue</Chip>}
                  </div>
                  {milestone.description && <p className="mt-0.5 text-xs text-gray-500">{milestone.description}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span>{milestone.owner_id_user ? userName(milestone.owner_id_user) : 'Unassigned'}</span>
                    <span>
                      {fmtDate(milestone.start_date)} to {fmtDate(milestone.due_date)}
                    </span>
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <select
                      value={milestone.status}
                      onChange={(event) =>
                        updateMilestone.mutate({
                          milestoneId: milestone.id,
                          payload: { status: event.target.value as MilestoneStatus },
                        })
                      }
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => deleteMilestone.mutate(milestone.id)}
                      className="text-gray-400 transition-colors hover:text-red-600"
                      title="Delete milestone"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
