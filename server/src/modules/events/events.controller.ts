import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile as UploadedReceipt,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { role_enum } from '@prisma/client';
import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { UploadedFile } from '../../common/types/uploaded-file.type';
import { EventsService } from './events.service';
import { AddCoordinatorDto } from './dto/add-coordinator.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

// Every role except VENDOR. Events are internal, and an empty @Roles list means
// any authenticated user, which includes a vendor holding a portal token.
const INTERNAL_ROLES: role_enum[] = [
  role_enum.MD,
  role_enum.HOD,
  role_enum.EMPLOYEE,
  role_enum.ADMIN,
  role_enum.HR,
  role_enum.EA,
  role_enum.PA,
  role_enum.DEPARTMENT_CONTROLLER,
  role_enum.PURCHASE_HEAD,
];

/**
 * Coarse gate only. Which of these people may edit an event, change its
 * coordinators, or touch an expense is decided in the service, because it
 * depends on the row rather than the role.
 */
@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventsController {
  constructor(private readonly service: EventsService) {}

  @Get()
  @Roles(...INTERNAL_ROLES)
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @Roles(...INTERNAL_ROLES)
  create(@Body() dto: CreateEventDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  @Get(':id')
  @Roles(...INTERNAL_ROLES)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles(...INTERNAL_ROLES)
  update(@Param('id') id: string, @Body() dto: UpdateEventDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(...INTERNAL_ROLES)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(id, user);
  }

  @Post(':id/coordinators')
  @Roles(...INTERNAL_ROLES)
  addCoordinator(
    @Param('id') id: string,
    @Body() dto: AddCoordinatorDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.addCoordinator(id, dto, user);
  }

  @Delete(':id/coordinators/:userId')
  @Roles(...INTERNAL_ROLES)
  removeCoordinator(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removeCoordinator(id, userId, user);
  }

  @Get(':id/budget-report')
  @Roles(...INTERNAL_ROLES)
  budgetReport(@Param('id') id: string) {
    return this.service.budgetReport(id);
  }

  @Get(':id/expenses')
  @Roles(...INTERNAL_ROLES)
  findExpenses(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findExpenses(id, user);
  }

  /** multipart/form-data: `item`, `amount`, and an optional `receipt` file. */
  @Post(':id/expenses')
  @Roles(...INTERNAL_ROLES)
  @UseInterceptors(FileInterceptor('receipt'))
  createExpense(
    @Param('id') id: string,
    @Body() dto: CreateExpenseDto,
    @UploadedReceipt() receipt: UploadedFile | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createExpense(id, dto, user, receipt);
  }

  @Patch(':id/expenses/:expenseId')
  @Roles(...INTERNAL_ROLES)
  updateExpense(
    @Param('id') id: string,
    @Param('expenseId') expenseId: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateExpense(id, expenseId, dto, user);
  }

  @Delete(':id/expenses/:expenseId')
  @Roles(...INTERNAL_ROLES)
  removeExpense(
    @Param('id') id: string,
    @Param('expenseId') expenseId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removeExpense(id, expenseId, user);
  }
}
