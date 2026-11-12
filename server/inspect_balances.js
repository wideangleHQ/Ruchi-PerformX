const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const count2025 = await prisma.leave_balances.count({ where: { year: 2025 } });
  const count2026 = await prisma.leave_balances.count({ where: { year: 2026 } });
  console.log(`Balances: year 2025 = ${count2025}, year 2026 = ${count2026}`);

  const sample2025 = await prisma.leave_balances.findMany({
    where: { year: 2025 },
    take: 5,
    orderBy: { created_at: 'desc' }
  });
  console.log('Sample 2025:', JSON.stringify(sample2025, null, 2));

  const sample2026 = await prisma.leave_balances.findMany({
    where: { year: 2026 },
    take: 5,
    orderBy: { created_at: 'desc' }
  });
  console.log('Sample 2026:', JSON.stringify(sample2026, null, 2));

  const summary2025 = await prisma.leave_balances.aggregate({
    where: { year: 2025 },
    _sum: { entitled: true, used: true, carried_over: true, compensated_to_key_date: true },
    _count: { id: true }
  });
  console.log('Summary 2025:', summary2025);

  const summary2026 = await prisma.leave_balances.aggregate({
    where: { year: 2026 },
    _sum: { entitled: true, used: true, carried_over: true, compensated_to_key_date: true },
    _count: { id: true }
  });
  console.log('Summary 2026:', summary2026);

  await prisma.$disconnect();
}

main().catch(console.error);
