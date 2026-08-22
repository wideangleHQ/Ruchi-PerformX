import { describe, it, expect } from 'vitest';
import { role_enum } from '@prisma/client';

import {
  ALL_INTERNAL,
  ASSISTANT_TOOLS,
  isVmsScoped,
  toolSchemas,
  toolsFor,
} from './assistant-tools';
import { DEFAULT_MODEL, ZEN_BASE_URL, resolveProvider } from './assistant.config';

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

// A RECEPTION kiosk token is minted as role_enum.ADMIN by access.service.ts,
// and JwtAuthGuard accepts a VMS token on any path outside /vms/. ADMIN is in
// ALL_INTERNAL, so without this the front desk terminal would reach the whole
// admin catalog. Finding 2.3 in PHASE2-REMAINING.md is the real fix; this is
// the assistant refusing to be one more thing that hole reaches.
describe('a VMS kiosk token reaches nothing', () => {
  const kiosk = (role: role_enum) =>
    ({ sub: 'a1', role, scope: 'vms' }) as never;

  it('gives a reception kiosk, which carries ADMIN, an empty catalog', () => {
    expect(toolsFor(kiosk(role_enum.ADMIN))).toEqual([]);
  });

  it('gives an employee kiosk an empty catalog too', () => {
    expect(toolsFor(kiosk(role_enum.EMPLOYEE))).toEqual([]);
  });

  it('still serves the same role without the vms scope', () => {
    expect(toolsFor(as(role_enum.ADMIN)).length).toBeGreaterThan(0);
  });

  it('reads the scope claim, not the role', () => {
    expect(isVmsScoped(kiosk(role_enum.ADMIN))).toBe(true);
    expect(isVmsScoped(as(role_enum.ADMIN))).toBe(false);
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

  it('offers self actions to the roles the route allows, and not HR', () => {
    // GET /self-actions is narrower than most: no HR, no PURCHASE_HEAD.
    expect(names(role_enum.EMPLOYEE)).toContain('my_self_actions');
    expect(names(role_enum.HOD)).toContain('department_self_actions');
    expect(names(role_enum.HR)).not.toContain('my_self_actions');
    expect(names(role_enum.PURCHASE_HEAD)).not.toContain('department_self_actions');
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
  it('emits the OpenAI function shape Zen expects', () => {
    const schemas = toolSchemas(toolsFor(as(role_enum.EMPLOYEE)));
    for (const schema of schemas) {
      expect(schema.type).toBe('function');
      expect(typeof schema.function.name).toBe('string');
      expect(typeof schema.function.description).toBe('string');
      expect(
        (schema.function.parameters as { type?: string } | undefined)?.type,
      ).toBe('object');
      // The JSON Schema goes under `parameters`, never `input_schema`.
      expect(schema.function).not.toHaveProperty('input_schema');
    }
  });

  it('keeps catalog order, so the prompt does not differ needlessly', () => {
    const user = as(role_enum.MD);
    expect(toolSchemas(toolsFor(user)).map((s) => s.function.name)).toEqual(
      toolsFor(user).map((t) => t.name),
    );
  });

  it('sends only the tools this caller may use', () => {
    expect(toolSchemas(toolsFor(as(role_enum.VENDOR)))).toEqual([]);
  });
});

describe('resolveProvider', () => {
  it('resolves Zen from the key', () => {
    const p = resolveProvider({ OPENCODE_API_KEY: 'zen-key' });
    expect(p.apiKey).toBe('zen-key');
    expect(p.baseURL).toBe(ZEN_BASE_URL);
    expect(p.model).toBe(DEFAULT_MODEL);
  });

  it('defaults to a free model, so running it costs nothing', () => {
    expect(DEFAULT_MODEL).toMatch(/-free$/);
  });

  it('takes a model override', () => {
    expect(
      resolveProvider({ OPENCODE_API_KEY: 'k', ASSISTANT_MODEL: 'hy3-free' })
        .model,
    ).toBe('hy3-free');
  });

  it('takes a base URL override, for a self-hosted gateway', () => {
    expect(
      resolveProvider({
        OPENCODE_API_KEY: 'k',
        OPENCODE_BASE_URL: 'https://gateway.internal/v1',
      }).baseURL,
    ).toBe('https://gateway.internal/v1');
  });

  it('treats whitespace as unset rather than passing it to the SDK', () => {
    expect(() => resolveProvider({ OPENCODE_API_KEY: '   ' })).toThrow(
      /OPENCODE_API_KEY/,
    );
  });

  it('refuses to boot with no key at all', () => {
    expect(() => resolveProvider({})).toThrow(/OPENCODE_API_KEY/);
  });
});
