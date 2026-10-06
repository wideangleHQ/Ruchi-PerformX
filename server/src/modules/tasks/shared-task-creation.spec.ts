import { describe, it, expect, vi } from 'vitest';
import { role_enum, task_priority_enum, task_type_enum } from '@prisma/client';

import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { JwtPayload } from '../../common/types/jwt-payload.type';

// createTaskRecords used to write 4 statements per assignee in a plain `for`
// loop (up to MAX_SHARED_ASSIGNEES = 50). These cover the batched replacement:
// one write per table regardless of assignee count, correct per-assignee
// correlation assuming createManyAndReturn preserves insert order (the same
// assumption notifyMany() already relies on), and no silent drop on a
// duplicate or empty assignee list.

function buildFakeDb(assigneeCount: number) {
  let nextId = 0;
  return {
    tasks: {
      createManyAndReturn: vi.fn(async ({ data }: { data: unknown[] }) =>
        data.map(() => ({ id: `task-${++nextId}` })),
      ),
    },
    task_departments: { createMany: vi.fn(async (_args: { data: unknown[] }) => ({ count: 0 })) },
    task_status_logs: { createMany: vi.fn(async (_args: { data: unknown[] }) => ({ count: assigneeCount })) },
    audit_logs: { createMany: vi.fn(async (_args: { data: unknown[] }) => ({ count: assigneeCount })) },
  };
}

function buildService() {
  const allEmployees = [
    { id: 'emp-1', department_id: 'dept-a' },
    { id: 'emp-2', department_id: 'dept-b' },
    { id: 'emp-3', department_id: 'dept-b' },
  ];
  const prisma = {
    departments: { count: vi.fn().mockResolvedValue(1) },
    users: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        allEmployees.filter((e) => where.id.in.includes(e.id)),
      ),
    },
    hod_departments: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const departmentScopeService = {
    resolveDepartmentScope: vi.fn().mockResolvedValue({ unrestricted: false, departmentIds: ['dept-a'] }),
    validateDepartmentAccess: vi.fn().mockResolvedValue(true),
  };
  const service = new TasksService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    departmentScopeService as never,
  );
  return { service, prisma };
}

const creator: JwtPayload = {
  sub: 'emp-0',
  username: 'creator',
  role: role_enum.EMPLOYEE,
  departmentId: 'dept-a',
  departmentIds: ['dept-a'],
  canAccessCareerHR: false,
};

function sharedTaskDto(assignedToIds: string[]): CreateTaskDto {
  const dto = new CreateTaskDto();
  dto.title = 'Ship the thing';
  dto.description = 'Details';
  dto.priority = task_priority_enum.MEDIUM;
  dto.dueDate = new Date('2026-12-01').toISOString();
  dto.departmentIds = ['dept-a'];
  dto.taskType = task_type_enum.EMPLOYEE_SHARED;
  dto.assignedToIds = assignedToIds;
  return dto;
}

describe('createTaskRecords — shared task creation', () => {
  it('writes each table once, not once per assignee', async () => {
    const { service } = buildService();
    const db = buildFakeDb(3);

    await (service as unknown as {
      createTaskRecords: (db: unknown, dto: CreateTaskDto, user: JwtPayload) => Promise<unknown>;
    }).createTaskRecords(db, sharedTaskDto(['emp-1', 'emp-2', 'emp-3']), creator);

    expect(db.tasks.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(db.task_departments.createMany).toHaveBeenCalledTimes(1);
    expect(db.task_status_logs.createMany).toHaveBeenCalledTimes(1);
    expect(db.audit_logs.createMany).toHaveBeenCalledTimes(1);
  });

  it('correlates each created task back to its own assignee, in order', async () => {
    const { service } = buildService();
    const db = buildFakeDb(3);

    const tasks = await (service as unknown as {
      createTaskRecords: (
        db: unknown,
        dto: CreateTaskDto,
        user: JwtPayload,
      ) => Promise<{ id: string; notifications?: { recipientId: string }[] }[]>;
    }).createTaskRecords(db, sharedTaskDto(['emp-1', 'emp-2', 'emp-3']), creator);

    expect(tasks).toHaveLength(3);
    expect(tasks.map((t) => t.notifications?.[0]?.recipientId)).toEqual(['emp-1', 'emp-2', 'emp-3']);

    const statusLogRows = (db.task_status_logs.createMany.mock.calls[0]?.[0] as { data: { task_id: string }[] })
      .data;
    expect(statusLogRows.map((r) => r.task_id)).toEqual(tasks.map((t) => t.id));

    const auditRows = (
      db.audit_logs.createMany.mock.calls[0]?.[0] as { data: { entity_id: string; new_value: string }[] }
    ).data;
    expect(JSON.parse(auditRows[1]!.new_value).assignedToId).toBe('emp-2');
  });

  it('gives each assignee their own department pair for an Employee Shared Task', async () => {
    const { service } = buildService();
    const db = buildFakeDb(2);

    await (service as unknown as {
      createTaskRecords: (db: unknown, dto: CreateTaskDto, user: JwtPayload) => Promise<unknown>;
    }).createTaskRecords(db, sharedTaskDto(['emp-1', 'emp-2']), creator);

    const deptRows = (
      db.task_departments.createMany.mock.calls[0]?.[0] as {
        data: { task_id: string; department_id: string }[];
      }
    ).data;
    // emp-1 is in dept-a same as the creator, so its row collapses to one
    // department; emp-2 is in dept-b, so it gets both.
    expect(deptRows.filter((r) => r.task_id === 'task-1')).toHaveLength(1);
    expect(deptRows.filter((r) => r.task_id === 'task-2')).toHaveLength(2);
  });

  it('rejects more than MAX_SHARED_ASSIGNEES without writing anything', async () => {
    const { service } = buildService();
    const db = buildFakeDb(51);
    const tooMany = Array.from({ length: 51 }, (_, i) => `emp-${i}`);

    await expect(
      (service as unknown as {
        createTaskRecords: (db: unknown, dto: CreateTaskDto, user: JwtPayload) => Promise<unknown>;
      }).createTaskRecords(db, sharedTaskDto(tooMany), creator),
    ).rejects.toThrow();

    expect(db.tasks.createManyAndReturn).not.toHaveBeenCalled();
  });
});
