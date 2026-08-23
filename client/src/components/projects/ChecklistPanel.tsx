'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/api/users';
import type { ChecklistItem, ChecklistItemPayload } from '@/api/projects';
import { useCreateChecklistItem, useDeleteChecklistItem, useUpdateChecklistItem } from '@/hooks/useProjects';
import { checklistItemSchema, compactPayload, type ChecklistItemFormData } from '@/lib/projectValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PriorityChip, daysUntil, fmtDate, userName } from '@/components/projects/ProjectMeta';
import { Plus, Trash2 } from 'lucide-react';

interface ChecklistPanelProps {
  projectId: string;
  items: ChecklistItem[];
  isLoading?: boolean;
  currentUserId?: string;
  canManage: boolean;
  canParticipate: boolean;
}

/**
 * The Lead and Co-Lead own the list. Everyone else can only tick an item that is
 * assigned to them, which is what keeps progress computed rather than typed.
 */
export function ChecklistPanel({
  projectId,
  items,
  isLoading,
  currentUserId,
  canManage,
  canParticipate,
}: ChecklistPanelProps) {
  const [showAdd, setShowAdd] = useState(false);
  const createItem = useCreateChecklistItem(projectId);
  const updateItem = useUpdateChecklistItem(projectId);
  const deleteItem = useDeleteChecklistItem(projectId);

  const { data: userPage } = useQuery({
    queryKey: ['users', { limit: 200 }],
    queryFn: () => usersApi.getUsers({ limit: 200 }),
    enabled: canManage,
  });
  const users = Array.isArray(userPage) ? userPage : (userPage?.data ?? []);

  const form = useForm<ChecklistItemFormData>({
    resolver: zodResolver(checklistItemSchema),
    defaultValues: { title: '', description: '', assigned_to_id: '', due_date: '' },
  });

  const onAdd = async (values: ChecklistItemFormData) => {
    await createItem.mutateAsync(compactPayload(values) as ChecklistItemPayload);
    form.reset();
    setShowAdd(false);
  };

  const canTick = (item: ChecklistItem) =>
    canManage || (canParticipate && item.assigned_to_id === currentUserId);

  if (isLoading) {
    return <div className="py-12 text-center text-gray-500">Loading checklist...</div>;
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
                Add item
              </>
            )}
          </Button>
        </div>
      )}

      {showAdd && canManage && (
        <form onSubmit={form.handleSubmit(onAdd)} className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Title</label>
              <Input {...form.register('title')} placeholder="What needs doing?" />
              {form.formState.errors.title && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.title.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Assignee</label>
              <select
                {...form.register('assigned_to_id')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Due date</label>
              <Input type="date" {...form.register('due_date')} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Priority</label>
              <select
                {...form.register('priority')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">None</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={createItem.isPending} className="bg-green-600 hover:bg-green-700">
              {createItem.isPending ? 'Adding...' : 'Add to checklist'}
            </Button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <div className="rounded-lg bg-gray-50 py-16 text-center">
          <p className="text-gray-500">No checklist items yet</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {items.map((item) => {
            const overdue = !item.is_done && (daysUntil(item.due_date) ?? 1) < 0;
            return (
              <div key={item.id} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={item.is_done}
                  disabled={!canTick(item) || updateItem.isPending}
                  onChange={(event) =>
                    updateItem.mutate({ itemId: item.id, payload: { is_done: event.target.checked } })
                  }
                  className="mt-1 h-4 w-4 rounded border-gray-300 accent-green-600 disabled:opacity-40"
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${item.is_done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {item.title}
                  </p>
                  {item.description && <p className="mt-0.5 text-xs text-gray-500">{item.description}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span>{item.assigned_to_id_user ? userName(item.assigned_to_id_user) : 'Unassigned'}</span>
                    <span className={overdue ? 'font-semibold text-red-600' : ''}>
                      {item.due_date ? `Due ${fmtDate(item.due_date)}` : 'No due date'}
                      {overdue && ' · overdue'}
                    </span>
                    {item.priority && <PriorityChip priority={item.priority} />}
                  </div>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => deleteItem.mutate(item.id)}
                    className="text-gray-400 transition-colors hover:text-red-600"
                    title="Delete item"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
