import 'multer';
import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import {
  VISITOR_SELECT,
  VisitorDbClient,
  VisitorExistsCriteria,
  VisitorLookupOptions,
  VisitorRecord,
  VisitorSearchParams,
} from '../repositories/visitor.repository.interface';
import { CreateVisitorDto } from '../dto/create-visitor.dto';
import { UpdateVisitorDto } from '../dto/update-visitor.dto';
import {
  VISITOR_DOMAIN_SERVICE,
  VisitorDomainService,
  VisitorServiceContract,
} from './visitor.service.interface';
import { VisitorImageSource } from '../../common/enums/visitor-image-source.enum';
import { VisitorImageType } from '../../common/enums/visitor-image-type.enum';

@Injectable()
export class VisitorService implements VisitorServiceContract {
  private readonly supabase: SupabaseClient;
  private readonly bucket = process.env.SUPABASE_VMS_BUCKET || 'vms-files';

  constructor(
    private readonly prisma: PrismaService,
    @Inject(VISITOR_DOMAIN_SERVICE)
    private readonly visitorDomainService: VisitorDomainService,
  ) {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://example.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || 'fake-key';
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async uploadPhoto(visitorId: string, file: Express.Multer.File, actorId: string): Promise<any> {
    const visitor = await this.prisma.visitor.findFirst({ where: { id: visitorId, deletedAt: null } });
    if (!visitor) {
      throw new NotFoundException('Visitor not found');
    }

    try {
      const ext = file.mimetype.split('/')[1] || 'jpg';
      const fileName = `${randomUUID()}.${ext}`;
      const path = `visitors/photos/${visitorId}/${fileName}`;

      const { data, error } = await this.supabase.storage.from(this.bucket).upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

      let fileUrl = '';
      if (error) {
        console.error('Supabase upload error:', error);
        throw new BadRequestException('Supabase upload failed: ' + error.message);
      } else {
        const { data: publicUrlData } = this.supabase.storage.from(this.bucket).getPublicUrl(path);
        fileUrl = publicUrlData.publicUrl;
      }

      // Mark other images as not primary
      await this.prisma.visitorImage.updateMany({
        where: { visitorId },
        data: { isPrimary: false }
      });

      const visitorImage = await this.prisma.visitorImage.create({
        data: {
          visitorId,
          imageType: VisitorImageType.PROFILE,
          imageSource: VisitorImageSource.UPLOADED,
          fileName,
          fileUrl,
          storagePath: path,
          mimeType: file.mimetype,
          fileSizeKb: Math.round(file.size / 1024),
          isPrimary: true,
          createdById: actorId,
        }
      });

      return {
        success: true,
        imageUrl: fileUrl,
        visitorImageId: visitorImage.id
      };
    } catch (err) {
      console.error('Failed to upload image:', err);
      throw new BadRequestException('Failed to upload image');
    }
  }

  async replacePhoto(visitorId: string, file: Express.Multer.File, actorId: string): Promise<any> {
    return this.uploadPhoto(visitorId, file, actorId);
  }

  async getPhoto(visitorId: string): Promise<any> {
    const visitorImage = await this.prisma.visitorImage.findFirst({
      where: { visitorId, isPrimary: true, deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });

    if (!visitorImage) {
      return { image: null };
    }

    return {
      success: true,
      imageUrl: visitorImage.fileUrl,
      visitorImageId: visitorImage.id
    };
  }

  async create(
    dto: CreateVisitorDto,
    actorId: string,
    tx?: VisitorDbClient,
  ): Promise<VisitorRecord> {
    return this.runInTransaction(tx, async (client) => {
      const data = await this.visitorDomainService.prepareCreateInput(dto, actorId);

      console.log('DEBUG_VISITOR_CREATE_DATA:', data);
      return client.visitor.create({
        data,
        select: VISITOR_SELECT,
      });
    });
  }

  async update(
    id: string,
    dto: UpdateVisitorDto,
    actorId: string,
    tx?: VisitorDbClient,
  ): Promise<VisitorRecord | null> {
    return this.runInTransaction(tx, async (client) => {
      const existing = await client.visitor.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        select: VISITOR_SELECT,
      });

      if (!existing) {
        return null;
      }

      const data = await this.visitorDomainService.prepareUpdateInput(existing, dto, actorId);

      return client.visitor.update({
        where: { id: existing.id },
        data,
        select: VISITOR_SELECT,
      });
    });
  }

