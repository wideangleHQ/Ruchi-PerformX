import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { role_enum } from '@prisma/client';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../../../common/gaurds/roles.guard';
import { JwtPayload } from '../../../../common/types/jwt-payload.type';
import { CreateVisitDto } from '../dto/create-visit.dto';
import { CheckInDto } from '../dto/check-in.dto';
import { CheckOutDto } from '../dto/check-out.dto';
import { SearchVisitDto } from '../dto/search-visit.dto';
import { VisitService } from '../services/visit.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))
@Controller('vms/visits')
@Roles(
  role_enum.ADMIN,
  role_enum.MD,
  role_enum.HOD,
  role_enum.EA,
  role_enum.PA,
  role_enum.PURCHASE_HEAD,
  role_enum.EMPLOYEE,
)
export class VisitController {
  constructor(private readonly visitService: VisitService) {}

  @Post()
  create(@Body() dto: CreateVisitDto, @CurrentUser() user: JwtPayload) {
    return this.visitService.createVisit(dto, user.sub);
  }

  @Get()
  search(@Query() query: SearchVisitDto) {
    // Explicitly include relations for the frontend
    return this.visitService.searchVisits({
      ...query,
      includeVisitor: true,
      includeHostEmployee: true,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.visitService.getVisit(id, { includeVisitor: true, includeHostEmployee: true });
  }

  @Post(':id/check-in')
  checkIn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckInDto,
    @CurrentUser() user: JwtPayload,
  ) {
    dto.visitId = id; // Ensure the DTO matches the URL parameter
    return this.visitService.checkIn(dto, user.sub);
  }

  @Post(':id/check-out')
  checkOut(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckOutDto,
    @CurrentUser() user: JwtPayload,
  ) {
    dto.visitId = id; // Ensure the DTO matches the URL parameter
    return this.visitService.checkOut(dto, user.sub);
  }
}
