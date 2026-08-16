import { Controller, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { VendorWorkService } from './vendor-work.service';

@Controller('vendor-work')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VendorWorkController {
  constructor(private readonly service: VendorWorkService) {}
}
