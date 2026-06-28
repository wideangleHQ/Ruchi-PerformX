export interface VmsAccessVerificationResult {
  success: true;
  accessType: 'RECEPTION' | 'EMPLOYEE';
  redirectTo: string;
  accessId: string;
  employeeId?: string;
  employeeName?: string;
}

export interface IAccessRepository {
  verifyCode(code: string): Promise<VmsAccessVerificationResult | null>;
}

export const IAccessRepositoryToken = Symbol('IAccessRepository');
