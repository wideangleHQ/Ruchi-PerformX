import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  asset_handovers,
  asset_type_enum,
  notification_type_enum,
  Prisma,
  role_enum,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { lookupUsers } from '../../common/helpers/user-lookup.helper';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { UploadedFile } from '../../common/types/uploaded-file.type';
import { AttachmentsService } from '../attachments/attachments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { decryptSecret, encryptSecret, loadAssetKey } from './asset-crypto';
import { CreateAssetDto } from './dto/create-asset.dto';
import { CreateHandoverDto } from './dto/create-handover.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

/** EA, PA and MD read and change every asset, company wide. */
const OFFICE_ROLES: role_enum[] = [role_enum.EA, role_enum.PA, role_enum.MD];

/**
 * The one select this service reads through. `secret_cipher` and `secret_iv`
 * are in it because `reveal` needs them, and `decorateOne` is the single place
 * they are stripped, so there is exactly one line to check when asking whether
 * a secret can leave the server.
 */
const ASSET_SELECT = {
  id: true,
  owner_id: true,
  asset_type: true,
  label: true,
  username: true,
  url: true,
  file_url: true,
  storage_path: true,
  notes: true,
  created_at: true,
  updated_at: true,
  secret_cipher: true,
  secret_iv: true,
} satisfies Prisma.company_assetsSelect;

type AssetRow = Prisma.company_assetsGetPayload<{ select: typeof ASSET_SELECT }>;

@Injectable()
export class AssetsService {
  /**
   * Validated once per process. `assets.module.ts` calls `loadAssetKey` in its
   * module body too, so a bad key stops the boot rather than the first reveal.
   */
  private readonly key = loadAssetKey();

