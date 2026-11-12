import { describe, expect, it } from 'vitest';
import {
  calculateEmployeeAtScore,
  calculateHodAtScore,
  calculateProjectScore,
  calculateSelfActionScore,
  calculateTaskScore,
} from './at-scoring';

describe('AT Scoring Engine', () => {
  describe('Self Action Subcomponents', () => {
    it('calculates perfect self-action score when all completed on time with reviews', () => {
      const res = calculateSelfActionScore({
        total: 10,
        completed: 10,
        activeDays: 20,
        workingDays: 20,
        onTimeCompleted: 10,
        reviewedAccepted: 5,
        totalReviewed: 5,
      });

      expect(res.score).toBe(100);
      expect(res.subcomponents.completion!.score).toBe(100);
      expect(res.subcomponents.consistency!.score).toBe(100);
      expect(res.subcomponents.timeliness!.score).toBe(100);
      expect(res.subcomponents.quality!.score).toBe(100);
    });

    it('calculates weighted score according to 40/20/15/25 breakdown', () => {
      const res = calculateSelfActionScore({
        total: 10,
        completed: 8, // 80% completion -> 32
        activeDays: 10,
        workingDays: 20, // 50% consistency -> 10
        onTimeCompleted: 4, // 50% timeliness -> 7.5
        reviewedAccepted: 4,
        totalReviewed: 5, // 80% quality -> 20
      });

      // Total = 32 + 10 + 7.5 + 20 = 69.5
      expect(res.score).toBe(69.5);
    });
  });

  describe('Assigned Task Subcomponents', () => {
    it('evaluates completion, timeliness curve, quality, and discipline penalty', () => {
      const res = calculateTaskScore({
        total: 10,
        completed: 8, // 80% -> 36 (45% weight)
        onTimeCompleted: 4, // 100%
        late1to2Days: 2, // 80%
        late3to5Days: 2, // 50%
        lateOver5Days: 0,
        reviewedAccepted: 6,
        reviewedRework: 2, // 70%
        totalReviewed: 8,
        overdueCount: 1, // -10 penalty
        escalatedCount: 0,
      });

      // Timeliness = (4*100 + 2*80 + 2*50) / 8 = 660 / 8 = 82.5% -> 20.625 (25% weight)
      // Quality = (6*100 + 2*70) / 800 * 100 = 740 / 8 = 92.5% -> 18.5 (20% weight)
      // Discipline = 100 - 10 = 90% -> 9 (10% weight)
      // Total = 36 + 20.625 + 18.5 + 9 = 84.13
      expect(res.score).toBe(84.13);
    });
  });

  describe('Project Subcomponents', () => {
    it('scores applicable project work', () => {
      const res = calculateProjectScore({
        hasProjects: true,
        totalItems: 5,
        completedItems: 4, // 80% -> 32 (40% weight)
        onTimeItems: 4, // 100% -> 20 (20% weight)
        qualityScore: 90, // 90% -> 18 (20% weight)
        outcomeScore: 85, // 85% -> 17 (20% weight)
      });

      // Total = 32 + 20 + 18 + 17 = 87
      expect(res.score).toBe(87);
      expect(res.applicable).toBe(true);
    });

    it('flags non-applicable projects for normalization', () => {
      const res = calculateProjectScore({
        hasProjects: false,
        totalItems: 0,
        completedItems: 0,
        onTimeItems: 0,
        qualityScore: 100,
        outcomeScore: 100,
      });

      expect(res.applicable).toBe(false);
    });
  });

  describe('Employee / EA / PA Overall AT Calculation', () => {
    it('applies standard 50/30/20 weights when projects exist', () => {
      const selfActions = {
        total: 10, completed: 10, activeDays: 20, workingDays: 20,
        onTimeCompleted: 10, reviewedAccepted: 5, totalReviewed: 5,
      }; // score = 100 -> 50
      const tasks = {
        total: 10, completed: 8, onTimeCompleted: 8, late1to2Days: 0, late3to5Days: 0, lateOver5Days: 0,
        reviewedAccepted: 8, reviewedRework: 0, totalReviewed: 8, overdueCount: 0, escalatedCount: 0,
      }; // completion 80% (36) + timeliness 100% (25) + quality 100% (20) + discipline 100% (10) = 91 -> 27.3
      const project = {
        hasProjects: true, totalItems: 10, completedItems: 8, onTimeItems: 8, qualityScore: 80, outcomeScore: 80,
      }; // 32 + 20 + 16 + 16 = 84 -> 16.8

      const res = calculateEmployeeAtScore(selfActions, tasks, project);
      expect(res.isNormalized).toBe(false);
      // Total = 50 + 27.3 + 16.8 = 94.1
      expect(res.score).toBe(94.1);
    });

    it('normalizes proportionally (62.5% Self Actions, 37.5% Tasks) when no projects exist', () => {
      const selfActions = {
        total: 10, completed: 10, activeDays: 20, workingDays: 20,
        onTimeCompleted: 10, reviewedAccepted: 5, totalReviewed: 5,
      }; // 100
      const tasks = {
        total: 10, completed: 10, onTimeCompleted: 10, late1to2Days: 0, late3to5Days: 0, lateOver5Days: 0,
        reviewedAccepted: 10, reviewedRework: 0, totalReviewed: 10, overdueCount: 0, escalatedCount: 0,
      }; // 100
      const project = {
        hasProjects: false, totalItems: 0, completedItems: 0, onTimeItems: 0, qualityScore: 100, outcomeScore: 100,
      };

      const res = calculateEmployeeAtScore(selfActions, tasks, project);
      expect(res.isNormalized).toBe(true);
      expect(res.components.selfAction.weight).toBe(62.5);
      expect(res.components.assignedTask.weight).toBe(37.5);
      expect(res.score).toBe(100);
    });
  });

  describe('HOD AT Score Calculation', () => {
    it('evaluates Personal (40%), Department Execution (35%), Projects (15%), and Leadership (10%)', () => {
      const personal = calculateEmployeeAtScore(
        { total: 5, completed: 5, activeDays: 20, workingDays: 20, onTimeCompleted: 5, reviewedAccepted: 5, totalReviewed: 5 },
        { total: 5, completed: 5, onTimeCompleted: 5, late1to2Days: 0, late3to5Days: 0, lateOver5Days: 0, reviewedAccepted: 5, reviewedRework: 0, totalReviewed: 5, overdueCount: 0, escalatedCount: 0 },
        { hasProjects: true, totalItems: 2, completedItems: 2, onTimeItems: 2, qualityScore: 100, outcomeScore: 100 }
      ); // personal = 100 -> 40

      const dept = {
        totalTasks: 50,
        completedTasks: 45, // 90% -> 45
        onTimeTasks: 40, // 88.89% -> 26.67
        pendingTasks: 5,
        overdueTasks: 2, // 4% -> health = 96% -> 19.2
      }; // deptScore = 45 + 26.67 + 19.2 = 90.87 -> 31.80

      const project = {
        hasProjects: true, totalItems: 4, completedItems: 4, onTimeItems: 4, qualityScore: 90, outcomeScore: 90,
      }; // projectScore = 96 -> 14.40

      const leadership = {
        avgReviewHours: 18, // <= 24h = 100 -> 60
        requestsHandled: 10,
        totalRequests: 10, // 100% -> 40
      }; // leadership = 100 -> 10

      const res = calculateHodAtScore(personal, dept, project, leadership);
      expect(res.components.departmentExecution).toBeDefined();
      expect(res.components.leadership).toBeDefined();
      expect(res.score).toBeGreaterThan(90);
      expect(res.score).toBeLessThanOrEqual(100);
    });

    it('normalizes HOD score when no projects apply', () => {
      const personal = calculateEmployeeAtScore(
        { total: 5, completed: 5, activeDays: 20, workingDays: 20, onTimeCompleted: 5, reviewedAccepted: 5, totalReviewed: 5 },
        { total: 5, completed: 5, onTimeCompleted: 5, late1to2Days: 0, late3to5Days: 0, lateOver5Days: 0, reviewedAccepted: 5, reviewedRework: 0, totalReviewed: 5, overdueCount: 0, escalatedCount: 0 },
        { hasProjects: false, totalItems: 0, completedItems: 0, onTimeItems: 0, qualityScore: 100, outcomeScore: 100 }
      );

      const dept = {
        totalTasks: 20, completedTasks: 20, onTimeTasks: 20, pendingTasks: 0, overdueTasks: 0,
      };

      const project = {
        hasProjects: false, totalItems: 0, completedItems: 0, onTimeItems: 0, qualityScore: 100, outcomeScore: 100,
      };

      const leadership = {
        avgReviewHours: 12, requestsHandled: 5, totalRequests: 5,
      };

      const res = calculateHodAtScore(personal, dept, project, leadership);
      expect(res.isNormalized).toBe(true);
      expect(res.score).toBe(100);
    });
  });
});
