import { role_enum } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: role_enum;
  departmentId: string | null;
  departmentIds: string[];
}

