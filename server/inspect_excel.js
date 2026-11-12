const ExcelJS = require('exceljs');

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('C:/Users/ardhe/Downloads/EXPORTleave2.XLSX');
  console.log('Worksheets:', wb.worksheets.map(w => w.name));
  const sheet = wb.worksheets[0];
  console.log('Row count:', sheet.rowCount);
  for (let i = 1; i <= Math.min(15, sheet.rowCount); i++) {
    const row = sheet.getRow(i);
    console.log(`Row ${i}:`, JSON.stringify(row.values));
  }
}

main().catch(console.error);

