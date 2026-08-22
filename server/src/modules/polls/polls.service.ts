import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, notification_type_enum, polls, role_enum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { lookupUsers } from '../../common/helpers/user-lookup.helper';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { CreatePollDto } from './dto/create-poll.dto';
import { VotePollDto } from './dto/vote-poll.dto';
import { PollOptionResult, isOpen, tally } from './poll-results';

export interface PollView {
  id: string;
  question: string;
  createdBy: { id: string; fullName: string };
  createdAt: Date;
  closesAt: Date;
  isClosed: boolean;
  isOpen: boolean;
  totalVotes: number;
  myVoteOptionId: string | null;
  options: PollOptionResult[];
}

@Injectable()
export class PollsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly gateway: NotificationsGateway,
  ) {}

  /**
   * Open polls, newest first, with the caller's own vote already resolved.
   *
   * "Open" is computed from `closes_at` and `is_closed` at read time, so the
   * list is correct the moment a deadline passes without anything having run.
   * Feeds `GET /polls/active` and the dashboard payload.
   *
   * Throws nothing; an empty company returns an empty array.
   */
  async listActive(userId: string, limit = 20): Promise<PollView[]> {
    const rows = await this.prisma.polls.findMany({
      where: { is_closed: false, closes_at: { gt: new Date() } },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return this.hydrate(rows, userId);
  }

  /**
   * Every poll including closed ones, newest first. Same shape as listActive so
   * the client renders one card component for both.
   *
   * ponytail: no pagination. A hundred people raising polls will not reach a
   * page worth splitting this year; add `skip`/`take` params when the list
   * outgrows one screen.
   *
   * Throws nothing.
   */
  async list(userId: string): Promise<PollView[]> {
    const rows = await this.prisma.polls.findMany({ orderBy: { created_at: 'desc' } });

    return this.hydrate(rows, userId);
  }

  /**
   * One poll with its live tallies and the caller's own vote, which is what
   * lets the UI paint the right state without a second request.
   *
   * Throws NotFoundException when the poll does not exist.
   */
  async findOne(id: string, userId: string): Promise<PollView> {
    const poll = await this.prisma.polls.findUnique({ where: { id } });
    if (!poll) throw new NotFoundException('Poll not found');

    const [view] = await this.hydrate([poll], userId);
    return view!;
  }

  /**
   * Raises a poll and notifies everyone else in the company.
   *
   * Any internal user can call this; polls are company wide and not anonymous,
   * so the creator's name travels with the question everywhere it is shown.
   *
   * Throws BadRequestException when `closesAt` is not in the future or the
   * option labels are not distinct.
   */
  async create(dto: CreatePollDto, user: JwtPayload): Promise<PollView> {
    const closesAt = new Date(dto.closesAt);
    if (closesAt.getTime() <= Date.now()) {
      throw new BadRequestException('closesAt must be in the future');
    }

    const labels = dto.options.map((label) => label.trim()).filter(Boolean);
    if (labels.length < 2) {
      throw new BadRequestException('A poll needs at least two non-empty options');
    }
    if (new Set(labels.map((l) => l.toLowerCase())).size !== labels.length) {
      throw new BadRequestException('Poll options must be distinct');
    }

    const poll = await this.prisma.$transaction(async (tx) => {
      const created = await tx.polls.create({
        data: {
          question: dto.question.trim(),
          created_by_id: user.sub,
          closes_at: closesAt,
        },
      });

      await tx.poll_options.createMany({
        data: labels.map((label, index) => ({
          poll_id: created.id,
          label,
          sort_order: index,
        })),
      });

      return created;
    });

    const audience = await this.prisma.users.findMany({
      where: {
        deleted_at: null,
        is_active: true,
        role: { not: role_enum.VENDOR },
        id: { not: user.sub },
      },
      select: { id: true },
    });

    await this.notifications.notifyMany(
      audience.map(({ id }) => ({
        recipientId: id,
        type: notification_type_enum.POLL_CREATED,
        title: 'New poll',
        message: `${user.fullName ?? user.username} asked: ${poll.question}`,
        entityType: 'poll',
        entityId: poll.id,
      })),
    );

    const [view] = await this.hydrate([poll], user.sub);
    return view!;
  }

  /**
   * Records the caller's vote and broadcasts the new tallies.
   *
   * One vote per person is the unique key on `(poll_id, user_id)`, not a check
   * in this method. The write is an upsert on that key, so changing a vote is
   * the same call as casting one, and a concurrent duplicate surfaces as P2002
   * rather than as a second row.
   *
   * Throws NotFoundException when the poll or the option does not exist, and
   * BadRequestException when the poll has closed or the option belongs to a
   * different poll.
   */
  async vote(id: string, dto: VotePollDto, userId: string): Promise<PollView> {
    const poll = await this.prisma.polls.findUnique({ where: { id } });
    if (!poll) throw new NotFoundException('Poll not found');
    if (!isOpen(poll, new Date())) {
      throw new BadRequestException('This poll has closed');
    }

    const option = await this.prisma.poll_options.findFirst({
      where: { id: dto.optionId, poll_id: id },
      select: { id: true },
    });
    if (!option) throw new BadRequestException('That option is not on this poll');

    try {
      await this.prisma.poll_votes.upsert({
        where: { poll_id_user_id: { poll_id: id, user_id: userId } },
        create: { poll_id: id, option_id: option.id, user_id: userId },
        update: { option_id: option.id, voted_at: new Date() },
      });
    } catch (error) {
      // Two votes arriving together: the loser of the race lost to a row that
      // is already this user's vote, so the tallies below are still correct.
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
    }

    const [view] = await this.hydrate([poll], userId);
    this.gateway.sendToInternal('poll:updated', view);
    return view!;
  }

  /**
   * Closes a poll early. The creator or the MD may do this; everyone else gets
   * a 403 rather than a 404, because the poll itself is company wide.
   *
   * Throws NotFoundException when the poll does not exist and
   * ForbiddenException when the caller is neither the creator nor the MD.
   */
  async close(id: string, user: JwtPayload): Promise<PollView> {
    const poll = await this.prisma.polls.findUnique({ where: { id } });
    if (!poll) throw new NotFoundException('Poll not found');
    this.assertOwnerOrMd(poll, user);

    const updated = await this.prisma.polls.update({
      where: { id },
      data: { is_closed: true },
    });

    const [view] = await this.hydrate([updated], user.sub);
    this.gateway.sendToInternal('poll:updated', view);
    return view!;
  }

  /**
   * Deletes a poll and its options and votes.
   *
   * The three tables carry no foreign keys, so nothing cascades and the child
   * rows are removed explicitly inside one transaction.
   *
   * Throws NotFoundException when the poll does not exist and
   * ForbiddenException when the caller is neither the creator nor the MD.
   */
  async remove(id: string, user: JwtPayload): Promise<{ id: string }> {
    const poll = await this.prisma.polls.findUnique({ where: { id } });
    if (!poll) throw new NotFoundException('Poll not found');
    this.assertOwnerOrMd(poll, user);

    await this.prisma.$transaction([
      this.prisma.poll_votes.deleteMany({ where: { poll_id: id } }),
      this.prisma.poll_options.deleteMany({ where: { poll_id: id } }),
      this.prisma.polls.delete({ where: { id } }),
    ]);

    this.gateway.sendToInternal('poll:updated', { id, deleted: true });
    return { id };
  }

  private assertOwnerOrMd(poll: polls, user: JwtPayload) {
    if (poll.created_by_id !== user.sub && user.role !== role_enum.MD) {
      throw new ForbiddenException('Only the creator or the MD can do that');
    }
  }

  /**
   * Loads options, votes, and creator names for a batch of polls and folds them
   * into the shape the client renders. Three queries regardless of how many
   * polls came in, because the poll tables carry no Prisma relations to include.
   */
  private async hydrate(rows: polls[], userId: string): Promise<PollView[]> {
    if (rows.length === 0) return [];

    const pollIds = rows.map((poll) => poll.id);
    const [options, votes, creators] = await Promise.all([
      this.prisma.poll_options.findMany({ where: { poll_id: { in: pollIds } } }),
      this.prisma.poll_votes.findMany({
        where: { poll_id: { in: pollIds } },
        select: { poll_id: true, option_id: true, user_id: true },
      }),
      lookupUsers(
        this.prisma,
        rows.map((poll) => poll.created_by_id),
      ),
    ]);

    const now = new Date();

    return rows.map((poll) => {
      const pollVotes = votes.filter((v) => v.poll_id === poll.id);
      const { options: results, totalVotes } = tally(
        options.filter((o) => o.poll_id === poll.id),
        pollVotes,
      );

      return {
        id: poll.id,
        question: poll.question,
        createdBy: {
          id: poll.created_by_id,
          fullName: creators.get(poll.created_by_id)?.full_name ?? 'Unknown',
        },
        createdAt: poll.created_at,
        closesAt: poll.closes_at,
        isClosed: poll.is_closed,
        isOpen: isOpen(poll, now),
        totalVotes,
        myVoteOptionId: pollVotes.find((v) => v.user_id === userId)?.option_id ?? null,
        options: results,
      };
    });
  }
}
