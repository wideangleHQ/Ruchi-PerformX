import { VerifyAccessDto } from '../dto/verify-access.dto';
import { VerifyAccessResponseDto } from '../dto/verify-access-response.dto';

export interface IAccessService {
  verifyAccess(dto: VerifyAccessDto): Promise<VerifyAccessResponseDto>;
}

export const IAccessServiceToken = Symbol('IAccessService');
