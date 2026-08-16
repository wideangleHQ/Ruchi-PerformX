// server/prisma/seed-holidays.ts
//
// Seeds the default company holiday calendar as common holidays for the current
// and next calendar year, so the leave module has something to exclude on the
// day it ships. Run it with `just seed-holidays`.
//
// Idempotent: `skipDuplicates` leans on the same unique indexes the API does,
// including the partial `holidays_common_uniq`, so running it twice, or after
// HR has already entered a date by hand, changes nothing.

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// ponytail: fixed-date holidays only. Holi, Diwali, Dussehra, Eid and Good
// Friday move every year and a wrong date here is worse than a missing one,
// because it silently removes a working day from every leave day count and
// nobody reports a leave balance that came out generous. HR adds those from the
// holiday screen. Replace this array with a lookup against a published gazette
// if the client ever wants them preloaded.
const FIXED_DATE_HOLIDAYS: Array<{
  name: string;
  monthDay: string;
  isOptional: boolean;
}> = [
  { name: "New Year's Day", monthDay: '01-01', isOptional: true },
  { name: 'Republic Day', monthDay: '01-26', isOptional: false },
  { name: 'May Day', monthDay: '05-01', isOptional: true },
  { name: 'Independence Day', monthDay: '08-15', isOptional: false },
  { name: 'Gandhi Jayanti', monthDay: '10-02', isOptional: false },
  { name: 'Christmas', monthDay: '12-25', isOptional: false },
];

// The column is NOT NULL, and a holiday nobody created is not a thing the audit
// trail should describe. HR owns the common tier, so an HR account is the right
// author; ADMIN and MD are fallbacks for a database seeded before HR exists.
const AUTHOR_ROLES = ['HR', 'ADMIN', 'MD'] as const;

async function main(): Promise<void> {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DIRECT_URL or DATABASE_URL must be set. See docs/src/p1_setup.md.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const author = await prisma.users.findFirst({
      where: { role: { in: [...AUTHOR_ROLES] }, deleted_at: null, is_active: true },
      orderBy: { created_at: 'asc' },
      select: { id: true, username: true, role: true },
    });

    if (!author) {
      throw new Error(
        `No active ${AUTHOR_ROLES.join(', ')} user to own the seeded holidays. Create one first.`,
      );
    }

    const thisYear = new Date().getUTCFullYear();
    const rows = [thisYear, thisYear + 1].flatMap((year) =>
      FIXED_DATE_HOLIDAYS.map((holiday) => ({
        name: holiday.name,
        holiday_date: new Date(`${year}-${holiday.monthDay}T00:00:00.000Z`),
        is_optional: holiday.isOptional,
        department_id: null,
        year,
        created_by_id: author.id,
      })),
    );

    const { count } = await prisma.holidays.createMany({
      data: rows,
      skipDuplicates: true,
    });

    console.log(
      `Seeded ${count} of ${rows.length} common holidays for ${thisYear} and ${thisYear + 1}, authored by ${author.username} (${author.role}).`,
    );
    if (count < rows.length) {
      console.log(`${rows.length - count} already existed and were left alone.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
