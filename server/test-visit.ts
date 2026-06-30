import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { VisitService } from './src/modules/vms/visits/services/visit.service';
import { CreateVisitDto } from './src/modules/vms/visits/dto/create-visit.dto';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const visitService = app.get(VisitService);
  
  try {
    const dto: CreateVisitDto = {
      visitorId: '00000000-0000-0000-0000-000000000000', // We need a real visitor ID
      hostEmployeeId: '11111111-1111-1111-1111-111111111111',
      purpose: 'Meeting',
      peopleCount: 1,
    };
    
    // Find a visitor
    const prisma = app.get('PrismaService');
    const visitor = await prisma.visitors.findFirst();
    if (visitor) {
      dto.visitorId = visitor.id;
    }
    
    console.log('Creating visit with DTO:', dto);
    const visit = await visitService.createVisit(dto, '11111111-1111-1111-1111-111111111111');
    console.log('CREATE_VISIT_RESULT:', visit);
    
    // Check in
    const checkInDto = { visitId: visit.id };
    console.log('Checking in with DTO:', checkInDto);
    const checkInResult = await visitService.checkIn(checkInDto, '11111111-1111-1111-1111-111111111111');
    console.log('CHECK_IN_RESULT:', checkInResult);
    
  } catch (error) {
    console.error('SIMULATION_ERROR:', error);
  }
  
  await app.close();
}
bootstrap();
