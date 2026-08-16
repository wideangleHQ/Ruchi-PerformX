import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { Prisma, role_enum, vendor_status_enum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { attachUsers } from '../../common/helpers/user-lookup.helper';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { VendorScopeService } from './vendor-scope.service';
import { CreateVendorDto } from './dto/vendor/create-vendor.dto';
import { UpdateVendorDto } from './dto/vendor/update-vendor.dto';
import { UpdateVendorStatusDto } from './dto/vendor/update-vendor-status.dto';
import { VendorFilterDto } from './dto/vendor/vendor-filter.dto';
import { CreateVendorCategoryDto } from './dto/vendor/create-vendor-category.dto';

/** The list the business already works with. Editable afterwards, not an enum. */
const SEED_CATEGORIES = [
  'Web Development',
  'Digital Marketing',
  'Design Agency',
  'IT Services',
  'Consultancy',
  'Recruitment',
  'Maintenance',
  'Printing',
  'Media',
  'Other',
];

const VENDOR_CODE_PREFIX = 'VEN-';

/**
 * The internal vendor master: the directory, the profile, and the picker.
 *
 * Every read here is gated on a `vendor_dashboard_access` grant through
 * `VendorScopeService`, with one deliberate exception, `pickable`, which
 * returns three columns of ACTIVE vendors so an employee can assign work
 * without being handed the internal owner, notes, and status history that the
 * directory row carries.
 *
 * The `vendors` table has no Prisma relations, so category, owner and current
 * contract are joined by hand: one extra query per list, never one per row.
 */
@Injectable()
export class VendorsService implements OnModuleInit {
  private readonly logger = new Logger(VendorsService.name);

  // ponytail: no NotificationsService. Nothing here is an event anyone needs a
  // bell for; the expiry sweeps that are live in VendorDeadlineCron.
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: VendorScopeService,
  ) {}

  /**
   * Seeds `vendor_categories` on boot.
   *
   * `skipDuplicates` against the unique name makes this a no-op on every boot
   * after the first, and a category deleted on purpose stays deleted only if
   * it is deactivated rather than removed, which is why `is_active` exists.
   * Logged and swallowed on failure: an unreachable database at boot is a
   * bigger problem than a missing category list, and it should not be reported
   * as this.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.prisma.vendor_categories.createMany({
        data: SEED_CATEGORIES.map((name) => ({ name })),
        skipDuplicates: true,
      });
    } catch (error) {
      this.logger.warn(
        `Vendor category seed skipped: ${(error as Error).message}`,
      );
    }
  }

  // ------------------------------------------------------------------ vendors

  /**
   * The vendor directory. Requires any vendor management level.
   *
   * Contract expiry is read from `vendor_contracts`, never from a column on
   * `vendors`, so filtering on an expiry range resolves the matching vendor
   * ids first and narrows the main query with them.
   */
  async findAll(filters: VendorFilterDto, user: JwtPayload) {
    await this.scope.assertAccess(user.sub, user.role, 'VENDOR_VIEWER');

    const where: Prisma.vendorsWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.categoryId) where.category_id = filters.categoryId;
    if (filters.departmentId) where.department_id = filters.departmentId;
    if (filters.ownerId) where.owner_id = filters.ownerId;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { vendor_code: { contains: filters.search, mode: 'insensitive' } },
        { contact_person: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.expiringAfter || filters.expiringBefore) {
      const end_date: Prisma.DateTimeFilter = {};
      if (filters.expiringAfter) end_date.gte = new Date(filters.expiringAfter);
      if (filters.expiringBefore)
        end_date.lte = new Date(filters.expiringBefore);
      const matching = await this.prisma.vendor_contracts.findMany({
        where: { status: 'ACTIVE', end_date },
        select: { vendor_id: true },
      });
      where.id = { in: matching.map((c) => c.vendor_id) };
    }

    const vendors = await this.prisma.vendors.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    if (vendors.length === 0) return [];

    const ids = vendors.map((v) => v.id);
    const [categories, contracts, assignments, withOwners] = await Promise.all([
      this.categoryMap(vendors.map((v) => v.category_id)),
      this.prisma.vendor_contracts.findMany({
        where: { vendor_id: { in: ids }, status: 'ACTIVE' },
        orderBy: { end_date: 'desc' },
        select: { vendor_id: true, end_date: true, contract_number: true },
      }),
      this.prisma.vendor_assignments.findMany({
        where: { vendor_id: { in: ids }, status: 'ACTIVE' },
        select: { vendor_id: true, deadline: true },
      }),
      attachUsers(this.prisma, vendors, ['owner_id']),
    ]);

    return withOwners.map((vendor) => {
      const active = assignments.filter((a) => a.vendor_id === vendor.id);
      const deadlines = active
        .map((a) => a.deadline)
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime());
      return {
        ...vendor,
        category: vendor.category_id
          ? (categories.get(vendor.category_id) ?? null)
          : null,
        current_contract:
          contracts.find((c) => c.vendor_id === vendor.id) ?? null,
        active_work_count: active.length,
        next_deadline: deadlines[0] ?? null,
      };
    });
  }

  /**
   * Name, id and category of ACTIVE vendors, for the assign-work picker.
   *
   * The one vendor read an employee without vendor management access
   * legitimately needs, and the reason `GET /vendors` is not opened to every
   * internal role: the directory row carries internal owner, notes, contract
   * and status history, none of which belongs in a dropdown.
   */
  async pickable() {
    const vendors = await this.prisma.vendors.findMany({
      where: { status: vendor_status_enum.ACTIVE },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, category_id: true },
    });
    const categories = await this.categoryMap(
      vendors.map((v) => v.category_id),
    );
    return vendors.map((v) => ({
      id: v.id,
      name: v.name,
      category: v.category_id ? (categories.get(v.category_id) ?? null) : null,
    }));
  }

  /**
   * One vendor with the header a profile page needs: category, both owners,
   * department, and the current contract joined from `vendor_contracts`.
   *
   * Throws NotFoundException for an unknown id. Assignments, documents,
   * deliverables and reviews are their own endpoints; this is the header.
   */
  async findOne(id: string, user: JwtPayload) {
    await this.scope.assertAccess(user.sub, user.role, 'VENDOR_VIEWER');

    const vendor = await this.prisma.vendors.findUnique({ where: { id } });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const [categories, contract, department, withUsers] = await Promise.all([
      this.categoryMap([vendor.category_id]),
      this.prisma.vendor_contracts.findFirst({
        where: { vendor_id: id, status: 'ACTIVE' },
        orderBy: { end_date: 'desc' },
      }),
      vendor.department_id
        ? this.prisma.departments.findUnique({
            where: { id: vendor.department_id },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
      attachUsers(this.prisma, [vendor], [
        'owner_id',
        'secondary_owner_id',
        'created_by_id',
      ]),
    ]);

    return {
      ...withUsers[0],
      category: vendor.category_id
        ? (categories.get(vendor.category_id) ?? null)
        : null,
      department,
      current_contract: contract,
    };
  }

  /**
   * Creates a vendor. Requires VENDOR_MANAGER.
   *
   * Throws BadRequestException when the owner, secondary owner, category or
   * department does not resolve, and ConflictException if a vendor code cannot
   * be claimed after three attempts, which only happens under concurrent
   * creation.
   */
  async create(dto: CreateVendorDto, user: JwtPayload) {
    await this.scope.assertAccess(user.sub, user.role, 'VENDOR_MANAGER');
    await this.assertReferencesResolve(dto);

    const data = {
      name: dto.name,
      vendor_type: dto.vendorType ?? null,
      category_id: dto.categoryId ?? null,
      description: dto.description ?? null,
      contact_person: dto.contactPerson ?? null,
      contact_email: dto.contactEmail ?? null,
      contact_phone: dto.contactPhone ?? null,
      alternate_contact: dto.alternateContact ?? null,
      company_address: dto.companyAddress ?? null,
      website: dto.website ?? null,
      start_date: dto.startDate ? new Date(dto.startDate) : null,
      status: dto.status ?? vendor_status_enum.PROSPECT,
      owner_id: dto.ownerId,
      department_id: dto.departmentId ?? null,
      secondary_owner_id: dto.secondaryOwnerId ?? null,
      notes: dto.notes ?? null,
      tags: dto.tags ?? [],
      created_by_id: user.sub,
    };

    // ponytail: read the highest code, add one, retry on the unique index.
    // Ceiling is VEN-9999, where the lexicographic sort stops agreeing with
    // the numeric one. Swap in a Postgres sequence when that gets close.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.vendors.create({
          data: { ...data, vendor_code: await this.nextVendorCode() },
        });
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2002'
        ) {
          throw error;
        }
      }
    }
    throw new ConflictException('Could not allocate a vendor code, try again');
  }

  /**
   * Updates the master record. Requires VENDOR_MANAGER, or being the vendor's
   * own internal owner, who is accountable for the relationship and can keep
   * the contact details straight without holding a module-wide grant.
   *
   * Throws NotFoundException for an unknown id, ForbiddenException for anyone
   * who is neither. Cannot change `vendor_code` or `status`.
   */
  async update(id: string, dto: UpdateVendorDto, user: JwtPayload) {
    const vendor = await this.prisma.vendors.findUnique({
      where: { id },
      select: { id: true, owner_id: true, secondary_owner_id: true },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const isInternalOwner =
      vendor.owner_id === user.sub || vendor.secondary_owner_id === user.sub;
    if (!isInternalOwner) {
      await this.scope.assertAccess(user.sub, user.role, 'VENDOR_MANAGER');
    }

    await this.assertReferencesResolve(dto);

    return this.prisma.vendors.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.vendorType !== undefined && { vendor_type: dto.vendorType }),
        ...(dto.categoryId !== undefined && { category_id: dto.categoryId }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.contactPerson !== undefined && {
          contact_person: dto.contactPerson,
        }),
        ...(dto.contactEmail !== undefined && {
          contact_email: dto.contactEmail,
        }),
        ...(dto.contactPhone !== undefined && {
          contact_phone: dto.contactPhone,
        }),
        ...(dto.alternateContact !== undefined && {
          alternate_contact: dto.alternateContact,
        }),
        ...(dto.companyAddress !== undefined && {
          company_address: dto.companyAddress,
        }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.startDate !== undefined && {
          start_date: new Date(dto.startDate),
        }),
        ...(dto.ownerId !== undefined && { owner_id: dto.ownerId }),
        ...(dto.departmentId !== undefined && {
          department_id: dto.departmentId,
        }),
        ...(dto.secondaryOwnerId !== undefined && {
          secondary_owner_id: dto.secondaryOwnerId,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        updated_at: new Date(),
      },
    });
  }

  /**
   * Moves a vendor through `vendor_status_enum` and audits the transition.
   * Requires VENDOR_MANAGER.
   *
   * This is the whole of vendor deletion. There is no DELETE route and there
   * must not be one: assignments, documents and contracts reference this row
   * and have to outlive the relationship.
   */
  async updateStatus(id: string, dto: UpdateVendorStatusDto, user: JwtPayload) {
    await this.scope.assertAccess(user.sub, user.role, 'VENDOR_MANAGER');

    const vendor = await this.prisma.vendors.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const [updated] = await this.prisma.$transaction([
      this.prisma.vendors.update({
        where: { id },
        data: { status: dto.status, updated_at: new Date() },
      }),
      this.prisma.audit_logs.create({
        data: {
          user_id: user.sub,
          action: 'VENDOR_STATUS_CHANGED',
          entity: 'vendors',
          entity_id: id,
          old_value: JSON.stringify({ status: vendor.status }),
          new_value: JSON.stringify({ status: dto.status }),
        },
      }),
    ]);

    return updated;
  }

  // --------------------------------------------------------------- categories

  /** The active category list. Requires any vendor management level. */
  async listCategories(user: JwtPayload) {
    await this.scope.assertAccess(user.sub, user.role, 'VENDOR_VIEWER');
    return this.prisma.vendor_categories.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Adds a category. Role-gated to HR, EA and MD on the controller.
   *
   * Throws ConflictException on a duplicate name, including one that was
   * deactivated: the row is reactivated instead, because the unique index is
   * on the name alone and a second "Printing" cannot exist.
   */
  async createCategory(dto: CreateVendorCategoryDto) {
    const existing = await this.prisma.vendor_categories.findUnique({
      where: { name: dto.name },
    });
    if (existing?.is_active) {
      throw new ConflictException('That category already exists');
    }
    if (existing) {
      return this.prisma.vendor_categories.update({
        where: { id: existing.id },
        data: { is_active: true },
      });
    }
    return this.prisma.vendor_categories.create({ data: { name: dto.name } });
  }

  // ------------------------------------------------------------------ helpers

  /** id to `{ id, name }` for the categories these vendors point at. */
  private async categoryMap(ids: (string | null)[]) {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    if (unique.length === 0) return new Map<string, { id: string; name: string }>();
    const rows = await this.prisma.vendor_categories.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((r) => [r.id, r]));
  }

  /**
   * Rejects a vendor pointed at a category, department or owner that does not
   * exist, or at an external vendor login as its internal owner.
   *
   * The table carries plain uuid columns with no foreign keys, so nothing else
   * catches a mistyped id: it writes cleanly and the profile shows a blank
   * owner forever.
   */
  private async assertReferencesResolve(dto: CreateVendorDto | UpdateVendorDto) {
    if (dto.categoryId) {
      const category = await this.prisma.vendor_categories.findUnique({
        where: { id: dto.categoryId },
        select: { id: true },
      });
      if (!category) throw new BadRequestException('Unknown vendor category');
    }

    if (dto.departmentId) {
      const department = await this.prisma.departments.findUnique({
        where: { id: dto.departmentId },
        select: { id: true },
      });
      if (!department) throw new BadRequestException('Unknown department');
    }

    const ownerIds = [dto.ownerId, dto.secondaryOwnerId].filter(
      (id): id is string => !!id,
    );
    if (ownerIds.length === 0) return;

    const owners = await this.prisma.users.findMany({
      where: { id: { in: ownerIds }, deleted_at: null, is_active: true },
      select: { id: true, role: true },
    });
    for (const id of ownerIds) {
      const owner = owners.find((o) => o.id === id);
      if (!owner) {
        throw new BadRequestException('Internal owner must be an active user');
      }
      // The accountable party is a RUCHI employee. A vendor's own login is not
      // one, and pointing owner_id at it would put an external account on
      // every deadline notification the cron sends.
      if (owner.role === role_enum.VENDOR) {
        throw new BadRequestException(
          'Internal owner must be an employee, not a vendor portal account',
        );
      }
    }
  }

  /** Next free `VEN-0001` style code. Not race-proof on its own; `create` retries. */
  private async nextVendorCode(): Promise<string> {
    const latest = await this.prisma.vendors.findFirst({
      where: { vendor_code: { startsWith: VENDOR_CODE_PREFIX } },
      orderBy: { vendor_code: 'desc' },
      select: { vendor_code: true },
    });
    const current = Number(
      latest?.vendor_code.slice(VENDOR_CODE_PREFIX.length) ?? 0,
    );
    const next = Number.isFinite(current) ? current + 1 : 1;
    return `${VENDOR_CODE_PREFIX}${String(next).padStart(4, '0')}`;
  }
}
