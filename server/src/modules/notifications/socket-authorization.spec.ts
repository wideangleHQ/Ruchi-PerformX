import { describe, it, expect, vi } from 'vitest';
import { role_enum } from '@prisma/client';
import { NotificationsGateway } from './notifications.gateway';

// Joining a room used to require nothing but a valid token, so any employee
// could watch any task and, once role_enum.VENDOR existed, so could an
// external login. These cover the rule that replaced it.
function gatewayWith(task: unknown, project: unknown) {
  const prisma = {
    tasks: { findFirst: vi.fn().mockResolvedValue(task) },
    projects: { findFirst: vi.fn().mockResolvedValue(project) },
  };
  const g = new NotificationsGateway({} as never, prisma as never);
  return { g: g as unknown as {
    mayJoin(k: 'task' | 'project', id: string, u: unknown): Promise<boolean>;
  }, prisma };
}

const employee = { sub: 'u1', role: role_enum.EMPLOYEE };
const vendor = { sub: 'v1', role: role_enum.VENDOR };
const md = { sub: 'm1', role: role_enum.MD };

describe('socket room authorization', () => {
  it('refuses a vendor every room, whatever the row says', async () => {
    const { g } = gatewayWith({ id: 't1' }, { id: 'p1' });
    expect(await g.mayJoin('task', 't1', vendor)).toBe(false);
    expect(await g.mayJoin('project', 'p1', vendor)).toBe(false);
  });

  it('refuses a socket with no user', async () => {
    const { g } = gatewayWith({ id: 't1' }, { id: 'p1' });
    expect(await g.mayJoin('task', 't1', undefined)).toBe(false);
  });

  it('refuses an empty id rather than joining a room called task:', async () => {
    const { g } = gatewayWith({ id: 't1' }, { id: 'p1' });
    expect(await g.mayJoin('task', '', employee)).toBe(false);
  });

  it('lets an employee watch a task they are on', async () => {
    const { g } = gatewayWith({ id: 't1' }, null);
    expect(await g.mayJoin('task', 't1', employee)).toBe(true);
  });

  it('refuses an employee a task they are not on', async () => {
    const { g } = gatewayWith(null, null);
    expect(await g.mayJoin('task', 't1', employee)).toBe(false);
  });

  it('lets management watch a task they are not on', async () => {
    const { g } = gatewayWith(null, null);
    expect(await g.mayJoin('task', 't1', md)).toBe(true);
  });

  // Projects are readable company-wide by design, so the room matches that.
  it('lets any internal role watch a project that exists', async () => {
    const { g } = gatewayWith(null, { id: 'p1' });
    expect(await g.mayJoin('project', 'p1', employee)).toBe(true);
  });

  it('refuses a project that is missing or soft deleted', async () => {
    const { g } = gatewayWith(null, null);
    expect(await g.mayJoin('project', 'p1', employee)).toBe(false);
  });
});
