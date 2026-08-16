import { describe, it, expect } from 'vitest';
import { canWrite } from './project-collab.service';

// OBSERVER is the whole reason this predicate is a function rather than a
// truthiness check on the member row. An observer has a membership row, so
// anything that asks "is this person a member" says yes and lets them post.
describe('canWrite', () => {
  it('lets the three participating roles write', () => {
    expect(canWrite('PROJECT_LEAD')).toBe(true);
    expect(canWrite('CO_LEAD')).toBe(true);
    expect(canWrite('MEMBER')).toBe(true);
  });

  it('refuses an observer', () => {
    expect(canWrite('OBSERVER')).toBe(false);
  });

  it('refuses a non-member, whose role read comes back empty', () => {
    expect(canWrite(undefined)).toBe(false);
    expect(canWrite(null)).toBe(false);
  });

  it('refuses a role it does not recognise', () => {
    // project_members.role is a VarChar, so the database will hold whatever a
    // future writer puts there. Unknown means no.
    expect(canWrite('')).toBe(false);
    expect(canWrite('VENDOR')).toBe(false);
    expect(canWrite('project_lead')).toBe(false);
  });
});
