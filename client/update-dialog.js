const fs = require('fs');
const file = 'c:/WideAngle/Ruchi/Ruchi PerformX/client/src/features/vms/passes/components/ReprintPermissionSlipDialog.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "await reprintSlip({ passNumber: slip.passNumber, payload: { reason: reason || undefined } });",
  "await reprintSlip({ passNumber: slip.visitId, payload: { reason: reason || undefined } });"
);

fs.writeFileSync(file, content);
