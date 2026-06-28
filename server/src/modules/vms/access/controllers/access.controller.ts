import { Controller, Post, Body, Inject } from '@nestjs/common';
import { IAccessService, IAccessServiceToken } from '../services/access.service.interface';
import { VerifyAccessDto } from '../dto/verify-access.dto';
import { VerifyAccessResponseDto } from '../dto/verify-access-response.dto';
import { Public } from '../../../../common/decorators/public.decorator';

@Controller('vms/access')
export class AccessController {
  constructor(
    @Inject(IAccessServiceToken)
    private readonly accessService: IAccessService,
  ) {}

  @Public()
  @Post('verify')
  async verify(@Body() dto: VerifyAccessDto): Promise<VerifyAccessResponseDto> {
    return this.accessService.verifyAccess(dto);
  }
}
