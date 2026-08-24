// server/prisma/set-password.ts
//
// Sets a known password for one user, so somebody locked out can be let back in
// and change it themselves from Settings. Run it with
// `just set-password <username> <password>`.
//
// This exists because the self-service reset needs email and RESEND_FROM_EMAIL
// is on a domain Resend cannot verify, so no OTP goes out. `PATCH
// /users/:id/admin-reset-password` does the same thing over HTTP and has no
// screen in front of it yet.
//
// ponytail: a script rather than a screen. The screen is the right answer once
// somebody wants it; this is what unblocks a person today without deleting
// their account to get a fresh one, which costs their whole history: the
// self_actions foreign key is onDelete: Cascade.

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;
const MIN_LENGTH = 8;

async function main(): Promise<void> {
  const [username, password] = process.argv.slice(2);

  if (!username || !password) {
    throw new Error('Usage: just set-password <username> <password>');
  }
  // Matches RegisterDto and ChangePasswordDto. A password set here has to clear
  // the same bar as one the user picks, or this becomes the way round it.
  if (password.length < MIN_LENGTH) {
    throw new Error(`Password must be at least ${MIN_LENGTH} characters.`);
  }

  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DIRECT_URL or DATABASE_URL must be set. See docs/src/p1_setup.md.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const user = await prisma.users.findFirst({
      where: { username, deleted_at: null },
      select: { id: true, username: true, full_name: true, role: true, is_active: true },
    });

    if (!user) {
      throw new Error(`No active user with username "${username}".`);
    }

    await prisma.users.update({
      where: { id: user.id },
      data: {
        password_hash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        password_changed_at: new Date(),
      },
    });

    console.log(
      `Password set for ${user.full_name} (${user.username}, ${user.role}).`,
    );
    console.log('Tell them to change it from Settings once they are in.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
