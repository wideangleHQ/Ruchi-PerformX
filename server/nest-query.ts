import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PrismaService } from './src/prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const users = await prisma.users.findMany({
    where: { full_name: { contains: 'Reception', mode: 'insensitive' } }
  });
  console.log("RECEPTION_DESK_JSON:", JSON.stringify(users, null, 2));
  await app.close();
}
bootstrap();
