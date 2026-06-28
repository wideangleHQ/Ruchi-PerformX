import { role_enum } from '@prisma/client';

export interface VmsJwtPayload {
  sub: string;
  scope: 'vms';
  accessType: 'RECEPTION' | 'EMPLOYEE';
  role: role_enum;
  iat?: number;
  exp?: number;
}
