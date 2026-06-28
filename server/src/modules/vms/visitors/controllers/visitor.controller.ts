import 'multer';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { role_enum } from '@prisma/client';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../../../common/gaurds/roles.guard';
import { JwtPayload } from '../../../../common/types/jwt-payload.type';
import { CreateVisitorDto } from '../dto/create-visitor.dto';
import { SearchVisitorDto } from '../dto/search-visitor.dto';
import { UpdateVisitorDto } from '../dto/update-visitor.dto';
import { VisitorResponseDto } from '../dto/visitor-response.dto';
import { VisitHistoryResponseDto } from '../dto/visit-history-response.dto';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';
import { VisitorRecord } from '../repositories/visitor.repository.interface';
import { VisitorService } from '../services/visitor.service';

type SwaggerDecorator = ClassDecorator & MethodDecorator & PropertyDecorator;

const noopSwaggerDecorator = (): SwaggerDecorator =>
  ((..._args: unknown[]) => undefined) as SwaggerDecorator;

function ApiTags(..._tags: string[]): ClassDecorator {
  return noopSwaggerDecorator();
}

function ApiBearerAuth(_name?: string): ClassDecorator & MethodDecorator {
  return noopSwaggerDecorator();
}

function ApiOperation(_options: { summary: string }): MethodDecorator {
  return noopSwaggerDecorator();
}

function ApiOkResponse(_options: Record<string, unknown>): MethodDecorator {
  return noopSwaggerDecorator();
}

function ApiCreatedResponse(_options: Record<string, unknown>): MethodDecorator {
  return noopSwaggerDecorator();
}

function ApiParam(_options: Record<string, unknown>): MethodDecorator {
  return noopSwaggerDecorator();
}

function ApiBody(_options: Record<string, unknown>): MethodDecorator {
  return noopSwaggerDecorator();
}

@ApiTags('VMS Visitors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))
@Controller('vms/visitors')
@Roles(
  role_enum.ADMIN,
  role_enum.MD,
  role_enum.HOD,
  role_enum.EA,
  role_enum.PA,
  role_enum.PURCHASE_HEAD,
  role_enum.EMPLOYEE,
)
export class VisitorController {
  constructor(private readonly visitorService: VisitorService) {}

  @Post()
  @ApiOperation({ summary: 'Create visitor' })
  @ApiCreatedResponse({ type: VisitorResponseDto })
  @ApiBody({ type: CreateVisitorDto })
  create(@Body() dto: CreateVisitorDto, @CurrentUser() user: JwtPayload): Promise<VisitorRecord> {
    return this.visitorService.create(dto, user.sub);
  }

  @Post(':id/photo')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiOperation({ summary: 'Upload visitor profile photo' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5 MB
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg|webp)' }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.visitorService.uploadPhoto(id, file, user.sub);
  }

  @Put(':id/photo')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiOperation({ summary: 'Replace visitor profile photo' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async replacePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg|webp)' }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.visitorService.replacePhoto(id, file, user.sub);
  }

  @Get(':id/photo')
  @ApiOperation({ summary: 'Get visitor profile photo' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async getPhoto(@Param('id', ParseUUIDPipe) id: string) {
    return this.visitorService.getPhoto(id);
  }

  @Get()
  @ApiOperation({ summary: 'Search visitors' })
  @ApiOkResponse({ type: VisitorResponseDto, isArray: true })
  findAll(@Query() query: SearchVisitorDto): Promise<PaginatedResponse<VisitorRecord>> {
    return this.visitorService.search(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get visitor by id' })
  @ApiOkResponse({ type: VisitorResponseDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<VisitorRecord | null> {
    return this.visitorService.getById(id);
  }

  @Get(':id/visits')
  @ApiOperation({ summary: 'Get visitor visit history' })
  @ApiOkResponse({ type: VisitHistoryResponseDto, isArray: true })
  @ApiParam({ name: 'id', format: 'uuid' })
  getVisitHistory(@Param('id', ParseUUIDPipe) id: string): Promise<VisitHistoryResponseDto[]> {
    return this.visitorService.getVisitHistory(id) as Promise<VisitHistoryResponseDto[]>;
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update visitor' })
  @ApiOkResponse({ type: VisitorResponseDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateVisitorDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVisitorDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<VisitorRecord | null> {
    return this.visitorService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete visitor' })
  @ApiOkResponse({ type: VisitorResponseDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload): Promise<VisitorRecord | null> {
    return this.visitorService.delete(id, user.sub);
  }

  @Patch(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore visitor' })
  @ApiOkResponse({ type: VisitorResponseDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  restore(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload): Promise<VisitorRecord | null> {
    return this.visitorService.restore(id, user.sub);
  }
}
