export class ProfileResponseDto {
  id!: string;
  fullName!: string;
  email!: string;
  username!: string;
  mobileNumber?: string | null;
  designation!: string;
  role!: string;
  departmentId?: string | null;
  departmentName?: string | null | undefined;
  departmentIds?: string[] | undefined;
  departmentNames?: string[] | undefined;
  dateOfBirth?: Date | null;
  createdAt?: Date | null;
  canAccessCareerHR!: boolean;
}
