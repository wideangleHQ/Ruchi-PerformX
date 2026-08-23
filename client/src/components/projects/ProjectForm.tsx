'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/api/users';
import type { CreateProjectPayload, KpiPayload, MilestonePayload } from '@/api/projects';
import { useCreateProject } from '@/hooks/useProjects';
import { compactPayload, createProjectSchema, type CreateProjectFormData } from '@/lib/projectValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';

interface MilestoneDraft {
  name: string;
  due_date: string;
}

interface KpiDraft {
  metric: string;
  target: string;
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span>
          <span className="text-sm font-semibold text-gray-900">{title}</span>
          <span className="ml-2 text-xs text-gray-400">Optional</span>
          <span className="mt-0.5 block text-xs text-gray-500">{hint}</span>
        </span>
        {open ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
      </button>
      {open && <div className="border-t border-slate-200 px-5 py-4">{children}</div>}
    </div>
  );
}

/**
 * Creation form. Only the essentials are up front; milestones, KPIs and success
 * criteria are collapsed extras that `useCreateProject` posts to their own
 * endpoints once the project exists.
 */
export function ProjectForm() {
  const router = useRouter();
  const createProject = useCreateProject();
  const [error, setError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([]);
  const [kpis, setKpis] = useState<KpiDraft[]>([]);
  const [criteria, setCriteria] = useState<string[]>([]);

  const { data: users = [] } = useQuery({
    queryKey: ['users', { active: true }],
    queryFn: () => usersApi.getUsers({ active: true }),
  });

  const form = useForm<CreateProjectFormData>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      title: '',
      project_type: '',
      category: '',
      priority: 'MEDIUM',
      objective: '',
      description: '',
      start_date: '',
      deadline: '',
      co_lead_id: '',
    },
  });

  const addTag = () => {
    const value = tagInput.trim();
    if (!value || tags.includes(value)) return;
    setTags([...tags, value]);
    setTagInput('');
  };

  const onSubmit = async (values: CreateProjectFormData) => {
    setError(null);
    try {
      const project = await createProject.mutateAsync({
        project: compactPayload({ ...values, tags }) as CreateProjectPayload,
        milestones: milestones
          .filter((item) => item.name.trim())
          .map((item) => compactPayload({ name: item.name.trim(), due_date: item.due_date }) as MilestonePayload),
        kpis: kpis
          .filter((item) => item.metric.trim())
          .map((item) => compactPayload({ metric: item.metric.trim(), target: item.target }) as KpiPayload),
        successCriteria: criteria.map((item) => item.trim()).filter(Boolean),
      });

      router.push(`/projects/${project.id}`);
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
      setError(Array.isArray(message) ? message.join(', ') : (message ?? 'Failed to create project'));
    }
  };

  const fieldError = (name: keyof CreateProjectFormData) => form.formState.errors[name]?.message;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">{error}</div>}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">Project Name</label>
            <Input {...form.register('title')} placeholder="What is this project called?" />
            {fieldError('title') && <p className="mt-1 text-xs text-red-600">{fieldError('title')}</p>}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Project Type</label>
            <Input {...form.register('project_type')} placeholder="e.g. Product launch" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Priority</label>
            <select
              {...form.register('priority')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">Objective</label>
            <Input {...form.register('objective')} placeholder="One line on what success looks like" />
            {fieldError('objective') && <p className="mt-1 text-xs text-red-600">{fieldError('objective')}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">Description</label>
            <textarea
              {...form.register('description')}
              rows={4}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            />
            {fieldError('description') && <p className="mt-1 text-xs text-red-600">{fieldError('description')}</p>}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Deadline</label>
            <Input type="date" {...form.register('deadline')} />
            {fieldError('deadline') && <p className="mt-1 text-xs text-red-600">{fieldError('deadline')}</p>}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Start Date</label>
            <Input type="date" {...form.register('start_date')} />
          </div>
        </div>
      </div>

      <Section title="Team and classification" hint="Co-Lead, category and tags. All editable later.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Co-Lead</label>
            <select
              {...form.register('co_lead_id')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">No Co-Lead</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Category</label>
            <Input {...form.register('category')} placeholder="e.g. Marketing" />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">Tags</label>
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
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
                  >
                    {tag}
                    <button type="button" onClick={() => setTags(tags.filter((item) => item !== tag))}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section title="Milestones" hint="Sketch the timeline now or build it on the project page.">
        <div className="space-y-2">
          {milestones.map((milestone, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={milestone.name}
                onChange={(event) =>
                  setMilestones(milestones.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)))
                }
                placeholder="Milestone name"
              />
              <Input
                type="date"
                value={milestone.due_date}
                onChange={(event) =>
                  setMilestones(
                    milestones.map((item, i) => (i === index ? { ...item, due_date: event.target.value } : item)),
                  )
                }
                className="max-w-[180px]"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setMilestones(milestones.filter((_, i) => i !== index))}
              >
                <X size={14} />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => setMilestones([...milestones, { name: '', due_date: '' }])}
          >
            <Plus size={14} />
            Add milestone
          </Button>
        </div>
      </Section>

      <Section title="KPIs" hint="Leave empty for projects that do not need numbers.">
        <div className="space-y-2">
          {kpis.map((kpi, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={kpi.metric}
                onChange={(event) => setKpis(kpis.map((item, i) => (i === index ? { ...item, metric: event.target.value } : item)))}
                placeholder="Metric"
              />
              <Input
                value={kpi.target}
                onChange={(event) => setKpis(kpis.map((item, i) => (i === index ? { ...item, target: event.target.value } : item)))}
                placeholder="Target"
                className="max-w-[180px]"
              />
              <Button type="button" variant="outline" onClick={() => setKpis(kpis.filter((_, i) => i !== index))}>
                <X size={14} />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" className="gap-2" onClick={() => setKpis([...kpis, { metric: '', target: '' }])}>
            <Plus size={14} />
            Add KPI
          </Button>
        </div>
      </Section>

      <Section title="Success criteria" hint="Each one is checked off individually at closure.">
        <div className="space-y-2">
          {criteria.map((criterion, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={criterion}
                onChange={(event) => setCriteria(criteria.map((item, i) => (i === index ? event.target.value : item)))}
                placeholder="Measurable criterion"
              />
              <Button type="button" variant="outline" onClick={() => setCriteria(criteria.filter((_, i) => i !== index))}>
                <X size={14} />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" className="gap-2" onClick={() => setCriteria([...criteria, ''])}>
            <Plus size={14} />
            Add criterion
          </Button>
        </div>
      </Section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push('/projects')}>
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting} className="bg-green-600 hover:bg-green-700">
          {form.formState.isSubmitting ? 'Creating...' : 'Create Project'}
        </Button>
      </div>
    </form>
  );
}
