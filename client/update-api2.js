const fs = require('fs');
const file = 'c:/WideAngle/Ruchi/Ruchi PerformX/client/src/features/vms/passes/api/pass.api.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "export const reprintPermissionSlip = async (passNumber: string, payload: ReprintPassRequest): Promise<PassResponse> => {\n  const { data } = await axiosClient.post<{ data: PassResponse }>(/vms/passes/\/reprint, payload);\n  return data.data;\n};",
  "export const reprintPermissionSlip = async (visitId: string, payload: ReprintPassRequest): Promise<PassResponse> => {\n  const { data } = await axiosClient.post<{ data: PassResponse }>(/vms/passes/\/reprint, payload);\n  return data.data;\n};"
);

fs.writeFileSync(file, content);
