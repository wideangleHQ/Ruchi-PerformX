const fs = require('fs');
const file = 'c:/WideAngle/Ruchi/Ruchi PerformX/client/src/features/vms/passes/api/pass.api.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("printedCopies: visit.printCopies || 0", "printCopies: visit.printCopies || 0");
fs.writeFileSync(file, content);
