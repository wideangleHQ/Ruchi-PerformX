import { describe, it, expect } from 'vitest';
import * as ExcelJS from 'exceljs';
import { NotFoundException } from '@nestjs/common';
import { role_enum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { DepartmentScopeService } from '../../common/services/department-scope.service';
import { SelfActionsService } from './self-actions.service';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { SelfActionFilterDto } from './dto/self-action-filter.dto';

/**
 * The export is the screen's list written to a file, so what is worth pinning
 * here is everything that could quietly make the two disagree: a where clause
 * of its own, a query that pages (and so can duplicate or drop rows once the
 * result spans pages), or a scope that stops applying because the code path
 * changed. Same harness shape as self-action-search.spec.ts — the where that
 * reaches Prisma is where the behaviour actually lives.
 */

const DEPARTMENT = 'dept-1';

function harness(rows: any[]) {
  const seen: { where?: any; skip?: any; take?: any; findManyCalls: number } = {
    findManyCalls: 0,
  };

  const prisma = {
    self_actions: {
      findMany: (args: any) => {
        seen.where = args.where;
        seen.skip = args.skip;
        seen.take = args.take;
        seen.findManyCalls += 1;
        return Promise.resolve(rows);
      },
      count: () => Promise.resolve(rows.length),
    },
  } as unknown as PrismaService;

  const scope = {
    resolveDepartmentScope: (user: JwtPayload) =>
      Promise.resolve(
        user.role === role_enum.MD
          ? { unrestricted: true, departmentIds: [] }
          : { unrestricted: false, departmentIds: [DEPARTMENT] },
      ),
  } as unknown as DepartmentScopeService;

  const attachments = {
    decorateTaskAttachments: (attachments_: any) => Promise.resolve(attachments_ ?? []),
  } as unknown as AttachmentsService;

  const service = new SelfActionsService(prisma, attachments, scope);
  return { service, seen };
}

const md = { sub: 'u2', username: 'md', role: role_enum.MD } as JwtPayload;
const employee = { sub: 'u1', username: 'emp', role: role_enum.EMPLOYEE } as JwtPayload;

const clausesOf = (where: any) => (where.AND ?? [where]) as any[];

/** A row shaped the way the export's lean select returns one. */
function actionRow(overrides: any = {}) {
  return {
    title: 'Close the quarterly audit',
    description: 'Finish the checklist and file it',
    priority: 'HIGH',
    status: 'COMPLETED',
    created_at: new Date(2026, 10, 11, 9, 5),
    updated_at: new Date(2026, 10, 11, 16, 45),
    completed_at: new Date(2026, 10, 12, 14, 30),
    users: { full_name: 'Asha Employee', role: 'EMPLOYEE' },
    self_action_departments: [{ departments: { name: 'Finance' } }],
    ...overrides,
  };
}

async function readWorkbook(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  // exceljs types `load` with its own Buffer-shaped interface; a Node buffer is
  // what it actually reads.
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook;
}

describe('self-action export', () => {
  it('filters exactly as the list does', async () => {
    const filter = {
      search: 'audit',
      status: 'OPEN',
      createdById: 'u9',
      dateFrom: '2026-11-01',
      dateTo: '2026-11-11',
      page: 3,
      limit: 20,
    } as SelfActionFilterDto;

    const list = harness([]);
    await list.service.findAll(md, filter);

    const file = harness([actionRow()]);
    await file.service.exportToExcel(md, filter);

    expect(file.seen.where).toEqual(list.seen.where);
  });

  it('reads every matching row in one query, with no paging to duplicate across', async () => {
    const { service, seen } = harness([actionRow(), actionRow({ title: 'Second' })]);

    await service.exportToExcel(md, { page: 3, limit: 20 } as SelfActionFilterDto);

    expect(seen.findManyCalls).toBe(1);
    expect(seen.skip).toBeUndefined();
    expect(seen.take).toBeUndefined();
  });

  it('keeps the scope clauses that keep unauthorized rows out', async () => {
    const { service, seen } = harness([actionRow()]);

    await service.exportToExcel(employee, {
      search: 'anything',
      createdById: 'somebody-else',
    } as SelfActionFilterDto);

    const clauses = clausesOf(seen.where);
    expect(clauses).toContainEqual({ deleted_at: null });
    expect(clauses).toContainEqual({
      self_action_departments: { some: { department_id: { in: [DEPARTMENT] } } },
    });

    // Identity always comes from the token, and a name picked in the filter is
    // another AND clause beside it — never a replacement. Two different values
    // for the same field satisfy nothing, so an employee asking for a
    // colleague's name comes back empty rather than reaching past ownership.
    const identities = clauses.filter((clause) => 'created_by_id' in clause);
    expect(identities).toEqual(
      expect.arrayContaining([{ created_by_id: 'u1' }, { created_by_id: 'somebody-else' }]),
    );
    expect(identities).toContainEqual({ created_by_id: 'u1' });
  });

  it('bounds the published dates by the whole day', async () => {
    const { service, seen } = harness([actionRow()]);

    await service.exportToExcel(md, {
      dateFrom: '2026-11-01',
      dateTo: '2026-11-11',
    } as SelfActionFilterDto);

    const range = clausesOf(seen.where).find((clause: any) => clause.created_at)?.created_at;
    expect(range).toBeDefined();
    expect(range.gte).toEqual(new Date(2026, 10, 1, 0, 0, 0, 0));
    expect(range.lte).toEqual(new Date(2026, 10, 11, 23, 59, 59, 999));
  });

  it('sends no date clause when only an employee is chosen', async () => {
    const { service, seen } = harness([actionRow()]);

    await service.exportToExcel(md, { createdById: 'u9' } as SelfActionFilterDto);

    const clauses = clausesOf(seen.where);
    expect(clauses.some((clause: any) => clause.created_at)).toBe(false);
    expect(clauses).toContainEqual({ created_by_id: 'u9' });
  });

  it('says so, in the screen words, when nothing matches', async () => {
    const { service } = harness([]);

    await expect(service.exportToExcel(md, {} as SelfActionFilterDto)).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.exportToExcel(md, {} as SelfActionFilterDto)).rejects.toThrow(
      'No Self Actions found for the selected filters.',
    );
  });

  it('writes the agreed columns, with dates and blanks as specified', async () => {
    const { service } = harness([
      actionRow(),
      actionRow({
        description: '',
        completed_at: null,
        users: { full_name: 'Ravi Employee', role: 'HOD' },
      }),
    ]);

    const { buffer, filename } = await service.exportToExcel(md, {} as SelfActionFilterDto);
    expect(filename).toMatch(/^PerformX_Self_Actions_Export_\d{4}-\d{2}-\d{2}\.xlsx$/);

    const sheet = (await readWorkbook(buffer)).getWorksheet('Self Actions');
    expect(sheet).toBeDefined();

    const headers = (sheet!.getRow(1).values as unknown[]).slice(1);
    expect(headers).toEqual([
      'Employee Name',
      'Self Action Title',
      'Description',
      'Published Date',
      'Department',
      'Designation',
      'Priority',
      'Status',
      'Completed Date',
      'Last Updated',
    ]);
    expect(sheet!.getRow(1).font?.bold).toBe(true);

    const first = sheet!.getRow(2);
    expect(first.getCell('A').value).toBe('Asha Employee');
    expect(first.getCell('B').value).toBe('Close the quarterly audit');
    expect(first.getCell('C').value).toBe('Finish the checklist and file it');
    expect(first.getCell('D').value).toBe('11-Nov-2026 09:05');
    expect(first.getCell('E').value).toBe('Finance');
    expect(first.getCell('F').value).toBe('EMPLOYEE');
    expect(first.getCell('G').value).toBe('HIGH');
    expect(first.getCell('H').value).toBe('COMPLETED');
    expect(first.getCell('I').value).toBe('12-Nov-2026 14:30');
    expect(first.getCell('J').value).toBe('11-Nov-2026 16:45');

    const second = sheet!.getRow(3);
    expect(second.getCell('C').value).toBeNull();
    expect(second.getCell('I').value).toBeNull();
  });

  it('escapes a value that would otherwise read as a formula', async () => {
    const { service } = harness([
      actionRow({
        title: '=HYPERLINK("http://evil.example","click")',
        description: '+1+1',
        users: { full_name: '@SUM(1,1)', role: 'EMPLOYEE' },
      }),
    ]);

    const { buffer } = await service.exportToExcel(md, {} as SelfActionFilterDto);
    const row = (await readWorkbook(buffer)).getWorksheet('Self Actions')!.getRow(2);

    expect(row.getCell('B').value).toBe(`'=HYPERLINK("http://evil.example","click")`);
    expect(row.getCell('C').value).toBe("'+1+1");
    expect(row.getCell('A').value).toBe("'@SUM(1,1)");
  });
});
