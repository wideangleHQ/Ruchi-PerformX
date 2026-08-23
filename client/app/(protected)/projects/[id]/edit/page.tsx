'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useDeleteProject, useProject, useUpdateProject } from '@/hooks/useProjects';
import { ProjectEditForm } from '@/components/projects/ProjectEditForm';
import { Button } from '@/components/ui/button';

/**
 * Editing and deleting a project. Both endpoints existed with no screen in
 * front of them.
 *
 * The two are not the same permission. `PATCH` is the Lead or the Co-Lead;
 * `DELETE` is the Lead or the MD. So the delete panel is gated separately
 * rather than assuming whoever reached this page may do both.
 */
export default function EditProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = typeof params.id === 'string' ? params.id : '';
  const { user } = useAuth();

  const { data: project, isLoading } = useProject(projectId);
  const updateProject = useUpdateProject(projectId);
  const deleteProject = useDeleteProject(projectId);
  const [confirming, setConfirming] = useState(false);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-gray-600">Loading project...</div>;
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

  const canEdit = user?.id === project.lead_id || user?.id === project.co_lead_id;
  const canDelete = user?.id === project.lead_id || user?.role === 'MD';

  if (!canEdit) {
    return (
      <div className="space-y-4">
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          {project.title}
        </Link>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          Only the project Lead and Co-Lead can edit this project.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/projects/${projectId}`}
          className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          {project.title}
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Edit Project</h1>
        <p className="mt-1 text-gray-600">
          Status moves from the project page. Milestones, KPIs and success criteria have their own tabs.
        </p>
      </div>

      <div className="max-w-3xl">
        <ProjectEditForm
          project={project}
          isSubmitting={updateProject.isPending}
          error={
            updateProject.isError
              ? 'Could not save this project. Check the fields and try again.'
              : null
          }
          onCancel={() => router.push(`/projects/${projectId}`)}
          onSubmit={(payload) =>
            updateProject.mutate(payload, {
              onSuccess: () => router.push(`/projects/${projectId}`),
            })
          }
        />

        {canDelete && (
          <div className="mt-8 rounded-xl border border-rose-200 bg-rose-50 p-5">
            <h2 className="text-sm font-semibold text-rose-900">Delete this project</h2>
            <p className="mt-1 text-sm text-rose-700">
              The project stops appearing in the directory and on every dashboard. Its checklist,
              milestones and messages are kept, and the activity log records who deleted it.
            </p>

            {deleteProject.isError && (
              <p className="mt-3 text-sm text-rose-800">
                That delete was refused. Only the project Lead or the MD can delete a project.
              </p>
            )}

            {confirming ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-rose-900">
                  Delete {project.project_code}?
                </span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirming(false)}
                  disabled={deleteProject.isPending}
                >
                  Keep it
                </Button>
                <Button
                  type="button"
                  className="bg-rose-600 hover:bg-rose-700"
                  disabled={deleteProject.isPending}
                  onClick={() =>
                    deleteProject.mutate(undefined, {
                      onSuccess: () => router.push('/projects'),
                    })
                  }
                >
                  {deleteProject.isPending ? 'Deleting...' : 'Yes, delete it'}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="mt-4 gap-2 border-rose-300 text-rose-700 hover:bg-rose-100"
                onClick={() => setConfirming(true)}
              >
                <Trash2 size={14} />
                Delete project
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
