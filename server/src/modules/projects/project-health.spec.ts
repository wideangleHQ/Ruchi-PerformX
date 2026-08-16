import { describe, it, expect } from 'vitest';
import { project_health_enum } from '@prisma/client';
import { deriveHealth, type HealthInputs } from './project-deadline.cron';

const now = new Date('2026-08-16T08:00:00Z');
const inDays = (n: number) =>
  new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

const project = (over: Partial<HealthInputs> = {}): HealthInputs => ({
  deadline: inDays(30),
  now,
  checklistDone: 5,
  checklistTotal: 10,
  overdueItems: 0,
  overdueMilestones: 0,
  ...over,
});

// health is stored and the directory filters on it, so a wrong value here is a
// wrong filter result, not a cosmetic badge.
describe('deriveHealth', () => {
  it('is on track with room left and nothing overdue', () => {
    expect(deriveHealth(project())).toBe(project_health_enum.ON_TRACK);
  });

  it('is at risk in the final week with the checklist behind', () => {
    expect(
      deriveHealth(
        project({ deadline: inDays(3), checklistDone: 2, checklistTotal: 10 }),
      ),
    ).toBe(project_health_enum.AT_RISK);
  });

  it('stays on track in the final week once the checklist is nearly done', () => {
    expect(
      deriveHealth(
        project({ deadline: inDays(3), checklistDone: 9, checklistTotal: 10 }),
      ),
    ).toBe(project_health_enum.ON_TRACK);
  });

  it('is at risk on a single overdue checklist item', () => {
    expect(deriveHealth(project({ overdueItems: 1 }))).toBe(
      project_health_enum.AT_RISK,
    );
  });

  it('is at risk on a single overdue milestone', () => {
    expect(deriveHealth(project({ overdueMilestones: 1 }))).toBe(
      project_health_enum.AT_RISK,
    );
  });

  it('is delayed once the deadline is in the past', () => {
    expect(deriveHealth(project({ deadline: inDays(-1) }))).toBe(
      project_health_enum.DELAYED,
    );
  });

  it('is not delayed on the deadline day itself', () => {
    expect(
      deriveHealth(
        project({
          deadline: new Date('2026-08-16T23:59:00Z'),
          checklistDone: 10,
          checklistTotal: 10,
        }),
      ),
    ).toBe(project_health_enum.ON_TRACK);
  });

  it('never goes delayed without a deadline, however much has slipped', () => {
    expect(
      deriveHealth(
        project({
          deadline: null,
          checklistDone: 0,
          checklistTotal: 10,
          overdueItems: 50,
          overdueMilestones: 4,
        }),
      ),
    ).toBe(project_health_enum.AT_RISK);
  });

  it('treats an empty checklist as no signal rather than zero percent', () => {
    expect(
      deriveHealth(
        project({ deadline: inDays(1), checklistDone: 0, checklistTotal: 0 }),
      ),
    ).toBe(project_health_enum.ON_TRACK);
  });
});
