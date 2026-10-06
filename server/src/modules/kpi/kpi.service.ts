import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  kpi_direction_enum,
  kpi_mode_enum,
  kpi_scope_enum,
  kpi_scoring_method_enum,
  kpi_status_enum,
  notification_type_enum,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { DepartmentScopeService } from '../../common/services/department-scope.service';
import { attachUsers } from '../../common/helpers/user-lookup.helper';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { NotificationsService } from '../notifications/notifications.service';

import { CreateKpiDto } from './dto/create-kpi.dto';
import {
  ChangeKpiStatusDto,
  UpdateKpiDto,
} from './dto/update-kpi.dto';
import {
  CreateKpiMessageDto,
  CreateKpiRevisionDto,
  RecordKpiUpdateDto,
  SetKpiContributionsDto,
} from './dto/kpi-progress.dto';
import {
  AllocationQueryDto,
  KpiFilterDto,
  PsScoreQueryDto,
  ScoreSearchDto,
} from './dto/kpi-query.dto';
import {
  ALLOCATING_STATUSES,
  PERMITTED_ALLOCATION,
  WEIGHT_TOLERANCE,
  acceptsProgress,
  allocation,
  canActOnDepartment,
  fitsAllocation,
  isAuthority,
  isCountable,
  isLegalMove,
  submittedStatus,
} from './kpi-lifecycle';
import { searchUnits } from './kpi-units';
import {
  KpiScoringConfig,
  PsScoreInput,
  binaryAchievement,
  kpiScore,
  milestoneAchievement,
  psScore,
  quantitativeAchievement,
  ratingAchievement,
} from './kpi-scoring';

/**
 * What each measurement mode requires, in one table rather than four branches
 * repeated across create, update, and the update endpoint.
 *
 * The combinations are not arbitrary: a binary outcome has no unit because
 * "completed" is not a quantity, and a rating has no target because the whole
 * point of the mode is that a fair numeric target was not available.
 */
const MODE_RULES: Record<
  kpi_mode_enum,
  {
    methods: kpi_scoring_method_enum[];
    needsTarget: boolean;
    needsDirection: boolean;
    needsMilestones: boolean;
  }
> = {
  QUANTITATIVE: {
    methods: ['DIRECT', 'THRESHOLD'],
    needsTarget: true,
    needsDirection: true,
    needsMilestones: false,
  },
  BINARY: {
    methods: ['DIRECT', 'THRESHOLD'],
    needsTarget: false,
    needsDirection: false,
    needsMilestones: false,
  },
  MILESTONE: {
    methods: ['MILESTONE'],
    needsTarget: false,
    needsDirection: false,
    needsMilestones: true,
  },
  RATING: {
    methods: ['RATING'],
    needsTarget: false,
    needsDirection: false,
    needsMilestones: false,
  },
};

/** `@db.Date` columns are UTC midnight, so DTO strings are parsed as UTC and
 * a target set in IST does not slide a day on a server elsewhere. */
