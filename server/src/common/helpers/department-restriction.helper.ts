import { role_enum } from '@prisma/client';

export const DIGITAL_MARKETING_NAME = 'Digital Marketing';

/**
 * Returns true if the user role is forbidden from seeing Digital Marketing data.
 * As per business requirement: Don't show the data of Digital Marketing Department to EA, PA or MD.
 */
export function isRestrictedFromDigitalMarketing(role?: string | null): boolean {
  if (!role) return false;
  return (
    role === role_enum.MD ||
    role === role_enum.EA ||
    role === role_enum.PA
  );
}

/**
 * Checks whether a department name matches Digital Marketing (case-insensitive).
 */
export function isDigitalMarketingDepartment(name?: string | null): boolean {
  if (!name) return false;
  const lower = name.trim().toLowerCase();
  return (
    lower.includes(DIGITAL_MARKETING_NAME.toLowerCase()) ||
    (lower.includes('digital') && lower.includes('marketing'))
  );
}
