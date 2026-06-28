export class VerifyAccessResponseDto {
  success!: boolean;
  message?: string;
  accessToken?: string;
  accessType?: 'RECEPTION' | 'EMPLOYEE';
  employeeId?: string;
  employeeName?: string;
  redirectTo?: string;
}
