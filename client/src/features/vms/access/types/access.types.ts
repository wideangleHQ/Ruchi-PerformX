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

// The keypad holds the code, so it is always a string and never null. Digits
// go in one at a time and `clear` empties it, both on backspace-to-empty and
// on sign-out.
export interface AccessStore {
  code: string;
  appendDigit: (digit: string) => void;
  removeDigit: () => void;
  clear: () => void;
}
