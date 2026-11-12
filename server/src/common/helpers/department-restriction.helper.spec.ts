import { describe, expect, it } from 'vitest';
import { role_enum } from '@prisma/client';
import {
  isRestrictedFromDigitalMarketing,
  isDigitalMarketingDepartment,
} from './department-restriction.helper';

describe('Department Restriction Helper', () => {
  describe('isRestrictedFromDigitalMarketing', () => {
    it('restricts MD, EA, and PA roles', () => {
      expect(isRestrictedFromDigitalMarketing(role_enum.MD)).toBe(true);
      expect(isRestrictedFromDigitalMarketing(role_enum.EA)).toBe(true);
      expect(isRestrictedFromDigitalMarketing(role_enum.PA)).toBe(true);
      expect(isRestrictedFromDigitalMarketing('MD')).toBe(true);
      expect(isRestrictedFromDigitalMarketing('EA')).toBe(true);
      expect(isRestrictedFromDigitalMarketing('PA')).toBe(true);
    });

    it('does not restrict ADMIN, HOD, EMPLOYEE, or other roles', () => {
      expect(isRestrictedFromDigitalMarketing(role_enum.ADMIN)).toBe(false);
      expect(isRestrictedFromDigitalMarketing(role_enum.HOD)).toBe(false);
      expect(isRestrictedFromDigitalMarketing(role_enum.EMPLOYEE)).toBe(false);
      expect(isRestrictedFromDigitalMarketing(role_enum.DEPARTMENT_CONTROLLER)).toBe(false);
      expect(isRestrictedFromDigitalMarketing(role_enum.HR)).toBe(false);
      expect(isRestrictedFromDigitalMarketing(undefined)).toBe(false);
    });
  });

  describe('isDigitalMarketingDepartment', () => {
    it('identifies Digital Marketing department variations case-insensitively', () => {
      expect(isDigitalMarketingDepartment('Digital Marketing')).toBe(true);
      expect(isDigitalMarketingDepartment('digital marketing')).toBe(true);
      expect(isDigitalMarketingDepartment('DIGITAL MARKETING')).toBe(true);
      expect(isDigitalMarketingDepartment('Digital Marketing & Growth')).toBe(true);
      expect(isDigitalMarketingDepartment('Marketing - Digital')).toBe(true);
    });

    it('returns false for unrelated departments', () => {
      expect(isDigitalMarketingDepartment('Sales')).toBe(false);
      expect(isDigitalMarketingDepartment('Human Resources')).toBe(false);
      expect(isDigitalMarketingDepartment('IT Operations')).toBe(false);
      expect(isDigitalMarketingDepartment('Traditional Marketing')).toBe(false);
      expect(isDigitalMarketingDepartment(null)).toBe(false);
      expect(isDigitalMarketingDepartment(undefined)).toBe(false);
    });
  });
});

