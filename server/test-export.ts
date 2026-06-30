import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PrismaService } from './src/prisma/prisma.service';
import * as ExcelJS from 'exceljs';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  
  const now = new Date();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  console.log("=== TIMEZONE INFO ===");
  console.log("process.env.TZ:", process.env.TZ);
  console.log("now:", now.toISOString(), "local:", now.toString());
  console.log("todayStart:", todayStart.toISOString(), "local:", todayStart.toString());
  console.log("todayEnd:", todayEnd.toISOString(), "local:", todayEnd.toString());

  console.log("\n=== PRISMA QUERY (VISITOR) ===");
  const visitors = await prisma.visitor.findMany({
    where: {
      createdAt: { gte: todayStart, lte: todayEnd },
      deletedAt: null,
    },
    select: {
      fullName: true,
      email: true,
      mobileNumber: true,
      status: true,
      faceRecognitionConsent: true,
      notes: true,
      companyName: true,
      address: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  
  console.log("Prisma row count:", visitors.length);

  console.log("\n=== PRISMA QUERY (VISIT) ===");
  const visits = await prisma.visit.findMany({
    where: {
      checkInTime: { gte: todayStart, lte: todayEnd },
      deletedAt: null,
    }
  });
  console.log("Prisma visits count:", visits.length);

  console.log("\n=== EXCELJS ===");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Today\'s Visitors');
  
  worksheet.columns = [
    { header: 'Full Name', key: 'fullName', width: 25 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Mobile Number', key: 'mobileNumber', width: 18 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Face Consent', key: 'faceRecognitionConsent', width: 15 },
    { header: 'Notes', key: 'notes', width: 35 },
    { header: 'Company Name', key: 'companyName', width: 25 },
    { header: 'Address', key: 'address', width: 35 },
    { header: 'Registered At', key: 'createdAt', width: 20 },
  ];

  visitors.forEach((visitor) => {
    worksheet.addRow({
      fullName: visitor.fullName,
      email: visitor.email || 'N/A',
      mobileNumber: visitor.mobileNumber || 'N/A',
      status: visitor.status,
      faceRecognitionConsent: visitor.faceRecognitionConsent ? 'Yes' : 'No',
      notes: visitor.notes || 'N/A',
      companyName: visitor.companyName || 'N/A',
      address: visitor.address || 'N/A',
      createdAt: visitor.createdAt.toLocaleString(),
    });
  });
  
  console.log("Worksheet rowCount (should be visitors+1):", worksheet.rowCount);
  
  console.log("\n=== RAW SQL ===");
  const sqlResult: any[] = await prisma.$queryRawUnsafe(`
    SELECT "fullName" FROM visitors
    WHERE "deletedAt" IS NULL
    AND DATE("createdAt") = CURRENT_DATE
  `);
  console.log("SQL (CURRENT_DATE) row count:", sqlResult.length);
  
  await app.close();
}

bootstrap().catch(console.error);
