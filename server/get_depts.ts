import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const depts = await prisma.departments.findMany();
  console.log(JSON.stringify(depts, null, 2));
}

run().finally(() => prisma.$disconnect());
