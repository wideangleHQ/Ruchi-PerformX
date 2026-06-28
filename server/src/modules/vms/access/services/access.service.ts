import { Injectable, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { role_enum } from '@prisma/client';
import { IAccessService } from './access.service.interface';
import { IAccessRepository, IAccessRepositoryToken, VmsAccessVerificationResult } from '../repositories/access.repository.interface';
import { VerifyAccessDto } from '../dto/verify-access.dto';
import { VerifyAccessResponseDto } from '../dto/verify-access-response.dto';
import { VMS_JWT_EXPIRES_IN, VMS_JWT_SECRET } from '../../../../common/constants/vms-jwt.constants';
import { type VmsJwtPayload } from '../../../../common/types/vms-jwt-payload.type';

const vmsJwtService = new JwtService({
  secret: VMS_JWT_SECRET,
  signOptions: {
    expiresIn: VMS_JWT_EXPIRES_IN,
  },
});

@Injectable()
export class AccessService implements IAccessService {
  constructor(
    @Inject(IAccessRepositoryToken)
    private readonly accessRepository: IAccessRepository,
  ) {}

  async verifyAccess(dto: VerifyAccessDto): Promise<VerifyAccessResponseDto> {
    const result = await this.accessRepository.verifyCode(dto.code);

    if (result) {
      const accessToken = vmsJwtService.sign(this.buildPayload(result));
      const { accessId, ...response } = result;
      return {
        ...response,
        accessToken,
      };
    }

    return {
      success: false,
      message: 'Invalid Access Code',
    };
  }

  private buildPayload(result: VmsAccessVerificationResult): VmsJwtPayload {
    return {
      sub: result.accessId,
      accessType: result.accessType,
      role: result.accessType === 'RECEPTION' ? role_enum.ADMIN : role_enum.EMPLOYEE,
      scope: 'vms',
    };
  }
}
