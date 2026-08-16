import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  leave_applications,
  leave_status_enum,
  leave_types,
  notification_type_enum,
  Prisma,
  role_enum,
} from '@prisma/client';
import * as ExcelJS from 'exceljs';

import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotifyInput } from '../notifications/notification-channels.constants';
import { DepartmentScopeService } from '../../common/services/department-scope.service';
import { DepartmentQueryHelper } from '../../common/helpers/department-query.helper';
import { attachUsers, lookupUsers } from '../../common/helpers/user-lookup.helper';
import { JwtPayload } from '../../common/types/jwt-payload.type';

import { CreateLeaveApplicationDto } from './dto/create-leave-application.dto';
import {
  ApproveLeaveDto,
  HrCancelLeaveDto,
  RejectLeaveDto,
} from './dto/leave-decision.dto';
import {
  LeaveApplicationFilterDto,
  LeaveBalanceFilterDto,
  LeaveCalendarQueryDto,
  MonthlyReportQueryDto,
} from './dto/leave-query.dto';
import { CreateLeaveTypeDto, UpdateLeaveTypeDto } from './dto/leave-type.dto';
import { UpdateLeaveBalanceDto } from './dto/update-leave-balance.dto';
import {
  countLeaveDays,
  financialYearOf,
  MIN_LEAVE_DAYS,
  monthRange,
  parseDateOnly,
  remainingDays,
  toDateKey,
} from './leave-days';