function toDateOnly(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

/** Prisma hands Decimal back as an object; every caller here wants a number. */
function num(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

@Injectable()
export class KpiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentScope: DepartmentScopeService,
    private readonly notifications: NotificationsService,
  ) {}

  // ------------------------------------------------------------ creation

  /**
   * Create a KPI with the status its creator's role earns, and attach its
   * milestones and contribution shares.
   *
   * An authority's KPI lands in PUBLISHED with no approval step, anyone else's
   * in PENDING_APPROVAL, and either in DRAFT when `save_as_draft` is set. An
   * INDIVIDUAL KPI with no owner is the caller's own. One with somebody else as
   * owner is an assignment: MD, EA, and PA may assign to anyone, HOD and
   * Department Controller only inside their departments, and an employee to
   * nobody.
   *
   * Throws `ForbiddenException` for an employee creating anything but their own
   * KPI, or an authority reaching outside their departments. Throws
   * `BadRequestException` when the scope and its target do not agree, when the
   * mode and the scoring method are not a legal pair, when a milestone set does
   * not total 100, when contribution shares exceed 100, or when the weight does
   * not fit the owner's remaining allocation for the period. Throws
   * `NotFoundException` when the owner, department, or project named does not
   * exist.
   */
  async create(dto: CreateKpiDto, user: JwtPayload) {
    const ownerId =
      dto.scope === 'INDIVIDUAL' ? (dto.owner_user_id ?? user.sub) : dto.owner_user_id;
    const shaped: CreateKpiDto = { ...dto, ...(ownerId && { owner_user_id: ownerId }) };
    this.assertScopeShape(shaped);
    this.assertModeShape(dto.mode, dto.scoring_method, dto);

    const ownKpi = dto.scope === 'INDIVIDUAL' && ownerId === user.sub;
    if (!ownKpi && !isAuthority(user.role)) {
      throw new ForbiddenException(
        'You can create your own KPIs. Assigning one to somebody else is for an HOD, a Department Controller, or the MD office.',
      );
    }

    const departmentId = await this.resolveDepartment(shaped);
    if (!ownKpi) {
      const scope = await this.departmentScope.resolveDepartmentScope(user);
      if (!canActOnDepartment(user.role, scope, departmentId)) {
        throw new ForbiddenException('That is outside your department');
      }
    }

    if (dto.project_id) {
      const project = await this.prisma.projects.findUnique({
        where: { id: dto.project_id },
        select: { id: true },
      });
      if (!project) throw new NotFoundException('Project not found');
    }

    const milestones = dto.milestones ?? [];
    if (milestones.length > 0) {
      const total = milestones.reduce((sum, m) => sum + m.weight, 0);
      if (Math.abs(total - 100) > WEIGHT_TOLERANCE) {
        throw new BadRequestException(
          `Milestone weights total ${total}%, they have to total 100%`,
        );
      }
    }
    this.assertShares(dto.contributions ?? []);

    const periodStart = toDateOnly(dto.period_start);
    const periodEnd = toDateOnly(dto.period_end);
    if (periodEnd < periodStart) {
      throw new BadRequestException('The period ends before it starts');
    }

    const status: kpi_status_enum = dto.save_as_draft
      ? 'DRAFT'
      : submittedStatus(user.role);
    if (dto.scope === 'INDIVIDUAL' && ownerId && status !== 'DRAFT') {
      await this.assertAllocation(ownerId, periodStart, periodEnd, dto.weight);
    }

    return this.prisma.$transaction(async (tx) => {
      const kpi = await tx.kpis.create({
        data: {
          scope: dto.scope,
          owner_user_id: ownerId ?? null,
          department_id: departmentId,
          project_id: dto.project_id ?? null,
          name: dto.name,
          description: dto.description ?? null,
          mode: dto.mode,
          unit_label: dto.unit_label ?? null,
          unit_symbol: dto.unit_symbol ?? null,
          target_value: dto.target_value ?? null,
          baseline_value: dto.baseline_value ?? null,
          direction: dto.direction ?? null,
          scoring_method: dto.scoring_method,
          scoring_config: (dto.scoring_config ?? undefined) as Prisma.InputJsonValue,
          weight: dto.weight,
          period: dto.period,
          period_start: periodStart,
          period_end: periodEnd,
          evidence_required: dto.evidence_required ?? false,
          // A rating is meaningless without somebody to give it.
          review_required: dto.mode === 'RATING' ? true : (dto.review_required ?? false),
          status,
          created_by_id: user.sub,
        },
      });

      if (milestones.length > 0) {
        await tx.kpi_milestones.createMany({
          data: milestones.map((milestone, index) => ({
            kpi_id: kpi.id,
            title: milestone.title,
            weight: milestone.weight,
            sequence: index,
          })),
        });
      }

      if (dto.contributions && dto.contributions.length > 0) {
        await tx.kpi_contributions.createMany({
          data: dto.contributions.map((entry) => ({
            kpi_id: kpi.id,
            user_id: entry.user_id,
            share: entry.share,
          })),
        });
      }

      return kpi;
    });
  }

  /**
   * Change a KPI's definition.
   *
   * Its creator may edit it, and so may an authority whose reach covers its
   * department. An authority's edit leaves the status alone. Anyone else's edit
   * to a published KPI sends it back to PENDING_APPROVAL, because the target
   * that was approved is no longer the target. A target or weight change on a
   * published KPI writes a `kpi_revisions` row in the same transaction, so the
   * value it replaced survives.
   *
   * Throws `ForbiddenException` for anyone else, and `BadRequestException` for a
   * DELETED KPI, a period that ends before it starts, a definition that no
   * longer fits its mode, or a weight that no longer fits the owner's
   * allocation.
   */
  async update(id: string, dto: UpdateKpiDto, user: JwtPayload) {
    const kpi = await this.loadKpi(id);
    await this.assertCanManage(kpi, user);
    if (kpi.status === 'DELETED') {
      throw new BadRequestException('A deleted KPI cannot be edited');
    }

    const target = dto.target_value ?? num(kpi.target_value);
    const direction = dto.direction ?? kpi.direction;
    const unit = dto.unit_label ?? kpi.unit_label;
    this.assertModeShape(kpi.mode, kpi.scoring_method, {
      ...(target !== null && { target_value: target }),
      ...(direction !== null && { direction }),
      ...(unit !== null && { unit_label: unit }),
    });

    const periodStart = dto.period_start ? toDateOnly(dto.period_start) : kpi.period_start;
    const periodEnd = dto.period_end ? toDateOnly(dto.period_end) : kpi.period_end;
    if (periodEnd < periodStart) {
      throw new BadRequestException('The period ends before it starts');
    }
    const weight = dto.weight ?? Number(kpi.weight);
    if (kpi.scope === 'INDIVIDUAL' && kpi.owner_user_id && kpi.status !== 'DRAFT') {
      await this.assertAllocation(kpi.owner_user_id, periodStart, periodEnd, weight, kpi.id);
    }

    const status =
      kpi.status === 'PUBLISHED' && !isAuthority(user.role) ? 'PENDING_APPROVAL' : kpi.status;
    const targetMoved =
      dto.target_value !== undefined && dto.target_value !== num(kpi.target_value);
    const weightMoved = dto.weight !== undefined && dto.weight !== Number(kpi.weight);
    const now = new Date();

    const data: Prisma.kpisUpdateInput = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.unit_label !== undefined && { unit_label: dto.unit_label }),
      ...(dto.unit_symbol !== undefined && { unit_symbol: dto.unit_symbol }),
      ...(dto.target_value !== undefined && { target_value: dto.target_value }),
      ...(dto.baseline_value !== undefined && { baseline_value: dto.baseline_value }),
      ...(dto.direction !== undefined && { direction: dto.direction }),
      ...(dto.scoring_config !== undefined && {
        scoring_config: dto.scoring_config as Prisma.InputJsonValue,
      }),
      ...(dto.weight !== undefined && { weight: dto.weight }),
      ...(dto.period !== undefined && { period: dto.period }),
      period_start: periodStart,
      period_end: periodEnd,
      ...(dto.evidence_required !== undefined && {
        evidence_required: dto.evidence_required,
      }),
      ...(dto.review_required !== undefined && {
        review_required: dto.review_required,
      }),
      status,
      updated_at: now,
    };

    return this.prisma.$transaction(async (tx) => {
      if (kpi.status === 'PUBLISHED' && (targetMoved || weightMoved)) {
        await tx.kpi_revisions.create({
          data: {
            kpi_id: kpi.id,
            old_target: kpi.target_value,
            new_target: dto.target_value ?? kpi.target_value,
            old_weight: kpi.weight,
            new_weight: weight,
            effective_from: toDateOnly(now.toISOString()),
            reason: 'Edited on the KPI',
            changed_by_id: user.sub,
          },
        });
      }
      return tx.kpis.update({ where: { id }, data });
    });
  }

  /**
   * Submit a draft, send a pending KPI back, quick approve one, or delete.
   *
   * `kpi-lifecycle.ts` says which moves exist; who may make each depends on
   * whose KPI it is, so that is decided here:
   *
   * - Submitting a draft is for its creator, and goes where their role sends
   *   it: PUBLISHED for an authority, PENDING_APPROVAL for anyone else.
   * - Approving is for an authority whose reach covers the KPI's department,
   *   and never the KPI's own owner.
   * - Sending back is for that same authority, or the creator withdrawing it.
   * - Deleting is for that authority at any point, or the creator before the
   *   KPI is published. An employee cannot delete a published KPI to drop a
   *   bad result.
   *
   * Throws `BadRequestException` for a move that does not exist, a submission
   * to the wrong status, a deletion without a reason, a weight that no longer
   * fits, or a KPI that moved on concurrently. Throws `ForbiddenException` for a
   * caller who may not make the move.
   */
  async changeStatus(id: string, dto: ChangeKpiStatusDto, user: JwtPayload) {
    const kpi = await this.loadKpi(id);
    await this.assertCanRead(kpi, user);

    const from = kpi.status;
    const to = dto.status;
    if (!isLegalMove(from, to)) {
      throw new BadRequestException(`A KPI cannot go from ${from} to ${to}`);
    }
    if (to === 'DELETED' && !dto.reason) {
      throw new BadRequestException('A deletion needs a reason');
    }

    const isCreator = kpi.created_by_id === user.sub;
    const scope = await this.departmentScope.resolveDepartmentScope(user);
    const reaches = canActOnDepartment(user.role, scope, kpi.department_id);

    let allowed: boolean;
    if (from === 'DRAFT' && to !== 'DELETED') {
      allowed = isCreator;
      const expected = submittedStatus(user.role);
      if (allowed && to !== expected) {
        throw new BadRequestException(`Your KPI goes to ${expected} when submitted`);
      }
    } else if (from === 'PENDING_APPROVAL' && to === 'PUBLISHED') {
      allowed = reaches && kpi.owner_user_id !== user.sub;
    } else if (to === 'DELETED') {
      allowed = reaches || (isCreator && from !== 'PUBLISHED');
    } else {
      allowed = reaches || isCreator;
    }
    if (!allowed) {
      throw new ForbiddenException(`You cannot move this KPI to ${to}`);
    }

    if (
      from === 'DRAFT' &&
      to !== 'DELETED' &&
      kpi.scope === 'INDIVIDUAL' &&
      kpi.owner_user_id
    ) {
      await this.assertAllocation(
        kpi.owner_user_id,
        kpi.period_start,
        kpi.period_end,
        Number(kpi.weight),
        kpi.id,
      );
    }

    const now = new Date();
    const data: Prisma.kpisUpdateInput = {
      status: to,
      ...(from === 'PENDING_APPROVAL' &&
        to === 'PUBLISHED' && { approved_by_id: user.sub, approved_at: now }),
      ...(to === 'DELETED' && {
        cancelled_at: now,
        cancel_reason: dto.reason ?? null,
      }),
      updated_at: now,
    };

    // The current status is in the where clause rather than an if above it, so
    // two approvals racing produce one approval and one 400.
    const { count } = await this.prisma.kpis.updateMany({
      where: { id, status: from },
      data,
    });
    if (count === 0) {
      throw new BadRequestException('The KPI moved on while you were looking at it');
    }
    return this.loadKpi(id);
  }

  /**
   * Quick approve: PENDING_APPROVAL to PUBLISHED in one call, with the same
   * rules as the status route.
   *
   * Throws `BadRequestException` when the KPI is not pending, and whatever
   * `changeStatus` throws otherwise.
   */
  async approve(id: string, user: JwtPayload) {
    const kpi = await this.loadKpi(id);
    if (kpi.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Only a KPI pending approval can be approved');
    }
    return this.changeStatus(id, { status: 'PUBLISHED' }, user);
  }

  // ------------------------------------------------------------- progress

  /**
   * Record what actually happened. The server derives the percentage; nobody
   * sends one.
   *
   * The owner enters the actual, and only a reviewer enters a rating, which is
   * the one case where the person being measured is not the person typing.
   *
   * Throws `ForbiddenException` when the caller neither owns nor contributes to
   * the KPI, or when an owner tries to rate themselves. Throws
   * `BadRequestException` when the KPI is not in a status that accepts the
   * entry, when the field sent does not match the mode, or when evidence was
   * required and none came.
   */
  async recordUpdate(id: string, dto: RecordKpiUpdateDto, user: JwtPayload) {
    const kpi = await this.loadKpi(id);
    const isRating = kpi.mode === 'RATING';

    if (isRating) {
      if (!(await this.canReview(kpi, user))) {
        throw new ForbiddenException('Only a reviewer can rate this KPI');
      }
      if (!acceptsProgress(kpi.status)) {
        throw new BadRequestException(`A ${kpi.status} KPI cannot be rated`);
      }
      if (dto.rating === undefined) {
        throw new BadRequestException('A rating KPI needs a rating');
      }
      const config = this.configOf(kpi);
      const maxRating = config.max_rating ?? 5;
      if (dto.rating > maxRating) {
        throw new BadRequestException(`The scale for this KPI ends at ${maxRating}`);
      }
    } else {
      if (!(await this.canRecord(kpi, user))) {
        throw new ForbiddenException('This KPI is not yours to update');
      }
      if (!acceptsProgress(kpi.status)) {
        throw new BadRequestException(
          `A ${kpi.status} KPI does not accept updates`,
        );
      }
      if (dto.rating !== undefined) {
        throw new BadRequestException('Only a rating KPI takes a rating');
      }
      if (kpi.mode === 'QUANTITATIVE' && dto.actual_value === undefined) {
        throw new BadRequestException('Enter the actual figure');
      }
      if (kpi.mode === 'BINARY' && dto.binary_done === undefined) {
        throw new BadRequestException('Tick completed or not completed');
      }
      if (kpi.mode === 'MILESTONE') {
        throw new BadRequestException(
          'Milestone progress is a tick on a stage, not an update',
        );
      }
    }

    if (kpi.evidence_required && !dto.evidence_url) {
      throw new BadRequestException('This KPI was created requiring evidence');
    }

    return this.prisma.kpi_updates.create({
      data: {
        kpi_id: kpi.id,
        actual_value: dto.actual_value ?? null,
        binary_done: dto.binary_done ?? null,
        rating: dto.rating ?? null,
        remarks: dto.remarks ?? null,
        evidence_url: dto.evidence_url ?? null,
        entered_by_id: user.sub,
      },
    });
  }

  /**
   * Tick or untick one stage of a milestone KPI.
   *
   * Ticking is a toggle rather than a one-way door, because a stage marked
   * complete by mistake is common and the alternative is cancelling the KPI.
   *
   * Throws `NotFoundException` when the stage is not on this KPI and
   * `BadRequestException` when the KPI is not accepting progress.
   */
  async tickMilestone(id: string, milestoneId: string, user: JwtPayload) {
    const kpi = await this.loadKpi(id);
    if (kpi.mode !== 'MILESTONE') {
      throw new BadRequestException('This KPI has no milestones');
    }
    if (!(await this.canRecord(kpi, user))) {
      throw new ForbiddenException('This KPI is not yours to update');
    }
    if (!acceptsProgress(kpi.status)) {
      throw new BadRequestException(`A ${kpi.status} KPI does not accept updates`);
    }

    const milestone = await this.prisma.kpi_milestones.findFirst({
      where: { id: milestoneId, kpi_id: kpi.id },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');

    const completing = milestone.completed_at === null;
    return this.prisma.kpi_milestones.update({
      where: { id: milestone.id },
      data: {
        completed_at: completing ? new Date() : null,
        completed_by_id: completing ? user.sub : null,
      },
    });
  }

  /**
   * Replace the contribution allocation of a shared KPI.
   *
   * The whole set is sent and the whole set is replaced, so a member dropped
   * from the list loses their share instead of keeping a stale one.
   *
   * Throws `BadRequestException` on an INDIVIDUAL KPI, which is owned outright
   * and has nothing to allocate, or when the shares total more than 100.
   */
  async setContributions(
    id: string,
    dto: SetKpiContributionsDto,
    user: JwtPayload,
  ) {
    const kpi = await this.loadKpi(id);
    await this.assertCanManage(kpi, user);
    if (kpi.scope === 'INDIVIDUAL') {
      throw new BadRequestException(
        'An individual KPI is owned outright and has no shares to allocate',
      );
    }
    this.assertShares(dto.contributions);

    return this.prisma.$transaction(async (tx) => {
      await tx.kpi_contributions.deleteMany({ where: { kpi_id: kpi.id } });
      if (dto.contributions.length === 0) return [];
      await tx.kpi_contributions.createMany({
        data: dto.contributions.map((entry) => ({
          kpi_id: kpi.id,
          user_id: entry.user_id,
          share: entry.share,
        })),
      });
      return tx.kpi_contributions.findMany({ where: { kpi_id: kpi.id } });
    });
  }

  /**
   * Change an approved target or weight, keeping the original.
   *
   * The new values go onto the KPI and the old ones onto a revision row, so
   * both stay visible and the change is attributable to a person, a date, and a
   * reason. This is the only way an approved target moves.
   *
   * Throws `BadRequestException` when neither a target nor a weight is sent,
   * when the KPI is deleted, or when a new weight does not fit the owner's
   * allocation.
   */
  async createRevision(
    id: string,
    dto: CreateKpiRevisionDto,
    user: JwtPayload,
  ) {
    const kpi = await this.loadKpi(id);
    await this.assertCanManage(kpi, user);
    if (kpi.status === 'DELETED') {
      throw new BadRequestException('A deleted KPI cannot be revised');
    }
    if (dto.new_target === undefined && dto.new_weight === undefined) {
      throw new BadRequestException('A revision has to change the target or the weight');
    }
    if (dto.new_target !== undefined && kpi.mode !== 'QUANTITATIVE') {
      throw new BadRequestException('Only a quantitative KPI has a target to revise');
    }
    if (
      dto.new_weight !== undefined &&
      kpi.scope === 'INDIVIDUAL' &&
      kpi.owner_user_id &&
      kpi.status !== 'DRAFT'
    ) {
      await this.assertAllocation(
        kpi.owner_user_id,
        kpi.period_start,
        kpi.period_end,
        dto.new_weight,
        kpi.id,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const revision = await tx.kpi_revisions.create({
        data: {
          kpi_id: kpi.id,
          old_target: kpi.target_value,
          new_target: dto.new_target ?? kpi.target_value,
          old_weight: kpi.weight,
          new_weight: dto.new_weight ?? kpi.weight,
          effective_from: toDateOnly(dto.effective_from),
          reason: dto.reason,
          changed_by_id: user.sub,
        },
      });
      await tx.kpis.update({
        where: { id: kpi.id },
        data: {
          ...(dto.new_target !== undefined && { target_value: dto.new_target }),
          ...(dto.new_weight !== undefined && { weight: dto.new_weight }),
          updated_at: new Date(),
        },
      });
      return revision;
    });
  }

  // ---------------------------------------------------------------- reads

  /** The unit library, filtered. On the service so the controller stays a list
   * of routes. */
  searchUnits(query: string | undefined) {
    return searchUnits(query ?? '');
  }

  /**
   * One page of the KPIs the caller may see, newest period first.
   *
   * Department scope decides the widest set: the MD office sees everything, a
   * HOD or Department Controller their departments, and an employee the KPIs
   * that are theirs or their department's. `view=own` narrows that to KPIs the
   * caller owns and `view=others` to everyone else's. Every filter is ANDed onto
   * the visible set, so a query parameter can narrow it and never widen it, and
   * `total` counts the same set. DELETED KPIs only come back when asked for by
   * status.
   */
  async list(filter: KpiFilterDto, user: JwtPayload) {
    const and: Prisma.kpisWhereInput[] = [await this.visibilityFilter(user)];

    if (filter.view === 'own') and.push({ owner_user_id: user.sub });
    if (filter.view === 'others') {
      and.push({ OR: [{ owner_user_id: null }, { owner_user_id: { not: user.sub } }] });
    }
    and.push({ status: filter.status ?? { not: 'DELETED' } });
    if (filter.scope) and.push({ scope: filter.scope });
    if (filter.owner_user_id) and.push({ owner_user_id: filter.owner_user_id });
    if (filter.department_id) and.push({ department_id: filter.department_id });
    if (filter.project_id) and.push({ project_id: filter.project_id });
    if (filter.month && filter.year) {
      const { start, end } = monthWindow(filter.year, filter.month);
      and.push({ period_start: { lte: end }, period_end: { gte: start } });
    }

    const where: Prisma.kpisWhereInput = { AND: and };
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const [rows, total] = await Promise.all([
      this.prisma.kpis.findMany({
        where,
        orderBy: [{ period_start: 'desc' }, { created_at: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.kpis.count({ where }),
    ]);
    return {
      items: await attachUsers(this.prisma, rows, ['owner_user_id', 'created_by_id']),
      total,
      page,
      limit,
    };
  }

  /**
   * How much of one person's KPI weight is taken in a period, and how much is
   * left for an authority to assign. Only PENDING_APPROVAL and PUBLISHED
   * INDIVIDUAL KPIs overlapping the period count, so the employee's own KPIs
   * are counted before anything an authority adds.
   *
   * Anyone may read their own. Reading somebody else's takes an authority whose
   * reach covers that person's department. Throws `NotFoundException` for an
   * unknown user and `ForbiddenException` otherwise.
   */
  async allocationFor(userId: string, query: AllocationQueryDto, user: JwtPayload) {
    if (userId !== user.sub) {
      const subject = await this.prisma.users.findFirst({
        where: { id: userId, deleted_at: null },
        select: { department_id: true },
      });
      if (!subject) throw new NotFoundException('User not found');
      const scope = await this.departmentScope.resolveDepartmentScope(user);
      if (!canActOnDepartment(user.role, scope, subject.department_id)) {
        throw new ForbiddenException('Outside your department scope');
      }
    }

    const rows = await this.allocatingKpis(
      userId,
      toDateOnly(query.period_start),
      toDateOnly(query.period_end),
    );
    return {
      user_id: userId,
      permitted: PERMITTED_ALLOCATION,
      ...allocation(rows.map((row) => Number(row.weight))),
      kpis: rows.map((row) => ({ ...row, weight: Number(row.weight) })),
    };
  }

  /**
   * One KPI's chat, oldest first, with each author resolved. Readable by
   * whoever may read the KPI, the same rule as `findOne`.
   *
   * ponytail: the latest 200 messages and no cursor, as on the project thread.
   * Keyset pagination on `(kpi_id, created_at)` when a thread outgrows it.
   */
  async listMessages(id: string, user: JwtPayload) {
    const kpi = await this.loadKpi(id);
    await this.assertCanRead(kpi, user);
    const rows = await this.prisma.kpi_messages.findMany({
      where: { kpi_id: id },
      orderBy: { created_at: 'desc' },
      take: 200,
    });
    return attachUsers(this.prisma, rows.reverse(), ['user_id']);
  }

  /**
   * Post to one KPI's chat and notify its owner and creator, minus the sender.
   *
   * Throws `ForbiddenException` when the caller may not read the KPI and
   * `BadRequestException` when it is deleted, since a deleted KPI's thread is
   * history. Notification delivery is best effort and never rolls back the
   * message.
   */
  async createMessage(id: string, dto: CreateKpiMessageDto, user: JwtPayload) {
    const kpi = await this.loadKpi(id);
    await this.assertCanRead(kpi, user);
    if (kpi.status === 'DELETED') {
      throw new BadRequestException('A deleted KPI cannot take new messages');
    }

    const row = await this.prisma.kpi_messages.create({
      data: { kpi_id: id, user_id: user.sub, content: dto.content },
    });
    const message = (await attachUsers(this.prisma, [row], ['user_id']))[0] ?? row;

    const recipients = new Set([kpi.owner_user_id, kpi.created_by_id]);
    recipients.delete(user.sub);
    await this.notifications.notifyMany(
      [...recipients]
        .filter((recipient): recipient is string => recipient !== null)
        .map((recipientId) => ({
          recipientId,
          type: notification_type_enum.KPI_MESSAGE,
          title: 'New KPI message',
          message: `${user.fullName ?? user.username} wrote on "${kpi.name}"`,
          entityType: 'kpi' as const,
          entityId: id,
        })),
    );

    return message;
  }

  /**
   * One page of existing `performance_scores` rows for the View Score tab,
   * searched and filtered. Nothing here calculates a score.
   *
   * The caller's department scope is applied before any filter and every
   * filter is ANDed onto it, so a department or user outside the caller's reach
   * comes back empty rather than exposed, and `total` counts only what the
   * caller may see. `departments` is the list the department filter may offer.
   * No month or year means every period.
   */
  async scores(query: ScoreSearchDto, user: JwtPayload) {
    const scope = await this.departmentScope.resolveDepartmentScope(user);
    const userAnd: Prisma.usersWhereInput[] = [];
    if (!scope.unrestricted) {
      userAnd.push({ department_id: { in: scope.departmentIds } });
    }
    if (query.department_id) userAnd.push({ department_id: query.department_id });
    if (query.user_id) userAnd.push({ id: query.user_id });
    if (query.role) userAnd.push({ role: query.role });
    const q = query.q?.trim();
    if (q) {
      userAnd.push({
        OR: [
          { full_name: { contains: q, mode: 'insensitive' } },
          { username: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.performance_scoresWhereInput = {
      users: { AND: userAnd },
      ...(query.month && { month: query.month }),
      ...(query.year && { year: query.year }),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [rows, total, departments] = await Promise.all([
      this.prisma.performance_scores.findMany({
        where,
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { final_score: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          users: {
            select: {
              id: true,
              full_name: true,
              username: true,
              email: true,
              role: true,
              departments: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.performance_scores.count({ where }),
      this.prisma.departments.findMany({
        where: scope.unrestricted ? {} : { id: { in: scope.departmentIds } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      items: rows.map((row) => {
        const { departments: department, ...person } = row.users;
        return {
          id: row.id,
          user: person,
          department,
          month: row.month,
          year: row.year,
          final_score: num(row.final_score),
          self_productivity_score: num(row.self_productivity_score),
          assigned_task_score: num(row.assigned_task_score),
          self_actions_completed: row.self_actions_completed,
          self_actions_total: row.self_actions_total,
          assigned_tasks_completed: row.assigned_tasks_completed,
          assigned_tasks_total: row.assigned_tasks_total,
          overdue_tasks_count: row.overdue_tasks_count,
          is_finalized: row.is_finalized ?? false,
        };
      }),
      total,
      page,
      limit,
      departments,
    };
  }

  /**
   * One KPI with everything hanging off it: stages, allocation, the history of
   * actuals, the revisions, and the achievement and score as they stand.
   *
   * Throws `NotFoundException` when it does not exist and `ForbiddenException`
   * when it is outside the caller's department scope.
   */
  async findOne(id: string, user: JwtPayload) {
    const kpi = await this.loadKpi(id);
    await this.assertCanRead(kpi, user);

    const [milestones, contributions, updates, revisions] = await Promise.all([
      this.prisma.kpi_milestones.findMany({
        where: { kpi_id: id },
        orderBy: { sequence: 'asc' },
      }),
      this.prisma.kpi_contributions.findMany({ where: { kpi_id: id } }),
      this.prisma.kpi_updates.findMany({
        where: { kpi_id: id },
        orderBy: { created_at: 'desc' },
        take: 50,
      }),
      this.prisma.kpi_revisions.findMany({
        where: { kpi_id: id },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const measured = this.measure(kpi, milestones, updates[0] ?? null);

    return {
      ...kpi,
      ...(await attachUsers(this.prisma, [kpi], ['owner_user_id', 'created_by_id']))[0],
      milestones,
      contributions: await attachUsers(this.prisma, contributions, ['user_id']),
      updates: await attachUsers(this.prisma, updates, ['entered_by_id']),
      revisions: await attachUsers(this.prisma, revisions, ['changed_by_id']),
      ...measured,
    };
  }

  /**
   * The PS Score for one person over a month.
   *
   * Every KPI whose cycle covers the month is in scope, so a monthly and an
   * annual KPI can be carried at the same time. Deleted KPIs come back in the
   * list marked excluded rather than being hidden, because an employee asking
   * why their score moved deserves to see the KPI that was dropped.
   *
   * Throws `ForbiddenException` when the caller may not read the subject's
   * department. Anyone may read their own.
   */
  async psScoreFor(userId: string, query: PsScoreQueryDto, user: JwtPayload) {
    if (userId !== user.sub) {
      const subject = await this.prisma.users.findFirst({
        where: { id: userId, deleted_at: null },
        select: { id: true, department_id: true },
      });
      if (!subject) throw new NotFoundException('User not found');
      const scope = await this.departmentScope.resolveDepartmentScope(user);
      const visible =
        scope.unrestricted ||
        (subject.department_id !== null &&
          scope.departmentIds.includes(subject.department_id));
      if (!visible) throw new ForbiddenException('Outside your department scope');
    }

    const now = new Date();
    const year = query.year ?? now.getUTCFullYear();
    const month = query.month ?? now.getUTCMonth() + 1;
    const { start, end } = monthWindow(year, month);

    const shares = await this.prisma.kpi_contributions.findMany({
      where: { user_id: userId },
    });
    const shareByKpi = new Map(shares.map((row) => [row.kpi_id, Number(row.share)]));

    const kpis = await this.prisma.kpis.findMany({
      where: {
        // DELETED stays in so the breakdown can show it as excluded.
        status: { in: ['PUBLISHED', 'DELETED'] },
        period_start: { lte: end },
        period_end: { gte: start },
        OR: [
          { scope: 'INDIVIDUAL', owner_user_id: userId },
          { id: { in: [...shareByKpi.keys()] } },
        ],
      },
      orderBy: { created_at: 'asc' },
    });

    const ids = kpis.map((kpi) => kpi.id);
    const [milestones, updates] = await Promise.all([
      this.prisma.kpi_milestones.findMany({ where: { kpi_id: { in: ids } } }),
      // ponytail: the whole update history for this set, newest first, and the
      // first row per KPI wins. A person carries a handful of KPIs and each
      // carries a handful of updates. Ceiling: a KPI updated daily for a year.
      // Upgrade path is DISTINCT ON (kpi_id) in raw SQL.
      this.prisma.kpi_updates.findMany({
        where: { kpi_id: { in: ids } },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const latest = new Map<string, (typeof updates)[number]>();
    for (const update of updates) {
      if (!latest.has(update.kpi_id)) latest.set(update.kpi_id, update);
    }
    const stagesOf = (kpiId: string) =>
      milestones.filter((row) => row.kpi_id === kpiId);

    const lines = kpis.map((kpi) => {
      const measured = this.measure(kpi, stagesOf(kpi.id), latest.get(kpi.id) ?? null);
      const input: PsScoreInput = {
        kpi_id: kpi.id,
        weight: Number(kpi.weight),
        score: measured.score,
        contribution_share:
          kpi.scope === 'INDIVIDUAL' ? 100 : (shareByKpi.get(kpi.id) ?? 100),
        excluded: !isCountable(kpi.status),
      };
      return { kpi, measured, input };
    });

    const result = psScore(lines.map((line) => line.input));

    return {
      user_id: userId,
      month,
      year,
      ps_score: result.ps_score,
      counted_weight: result.counted_weight,
      declared_weight: result.declared_weight,
      kpis: lines.map((line, index) => {
        const computed = result.lines[index];
        return {
          id: line.kpi.id,
          name: line.kpi.name,
          scope: line.kpi.scope,
          mode: line.kpi.mode,
          status: line.kpi.status,
          unit_label: line.kpi.unit_label,
          unit_symbol: line.kpi.unit_symbol,
          target_value: num(line.kpi.target_value),
          weight: Number(line.kpi.weight),
          ...line.measured,
          effective_weight: computed?.effective_weight ?? 0,
          contribution_share: computed?.contribution_share ?? 100,
          contribution: computed?.contribution ?? null,
          counted: computed?.counted ?? false,
        };
      }),
    };
  }

  // ------------------------------------------------------------- internals

  /**
   * Achievement and score for one KPI as it stands.
   *
   * Null score means nothing has been entered yet, which is not zero: the PS
   * Score leaves it out rather than counting it as a failure.
   */
  private measure(
    kpi: MeasurableKpi,
    milestones: { weight: Prisma.Decimal; completed_at: Date | null }[],
    update: MeasurableUpdate | null,
  ) {
    const config = this.configOf(kpi);
    let achievement: number | null = null;
    let actual: number | null = null;

    if (kpi.mode === 'MILESTONE') {
      achievement = milestoneAchievement(
        milestones.map((row) => ({
          weight: Number(row.weight),
          completed: row.completed_at !== null,
        })),
      );
    } else if (update) {
      if (kpi.mode === 'QUANTITATIVE' && update.actual_value !== null) {
        actual = Number(update.actual_value);
        const target = num(kpi.target_value);
        achievement =
          target === null
            ? null
            : quantitativeAchievement(
                target,
                actual,
                kpi.direction ?? kpi_direction_enum.HIGHER_IS_BETTER,
                num(kpi.baseline_value),
              );
      } else if (kpi.mode === 'BINARY' && update.binary_done !== null) {
        achievement = binaryAchievement(update.binary_done);
      } else if (kpi.mode === 'RATING' && update.rating !== null) {
        achievement = ratingAchievement(update.rating, config.max_rating ?? 5);
      }
    }

    return {
      actual_value: actual,
      rating: update?.rating ?? null,
      achievement,
      score: kpiScore(achievement, kpi.scoring_method, config, update?.rating ?? null),
    };
  }

  private configOf(kpi: { scoring_config: Prisma.JsonValue }): KpiScoringConfig {
    return (kpi.scoring_config ?? {}) as KpiScoringConfig;
  }

  private async loadKpi(id: string) {
    const kpi = await this.prisma.kpis.findUnique({ where: { id } });
    if (!kpi) throw new NotFoundException('KPI not found');
    return kpi;
  }

  /** Exactly one target per scope, because a KPI that is both a person's and a
   * project's has no defined owner for the PS Score. */
  private assertScopeShape(dto: CreateKpiDto) {
    const required: Record<kpi_scope_enum, keyof CreateKpiDto> = {
      INDIVIDUAL: 'owner_user_id',
      DEPARTMENT: 'department_id',
      PROJECT: 'project_id',
    };
    const field = required[dto.scope];
    if (!dto[field]) {
      throw new BadRequestException(`A ${dto.scope} KPI needs ${field}`);
    }
    if (dto.scope !== 'INDIVIDUAL' && dto.owner_user_id) {
      throw new BadRequestException(
        'A shared KPI is allocated through contributions, not an owner',
      );
    }
    if (dto.scope !== 'PROJECT' && dto.project_id) {
      throw new BadRequestException('Only a project KPI carries a project');
    }
  }

  /** The mode decides which fields have to be there and which methods are
   * legal. One table, checked on create and on a draft edit. */
  private assertModeShape(
    mode: kpi_mode_enum,
    method: kpi_scoring_method_enum,
    fields: {
      target_value?: number;
      direction?: string;
      unit_label?: string;
      milestones?: unknown[];
    },
  ) {
    const rule = MODE_RULES[mode];
    if (!rule.methods.includes(method)) {
      throw new BadRequestException(
        `A ${mode} KPI is scored by ${rule.methods.join(' or ')}, not ${method}`,
      );
    }
    if (rule.needsTarget && fields.target_value === undefined) {
      throw new BadRequestException(`A ${mode} KPI needs a target`);
    }
    if (rule.needsTarget && !fields.unit_label) {
      throw new BadRequestException('A target needs a unit to mean anything');
    }
    if (rule.needsDirection && !fields.direction) {
      throw new BadRequestException(
        'Choose whether higher, lower, or exact is the good outcome',
      );
    }
    if (rule.needsMilestones && !(fields.milestones ?? []).length) {
      throw new BadRequestException('A milestone KPI needs its stages');
    }
    if (!rule.needsMilestones && (fields.milestones ?? []).length) {
      throw new BadRequestException(`A ${mode} KPI has no milestones`);
    }
  }

  private assertShares(shares: { share: number }[]) {
    const total = shares.reduce((sum, entry) => sum + entry.share, 0);
    if (total > 100 + WEIGHT_TOLERANCE) {
      throw new BadRequestException(
        `Contribution shares total ${total}%, which is more than the outcome`,
      );
    }
  }

  /** The owning department, which is what department scope filters on. Taken
   * from the owner when it was not given, the way a project takes one. */
  private async resolveDepartment(dto: CreateKpiDto): Promise<string | null> {
    if (dto.department_id) {
      const department = await this.prisma.departments.findUnique({
        where: { id: dto.department_id },
        select: { id: true },
      });
      if (!department) throw new NotFoundException('Department not found');
      return department.id;
    }
    if (!dto.owner_user_id) return null;
    const owner = await this.prisma.users.findFirst({
      where: { id: dto.owner_user_id, deleted_at: null },
      select: { department_id: true },
    });
    if (!owner) throw new NotFoundException('Owner not found');
    return owner.department_id;
  }

  /**
   * The KPI's creator, or an authority whose reach covers its department: MD,
   * EA, and PA anywhere, HOD and Department Controller in their own
   * departments. Throws `ForbiddenException` for anyone else.
   */
  private async assertCanManage(
    kpi: { created_by_id: string; department_id: string | null },
    user: JwtPayload,
  ) {
    if (kpi.created_by_id === user.sub) return;
    const scope = await this.departmentScope.resolveDepartmentScope(user);
    if (canActOnDepartment(user.role, scope, kpi.department_id)) return;
    throw new ForbiddenException('Only the author or an authority over its department can change this KPI');
  }

  /** The INDIVIDUAL KPIs holding a share of `ownerId`'s allocation in a period. */
  private allocatingKpis(ownerId: string, start: Date, end: Date, excludeId?: string) {
    return this.prisma.kpis.findMany({
      where: {
        scope: 'INDIVIDUAL',
        owner_user_id: ownerId,
        status: { in: ALLOCATING_STATUSES },
        period_start: { lte: end },
        period_end: { gte: start },
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true, name: true, weight: true, status: true },
      orderBy: { created_at: 'asc' },
    });
  }

  /**
   * Rejects a weight that does not fit what is left of the owner's allocation
   * in the period, `excludeId` being the KPI whose own weight is changing.
   * Throws `BadRequestException` with the remaining figure in the message.
   */
  private async assertAllocation(
    ownerId: string,
    start: Date,
    end: Date,
    weight: number,
    excludeId?: string,
  ) {
    const weights = (await this.allocatingKpis(ownerId, start, end, excludeId)).map(
      (row) => Number(row.weight),
    );
    if (fitsAllocation(weights, weight)) return;
    const { remaining } = allocation(weights);
    throw new BadRequestException(
      remaining === 0
        ? 'This employee has no KPI weight left in this period'
        : `This employee has ${remaining}% of KPI weight left in this period, so ${weight}% does not fit`,
    );
  }

  /** Whoever the KPI is measuring: its owner, or anybody holding a share of a
   * shared one. */
  private async canRecord(
    kpi: { id: string; owner_user_id: string | null },
    user: JwtPayload,
  ) {
    if (kpi.owner_user_id === user.sub) return true;
    const share = await this.prisma.kpi_contributions.findUnique({
      where: { kpi_id_user_id: { kpi_id: kpi.id, user_id: user.sub } },
      select: { id: true },
    });
    return share !== null;
  }

  /** A rating comes from somebody other than the person being rated: the
   * author, or a role senior enough to review. */
  private async canReview(
    kpi: { created_by_id: string; owner_user_id: string | null; department_id: string | null },
    user: JwtPayload,
  ) {
    if (kpi.owner_user_id === user.sub) return false;
    if (kpi.created_by_id === user.sub) return true;
    const scope = await this.departmentScope.resolveDepartmentScope(user);
    return canActOnDepartment(user.role, scope, kpi.department_id);
  }

  private async assertCanRead(
    kpi: { owner_user_id: string | null; department_id: string | null; created_by_id: string; id: string },
    user: JwtPayload,
  ) {
    if (kpi.owner_user_id === user.sub || kpi.created_by_id === user.sub) return;
    const scope = await this.departmentScope.resolveDepartmentScope(user);
    if (scope.unrestricted) return;
    if (kpi.department_id && scope.departmentIds.includes(kpi.department_id)) return;
    const share = await this.prisma.kpi_contributions.findUnique({
      where: { kpi_id_user_id: { kpi_id: kpi.id, user_id: user.sub } },
      select: { id: true },
    });
    if (share) return;
    throw new ForbiddenException('Outside your department scope');
  }

  /**
   * The widest set of KPIs a caller may list.
   *
   * Department scope answers it for anyone who supervises. Everyone else gets
   * the KPIs that are theirs, by ownership or by allocation, which is why the
   * employee case is an OR rather than an empty result.
   */
  private async visibilityFilter(user: JwtPayload): Promise<Prisma.kpisWhereInput> {
    const scope = await this.departmentScope.resolveDepartmentScope(user);
    if (scope.unrestricted) return {};

    const shares = await this.prisma.kpi_contributions.findMany({
      where: { user_id: user.sub },
      select: { kpi_id: true },
    });

    return {
      OR: [
        { owner_user_id: user.sub },
        { created_by_id: user.sub },
        { id: { in: shares.map((row) => row.kpi_id) } },
        ...(scope.departmentIds.length
          ? [{ department_id: { in: scope.departmentIds } }]
          : []),
      ],
    };
  }
}

/** The columns `measure` reads, so it can be handed a full row or a projection. */
type MeasurableKpi = {
  mode: kpi_mode_enum;
  scoring_method: kpi_scoring_method_enum;
  direction: kpi_direction_enum | null;
  target_value: Prisma.Decimal | null;
  baseline_value: Prisma.Decimal | null;
  scoring_config: Prisma.JsonValue;
};

type MeasurableUpdate = {
  actual_value: Prisma.Decimal | null;
  binary_done: boolean | null;
  rating: number | null;
};

/** First and last day of a month as `@db.Date` values, for overlap tests. */
function monthWindow(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0)),
  };
}