  async getById(
    id: string,
    options: VisitorLookupOptions = {},
  ): Promise<VisitorRecord | null> {
    return this.client(options.tx).visitor.findFirst({
      where: this.buildVisibleWhere({ id }, options.includeDeleted),
      select: VISITOR_SELECT,
    });
  }

  async getByMobile(
    mobileNumber: string,
    options: VisitorLookupOptions = {},
  ): Promise<VisitorRecord | null> {
    return this.client(options.tx).visitor.findFirst({
      where: this.buildVisibleWhere(
        {
          OR: [
            { mobileNumber: mobileNumber.trim() },
            { mobileNumber: mobileNumber.replace(/\D+/g, '') },
          ],
        },
        options.includeDeleted,
      ),
      select: VISITOR_SELECT,
    });
  }

  async getByEmail(
    email: string,
    options: VisitorLookupOptions = {},
  ): Promise<VisitorRecord | null> {
    const normalized = email.trim();

    if (!normalized) {
      return null;
    }

    return this.client(options.tx).visitor.findFirst({
      where: this.buildVisibleWhere(
        {
          email: {
            equals: normalized,
            mode: 'insensitive',
          },
        },
        options.includeDeleted,
      ),
      select: VISITOR_SELECT,
    });
  }

  async search(
    params: VisitorSearchParams = {},
    tx?: VisitorDbClient,
  ) {
    const page = this.normalizePage(params.page);
    const limit = this.normalizeLimit(params.limit);
    const where = this.buildSearchWhere(params);
    const client = this.client(tx);

    const [data, totalItems] = await Promise.all([
      client.visitor.findMany({
        where,
        select: VISITOR_SELECT,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: this.buildOrderBy(params),
      }),
      client.visitor.count({ where }),
    ]);

    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

    return {
      data,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getVisitHistory(visitorId: string, tx?: VisitorDbClient) {
    const client = this.client(tx);
    const visits = await client.visit.findMany({
      where: {
        visitorId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        hostEmployee: {
          select: {
            id: true,
            full_name: true,
          },
        },
      },
    });

    return visits.map((v) => ({
      id: v.id,
      visitCode: v.visitCode,
      status: v.status,
      purpose: v.purpose,
      meetingDetails: v.meetingDetails,
      hostEmployeeId: v.hostEmployeeId,
      hostEmployeeName: v.hostEmployee?.full_name ?? 'Unknown',
      checkInTime: v.checkInTime,
      checkOutTime: v.checkOutTime,
      scheduledAt: v.scheduledAt,
      createdAt: v.createdAt,
      branchId: v.branchId,
    }));
  }

  async delete(
    id: string,
    actorId: string,
    tx?: VisitorDbClient,
  ): Promise<VisitorRecord | null> {
    return this.runInTransaction(tx, async (client) => {
      const existing = await client.visitor.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        select: VISITOR_SELECT,
      });

      if (!existing) {
        return null;
      }

      await this.visitorDomainService.assertCanDelete(existing, actorId);

      return client.visitor.update({
        where: { id: existing.id },
        data: {
          deletedAt: new Date(),
        },
        select: VISITOR_SELECT,
      });
    });
  }

