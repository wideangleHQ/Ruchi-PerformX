import { role_enum } from '@prisma/client';
import type OpenAI from 'openai';

import { JwtPayload } from '../../common/types/jwt-payload.type';
import { LeaveService } from '../leave/leave.service';
import { HolidaysService } from '../holidays/holidays.service';
import { TasksService } from '../tasks/tasks.service';
import { ProjectsService } from '../projects/projects.service';
import { VendorsService } from '../vendors/vendors.service';
import { VendorWorkService } from '../vendors/vendor-work.service';
import { RndService } from '../rnd/rnd.service';
import { ScoringService } from '../scoring/scoring.service';
import { HodScoreService } from '../hod-score/hod-score.service';
import { UsersService } from '../users/users.service';
import { DepartmentsService } from '../departments/departments.service';
import { AssetsService } from '../assets/assets.service';
import { SelfActionsService } from '../self-actions/self-actions.service';

/**
 * The tier 1 tool catalog.
 *
 * ```
 *   question
 *      |
 *      v
 *   model picks a tool from THIS user's catalog
 *      |
 *      v
 *   run(args, user, deps)
 *      |  passes the caller's own JwtPayload through
 *      v
 *   LeaveService / ProjectsService / VendorsService ...
 *      |  DepartmentScopeService scopes exactly as it does for the UI
 *      v
 *   rows -> model writes the answer
 *
 *   nothing matches -> the model declines, and the exchange is logged
 * ```
 *
 * Two rules hold this together.
 *
 * **Every tool passes the caller's JwtPayload to a service that already scopes
 * on it.** There is no second authorization model here and there must never be
 * one: `DepartmentScopeService` says in its own header that it is the only
 * place allowed to decide department access. A tool that filtered rows itself
 * would be the second place.
 *
 * **`roles` mirrors the `@Roles` on the controller route the tool wraps.** The
 * services are reached in process, so the controller guard does not run and
 * this list is what stands in for it. `toolsFor` drops tools the caller cannot
 * use before the catalog is sent, so the model never sees a tool it would be
 * refused on, and declines land as prose rather than as a 403.
 *
 * When a route's `@Roles` changes, the matching entry here changes with it.
 * Each tool names its route so that is a grep rather than an audit.
 */

/** Every role except VENDOR, which is what `STAFF_ROLES` and `INTERNAL_ROLES`
 * spell out longhand in four controllers. Derived, so a role added to the enum
 * is internal by default and only a second external role needs a thought. */
export const ALL_INTERNAL: role_enum[] = Object.values(role_enum).filter(
  (role) => role !== role_enum.VENDOR,
);

const APPROVERS = [role_enum.HOD, role_enum.HR, role_enum.MD];
const HR_AND_MD = [role_enum.HR, role_enum.MD];
// GET /self-actions. Narrower than most: no HR, no PURCHASE_HEAD.
const SELF_ACTION_VIEWERS = [
  role_enum.EMPLOYEE,
  role_enum.HOD,
  role_enum.MD,
  role_enum.EA,
  role_enum.PA,
  role_enum.DEPARTMENT_CONTROLLER,
  role_enum.ADMIN,
];

const SCORE_VIEWERS = [
  role_enum.MD,
  role_enum.EA,
  role_enum.PA,
  role_enum.DEPARTMENT_CONTROLLER,
  role_enum.HOD,
];

export interface ToolDeps {
  leave: LeaveService;
  holidays: HolidaysService;
  tasks: TasksService;
  projects: ProjectsService;
  vendors: VendorsService;
  vendorWork: VendorWorkService;
  rnd: RndService;
  scoring: ScoringService;
  hodScore: HodScoreService;
  users: UsersService;
  departments: DepartmentsService;
  assets: AssetsService;
  selfActions: SelfActionsService;
}

/** A JSON Schema object. Called `parameters` on the wire; kept as
 * `input_schema` here because that is what it is. */
export type ToolSchema = {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
};

