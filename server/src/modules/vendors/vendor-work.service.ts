import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  deliverable_status_enum,
  notification_type_enum,
  role_enum,
  vendor_assignments,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { attachUsers } from '../../common/helpers/user-lookup.helper';
import { NotificationsService } from '../notifications/notifications.service';
import { VendorScopeService } from './vendor-scope.service';
import {
  CreateVendorAssignmentDto,
  UpdateVendorAssignmentDto,
} from './dto/work/vendor-assignment.dto';
import {
  CreateVendorContractDto,
  UpdateVendorContractDto,
} from './dto/work/vendor-contract.dto';
import {
  CreateVendorDocumentDto,
  VENDOR_DOCUMENT_PREFIX,
} from './dto/work/vendor-document.dto';
import {
  CreateVendorDeliverableDto,
  UpdateVendorDeliverableDto,
} from './dto/work/vendor-deliverable.dto';
import { CreateVendorNoteDto } from './dto/work/vendor-note.dto';
import { CreateVendorReviewDto } from './dto/work/vendor-review.dto';
import {
  VendorDeliverableQueryDto,
  VendorDocumentQueryDto,
  VendorNoteQueryDto,
  VendorWorkQueryDto,
} from './dto/work/vendor-work-query.dto';

/**
 * How close to an expiry or a deadline counts as soon.
 *
 * ponytail: one constant, not a settings row or an environment variable. Every
 * function below takes it as a defaulted argument, so a caller that needs a
 * different window passes one. Move it into a settings table the day the
 * client asks for a per-category window and not before.
 */
export const EXPIRY_WINDOW_DAYS = 30;

/** Derived state of a document, from its expiry date and today. Never stored. */
export type ExpiryStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED';

/** Derived state of anything with a date in the deadline view. */
export type DeadlineFlag = 'OVERDUE' | 'SOON' | 'UPCOMING';

const MS_PER_DAY = 86_400_000;

/** Midnight UTC of the calendar day a timestamp falls on, as epoch ms. */
function utcDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

/**
 * Whole calendar days from `from` to `target`, negative once `target` has
 * passed. Both ends are flattened to midnight UTC first, so a document that
 * expires today reads 0 whatever time of day the caller runs.
 *
 * Assumes date-only columns, which is what `@db.Date` gives back.
 */
export function daysUntil(target: Date, from: Date = new Date()): number {
  return Math.round((utcDay(target) - utcDay(from)) / MS_PER_DAY);
}

/**
 * The one expiry calculator. Read paths and the nightly sweep both call this,
 * because two of them drift apart by a day and then nobody can say which
 * screen is lying.
 *
 * A document with no expiry date is ACTIVE, not an error: a PAN card does not
 * expire and the column is nullable for exactly that reason.
 */
export function documentExpiryStatus(
  expiryDate: Date | null | undefined,
  today: Date = new Date(),
  windowDays: number = EXPIRY_WINDOW_DAYS,
): ExpiryStatus {
  if (!expiryDate) return 'ACTIVE';
  const days = daysUntil(expiryDate, today);
  if (days < 0) return 'EXPIRED';
  return days <= windowDays ? 'EXPIRING_SOON' : 'ACTIVE';
}

/** The same window applied to contract, assignment and deliverable dates. */
export function deadlineFlag(
  date: Date,
  today: Date = new Date(),
  windowDays: number = EXPIRY_WINDOW_DAYS,
): DeadlineFlag {
  const days = daysUntil(date, today);
  if (days < 0) return 'OVERDUE';
  return days <= windowDays ? 'SOON' : 'UPCOMING';
}

/**
 * Percentage of measurable deliverables submitted on or before their due date,
 * rounded to a whole number.
 *
 * Returns null rather than 0 when nothing is measurable. A vendor with no
 * submitted work has no on-time record, and reporting 0% would read as a
 * vendor that misses everything. Rows missing either date are skipped, so the
 * denominator is never zero by construction.
 */
