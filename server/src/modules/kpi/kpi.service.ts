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
  role_enum,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { DepartmentScopeService } from '../../common/services/department-scope.service';
import { attachUsers } from '../../common/helpers/user-lookup.helper';
import { JwtPayload } from '../../common/types/jwt-payload.type';

import { CreateKpiDto } from './dto/create-kpi.dto';
import {
  ChangeKpiStatusDto,
  UpdateKpiDto,
} from './dto/update-kpi.dto';
import {
  CreateKpiRevisionDto,
  RecordKpiUpdateDto,
  SetKpiContributionsDto,
} from './dto/kpi-progress.dto';
import { KpiFilterDto, PsScoreQueryDto } from './dto/kpi-query.dto';
import {
  KPI_APPROVER_ROLES,
  acceptsActual,
  acceptsReview,
  isCountable,
  transitionRoles,
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

/** Weights that should total 100 are allowed this much float, because 33.33
 * three times is what a real form produces. */
const WEIGHT_TOLERANCE = 0.05;

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
  ) {}

  // ------------------------------------------------------------ creation

  /**
   * Create a KPI in DRAFT and attach its milestones and contribution shares.
   *
   * Throws `BadRequestException` when the scope and its target do not agree
   * (an INDIVIDUAL KPI with no owner, a PROJECT KPI with a department), when
   * the mode and the scoring method are not a legal pair, when a milestone set
   * does not total 100, or when contribution shares exceed 100 between them.
   * Throws `NotFoundException` when the owner, department, or project named
   * does not exist.
   *
   * Assumes the caller's role was checked by `@Roles`. Nothing here sets a
   * status: a KPI becomes real by being approved, not by being saved.
   */
  async create(dto: CreateKpiDto, user: JwtPayload) {
    this.assertScopeShape(dto);
    this.assertModeShape(dto.mode, dto.scoring_method, dto);

    const departmentId = await this.resolveDepartment(dto);
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

    return this.prisma.$transaction(async (tx) => {
      const kpi = await tx.kpis.create({
        data: {
          scope: dto.scope,
          owner_user_id: dto.owner_user_id ?? null,
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
   * Edit a KPI that is still a DRAFT.
   *
   * Throws `ForbiddenException` for anyone but the author or the MD office, and
   * `BadRequestException` once the KPI has left DRAFT. A target change after
   * approval is a revision, not an edit, so that the original survives.
   */
  async update(id: string, dto: UpdateKpiDto, user: JwtPayload) {
    const kpi = await this.loadKpi(id);
    this.assertAuthor(kpi, user);
    if (kpi.status !== 'DRAFT') {
      throw new BadRequestException(
        'Only a draft can be edited. Use a revision to change an approved target.',
      );
    }

    const target = dto.target_value ?? num(kpi.target_value);
    const direction = dto.direction ?? kpi.direction;
    const unit = dto.unit_label ?? kpi.unit_label;
    this.assertModeShape(kpi.mode, kpi.scoring_method, {
      ...(target !== null && { target_value: target }),
      ...(direction !== null && { direction }),
      ...(unit !== null && { unit_label: unit }),
    });

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
      ...(dto.period_start !== undefined && {
        period_start: toDateOnly(dto.period_start),
      }),
      ...(dto.period_end !== undefined && { period_end: toDateOnly(dto.period_end) }),
      ...(dto.evidence_required !== undefined && {
        evidence_required: dto.evidence_required,
      }),
      ...(dto.review_required !== undefined && {
        review_required: dto.review_required,
      }),
      updated_at: new Date(),
    };

    return this.prisma.kpis.update({ where: { id }, data });
  }

  /**
   * Move a KPI along its lifecycle.
   *
   * One endpoint for every move, with `kpi-lifecycle.ts` holding which are
   * legal and which roles may make them. Throws `BadRequestException` for a
   * move that does not exist, `ForbiddenException` for a role that may not make
   * it, and `BadRequestException` when a cancellation arrives without a reason.
   */
  async changeStatus(id: string, dto: ChangeKpiStatusDto, user: JwtPayload) {
    const kpi = await this.loadKpi(id);
    await this.assertCanRead(kpi, user);

    const allowed = transitionRoles(kpi.status, dto.status);
    if (!allowed) {
      throw new BadRequestException(
        `A KPI cannot go from ${kpi.status} to ${dto.status}`,
      );
    }
    if (!allowed.includes(user.role)) {
      throw new ForbiddenException(`Your role cannot move a KPI to ${dto.status}`);
    }
    if (dto.status === 'CANCELLED' && !dto.reason) {
      throw new BadRequestException('A cancellation needs a reason');
    }

    const now = new Date();
    const data: Prisma.kpisUpdateInput = {
      status: dto.status,
      ...(dto.status === 'APPROVED' && {
        approved_by_id: user.sub,
        approved_at: now,
      }),
      ...(dto.status === 'CANCELLED' && {
        cancelled_at: now,
        cancel_reason: dto.reason ?? null,
      }),
      ...(dto.status === 'LOCKED' && { locked_at: now }),
      updated_at: now,
    };

    // The current status is in the where clause rather than an if above it, so
    // two approvals racing produce one approval and one 404.
    const { count } = await this.prisma.kpis.updateMany({
      where: { id, status: kpi.status },
      data,
    });
    if (count === 0) {
      throw new BadRequestException('The KPI moved on while you were looking at it');
    }
    return this.loadKpi(id);
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
      if (!acceptsReview(kpi.status)) {
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
      if (!acceptsActual(kpi.status)) {
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

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.kpi_updates.create({
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

      // The first actual is what In Progress means, so the status follows the
      // work rather than waiting for somebody to remember to move it.
      if (kpi.status === 'ACTIVE') {
        await tx.kpis.update({
          where: { id: kpi.id },
          data: { status: 'IN_PROGRESS', updated_at: new Date() },
        });
      }

      return entry;
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
    if (!acceptsActual(kpi.status)) {
      throw new BadRequestException(`A ${kpi.status} KPI does not accept updates`);
    }

    const milestone = await this.prisma.kpi_milestones.findFirst({
      where: { id: milestoneId, kpi_id: kpi.id },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');

    const completing = milestone.completed_at === null;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.kpi_milestones.update({
        where: { id: milestone.id },
        data: {
          completed_at: completing ? new Date() : null,
          completed_by_id: completing ? user.sub : null,
        },
      });
      if (completing && kpi.status === 'ACTIVE') {
        await tx.kpis.update({
          where: { id: kpi.id },
          data: { status: 'IN_PROGRESS', updated_at: new Date() },
        });
      }
      return updated;
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
    this.assertAuthor(kpi, user);
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
   * Throws `BadRequestException` when neither a target nor a weight is sent, or
   * when the KPI is locked or cancelled.
   */
  async createRevision(
    id: string,
    dto: CreateKpiRevisionDto,
    user: JwtPayload,
  ) {
    const kpi = await this.loadKpi(id);
    this.assertAuthor(kpi, user);
    if (kpi.status === 'LOCKED' || kpi.status === 'CANCELLED') {
      throw new BadRequestException(`A ${kpi.status} KPI cannot be revised`);
    }
    if (dto.new_target === undefined && dto.new_weight === undefined) {
      throw new BadRequestException('A revision has to change the target or the weight');
    }
    if (dto.new_target !== undefined && kpi.mode !== 'QUANTITATIVE') {
      throw new BadRequestException('Only a quantitative KPI has a target to revise');
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
   * KPIs the caller may see, newest period first.
   *
   * Department scope decides the default set: the MD office sees everything, a
   * HOD sees their departments, and an employee sees the KPIs that are theirs.
   * Filters narrow that; they never widen it.
   */
  async list(filter: KpiFilterDto, user: JwtPayload) {
    const where = await this.visibilityFilter(user);

    if (filter.scope) where.scope = filter.scope;
    if (filter.status) where.status = filter.status;
    if (filter.owner_user_id) where.owner_user_id = filter.owner_user_id;
    if (filter.department_id) where.department_id = filter.department_id;
    if (filter.project_id) where.project_id = filter.project_id;

    if (filter.month && filter.year) {
      const { start, end } = monthWindow(filter.year, filter.month);
      where.period_start = { lte: end };
      where.period_end = { gte: start };
    }

    const rows = await this.prisma.kpis.findMany({
      where,
      orderBy: [{ period_start: 'desc' }, { created_at: 'desc' }],
      take: 200,
    });
    return attachUsers(this.prisma, rows, ['owner_user_id', 'created_by_id']);
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
   * annual KPI can be carried at the same time. Cancelled KPIs come back in the
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
        status: { notIn: ['DRAFT', 'PENDING_APPROVAL'] },
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

  /** The author of a KPI, or the MD office, which can act on any of them. */
  private assertAuthor(kpi: { created_by_id: string }, user: JwtPayload) {
    if (kpi.created_by_id === user.sub) return;
    if (KPI_APPROVER_ROLES.includes(user.role)) return;
    throw new ForbiddenException('Only the author can change this KPI');
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
    kpi: { created_by_id: string; owner_user_id: string | null },
    user: JwtPayload,
  ) {
    if (kpi.owner_user_id === user.sub) return false;
    if (kpi.created_by_id === user.sub) return true;
    return (
      KPI_APPROVER_ROLES.includes(user.role) || user.role === role_enum.HOD
    );
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
