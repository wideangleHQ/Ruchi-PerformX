import { describe, it, expect } from 'vitest';
import { role_enum } from '@prisma/client';

import {
  ALL_INTERNAL,
  ASSISTANT_TOOLS,
  isVmsScoped,
  toolSchemas,
  toolsFor,
} from './assistant-tools';
import {
  DEFAULT_MODEL,
  ZEN_BASE_URL,
  assertSupportedModel,
  resolveProvider,
} from './assistant.config';

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

// Zen serves an Anthropic-compatible /v1/messages with x-api-key, so the same
// SDK reaches either gateway. That equivalence is only true for the Claude and
// Qwen families; everything else on Zen is OpenAI-shaped on /chat/completions.
// These cover the resolution order and the refusal, because the failure they
// prevent is a 400 in the middle of a streamed answer.
describe('resolveProvider', () => {
  it('prefers OpenCode Zen when its key is set', () => {
    const p = resolveProvider({
      OPENCODE_API_KEY: 'zen-key',
      ANTHROPIC_API_KEY: 'sk-ant-key',
    });
    expect(p.name).toBe('opencode-zen');
    expect(p.apiKey).toBe('zen-key');
    expect(p.baseURL).toBe(ZEN_BASE_URL);
  });

  it('falls back to Anthropic with no base URL, so the SDK uses its own', () => {
    const p = resolveProvider({ ANTHROPIC_API_KEY: 'sk-ant-key' });
    expect(p.name).toBe('anthropic');
    expect(p.baseURL).toBeUndefined();
  });

  it('defaults the model on either gateway', () => {
    expect(resolveProvider({ OPENCODE_API_KEY: 'k' }).model).toBe(DEFAULT_MODEL);
    expect(resolveProvider({ ANTHROPIC_API_KEY: 'k' }).model).toBe(DEFAULT_MODEL);
  });

  it('takes an override', () => {
    const p = resolveProvider({
      OPENCODE_API_KEY: 'k',
      ASSISTANT_MODEL: 'claude-sonnet-5',
    });
    expect(p.model).toBe('claude-sonnet-5');
  });

  it('treats whitespace as unset rather than passing it to the SDK', () => {
    expect(() => resolveProvider({ OPENCODE_API_KEY: '   ' })).toThrow(
      /needs a key/,
    );
  });

  it('names both keys when neither is set', () => {
    expect(() => resolveProvider({})).toThrow(/OPENCODE_API_KEY/);
    expect(() => resolveProvider({})).toThrow(/ANTHROPIC_API_KEY/);
  });
});

describe('assertSupportedModel', () => {
  it.each(['claude-haiku-4-5', 'claude-sonnet-5', 'qwen3.6-plus'])(
    'accepts %s, which Zen serves over /v1/messages',
    (model) => {
      expect(assertSupportedModel(model)).toBe(model);
    },
  );

  it.each([
    'minimax-m2.5',
    'glm-5.2',
    'kimi-k3',
    'deepseek-v4-flash-free',
    'gpt-5.5',
  ])('refuses %s, which is OpenAI-shaped on Zen', (model) => {
    expect(() => assertSupportedModel(model)).toThrow(/chat\/completions/);
  });

  it('refuses the opencode/ config prefix, since the API takes a bare id', () => {
    expect(() => assertSupportedModel('opencode/claude-haiku-4-5')).toThrow();
  });
});
