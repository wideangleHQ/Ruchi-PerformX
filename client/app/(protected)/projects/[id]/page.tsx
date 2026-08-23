'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import type { ProjectStatus } from '@/api/projects';
import {
  useProject,
  useProjectActivity,
  useProjectChecklist,
  useProjectKpis,
  useProjectMessages,
  useProjectMilestones,
  useProjectOutcomes,
  useProjectRoom,
  useProjectSuccessCriteria,
  useUpdateProject,
} from '@/hooks/useProjects';
import { ProjectSummaryHeader } from '@/components/projects/ProjectSummaryHeader';
import { OverviewPanel } from '@/components/projects/OverviewPanel';
import { ChecklistPanel } from '@/components/projects/ChecklistPanel';
import { MilestonesPanel } from '@/components/projects/MilestonesPanel';
import { KpisPanel } from '@/components/projects/KpisPanel';
import { MessagesPanel } from '@/components/projects/MessagesPanel';
import { OutcomesPanel } from '@/components/projects/OutcomesPanel';
import { ActivityPanel } from '@/components/projects/ActivityPanel';
import { ArrowLeft, FileCheck, Pencil } from 'lucide-react';

const panels = [
  { key: 'overview', label: 'Overview' },
  { key: 'checklist', label: 'Checklist' },
  { key: 'milestones', label: 'Milestones' },
  { key: 'kpis', label: 'KPIs' },
  { key: 'messages', label: 'Messages' },
  { key: 'outcomes', label: 'Try / Failure / Outcome' },
  { key: 'activity', label: 'Activity' },
] as const;

type PanelKey = (typeof panels)[number]['key'];

const statuses: ProjectStatus[] = [
  'DRAFT',
  'PLANNED',
  'ACTIVE',
  'ON_HOLD',
  'AT_RISK',
  'CANCELLED',
  'ARCHIVED',
];

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { user } = useAuth();
  const [panel, setPanel] = useState<PanelKey>('overview');

  useProjectRoom(projectId);

  const { data: project, isLoading } = useProject(projectId);
  const { data: checklist = [], isLoading: checklistLoading } = useProjectChecklist(projectId);
  const { data: milestones = [], isLoading: milestonesLoading } = useProjectMilestones(projectId);
  const { data: kpis = [], isLoading: kpisLoading } = useProjectKpis(projectId);
  const { data: criteria = [] } = useProjectSuccessCriteria(projectId);

  const isLead = Boolean(user && project && (user.id === project.lead_id || user.id === project.co_lead_id));
  const membership = project?.members?.find((member) => member.user_id === user?.id);
  const canManage = isLead;
  const canParticipate = isLead || Boolean(membership && membership.role !== 'OBSERVER');

  const { data: messages = [], isLoading: messagesLoading } = useProjectMessages(
    projectId,
    panel === 'messages' && canParticipate,
  );
  const { data: outcomes = [], isLoading: outcomesLoading } = useProjectOutcomes(projectId, panel === 'outcomes');
  const { data: activity = [], isLoading: activityLoading } = useProjectActivity(projectId, panel === 'activity');

  const updateProject = useUpdateProject(projectId);

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

  const done = checklist.filter((item) => item.is_done).length;

  return (
    <div>
      <Link
        href="/projects"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft size={16} />
        Back to Projects
      </Link>

      <ProjectSummaryHeader
        project={project}
        done={project.checklist_done ?? done}
        total={project.checklist_total ?? checklist.length}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1">
          {panels.map((item) => (
            <button
              key={item.key}
              onClick={() => setPanel(item.key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                panel === item.key ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {canManage && project.status !== 'COMPLETED' && (
            <select
              value={project.status}
              onChange={(event) => updateProject.mutate({ status: event.target.value as ProjectStatus })}
              disabled={updateProject.isPending}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-green-500"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          )}
          {canManage && (
            <Link
              href={`/projects/${projectId}/edit`}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Pencil size={16} />
              Edit
            </Link>
          )}
          <Link
            href={`/projects/${projectId}/closure`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <FileCheck size={16} />
            Closure report
          </Link>
        </div>
      </div>

      {updateProject.isError && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-800">
          That status change was rejected. The lifecycle only allows some moves, and COMPLETED needs a closure
          report.
        </div>
      )}

      {panel === 'overview' && (
        <OverviewPanel
          project={project}
          checklist={checklist}
          milestones={milestones}
          kpis={kpis}
          criteria={criteria}
          canManage={canManage}
        />
      )}

      {panel === 'checklist' && (
        <ChecklistPanel
          projectId={projectId}
          items={checklist}
          isLoading={checklistLoading}
          currentUserId={user?.id}
          canManage={canManage}
          canParticipate={canParticipate}
        />
      )}

      {panel === 'milestones' && (
        <MilestonesPanel
          projectId={projectId}
          milestones={milestones}
          isLoading={milestonesLoading}
          canManage={canManage}
        />
      )}

      {panel === 'kpis' && (
        <KpisPanel projectId={projectId} kpis={kpis} isLoading={kpisLoading} canManage={canManage} />
      )}

      {panel === 'messages' && (
        <MessagesPanel
          projectId={projectId}
          messages={messages}
          isLoading={messagesLoading}
          canParticipate={canParticipate}
        />
      )}

      {panel === 'outcomes' && (
        <OutcomesPanel
          projectId={projectId}
          outcomes={outcomes}
          isLoading={outcomesLoading}
          canParticipate={canParticipate}
        />
      )}

      {panel === 'activity' && <ActivityPanel entries={activity} isLoading={activityLoading} />}
    </div>
  );
}
