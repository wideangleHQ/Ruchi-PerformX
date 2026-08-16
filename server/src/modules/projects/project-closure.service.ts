import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  notification_type_enum,
  project_status_enum,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { ProjectsService } from './projects.service';
import { CreateClosureReportDto } from './dto/closure/create-closure-report.dto';

/**
 * The two ProjectsService methods this file leans on, written down as an
 * interface because feat/projects-core lands them in parallel. The class stays
 * the injection token, so there is still one ProjectsService in the container.
 *
 * depends on feat/projects-core
 */
export interface ProjectsCore {
  /** Throws ForbiddenException unless the caller leads or co-leads the project. */
  assertLeadOrCoLead(projectId: string, userId: string): Promise<void>;
  /** Throws BadRequestException when the lifecycle does not allow the move. */
  assertTransition(
    from: project_status_enum,
    to: project_status_enum,
  ): void | Promise<void>;
}

type ProjectAudience = {
  id: string;
  title: string;
  lead_id: string;
  co_lead_id: string | null;
};

@Injectable()
export class ProjectClosureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(ProjectsService) private readonly projects: ProjectsCore,
  ) {}

  /**
   * Files the closure report for a project and tells everyone attached to it.
   *
   * There is no review step: the report is the record, not a submission waiting
   * on the MD. Completing the project is a separate call, so a Lead can file the
   * report and close in two clicks or leave it filed and close later.
   *
   * Throws ForbiddenException unless the caller is the Lead or Co-Lead,
   * NotFoundException when the project is gone, and ConflictException on a
   * second submission. The unique constraint on `project_id` is what makes the
   * second submission safe under a race, not the read above it.
   */
  async submit(
    projectId: string,
    dto: CreateClosureReportDto,
    user: JwtPayload,
  ) {
    await this.projects.assertLeadOrCoLead(projectId, user.sub);

    const project = await this.prisma.projects.findFirst({
      where: { id: projectId, deleted_at: null },
      select: { id: true, title: true, lead_id: true, co_lead_id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const written = await this.prisma
      .$transaction([
        this.prisma.project_closure_reports.create({
          data: {
            project_id: projectId,
            executive_summary: dto.executiveSummary,
            objective: dto.objective,
            final_outcome: dto.finalOutcome,
            achievements: dto.achievements ?? null,
            failures: dto.failures ?? null,
            learnings: dto.learnings ?? null,
            kpi_results: dto.kpiResults ?? null,
            recommendations: dto.recommendations ?? null,
            attachments: dto.attachments ?? [],
            submitted_by_id: user.sub,
          },
        }),
        this.prisma.project_activity_logs.create({
          data: {
            project_id: projectId,
            actor_id: user.sub,
            action_type: 'CLOSURE_SUBMITTED',
            description: 'Closure report submitted',
          },
        }),
      ])
      .catch((err: unknown) => {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          throw new ConflictException(
            'This project already has a closure report',
          );
        }
        throw err;
      });

    await this.notifyAudience(
      project,
      user.sub,
      'PROJECT_CLOSURE_SUBMITTED',
      'Closure report submitted',
      `The closure report for "${project.title}" has been filed.`,
    );

    return written[0];
  }

  /**
   * The closure report, readable by anyone who can read the project.
   *
   * Throws NotFoundException while the project is still open and nothing has
   * been filed, which is the normal case rather than an error condition.
   */
  async find(projectId: string) {
    const report = await this.prisma.project_closure_reports.findUnique({
      where: { project_id: projectId },
    });
    if (!report) {
      throw new NotFoundException(
        'No closure report has been submitted for this project',
      );
    }
    return report;
  }

  /**
   * Moves the project to COMPLETED.
   *
   * Throws ForbiddenException unless the caller is the Lead or Co-Lead,
   * NotFoundException when the project is gone, and BadRequestException when
   * no closure report exists or the current status cannot reach COMPLETED.
   * Leaves `health` alone: the sweep owns that column and a completed project
   * keeps the health it finished with.
   */
  async close(projectId: string, user: JwtPayload) {
    await this.projects.assertLeadOrCoLead(projectId, user.sub);

    const project = await this.prisma.projects.findFirst({
      where: { id: projectId, deleted_at: null },
      select: {
        id: true,
        title: true,
        status: true,
        lead_id: true,
        co_lead_id: true,
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const report = await this.prisma.project_closure_reports.findUnique({
      where: { project_id: projectId },
      select: { id: true },
    });
    if (!report) {
      throw new BadRequestException(
        'A closure report has to be submitted before the project can be completed',
      );
    }

    await this.projects.assertTransition(
      project.status,
      project_status_enum.COMPLETED,
    );

    const written = await this.prisma.$transaction([
      this.prisma.projects.update({
        // The status guard sits in the where clause, so two clicks on Close
        // cannot both win. See p1_conventions.md.
        where: { id: projectId, status: project.status },
        data: {
          status: project_status_enum.COMPLETED,
          closed_at: new Date(),
          updated_at: new Date(),
        },
      }),
      this.prisma.project_activity_logs.create({
        data: {
          project_id: projectId,
          actor_id: user.sub,
          action_type: 'STATUS_CHANGED',
          description: `Status changed from ${project.status} to ${project_status_enum.COMPLETED}`,
        },
      }),
    ]);

    await this.notifyAudience(
      project,
      user.sub,
      'PROJECT_CLOSED',
      'Project closed',
      `"${project.title}" has been marked complete.`,
    );

    return written[0];
  }

  /**
   * Notifies everyone attached to the project except whoever caused the event.
   *
   * Observers are included on purpose: closure is the one event somebody who
   * never posted a message still wants in their bell.
   */
  private async notifyAudience(
    project: ProjectAudience,
    actorId: string,
    type: notification_type_enum,
    title: string,
    message: string,
  ) {
    const members = await this.prisma.project_members.findMany({
      where: { project_id: project.id },
      select: { user_id: true },
    });

    const recipients = new Set([
      project.lead_id,
      ...(project.co_lead_id ? [project.co_lead_id] : []),
      ...members.map((m) => m.user_id),
    ]);
    recipients.delete(actorId);

    await this.notifications.notifyMany(
      [...recipients].map((recipientId) => ({
        recipientId,
        type,
        title,
        message,
        entityType: 'project' as const,
        entityId: project.id,
      })),
    );
  }
}
