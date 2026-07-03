import { PrismaClient } from '@prisma/client'; 
const prisma = new PrismaClient(); 
async function main() { 
  const res = await prisma.$queryRawUnsafe(`
    SELECT sa.id, sa.title, sa.created_at 
    FROM self_actions sa 
    LEFT JOIN self_action_departments sad ON sad.self_action_id=sa.id 
    WHERE sad.self_action_id IS NULL
  `); 
  console.log('Count of unmapped historical self actions:', (res as any[]).length); 
} 
main().catch(console.error).finally(() => prisma.$disconnect());
