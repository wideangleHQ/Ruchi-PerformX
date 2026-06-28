import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { role_enum } from '@prisma/client';
import { ApiResponse } from '../../common/interfaces/api-response.interface';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../../../common/gaurds/roles.guard';
import { JwtPayload } from '../../../../common/types/jwt-payload.type';
import { CreateVisitorRequestDto } from '../dto/create-visitor-request.dto';
import { SearchVisitorRequestDto } from '../dto/search-visitor-request.dto';
import { UpdateVisitorRequestDto } from '../dto/update-visitor-request.dto';
import { VisitorRequestResponseDto } from '../dto/visitor-request-response.dto';
import { VisitorRequestService } from '../services/visitor-request.service';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';
import { VisitResponseDto } from '../../visits/dto/visit-response.dto';

type SwaggerDecorator = ClassDecorator | MethodDecorator | PropertyDecorator;
const noopSwaggerDecorator = (): SwaggerDecorator => ((..._args: unknown[]) => undefined) as SwaggerDecorator;

function ApiTags(..._tags: string[]): ClassDecorator { return noopSwaggerDecorator() as ClassDecorator; }
function ApiBearerAuth(_name?: string): ClassDecorator & MethodDecorator { return noopSwaggerDecorator() as ClassDecorator & MethodDecorator; }
function ApiOperation(_options: { summary: string }): MethodDecorator { return noopSwaggerDecorator() as MethodDecorator; }
function ApiOkResponse(_options: Record<string, unknown>): MethodDecorator { return noopSwaggerDecorator() as MethodDecorator; }
function ApiCreatedResponse(_options: Record<string, unknown>): MethodDecorator { return noopSwaggerDecorator() as MethodDecorator; }
function ApiParam(_options: Record<string, unknown>): MethodDecorator { return noopSwaggerDecorator() as MethodDecorator; }
function ApiBody(_options: Record<string, unknown>): MethodDecorator { return noopSwaggerDecorator() as MethodDecorator; }

@ApiTags('VMS Visitor Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))
@Controller('vms/requests')
export class VisitorRequestController {
  constructor(private readonly visitorRequestService: VisitorRequestService) {}

  @Post()
  @Roles(role_enum.ADMIN, role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA, role_enum.PURCHASE_HEAD, role_enum.EMPLOYEE)
  @ApiOperation({ summary: 'Create visitor request' })
  @ApiCreatedResponse({ type: VisitorRequestResponseDto })
  @ApiBody({ type: CreateVisitorRequestDto })
  create(@Body() dto: CreateVisitorRequestDto, @CurrentUser() user: JwtPayload): Promise<ApiResponse<VisitorRequestResponseDto>> {
    return this.wrap('Visitor request created', this.visitorRequestService.createRequest(dto, user.sub, undefined));
  }

  @Get()
  @Roles(role_enum.ADMIN, role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA, role_enum.PURCHASE_HEAD)
  @ApiOperation({ summary: 'Search visitor requests' })
  @ApiOkResponse({ type: VisitorRequestResponseDto, isArray: true })
  findAll(@Query() query: SearchVisitorRequestDto): Promise<ApiResponse<PaginatedResponse<VisitorRequestResponseDto>>> {
    return this.wrap('Visitor requests retrieved', this.visitorRequestService.searchRequests(query));
  }

  @Get('pending')
  @Roles(role_enum.ADMIN, role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA, role_enum.PURCHASE_HEAD)
  @ApiOperation({ summary: 'Get pending visitor requests' })
  @ApiOkResponse({ type: VisitorRequestResponseDto, isArray: true })
  findPending(@Query() query: SearchVisitorRequestDto): Promise<ApiResponse<PaginatedResponse<VisitorRequestResponseDto>>> {
    return this.wrap('Pending visitor requests retrieved', this.visitorRequestService.getPendingRequests(query));
  }

  @Get('my')
  @Roles(role_enum.ADMIN, role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA, role_enum.PURCHASE_HEAD, role_enum.EMPLOYEE)
  @ApiOperation({ summary: 'Get my visitor requests' })
  @ApiOkResponse({ type: VisitorRequestResponseDto, isArray: true })
  findMine(@Query() query: SearchVisitorRequestDto, @CurrentUser() user: JwtPayload): Promise<ApiResponse<PaginatedResponse<VisitorRequestResponseDto>>> {
    return this.wrap('Employee visitor requests retrieved', this.visitorRequestService.getEmployeeRequests(user.sub, query));
  }

  @Get(':id')
  @Roles(role_enum.ADMIN, role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA, role_enum.PURCHASE_HEAD, role_enum.EMPLOYEE)
  @ApiOperation({ summary: 'Get visitor request by id' })
  @ApiOkResponse({ type: VisitorRequestResponseDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<VisitorRequestResponseDto>> {
    return this.wrap('Visitor request retrieved', this.visitorRequestService.getRequest(id));
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(role_enum.ADMIN, role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA, role_enum.PURCHASE_HEAD, role_enum.EMPLOYEE)
  @ApiOperation({ summary: 'Update visitor request' })
  @ApiOkResponse({ type: VisitorRequestResponseDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateVisitorRequestDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVisitorRequestDto, @CurrentUser() user: JwtPayload): Promise<ApiResponse<VisitorRequestResponseDto>> {
    return this.wrap('Visitor request updated', this.visitorRequestService.updateRequest(id, dto, user.sub, undefined));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(role_enum.ADMIN, role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA, role_enum.PURCHASE_HEAD, role_enum.EMPLOYEE)
  @ApiOperation({ summary: 'Cancel visitor request' })
  @ApiOkResponse({ type: VisitorRequestResponseDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload): Promise<ApiResponse<VisitorRequestResponseDto>> {
    return this.wrap('Visitor request cancelled', this.visitorRequestService.cancelRequest(id, user.sub, undefined));
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(role_enum.ADMIN, role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA, role_enum.PURCHASE_HEAD)
  @ApiOperation({ summary: 'Approve visitor request' })
  @ApiOkResponse({ type: VisitorRequestResponseDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload): Promise<ApiResponse<VisitorRequestResponseDto>> {
    return this.wrap('Visitor request approved', this.visitorRequestService.approveRequest(id, user.sub, undefined));
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Roles(role_enum.ADMIN, role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA, role_enum.PURCHASE_HEAD)
  @ApiOperation({ summary: 'Reject visitor request' })
  @ApiOkResponse({ type: VisitorRequestResponseDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  reject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload): Promise<ApiResponse<VisitorRequestResponseDto>> {
    return this.wrap('Visitor request rejected', this.visitorRequestService.rejectRequest(id, user.sub, undefined));
  }

  @Post(':id/create-visit')
  @HttpCode(HttpStatus.CREATED)
  @Roles(role_enum.ADMIN, role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA, role_enum.PURCHASE_HEAD)
  @ApiOperation({ summary: 'Create visit from approved request' })
  @ApiOkResponse({ type: VisitResponseDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  createVisit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload): Promise<ApiResponse<VisitResponseDto>> {
    return this.wrap('Visit created from request', this.visitorRequestService.createVisitFromRequest(id, user.sub, undefined));
  }

  private async wrap<T>(message: string, promise: Promise<T>): Promise<ApiResponse<T>> {
    return { success: true, message, data: await promise };
  }
}
