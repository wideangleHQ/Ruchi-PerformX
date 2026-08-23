// server/prisma/seed-leave-types.ts
//
// Seeds the five leave types the module was specified around, so leave can be
// applied for on the day it ships. Run it with `just seed-leave-types`.
//
// Idempotent: `name` is unique, so `skipDuplicates` means running it twice, or
// after HR has already created a type by hand, changes nothing. It never edits
// an existing row, because the numbers below are defaults rather than policy
// and HR's edit wins.
//
// Changing an entitlement later is cheap while `leave_balances` is empty:
// balances are created lazily by `LeaveService.ensureBalance` on first use, at
// whatever the type says at that moment. Once people have applied, an
// entitlement change only affects rows created after it, and fixing an existing
// year is `PATCH /leave/balances/:id` on the HR balances screen.

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

interface LeaveTypeSeed {
  name: string;
  annual_entitlement: number;
  is_paid: boolean;
  carry_forward: boolean;
  max_carry_forward: number;
  requires_proof: boolean;
  /** Why this row looks the way it does. Printed on a dry run. */
  note: string;
}

const LEAVE_TYPES: LeaveTypeSeed[] = [
  {
    name: 'Casual Leave',
    annual_entitlement: 12,
    is_paid: true,
    carry_forward: false,
    max_carry_forward: 0,
    requires_proof: false,
    note: 'Lapses at the year end, which is what makes it casual.',
  },
  {
    name: 'Sick Leave',
    annual_entitlement: 12,
    is_paid: true,
    carry_forward: false,
    max_carry_forward: 0,
    requires_proof: false,
    // `requires_proof` is all or nothing and is checked on every application,
    // so turning it on here would demand a medical certificate for a single
    // sick day. The usual rule is a certificate from the third consecutive day,
    // which this column cannot express. HR asks for one out of band.
    note: 'No proof flag: it would apply from day one, and the real rule is day three.',
  },
  {
    name: 'Earned Leave',
    annual_entitlement: 15,
    is_paid: true,
    carry_forward: true,
    max_carry_forward: 30,
    requires_proof: false,
    note: 'The only type that accumulates. Capped at 30 days carried.',
  },
  {
    name: 'Unpaid Leave',
    annual_entitlement: 0,
    is_paid: false,
    carry_forward: false,
    max_carry_forward: 0,
    requires_proof: false,
    // The balance check in `LeaveService.apply` runs only when `is_paid`, so a
    // zero entitlement here does not block anything.
    note: 'Zero entitlement is deliberate: unpaid leave skips the balance check.',
  },
  {
    name: 'Compensatory Off',
    annual_entitlement: 0,
    is_paid: true,
    carry_forward: false,
    max_carry_forward: 0,
    requires_proof: false,
    // Paid, so the balance check does apply, and a zero entitlement means an
    // employee cannot take comp-off until HR credits the day they earned on
    // the balances screen. That is the point: it is earned, not granted.
    note: 'Zero entitlement and paid: HR credits an earned day before it can be taken.',
  },
];

async function main(): Promise<void> {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DIRECT_URL or DATABASE_URL must be set. See docs/src/p1_setup.md.',
    );
  }

  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('Dry run. Nothing is written.\n');
    for (const type of LEAVE_TYPES) {
      console.log(
        `${type.name.padEnd(18)} ${String(type.annual_entitlement).padStart(2)} days  ` +
          `${type.is_paid ? 'paid  ' : 'unpaid'}  ` +
          `${type.carry_forward ? `carries up to ${type.max_carry_forward}` : 'lapses'}`,
      );
      console.log(`${' '.repeat(18)} ${type.note}`);
    }
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const { count } = await prisma.leave_types.createMany({
      data: LEAVE_TYPES.map(({ note: _note, ...row }) => row),
      skipDuplicates: true,
    });

    console.log(`Seeded ${count} of ${LEAVE_TYPES.length} leave types.`);
    if (count < LEAVE_TYPES.length) {
      console.log(
        `${LEAVE_TYPES.length - count} already existed and were left alone.`,
      );
    }

    const all = await prisma.leave_types.findMany({ orderBy: { name: 'asc' } });
    for (const type of all) {
      console.log(
        `  ${type.name.padEnd(18)} ${String(type.annual_entitlement).padStart(2)} days  ` +
          `${type.is_paid ? 'paid  ' : 'unpaid'}  ` +
          `${type.carry_forward ? `carries up to ${type.max_carry_forward}` : 'lapses'}` +
          `${type.is_active ? '' : '  (inactive)'}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
