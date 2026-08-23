// src/modules/holidays/holidays.service.ts

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, role_enum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DepartmentScopeService } from '../../common/services/department-scope.service';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import {
  EffectiveHoliday,
  HolidayRow,
  holidayDateKey,
  mergeEffectiveCalendar,
} from './holiday-calendar';

/** What `GET /holidays` returns per row. */
export interface HolidayView {
  id: string;
  name: string;
  date: string;
  isOptional: boolean;
  departmentId: string | null;
  departmentName: string | null;
  tier: 'COMMON' | 'DEPARTMENT';
}

/** What `GET /holidays/upcoming` returns per row. */
export interface UpcomingHolidayView extends HolidayView {
  daysUntil: number;
}

const SELECT = {
  id: true,
  name: true,
  holiday_date: true,
  is_optional: true,
  department_id: true,
} as const;

const MS_PER_DAY = 86_400_000;

/** Today at UTC midnight, so it compares against a Postgres `date` cleanly. */
function todayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

@Injectable()
export class HolidaysService {
  private readonly logger = new Logger(HolidaysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentScopeService: DepartmentScopeService,
  ) {}

  /**
   * The effective holiday calendar for the caller: every common holiday plus
   * the holidays of the departments they belong to.
   *
   * @param user - the caller, whose departments decide what is visible
   * @param year - calendar year, defaulting to the current one
   * @returns rows sorted by date, each tagged with its tier
   */
  async findAll(user: JwtPayload, year?: number): Promise<HolidayView[]> {
    const departmentIds = await this.visibleDepartments(user);
    const rows = await this.prisma.holidays.findMany({
      where: {
        year: year ?? new Date().getUTCFullYear(),
        ...this.tierFilter(departmentIds),
      },
      select: SELECT,
    });

    return this.toViews(mergeEffectiveCalendar(rows, departmentIds));
  }

  /**
   * The next holidays on the caller's effective calendar, with a day count for
   * the dashboard banner.
   *
   * @param user - the caller
   * @param limit - how many to return, defaulting to five
   * @returns rows sorted by date, soonest first, today counting as zero days
   */
  async findUpcoming(
    user: JwtPayload,
    limit = 5,
  ): Promise<UpcomingHolidayView[]> {
    const departmentIds = await this.visibleDepartments(user);
    const today = todayUtc();

    // ponytail: no `take` in the query, because the merge drops rows after the
    // fact and a SQL limit would under-fill the banner. A company has tens of
    // holidays a year, not thousands. Bound it by year if that ever changes.
    const rows = await this.prisma.holidays.findMany({
      where: {
        holiday_date: { gte: today },
        ...this.tierFilter(departmentIds),
      },
      orderBy: { holiday_date: 'asc' },
      select: SELECT,
    });

    const merged = mergeEffectiveCalendar(rows, departmentIds).slice(0, limit);
    const views = await this.toViews(merged);

    return views.map((view) => ({
      ...view,
      daysUntil: Math.round(
        (new Date(`${view.date}T00:00:00.000Z`).getTime() - today.getTime()) /
          MS_PER_DAY,
      ),
    }));
  }

  /**
   * Add a holiday to either tier.
   *
   * @param dto - name, date, optional flag, and the department for the
   *   department-wise tier; omitting the department means company-wide
   * @param user - the caller, HR and ADMIN write any tier, a HOD writes only
   *   their own departments
   * @throws ForbiddenException when a HOD writes outside their departments or
   *   attempts a company-wide holiday
   * @throws ConflictException when the same holiday already exists on that date
   */
  async create(dto: CreateHolidayDto, user: JwtPayload): Promise<HolidayView> {
    const departmentId = dto.departmentId ?? null;
    await this.assertCanWrite(user, departmentId);

    const holidayDate = this.parseDate(dto.date);

    try {
      const created = await this.prisma.holidays.create({
        data: {
          name: dto.name,
          holiday_date: holidayDate,
          is_optional: dto.isOptional ?? false,
          department_id: departmentId,
          year: holidayDate.getUTCFullYear(),
          created_by_id: user.sub,
        },
        select: SELECT,
      });

      this.logger.log(
        `Holiday created: ${created.name} on ${holidayDateKey(created.holiday_date)}`,
      );
      return this.toSingleView(created);
    } catch (error) {
      throw this.translateDuplicate(error, dto.name, dto.date, departmentId);
    }
  }

