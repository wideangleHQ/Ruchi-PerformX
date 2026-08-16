import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { role_enum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { attachUsers } from '../../common/helpers/user-lookup.helper';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { VendorScopeService } from './vendor-scope.service';
import {
  GrantVendorAccessDto,
  VendorAccessLevel,
} from './dto/access/grant-vendor-access.dto';

/**
 * Who inside RUCHI can open Vendor Management at all.
 *
 * One of three permissions that share the word "vendor" and must never
 * collapse into one check:
 *
 *   this one          `vendor_dashboard_access`, granted by MD or EA
 *   what a vendor does for us   `vendor_assignments`, set by any authorised employee
 *   can the vendor log in       `users.vendor_id` + `role: VENDOR`, created by admin
 *
 * A grant here is the widest single action in the module: it hands one
 * employee the whole vendor book rather than one record. Everything below
 * assumes the caller already passed `@Roles(MD, EA)` and re-checks the target.
 */
@Injectable()
export class VendorAccessService {
  // ponytail: no NotificationsService here. notification_type_enum has no value
  // for a grant, and reusing VENDOR_MESSAGE would file it under the vendor's
  // own thread. Add the enum value with the next migration, then notify.
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: VendorScopeService,
  ) {}

  /**
   * Every employee holding an explicit grant, with the grantee and grantor
   * resolved to names.
   *
   * MD and EA are absent by design: they hold `VENDOR_ADMIN` by role and have
   * no row, so this is the list of grants, not the list of people with access.
   */
  async list() {
    const rows = await this.prisma.vendor_dashboard_access.findMany({
      orderBy: { granted_at: 'desc' },
    });
    return attachUsers(this.prisma, rows, ['user_id', 'granted_by_id']);
  }

  /**
   * The caller's own level, or null.
   *
   * `client/src/hooks/useNavAccess.ts` reads `accessLevel` to decide whether
   * the Vendors sidebar entry renders, so the shape is load bearing. Never
   * throws for a caller without access; null is the answer, and the hook
   * treats a thrown 403 the same way.
   */
  async me(user: JwtPayload): Promise<{ accessLevel: VendorAccessLevel | null }> {
    return { accessLevel: await this.scope.accessLevelFor(user.sub, user.role) };
  }

  /**
   * Grants or re-levels one employee, and writes the audit row in the same
   * transaction.
   *
   * Throws NotFoundException when the target does not exist, is inactive, or
   * is soft-deleted. Throws BadRequestException when the target is an external
   * vendor login, or an MD/EA who already holds every level by role and whose
   * row would only misreport what they actually have.
   *
   * Re-granting an existing holder overwrites the level and the grantor rather
   * than failing, because `user_id` is unique and "change Priya to VIEWER" is
   * the same intent as granting.
   */
  async grant(dto: GrantVendorAccessDto, actor: JwtPayload) {
    const target = await this.prisma.users.findUnique({
      where: { id: dto.userId },
      select: {
        id: true,
        full_name: true,
        role: true,
        is_active: true,
        deleted_at: true,
      },
    });

    if (!target || target.deleted_at || target.is_active === false) {
      throw new NotFoundException('User not found');
    }

    // The whole point of the module. An external login with a dashboard grant
    // reads the internal vendor master, including every competitor of theirs
    // on the list.
    if (target.role === role_enum.VENDOR) {
      throw new BadRequestException(
        'Vendor portal accounts cannot hold vendor management access',
      );
    }

    if (target.role === role_enum.MD || target.role === role_enum.EA) {
      throw new BadRequestException(
        `${target.role} already holds full vendor management access by role`,
      );
    }

    const existing = await this.prisma.vendor_dashboard_access.findUnique({
      where: { user_id: dto.userId },
      select: { access_level: true },
    });

    const [row] = await this.prisma.$transaction([
      this.prisma.vendor_dashboard_access.upsert({
        where: { user_id: dto.userId },
        create: {
          user_id: dto.userId,
          access_level: dto.accessLevel,
          granted_by_id: actor.sub,
        },
        update: {
          access_level: dto.accessLevel,
          granted_by_id: actor.sub,
          granted_at: new Date(),
        },
      }),
      this.prisma.audit_logs.create({
        data: {
          user_id: actor.sub,
          action: existing ? 'VENDOR_ACCESS_CHANGED' : 'VENDOR_ACCESS_GRANTED',
          entity: 'vendor_dashboard_access',
          entity_id: dto.userId,
          old_value: existing ? JSON.stringify(existing) : null,
          new_value: JSON.stringify({ access_level: dto.accessLevel }),
        },
      }),
    ]);

    return row;
  }

  /**
   * Removes an employee's grant, and audits it.
   *
   * Throws NotFoundException when there is no row, which is also what an
   * attempt to revoke MD or EA hits: their access is a role, not a grant, and
   * this endpoint cannot take it away.
   */
  async revoke(userId: string, actor: JwtPayload) {
    const existing = await this.prisma.vendor_dashboard_access.findUnique({
      where: { user_id: userId },
      select: { access_level: true },
    });
    if (!existing) {
      throw new NotFoundException('This user holds no vendor management grant');
    }

    await this.prisma.$transaction([
      this.prisma.vendor_dashboard_access.delete({ where: { user_id: userId } }),
      this.prisma.audit_logs.create({
        data: {
          user_id: actor.sub,
          action: 'VENDOR_ACCESS_REVOKED',
          entity: 'vendor_dashboard_access',
          entity_id: userId,
          old_value: JSON.stringify(existing),
          new_value: null,
        },
      }),
    ]);

    return { revoked: true };
  }
}
