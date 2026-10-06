import { describe, expect, it } from 'vitest';
import { kpi_status_enum, role_enum } from '@prisma/client';

import {
  acceptsProgress,
  allocation,
  canActOnDepartment,
  fitsAllocation,
  isCountable,
  isLegalMove,
  submittedStatus,
} from './kpi-lifecycle';

const SALES = 'sales-dept';
const STORES = 'stores-dept';
const hodOfSales = { unrestricted: false, departmentIds: [SALES] };
const unrestricted = { unrestricted: true, departmentIds: [] };

describe('role matrix', () => {
  it('publishes an authority KPI straight away and never sends it for approval', () => {
    for (const role of [
      role_enum.MD,
      role_enum.EA,
      role_enum.PA,
      role_enum.HOD,
      role_enum.DEPARTMENT_CONTROLLER,
    ]) {
      expect(submittedStatus(role)).toBe('PUBLISHED');
    }
  });

  it('sends an employee KPI for approval', () => {
    expect(submittedStatus(role_enum.EMPLOYEE)).toBe('PENDING_APPROVAL');
    // Roles outside the specification's matrix are held to the employee rule.
    expect(submittedStatus(role_enum.HR)).toBe('PENDING_APPROVAL');
    expect(submittedStatus(role_enum.PURCHASE_HEAD)).toBe('PENDING_APPROVAL');
  });
});

describe('assignment scope', () => {
  it('lets MD, EA, and PA reach any department, or none', () => {
    for (const role of [role_enum.MD, role_enum.EA, role_enum.PA]) {
      expect(canActOnDepartment(role, unrestricted, STORES)).toBe(true);
      expect(canActOnDepartment(role, unrestricted, null)).toBe(true);
    }
  });

  it('holds HOD and Department Controller to their own departments', () => {
    for (const role of [role_enum.HOD, role_enum.DEPARTMENT_CONTROLLER]) {
      expect(canActOnDepartment(role, hodOfSales, SALES)).toBe(true);
      expect(canActOnDepartment(role, hodOfSales, STORES)).toBe(false);
      expect(canActOnDepartment(role, hodOfSales, null)).toBe(false);
    }
  });

  it('lets an employee assign to nobody, even inside their own department', () => {
    expect(canActOnDepartment(role_enum.EMPLOYEE, hodOfSales, SALES)).toBe(false);
  });
});

describe('status transitions', () => {
  it('allows the four-status moves and nothing else', () => {
    const legal: [kpi_status_enum, kpi_status_enum][] = [
      ['DRAFT', 'PUBLISHED'],
      ['DRAFT', 'PENDING_APPROVAL'],
      ['DRAFT', 'DELETED'],
      ['PENDING_APPROVAL', 'PUBLISHED'],
      ['PENDING_APPROVAL', 'DRAFT'],
      ['PENDING_APPROVAL', 'DELETED'],
      ['PUBLISHED', 'DELETED'],
    ];
    for (const [from, to] of legal) expect(isLegalMove(from, to)).toBe(true);

    expect(isLegalMove('PUBLISHED', 'PENDING_APPROVAL')).toBe(false);
    expect(isLegalMove('PUBLISHED', 'DRAFT')).toBe(false);
    expect(isLegalMove('DELETED', 'PUBLISHED')).toBe(false);
    expect(isLegalMove('DELETED', 'DRAFT')).toBe(false);
  });

  it('accepts progress and counts towards the PS Score only once published', () => {
    expect(acceptsProgress('PUBLISHED')).toBe(true);
    expect(isCountable('PUBLISHED')).toBe(true);
    for (const status of ['DRAFT', 'PENDING_APPROVAL', 'DELETED'] as const) {
      expect(acceptsProgress(status)).toBe(false);
      expect(isCountable(status)).toBe(false);
    }
  });
});

describe('weightage', () => {
  it('accepts an employee set below 100', () => {
    expect(allocation([25, 20, 15])).toEqual({ allocated: 60, remaining: 40 });
    expect(fitsAllocation([25, 20], 15)).toBe(true);
  });

  it('lets an authority fill exactly the remaining capacity and no more', () => {
    expect(fitsAllocation([25, 20, 15], 40)).toBe(true);
    expect(fitsAllocation([25, 20, 15], 40.5)).toBe(false);
  });

  it('rejects any further weight at 100', () => {
    expect(allocation([60, 40]).remaining).toBe(0);
    expect(fitsAllocation([60, 40], 1)).toBe(false);
  });

  it('tolerates the float a form produces from thirds', () => {
    expect(fitsAllocation([33.33, 33.33], 33.34)).toBe(true);
  });
});
