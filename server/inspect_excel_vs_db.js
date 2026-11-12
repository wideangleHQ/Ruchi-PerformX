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

  const excelEmployees = new Map();
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values;
    const pNo = values[1] ? String(values[1]).trim() : '';
    const name = values[2] ? String(values[2]).trim() : '';
    const quota = values[3] ? String(values[3]).trim() : '';
    const entitlement = values[5] != null ? Number(values[5]) : 0;
    const used = values[6] != null ? Number(values[6]) : 0;
    const compensated = values[7] != null ? Number(values[7]) : 0;
    const remaining = values[8] != null ? Number(values[8]) : 0;

    if (!pNo && !name) return;
    if (!excelEmployees.has(pNo)) {
      excelEmployees.set(pNo, { pNo, name, quotas: [] });
    }
    excelEmployees.get(pNo).quotas.push({ quota, entitlement, used, compensated, remaining });
  });

  console.log(`Excel has ${excelEmployees.size} unique employees.`);

  // 2. Load all DB users
  const dbUsers = await prisma.users.findMany({
    select: {
      id: true,
      full_name: true,
      personnel_number: true,
      username: true,
      email: true,
      role: true,
      is_active: true,
      deleted_at: true,
    },
  });

  // 3. Inspect existing 2025 balances
  const balances2025 = await prisma.leave_balances.findMany({ where: { year: 2025 } });
  const imported2025UserIds = new Set(balances2025.map(b => b.user_id));

  console.log(`Existing 2025 balances belong to ${imported2025UserIds.size} users.`);

  // Check which excelEmployees are already in 2025
  const matchedIn2025 = [];
  const notIn2025 = [];

  for (const [pNo, emp] of excelEmployees.entries()) {
    // See if any user in imported2025UserIds matches this employee
    let matchedUser = null;
    for (const uid of imported2025UserIds) {
      const u = dbUsers.find(x => x.id === uid);
      if (!u) continue;
      // Match by personnel_number or name
      if (u.personnel_number && u.personnel_number.trim() === pNo) {
        matchedUser = u;
        break;
      }
      // Compare names
      const n1 = u.full_name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const n2 = emp.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (n1 === n2 || (u.email && u.email.toLowerCase().includes(n2))) {
        matchedUser = u;
        break;
      }
    }

    if (matchedUser) {
      matchedIn2025.push({ pNo, name: emp.name, user: matchedUser, quotaCount: emp.quotas.length });
    } else {
      // Check if this employee exists in dbUsers at all!
      const candidateUsers = dbUsers.filter(u => {
        if (u.personnel_number && u.personnel_number.trim() === pNo) return true;
        const n1 = u.full_name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const n2 = emp.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (n1 === n2) return true;
        // check partial
        if (n1.includes(n2) || n2.includes(n1)) return true;
        return false;
      });

      notIn2025.push({
        pNo,
        name: emp.name,
        quotaCount: emp.quotas.length,
        candidates: candidateUsers.map(c => ({ id: c.id, name: c.full_name, pNo: c.personnel_number, email: c.email }))
      });
    }
  }

  console.log(`Employees matched in 2025 import: ${matchedIn2025.length}`);
  console.log(`Employees NOT in 2025 import: ${notIn2025.length}`);
  console.log('\n--- Details of employees NOT in 2025 import ---');
  for (const n of notIn2025) {
    console.log(`Excel: [${n.pNo}] ${n.name} (${n.quotaCount} quotas) -> Candidates in DB:`, n.candidates);
  }

  await prisma.$disconnect();
}

main().catch(console.error);

