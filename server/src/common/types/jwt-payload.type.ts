// src/common/types/jwt-payload.type.ts

import { role_enum } from '@prisma/client';

export interface JwtPayload {
  sub: string;          
  username: string;      
  role: role_enum;            // MD | HOD | EMPLOYEE | ADMIN — drives authorization
  departmentId: string | null; 
  iat?: number;          
  exp?: number;        
}