import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PrismaService } from './src/prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  
  const latestVisitors = await prisma.visitor.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
  });
  console.log("Latest Visitors:");
  latestVisitors.forEach(v => {
    console.log(`- ${v.fullName}, created at: ${v.createdAt.toISOString()}`);
  });

  const latestVisits = await prisma.visit.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    include: { visitor: true }
  });
  console.log("\nLatest Visits:");
  latestVisits.forEach(v => {
    console.log(`- Visit for ${v.visitor.fullName}, created at: ${v.createdAt.toISOString()}, checkInTime: ${v.checkInTime?.toISOString()}`);
  });
  
  await app.close();
}

bootstrap().catch(console.error);
