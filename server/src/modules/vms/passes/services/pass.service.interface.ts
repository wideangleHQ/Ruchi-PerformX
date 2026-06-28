import { GeneratePassDto } from '../dto/generate-pass.dto';
import { ReprintPassDto } from '../dto/reprint-pass.dto';
import { PassResponseDto } from '../dto/pass-response.dto';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

export interface PassPrintData {
  passNumber: string;
  visitorName: string;
  hostName: string;
  checkInTime: string | null;
  issuedAt: string;
}

export interface PassService {
  generatePass(dto: GeneratePassDto, user: AuthenticatedUser): Promise<PassResponseDto>;
  generateUniquePassNumber(): Promise<string>;
  getPass(passId: string, user: AuthenticatedUser): Promise<PassResponseDto>;
  getPassByVisit(visitId: string, user: AuthenticatedUser): Promise<PassResponseDto>;
  reprintPass(visitId: string, dto: ReprintPassDto, user: AuthenticatedUser): Promise<PassResponseDto>;
  generatePrintablePassData(visitId: string, user: AuthenticatedUser): Promise<PassPrintData>;
  generatePdfData(visitId: string, user: AuthenticatedUser): Promise<Record<string, any>>;
  validatePassStatus(visitId: string): Promise<boolean>;
}
