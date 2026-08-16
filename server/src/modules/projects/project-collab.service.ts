import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { notification_type_enum } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { attachUsers } from '../../common/helpers/user-lookup.helper';
import { type JwtPayload } from '../../common/types/jwt-payload.type';
import { CreateMessageDto } from './dto/message/create-message.dto';
import { CreateOutcomeDto } from './dto/outcome/create-outcome.dto';

/**
 * Whether a `project_members.role` value may write to the project.
 *
 * OBSERVER exists for stakeholders who need visibility without participation,
 * so it never writes. A caller with no membership row arrives here as
 * `undefined` and is refused the same way, which is why this takes the role
 * rather than a boolean somebody computed upstream. The column is a VarChar and
 * not an enum, so an unrecognised value is refused too.
 */
export function canWrite(role: string | null | undefined): boolean {
  return role === 'PROJECT_LEAD' || role === 'CO_LEAD' || role === 'MEMBER';
}

@Injectable()
export class ProjectCollabService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly gateway: NotificationsGateway,
  ) {}

  /**
   * The project message thread, oldest first, with each author resolved.
   *
   * Throws ForbiddenException for an observer or a non-member. The thread is
   * the one part of a project an observer cannot read: visibility is
   * company-wide, but a conversation is participation.
   *
   * ponytail: the most recent 200 messages and no cursor. A thread that
   * outgrows that wants keyset pagination on `(project_id, created_at)`, which
   * the index already supports.
   */
  async listMessages(projectId: string, userId: string) {
    await this.assertWriter(projectId, userId);

    const rows = await this.prisma.project_messages.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    return attachUsers(this.prisma, rows.reverse(), ['user_id']);
  }

  /**
   * Post to the thread, push it to the `project:<id>` room, and notify the
   * other members who can read it.
   *
   * Nothing goes to `project_activity_logs`. Chat is conversation and the
   * activity log is the trail somebody skims to find who moved the deadline;
   * merging them makes the trail unskimmable.
   *
   * Throws ForbiddenException for an observer or a non-member. Notification
   * delivery is best effort and never rolls back the message.
   */
  async createMessage(
    projectId: string,
    dto: CreateMessageDto,
    user: JwtPayload,
  ) {
    await this.assertWriter(projectId, user.sub);

    const row = await this.prisma.project_messages.create({
      data: {
        project_id: projectId,
        user_id: user.sub,
        content: dto.content,
      },
    });

    const enriched = await attachUsers(this.prisma, [row], ['user_id']);
    const message = enriched[0] ?? row;

    this.gateway.projectMessageAdded(projectId, message);

    const members = await this.prisma.project_members.findMany({
      where: { project_id: projectId },
      select: { user_id: true, role: true },
    });

    await this.notifications.notifyMany(
      members
        .filter((m) => m.user_id !== user.sub && canWrite(m.role))
        .map((m) => ({
          recipientId: m.user_id,
          type: notification_type_enum.PROJECT_MESSAGE,
          title: 'New project message',
          message: `${user.fullName ?? user.username} posted in the project thread`,
          entityType: 'project' as const,
          entityId: projectId,
        })),
    );

    return message;
  }

  /**
   * The TRY / FAILURE / OUTCOME log, grouped by type, newest first within each.
   *
   * Grouped rather than flat because each type has its own affordance on the
   * page. A flat list with an `entry_type` column is the shape that quietly
   * turns failures into a status on a comment, which is the thing this table
   * exists to prevent.
   *
   * Open to every internal reader, since project visibility is company-wide.
   * Throws NotFoundException if the project does not exist or is deleted.
   */
  async listOutcomes(projectId: string) {
    const project = await this.prisma.projects.findFirst({
      where: { id: projectId, deleted_at: null },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const rows = await this.prisma.project_outcomes.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: 'desc' },
    });
    const entries = await attachUsers(this.prisma, rows, ['logged_by_id']);

    return {
      TRY: entries.filter((e) => e.entry_type === 'TRY'),
      FAILURE: entries.filter((e) => e.entry_type === 'FAILURE'),
      OUTCOME: entries.filter((e) => e.entry_type === 'OUTCOME'),
    };
  }

  /**
   * Record a TRY, a FAILURE, or an OUTCOME, and log it to the activity trail in
   * the same transaction.
   *
   * There is no update and no delete path anywhere in this service. These
   * entries are the project's permanent knowledge, and a failure that can be
   * edited away later stops being worth writing down in the first place.
   *
   * Throws ForbiddenException for an observer or a non-member.
   */
  async createOutcome(
    projectId: string,
    dto: CreateOutcomeDto,
    user: JwtPayload,
  ) {
    await this.assertWriter(projectId, user.sub);

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.project_outcomes.create({
        data: {
          project_id: projectId,
          entry_type: dto.entry_type,
          content: dto.content,
          logged_by_id: user.sub,
        },
      });

      await tx.project_activity_logs.create({
        data: {
          project_id: projectId,
          actor_id: user.sub,
          action_type: 'OUTCOME_LOGGED',
          description: `Logged a ${dto.entry_type}`,
        },
      });

      return created;
    });

    const enriched = await attachUsers(this.prisma, [row], ['logged_by_id']);
    return enriched[0] ?? row;
  }

  /**
   * The participation gate: reads `project_members.role` from the database and
   * refuses observers and non-members alike.
   *
   * The role is never taken from the request. A client that sends its own idea
   * of its membership is ignored, which is the whole reason this is a query and
   * not a claim on the JWT.
   *
   * Throws ForbiddenException. A missing project produces the same 403 as a
   * missing membership row, because from outside the two are the same answer.
   *
   * depends on ProjectsService.assertMember, feat/projects-core. That helper
   * does the project-exists half of this. When it lands, either call it here
   * before the role read, or have it return the member row and delete this.
   */
  private async assertWriter(projectId: string, userId: string) {
    const member = await this.prisma.project_members.findUnique({
      where: {
        project_id_user_id: { project_id: projectId, user_id: userId },
      },
      select: { role: true },
    });

    if (!canWrite(member?.role)) {
      throw new ForbiddenException(
        'Only project members can post here. Observers have read access only.',
      );
    }
  }
}