  constructor(
    private readonly prisma: PrismaService,
    private readonly attachments: AttachmentsService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Assets the caller may see: their own, or everything for EA, PA and MD.
   *
   * HR is deliberately not special here. HR reads one employee at a time
   * through `findForEmployee`; on this endpoint HR sees only its own assets.
   * Throws ForbiddenException for a vendor.
   */
  async findAll(user: JwtPayload) {
    const assets = await this.prisma.company_assets.findMany({
      where: this.assetScope(user),
      orderBy: [{ asset_type: 'asc' }, { label: 'asc' }],
      select: ASSET_SELECT,
    });

    return this.decorate(assets);
  }

  /**
   * One employee's assets plus every handover that has moved off them, which is
   * what the offboarding screen counts to show handed over, confirmed and
   * outstanding.
   *
   * Throws ForbiddenException when the caller may not read this employee.
   */
  async findForEmployee(employeeId: string, user: JwtPayload) {
    const where = this.assetScope(user, employeeId);

    const [assets, handovers] = await Promise.all([
      this.prisma.company_assets.findMany({
        where,
        orderBy: [{ asset_type: 'asc' }, { label: 'asc' }],
        select: ASSET_SELECT,
      }),
      this.prisma.asset_handovers.findMany({
        where: { from_user_id: employeeId },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return {
      assets: await this.decorate(assets),
      handovers: await this.decorateHandovers(handovers),
    };
  }

  /**
   * One asset without its secret.
   *
   * Throws NotFoundException when it does not exist or is deleted, and
   * ForbiddenException when the caller may not see this owner's assets.
   */
  async findOne(id: string, user: JwtPayload) {
    const asset = await this.findVisible(id, user);
    const names = await lookupUsers(this.prisma, [asset.owner_id]);
    return this.decorateOne(asset, names.get(asset.owner_id)?.full_name ?? null);
  }

  /**
   * Decrypt one secret and record the access. The only endpoint that returns a
   * plaintext secret.
   *
   * The audit row is written before the secret is returned and is not fire and
   * forget: in this module the log is the product, and a reveal nobody can
   * account for is worse than a reveal that fails.
   *
   * Throws NotFoundException for a missing asset, BadRequestException when the
   * asset stores no secret, and UnprocessableEntityException when the stored
   * ciphertext will not open under the current key.
   */
  async reveal(id: string, user: JwtPayload, ip: string | null) {
    const asset = await this.findVisible(id, user);

    if (!asset.secret_cipher || !asset.secret_iv) {
      throw new BadRequestException('This asset does not store a secret');
    }

    let secret: string;
    try {
      secret = decryptSecret({ cipher: asset.secret_cipher, iv: asset.secret_iv }, this.key);
    } catch {
      // GCM cannot tell a rotated key from an altered ciphertext, so name both.
      // Left as a bare throw this reads as a server bug the morning after a key
      // rotation, and someone spends a day in the wrong place.
      throw new UnprocessableEntityException(
        'This secret cannot be decrypted with the current ASSET_ENCRYPTION_KEY. ' +
          'Either the key was rotated without re-encrypting the stored secrets, or the ' +
          'stored ciphertext was altered. The secret has to be entered again to be readable.',
      );
    }

    await this.writeAudit(this.prisma, user, {
      action: 'ASSET_SECRET_REVEALED',
      entity: 'company_asset',
      entityId: asset.id,
      value: {
        label: asset.label,
        asset_type: asset.asset_type,
        owner_id: asset.owner_id,
        viewer_role: user.role,
      },
      ip,
    });

    return { id: asset.id, label: asset.label, username: asset.username, secret };
  }

  /**
   * Create an asset owned by the caller. `file` is required for a DOCUMENT and
   * ignored otherwise; `dto.secret` is required for a PASSWORD.
   *
   * The file goes to Supabase through the attachments uploader, so there is one
   * bucket and one set of size and MIME rules. A failure after the upload
   * removes the object again.
   *
   * Throws BadRequestException for a type without its payload, and
   * ForbiddenException for a vendor.
   */
  async create(dto: CreateAssetDto, file: UploadedFile | undefined, user: JwtPayload) {
    if (user.role === role_enum.VENDOR) {
      throw new ForbiddenException('Company assets are not available to vendors');
    }

    if (dto.assetType === asset_type_enum.DOCUMENT && !file) {
      throw new BadRequestException('A DOCUMENT asset needs a file');
    }

    if (dto.assetType === asset_type_enum.PASSWORD && !dto.secret) {
      throw new BadRequestException('A PASSWORD asset needs a secret');
    }

    const sealed = dto.secret ? encryptSecret(dto.secret, this.key) : null;
    const stored = file ? await this.attachments.uploadToStorage(file, `assets/${user.sub}`) : null;

    try {
      const asset = await this.prisma.$transaction(async (tx) => {
        const created = await tx.company_assets.create({
          data: {
            owner_id: user.sub,
            asset_type: dto.assetType,
            label: dto.label,
            username: dto.username ?? null,
            secret_cipher: sealed?.cipher ?? null,
            secret_iv: sealed?.iv ?? null,
            url: dto.url ?? null,
            file_url: stored?.file_url ?? null,
            storage_path: stored?.storage_path ?? null,
            notes: dto.notes ?? null,
          },
          select: ASSET_SELECT,
        });

        await this.writeAudit(tx, user, {
          action: 'ASSET_CREATED',
          entity: 'company_asset',
          entityId: created.id,
          value: {
            label: created.label,
            asset_type: created.asset_type,
            has_secret: Boolean(sealed),
            has_file: Boolean(stored),
          },
        });

        return created;
      });

      return this.decorateOne(asset, user.fullName ?? null);
    } catch (error) {
      if (stored) {
        await this.attachments.removeStoredFile(stored.storage_path);
      }
      throw error;
    }
  }

  /**
   * Edit an asset. A new `secret` is encrypted under the current key, so this
   * is also how a record left behind by a key rotation is repaired. An empty
   * string clears the secret.
   *
   * Throws NotFoundException when the asset is gone and ForbiddenException for
   * anyone who is neither the owner nor EA, PA or MD.
   */
  async update(id: string, dto: UpdateAssetDto, user: JwtPayload) {
    const asset = await this.findVisible(id, user);
    this.assertCanChange(asset, user);

    const data: Prisma.company_assetsUpdateInput = { updated_at: new Date() };
    if (dto.label !== undefined) data.label = dto.label;
    if (dto.username !== undefined) data.username = dto.username || null;
    if (dto.url !== undefined) data.url = dto.url || null;
    if (dto.notes !== undefined) data.notes = dto.notes || null;

    if (dto.secret !== undefined) {
      const sealed = dto.secret ? encryptSecret(dto.secret, this.key) : null;
      data.secret_cipher = sealed?.cipher ?? null;
      data.secret_iv = sealed?.iv ?? null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.company_assets.update({ where: { id }, data, select: ASSET_SELECT });

      await this.writeAudit(tx, user, {
        action: 'ASSET_UPDATED',
        entity: 'company_asset',
        entityId: id,
        previous: { label: asset.label, username: asset.username, url: asset.url },
        value: {
          label: row.label,
          username: row.username,
          url: row.url,
          secret_changed: dto.secret !== undefined,
        },
      });

      return row;
    });

    const names = await lookupUsers(this.prisma, [updated.owner_id]);
    return this.decorateOne(updated, names.get(updated.owner_id)?.full_name ?? null);
  }

  /**
   * Soft delete. The row keeps its ciphertext and any stored file, so a
   * deletion made in error during offboarding is recoverable.
   *
   * Throws NotFoundException when the asset is gone and ForbiddenException for
   * anyone who is neither the owner nor EA, PA or MD.
   */
  async remove(id: string, user: JwtPayload) {
    const asset = await this.findVisible(id, user);
    this.assertCanChange(asset, user);

    await this.prisma.$transaction(async (tx) => {
      await tx.company_assets.update({
        where: { id },
        data: { deleted_at: new Date(), updated_at: new Date() },
      });

      await this.writeAudit(tx, user, {
        action: 'ASSET_DELETED',
        entity: 'company_asset',
        entityId: id,
        value: { label: asset.label, asset_type: asset.asset_type, owner_id: asset.owner_id },
      });
    });

    return { message: 'Asset deleted' };
  }

  /**
   * Open a handover per asset, one submit for the whole leaver list.
   * `from_user_id` is the asset's current owner, not something the caller
   * states, and ownership does not move until the new owner confirms.
   *
   * Throws NotFoundException for an unknown asset, and BadRequestException when
   * an asset already has a handover in flight, when a new owner is not an
   * active internal user, or when the new owner already owns the asset.
   */
  async createHandovers(dto: CreateHandoverDto, user: JwtPayload) {
    const assetIds = [...new Set(dto.items.map((item) => item.assetId))];
    if (assetIds.length !== dto.items.length) {
      throw new BadRequestException('One asset cannot be handed to two people in the same submit');
    }

    const [assets, inFlight, recipients] = await Promise.all([
      this.prisma.company_assets.findMany({
        where: { id: { in: assetIds }, deleted_at: null },
        select: { id: true, owner_id: true, label: true },
      }),
      this.prisma.asset_handovers.findMany({
        where: { asset_id: { in: assetIds }, completed_at: null },
        select: { asset_id: true },
      }),
      this.prisma.users.findMany({
        where: {
          id: { in: [...new Set(dto.items.map((item) => item.toUserId))] },
          deleted_at: null,
          is_active: true,
          role: { not: role_enum.VENDOR },
        },
        select: { id: true },
      }),
    ]);

    const byId = new Map(assets.map((asset) => [asset.id, asset]));
    const recipientIds = new Set(recipients.map((recipient) => recipient.id));

    if (inFlight.length) {
      const labels = inFlight.map((row) => byId.get(row.asset_id)?.label ?? row.asset_id);
      throw new BadRequestException(`A handover is already pending for: ${labels.join(', ')}`);
    }

    const items = dto.items.map((item) => {
      const asset = byId.get(item.assetId);
      if (!asset) {
        throw new NotFoundException(`Asset ${item.assetId} not found`);
      }
      if (!recipientIds.has(item.toUserId)) {
        throw new BadRequestException('The new owner must be an active internal user');
      }
      if (asset.owner_id === item.toUserId) {
        throw new BadRequestException(`"${asset.label}" already belongs to that user`);
      }
      return { asset, toUserId: item.toUserId };
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const rows: asset_handovers[] = [];

      for (const item of items) {
        const row = await tx.asset_handovers.create({
          data: {
            asset_id: item.asset.id,
            from_user_id: item.asset.owner_id,
            to_user_id: item.toUserId,
            initiated_by_id: user.sub,
          },
        });

        await this.writeAudit(tx, user, {
          action: 'ASSET_HANDOVER_INITIATED',
          entity: 'asset_handover',
          entityId: row.id,
          value: {
            asset_id: item.asset.id,
            label: item.asset.label,
            from_user_id: item.asset.owner_id,
            to_user_id: item.toUserId,
          },
        });

        rows.push(row);
      }

      return rows;
    });

    const labels = new Map(items.map((item) => [item.asset.id, item.asset.label]));
    await this.notifications.notifyMany(
      created.map((row) => ({
        recipientId: row.to_user_id,
        type: notification_type_enum.ASSET_HANDOVER_INITIATED,
        title: 'A company asset is being handed to you',
        message: `"${labels.get(row.asset_id) ?? 'An asset'}" is waiting for you to confirm receipt in Assets.`,
        entityType: 'asset' as const,
        entityId: row.id,
      })),
    );

    return this.decorateHandovers(created);
  }

  /** Handovers waiting for the caller to confirm receipt. */
  async pendingHandovers(user: JwtPayload) {
    const rows = await this.prisma.asset_handovers.findMany({
      where: { to_user_id: user.sub, completed_at: null },
      orderBy: { created_at: 'desc' },
    });

    return this.decorateHandovers(rows);
  }

  /**
   * Confirm receipt. `completed_at` and the new `owner_id` are written in one
   * transaction; moving ownership when HR submits instead would hide the asset
   * from the leaver while HR is still working through the list.
   *
   * The guard is in the `where` clause rather than an `if` above it, so a double
   * submit updates nothing rather than moving the asset twice.
   *
   * Throws NotFoundException when no pending handover with that id is addressed
   * to the caller.
   */
  async confirmHandover(id: string, user: JwtPayload) {
    const handover = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.asset_handovers.updateMany({
        where: { id, to_user_id: user.sub, completed_at: null },
        data: { completed_at: new Date() },
      });

      if (claimed.count === 0) {
        throw new NotFoundException('No handover is waiting for your confirmation under that id');
      }

      const row = await tx.asset_handovers.findUniqueOrThrow({ where: { id } });

      await tx.company_assets.update({
        where: { id: row.asset_id },
        data: { owner_id: row.to_user_id, updated_at: new Date() },
      });

      await this.writeAudit(tx, user, {
        action: 'ASSET_HANDOVER_CONFIRMED',
        entity: 'asset_handover',
        entityId: row.id,
        value: {
          asset_id: row.asset_id,
          from_user_id: row.from_user_id,
          to_user_id: row.to_user_id,
        },
      });

      return row;
    });

    const asset = await this.prisma.company_assets.findUnique({
      where: { id: handover.asset_id },
      select: { label: true },
    });

    await this.notifications.notify({
      recipientId: handover.initiated_by_id,
      type: notification_type_enum.ASSET_HANDOVER_CONFIRMED,
      title: 'Asset handover confirmed',
      message: `${user.fullName ?? 'The new owner'} confirmed receipt of "${asset?.label ?? 'an asset'}".`,
      entityType: 'asset',
      entityId: handover.id,
    });

    return handover;
  }

  /**
   * The single authority on who may read which assets, in the priority order
   * the handbook states. Every read goes through it, including the single
   * record reads, which pass the record's own owner so the same four rules
   * decide the answer.
   *
   *   a. an employee sees assets where `owner_id` is their own id, nothing else
   *   b. EA, PA and MD see every asset, company wide
   *   c. HR sees every asset of one employee when asking for that employee, and
   *      never a company wide list, so an HR caller with no `employeeId` falls
   *      through to rule a
   *   d. VENDOR sees nothing, this module is not exposed to vendors at all
   *
   * Throws ForbiddenException for a vendor, and for anyone asking after another
   * person's assets without the role for it.
   */
  private assetScope(user: JwtPayload, employeeId?: string): Prisma.company_assetsWhereInput {
    if (user.role === role_enum.VENDOR) {
      throw new ForbiddenException('Company assets are not available to vendors');
    }

    if (employeeId) {
      const canReadOthers =
        OFFICE_ROLES.includes(user.role) || user.role === role_enum.HR;

      if (employeeId !== user.sub && !canReadOthers) {
        throw new ForbiddenException("Not authorized to view this employee's assets");
      }

      return { deleted_at: null, owner_id: employeeId };
    }

    if (OFFICE_ROLES.includes(user.role)) {
      return { deleted_at: null };
    }

    return { deleted_at: null, owner_id: user.sub };
  }

  /** PATCH and DELETE are the owner, EA, PA and MD. HR reads for offboarding but does not edit. */
  private assertCanChange(asset: { owner_id: string }, user: JwtPayload) {
    if (asset.owner_id === user.sub || OFFICE_ROLES.includes(user.role)) {
      return;
    }

    throw new ForbiddenException('Only the owner, an EA, a PA or the MD can change this asset');
  }

  /**
   * Load one live asset the caller is allowed to see.
   *
   * `assetScope` runs against the record's owner and is used for its throw
   * rather than for its where clause, so single record access and list access
   * are decided by the same four rules.
   */
  private async findVisible(id: string, user: JwtPayload) {
    const asset = await this.prisma.company_assets.findFirst({
      where: { id, deleted_at: null },
      select: ASSET_SELECT,
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    this.assetScope(user, asset.owner_id);
    return asset;
  }

  /**
   * Append one row to `audit_logs`, inside `tx` when there is one.
   *
   * `entry.value` must never carry a plaintext secret. It records the fact of
   * the access and the label it happened to, not the contents.
   */
  private writeAudit(
    tx: Prisma.TransactionClient,
    user: JwtPayload,
    entry: {
      action: string;
      entity: 'company_asset' | 'asset_handover';
      entityId: string;
      value: Record<string, unknown>;
      previous?: Record<string, unknown>;
      ip?: string | null;
    },
  ) {
    return tx.audit_logs.create({
      data: {
        user_id: user.sub,
        action: entry.action,
        entity: entry.entity,
        entity_id: entry.entityId,
        old_value: entry.previous ? JSON.stringify(entry.previous) : null,
        new_value: JSON.stringify(entry.value),
        ip_address: entry.ip ? entry.ip.slice(0, 100) : null,
      },
    });
  }

  private async decorate(assets: AssetRow[]) {
    const names = await lookupUsers(this.prisma, assets.map((asset) => asset.owner_id));
    return Promise.all(
      assets.map((asset) => this.decorateOne(asset, names.get(asset.owner_id)?.full_name ?? null)),
    );
  }

  /**
   * Strip the ciphertext, name the owner, and re-sign the file URL. This is the
   * only place a `company_assets` row turns into a response body, so it is the
   * only place a secret could escape.
   */
  private async decorateOne(asset: AssetRow, ownerName: string | null) {
    const { secret_cipher, secret_iv, ...rest } = asset;

    return {
      ...rest,
      owner_name: ownerName,
      has_secret: Boolean(secret_cipher && secret_iv),
      // Supabase signed URLs last an hour, so the stored one is usually stale.
      // ponytail: one signing call per document row. Fine at a few hundred
      // assets; if a list ever gets slow, sign on demand from the detail route.
      file_url: asset.storage_path
        ? ((await this.attachments.signStoredFile(asset.storage_path)) ?? asset.file_url)
        : asset.file_url,
    };
  }

  /**
   * `asset_handovers` carries no Prisma relations, so the asset label and the
   * three user names are looked up here rather than included.
   */
  private async decorateHandovers(rows: asset_handovers[]) {
    if (!rows.length) {
      return [];
    }

    const [assets, names] = await Promise.all([
      this.prisma.company_assets.findMany({
        where: { id: { in: [...new Set(rows.map((row) => row.asset_id))] } },
        select: { id: true, label: true, asset_type: true },
      }),
      lookupUsers(
        this.prisma,
        rows.flatMap((row) => [row.from_user_id, row.to_user_id, row.initiated_by_id]),
      ),
    ]);

    const byId = new Map(assets.map((asset) => [asset.id, asset]));

    return rows.map((row) => ({
      id: row.id,
      asset_id: row.asset_id,
      asset_label: byId.get(row.asset_id)?.label ?? null,
      asset_type: byId.get(row.asset_id)?.asset_type ?? null,
      from_user_id: row.from_user_id,
      from_user_name: names.get(row.from_user_id)?.full_name ?? null,
      to_user_id: row.to_user_id,
      to_user_name: names.get(row.to_user_id)?.full_name ?? null,
      initiated_by_id: row.initiated_by_id,
      initiated_by_name: names.get(row.initiated_by_id)?.full_name ?? null,
      completed_at: row.completed_at,
      created_at: row.created_at,
    }));
  }
}
