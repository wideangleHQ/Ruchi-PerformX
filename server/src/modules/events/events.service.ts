import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { event_expenses, events, role_enum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { attachUsers, lookupUsers, UserSummary } from '../../common/helpers/user-lookup.helper';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { UploadedFile } from '../../common/types/uploaded-file.type';
import { budgetVariance } from './budget';
import { AddCoordinatorDto } from './dto/add-coordinator.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

/** Decimal(12, 2) out of Postgres, a fixed two place string over the wire. */
function serialiseEvent(event: events) {
  return { ...event, budget_estimated: event.budget_estimated?.toFixed(2) ?? null };
}

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attachments: AttachmentsService,
  ) {}

  /**
   * Every event, latest date first. Events are company wide rather than
   * department scoped, so anyone who can reach the page sees all of them.
   */
  async findAll() {
    const rows = await this.prisma.events.findMany({ orderBy: { event_date: 'desc' } });
    return attachUsers(this.prisma, rows.map(serialiseEvent), ['created_by_id']);
  }

  /**
   * Create an event and its coordinators in one transaction.
   *
   * Throws BadRequestException when a coordinator id is not a live user.
   * `event_coordinators` carries no foreign key, so an unchecked id would sit
   * there forever resolving to nobody.
   */
  async create(dto: CreateEventDto, user: JwtPayload) {
    const coordinatorIds = await this.checkUsersExist(dto.coordinatorIds ?? []);

    const event = await this.prisma.$transaction(async (tx) => {
      const created = await tx.events.create({
        data: {
          name: dto.name,
          event_date: new Date(dto.eventDate),
          venue: dto.venue ?? null,
          budget_estimated: dto.budgetEstimated ?? null,
          created_by_id: user.sub,
        },
      });

      if (coordinatorIds.length) {
        await tx.event_coordinators.createMany({
          data: coordinatorIds.map((id) => ({ event_id: created.id, user_id: id })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    return this.findOne(event.id);
  }

  /**
   * One event with its coordinators and its expense log, people resolved and
   * receipt URLs freshly signed.
   *
   * Throws NotFoundException when the event does not exist.
   */
  async findOne(id: string) {
    const event = await this.load(id);

    const [coordinators, expenses, creators] = await Promise.all([
      this.prisma.event_coordinators.findMany({ where: { event_id: id } }),
      this.listExpenses(id),
      lookupUsers(this.prisma, [event.created_by_id]),
    ]);

    return {
      ...serialiseEvent(event),
      created_by_id_user: creators.get(event.created_by_id) ?? null,
      coordinators: await attachUsers(this.prisma, coordinators, ['user_id']),
      expenses,
    };
  }

  /**
   * Rename, move, re-budget or close an event.
   *
   * Throws NotFoundException when the event is gone, and ForbiddenException for
   * anyone who is not the creator, a coordinator, or the MD.
   */
  async update(id: string, dto: UpdateEventDto, user: JwtPayload) {
    await this.ensureCanManage(await this.load(id), user);

    await this.prisma.events.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.eventDate !== undefined && { event_date: new Date(dto.eventDate) }),
        ...(dto.venue !== undefined && { venue: dto.venue }),
        ...(dto.budgetEstimated !== undefined && { budget_estimated: dto.budgetEstimated }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });

    return this.findOne(id);
  }

  /**
   * Delete an event with its coordinators and its expenses.
   *
   * Throws NotFoundException and ForbiddenException as `update` does. Receipts
   * already in the bucket stay there; see the note on `removeExpense`.
   */
  async remove(id: string, user: JwtPayload) {
    await this.ensureCanManage(await this.load(id), user);

    await this.prisma.$transaction([
      this.prisma.event_expenses.deleteMany({ where: { event_id: id } }),
      this.prisma.event_coordinators.deleteMany({ where: { event_id: id } }),
      this.prisma.events.delete({ where: { id } }),
    ]);

    return { message: 'Event deleted successfully' };
  }

  /**
   * Add a coordinator, and say nothing if they already are one: the unique
   * index makes a repeat the same state rather than a failure worth surfacing.
   *
   * Throws NotFoundException for an unknown event, BadRequestException for an
   * unknown user, and ForbiddenException for anyone but the creator or the MD.
   */
  async addCoordinator(id: string, dto: AddCoordinatorDto, user: JwtPayload) {
    this.ensureOwner(await this.load(id), user);
    await this.checkUsersExist([dto.userId]);

    await this.prisma.event_coordinators.createMany({
      data: [{ event_id: id, user_id: dto.userId }],
      skipDuplicates: true,
    });

    return this.findOne(id);
  }

  /**
   * Remove a coordinator. Anything they logged stays on the event, because the
   * spend happened whether or not they still run it.
   *
   * Throws as `addCoordinator` does.
   */
  async removeCoordinator(id: string, userId: string, user: JwtPayload) {
    this.ensureOwner(await this.load(id), user);
    await this.prisma.event_coordinators.deleteMany({ where: { event_id: id, user_id: userId } });
    return this.findOne(id);
  }

  /**
   * The expense log for one event, newest first.
   *
   * Throws NotFoundException for an unknown event and ForbiddenException for
   * anyone who is not the creator, a coordinator, or the MD.
   */
  async findExpenses(id: string, user: JwtPayload) {
    await this.ensureCanManage(await this.load(id), user);
    return this.listExpenses(id);
  }

  /**
   * Log an expense. The receipt goes to the shared Supabase bucket under an
   * `events/receipts` prefix through the attachments module, and the row keeps
   * the storage path so the URL can be signed again on every read.
   *
   * `amount` stays a string from the request body through to the Decimal
   * column; nothing on this path becomes a JavaScript number.
   *
   * Throws NotFoundException and ForbiddenException as `findExpenses` does, and
   * BadRequestException for an unsupported or oversized receipt.
   */
  async createExpense(id: string, dto: CreateExpenseDto, user: JwtPayload, receipt?: UploadedFile) {
    await this.ensureCanManage(await this.load(id), user);

    const receiptPath = receipt ? await this.attachments.uploadEventReceipt(id, receipt) : null;

    const expense = await this.prisma.event_expenses.create({
      data: {
        event_id: id,
        item: dto.item,
        amount: dto.amount,
        receipt_url: receiptPath,
        logged_by_id: user.sub,
      },
    });

    return this.decorateExpense(expense, await lookupUsers(this.prisma, [expense.logged_by_id]));
  }

  /**
   * Correct an item description or an amount.
   *
   * Throws NotFoundException when the expense is not on this event, and
   * ForbiddenException for anyone but the person who logged it or the MD.
   */
  async updateExpense(id: string, expenseId: string, dto: UpdateExpenseDto, user: JwtPayload) {
    await this.ensureExpenseOwner(id, expenseId, user);

    const expense = await this.prisma.event_expenses.update({
      where: { id: expenseId },
      data: {
        ...(dto.item !== undefined && { item: dto.item }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
      },
    });

    return this.decorateExpense(expense, await lookupUsers(this.prisma, [expense.logged_by_id]));
  }

  /**
   * Delete an expense.
   *
   * Throws as `updateExpense` does.
   *
   * ponytail: the receipt object is left in the bucket. An orphan file costs a
   * few kilobytes, and a storage delete next to a database delete is the kind
   * of half-committed cleanup that is worse than the orphan. Sweep the
   * `events/receipts` prefix on a schedule if it ever gets big.
   */
  async removeExpense(id: string, expenseId: string, user: JwtPayload) {
    await this.ensureExpenseOwner(id, expenseId, user);
    await this.prisma.event_expenses.delete({ where: { id: expenseId } });
    return { message: 'Expense deleted successfully' };
  }

  /**
   * Estimated against actual, itemised. The report the module exists for.
   *
   * Readable by any internal user rather than the coordinators alone, because
   * the point of it is that the people who did not spend the money get to see
   * where it went.
   *
   * Throws NotFoundException when the event does not exist.
   */
  async budgetReport(id: string) {
    const event = await this.load(id);
    const expenses = await this.prisma.event_expenses.findMany({
      where: { event_id: id },
      orderBy: { created_at: 'desc' },
    });

    return {
      event: serialiseEvent(event),
      ...budgetVariance(
        event.budget_estimated,
        expenses.map((expense) => expense.amount),
      ),
      items: await this.decorateExpenses(expenses),
    };
  }

  /** Throws NotFoundException when the id matches nothing. */
  private async load(id: string) {
    const event = await this.prisma.events.findUnique({ where: { id } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  /**
   * The creator, a coordinator, or the MD. Coordinators are to an event what
   * members are to a project: whoever runs it edits it and logs against it.
   */
  private async ensureCanManage(event: events, user: JwtPayload) {
    if (user.role === role_enum.MD || event.created_by_id === user.sub) {
      return;
    }

    const coordinator = await this.prisma.event_coordinators.findFirst({
      where: { event_id: event.id, user_id: user.sub },
      select: { id: true },
    });

    if (!coordinator) {
      throw new ForbiddenException('Only the event coordinators can do this');
    }
  }

  /** The creator or the MD. Who coordinates is not a coordinator's call. */
  private ensureOwner(event: events, user: JwtPayload) {
    if (user.role !== role_enum.MD && event.created_by_id !== user.sub) {
      throw new ForbiddenException('Only the event creator can change coordinators');
    }
  }

  private async ensureExpenseOwner(eventId: string, expenseId: string, user: JwtPayload) {
    const expense = await this.prisma.event_expenses.findFirst({
      where: { id: expenseId, event_id: eventId },
      select: { logged_by_id: true },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    if (user.role !== role_enum.MD && expense.logged_by_id !== user.sub) {
      throw new ForbiddenException('Only the person who logged this expense can change it');
    }
  }

  /** Returns the deduplicated ids. Throws BadRequestException if any is unknown. */
  private async checkUsersExist(ids: string[]) {
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
      return unique;
    }

    const found = await this.prisma.users.count({
      where: { id: { in: unique }, deleted_at: null },
    });

    if (found !== unique.length) {
      throw new BadRequestException('One or more users do not exist');
    }

    return unique;
  }

  private async listExpenses(eventId: string) {
    const expenses = await this.prisma.event_expenses.findMany({
      where: { event_id: eventId },
      orderBy: { created_at: 'desc' },
    });
    return this.decorateExpenses(expenses);
  }

  private async decorateExpenses(expenses: event_expenses[]) {
    const users = await lookupUsers(
      this.prisma,
      expenses.map((expense) => expense.logged_by_id),
    );
    return Promise.all(expenses.map((expense) => this.decorateExpense(expense, users)));
  }

  /**
   * Amounts become fixed two place strings and `receipt_url` becomes a signed
   * download URL, so the client never has to know that the column holds a
   * storage path. A path that will not sign comes back null rather than
   * failing the whole report.
   */
  private async decorateExpense(expense: event_expenses, users: Map<string, UserSummary>) {
    return {
      ...expense,
      amount: expense.amount.toFixed(2),
      receipt_url: expense.receipt_url
        ? await this.attachments.createSignedUrl(expense.receipt_url).catch(() => null)
        : null,
      logged_by_id_user: users.get(expense.logged_by_id) ?? null,
    };
  }
}
