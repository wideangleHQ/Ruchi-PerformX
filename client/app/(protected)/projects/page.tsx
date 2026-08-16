'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/api/users';
import type { ProjectFilters } from '@/api/projects';
import { useProjects } from '@/hooks/useProjects';
import { ProjectList } from '@/components/projects/ProjectList';
import { isDueThisWeek, isOverdue } from '@/components/projects/ProjectMeta';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Filter, Plus, X } from 'lucide-react';

const statuses = ['DRAFT', 'PLANNED', 'ACTIVE', 'ON_HOLD', 'AT_RISK', 'COMPLETED', 'CANCELLED', 'ARCHIVED'];
const healths = ['ON_TRACK', 'AT_RISK', 'DELAYED'];
const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

type Toggle = 'MINE' | 'OVERDUE' | 'DUE_THIS_WEEK';

export default function ProjectsPage() {
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [health, setHealth] = useState('');
  const [priority, setPriority] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [leadId, setLeadId] = useState('');
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [toggles, setToggles] = useState<Toggle[]>([]);

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => usersApi.getDepartments(),
  });
  const { data: leadOptions } = useQuery({
    queryKey: ['users', { limit: 200 }],
    queryFn: () => usersApi.getUsers({ limit: 200 }),
  });
  const leads = Array.isArray(leadOptions) ? leadOptions : (leadOptions?.data ?? []);

  const filters: ProjectFilters = {
    search: search || undefined,
    status: (status as ProjectFilters['status']) || undefined,
    health: (health as ProjectFilters['health']) || undefined,
    priority: (priority as ProjectFilters['priority']) || undefined,
    departmentId: departmentId || undefined,
    leadId: leadId || undefined,
    category: category || undefined,
    from: from || undefined,
    to: to || undefined,
  };

  const mineOnly = toggles.includes('MINE');
  const { data: projects = [], isLoading } = useProjects(filters, mineOnly);

  // ponytail: overdue and due-this-week are derived from `deadline` rather than
  // sent as query params, so the directory does not depend on filter keys the
  // API has not declared. Move them server-side if the list ever paginates.
  const visible = useMemo(() => {
    let rows = projects;
    if (toggles.includes('OVERDUE')) rows = rows.filter(isOverdue);
    if (toggles.includes('DUE_THIS_WEEK')) rows = rows.filter(isDueThisWeek);
    return rows;
  }, [projects, toggles]);

  const toggle = (value: Toggle) =>
    setToggles((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setHealth('');
    setPriority('');
    setDepartmentId('');
    setLeadId('');
    setCategory('');
    setFrom('');
    setTo('');
    setToggles([]);
  };

  const hasFilters = Boolean(
    search || status || health || priority || departmentId || leadId || category || from || to || toggles.length,
  );

  const toggleClass = (value: Toggle) =>
    `rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
      toggles.includes(value)
        ? 'border-green-500 bg-green-50 text-green-700'
        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
    }`;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="mt-1 text-gray-500">Cross-department workspaces, their health and their deadlines</p>
        </div>
        <Link href="/projects/new">
          <Button className="gap-2 bg-green-600 hover:bg-green-700">
            <Plus size={18} />
            New Project
          </Button>
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pr-8"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            hasFilters ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Filter size={16} />
          Filters
          {hasFilters && <span className="ml-1 rounded-full bg-green-600 px-1.5 py-0.5 text-xs text-white">on</span>}
        </button>

        <button onClick={() => toggle('MINE')} className={toggleClass('MINE')}>
          My Projects
        </button>
        <button onClick={() => toggle('OVERDUE')} className={toggleClass('OVERDUE')}>
          Overdue
        </button>
        <button onClick={() => toggle('DUE_THIS_WEEK')} className={toggleClass('DUE_THIS_WEEK')}>
          Due This Week
        </button>

        {hasFilters && (
          <button onClick={clearFilters} className="text-sm text-gray-500 underline hover:text-gray-700">
            Clear all
          </button>
        )}
      </div>

      {showFilters && (
        <div className="mb-4 flex flex-wrap gap-4 rounded-lg border border-gray-200 bg-white p-4">
          <div className="min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All Statuses</option>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {value.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-gray-600">Health</label>
            <select
              value={health}
              onChange={(event) => setHealth(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All Health</option>
              {healths.map((value) => (
                <option key={value} value={value}>
                  {value.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-gray-600">Priority</label>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All Priorities</option>
              {priorities.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-gray-600">Department</label>
            <select
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All Departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-gray-600">Project Lead</label>
            <select
              value={leadId}
              onChange={(event) => setLeadId(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All Leads</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-gray-600">Category</label>
            <Input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Any category" />
          </div>

          <div className="min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-gray-600">Deadline from</label>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>

          <div className="min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-gray-600">Deadline to</label>
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
        </div>
      )}

      <ProjectList projects={visible} isLoading={isLoading} />
    </div>
  );
}
