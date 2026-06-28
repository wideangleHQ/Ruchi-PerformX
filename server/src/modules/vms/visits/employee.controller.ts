import {
  Controller,
  Get,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { role_enum } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../../common/gaurds/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { EmployeeSearchDto, EmployeeListResponseDto } from './employee.dto';
import { EmployeeService } from './employee.service';

type SwaggerDecorator = ClassDecorator | MethodDecorator | PropertyDecorator;
const noopSwaggerDecorator = (): SwaggerDecorator => ((..._args: unknown[]) => undefined) as SwaggerDecorator;

function ApiTags(..._tags: string[]): ClassDecorator {
  return noopSwaggerDecorator() as ClassDecorator;
}

function ApiBearerAuth(_name?: string): ClassDecorator & MethodDecorator {
  return noopSwaggerDecorator() as ClassDecorator & MethodDecorator;
}

function ApiOperation(_options: { summary: string }): MethodDecorator {
  return noopSwaggerDecorator() as MethodDecorator;
}

function ApiOkResponse(_options: Record<string, unknown>): MethodDecorator {
  return noopSwaggerDecorator() as MethodDecorator;
}

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))
@Controller('vms/visits/employees')
@Roles(role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA, role_enum.ADMIN, role_enum.PURCHASE_HEAD, role_enum.EMPLOYEE)
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get()
  @ApiOperation({ summary: 'List active employees' })
  @ApiOkResponse({ type: EmployeeListResponseDto })
  getEmployees(@Query() query: EmployeeSearchDto): Promise<EmployeeListResponseDto> {
    return this.employeeService.getEmployees(query);
  }
}