export interface AssistantTool {
  name: string;
  /** Written for the model, not for a developer. It says when to call the tool,
   * which is the part the model gets wrong, rather than what it returns. */
  description: string;
  input_schema: ToolSchema;
  /** Mirrors the `@Roles` on the route named in the description. */
  roles: role_enum[];
  run(
    args: Record<string, unknown>,
    user: JwtPayload,
    deps: ToolDeps,
  ): Promise<unknown>;
}

// Model-supplied arguments are validated by the schema on the way in, but the
// SDK types them as unknown and Claude occasionally sends a number as a string.
const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};
const NOW = () => new Date();
const thisMonth = () => NOW().getUTCMonth() + 1;
const thisYear = () => NOW().getUTCFullYear();

const NO_ARGS: ToolSchema = { type: 'object', properties: {}, required: [] };

const obj = (
  properties: Record<string, unknown>,
  required: string[] = [],
): ToolSchema => ({ type: 'object', properties, required });

const ID = { type: 'string', description: 'The UUID of the record.' };

export const ASSISTANT_TOOLS: AssistantTool[] = [
  // ------------------------------------------------------------------- leave
  {
    name: 'leave_balance',
    description:
      "The asking user's own leave balance for the current financial year, per leave type, with entitled, used and remaining days. Use for any question about how much leave they have left. Not for anybody else's balance.",
    input_schema: NO_ARGS,
    roles: ALL_INTERNAL, // GET /leave/balance
    run: (_a, user, d) => d.leave.myBalance(user),
  },
  {
    name: 'leave_history',
    description:
      "The asking user's own leave applications, newest first, with dates, type, day count and status. Use for 'when did I take leave', 'has my leave been approved', or their own history over a date range.",
    input_schema: obj({
      from: { type: 'string', description: 'ISO date, inclusive.' },
      to: { type: 'string', description: 'ISO date, inclusive.' },
      status: {
        type: 'string',
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
      },
    }),
    roles: ALL_INTERNAL, // GET /leave/applications/mine
    run: (a, user, d) =>
      d.leave.findMine(user, {
        from: str(a.from),
        to: str(a.to),
        status: str(a.status),
        limit: 50,
      } as never),
  },
  {
    name: 'leave_pending_approvals',
    description:
      'Leave applications waiting for the asking user to approve or reject. Use for "what needs my approval" or "how many leave requests are pending with me". Only returns applications routed to this approver.',
    input_schema: NO_ARGS,
    roles: APPROVERS, // GET /leave/applications/pending
    run: (_a, user, d) => d.leave.findPending(user, { limit: 50 } as never),
  },
  {
    name: 'team_on_leave',
    description:
      'The leave calendar for one month: who is on leave, on which dates, scoped to the departments the asking user can see. Use for "who is off next week", "is anyone on leave on the 14th", or planning around absence. Defaults to the current month.',
    input_schema: obj({
      month: { type: 'integer', description: '1 to 12. Defaults to this month.' },
      year: { type: 'integer', description: 'Defaults to this year.' },
    }),
    roles: ALL_INTERNAL, // GET /leave/calendar
    run: (a, user, d) =>
      d.leave.calendar(
        { month: num(a.month) ?? thisMonth(), year: num(a.year) ?? thisYear() } as never,
        user,
      ),
  },
  {
    name: 'leave_types',
    description:
      'The leave types configured for the company, with entitlement days and whether proof is required. Use when a question depends on what kinds of leave exist, or when a balance answer needs the entitlement behind it. An empty result means HR has not configured leave yet, which is worth saying plainly.',
    input_schema: NO_ARGS,
    roles: ALL_INTERNAL, // GET /leave/types
    run: (_a, user, d) => d.leave.listTypes(user),
  },
  {
    name: 'leave_report_month',
    description:
      'Company-wide leave taken in one month, broken down by person and department. Use for management questions about leave across the company or a department other than the asking user\'s own. Attributes an application to the month it starts in.',
    input_schema: obj({
      month: { type: 'integer', description: '1 to 12. Defaults to this month.' },
      year: { type: 'integer', description: 'Defaults to this year.' },
    }),
    roles: HR_AND_MD, // GET /leave/reports/monthly
    run: (a, _user, d) =>
      d.leave.monthlyReport({
        month: num(a.month) ?? thisMonth(),
        year: num(a.year) ?? thisYear(),
      } as never),
  },
  {
    name: 'leave_balances_all',
    description:
      'Leave balances for every employee, or for one named employee, across all leave types. Use for HR questions about somebody else\'s balance or about balances in aggregate.',
    input_schema: obj({
      user_id: { type: 'string', description: 'Optional. Narrow to one employee.' },
    }),
    roles: [role_enum.HR], // GET /leave/balances
    run: (a, _user, d) =>
      d.leave.listBalances({ user_id: str(a.user_id) } as never),
  },

  // ---------------------------------------------------------------- holidays
  {
    name: 'upcoming_holidays',
    description:
      'The next few company holidays the asking user is entitled to, common and department tier merged. Use for "when is the next holiday" or "is Friday a holiday".',
    input_schema: obj({
      limit: { type: 'integer', description: 'How many to return. Defaults to 5.' },
    }),
    roles: ALL_INTERNAL, // GET /holidays/upcoming
    run: (a, user, d) => d.holidays.findUpcoming(user, num(a.limit) ?? 5),
  },
  {
    name: 'holiday_calendar',
    description:
      'Every holiday for a year that the asking user is entitled to. Use for questions about the holiday list as a whole, or how many holidays fall in a period.',
    input_schema: obj({
      year: { type: 'integer', description: 'Defaults to this year.' },
    }),
    roles: ALL_INTERNAL, // GET /holidays
    run: (a, user, d) => d.holidays.findAll(user, num(a.year) ?? thisYear()),
  },

  // ------------------------------------------------------------------- tasks
  {
    name: 'my_tasks',
    description:
      'Tasks visible to the asking user, filterable by status, priority and title. Use for "what am I working on", "show me high priority tasks", or counting tasks in a state.',
    input_schema: obj({
      status: {
        type: 'string',
        description: 'Task status to filter by, for example IN_PROGRESS.',
      },
      priority: { type: 'string', description: 'For example HIGH.' },
      title: { type: 'string', description: 'Substring match on the title.' },
    }),
    roles: ALL_INTERNAL, // GET /tasks
    run: (a, user, d) =>
      d.tasks.findAll(
        {
          status: str(a.status),
          priority: str(a.priority),
          title: str(a.title),
          limit: 50,
        } as never,
        user,
      ),
  },
  {
    name: 'pending_tasks',
    description:
      'Tasks awaiting the asking user\'s action. Use for "what is waiting on me".',
    input_schema: NO_ARGS,
    roles: ALL_INTERNAL, // GET /tasks/pending
    run: (_a, user, d) => d.tasks.getPending(user),
  },
  {
    name: 'overdue_tasks',
    description:
      'Tasks past their deadline within the asking user\'s scope. Use for "what is overdue", "are we behind", or anything about missed deadlines on tasks.',
    input_schema: NO_ARGS,
    roles: ALL_INTERNAL, // GET /tasks/overdue
    run: (_a, user, d) => d.tasks.getOverdue(user),
  },
  {
    name: 'task_detail',
    description:
      'One task in full, with assignee, status, deadline and history. Use only when you already have a task id from another tool or from the user.',
    input_schema: obj({ id: ID }, ['id']),
    roles: ALL_INTERNAL, // GET /tasks/:id
    run: (a, user, d) => d.tasks.findOne(str(a.id) ?? '', user),
  },

  // ---------------------------------------------------------------- projects
  {
    name: 'project_list',
    description:
      'Projects across the company, filterable by status, health, priority and free text. Use for "how is the Kolkata project doing" (search by name first), "what projects are at risk" (health), or "what is overdue" (overdue true).',
    input_schema: obj({
      search: { type: 'string', description: 'Matches the project title.' },
      status: { type: 'string', description: 'For example ACTIVE or COMPLETED.' },
      health: { type: 'string', description: 'For example ON_TRACK or AT_RISK.' },
      overdue: { type: 'boolean', description: 'True to return only overdue projects.' },
    }),
    roles: ALL_INTERNAL, // GET /projects
    run: (a, user, d) =>
      d.projects.findAll(
        {
          search: str(a.search),
          status: str(a.status),
          health: str(a.health),
          overdue: a.overdue === true ? true : undefined,
          limit: 50,
        } as never,
        user,
      ),
  },
  {
    name: 'my_projects',
    description:
      'Projects the asking user leads or is a member of. Use for "what am I on" or "my projects".',
    input_schema: NO_ARGS,
    roles: ALL_INTERNAL, // GET /projects/mine
    run: (_a, user, d) => d.projects.findMine({ limit: 50 } as never, user),
  },
  {
    name: 'project_detail',
    description:
      'One project in full: lead, co-lead, members, status, health, deadline and closure state. Use after project_list has given you an id, or when the user is looking at a project already.',
    input_schema: obj({ id: ID }, ['id']),
    roles: ALL_INTERNAL, // GET /projects/:id
    run: (a, _user, d) => d.projects.findOne(str(a.id) ?? ''),
  },
  {
    name: 'project_activity',
    description:
      'The activity log for one project, newest first: status changes, leadership changes and deadline moves. Use for "what has happened on this project" or "when did it slip".',
    input_schema: obj({ id: ID }, ['id']),
    roles: ALL_INTERNAL, // GET /projects/:id/activity
    run: (a, _user, d) => d.projects.findActivity(str(a.id) ?? ''),
  },

  // ----------------------------------------------------------------- vendors
  {
    name: 'vendor_list',
    description:
      'The vendor master, filterable by status and category. Use for "who are our vendors", "which vendors are active", or to find a vendor id before another vendor tool.',
    input_schema: obj({
      status: { type: 'string', description: 'For example ACTIVE or PROSPECT.' },
      search: { type: 'string', description: 'Matches the vendor name.' },
    }),
    roles: ALL_INTERNAL, // GET /vendors
    run: (a, user, d) =>
      d.vendors.findAll(
        { status: str(a.status), search: str(a.search), limit: 50 } as never,
        user,
      ),
  },
  {
    name: 'vendor_detail',
    description:
      'One vendor in full: contacts, category, owner, status and notes. Needs a vendor id from vendor_list.',
    input_schema: obj({ id: ID }, ['id']),
    roles: ALL_INTERNAL, // GET /vendors/:id
    run: (a, user, d) => d.vendors.findOne(str(a.id) ?? '', user),
  },
  {
    name: 'vendor_deadlines',
    description:
      'Everything with a date attached for one vendor: contract renewals, document expiry and deliverable deadlines, merged and sorted. Use for "what is coming up with this vendor" or "is anything expiring".',
    input_schema: obj({ vendor_id: ID }, ['vendor_id']),
    roles: ALL_INTERNAL, // GET /vendor-work/deadlines
    run: (a, user, d) => d.vendorWork.findDeadlines(str(a.vendor_id) ?? '', user),
  },
  {
    name: 'vendor_performance',
    description:
      'The performance summary for one vendor: review scores and deliverable timeliness. Use for "how is this vendor doing" or "should we renew".',
    input_schema: obj({ vendor_id: ID }, ['vendor_id']),
    roles: ALL_INTERNAL, // GET /vendor-work/performance
    run: (a, user, d) => d.vendorWork.findPerformance(str(a.vendor_id) ?? '', user),
  },
  {
    name: 'vendor_deliverables',
    description:
      'Deliverables for one vendor with status and due date. Use for "what has this vendor still not delivered". Filter to overdue by passing status PENDING and reading the due dates.',
    input_schema: obj({
      vendor_id: ID,
      status: { type: 'string', description: 'For example PENDING or DELIVERED.' },
    }, ['vendor_id']),
    roles: ALL_INTERNAL, // GET /vendor-work/deliverables
    run: (a, user, d) =>
      d.vendorWork.findDeliverables(
        { vendor_id: str(a.vendor_id), status: str(a.status) } as never,
        user,
      ),
  },
  {
    name: 'vendor_contracts',
    description:
      'Contracts for one vendor with start, end and renewal dates. Use for "when does this contract end" or "which contracts renew this quarter".',
    input_schema: obj({ vendor_id: ID }, ['vendor_id']),
    roles: ALL_INTERNAL, // GET /vendor-work/contracts
    run: (a, user, d) =>
      d.vendorWork.findContracts({ vendor_id: str(a.vendor_id) } as never, user),
  },

  // -------------------------------------------------------- scoring and R&D
  {
    name: 'my_score',
    description:
      "The asking user's own performance score for a month, with the counts behind it. Use for \"how am I doing\" or \"what is my score\". The score is a point total with no maximum, so never present it as a percentage.",
    input_schema: obj({
      month: { type: 'integer', description: '1 to 12. Defaults to this month.' },
      year: { type: 'integer', description: 'Defaults to this year.' },
    }),
    roles: ALL_INTERNAL, // GET /scoring/me
    run: (a, user, d) =>
      d.scoring.getEmployeeScoreSummary(
        user.sub,
        num(a.month) ?? thisMonth(),
        num(a.year) ?? thisYear(),
      ),
  },
  {
    name: 'department_score',
    description:
      'The performance score for one department in a month. Use for "how is Engineering doing" or comparing departments. Point totals, not percentages.',
    input_schema: obj({
      department_id: ID,
      month: { type: 'integer', description: 'Defaults to this month.' },
      year: { type: 'integer', description: 'Defaults to this year.' },
    }, ['department_id']),
    roles: SCORE_VIEWERS, // GET /scoring/department/:departmentId
    run: (a, _user, d) =>
      d.scoring.getDepartmentScore(
        str(a.department_id) ?? '',
        num(a.month) ?? thisMonth(),
        num(a.year) ?? thisYear(),
      ),
  },
  {
    name: 'score_leaderboard',
    description:
      'Employee scores for a month, ranked. Use for "who is scoring highest" or "top performers this month".',
    input_schema: obj({
      month: { type: 'integer', description: 'Defaults to this month.' },
      year: { type: 'integer', description: 'Defaults to this year.' },
    }),
    roles: SCORE_VIEWERS, // GET /scoring/leaderboard
    run: (a, _user, d) =>
      d.scoring.getLeaderboard(
        num(a.month) ?? thisMonth(),
        num(a.year) ?? thisYear(),
      ),
  },
  {
    name: 'hod_scores',
    description:
      'HOD scores across the company for a period, scoped to what the asking user may see. Use for questions about how heads of department are performing.',
    input_schema: NO_ARGS,
    roles: SCORE_VIEWERS, // GET /hod-score/company
    run: (_a, user, d) => d.hodScore.getCompanyScores(user, {} as never),
  },
  {
    name: 'rnd_reports',
    description:
      'R&D and innovation reports the asking user may see. Membership of the R&D team and role both narrow this, so an empty result can mean there is nothing rather than nothing visible. Use for questions about innovation work or R&D submissions.',
    input_schema: NO_ARGS,
    roles: ALL_INTERNAL, // GET /rnd/reports
    run: (_a, user, d) => d.rnd.listReports(user),
  },

  // ----------------------------------------------------------- self actions
  {
    name: 'my_self_actions',
    description:
      "The asking user's own self actions: work they logged themselves, with status, priority and dates. Use for \"what have I been working on\", \"what did I log this month\", or anything about their own record of work outside assigned tasks.",
    input_schema: obj({
      status: {
        type: 'string',
        enum: ['OPEN', 'ONGOING', 'COMPLETED', 'ABORTED'],
      },
      priority: {
        type: 'string',
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      },
      search: { type: 'string', description: 'Matches the title or description.' },
    }),
    roles: SELF_ACTION_VIEWERS, // GET /self-actions?mine=true
    run: (a, user, d) =>
      d.selfActions.findAll(user, {
        mine: true,
        status: str(a.status),
        priority: str(a.priority),
        search: str(a.search),
        limit: 50,
      } as never),
  },
  {
    name: 'department_self_actions',
    description:
      'Self actions across the departments the asking user can see, not just their own. Use for "what is the team working on", "what has Engineering logged", or counting logged work across people. An employee sees only their own, which is the correct scoping rather than an empty result.',
    input_schema: obj({
      status: {
        type: 'string',
        enum: ['OPEN', 'ONGOING', 'COMPLETED', 'ABORTED'],
      },
      priority: {
        type: 'string',
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      },
      search: { type: 'string', description: 'Matches the title or description.' },
    }),
    roles: SELF_ACTION_VIEWERS, // GET /self-actions
    run: (a, user, d) =>
      d.selfActions.findAll(user, {
        mine: false,
        status: str(a.status),
        priority: str(a.priority),
        search: str(a.search),
        limit: 50,
      } as never),
  },

  // ------------------------------------------------------------ org and assets
  {
    name: 'user_lookup',
    description:
      'Find people by looking through the active employee list: name, role, department. Use to resolve a name the user mentioned into an id before another tool, or to answer "who is the HOD of Engineering".',
    input_schema: NO_ARGS,
    roles: ALL_INTERNAL, // GET /users
    run: (_a, _user, d) => d.users.findAll(true),
  },
  {
    name: 'department_members',
    description:
      'Everybody in one department. Use for "who is on the design team" or to get a head count before a per-person calculation.',
    input_schema: obj({ department_id: ID }, ['department_id']),
    roles: ALL_INTERNAL, // GET /users/department/:id
    run: (a, _user, d) => d.users.findByDepartment(str(a.department_id) ?? ''),
  },
  {
    name: 'departments',
    description:
      'The department list with ids. Call this first whenever a question names a department, because every other department-scoped tool needs the id rather than the name.',
    input_schema: NO_ARGS,
    roles: ALL_INTERNAL, // GET /departments
    run: (_a, user, d) => d.departments.findAll(user),
  },
  {
    name: 'asset_lookup',
    description:
      'Company assets and who holds them. Use for "what laptop does Anil have" or "what is still out with someone who left". Never returns stored credentials, only the asset record.',
    input_schema: NO_ARGS,
    roles: ALL_INTERNAL, // GET /assets
    run: (_a, user, d) => d.assets.findAll(user),
  },
];

