import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PrismaService } from './src/prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  
  const eas = await prisma.users.findMany({
    where: { role: 'EA' },
    include: { assistant_departments: true }
  });
  console.log(`EAs found: ${eas.length}`);
  eas.forEach(ea => {
    console.log(`EA ${ea.full_name}: department_id=${ea.department_id}, assistant_departments=${ea.assistant_departments.length}`);
  });

  const pas = await prisma.users.findMany({
    where: { role: 'PA' },
    include: { assistant_departments: true }
  });
  console.log(`\nPAs found: ${pas.length}`);
  pas.forEach(pa => {
    console.log(`PA ${pa.full_name}: department_id=${pa.department_id}, assistant_departments=${pa.assistant_departments.length}`);
  });

  await app.close();
}

bootstrap().catch(console.error);
