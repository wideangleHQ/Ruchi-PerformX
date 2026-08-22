import { describe, it, expect } from 'vitest';
import { role_enum } from '@prisma/client';

import {
  ALL_INTERNAL,
  ASSISTANT_TOOLS,
  toolSchemas,
  toolsFor,
} from './assistant-tools';
import { requireAnthropicKey } from './assistant.config';

// The assistant reaches services in process, so the `@Roles` guard on the
// controller each tool wraps does not run. The `roles` list on the tool is what
// stands in for it, and `toolsFor` is the only thing enforcing it. These cover
// that, because a mistake here is a permission leak rather than a bug.

const as = (role: role_enum) => ({ sub: 'u1', role }) as never;
const names = (role: role_enum) => toolsFor(as(role)).map((t) => t.name);

describe('the catalog itself', () => {
  it('gives every tool a unique name', () => {
    const all = ASSISTANT_TOOLS.map((t) => t.name);
    expect(new Set(all).size).toBe(all.length);
  });

  it('uses names the API accepts', () => {
    for (const tool of ASSISTANT_TOOLS) {
      expect(tool.name).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
    }
  });

  it('describes every tool, since the description is what the model routes on', () => {
    for (const tool of ASSISTANT_TOOLS) {
      expect(tool.description.length).toBeGreaterThan(40);
    }
  });

  it('gives every tool at least one role', () => {
    for (const tool of ASSISTANT_TOOLS) {
      expect(tool.roles.length).toBeGreaterThan(0);
    }
  });
});

describe('vendors reach nothing', () => {
  it('gives a vendor an empty catalog', () => {
    expect(toolsFor(as(role_enum.VENDOR))).toEqual([]);
  });

  it('names VENDOR in no tool, so the empty catalog is not the only guard', () => {
    for (const tool of ASSISTANT_TOOLS) {
      expect(tool.roles).not.toContain(role_enum.VENDOR);
    }
  });

  it('keeps VENDOR out of ALL_INTERNAL and everyone else in', () => {
    expect(ALL_INTERNAL).not.toContain(role_enum.VENDOR);
    expect(ALL_INTERNAL).toHaveLength(Object.values(role_enum).length - 1);
  });
});

describe('the catalog narrows by role', () => {
  it('does not offer an employee company-wide leave', () => {
    const employee = names(role_enum.EMPLOYEE);
    expect(employee).not.toContain('leave_report_month');
    expect(employee).not.toContain('leave_balances_all');
    expect(employee).not.toContain('leave_pending_approvals');
  });

  it('does not offer an employee anybody else\'s scores', () => {
    const employee = names(role_enum.EMPLOYEE);
    expect(employee).not.toContain('score_leaderboard');
    expect(employee).not.toContain('department_score');
    expect(employee).not.toContain('hod_scores');
    // Their own score is theirs to see.
    expect(employee).toContain('my_score');
  });

  it('gives an employee the everyday tools', () => {
    const employee = names(role_enum.EMPLOYEE);
    expect(employee).toContain('leave_balance');
    expect(employee).toContain('my_tasks');
    expect(employee).toContain('upcoming_holidays');
  });

  it('gives HR the balances nobody else gets', () => {
    expect(names(role_enum.HR)).toContain('leave_balances_all');
    expect(names(role_enum.MD)).not.toContain('leave_balances_all');
  });

  it('gives the MD company-wide leave and scores', () => {
    const md = names(role_enum.MD);
    expect(md).toContain('leave_report_month');
    expect(md).toContain('score_leaderboard');
  });

  it('gives a HOD approvals and scores but not HR balances', () => {
    const hod = names(role_enum.HOD);
    expect(hod).toContain('leave_pending_approvals');
    expect(hod).toContain('hod_scores');
    expect(hod).not.toContain('leave_balances_all');
  });
});

describe('toolSchemas', () => {
  it('sends name, description and schema, and nothing else', () => {
    const schemas = toolSchemas(toolsFor(as(role_enum.EMPLOYEE)));
    for (const schema of schemas) {
      expect(Object.keys(schema).sort()).toEqual([
        'description',
        'input_schema',
        'name',
      ]);
      expect(schema.input_schema.type).toBe('object');
    }
  });

  it('keeps catalog order, so the cached prefix stays byte-stable', () => {
    const user = as(role_enum.MD);
    expect(toolSchemas(toolsFor(user)).map((s) => s.name)).toEqual(
      toolsFor(user).map((t) => t.name),
    );
  });
});

describe('requireAnthropicKey', () => {
  it('refuses a missing key', () => {
    expect(() => requireAnthropicKey(undefined)).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('refuses an empty key rather than passing it to the SDK', () => {
    expect(() => requireAnthropicKey('   ')).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('accepts a real one', () => {
    expect(requireAnthropicKey('sk-ant-test')).toBe('sk-ant-test');
  });
});