export function onTimePercentage(
  rows: { due_date: Date | null; submitted_date: Date | null }[],
): number | null {
  const measurable = rows.flatMap((row) =>
    row.due_date && row.submitted_date
      ? [{ due: row.due_date, submitted: row.submitted_date }]
      : [],
  );
  if (measurable.length === 0) return null;

  const onTime = measurable.filter(
    (row) => daysUntil(row.due, row.submitted) >= 0,
  ).length;
  return Math.round((onTime / measurable.length) * 100);
}

/** One dated obligation in the deadline view. Assembled on read, never stored. */
export interface VendorDeadline {
  source:
    | 'contract_expiry'
    | 'contract_renewal'
    | 'document_expiry'
    | 'assignment_deadline'
    | 'deliverable_due';
  id: string;
  label: string;
  date: Date;
  days_until: number;
  flag: DeadlineFlag;
}

/** Deliverables nobody is waiting on any more. */
const CLOSED_DELIVERABLE_STATUSES: deliverable_status_enum[] = [
  deliverable_status_enum.ACCEPTED,
  deliverable_status_enum.REJECTED,
];

/**
 * Contracts, documents, deliverables, assignments, notes and reviews: the work
 * half of internal Vendor Management.
 *
 * Every method takes the caller and runs `VendorScopeService.assertAccess`
 * before touching a row. None of this is reachable by a `role_enum.VENDOR`
 * account: the controller lists internal roles only, and the access check
 * behind it needs a `vendor_dashboard_access` row a vendor cannot hold.
 */
