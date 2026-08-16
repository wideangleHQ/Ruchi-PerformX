import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { role_enum } from '@prisma/client';

import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.guard';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { VendorWorkService } from './vendor-work.service';
import {
  CreateVendorAssignmentDto,
  UpdateVendorAssignmentDto,
} from './dto/work/vendor-assignment.dto';
import {
  CreateVendorContractDto,
  UpdateVendorContractDto,
} from './dto/work/vendor-contract.dto';
import { CreateVendorDocumentDto } from './dto/work/vendor-document.dto';
import {
  CreateVendorDeliverableDto,
  UpdateVendorDeliverableDto,
} from './dto/work/vendor-deliverable.dto';
import { CreateVendorNoteDto } from './dto/work/vendor-note.dto';
import { CreateVendorReviewDto } from './dto/work/vendor-review.dto';
import {
  VendorDeliverableQueryDto,
  VendorDocumentQueryDto,
  VendorNoteQueryDto,
  VendorWorkQueryDto,
} from './dto/work/vendor-work-query.dto';

/**
 * Every internal role. Holding one of these is not permission to be here: it
 * only gets the request as far as the service, where `assertAccess` looks for
 * the `vendor_dashboard_access` row that actually decides.
 *
 * The external vendor role is deliberately absent and must stay absent.
 * `RolesGuard` knows nothing about assignments, so listing it here would open
 * contracts, internal notes and internal ratings to every vendor at once.
 * `just vendor-roles` fails the build if anyone adds it.
 */
const INTERNAL_ROLES: role_enum[] = [
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

/**
 * The work half of internal Vendor Management: assignments, contracts,
 * documents, deliverables, notes, reviews, and the two derived reads.
 *
 * No controller prefix, because these are six sibling collections plus two
 * routes under `/vendors/:id` rather than one resource. `/vendors/:id` itself
 * belongs to `VendorsController`, which is registered first; a two-segment
 * route there cannot shadow the three-segment ones here.
 */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class VendorWorkController {
  constructor(private readonly service: VendorWorkService) {}

  // ---------------------------------------------------------------- assignments

  /** Work items per vendor. Also the allowlist the external portal reads. */
  @Get('vendor-assignments')
  @Roles(...INTERNAL_ROLES)
  findAssignments(
    @Query() query: VendorWorkQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findAssignments(query, user);
  }

  /** Creating a row grants the vendor sight of the entity named. */
  @Post('vendor-assignments')
  @Roles(...INTERNAL_ROLES)
  createAssignment(
    @Body() dto: CreateVendorAssignmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createAssignment(dto, user);
  }

  /** Manager or admin, or the person who made the assignment. */
  @Patch('vendor-assignments/:id')
  @Roles(...INTERNAL_ROLES)
  updateAssignment(
    @Param('id') id: string,
    @Body() dto: UpdateVendorAssignmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateAssignment(id, dto, user);
  }

  /** Revokes the vendor's access to that entity as a side effect. */
  @Delete('vendor-assignments/:id')
  @Roles(...INTERNAL_ROLES)
  removeAssignment(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.removeAssignment(id, user);
  }

  // ------------------------------------------------------------------ contracts

  @Get('vendor-contracts')
  @Roles(...INTERNAL_ROLES)
  findContracts(
    @Query() query: VendorWorkQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findContracts(query, user);
  }

  @Post('vendor-contracts')
  @Roles(...INTERNAL_ROLES)
  createContract(
    @Body() dto: CreateVendorContractDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createContract(dto, user);
  }

  @Patch('vendor-contracts/:id')
  @Roles(...INTERNAL_ROLES)
  updateContract(
    @Param('id') id: string,
    @Body() dto: UpdateVendorContractDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateContract(id, dto, user);
  }

  // ------------------------------------------------------------------ documents

  /** Rows carry a derived `status`, computed from `expiry_date` on read. */
  @Get('vendor-documents')
  @Roles(...INTERNAL_ROLES)
  findDocuments(
    @Query() query: VendorDocumentQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findDocuments(query, user);
  }

  /** Records a file already uploaded through the attachments module. */
  @Post('vendor-documents')
  @Roles(...INTERNAL_ROLES)
  createDocument(
    @Body() dto: CreateVendorDocumentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createDocument(dto, user);
  }

  /** Admin only. A deleted compliance document is a gap nobody sees. */
  @Delete('vendor-documents/:id')
  @Roles(...INTERNAL_ROLES)
  removeDocument(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.removeDocument(id, user);
  }

  // --------------------------------------------------------------- deliverables

  @Get('vendor-deliverables')
  @Roles(...INTERNAL_ROLES)
  findDeliverables(
    @Query() query: VendorDeliverableQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findDeliverables(query, user);
  }

  @Post('vendor-deliverables')
  @Roles(...INTERNAL_ROLES)
  createDeliverable(
    @Body() dto: CreateVendorDeliverableDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createDeliverable(dto, user);
  }

  /** Manager or admin, or the deliverable's internal owner. */
  @Patch('vendor-deliverables/:id')
  @Roles(...INTERNAL_ROLES)
  updateDeliverable(
    @Param('id') id: string,
    @Body() dto: UpdateVendorDeliverableDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateDeliverable(id, dto, user);
  }

  // --------------------------------------------------------------------- notes

  /** Both threads by default. Internal only, whatever `thread` says. */
  @Get('vendor-notes')
  @Roles(...INTERNAL_ROLES)
  findNotes(
    @Query() query: VendorNoteQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findNotes(query, user);
  }

  @Post('vendor-notes')
  @Roles(...INTERNAL_ROLES)
  createNote(
    @Body() dto: CreateVendorNoteDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createNote(dto, user);
  }

  // ------------------------------------------------------------------- reviews

  /** Internal ratings. Manager or admin only, and never shown to the vendor. */
  @Get('vendor-reviews')
  @Roles(...INTERNAL_ROLES)
  findReviews(
    @Query() query: VendorWorkQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findReviews(query, user);
  }

  @Post('vendor-reviews')
  @Roles(...INTERNAL_ROLES)
  createReview(
    @Body() dto: CreateVendorReviewDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createReview(dto, user);
  }

  // ------------------------------------------------------- derived vendor reads

  /** Contract, document, assignment and deliverable dates in one list. */
  @Get('vendors/:id/deadlines')
  @Roles(...INTERNAL_ROLES)
  findDeadlines(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findDeadlines(id, user);
  }

  /** Counts and percentages computed from work already recorded. */
  @Get('vendors/:id/performance')
  @Roles(...INTERNAL_ROLES)
  findPerformance(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findPerformance(id, user);
  }
}
