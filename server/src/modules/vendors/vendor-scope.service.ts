import { ForbiddenException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

/** Entity kinds a vendor assignment can point at. */
export type VendorEntityType = 'task' | 'project' | 'deliverable' | 'service';

/**
 * The only thing standing between an external vendor login and the whole
 * company's data.
 *
 * `RolesGuard` checks that `user.role` is in the `@Roles(...)` list and knows
 * nothing about assignments, so adding `role_enum.VENDOR` to a decorator opens
 * that endpoint to every vendor for every record it can return. Every
 * vendor-reachable endpoint therefore needs an explicit scope check, and it is
 * written once, here.
 *
 * Detail endpoints call `assertVendorAccess` at the top. List endpoints merge
 * `vendorFilter` into their `where`. There is no safe default: an unfiltered
 * list query a vendor can reach returns the whole company's tasks.
 *
 * `just vendor-roles` fails the build if `VENDOR` appears on a controller
 * outside `modules/vendor-portal/`, which is the other half of this.
 */
@Injectable()
export class VendorScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Throws ForbiddenException unless a vendor_assignments row grants this
   * vendor access to this entity. Never returns false; the only non-throwing
   * outcome is access.
   */
  async assertVendorAccess(
    vendorId: string,
    entityType: VendorEntityType,
    entityId: string,
  ): Promise<void> {
    const row = await this.prisma.vendor_assignments.findFirst({
      where: {
        vendor_id: vendorId,
        entity_type: entityType,
        entity_id: entityId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (!row) throw new ForbiddenException('Not assigned');
  }

  /**
   * A `where` fragment restricting a list to the ids this vendor is assigned.
   *
   * Returns `{ id: { in: [] } }` when there are no assignments, which matches
   * nothing. That is deliberate: an empty filter object would match everything,
   * and the failure mode of getting this backwards is the entire task table.
   */
  async vendorFilter(
    vendorId: string,
    entityType: VendorEntityType,
  ): Promise<{ id: { in: string[] } }> {
    const rows = await this.prisma.vendor_assignments.findMany({
      where: { vendor_id: vendorId, entity_type: entityType, status: 'ACTIVE' },
      select: { entity_id: true },
    });
    return {
      id: {
        in: rows
          .map((r) => r.entity_id)
          .filter((id): id is string => id !== null),
      },
    };
  }

  /**
   * Resolves the vendors row behind a portal login.
   *
   * Throws if the user has no `vendor_id`, because a VENDOR-role account
   * without one can be scoped to nothing and must not fall through to an
   * unfiltered query.
   */
  async vendorIdForUser(userId: string): Promise<string> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { vendor_id: true },
    });
    if (!user?.vendor_id) {
      throw new ForbiddenException('This account is not linked to a vendor');
    }
    return user.vendor_id;
  }

  /**
   * Whether this employee may open Vendor Management at all.
   *
   * MD and EA hold every level implicitly. Everyone else needs a
   * vendor_dashboard_access row. This is a different permission from being
   * assigned work to a vendor and from a vendor portal login, and the three
   * must never collapse into one check.
   */
  async accessLevelFor(
    userId: string,
    role: string,
  ): Promise<'VENDOR_ADMIN' | 'VENDOR_MANAGER' | 'VENDOR_VIEWER' | null> {
    if (role === 'MD' || role === 'EA') return 'VENDOR_ADMIN';
    const row = await this.prisma.vendor_dashboard_access.findUnique({
      where: { user_id: userId },
      select: { access_level: true },
    });
    return (row?.access_level as 'VENDOR_ADMIN' | null) ?? null;
  }

  /** Throws unless the caller holds at least the level named. */
  async assertAccess(
    userId: string,
    role: string,
    minimum: 'VENDOR_VIEWER' | 'VENDOR_MANAGER' | 'VENDOR_ADMIN',
  ): Promise<void> {
    const order = ['VENDOR_VIEWER', 'VENDOR_MANAGER', 'VENDOR_ADMIN'];
    const level = await this.accessLevelFor(userId, role);
    if (!level || order.indexOf(level) < order.indexOf(minimum)) {
      throw new ForbiddenException('Vendor management access required');
    }
  }
}

