// src/common/types/jwt-payload.type.ts

import { role_enum } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  username: string;
  role: role_enum;            // MD | HOD | EMPLOYEE | ADMIN | EA | PA
  departmentId: string | null; // kept for EMPLOYEE / MD backward compat
  departmentIds: string[];     // HOD / EA / PA: all assigned dept IDs; others: [] or [departmentId]
  iat?: number;
  exp?: number;
}