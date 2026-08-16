'use client';

import Link from 'next/link';
import type { Project } from '@/api/projects';
import {
  DeadlineLabel,
  HealthChip,
  MemberAvatars,
  PriorityChip,
  ProgressBar,
  StatusChip,
  userName,
} from '@/components/projects/ProjectMeta';

interface ProjectListProps {
  projects: Project[];
  isLoading?: boolean;
}

const columns = ['Project', 'Lead', 'Members', 'Checklist', 'Health', 'Status', 'Priority', 'Deadline'];

export function ProjectList({ projects, isLoading }: ProjectListProps) {
  if (isLoading) {
    return <div className="py-12 text-center text-gray-500">Loading projects...</div>;
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-lg bg-gray-50 py-16 text-center">
        <p className="text-gray-500">No projects found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {projects.map((project) => (
            <tr key={project.id} className="transition-colors hover:bg-gray-50">
              <td className="max-w-[240px] px-3 py-3">
                <Link
                  href={`/projects/${project.id}`}
                  className="font-medium text-gray-900 line-clamp-2 hover:text-green-700 hover:underline"
                >
                  {project.title}
                </Link>
                <div className="mt-0.5 text-xs text-gray-400">{project.project_code}</div>
              </td>
              <td className="max-w-[140px] truncate px-3 py-3 text-gray-600">{userName(project.lead_id_user)}</td>
              <td className="px-3 py-3">
                <MemberAvatars members={project.members} />
              </td>
              <td className="px-3 py-3">
                <ProgressBar done={project.checklist_done} total={project.checklist_total} />
              </td>
              <td className="px-3 py-3">
                <HealthChip health={project.health} />
              </td>
              <td className="px-3 py-3">
                <StatusChip status={project.status} />
              </td>
              <td className="px-3 py-3">
                <PriorityChip priority={project.priority} />
              </td>
              <td className="px-3 py-3">
                <DeadlineLabel project={project} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t px-4 py-2 text-xs text-gray-400">
        {projects.length} project{projects.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
