const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const fs = require('fs');
const ExcelJS = require('exceljs');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const LEAVE_FINANCIAL_YEAR = 2026;

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  console.log(`Starting Leave Allocation Import for FY ${LEAVE_FINANCIAL_YEAR}–${LEAVE_FINANCIAL_YEAR + 1}...`);

  // 1. Read Excel
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('C:/Users/ardhe/Downloads/EXPORTleave2.XLSX');
  const sheet = wb.worksheets[0];

  const excelEmployees = new Map();
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const v = row.values;
    const pNo = String(v[1] || '').trim();
    const name = String(v[2] || '').trim();
    const quota = String(v[3] || '').trim();
    const entitled = Number(v[5] ?? 0);
    const used = Number(v[6] ?? 0);
    const compensated = Number(v[7] ?? 0);
    const remaining = Number(v[8] ?? 0);

    if (!pNo) return;
    if (!excelEmployees.has(pNo)) {
      excelEmployees.set(pNo, { pNo, name, quotas: [] });
    }
    excelEmployees.get(pNo).quotas.push({ quota, entitled, used, compensated, remaining });
  });

  console.log(`Loaded ${excelEmployees.size} employees from Excel.`);

  // 2. Load Leave Types
  const leaveTypes = await prisma.leave_types.findMany();
  const typeMap = new Map();
  for (const lt of leaveTypes) {
    typeMap.set(lt.name.toLowerCase().trim(), lt);
  }

  // 3. Verified 55 Mappings
  // Load 2025 balances to extract verified mapping
  const balances2025 = await prisma.leave_balances.findMany({ where: { year: 2025 } });
  const userIds2025 = [...new Set(balances2025.map(b => b.user_id))];
  const users2025 = await prisma.users.findMany({ where: { id: { in: userIds2025 } } });
  const userMap = new Map(users2025.map(u => [u.id, u]));

  const verifiedMappings = [];
  for (const uid of userIds2025) {
    const u = userMap.get(uid);
    const userBals = balances2025.filter(b => b.user_id === uid);

    let matchedEmp = null;
    // Special handling for known names
    if (u.full_name === 'Rama Chandra Behera') {
      matchedEmp = excelEmployees.get('100057');
    } else {
      const candidates = [];
      for (const [pNo, emp] of excelEmployees.entries()) {
        if (emp.quotas.length !== userBals.length) continue;
        let allMatch = true;
        for (const b of userBals) {
          const t = leaveTypes.find(x => x.id === b.leave_type_id);
          const exQ = emp.quotas.find(q => q.quota.toLowerCase() === t.name.toLowerCase());
          if (!exQ || exQ.entitled !== Number(b.entitled) || exQ.used !== Number(b.used)) {
            allMatch = false;
            break;
          }
        }
        if (allMatch) candidates.push(emp);
      }

      if (candidates.length === 1) {
        matchedEmp = candidates[0];
      } else if (candidates.length > 1) {
        const uNorm = u.full_name.toLowerCase().replace(/[^a-z]/g, '');
        matchedEmp = candidates.find(c => {
          const cNorm = c.name.toLowerCase().replace(/[^a-z]/g, '');
          return uNorm === cNorm || uNorm.includes(cNorm) || cNorm.includes(uNorm);
        });
      }
    }

    if (matchedEmp) {
      verifiedMappings.push({
        user: u,
        pNo: matchedEmp.pNo,
        excelName: matchedEmp.name,
        quotas: matchedEmp.quotas,
      });
    } else {
      console.warn(`Could not verify mapping for user: ${u.full_name}`);
    }
  }

  console.log(`Verified ${verifiedMappings.length} employee mappings.`);

  // 4. Generate SQL statements and run Prisma Upsert in Transaction
  const sqlStatements = [
    `-- PerformX Leave Balances Import FY 2026-27 (year = 2026)`,
    `-- Generated on ${new Date().toISOString()}`,
    `-- Total verified employees: ${verifiedMappings.length}`,
    `BEGIN;`,
    ``,
  ];

  let upsertCount = 0;
  for (const mapping of verifiedMappings) {
    const { user, pNo, quotas } = mapping;

    // Update personnel_number on user if not set
    if (!user.personnel_number || user.personnel_number !== pNo) {
      await prisma.users.update({
        where: { id: user.id },
        data: { personnel_number: pNo },
      });
      sqlStatements.push(
        `UPDATE users SET personnel_number = '${pNo}' WHERE id = '${user.id}';`
      );
    }

    // Upsert each quota into leave_balances for year = 2026
    for (const q of quotas) {
      const lt = typeMap.get(q.quota.toLowerCase().trim());
      if (!lt) {
        throw new Error(`Unknown leave type in Excel: ${q.quota}`);
      }

      await prisma.leave_balances.upsert({
        where: {
          user_id_leave_type_id_year: {
            user_id: user.id,
            leave_type_id: lt.id,
            year: LEAVE_FINANCIAL_YEAR,
          },
        },
        create: {
          user_id: user.id,
          leave_type_id: lt.id,
          year: LEAVE_FINANCIAL_YEAR,
          entitled: q.entitled,
          used: q.used,
          carried_over: 0,
          compensated_to_key_date: q.compensated ?? 0,
        },
        update: {
          entitled: q.entitled,
          used: q.used,
          carried_over: 0,
          compensated_to_key_date: q.compensated ?? 0,
          updated_at: new Date(),
        },
      });

      sqlStatements.push(
        `INSERT INTO leave_balances (id, user_id, leave_type_id, year, entitled, used, carried_over, compensated_to_key_date, created_at, updated_at)` +
        ` VALUES (gen_random_uuid(), '${user.id}', '${lt.id}', ${LEAVE_FINANCIAL_YEAR}, ${q.entitled}, ${q.used}, 0, ${q.compensated ?? 0}, NOW(), NOW())` +
        ` ON CONFLICT (user_id, leave_type_id, year)` +
        ` DO UPDATE SET entitled = EXCLUDED.entitled, used = EXCLUDED.used, carried_over = EXCLUDED.carried_over, compensated_to_key_date = EXCLUDED.compensated_to_key_date, updated_at = NOW();`
      );

      upsertCount++;
    }
  }

  sqlStatements.push(``);
  sqlStatements.push(`COMMIT;`);

  fs.writeFileSync('server/leave_balances_import_2026.sql', sqlStatements.join('\n'));
  console.log(`Wrote server/leave_balances_import_2026.sql with ${sqlStatements.length} lines.`);
  console.log(`Successfully upserted ${upsertCount} leave balance records for FY ${LEAVE_FINANCIAL_YEAR}!`);

  // 5. Verification
  console.log('\n--- VERIFYING FY 2026 DATABASE RECORDS ---');
  const balancesIn2026 = await prisma.leave_balances.findMany({
    where: { year: LEAVE_FINANCIAL_YEAR },
  });
  console.log(`Total balance records in DB with year = 2026: ${balancesIn2026.length}`);

  let verifyPassed = 0;
  let verifyFailed = 0;

  for (const mapping of verifiedMappings) {
    const { user, quotas } = mapping;
    for (const q of quotas) {
      const lt = typeMap.get(q.quota.toLowerCase().trim());
      const rec = balancesIn2026.find(b => b.user_id === user.id && b.leave_type_id === lt.id);
      if (!rec) {
        console.error(`MISSING: ${user.full_name} (${lt.name})`);
        verifyFailed++;
        continue;
      }

      const entMatch = Number(rec.entitled) === q.entitled;
      const usedMatch = Number(rec.used) === q.used;
      const compMatch = Number(rec.compensated_to_key_date) === q.compensated;
      const calcRem = Math.round((Number(rec.entitled) + Number(rec.carried_over) - Number(rec.used) - Number(rec.compensated_to_key_date)) * 100) / 100;
      const remMatch = calcRem === q.remaining;

      if (entMatch && usedMatch && compMatch && remMatch) {
        verifyPassed++;
      } else {
        console.error(`MISMATCH for ${user.full_name} (${lt.name}): DB [ent=${rec.entitled}, used=${rec.used}, rem=${calcRem}] vs Excel [ent=${q.entitled}, used=${q.used}, rem=${q.remaining}]`);
        verifyFailed++;
      }
    }
  }

  console.log(`Verification: ${verifyPassed} / ${upsertCount} records PASSED perfectly! (${verifyFailed} failed)`);

  await prisma.$disconnect();
}

main().catch(console.error);
