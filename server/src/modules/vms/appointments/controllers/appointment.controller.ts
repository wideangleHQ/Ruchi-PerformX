import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CreateAppointmentDto } from '../dto/create-appointment.dto';
import { UpdateAppointmentDto } from '../dto/update-appointment.dto';
import { SearchAppointmentDto } from '../dto/search-appointment.dto';
import { AppointmentResponseDto, PaginatedAppointmentResponseDto } from '../dto/appointment-response.dto';
import { IAppointmentServiceToken, IAppointmentService } from '../services/appointment.service.interface';

// Swagger dummy decorators
type SwaggerDecorator = ClassDecorator & MethodDecorator & PropertyDecorator;
const noopSwaggerDecorator = (): SwaggerDecorator => ((..._args: unknown[]) => undefined) as SwaggerDecorator;
function ApiTags(..._tags: string[]): ClassDecorator { return noopSwaggerDecorator(); }
function ApiBearerAuth(_name?: string): ClassDecorator & MethodDecorator { return noopSwaggerDecorator(); }
function ApiOperation(_options: { summary: string }): MethodDecorator { return noopSwaggerDecorator(); }
function ApiOkResponse(_options: Record<string, unknown>): MethodDecorator { return noopSwaggerDecorator(); }
function ApiCreatedResponse(_options: Record<string, unknown>): MethodDecorator { return noopSwaggerDecorator(); }
function ApiParam(_options: Record<string, unknown>): MethodDecorator { return noopSwaggerDecorator(); }
function ApiBody(_options: Record<string, unknown>): MethodDecorator { return noopSwaggerDecorator(); }

@ApiTags('VMS Appointments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))
@Controller('vms/appointments')
@Roles(
  role_enum.ADMIN,
  role_enum.MD,
  role_enum.HOD,
  role_enum.EA,
  role_enum.PA,
  role_enum.PURCHASE_HEAD,
  role_enum.EMPLOYEE,
)
export class AppointmentController {
  constructor(
    @Inject(IAppointmentServiceToken)
    private readonly appointmentService: IAppointmentService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create appointment' })
  @ApiCreatedResponse({ type: AppointmentResponseDto })
  @ApiBody({ type: CreateAppointmentDto })
  create(@Body() dto: CreateAppointmentDto, @CurrentUser() user: JwtPayload) {
    return this.appointmentService.createAppointment(dto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'Search appointments' })
  @ApiOkResponse({ type: PaginatedAppointmentResponseDto })
  search(@Query() query: SearchAppointmentDto) {
    return this.appointmentService.searchAppointments(query);
  }

  @Get('today')
  @ApiOperation({ summary: 'Get todays appointments' })
  @ApiOkResponse({ type: AppointmentResponseDto, isArray: true })
  getToday(@Query('hostEmployeeId') hostEmployeeId?: string) {
    return this.appointmentService.getTodayAppointments(hostEmployeeId);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming appointments' })
  @ApiOkResponse({ type: AppointmentResponseDto, isArray: true })
  getUpcoming(@Query('hostEmployeeId') hostEmployeeId?: string) {
    return this.appointmentService.getUpcomingAppointments(hostEmployeeId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get appointment by id' })
  @ApiOkResponse({ type: AppointmentResponseDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.appointmentService.getAppointment(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update appointment' })
  @ApiOkResponse({ type: AppointmentResponseDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateAppointmentDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.appointmentService.updateAppointment(id, dto, user.sub);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel appointment' })
  @ApiOkResponse({ type: AppointmentResponseDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.appointmentService.cancelAppointment(id, user.sub);
  }

  @Post(':id/reschedule')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reschedule appointment' })
  @ApiOkResponse({ type: AppointmentResponseDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: { properties: { newDate: { type: 'string', format: 'date-time' } } } })
  reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('newDate') newDate: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.appointmentService.rescheduleAppointment(id, newDate, user.sub);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete appointment' })
  @ApiOkResponse({ type: AppointmentResponseDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  complete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.appointmentService.completeAppointment(id, user.sub);
  }
}
