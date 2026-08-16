'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useProject, useProjectClosureReport } from '@/hooks/useProjects';
import { ClosureReport } from '@/components/projects/ClosureReport';
import { ArrowLeft } from 'lucide-react';

export default function ProjectClosurePage() {
  const params = useParams();
  const projectId = params.id as string;
  const { user } = useAuth();

  const { data: project, isLoading } = useProject(projectId);
  const { data: report, isLoading: reportLoading } = useProjectClosureReport(projectId);

  if (isLoading || reportLoading) {
    return <div className="flex items-center justify-center py-12 text-gray-600">Loading closure report...</div>;
  }

  if (!project) {
    return (
      <div className="rounded-lg bg-red-50 p-6">
        <p className="text-red-700">Project not found</p>
        <Link href="/projects" className="mt-4 inline-block text-sm text-red-600 hover:text-red-700">
          Back to projects
        </Link>
      </div>
    );
  }

  const canManage = Boolean(user && (user.id === project.lead_id || user.id === project.co_lead_id));

  return (
    <div>
      <div className="mb-8">
        <Link
          href={`/projects/${projectId}`}
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Back to {project.title}
        </Link>

        <h1 className="text-3xl font-bold text-gray-900">Closure Report</h1>
        <p className="mt-2 text-gray-600">
          {report
            ? 'Submitted and read-only. This is the permanent record of how the project ended.'
            : 'What happened, what worked, what did not, and what the next project should know.'}
        </p>
      </div>

      <div className="max-w-3xl">
        <ClosureReport project={project} report={report ?? null} canManage={canManage} />
      </div>
    </div>
  );
}