  /**
   * Edit a holiday's name, date, optional flag, or tier.
   *
   * Moving between tiers changes who the holiday applies to, so the caller is
   * checked against the tier it is leaving as well as the one it is joining.
   * That is what stops a HOD moving a departmental holiday to company-wide, or
   * handing one to a department that is not theirs.
   *
   * @param id - holiday id
   * @param dto - the fields to change, all optional. `departmentId: null`
   *   returns the holiday to the common tier; omitting it leaves the tier alone
   * @param user - the caller, checked against both tiers
   * @throws NotFoundException when no such holiday exists
   * @throws ForbiddenException when either tier is outside the caller's
   *   authority
   * @throws ConflictException when the edit collides with an existing holiday
   */
  async update(
    id: string,
    dto: UpdateHolidayDto,
    user: JwtPayload,
  ): Promise<HolidayView> {
    const existing = await this.prisma.holidays.findUnique({
      where: { id },
      select: SELECT,
    });
    if (!existing) {
      throw new NotFoundException('Holiday not found');
    }

    const movesTier = dto.departmentId !== undefined;
    const nextDepartmentId = movesTier
      ? (dto.departmentId ?? null)
      : existing.department_id;

    await this.assertCanWrite(user, existing.department_id);
    if (movesTier && nextDepartmentId !== existing.department_id) {
      await this.assertCanWrite(user, nextDepartmentId);
    }

    const holidayDate = dto.date ? this.parseDate(dto.date) : undefined;

    try {
      const updated = await this.prisma.holidays.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.isOptional !== undefined
            ? { is_optional: dto.isOptional }
            : {}),
          ...(holidayDate
            ? { holiday_date: holidayDate, year: holidayDate.getUTCFullYear() }
            : {}),
          ...(movesTier ? { department_id: nextDepartmentId } : {}),
        },
        select: SELECT,
      });

      return this.toSingleView(updated);
    } catch (error) {
      throw this.translateDuplicate(
        error,
        dto.name ?? existing.name,
        dto.date ?? holidayDateKey(existing.holiday_date),
        nextDepartmentId,
      );
    }
  }

  /**
   * Remove a holiday.
   *
   * @param id - holiday id
   * @param user - the caller, checked against the row's tier
   * @returns the deleted id, so the client can drop it from its cache
   * @throws NotFoundException when no such holiday exists
   * @throws ForbiddenException when the row is outside the caller's departments
   */
  async remove(id: string, user: JwtPayload): Promise<{ id: string }> {
    const existing = await this.prisma.holidays.findUnique({
      where: { id },
      select: { id: true, name: true, department_id: true },
    });
    if (!existing) {
      throw new NotFoundException('Holiday not found');
    }
    await this.assertCanWrite(user, existing.department_id);

    await this.prisma.holidays.delete({ where: { id } });
    this.logger.log(`Holiday deleted: ${existing.name}`);
    return { id };
  }

  /**
   * Departments whose holidays the caller can see, or null for every one.
   *
   * HR administers the calendar company-wide but is not in
   * `DepartmentScopeService`'s unrestricted list, because for tasks and scores
   * it is not unrestricted. Holidays are the exception, so the widening is here
   * rather than in the shared service where it would leak into every module.
   */
  private async visibleDepartments(user: JwtPayload): Promise<string[] | null> {
    if (user.role === role_enum.HR) {
      return null;
    }
    const scope =
      await this.departmentScopeService.resolveDepartmentScope(user);
    return scope.unrestricted ? null : scope.departmentIds;
  }

  /**
   * Reject a write outside the caller's authority.
   *
   * HR and ADMIN write both tiers. Everything else that reaches here is a HOD,
   * who may write only their own departments and never the common tier, which
   * applies to the whole company. The UI hides the controls; this is the check
   * that actually holds.
   */
  private async assertCanWrite(
    user: JwtPayload,
    departmentId: string | null,
  ): Promise<void> {
    if (user.role === role_enum.HR || user.role === role_enum.ADMIN) {
      // A HOD's department is proven by the scope check below. HR and ADMIN
      // pass any id, so an unknown one has to be caught here or it reaches
      // Postgres as a foreign key violation and surfaces as a 500.
      if (departmentId !== null) await this.assertDepartmentExists(departmentId);
      return;
    }

    if (departmentId === null) {
      throw new ForbiddenException(
        'A company-wide holiday can only be set by HR',
      );
    }

    const scope =
      await this.departmentScopeService.resolveDepartmentScope(user);
    if (!scope.departmentIds.includes(departmentId)) {
      throw new ForbiddenException(
        'You can only manage holidays for your own department',
      );
    }
  }

  /** @throws NotFoundException when the department is missing or deactivated. */
  private async assertDepartmentExists(departmentId: string): Promise<void> {
    const department = await this.prisma.departments.findFirst({
      where: { id: departmentId, is_active: true },
      select: { id: true },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
  }

  /** Restrict a query to the common tier plus the given departments. */
  private tierFilter(departmentIds: string[] | null): Prisma.holidaysWhereInput {
    if (departmentIds === null) {
      return {};
    }
    return {
      OR: [{ department_id: null }, { department_id: { in: departmentIds } }],
    };
  }

  private parseDate(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
  }

  private toView(row: HolidayRow, departmentName: string | null): HolidayView {
    return {
      id: row.id,
      name: row.name,
      date: holidayDateKey(row.holiday_date),
      isOptional: row.is_optional,
      departmentId: row.department_id,
      departmentName,
      tier: row.department_id === null ? 'COMMON' : 'DEPARTMENT',
    };
  }

  /**
   * Attach department names and flatten to the wire shape. Phase 2 tables carry
   * plain FK columns with no `@relation`, so the names come from one extra
   * query rather than an `include`.
   */
  private async toViews(rows: EffectiveHoliday[]): Promise<HolidayView[]> {
    const departmentIds = [
      ...new Set(
        rows
          .map((row) => row.department_id)
          .filter((id): id is string => id !== null),
      ),
    ];

    const names = new Map<string, string>();
    if (departmentIds.length) {
      const departments = await this.prisma.departments.findMany({
        where: { id: { in: departmentIds } },
        select: { id: true, name: true },
      });
      departments.forEach((department) =>
        names.set(department.id, department.name),
      );
    }

    return rows.map((row) =>
      this.toView(
        row,
        row.department_id ? (names.get(row.department_id) ?? null) : null,
      ),
    );
  }

  /** The same shape for a single row, without the batched name lookup. */
  private async toSingleView(row: HolidayRow): Promise<HolidayView> {
    if (row.department_id === null) {
      return this.toView(row, null);
    }
    const department = await this.prisma.departments.findUnique({
      where: { id: row.department_id },
      select: { name: true },
    });
    return this.toView(row, department?.name ?? null);
  }

  /**
   * Turn Prisma's unique violation into a 409 that names the clash.
   *
   * Two indexes can fire: the model's `[holiday_date, name, department_id]`,
   * and `holidays_common_uniq`, a partial index that stops a second
   * company-wide row on the same date and name where the NULL department would
   * otherwise let it through. Both mean the same thing to the caller, and
   * without this they both surface as a 500.
   */
  private translateDuplicate(
    error: unknown,
    name: string,
    date: string,
    departmentId: string | null,
  ): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const tier = departmentId === null ? 'company-wide' : 'department';
      return new ConflictException(
        `"${name}" is already a ${tier} holiday on ${date}`,
      );
    }
    return error;
  }
}