  async restore(
    id: string,
    actorId: string,
    tx?: VisitorDbClient,
  ): Promise<VisitorRecord | null> {
    return this.runInTransaction(tx, async (client) => {
      const existing = await client.visitor.findFirst({
        where: {
          id,
        },
        select: VISITOR_SELECT,
      });

      if (!existing) {
        return null;
      }

      await this.visitorDomainService.assertCanRestore(existing, actorId);

      return client.visitor.update({
        where: { id: existing.id },
        data: {
          deletedAt: null,
        },
        select: VISITOR_SELECT,
      });
    });
  }

  async exists(criteria: VisitorExistsCriteria, tx?: VisitorDbClient): Promise<boolean> {
    if (
      !criteria.id &&
      !criteria.mobileNumber &&
      !criteria.email
    ) {
      return false;
    }

    const where: Prisma.VisitorWhereInput = {
      AND: [
        criteria.includeDeleted ? undefined : { deletedAt: null },
        criteria.id ? { id: criteria.id } : undefined,
        criteria.mobileNumber ? this.mobileWhere(criteria.mobileNumber) : undefined,
        criteria.email
          ? {
              email: {
                equals: criteria.email.trim(),
                mode: 'insensitive',
              },
            }
          : undefined,
      ].filter(Boolean) as Prisma.VisitorWhereInput[],
    };

    const count = await this.client(tx).visitor.count({ where });
    return count > 0;
  }

  private client(tx?: VisitorDbClient): VisitorDbClient {
    return tx ?? this.prisma;
  }

  private async runInTransaction<T>(
    tx: VisitorDbClient | undefined,
    work: (client: VisitorDbClient) => Promise<T>,
  ): Promise<T> {
    if (tx) {
      return work(tx);
    }

    return this.prisma.$transaction(async (client) => work(client));
  }

  private buildVisibleWhere(
    where: Prisma.VisitorWhereInput,
    includeDeleted = false,
  ): Prisma.VisitorWhereInput {
    if (includeDeleted) {
      return where;
    }

    return {
      AND: [where, { deletedAt: null }],
    };
  }

  private buildSearchWhere(params: VisitorSearchParams): Prisma.VisitorWhereInput {
    const clauses: Prisma.VisitorWhereInput[] = [];

    if (!params.includeDeleted) {
      clauses.push({ deletedAt: null });
    }

    if (params.status) {
      clauses.push({ status: params.status });
    }

    if (params.mobileNumber) {
      clauses.push(this.mobileWhere(params.mobileNumber));
    }

    if (params.email) {
      const email = params.email.trim();
      if (email) {
        clauses.push({
          email: {
            equals: email,
            mode: 'insensitive',
          },
        });
      }
    }

    if (params.search) {
      const search = params.search.trim();
      if (search) {
        clauses.push({
          OR: [
            {
              fullName: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              email: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              mobileNumber: {
                contains: search,
                mode: 'insensitive',
              },
            },
          ],
        });
      }
    }

    if (clauses.length === 0) {
      return {};
    }

    return {
      AND: clauses,
    };
  }

  private buildOrderBy(params: VisitorSearchParams): Prisma.VisitorOrderByWithRelationInput[] {
    const direction: Prisma.SortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc';
    const sortBy = params.sortBy ?? 'createdAt';

    return [{ [sortBy]: direction }, { id: direction }];
  }

  private mobileWhere(mobileNumber: string): Prisma.VisitorWhereInput {
    const trimmed = mobileNumber.trim();
    const digits = trimmed.replace(/\D+/g, '');

    return {
      OR: [
        { mobileNumber: trimmed },
        ...(digits && digits !== trimmed ? [{ mobileNumber: digits }] : []),
      ],
    };
  }

  private normalizePage(page?: number): number {
    if (!Number.isFinite(page) || !page || page < 1) {
      return 1;
    }

    return Math.trunc(page);
  }

  private normalizeLimit(limit?: number): number {
    if (!Number.isFinite(limit) || !limit || limit < 1) {
      return 20;
    }

    return Math.min(Math.trunc(limit), 100);
  }
}