/**
 * The catalog this user may call.
 *
 * Filtering before the request rather than refusing after it is what makes a
 * refusal read as "I can only show you your own department" instead of a 403.
 * The model cannot ask for a tool it never saw.
 */
export function toolsFor(user: JwtPayload): AssistantTool[] {
  if (user.role === role_enum.VENDOR) return [];
  if (isVmsScoped(user)) return [];
  return ASSISTANT_TOOLS.filter((tool) => tool.roles.includes(user.role));
}

/**
 * Whether this principal is a VMS kiosk token rather than a signed-in employee.
 *
 * `JwtAuthGuard` verifies the main secret first and falls back to the VMS secret
 * on any path outside `/vms/`. A `VmsJwtPayload` carries a real `role`, and
 * `access.service.ts` mints a RECEPTION kiosk as `role_enum.ADMIN`, so a token
 * from the front desk terminal reaches the main API as an admin. The VMS client
 * sends that token to every endpoint while the user is on a `/vms` page, so the
 * fallback is load bearing and cannot simply be deleted: the reception audit
 * screen calls `/audit`, which is missing its `/vms` prefix, and depends on it.
 *
 * That is finding 2.3 in `PHASE2-REMAINING.md`, it predates the assistant, and
 * fixing it properly means changing the guard and shipping the VMS client in the
 * same release. This check is not that fix. It only keeps the assistant, which
 * is new surface, from being one more thing a kiosk token can reach.
 */
function isVmsScoped(user: JwtPayload): boolean {
  return (user as JwtPayload & { scope?: string }).scope === 'vms';
}

export { isVmsScoped };

/**
 * The wire format, in catalog order.
 *
 * OpenCode Zen speaks OpenAI on `/v1/chat/completions`, so a tool goes out as a
 * `function` with its JSON Schema under `parameters`. Order is stable because
 * a shuffled tool list is a needless prompt difference, and on gateways that
 * cache a prefix it is the difference between a hit and a miss.
 */
export function toolSchemas(
  tools: AssistantTool[],
): OpenAI.Chat.Completions.ChatCompletionFunctionTool[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema as Record<string, unknown>,
    },
  }));
}
