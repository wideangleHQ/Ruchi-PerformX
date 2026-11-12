const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const balances2025 = await prisma.leave_balances.findMany({
    where: { year: 2025 },
    orderBy: { user_id: 'asc' },
  });

  const userIds = [...new Set(balances2025.map(b => b.user_id))];
  console.log(`Balances 2025 count: ${balances2025.length}, across ${userIds.length} distinct users.`);

  const users = await prisma.users.findMany({
    where: { id: { in: userIds } },
    select: { id: true, full_name: true, personnel_number: true, username: true, role: true },
  });

  const userMap = new Map(users.map(u => [u.id, u]));
  const leaveTypes = await prisma.leave_types.findMany();
  const typeMap = new Map(leaveTypes.map(t => [t.id, t.name]));

  console.log('--- 2025 Users and their Balances ---');
  for (const uid of userIds) {
    const u = userMap.get(uid);
    const userBalances = balances2025.filter(b => b.user_id === uid);
    const bStr = userBalances.map(b => `${typeMap.get(b.leave_type_id)}: Ent=${b.entitled}, Used=${b.used}, Rem=${Number(b.entitled)-Number(b.used)}`).join(' | ');
    console.log(`User: ${u?.full_name} (pNo: ${u?.personnel_number}, role: ${u?.role}) -> [${bStr}]`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);

