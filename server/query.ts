import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.users.findMany({
    where: { full_name: { contains: 'Reception', mode: 'insensitive' } }
  });
  console.log(users);
}
main().finally(() => prisma.$disconnect());
