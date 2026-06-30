import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PrismaService } from './src/prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const fallbackDept = await prisma.departments.findFirst({
    where: { is_active: true },
    select: { id: true },
    orderBy: { sort_order: 'asc' }
  });
  console.log("FALLBACK_DEPT:", fallbackDept);
  await app.close();
}
bootstrap();