@Injectable()
export class VendorWorkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: VendorScopeService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------------------------------------------------------------- assignments

  /**
   * Assignments, optionally narrowed to one vendor or one status.
   *
   * Throws ForbiddenException without vendor management access.
   */
  async findAssignments(query: VendorWorkQueryDto, user: JwtPayload) {
    await this.scope.assertAccess(user.sub, user.role, 'VENDOR_MANAGER');

    const rows = await this.prisma.vendor_assignments.findMany({
      where: this.vendorScopedWhere(query.vendor_id, query.status),
      orderBy: [{ deadline: 'asc' }, { created_at: 'desc' }],
    });
    return this.attachVendorNames(await attachUsers(this.prisma, rows, ['assigned_by_id']));
  }

  /**
   * Records what a vendor is being used for, and in the same row grants that
   * vendor's portal login sight of the entity named.
   *
   * Throws NotFoundException if the vendor does not exist and
   * ConflictException if this vendor is already assigned to this entity.
   */
  async createAssignment(dto: CreateVendorAssignmentDto, user: JwtPayload) {
    await this.scope.assertAccess(user.sub, user.role, 'VENDOR_MANAGER');
    await this.assertVendorExists(dto.vendor_id);

    let assignment: vendor_assignments;
    try {
      assignment = await this.prisma.vendor_assignments.create({
        data: {
          vendor_id: dto.vendor_id,
          entity_type: dto.entity_type,
          entity_id: dto.entity_id ?? null,
          assigned_by_id: user.sub,
          start_date: dto.start_date ? new Date(dto.start_date) : null,
          deadline: dto.deadline ? new Date(dto.deadline) : null,
          status: dto.status ?? 'ACTIVE',
          description: dto.description ?? null,
          priority: dto.priority ?? null,
        },
      });
    } catch (error) {
      throw this.asConflict(error, 'This vendor is already assigned to that item');
    }

    await this.announceAssignment(assignment);
    return assignment;
  }

  /**
   * Tells the vendor's portal logins that work landed.
   *
   * `VENDOR_TASK_ASSIGNED` existed in the enum and in the channel map from the
   * start of Phase 2 with nothing emitting it, so a vendor assigned work was
   * told nothing at all. This is the emitter.
   *
   * A vendor with no portal account yet is the normal case early on, and it is
   * not an error: the assignment stands and the notification has nowhere to go.
   * Delivery failure is NotificationsService's problem, not this method's.
   */
  private async announceAssignment(assignment: vendor_assignments) {
    const accounts = await this.prisma.users.findMany({
      where: {
        vendor_id: assignment.vendor_id,
        role: role_enum.VENDOR,
        deleted_at: null,
        is_active: true,
      },
      select: { id: true },
    });
    if (accounts.length === 0) return;

    const what = assignment.description?.trim() || assignment.entity_type;
    const due = assignment.deadline
      ? ` It is due ${assignment.deadline.toISOString().slice(0, 10)}.`
      : '';

    await this.notifications.notifyMany(
      accounts.map((account) => ({
        recipientId: account.id,
        type: notification_type_enum.VENDOR_TASK_ASSIGNED,
        title: 'New work assigned to you',
        message: `${what} has been assigned to you.${due}`,
        // `NotifyEntityType` has no assignment member and widening it would
        // touch every consumer that switches on it. The vendor is the entity;
        // the assignment id rides in metadata for the portal's deep link.
        entityType: 'vendor',
        entityId: assignment.vendor_id,
        metadata: { assignment_id: assignment.id },
      })),
    );
  }

  /**
   * Manager access, or the person who made the assignment working on their own
   * row. Either way a vendor management access row is required, so the
   * assigner exception relaxes the level rather than skipping the check.
   */
  async updateAssignment(
    id: string,
    dto: UpdateVendorAssignmentDto,
    user: JwtPayload,
  ) {
    const existing = await this.assignmentOrFail(id);
    await this.assertManagerOrOwner(user, existing.assigned_by_id);

    const data: Prisma.vendor_assignmentsUpdateInput = {};
    if (dto.start_date !== undefined) data.start_date = new Date(dto.start_date);
    if (dto.deadline !== undefined) data.deadline = new Date(dto.deadline);
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.priority !== undefined) data.priority = dto.priority;

    return this.prisma.vendor_assignments.update({ where: { id }, data });
  }

  /**
   * Deleting the row revokes the vendor's access to that entity as a side
   * effect, which is the intended behaviour and the reason this is a hard
   * delete rather than a status change.
   */
  async removeAssignment(id: string, user: JwtPayload) {
    const existing = await this.assignmentOrFail(id);
    await this.assertManagerOrOwner(user, existing.assigned_by_id);

    await this.prisma.vendor_assignments.delete({ where: { id } });
    return { message: 'Assignment removed' };
  }

  // ------------------------------------------------------------------ contracts

  /** Contracts, newest start date first. Commercial terms, internal only. */
  async findContracts(query: VendorWorkQueryDto, user: JwtPayload) {
    await this.scope.assertAccess(user.sub, user.role, 'VENDOR_MANAGER');

    const rows = await this.prisma.vendor_contracts.findMany({
      where: this.vendorScopedWhere(query.vendor_id, query.status),
      orderBy: { start_date: 'desc' },
    });
    return this.attachVendorNames(rows);
  }

  /**
   * Throws NotFoundException for an unknown vendor and ConflictException when
   * the contract number repeats for that vendor.
   */
  async createContract(dto: CreateVendorContractDto, user: JwtPayload) {
    await this.scope.assertAccess(user.sub, user.role, 'VENDOR_MANAGER');
    await this.assertVendorExists(dto.vendor_id);

    try {
      return await this.prisma.vendor_contracts.create({
        data: {
          vendor_id: dto.vendor_id,
          contract_number: dto.contract_number,
          contract_type: dto.contract_type ?? null,
          start_date: new Date(dto.start_date),
          end_date: dto.end_date ? new Date(dto.end_date) : null,
          renewal_date: dto.renewal_date ? new Date(dto.renewal_date) : null,
          status: dto.status ?? 'ACTIVE',
          description: dto.description ?? null,
        },
      });
    } catch (error) {
      throw this.asConflict(error, 'That contract number already exists for this vendor');
    }
  }

  /** Renewals land here. Throws NotFoundException for an unknown contract. */
  async updateContract(
    id: string,
    dto: UpdateVendorContractDto,
    user: JwtPayload,
  ) {
    await this.scope.assertAccess(user.sub, user.role, 'VENDOR_MANAGER');
    await this.contractOrFail(id);

    const data: Prisma.vendor_contractsUpdateInput = {};
    if (dto.contract_number !== undefined) data.contract_number = dto.contract_number;
    if (dto.contract_type !== undefined) data.contract_type = dto.contract_type;
    if (dto.start_date !== undefined) data.start_date = new Date(dto.start_date);
    if (dto.end_date !== undefined) data.end_date = new Date(dto.end_date);
    if (dto.renewal_date !== undefined) data.renewal_date = new Date(dto.renewal_date);
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.description !== undefined) data.description = dto.description;

    try {
      return await this.prisma.vendor_contracts.update({ where: { id }, data });
    } catch (error) {
      throw this.asConflict(error, 'That contract number already exists for this vendor');
    }
  }

  // ------------------------------------------------------------------ documents

  /** Documents with their expiry status computed, newest first. */
  async findDocuments(query: VendorDocumentQueryDto, user: JwtPayload) {
    await this.scope.assertAccess(user.sub, user.role, 'VENDOR_MANAGER');

    const rows = await this.prisma.vendor_documents.findMany({
      where: {
        ...(query.vendor_id ? { vendor_id: query.vendor_id } : {}),
        ...(query.category ? { category: query.category } : {}),
      },
      orderBy: { created_at: 'desc' },
    });

    const today = new Date();
    const withStatus = rows.map((row) => ({
      ...row,
      status: documentExpiryStatus(row.expiry_date, today),
    }));
    return this.attachVendorNames(
      await attachUsers(this.prisma, withStatus, ['uploaded_by_id']),
    );
  }

  /**
   * Records an already-uploaded file against a vendor.
   *
   * ponytail: the bytes go through the attachments module, which owns the only
   * Supabase client in the API, and this stores the object path it returns
   * under the `vendors/documents/` prefix. A path outside that prefix is
   * rejected, so this row cannot be made to point at another module's file.
   * Fold the upload into this route the day VendorsModule imports
   * AttachmentsModule.
   *
   * Throws BadRequestException on a foreign storage path and NotFoundException
   * for an unknown vendor.
   */
  async createDocument(dto: CreateVendorDocumentDto, user: JwtPayload) {
    await this.scope.assertAccess(user.sub, user.role, 'VENDOR_MANAGER');
    await this.assertVendorExists(dto.vendor_id);

    if (!dto.storage_path.startsWith(VENDOR_DOCUMENT_PREFIX)) {
      throw new BadRequestException(
        `Vendor documents must be stored under ${VENDOR_DOCUMENT_PREFIX}`,
      );
    }

    const row = await this.prisma.vendor_documents.create({
      data: {
        vendor_id: dto.vendor_id,
        contract_id: dto.contract_id ?? null,
        category: dto.category,
        document_type: dto.document_type,
        document_name: dto.document_name,
        issue_date: dto.issue_date ? new Date(dto.issue_date) : null,
        expiry_date: dto.expiry_date ? new Date(dto.expiry_date) : null,
        file_url: dto.file_url,
        storage_path: dto.storage_path,
        uploaded_by_id: user.sub,
      },
    });
    return { ...row, status: documentExpiryStatus(row.expiry_date) };
  }

  /**
   * Admin only, because a deleted compliance document is a gap nobody sees
   * until an audit.
   *
   * ponytail: drops the row, leaves the Supabase object. The uploader lives in
   * the attachments module and this one has no storage client; the orphan is
   * cheap and the alternative is a second Supabase client here.
   */
  async removeDocument(id: string, user: JwtPayload) {
    await this.scope.assertAccess(user.sub, user.role, 'VENDOR_ADMIN');

    const existing = await this.prisma.vendor_documents.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Document not found');

    await this.prisma.vendor_documents.delete({ where: { id } });
    return { message: 'Document deleted' };
  }

  // --------------------------------------------------------------- deliverables

  /** Deliverables, soonest due first. */
  async findDeliverables(query: VendorDeliverableQueryDto, user: JwtPayload) {
    await this.scope.assertAccess(user.sub, user.role, 'VENDOR_MANAGER');

    const rows = await this.prisma.vendor_deliverables.findMany({
      where: {
        ...(query.vendor_id ? { vendor_id: query.vendor_id } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ due_date: 'asc' }, { created_at: 'desc' }],
    });
    return this.attachVendorNames(
      await attachUsers(this.prisma, rows, ['owner_id']),
    );
  }

  /** Throws NotFoundException for an unknown vendor. */
  async createDeliverable(dto: CreateVendorDeliverableDto, user: JwtPayload) {
    await this.scope.assertAccess(user.sub, user.role, 'VENDOR_MANAGER');
    await this.assertVendorExists(dto.vendor_id);

    return this.prisma.vendor_deliverables.create({
      data: {
        vendor_id: dto.vendor_id,
        name: dto.name,
        description: dto.description ?? null,
        project_id: dto.project_id ?? null,
        owner_id: dto.owner_id,
        due_date: dto.due_date ? new Date(dto.due_date) : null,
        status: dto.status ?? deliverable_status_enum.PENDING,
        attachments: dto.attachments ?? [],
        remarks: dto.remarks ?? null,
      },
    });
  }

  /**
   * Manager access, or the deliverable's internal owner on their own row. As
   * with assignments the owner exception relaxes the required level, it does
   * not skip the access check.
   */
  async updateDeliverable(
    id: string,
    dto: UpdateVendorDeliverableDto,
    user: JwtPayload,
  ) {
    const existing = await this.deliverableOrFail(id);
    await this.assertManagerOrOwner(user, existing.owner_id);

    const data: Prisma.vendor_deliverablesUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.project_id !== undefined) data.project_id = dto.project_id;
    if (dto.owner_id !== undefined) data.owner_id = dto.owner_id;
    if (dto.due_date !== undefined) data.due_date = new Date(dto.due_date);
    if (dto.submitted_date !== undefined) data.submitted_date = new Date(dto.submitted_date);
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.attachments !== undefined) data.attachments = dto.attachments;
    if (dto.remarks !== undefined) data.remarks = dto.remarks;

    return this.prisma.vendor_deliverables.update({ where: { id }, data });
  }

  // --------------------------------------------------------------------- notes

  /**
   * Both note threads for one vendor, or one of them when `thread` is given.
   *
   * Internal only. The external portal must never reach this method whatever
   * it passes; the shared thread has `findSharedNotes` instead, so there is no
   * argument a portal caller could get wrong.
   */
  async findNotes(query: VendorNoteQueryDto, user: JwtPayload) {
    await this.scope.assertAccess(user.sub, user.role, 'VENDOR_VIEWER');

    const rows = await this.prisma.vendor_notes.findMany({
      where: {
        vendor_id: query.vendor_id,
        ...(query.thread ? { is_internal: query.thread === 'internal' } : {}),
      },
      orderBy: { created_at: 'desc' },
    });
    return attachUsers(this.prisma, rows, ['author_id']);
  }

  /**
   * The vendor communication thread, and only ever that.
   *
   * `is_internal: false` is written here rather than taken as an argument,
   * which is what makes the RUCHI-only thread unreachable from a portal query
   * path by construction rather than by remembering to pass the right flag.
   */
  async findSharedNotes(vendorId: string) {
    return this.prisma.vendor_notes.findMany({
      where: { vendor_id: vendorId, is_internal: false },
      orderBy: { created_at: 'desc' },
    });
  }

  /** Any vendor management level may write a note. Throws for an unknown vendor. */
  async createNote(dto: CreateVendorNoteDto, user: JwtPayload) {
    await this.scope.assertAccess(user.sub, user.role, 'VENDOR_VIEWER');
    await this.assertVendorExists(dto.vendor_id);

    return this.prisma.vendor_notes.create({
      data: {
        vendor_id: dto.vendor_id,
        author_id: user.sub,
        content: dto.content,
        is_internal: dto.is_internal ?? true,
      },
    });
  }

  // ------------------------------------------------------------------- reviews

  /** Internal ratings, newest review date first. Manager or admin only. */
  async findReviews(query: VendorWorkQueryDto, user: JwtPayload) {
    await this.scope.assertAccess(user.sub, user.role, 'VENDOR_MANAGER');

    const rows = await this.prisma.vendor_reviews.findMany({
      where: query.vendor_id ? { vendor_id: query.vendor_id } : {},
      orderBy: { review_date: 'desc' },
    });
    return attachUsers(this.prisma, rows, ['reviewer_id']);
  }

  /** Throws NotFoundException for an unknown vendor. */
  async createReview(dto: CreateVendorReviewDto, user: JwtPayload) {
    await this.scope.assertAccess(user.sub, user.role, 'VENDOR_MANAGER');
    await this.assertVendorExists(dto.vendor_id);

    return this.prisma.vendor_reviews.create({
      data: {
        vendor_id: dto.vendor_id,
        reviewer_id: user.sub,
        review_date: new Date(dto.review_date),
        rating: dto.rating,
        quality: dto.quality ?? null,
        timeliness: dto.timeliness ?? null,
        communication: dto.communication ?? null,
        reliability: dto.reliability ?? null,
        remarks: dto.remarks ?? null,
        action_required: dto.action_required ?? null,
      },
    });
  }

  // ----------------------------------------------------------------- deadlines

  /**
   * Every dated obligation for one vendor in one ascending list: contract
   * expiry and renewal, document expiry, assignment deadlines, deliverable due
   * dates.
   *
   * A read over four tables, not a table of its own. There is nothing to keep
   * in sync and nothing to backfill; the flag comes from the same window the
   * document status and the nightly sweep use.
   */
  async findDeadlines(vendorId: string, user: JwtPayload): Promise<VendorDeadline[]> {
    await this.scope.assertAccess(user.sub, user.role, 'VENDOR_VIEWER');
    await this.assertVendorExists(vendorId);

    const [contracts, documents, assignments, deliverables] = await Promise.all([
      this.prisma.vendor_contracts.findMany({
        where: { vendor_id: vendorId, status: { notIn: ['TERMINATED', 'EXPIRED'] } },
        select: { id: true, contract_number: true, end_date: true, renewal_date: true },
      }),
      this.prisma.vendor_documents.findMany({
        where: { vendor_id: vendorId, expiry_date: { not: null } },
        select: { id: true, document_name: true, expiry_date: true },
      }),
      this.prisma.vendor_assignments.findMany({
        where: { vendor_id: vendorId, status: 'ACTIVE', deadline: { not: null } },
        select: { id: true, entity_type: true, description: true, deadline: true },
      }),
      this.prisma.vendor_deliverables.findMany({
        where: {
          vendor_id: vendorId,
          due_date: { not: null },
          status: { notIn: CLOSED_DELIVERABLE_STATUSES },
        },
        select: { id: true, name: true, due_date: true },
      }),
    ]);

    const today = new Date();
    const rows: VendorDeadline[] = [];
    const add = (
      source: VendorDeadline['source'],
      id: string,
      label: string,
      date: Date | null,
    ) => {
      if (!date) return;
      rows.push({
        source,
        id,
        label,
        date,
        days_until: daysUntil(date, today),
        flag: deadlineFlag(date, today),
      });
    };

    for (const row of contracts) {
      add('contract_expiry', row.id, `Contract ${row.contract_number} expires`, row.end_date);
      add('contract_renewal', row.id, `Contract ${row.contract_number} renewal`, row.renewal_date);
    }
    for (const row of documents) {
      add('document_expiry', row.id, `${row.document_name} expires`, row.expiry_date);
    }
    for (const row of assignments) {
      add(
        'assignment_deadline',
        row.id,
        row.description ?? `${row.entity_type} assignment`,
        row.deadline,
      );
    }
    for (const row of deliverables) {
      add('deliverable_due', row.id, row.name, row.due_date);
    }

    return rows.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  // --------------------------------------------------------------- performance

  /**
   * Counts and percentages read off the work that already exists: deliverables
   * completed, overdue and rejected, on-time percentage, open assignments, and
   * the rating averaged over recorded reviews.
   *
   * Nothing here is hand entered and nothing here is stored, so there is no
   * metric to keep in sync. Internal RUCHI data; never return it to a vendor.
   */
  async findPerformance(vendorId: string, user: JwtPayload) {
    await this.scope.assertAccess(user.sub, user.role, 'VENDOR_VIEWER');
    await this.assertVendorExists(vendorId);

    const [deliverables, assignments, reviews] = await Promise.all([
      this.prisma.vendor_deliverables.findMany({
        where: { vendor_id: vendorId },
        select: { status: true, due_date: true, submitted_date: true },
      }),
      this.prisma.vendor_assignments.findMany({
        where: { vendor_id: vendorId },
        select: { status: true },
      }),
      this.prisma.vendor_reviews.findMany({
        where: { vendor_id: vendorId },
        orderBy: { review_date: 'desc' },
        select: { rating: true, review_date: true },
      }),
    ]);

    const today = new Date();
    const overdue = deliverables.filter(
      (row) =>
        row.due_date !== null &&
        row.submitted_date === null &&
        !CLOSED_DELIVERABLE_STATUSES.includes(row.status) &&
        daysUntil(row.due_date, today) < 0,
    ).length;

    return {
      deliverables: {
        total: deliverables.length,
        completed: deliverables.filter(
          (row) => row.status === deliverable_status_enum.ACCEPTED,
        ).length,
        rejected: deliverables.filter(
          (row) => row.status === deliverable_status_enum.REJECTED,
        ).length,
        overdue,
        on_time_percentage: onTimePercentage(deliverables),
      },
      assignments: {
        total: assignments.length,
        open: assignments.filter((row) => row.status === 'ACTIVE').length,
      },
      reviews: {
        count: reviews.length,
        last_review_date: reviews[0]?.review_date ?? null,
        rating_latest: reviews[0]?.rating ?? null,
        rating_average:
          reviews.length === 0
            ? null
            : Math.round(
                (reviews.reduce((sum, row) => sum + row.rating, 0) / reviews.length) * 10,
              ) / 10,
      },
    };
  }

  // ------------------------------------------------------------------ internals

  /** Manager level, or viewer level when the caller owns the row in question. */
  private async assertManagerOrOwner(user: JwtPayload, ownerId: string) {
    await this.scope.assertAccess(user.sub, user.role, 'VENDOR_VIEWER');
    if (ownerId !== user.sub) {
      await this.scope.assertAccess(user.sub, user.role, 'VENDOR_MANAGER');
    }
  }

  private vendorScopedWhere(vendorId: string | undefined, status: string | undefined) {
    return {
      ...(vendorId ? { vendor_id: vendorId } : {}),
      ...(status ? { status } : {}),
    };
  }

  private async assertVendorExists(vendorId: string) {
    const vendor = await this.prisma.vendors.findUnique({
      where: { id: vendorId },
      select: { id: true },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
  }

  private async assignmentOrFail(id: string) {
    const row = await this.prisma.vendor_assignments.findUnique({
      where: { id },
      select: { id: true, assigned_by_id: true },
    });
    if (!row) throw new NotFoundException('Assignment not found');
    return row;
  }

  private async contractOrFail(id: string) {
    const row = await this.prisma.vendor_contracts.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Contract not found');
    return row;
  }

  private async deliverableOrFail(id: string) {
    const row = await this.prisma.vendor_deliverables.findUnique({
      where: { id },
      select: { id: true, owner_id: true },
    });
    if (!row) throw new NotFoundException('Deliverable not found');
    return row;
  }

  /**
   * The vendor tables carry a plain `vendor_id` and no Prisma relation, so a
   * company-wide list comes back with nothing to show the vendor by. One query
   * per page, same reason as `attachUsers`.
   */
  private async attachVendorNames<T extends { vendor_id: string }>(rows: T[]) {
    if (rows.length === 0) return [];

    const vendors = await this.prisma.vendors.findMany({
      where: { id: { in: [...new Set(rows.map((row) => row.vendor_id))] } },
      select: { id: true, name: true, vendor_code: true },
    });
    const byId = new Map(vendors.map((vendor) => [vendor.id, vendor]));

    return rows.map((row) => ({ ...row, vendor: byId.get(row.vendor_id) ?? null }));
  }

  /** Turns Prisma's unique constraint violation into a message a person can act on. */
  private asConflict(error: unknown, message: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(message);
    }
    return error;
  }
}
