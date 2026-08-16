import { Controller, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { VendorAccessService } from './vendor-access.service';

@Controller('vendor-access')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VendorAccessController {
  constructor(private readonly service: VendorAccessService) {}
}
