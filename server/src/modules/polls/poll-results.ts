/**
 * Tallying and open-state, kept free of Prisma so they can be tested without a
 * database. Both are read-time computations: nothing here is ever persisted.
 */

export interface PollOptionRow {
  id: string;
  label: string;
  sort_order: number;
}

export interface PollOptionResult {
  id: string;
  label: string;
  votes: number;
  percent: number;
}

export interface PollTally {
  options: PollOptionResult[];
  totalVotes: number;
}

/**
 * Counts votes per option and turns them into whole percentages that add up to
 * 100 rather than to 99, using the largest remainder method. Options with no
 * votes come back at zero rather than being dropped, and a poll with no votes
 * at all comes back with every percent at zero.
 *
 * Votes referencing an option not in `options` are ignored, so a stale row
 * cannot inflate the total. Ordering follows `sort_order`, then `id`, so two
 * calls on the same data return the same array and the same rounding.
 *
 * Throws nothing.
 */
export function tally(
  options: readonly PollOptionRow[],
  votes: readonly { option_id: string }[],
): PollTally {
  const counts = new Map<string, number>();
  for (const vote of votes) {
    counts.set(vote.option_id, (counts.get(vote.option_id) ?? 0) + 1);
  }

  const ordered = [...options].sort(
    (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
  );

  const rows = ordered.map((option) => {
    const votes = counts.get(option.id) ?? 0;
    return { id: option.id, label: option.label, votes, percent: 0, remainder: 0 };
  });

  const totalVotes = rows.reduce((sum, row) => sum + row.votes, 0);
  if (totalVotes === 0) {
    return { options: rows.map(({ remainder, ...rest }) => rest), totalVotes };
  }

  for (const row of rows) {
    const exact = (row.votes / totalVotes) * 100;
    row.percent = Math.floor(exact);
    row.remainder = exact - row.percent;
  }

  // Three options with one vote each floor to 33 and leave the bars at 99.
  // Hand the leftover points to the largest fractional parts; Array.sort is
  // stable, so an exact tie goes to the option that sorts first.
  const leftover = 100 - rows.reduce((sum, row) => sum + row.percent, 0);
  [...rows]
    .sort((a, b) => b.remainder - a.remainder)
    .slice(0, leftover)
    .forEach((row) => {
      row.percent += 1;
    });

  return { options: rows.map(({ remainder, ...rest }) => rest), totalVotes };
}

/**
 * Whether a poll still accepts votes at `now`. There is no cron flipping a
 * column at midnight; open state is derived on every read, so a poll cannot get
 * stuck open because a job did not run.
 *
 * `is_closed` is manual early closure by the creator and overrides `closes_at`
 * in both directions: a closed poll stays closed even if its deadline is still
 * in the future.
 *
 * Throws nothing.
 */
export function isOpen(
  poll: { closes_at: Date; is_closed: boolean },
  now: Date,
): boolean {
  return !poll.is_closed && poll.closes_at.getTime() > now.getTime();
}
