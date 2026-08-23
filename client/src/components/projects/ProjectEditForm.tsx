'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, X } from 'lucide-react';
import type { Project, UpdateProjectPayload } from '@/api/projects';
import { useRndMembership } from '@/hooks/useRnd';
import { useDepartmentOptions, useUserOptions } from '@/components/pickers';
import { updateProjectSchema, type UpdateProjectFormData } from '@/lib/projectValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

function Field({
  label,
  error,
  children,
  wide,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

const selectClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:ring-1 focus:ring-green-500';

/**
 * Edits an existing project. The creation form is a wizard with collapsible
 * sections that post to their own endpoints afterwards; this is a flat list of
 * the fields `PATCH /projects/:id` accepts, so the two are separate components
 * rather than one with a mode flag.
 *
 * Status is not here. It moves through the transition table from the control on
 * the detail page, and a select that silently refuses half its options belongs
 * next to the thing it describes.
 *
 * ponytail: two forms for one entity. Merge them if a third caller appears, or
 * if the field lists converge.
 */
export function ProjectEditForm({
  project,
  isSubmitting,
  error,
  onSubmit,
  onCancel,
}: {
  project: Project;
  isSubmitting?: boolean;
  error?: string | null;
  onSubmit: (payload: UpdateProjectPayload) => void;
  onCancel: () => void;
}) {
  const departments = useDepartmentOptions();
  const users = useUserOptions();
  const { data: rnd } = useRndMembership();
  const [tags, setTags] = useState<string[]>(project.tags ?? []);
  const [tagInput, setTagInput] = useState('');

  const form = useForm<UpdateProjectFormData>({
    resolver: zodResolver(updateProjectSchema),
    defaultValues: {
      title: project.title,
      project_type: project.project_type ?? '',
      category: project.category ?? '',
      priority: project.priority,
      objective: project.objective,
      description: project.description,
      start_date: project.start_date?.slice(0, 10) ?? '',
      deadline: project.deadline?.slice(0, 10) ?? '',
      co_lead_id: project.co_lead_id ?? '',
      department_id: '',
      is_rnd: project.is_rnd,
      rnd_category: project.rnd_category ?? '',
    },
  });

  const canClassifyRnd = rnd?.isMember === true;
  const isRnd = form.watch('is_rnd') === true;

  const addTag = () => {
    const value = tagInput.trim();
    if (!value || tags.includes(value)) return;
    setTags([...tags, value]);
    setTagInput('');
  };

  /**
   * Blanks become undefined so an untouched field is left alone, except
   * `co_lead_id`, where a blank is the caller clearing the co-lead and has to
   * reach the server as null.
   */
  const submit = (values: UpdateProjectFormData) => {
    const payload: UpdateProjectPayload = {
      title: values.title,
      objective: values.objective,
      description: values.description,
      priority: values.priority,
      tags,
      co_lead_id: values.co_lead_id ? values.co_lead_id : null,
    };
    if (values.project_type) payload.project_type = values.project_type;
    if (values.category) payload.category = values.category;
    if (values.start_date) payload.start_date = values.start_date;
    if (values.deadline) payload.deadline = values.deadline;
    if (values.department_id) payload.department_id = values.department_id;
    if (canClassifyRnd && values.is_rnd !== project.is_rnd) payload.is_rnd = values.is_rnd;
    if (canClassifyRnd && values.rnd_category) payload.rnd_category = values.rnd_category;

    onSubmit(payload);
  };

  const message = (name: keyof UpdateProjectFormData) => form.formState.errors[name]?.message;

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
      {error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">{error}</div>}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Project Name" error={message('title')} wide>
            <Input {...form.register('title')} />
          </Field>

          <Field label="Type">
            <Input {...form.register('project_type')} placeholder="e.g. Product launch" />
          </Field>

          <Field label="Category">
            <Input {...form.register('category')} placeholder="e.g. Marketing" />
          </Field>

          <Field label="Priority" error={message('priority')}>
            <select {...form.register('priority')} className={selectClass}>
              {priorities.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Department">
            <select {...form.register('department_id')} className={selectClass}>
              <option value="">Unchanged</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Objective" error={message('objective')} wide>
            <textarea
              {...form.register('objective')}
              rows={2}
              className={selectClass}
              placeholder="What is this project for?"
            />
          </Field>

          <Field label="Description" error={message('description')} wide>
            <textarea {...form.register('description')} rows={4} className={selectClass} />
          </Field>

          <Field label="Start Date">
            <Input type="date" {...form.register('start_date')} />
          </Field>

          <Field label="Deadline">
            <Input type="date" {...form.register('deadline')} />
          </Field>

          <Field label="Co-Lead" wide>
            <select {...form.register('co_lead_id')} className={selectClass}>
              <option value="">No co-lead</option>
              {users
                .filter((person) => person.id !== project.lead_id)
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName}
                  </option>
                ))}
            </select>
          </Field>

          <Field label="Tags" wide>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add a tag and press Enter"
              />
              <Button type="button" variant="outline" onClick={addTag}>
                <Plus size={14} />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter((item) => item !== tag))}
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Field>

          {canClassifyRnd && (
            <>
              <Field label="R&D project" wide>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" {...form.register('is_rnd')} />
                  Counts towards the R&D programme
                </label>
              </Field>
              {isRnd && (
                <Field label="R&D Category" wide>
                  <Input {...form.register('rnd_category')} placeholder="e.g. Process improvement" />
                </Field>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
