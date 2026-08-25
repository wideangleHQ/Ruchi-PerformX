import { describe, it, expect } from 'vitest';
import { role_enum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { DepartmentScopeService } from '../../common/services/department-scope.service';
import { SelfActionsService } from './self-actions.service';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { SelfActionFilterDto } from './dto/self-action-filter.dto';

/**
 * The search box matches the creator's name as well as the work and the
 * description, and the reason that is safe is not visible from the line that
 * does it.
 *
 * The name match is one `OR` inside a list of clauses that are `AND`ed
 * together. The department scope and, for an EMPLOYEE, `created_by_id = self`
 * are other entries in the same list. So typing a colleague's name narrows what
 * the caller could already see rather than reaching past it. Move that `OR` up
 * a level, or start replacing the clause list with a flat object, and this
 * screen quietly becomes a company-wide people search.
 *
 * These cases read the `where` that reaches Prisma, which is the only place the
 * property is actually expressed.
 */

const DEPARTMENT = 'dept-1';

function capture(user: JwtPayload) {
  const seen: { where?: any } = {};
  const prisma = {
    self_actions: {
      findMany: ({ where }: { where: unknown }) => {
        seen.where = where;
        return Promise.resolve([]);
      },
      count: () => Promise.resolve(0),
    },
  } as unknown as PrismaService;

  const scope = {
    resolveDepartmentScope: () =>
      Promise.resolve(
        user.role === role_enum.MD
          ? { unrestricted: true, departmentIds: [] }
          : { unrestricted: false, departmentIds: [DEPARTMENT] },
      ),
  } as unknown as DepartmentScopeService;

  const service = new SelfActionsService(prisma, {} as AttachmentsService, scope);

  return async (filter: Partial<SelfActionFilterDto>) => {
    await service.findAll(user, filter as SelfActionFilterDto);
    const where = seen.where as any;
    return (where.AND ?? [where]) as any[];
  };
}

const employee = { sub: 'u1', username: 'emp', role: role_enum.EMPLOYEE } as JwtPayload;
const md = { sub: 'u2', username: 'md', role: role_enum.MD } as JwtPayload;

const searchOr = (clauses: any[]) => clauses.find((c) => Array.isArray(c.OR))?.OR;

describe('self-action search', () => {
  it('matches the creator name alongside the work and the description', async () => {
    const clauses = await capture(md)({ search: 'rajesh' });
    const or = searchOr(clauses);

    expect(or).toHaveLength(3);
    expect(or).toContainEqual({ users: { full_name: { contains: 'rajesh', mode: 'insensitive' } } });
    expect(or).toContainEqual({ title: { contains: 'rajesh', mode: 'insensitive' } });
    expect(or).toContainEqual({ description: { contains: 'rajesh', mode: 'insensitive' } });
  });

  it('adds no OR when nothing was typed', async () => {
    const clauses = await capture(md)({});
    expect(searchOr(clauses)).toBeUndefined();
  });

  // The point of the whole file.
  it('leaves an employee searching a colleague with their own rows only', async () => {
    const clauses = await capture(employee)({ search: 'somebody else' });

    expect(searchOr(clauses)).toBeDefined();
    expect(clauses).toContainEqual({ created_by_id: 'u1' });
  });

  it('keeps the department scope beside the search for a scoped role', async () => {
    const clauses = await capture(employee)({ search: 'rajesh' });

    expect(clauses).toContainEqual({
      self_action_departments: { some: { department_id: { in: [DEPARTMENT] } } },
    });
  });

  it('still pins identity to the token in mine mode', async () => {
    const clauses = await capture(md)({ mine: true, search: 'anyone', createdById: 'someone-else' });

    expect(clauses).toContainEqual({ created_by_id: 'u2' });
    expect(clauses).not.toContainEqual({ created_by_id: 'someone-else' });
  });
});
