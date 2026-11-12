const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const ExcelJS = require('exceljs');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  // 1. Read Excel
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('C:/Users/ardhe/Downloads/EXPORTleave2.XLSX');
  const sheet = wb.worksheets[0];

  const excelRows = [];
  // Row 1 is header
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values;
    // values[1] is Personnel Number, values[2] is Name, values[3] is Quota, values[4] is Unit,
    // values[5] is Entitlement, values[6] is Used, values[7] is Compensated, values[8] is Total remain
    const personnelNo = values[1] ? String(values[1]).trim() : '';
    const name = values[2] ? String(values[2]).trim() : '';
    const quota = values[3] ? String(values[3]).trim() : '';
    const unit = values[4] ? String(values[4]).trim() : '';
    const entitlement = values[5] != null ? Number(values[5]) : 0;
    const used = values[6] != null ? Number(values[6]) : 0;
    const compensated = values[7] != null ? Number(values[7]) : 0;
    const remaining = values[8] != null ? Number(values[8]) : 0;

    if (personnelNo || name) {
      excelRows.push({
        rowNumber,
        personnelNo,
        name,
        quota,
        unit,
        entitlement,
        used,
        compensated,
        remaining,
      });
    }
  });

  console.log(`Excel total data rows: ${excelRows.length}`);
  const uniquePersonnelInExcel = [...new Set(excelRows.map(r => r.personnelNo))];
  const uniqueNamesInExcel = [...new Set(excelRows.map(r => r.name))];
  const uniqueQuotasInExcel = [...new Set(excelRows.map(r => r.quota))];
  console.log(`Unique personnel numbers in Excel: ${uniquePersonnelInExcel.length}`);
  console.log(`Unique names in Excel: ${uniqueNamesInExcel.length}`);
  console.log(`Unique quotas in Excel:`, uniqueQuotasInExcel);

  // 2. Load DB users and leave types
  const dbUsers = await prisma.users.findMany({
    select: {
      id: true,
      full_name: true,
      personnel_number: true,
      username: true,
      email: true,
      is_active: true,
      deleted_at: true,
    },
  });
  console.log(`DB total users: ${dbUsers.length}`);

  const dbLeaveTypes = await prisma.leave_types.findMany();
  console.log(`DB leave types:`, dbLeaveTypes.map(t => ({ id: t.id, name: t.name })));
  const typeMapByName = new Map(dbLeaveTypes.map(t => [t.name.toLowerCase().trim(), t.id]));

  // Match Excel employees against DB users
  const userByPersonnel = new Map();
  const userByName = new Map();
  for (const u of dbUsers) {
    if (u.personnel_number) {
      userByPersonnel.set(u.personnel_number.trim(), u);
    }
    userByName.set(u.full_name.toLowerCase().trim(), u);
  }

  const matched = [];
  const unmatched = [];
  const ambiguous = [];

  for (const pNo of uniquePersonnelInExcel) {
    const rowsForP = excelRows.filter(r => r.personnelNo === pNo);
    const empName = rowsForP[0].name;

    let user = userByPersonnel.get(pNo);
    if (!user) {
      // Try name match
      user = userByName.get(empName.toLowerCase().trim());
    }

    if (user) {
      matched.push({ pNo, empName, user, rowCount: rowsForP.length });
    } else {
      unmatched.push({ pNo, empName, rowCount: rowsForP.length });
    }
  }

  console.log(`Matched employees: ${matched.length}`);
  console.log(`Unmatched employees: ${unmatched.length}`);
  if (unmatched.length > 0) {
    console.log('Unmatched sample:', unmatched.slice(0, 10));
  }

  // 3. Inspect existing balances in DB for 2025 and 2026
  const balances2025 = await prisma.leave_balances.findMany({ where: { year: 2025 } });
  const balances2026 = await prisma.leave_balances.findMany({ where: { year: 2026 } });

  console.log(`Existing balances count: 2025 = ${balances2025.length}, 2026 = ${balances2026.length}`);

  // Check how many of the 157 rows in 2025 match the Excel data exactly
  let match2025Count = 0;
  for (const b of balances2025) {
    const u = dbUsers.find(x => x.id === b.user_id);
    const t = dbLeaveTypes.find(x => x.id === b.leave_type_id);
    const exRow = excelRows.find(r => 
      (u && (r.personnelNo === u.personnel_number || r.name.toLowerCase().trim() === u.full_name.toLowerCase().trim())) &&
      (t && r.quota.toLowerCase().trim() === t.name.toLowerCase().trim())
    );
    if (exRow) {
      match2025Count++;
    }
  }
  console.log(`Out of 157 in year 2025, exactly matching Excel rows: ${match2025Count}`);

  // Check the 120 rows in 2026
  const users2026 = [...new Set(balances2026.map(b => b.user_id))];
  console.log(`2026 balances span ${users2026.length} distinct users.`);
  const sampleUsers2026 = users2026.slice(0, 5).map(uid => {
    const u = dbUsers.find(x => x.id === uid);
    return { id: uid, name: u?.full_name, pNo: u?.personnel_number };
  });
  console.log('Sample users in 2026 balances:', sampleUsers2026);

  await prisma.$disconnect();
}

main().catch(console.error);