/** The user fields every leave decision needs about the applicant. */
type Applicant = {
  id: string;
  full_name: string;
  role: role_enum;
  department_id: string | null;
  reporting_to_id: string | null;
};

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly departmentScope: DepartmentScopeService,
  ) {}

  // ------------------------------------------------------------- applications

  /**
   * Submit an application after running every validation rule.
   *
   * Throws `BadRequestException` carrying an array of every failure at once,
   * not the first one. The form is filled on a phone and a one-error-at-a-time
   * loop is what makes people go back to WhatsApp.
   *
   * Throws `NotFoundException` if the leave type is missing or inactive.
   * Assumes the caller exists; the JWT guard has already established that.
   */
  async create(dto: CreateLeaveApplicationDto, user: JwtPayload) {
    const [type, applicant] = await Promise.all([
      this.prisma.leave_types.findUnique({ where: { id: dto.leave_type_id } }),
      this.loadApplicant(user.sub),
    ]);
    if (!type || !type.is_active) {
      throw new NotFoundException('Leave type not found');
    }

    const start = parseDateOnly(dto.start_date);
    const end = parseDateOnly(dto.end_date);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Dates must be in YYYY-MM-DD form');
    }

    const failures: string[] = [];
    const orderedRange = end.getTime() >= start.getTime();
    if (!orderedRange) {
      failures.push('The end date is before the start date.');
    }

    let days = 0;
    if (orderedRange) {
      const overlap = await this.prisma.leave_applications.findFirst({
        where: {
          user_id: user.sub,
          status: {
            in: [leave_status_enum.PENDING, leave_status_enum.APPROVED],
          },
          start_date: { lte: end },
          end_date: { gte: start },
        },
        select: { start_date: true, end_date: true, status: true },
      });
      if (overlap) {
        failures.push(
          `These dates overlap an existing ${overlap.status.toLowerCase()} application from ${toDateKey(overlap.start_date)} to ${toDateKey(overlap.end_date)}.`,
        );
      }

      const holidays = await this.holidayKeys(
        applicant.department_id,
        start,
        end,
      );
      days = countLeaveDays(start, end, holidays);
      if (days === 0) {
        failures.push(
          'Every day in this range is a holiday or a weekly off, so there is nothing to apply for.',
        );
      } else if (days < MIN_LEAVE_DAYS) {
        failures.push(`Leave must be at least ${MIN_LEAVE_DAYS} day.`);
      }
    }

    const year = financialYearOf(start);
    if (type.is_paid && days > 0) {
      const balance = await this.ensureBalance(user.sub, type, year);
      const remaining = remainingDays(balance);
      if (remaining < days) {
        failures.push(
          `Your ${type.name} balance is ${remaining} day(s) and this application needs ${days}.`,
        );
      }
    }

    if (type.requires_proof && !dto.attachment_url) {
      failures.push(`${type.name} requires a supporting document.`);
    }

    if (failures.length > 0) {
      throw new BadRequestException(failures);
    }

    const managerId = await this.resolveManagerId(applicant);
    const application = await this.prisma.leave_applications.create({
      data: {
        user_id: user.sub,
        leave_type_id: type.id,
        start_date: start,
        end_date: end,
        days_count: new Prisma.Decimal(days),
        reason: dto.reason.trim(),
        manager_id: managerId,
        attachment_url: dto.attachment_url ?? null,
      },
    });

    await this.notifySubmitted(application, applicant, type.name, managerId);
    return this.decorateOne(application);
  }

  /** The caller's own applications, newest first. */
  async findMine(user: JwtPayload, filter: LeaveApplicationFilterDto) {
    const where: Prisma.leave_applicationsWhereInput = {
      user_id: user.sub,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.leave_type_id ? { leave_type_id: filter.leave_type_id } : {}),
    };
    return this.paginate(where, filter);
  }

  /**
   * Applications waiting on the caller.
   *
   * HR and MD see every pending application company-wide. A HOD sees the ones
   * routed to them plus anyone in their departments. The caller's own
   * application is never in the list, because nobody approves their own leave
   * and an unactionable row on an approval screen is just a trap.
   *
   * Each row carries the applicant's remaining balance for that type, which is
   * the number a HOD needs before deciding and has no other endpoint to get.
   */
  async findPending(user: JwtPayload, filter: LeaveApplicationFilterDto) {
    const visible = await this.visibleUserIds(user);
    const where: Prisma.leave_applicationsWhereInput = {
      status: leave_status_enum.PENDING,
      user_id: { not: user.sub },
      ...(filter.leave_type_id ? { leave_type_id: filter.leave_type_id } : {}),
      ...(visible === null
        ? {}
        : { OR: [{ manager_id: user.sub }, { user_id: { in: visible } }] }),
    };

    const page = await this.paginate(where, filter, { created_at: 'asc' });
    const balances = await this.balancesFor(page.items);
    return {
      ...page,
      items: page.items.map((item) => ({
        ...item,
        applicant_balance:
          balances.get(
            this.balanceKey(
              item.user_id,
              item.leave_type_id,
              financialYearOf(item.start_date),
            ),
          ) ?? null,
      })),
    };
  }

  /**
   * One application in full.
   *
   * Throws `NotFoundException` when it does not exist and `ForbiddenException`
   * when the caller is neither the applicant nor somebody who could act on it.
   */
  async findOne(id: string, user: JwtPayload) {
    const application = await this.getApplication(id);
    if (application.user_id !== user.sub) {
      await this.assertCanAct(application, user);
    }
    return this.decorateOne(application);
  }

  /**
   * The applicant withdraws their own pending application.
   *
   * Nothing was deducted while it was pending, so no balance moves. Throws
   * `ConflictException` once it has been approved or rejected, because at that
   * point the employee needs HR rather than a withdraw button.
   */
  async cancelOwn(id: string, user: JwtPayload) {
    const application = await this.getApplication(id);
    if (application.user_id !== user.sub) {
      throw new ForbiddenException('This application is not yours to withdraw');
    }

    const withdrawn = await this.prisma.leave_applications.updateMany({
      where: {
        id,
        user_id: user.sub,
        status: leave_status_enum.PENDING,
      },
      data: {
        status: leave_status_enum.CANCELLED,
        cancelled_by_id: user.sub,
        cancelled_at: new Date(),
        updated_at: new Date(),
      },
    });
    if (withdrawn.count === 0) {
      throw new ConflictException('Only a pending application can be withdrawn');
    }

    const type = await this.getType(application.leave_type_id);
    const people = await lookupUsers(this.prisma, [application.user_id]);
    const name = people.get(application.user_id)?.full_name ?? 'An employee';
    await this.notifyMany(
      await this.watcherIds(application, user.sub),
      {
        type: notification_type_enum.LEAVE_CANCELLED,
        title: 'Leave application withdrawn',
        message: `${name} withdrew their ${type.name} application for ${this.rangeLabel(application)}.`,
      },
      application.id,
    );

    return this.decorateOne(
      await this.getApplication(id),
    );
  }

  // ---------------------------------------------------------------- decisions

  /**
   * Approve and deduct, in one transaction.
   *
   * The status sits in the `where` clause of an `updateMany` rather than in an
   * `if` above it, so a HOD and HR clicking approve at the same moment produce
   * one deduction and one `ConflictException`, not two deductions. The balance
   * moves with `increment` so Postgres does the arithmetic and a concurrent
   * deduction on another application cannot lose an update.
   *
   * Throws `ForbiddenException` when the caller is the applicant or has no
   * authority over them, and `ConflictException` when it is no longer pending.
   */
  async approve(id: string, dto: ApproveLeaveDto, user: JwtPayload) {
    const application = await this.getApplication(id);
    this.assertNotSelf(application, user);
    await this.assertCanAct(application, user);

    const type = await this.getType(application.leave_type_id);
    // ponytail: leave spanning 31 March deducts wholly from the year it starts
    // in. Splitting it across two balances needs two rows and a rule for which
    // one runs out first, and nobody has asked. Upgrade path: count the days on
    // each side of the boundary and deduct twice, inside this same transaction.
    const year = financialYearOf(application.start_date);
    await this.ensureBalance(application.user_id, type, year);

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.leave_applications.updateMany({
        where: { id, status: leave_status_enum.PENDING },
        data: {
          status: leave_status_enum.APPROVED,
          approved_by_id: user.sub,
          approved_by_role: user.role,
          approved_at: now,
          approval_remark: dto.remark?.trim() ?? null,
          updated_at: now,
        },
      });
      if (locked.count === 0) {
        throw new ConflictException('Application is no longer pending approval');
      }

      await tx.leave_balances.update({
        where: {
          user_id_leave_type_id_year: {
            user_id: application.user_id,
            leave_type_id: application.leave_type_id,
            year,
          },
        },
        data: { used: { increment: application.days_count }, updated_at: now },
      });
    });

    await this.notifyDecision(application, user, type.name, 'APPROVED');
    return this.decorateOne(await this.getApplication(id));
  }

  /**
   * Reject with a mandatory remark. The balance is untouched, because nothing
   * was ever deducted from it.
   *
   * Throws `ConflictException` if somebody else already closed the application.
   */
  async reject(id: string, dto: RejectLeaveDto, user: JwtPayload) {
    const application = await this.getApplication(id);
    this.assertNotSelf(application, user);
    await this.assertCanAct(application, user);

    const now = new Date();
    const locked = await this.prisma.leave_applications.updateMany({
      where: { id, status: leave_status_enum.PENDING },
      data: {
        status: leave_status_enum.REJECTED,
        approved_by_id: user.sub,
        approved_by_role: user.role,
        approved_at: now,
        approval_remark: dto.remark.trim(),
        updated_at: now,
      },
    });
    if (locked.count === 0) {
      throw new ConflictException('Application is no longer pending approval');
    }

    const type = await this.getType(application.leave_type_id);
    await this.notifyDecision(
      application,
      user,
      type.name,
      'REJECTED',
      dto.remark.trim(),
    );
    return this.decorateOne(await this.getApplication(id));
  }

  /**
   * HR cancels an already approved leave and credits the balance back.
   *
   * This is the mirror of `approve` and it is written out in full on purpose.
   * The obvious version is a plain `update` guarded by an `if`, and that one
   * credits twice when two HR users click cancel together. Nobody reports a
   * balance that came out too generous.
   *
   * Throws `ConflictException` when the application is not `APPROVED`.
   */
  async hrCancel(id: string, dto: HrCancelLeaveDto, user: JwtPayload) {
    const application = await this.getApplication(id);
    const type = await this.getType(application.leave_type_id);
    const year = financialYearOf(application.start_date);
    await this.ensureBalance(application.user_id, type, year);

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.leave_applications.updateMany({
        where: { id, status: leave_status_enum.APPROVED },
        data: {
          status: leave_status_enum.CANCELLED,
          cancelled_by_id: user.sub,
          cancelled_at: now,
          cancellation_reason: dto.cancellation_reason.trim(),
          updated_at: now,
        },
      });
      if (locked.count === 0) {
        throw new ConflictException('Application is not in an approved state');
      }

      await tx.leave_balances.update({
        where: {
          user_id_leave_type_id_year: {
            user_id: application.user_id,
            leave_type_id: application.leave_type_id,
            year,
          },
        },
        data: { used: { decrement: application.days_count }, updated_at: now },
      });
    });

    await this.notifyDecision(
      application,
      user,
      type.name,
      'HR_CANCELLED',
      dto.cancellation_reason.trim(),
    );
    return this.decorateOne(await this.getApplication(id));
  }

  // ----------------------------------------------------------------- calendar

  /**
   * Approved leave overlapping a window, for the month grid.
   *
   * Defaults to the current calendar month. Scoped the same way the pending
   * list is, plus the caller's own leave, so a HOD opening this from the
   * approval screen sees exactly the people the decision affects.
   */
  async calendar(query: LeaveCalendarQueryDto, user: JwtPayload) {
    const now = new Date();
    const thisMonth = monthRange(now.getUTCFullYear(), now.getUTCMonth() + 1);
    const from = query.from ? parseDateOnly(query.from) : thisMonth.start;
    const to = query.to ? parseDateOnly(query.to) : thisMonth.end;

    const visible = await this.visibleUserIds(user);
    const rows = await this.prisma.leave_applications.findMany({
      where: {
        status: leave_status_enum.APPROVED,
        start_date: { lte: to },
        end_date: { gte: from },
        ...(visible === null
          ? {}
          : { user_id: { in: [...new Set([...visible, user.sub])] } }),
      },
      orderBy: { start_date: 'asc' },
    });

    return {
      from: toDateKey(from),
      to: toDateKey(to),
      items: await this.decorate(rows),
    };
  }

  // ------------------------------------------------------------------ balance

  /**
   * The caller's balance for the current financial year, one entry per active
   * leave type.
   *
   * Creates the rows it does not find. That is the year rollover: no cron, no
   * job to fail silently at midnight on 1 April, at the cost of a read that
   * writes. See decisions.md.
   */
  async myBalance(user: JwtPayload) {
    const year = financialYearOf(new Date());
    const types = await this.prisma.leave_types.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    });

    const balances = await Promise.all(
      types.map(async (type) => {
        const row = await this.ensureBalance(user.sub, type, year);
        return {
          id: row.id,
          leave_type_id: type.id,
          leave_type: {
            id: type.id,
            name: type.name,
            is_paid: type.is_paid,
            requires_proof: type.requires_proof,
          },
          year,
          entitled: Number(row.entitled),
          used: Number(row.used),
          carried_over: Number(row.carried_over),
          remaining: remainingDays(row),
        };
      }),
    );

    return { year, balances };
  }

  /** Every balance row HR asked for, with the employee attached. */
  async listBalances(filter: LeaveBalanceFilterDto) {
    const rows = await this.prisma.leave_balances.findMany({
      where: {
        year: filter.year ?? financialYearOf(new Date()),
        ...(filter.user_id ? { user_id: filter.user_id } : {}),
        ...(filter.leave_type_id ? { leave_type_id: filter.leave_type_id } : {}),
      },
      orderBy: { updated_at: 'desc' },
    });

    const types = await this.typeMap(rows.map((r) => r.leave_type_id));
    const withUsers = await attachUsers(this.prisma, rows, ['user_id']);
    return withUsers.map((row) => ({
      ...row,
      remaining: remainingDays(row),
      leave_type: types.get(row.leave_type_id) ?? null,
    }));
  }

  /**
   * HR's manual correction of one balance row.
   *
   * Sets the columns outright rather than incrementing, because this exists for
   * migrated numbers that are simply wrong. Throws `NotFoundException` if the
   * row is gone.
   */
  async updateBalance(id: string, dto: UpdateLeaveBalanceDto) {
    const existing = await this.prisma.leave_balances.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Balance row not found');

    return this.prisma.leave_balances.update({
      where: { id },
      data: {
        ...(dto.entitled === undefined ? {} : { entitled: dto.entitled }),
        ...(dto.used === undefined ? {} : { used: dto.used }),
        ...(dto.carried_over === undefined
          ? {}
          : { carried_over: dto.carried_over }),
        updated_at: new Date(),
      },
    });
  }

  // -------------------------------------------------------------------- types

  /** Leave types. Everyone sees the active ones; HR and ADMIN see all of them. */
  async listTypes(user: JwtPayload) {
    const canSeeInactive =
      user.role === role_enum.HR || user.role === role_enum.ADMIN;
    return this.prisma.leave_types.findMany({
      where: canSeeInactive ? {} : { is_active: true },
      orderBy: { name: 'asc' },
    });
  }

  /** Throws `ConflictException` when the name is already taken. */
  async createType(dto: CreateLeaveTypeDto) {
    const clash = await this.prisma.leave_types.findUnique({
      where: { name: dto.name.trim() },
    });
    if (clash) throw new ConflictException('A leave type with that name exists');

    return this.prisma.leave_types.create({
      data: { ...dto, name: dto.name.trim() },
    });
  }

  /**
   * Edit a leave type. Entitlement changes apply to balance rows created after
   * the change, not retroactively; `PATCH /leave/balances/:id` is the tool for
   * fixing an existing year.
   */
  async updateType(id: string, dto: UpdateLeaveTypeDto) {
    const existing = await this.prisma.leave_types.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Leave type not found');

    return this.prisma.leave_types.update({
      where: { id },
      data: { ...dto, ...(dto.name ? { name: dto.name.trim() } : {}) },
    });
  }

  // ------------------------------------------------------------------ reports

  /**
   * Payroll reconciliation for one month: a row per employee per leave type
   * with days taken, days remaining, and how many of those days were unpaid.
   *
   * ponytail: an application is attributed wholly to the month its start date
   * falls in, and only employees with approved leave in the month get rows.
   * Ceiling: a leave running 29 March to 2 April lands entirely in March, and a
   * payroll run needing the split would be off by the April days. Upgrade path
   * is to clip each application to the month with `countLeaveDays`, which
   * already takes a range and the applicant's holiday set.
   */
  async monthlyReport(query: MonthlyReportQueryDto) {
    const now = new Date();
    const year = query.year ?? now.getUTCFullYear();
    const month = query.month ?? now.getUTCMonth() + 1;
    const { start, end } = monthRange(year, month);
    const financialYear = financialYearOf(start);

    const applications = await this.prisma.leave_applications.findMany({
      where: {
        status: leave_status_enum.APPROVED,
        start_date: { gte: start, lte: end },
      },
      select: { user_id: true, leave_type_id: true, days_count: true },
    });

    const taken = new Map<string, number>();
    for (const application of applications) {
      const key = `${application.user_id}:${application.leave_type_id}`;
      taken.set(key, (taken.get(key) ?? 0) + Number(application.days_count));
    }

    const [types, people, balances] = await Promise.all([
      this.typeMap(applications.map((a) => a.leave_type_id)),
      lookupUsers(
        this.prisma,
        applications.map((a) => a.user_id),
      ),
      this.prisma.leave_balances.findMany({
        where: {
          year: financialYear,
          user_id: { in: applications.map((a) => a.user_id) },
          leave_type_id: { in: applications.map((a) => a.leave_type_id) },
        },
      }),
    ]);

    const remaining = new Map(
      balances.map((b) => [
        `${b.user_id}:${b.leave_type_id}`,
        remainingDays(b),
      ]),
    );

    const rows = [...taken.entries()].map(([key, days]) => {
      const [userId = '', typeId = ''] = key.split(':');
      const type = types.get(typeId);
      const person = people.get(userId);
      return {
        user_id: userId,
        employee_name: person?.full_name ?? 'Unknown',
        employee_email: person?.email ?? '',
        leave_type_id: typeId,
        leave_type_name: type?.name ?? 'Unknown',
        days_taken: days,
        days_remaining: remaining.get(key) ?? 0,
        unpaid_days: type?.is_paid === false ? days : 0,
      };
    });

    rows.sort(
      (a, b) =>
        a.employee_name.localeCompare(b.employee_name) ||
        a.leave_type_name.localeCompare(b.leave_type_name),
    );

    return { year, month, financial_year: financialYear, rows };
  }

  /**
   * The same report as an xlsx buffer, following the VMS dashboard export.
   *
   * Returns the buffer and the filename; the controller sets the headers.
   */
  async exportMonthly(query: MonthlyReportQueryDto) {
    const report = await this.monthlyReport(query);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(
      `Leave ${String(report.month).padStart(2, '0')}-${report.year}`,
    );
    sheet.columns = [
      { header: 'Employee', key: 'employee_name', width: 28 },
      { header: 'Email', key: 'employee_email', width: 30 },
      { header: 'Leave Type', key: 'leave_type_name', width: 22 },
      { header: 'Days Taken', key: 'days_taken', width: 14 },
      { header: 'Days Remaining', key: 'days_remaining', width: 16 },
      { header: 'Unpaid Days', key: 'unpaid_days', width: 14 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
    report.rows.forEach((row) => sheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buffer),
      filename: `Leave-Report-${report.year}-${String(report.month).padStart(2, '0')}.xlsx`,
    };
  }

  // ------------------------------------------------------------------ balance
  //                                                                  internals

  /**
   * Read a balance row, creating it if the year has none.
   *
   * This is the whole of year rollover. `upsert` rather than `create` because
   * two tabs opening the balance screen at once would otherwise race on the
   * unique index and one of them would 500.
   */
  private async ensureBalance(
    userId: string,
    type: leave_types,
    year: number,
  ) {
    const where = {
      user_id_leave_type_id_year: {
        user_id: userId,
        leave_type_id: type.id,
        year,
      },
    };

    const existing = await this.prisma.leave_balances.findUnique({ where });
    if (existing) return existing;

    const carried = await this.carryForward(userId, type, year);
    return this.prisma.leave_balances.upsert({
      where,
      create: {
        user_id: userId,
        leave_type_id: type.id,
        year,
        entitled: type.annual_entitlement,
        carried_over: carried,
      },
      update: {},
    });
  }

  /** What last year leaves behind, capped at the type's `max_carry_forward`. */
  private async carryForward(userId: string, type: leave_types, year: number) {
    if (!type.carry_forward || type.max_carry_forward <= 0) return 0;

    const prior = await this.prisma.leave_balances.findUnique({
      where: {
        user_id_leave_type_id_year: {
          user_id: userId,
          leave_type_id: type.id,
          year: year - 1,
        },
      },
    });
    if (!prior) return 0;

    return Math.max(
      0,
      Math.min(remainingDays(prior), type.max_carry_forward),
    );
  }

  private balanceKey(userId: string, typeId: string, year: number) {
    return `${userId}:${typeId}:${year}`;
  }

  /** Remaining balances for a page of applications, in one query. */
  private async balancesFor(
    rows: { user_id: string; leave_type_id: string; start_date: Date }[],
  ) {
    if (rows.length === 0) return new Map<string, number>();

    const balances = await this.prisma.leave_balances.findMany({
      where: {
        user_id: { in: rows.map((r) => r.user_id) },
        leave_type_id: { in: rows.map((r) => r.leave_type_id) },
        year: { in: rows.map((r) => financialYearOf(r.start_date)) },
      },
    });

    return new Map(
      balances.map((b) => [
        this.balanceKey(b.user_id, b.leave_type_id, b.year),
        remainingDays(b),
      ]),
    );
  }

  // --------------------------------------------------------------- visibility

  /**
   * The user ids whose leave the caller may see, or `null` for company-wide.
   *
   * HR is company-wide by policy and is not in `DepartmentScopeService`'s
   * unrestricted list, so it is named here. Everyone else goes through the
   * scope service, because four of the eight roles belong to more than one
   * department and `users.department_id` does not describe them.
   */
  private async visibleUserIds(user: JwtPayload): Promise<string[] | null> {
    if (user.role === role_enum.HR) return null;

    const scope = await this.departmentScope.resolveDepartmentScope(user);
    if (scope.unrestricted) return null;

    const rows = await this.prisma.users.findMany({
      where: {
        deleted_at: null,
        ...DepartmentQueryHelper.buildUserDepartmentFilter(scope),
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /**
   * Nobody approves their own leave. Enforced here rather than in the UI,
   * because with one approval stage and company-wide HR authority a self
   * approval is otherwise a single click with nothing in its way. An approver's
   * own application routes to the MD instead.
   */
  private assertNotSelf(application: leave_applications, user: JwtPayload) {
    if (application.user_id === user.sub) {
      throw new ForbiddenException(
        'You cannot action your own leave application. It routes to the MD.',
      );
    }
  }

  /**
   * Throws `ForbiddenException` unless the caller has authority over this
   * application: the routed manager, HR, the MD, or a HOD of the applicant's
   * department.
   *
   * The department path is deliberately restricted to HOD. Reading it as "any
   * role whose scope covers the applicant" would let one employee open a
   * colleague's leave reason, and the reason field is where people write down
   * why they are in hospital.
   */
  private async assertCanAct(
    application: leave_applications,
    user: JwtPayload,
  ) {
    if (application.manager_id === user.sub) return;
    if (user.role === role_enum.HR || user.role === role_enum.MD) return;

    if (user.role === role_enum.HOD) {
      const visible = await this.visibleUserIds(user);
      if (visible === null || visible.includes(application.user_id)) return;
    }

    throw new ForbiddenException('This application is not yours to action');
  }

  // ------------------------------------------------------------ notifications

  /**
   * Everyone who was told about the submission and should hear the outcome:
   * the routed manager and every active HR user, minus whoever is acting.
   */
  private async watcherIds(
    application: leave_applications,
    actorId: string,
  ): Promise<string[]> {
    const hr = await this.prisma.users.findMany({
      where: { role: role_enum.HR, is_active: true, deleted_at: null },
      select: { id: true },
    });

    const ids = new Set(hr.map((u) => u.id));
    if (application.manager_id) ids.add(application.manager_id);
    ids.delete(actorId);
    return [...ids];
  }

  private async notifyMany(
    recipientIds: string[],
    body: Pick<NotifyInput, 'type' | 'title' | 'message'>,
    applicationId: string,
  ) {
    if (recipientIds.length === 0) return;
    await this.notifications.notifyMany(
      recipientIds.map((recipientId) => ({
        ...body,
        recipientId,
        entityType: 'leave' as const,
        entityId: applicationId,
      })),
    );
  }

  private rangeLabel(application: leave_applications) {
    return `${toDateKey(application.start_date)} to ${toDateKey(application.end_date)} (${Number(application.days_count)} day(s))`;
  }

  /**
   * Tell the approvers a new application arrived.
   *
   * When no manager resolved, the MD joins the list and the message says so,
   * rather than the application sitting in a queue nobody owns.
   */
  private async notifySubmitted(
    application: leave_applications,
    applicant: Applicant,
    typeName: string,
    managerId: string | null,
  ) {
    // An approver's own leave, or an application with no reporting line, is the
    // only case where the MD is in this chain.
    const roles: role_enum[] = [role_enum.HR];
    if (
      !managerId ||
      applicant.role === role_enum.HR ||
      applicant.role === role_enum.HOD
    ) {
      roles.push(role_enum.MD);
    }

    const approvers = await this.prisma.users.findMany({
      where: { role: { in: roles }, is_active: true, deleted_at: null },
      select: { id: true },
    });

    const ids = new Set(approvers.map((u) => u.id));
    if (managerId) ids.add(managerId);
    ids.delete(applicant.id);

    const unrouted = managerId
      ? ''
      : ' No reporting manager is set for this employee, so it needs HR or the MD.';

    await this.notifyMany(
      [...ids],
      {
        type: notification_type_enum.LEAVE_SUBMITTED,
        title: 'Leave application submitted',
        message: `${applicant.full_name} applied for ${typeName}, ${this.rangeLabel(application)}.${unrouted}`,
      },
      application.id,
    );
  }

  /**
   * Notify the applicant and the approvers who did not act.
   *
   * `detail` carries the rejection remark or the cancellation reason and is
   * mandatory for those two outcomes: an employee who gets "your leave was
   * rejected" with no reason asks in person, which is what this module exists
   * to stop.
   */
  private async notifyDecision(
    application: leave_applications,
    actor: JwtPayload,
    typeName: string,
    outcome: 'APPROVED' | 'REJECTED' | 'HR_CANCELLED',
    detail?: string,
  ) {
    const people = await lookupUsers(this.prisma, [
      application.user_id,
      actor.sub,
    ]);
    const applicantName =
      people.get(application.user_id)?.full_name ?? 'An employee';
    const actorName = people.get(actor.sub)?.full_name ?? 'an approver';
    const range = this.rangeLabel(application);
    const reason = detail ? ` Reason: ${detail}` : '';

    const copy = {
      APPROVED: {
        type: notification_type_enum.LEAVE_APPROVED,
        title: 'Leave approved',
        own: `Your ${typeName} for ${range} was approved by ${actorName}.`,
        watcher: `${applicantName}'s ${typeName} for ${range} was approved by ${actorName}.`,
      },
      REJECTED: {
        type: notification_type_enum.LEAVE_REJECTED,
        title: 'Leave rejected',
        own: `Your ${typeName} for ${range} was rejected by ${actorName}.${reason}`,
        watcher: `${applicantName}'s ${typeName} for ${range} was rejected by ${actorName}.${reason}`,
      },
      HR_CANCELLED: {
        type: notification_type_enum.LEAVE_HR_CANCELLED,
        title: 'Approved leave cancelled',
        own: `Your approved ${typeName} for ${range} was cancelled by ${actorName} and the balance credited back.${reason}`,
        watcher: `${applicantName}'s approved ${typeName} for ${range} was cancelled by ${actorName}.${reason}`,
      },
    }[outcome];

    await this.notifications.notify({
      recipientId: application.user_id,
      type: copy.type,
      title: copy.title,
      message: copy.own,
      entityType: 'leave',
      entityId: application.id,
    });

    const watchers = new Set(
      await this.watcherIds(application, actor.sub),
    );
    // The approver who granted it is the one HR cancellation surprises.
    if (outcome === 'HR_CANCELLED' && application.approved_by_id) {
      watchers.add(application.approved_by_id);
    }
    watchers.delete(application.user_id);
    watchers.delete(actor.sub);

    await this.notifyMany(
      [...watchers],
      { type: copy.type, title: copy.title, message: copy.watcher },
      application.id,
    );
  }

  // ---------------------------------------------------------------- plumbing

  private async getApplication(id: string) {
    const application = await this.prisma.leave_applications.findUnique({
      where: { id },
    });
    if (!application) throw new NotFoundException('Leave application not found');
    return application;
  }

  private async getType(id: string) {
    const type = await this.prisma.leave_types.findUnique({ where: { id } });
    if (!type) throw new NotFoundException('Leave type not found');
    return type;
  }

  private async loadApplicant(id: string): Promise<Applicant> {
    const user = await this.prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        full_name: true,
        role: true,
        department_id: true,
        reporting_to_id: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Who the application goes to. The reporting line first, then any HOD of the
   * applicant's department, then nobody, which submission handles by pulling
   * the MD into the notification instead of dropping the application.
   */
  private async resolveManagerId(applicant: Applicant): Promise<string | null> {
    if (applicant.reporting_to_id && applicant.reporting_to_id !== applicant.id) {
      return applicant.reporting_to_id;
    }
    if (!applicant.department_id) return null;

    const hod = await this.prisma.hod_departments.findFirst({
      where: {
        department_id: applicant.department_id,
        hod_id: { not: applicant.id },
      },
      select: { hod_id: true },
    });
    return hod?.hod_id ?? null;
  }

  /**
   * The applicant's effective holiday calendar for a range, as `YYYY-MM-DD`
   * keys: company-wide holidays plus their own department's.
   *
   * ponytail: reads `holidays` directly and keys off `users.department_id`
   * rather than the department scope service. `holidays.department_id` is a
   * single nullable column, so a single department is the only calendar the
   * table can express; a HOD across three departments with no primary
   * department gets the common holidays only. Upgrade path is a
   * `holiday_departments` junction the day a second department's calendar has
   * to apply to one person.
   *
   * Optional holidays are excluded: they are opt-in days people work through
   * unless they apply for leave, so treating them as non-working would silently
   * shrink every application that spans one.
   */
  private async holidayKeys(
    departmentId: string | null,
    start: Date,
    end: Date,
  ): Promise<ReadonlySet<string>> {
    const rows = await this.prisma.holidays.findMany({
      where: {
        holiday_date: { gte: start, lte: end },
        is_optional: false,
        OR: [
          { department_id: null },
          ...(departmentId ? [{ department_id: departmentId }] : []),
        ],
      },
      select: { holiday_date: true },
    });
    return new Set(rows.map((row) => toDateKey(row.holiday_date)));
  }

  private async typeMap(ids: string[]) {
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
      return new Map<string, Pick<leave_types, 'id' | 'name' | 'is_paid' | 'requires_proof'>>();
    }

    const types = await this.prisma.leave_types.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true, is_paid: true, requires_proof: true },
    });
    return new Map(types.map((type) => [type.id, type]));
  }

  private async paginate(
    where: Prisma.leave_applicationsWhereInput,
    filter: LeaveApplicationFilterDto,
    orderBy: Prisma.leave_applicationsOrderByWithRelationInput = {
      created_at: 'desc',
    },
  ) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const [rows, total] = await Promise.all([
      this.prisma.leave_applications.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.leave_applications.count({ where }),
    ]);

    return { items: await this.decorate(rows), total, page, limit };
  }

  /**
   * Phase 2 tables have no Prisma relations, so names and type labels are
   * stitched on here in two queries for the whole page rather than one per row.
   */
  private async decorate(rows: leave_applications[]) {
    if (rows.length === 0) return [];

    const types = await this.typeMap(rows.map((row) => row.leave_type_id));
    const withUsers = await attachUsers(this.prisma, rows, [
      'user_id',
      'manager_id',
      'approved_by_id',
      'cancelled_by_id',
    ]);

    return withUsers.map((row) => ({
      ...row,
      days_count: Number(row.days_count),
      leave_type: types.get(row.leave_type_id) ?? null,
    }));
  }

  private async decorateOne(row: leave_applications) {
    const [decorated] = await this.decorate([row]);
    if (!decorated) throw new NotFoundException('Leave application not found');
    return decorated;
  }
}
