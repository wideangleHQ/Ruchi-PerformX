export type AccessType = 'RECEPTION' | 'EMPLOYEE';

export interface VerifyAccessRequest {
  code: string;
}

export interface VerifyAccessResponse {
  success: boolean;
  message?: string;
  accessToken?: string;
  accessType?: AccessType;
  employeeId?: number;
  employeeName?: string;
  redirectTo?: string;
}

export type AccessSubmitHandler = (code: string) => Promise<void> | void;

export interface AccessStore {
  code: string | null;
  setCode: (code: string | null) => void;
  clearCode: () => void;
}
