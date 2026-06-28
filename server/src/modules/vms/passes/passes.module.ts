import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { PassController } from './controllers/pass.controller';
import { PassServiceImpl } from './services/pass.service';
import { PassRepositoryImpl } from './repositories/pass.repository';
import { AuthModule } from '../../../modules/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PassController],
  providers: [
    {
      provide: 'PassRepository',
      useClass: PassRepositoryImpl,
    },
    {
      provide: 'PassService',
      useClass: PassServiceImpl,
    },
  ],
  exports: ['PassService'],
})
export class PassesModule {}
