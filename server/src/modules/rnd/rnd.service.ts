import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, notification_type_enum, role_enum } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { attachUsers } from '../../common/helpers/user-lookup.helper';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { NotificationsService } from '../notifications/notifications.service';

import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { CreateRndReportDto } from './dto/create-rnd-report.dto';
import { UpdateRndReportDto } from './dto/update-rnd-report.dto';
import {
  CategoryScope,
  OVERSIGHT_ROLES,
  visibleCategories,
} from './rnd-visibility';

@Injectable()
export class RndService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * The company-wide R&D roster, newest invitation first, with the member and
   * the person who added them resolved to names.
   */
  async listTeam() {
    const rows = await this.prisma.rnd_team_members.findMany({
      orderBy: { added_at: 'desc' },
    });
    return attachUsers(this.prisma, rows, ['user_id', 'added_by_id']);
  }

  /**
   * Whether one user is on the R&D roster. The client asks this for itself to
   * decide whether the R&D nav item renders; the service asks it before every
   * report submission.
   */
  async isMember(userId: string) {
    const row = await this.prisma.rnd_team_members.findUnique({
      where: { user_id: userId },
      select: { id: true },
    });
    return row !== null;
  }

  /**
   * Invite a user onto the roster and tell them about it.
   *
   * Throws `NotFoundException` when the user does not exist or is soft deleted,
   * and `BadRequestException` for a vendor or for someone already on the team.
   * There are no foreign keys on `rnd_team_members`, so the user check here is
   * the only thing stopping a roster row pointing at nobody.
   */
  async addTeamMember(dto: AddTeamMemberDto, actor: JwtPayload) {
    const target = await this.prisma.users.findFirst({
      where: { id: dto.userId, deleted_at: null },
      select: { id: true, role: true },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === role_enum.VENDOR) {
      throw new BadRequestException('Vendors cannot join the R&D team');
    }
    if (await this.isMember(target.id)) {
      throw new BadRequestException('Already on the R&D team');
    }

    const row = await this.prisma.rnd_team_members.create({
      data: { user_id: target.id, added_by_id: actor.sub },
    });

    await this.notifications.notify({
      recipientId: target.id,
      type: notification_type_enum.RND_TEAM_ADDED,
      title: 'Added to the R&D team',
      message:
        'You can now submit research reports and read the history of the categories you work in.',
      entityType: 'rnd',
      entityId: row.id,
    });

    return row;
  }

  /**
   * Take a user off the roster. Their reports stay: history is retained per
   * category and there is no delete path for it anywhere in this module.
   *
   * Throws `NotFoundException` when the user was not on the roster.
   */
  async removeTeamMember(userId: string) {
    const { count } = await this.prisma.rnd_team_members.deleteMany({
      where: { user_id: userId },
    });
    if (count === 0) throw new NotFoundException('Not on the R&D team');
    return { removed: true };
  }

  /**
   * Submit a research report and notify the MD office.
   *
   * Throws `ForbiddenException` for a non-member. Membership is checked here
   * rather than through `@Roles` because it is a grant per person, which the
   * JWT role cannot express. That includes the MD: an MD who wants to file
   * research adds themselves to the roster first.
   */
  async createReport(dto: CreateRndReportDto, user: JwtPayload) {
    if (!(await this.isMember(user.sub))) {
      throw new ForbiddenException('Only R&D team members can submit reports');
    }

    const report = await this.prisma.rnd_reports.create({
      data: {
        category: dto.category.trim(),
        product_area: dto.product_area,
        findings: dto.findings,
        recommendation: dto.recommendation,
        supporting_data: dto.supporting_data?.trim() || null,
        project_id: dto.project_id ?? null,
        submitted_by_id: user.sub,
      },
    });

    const oversight = await this.prisma.users.findMany({
      where: {
        role: { in: OVERSIGHT_ROLES },
        deleted_at: null,
        id: { not: user.sub },
      },
      select: { id: true },
    });

    await this.notifications.notifyMany(
      oversight.map((recipient) => ({
        recipientId: recipient.id,
        type: notification_type_enum.RND_REPORT_SUBMITTED,
        title: `New R&D report: ${report.category}`,
        message: `${user.fullName ?? 'A team member'} submitted research on ${report.product_area}.`,
        entityType: 'rnd' as const,
        entityId: report.id,
      })),
    );

    return report;
  }

  /**
   * Every report the caller may read, newest first, with submitter names
   * attached. Returns an empty array rather than throwing for a caller with no
   * research thread, because the R&D page is reachable by anyone the MD has
   * just added and an empty history is the correct first view.
   *
   * ponytail: no pagination. A category holds a handful of reports a month and
   * the client groups the whole list. Add a cursor when one thread passes a few
   * hundred rows.
   */
  async listReports(user: JwtPayload) {
    const scope = await this.scopeFor(user);
    const where = this.whereForScope(scope);
    if (!where) return [];

    const rows = await this.prisma.rnd_reports.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
    return attachUsers(this.prisma, rows, ['submitted_by_id']);
  }

  /**
   * One report in full.
   *
   * Reading it as MD, EA, or PA stamps `md_viewed_at`, which is what closes the
   * submitter's edit window. Access is the same category scope the list uses,
   * so a member never sees a row they cannot open; their own reports are always
   * inside their own scope.
   *
   * Throws `NotFoundException` for an unknown id and `ForbiddenException` for a
   * report outside the caller's thread.
   */
  async findReport(id: string, user: JwtPayload) {
    const report = await this.prisma.rnd_reports.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');

    const scope = await this.scopeFor(user);
    if (scope !== 'ALL' && !scope.includes(report.category)) {
      throw new ForbiddenException('This report is in another research thread');
    }

    const isOversight = OVERSIGHT_ROLES.includes(user.role);
    const seen =
      isOversight && !report.md_viewed_at
        ? await this.prisma.rnd_reports.update({
            where: { id },
            data: { md_viewed_at: new Date() },
          })
        : report;

    const [withUser] = await attachUsers(this.prisma, [seen], [
      'submitted_by_id',
    ]);
    return withUser;
  }

  /**
   * Correct a report before the MD office has read it.
   *
   * The guard is in the `where` clause rather than an `if` above it, so two
   * submits racing each other cannot both pass the check. A zero row result is
   * then explained by a second read: unknown id, someone else's report, or an
   * edit window that has closed.
   *
   * Throws `NotFoundException`, `ForbiddenException`, or `BadRequestException`
   * accordingly.
   */
  async updateReport(id: string, dto: UpdateRndReportDto, user: JwtPayload) {
    const data: Prisma.rnd_reportsUpdateInput = {
      ...(dto.product_area !== undefined && { product_area: dto.product_area }),
      ...(dto.findings !== undefined && { findings: dto.findings }),
      ...(dto.recommendation !== undefined && {
        recommendation: dto.recommendation,
      }),
      ...(dto.supporting_data !== undefined && {
        supporting_data: dto.supporting_data.trim() || null,
      }),
    };
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Nothing to update');
    }

    const { count } = await this.prisma.rnd_reports.updateMany({
      where: { id, submitted_by_id: user.sub, md_viewed_at: null },
      data,
    });

    if (count === 0) {
      const existing = await this.prisma.rnd_reports.findUnique({
        where: { id },
        select: { submitted_by_id: true },
      });
      if (!existing) throw new NotFoundException('Report not found');
      if (existing.submitted_by_id !== user.sub) {
        throw new ForbiddenException('Only the submitter can edit a report');
      }
      throw new BadRequestException(
        'The MD office has already read this report, so it can no longer be edited',
      );
    }

    return this.findReport(id, user);
  }

  /**
   * The category names the caller may read, for the history grouping and the
   * submit form's suggestions. A new member gets an empty list and types the
   * category that starts their thread.
   */
  async listCategories(user: JwtPayload): Promise<string[]> {
    const scope = await this.scopeFor(user);
    if (scope !== 'ALL') return scope;

    const rows = await this.prisma.rnd_reports.findMany({
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return rows.map((row) => row.category);
  }

  /**
   * The caller's category scope, resolved from the roster and their own
   * submissions.
   *
   * ponytail: a member's research thread is the set of categories they have
   * already submitted into. There is no explicit category assignment table and
   * inventing one would need a screen nobody asked for. If the MD ever wants to
   * assign someone a thread before their first report, that table is the
   * upgrade.
   */
  private async scopeFor(user: JwtPayload): Promise<CategoryScope> {
    const isMember = await this.isMember(user.sub);
    const own = isMember
      ? await this.prisma.rnd_reports.findMany({
          where: { submitted_by_id: user.sub },
          select: { category: true },
          distinct: ['category'],
        })
      : [];

    return visibleCategories(
      user.role,
      isMember,
      own.map((row) => row.category),
    );
  }

  /** `null` means the scope matches nothing, which no `where` clause can say. */
  private whereForScope(
    scope: CategoryScope,
  ): Prisma.rnd_reportsWhereInput | null {
    if (scope === 'ALL') return {};
    if (scope.length === 0) return null;
    return { category: { in: scope } };
  }
}
