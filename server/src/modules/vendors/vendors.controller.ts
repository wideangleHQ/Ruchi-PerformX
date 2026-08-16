import { Controller, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { VendorsService } from './vendors.service';

@Controller('vendors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VendorsController {
  constructor(private readonly service: VendorsService) {}
}
