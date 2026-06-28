const fs = require('fs');
const file = 'c:/WideAngle/Ruchi/Ruchi PerformX/client/src/features/vms/passes/api/pass.api.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "const { data } = await axiosClient.get<PaginatedPassResponse>('/vms/passes', { params });\n  return data.data;",
  "const { data } = await axiosClient.get('/vms/visits', { params });\n  \n  const mappedData = data.data.map((visit: any) => ({\n    passNumber: visit.visitCode,\n    visitId: visit.id,\n    visitor: visit.visitor,\n    employee: visit.hostEmployee,\n    status: visit.status,\n    purpose: visit.purpose,\n    checkInTime: visit.checkInTime,\n    checkOutTime: visit.checkOutTime,\n    printedCopies: visit.printCopies || 0\n  }));\n\n  return {\n    data: mappedData,\n    meta: data.meta\n  } as unknown as PaginatedPassResponse;"
);
fs.writeFileSync(file, content);
