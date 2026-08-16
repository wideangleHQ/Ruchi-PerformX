import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { role_enum } from '@prisma/client';
import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { PollsService } from './polls.service';
import { CreatePollDto } from './dto/create-poll.dto';
import { VotePollDto } from './dto/vote-poll.dto';

// Every role except VENDOR. A poll is an internal, company wide question and a
// vendor is external, so the portal namespace does not reach these routes.
const INTERNAL_ROLES = [
  role_enum.MD,
  role_enum.EA,
  role_enum.PA,
  role_enum.DEPARTMENT_CONTROLLER,
  role_enum.PURCHASE_HEAD,
  role_enum.HOD,
  role_enum.EMPLOYEE,
  role_enum.ADMIN,
  role_enum.HR,
];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('polls')
export class PollsController {
  constructor(private readonly pollsService: PollsService) {}

  /** Open polls with the caller's vote state. Declared above `/polls/:id` so it is not shadowed. */
  @Get('active')
  @Roles(...INTERNAL_ROLES)
  listActive(@CurrentUser() user: JwtPayload) {
    return this.pollsService.listActive(user.sub);
  }

  /** Every poll, open and closed, newest first. */
  @Get()
  @Roles(...INTERNAL_ROLES)
  list(@CurrentUser() user: JwtPayload) {
    return this.pollsService.list(user.sub);
  }

  /** Raises a poll. Any internal user, not just management. */
  @Post()
  @Roles(...INTERNAL_ROLES)
  create(@Body() dto: CreatePollDto, @CurrentUser() user: JwtPayload) {
    return this.pollsService.create(dto, user);
  }

  /** One poll with live results and the caller's own vote. */
  @Get(':id')
  @Roles(...INTERNAL_ROLES)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.pollsService.findOne(id, user.sub);
  }

  /** Casts or changes the caller's vote and broadcasts the new tallies. */
  @Post(':id/vote')
  @Roles(...INTERNAL_ROLES)
  vote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VotePollDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.pollsService.vote(id, dto, user.sub);
  }

  /** Closes a poll early. Creator or MD; the service enforces which. */
  @Patch(':id/close')
  @Roles(...INTERNAL_ROLES)
  close(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.pollsService.close(id, user);
  }

  /** Deletes a poll with its options and votes. Creator or MD. */
  @Delete(':id')
  @Roles(...INTERNAL_ROLES)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.pollsService.remove(id, user);
  }
}
