import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { PassService, PassPrintData } from './pass.service.interface';
import { GeneratePassDto } from '../dto/generate-pass.dto';
import { ReprintPassDto } from '../dto/reprint-pass.dto';
import { PassResponseDto } from '../dto/pass-response.dto';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PassRepository, PassRecord } from '../repositories/pass.repository.interface';
import { PrismaService } from '../../../../prisma/prisma.service';
import { plainToInstance } from 'class-transformer';
import { VMS_PASS_NUMBER_PREFIX } from '../../common/constants/vms.constants';

@Injectable()
export class PassServiceImpl implements PassService {
  constructor(
    @Inject('PassRepository')
    private readonly passRepository: PassRepository,
    private readonly prisma: PrismaService,
  ) {}

  async generateUniquePassNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `${VMS_PASS_NUMBER_PREFIX}-${year}`;
    
    const latestPass = await this.prisma.visit.findFirst({
      where: { visitCode: { startsWith: prefix } },
      orderBy: { visitCode: 'desc' },
      select: { visitCode: true }
    });

    let nextSequence = 1;
    if (latestPass && latestPass.visitCode) {
      const parts = latestPass.visitCode.split('-');
      if (parts.length === 3) {
        const seq = parseInt(parts[2] || '', 10);
        if (!isNaN(seq)) {
          nextSequence = seq + 1;
        }
      }
    }

    const sequenceStr = nextSequence.toString().padStart(6, '0');
    return `${prefix}-${sequenceStr}`;
  }

  async generatePass(dto: GeneratePassDto, user: AuthenticatedUser): Promise<PassResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const visit = await this.passRepository.findById(dto.visitId, tx);
      if (!visit) {
        throw new NotFoundException('Visit not found');
      }

      if (visit.visitCode) {
        throw new ConflictException('Pass already generated for this visit');
      }

      const passNumber = await this.generateUniquePassNumber();
      const updated = await this.passRepository.create(dto.visitId, passNumber, tx);
      
      return this.mapToResponse(updated);
    });
  }

  async getPass(passId: string, user: AuthenticatedUser): Promise<PassResponseDto> {
    return this.getPassByVisit(passId, user);
  }

  async getPassByVisit(visitId: string, user: AuthenticatedUser): Promise<PassResponseDto> {
    const pass = await this.passRepository.findByVisitId(visitId);
    if (!pass || !pass.visitCode) {
      throw new NotFoundException('Pass not found for this visit');
    }
    return this.mapToResponse(pass);
  }

  async reprintPass(visitId: string, dto: ReprintPassDto, user: AuthenticatedUser): Promise<PassResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const pass = await this.passRepository.findByVisitId(visitId, tx);
      if (!pass || !pass.visitCode) {
        throw new NotFoundException('Pass not found for this visit');
      }

      await tx.audit_logs.create({
        data: {
          user_id: user.id,
          action: 'PASS_REPRINTED',
          entity: 'visits',
          entity_id: visitId,
          new_value: JSON.stringify({ reason: dto.reason }),
        }
      });

      const updated = await this.passRepository.reprint(visitId, tx);
      return this.mapToResponse(updated);
    });
  }

  async generatePrintablePassData(visitId: string, user: AuthenticatedUser): Promise<PassPrintData> {
    const pass = await this.passRepository.findByVisitId(visitId);
    if (!pass || !pass.visitCode) {
      throw new NotFoundException('Pass not found');
    }

    return {
      passNumber: pass.visitCode,
      visitorName: pass.visitor.fullName,
      hostName: pass.hostEmployee.full_name,
      checkInTime: pass.checkInTime ? pass.checkInTime.toISOString() : null,
      issuedAt: pass.qrPassIssuedAt ? pass.qrPassIssuedAt.toISOString() : new Date().toISOString(),
    };
  }

  async generatePdfData(visitId: string, user: AuthenticatedUser): Promise<Record<string, any>> {
    const printableData = await this.generatePrintablePassData(visitId, user);
    return {
      template: 'standard-visitor-pass',
      data: printableData,
      generatedAt: new Date().toISOString(),
      generatedBy: user.fullName,
    };
  }

  async validatePassStatus(visitId: string): Promise<boolean> {
    const pass = await this.passRepository.findByVisitId(visitId);
    return !!(pass && pass.visitCode && pass.status === 'CHECKED_IN');
  }

  private mapToResponse(record: PassRecord): PassResponseDto {
    return plainToInstance(PassResponseDto, {
      passNumber: record.visitCode,
      visitor: {
        id: record.visitor.id,
        fullName: record.visitor.fullName,
        mobileNumber: record.visitor.mobileNumber,
      },
      employee: {
        id: record.hostEmployee.id,
        full_name: record.hostEmployee.full_name,
      },
      visitId: record.id,
      checkInTime: record.checkInTime,
      status: record.status,
      purpose: record.purpose,
      peopleCount: record.peopleCount,
    });
  }
}
