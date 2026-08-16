import { describe, it, expect } from 'vitest';
import { role_enum } from '@prisma/client';
import { visibleCategories } from './rnd-visibility';

// This rule is the whole access model for R&D reports. Getting it wrong leaks
// one researcher's pricing work into another's packaging thread, or hides the
// team's output from the MD, and neither failure raises an error anywhere.
describe('visibleCategories', () => {
  it('gives MD and the assistant roles every category', () => {
    for (const role of [role_enum.MD, role_enum.EA, role_enum.PA]) {
      expect(visibleCategories(role, false, [])).toBe('ALL');
    }
  });

  it('gives a member only the categories they research', () => {
    expect(
      visibleCategories(role_enum.EMPLOYEE, true, ['packaging', 'shelf-life']),
    ).toEqual(['packaging', 'shelf-life']);
  });

  it('gives a non-member nothing, whatever categories are passed', () => {
    expect(visibleCategories(role_enum.EMPLOYEE, false, ['pricing'])).toEqual(
      [],
    );
    expect(visibleCategories(role_enum.HOD, false, [])).toEqual([]);
  });

  it('collapses duplicate categories', () => {
    expect(
      visibleCategories(role_enum.EMPLOYEE, true, [
        'packaging',
        'packaging',
      ]),
    ).toEqual(['packaging']);
  });

  it('keeps a member out of a thread they have not worked in', () => {
    const scope = visibleCategories(role_enum.EMPLOYEE, true, ['packaging']);
    expect(scope).not.toBe('ALL');
    expect(scope).not.toContain('pricing');
  });
});
