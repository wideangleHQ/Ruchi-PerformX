# Code conventions

What the codebase actually does, not what an ideal codebase would do. Where two
patterns exist, both are listed and the one to prefer is named.

## Backend

### Module shape

A feature module is a directory under `server/src/modules/` containing:

```
feature/
  feature.module.ts
  feature.controller.ts
  feature.service.ts
  dto/
    create-feature.dto.ts
    update-feature.dto.ts
```

The service talks to Prisma directly. There is no repository layer, no
interface, and no dependency injection token. This is the majority pattern and
it is the one to follow for new modules outside VMS.

VMS uses a different shape with `controllers/`, `services/`, `repositories/`,
`entities/`, and injection tokens like `IAccessRepositoryToken`. Follow it if
and only if you are working inside `modules/vms/`.

### Controllers

Guards go on the class, roles go on the method:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('things')
export class ThingsController {
  @Post()
  @Roles(role_enum.MD, role_enum.HOD, ...ASSISTANT_ROLES)
  create(@Body() dto: CreateThingDto, @CurrentUser() user: JwtPayload) {}
}
```

`JwtAuthGuard` and `RolesGuard` are already registered globally in
`app.module.ts`, so the `@UseGuards` line is redundant. It is on most
controllers anyway. Keep it for consistency with the neighbours; it costs
nothing and makes the file readable on its own.

Always use `@CurrentUser()` to get the caller rather than reaching into
`request.user`.

Literal routes must be declared before parameterised ones. `/things/pending`
below `/things/:id` will be shadowed. There is already one instance of this in
`users.controller.ts` that works by accident; do not add a second.

### DTOs

`class-validator` decorators on every field. The global `ValidationPipe` runs
with `forbidNonWhitelisted: true`, so a property that is not on the DTO causes a
400 rather than being stripped. When a frontend form gains a field, the DTO has
to gain it in the same change.

Field casing is not consistent across modules and cannot be made so cheaply. The
Phase 1 modules and `events`, `holidays`, `polls` and `assets` are camelCase.
`leave`, `rnd`, `projects` and the vendor work tables are snake_case, matching
their columns. `vendors` is both: the vendor row is camelCase and the work rows
under it are snake_case.

Do not guess which a module uses. `server/src/common/api-contract.spec.ts` reads
every DTO and every call in `client/src/api`, and fails the build when the two
disagree. It runs in the ordinary `vitest` job.

### Services

Inject `PrismaService`. Throw Nest HTTP exceptions directly:
`BadRequestException`, `ForbiddenException`, `NotFoundException`. Do not return
error objects.

For anything that touches more than one table, use `this.prisma.$transaction`.
For anything that can be double-submitted, put the guard condition in the `where`
clause of the update rather than in an `if` above it:

```ts
where: { id, status: PENDING, generated_task_id: null }
```

That is the pattern in `requests.service.ts` and it is the reason double
approval does not create duplicate tasks.

### Department scoping

Never filter on `users.department_id` alone. Use `DepartmentScopeService` or
`department-query.helper.ts`. Four of the eight roles can belong to more than
one department and the single column does not describe them.

### Soft deletes

`tasks`, `self_actions`, and `users` all use `deleted_at`. Every list query must
filter `deleted_at: null`. The composite indexes are built with `deleted_at` in
them specifically so that this filter is free.

### Audit

State-changing operations on requests and transfers write an `audit_logs` row
inside the same transaction, with `old_value` and `new_value` as JSON strings.
Tasks write to `task_status_logs` instead, and self actions to
`self_action_logs`. Three audit mechanisms for three domains is more than
necessary but it is what exists. Match whichever the module you are in already
uses.

### Naming

Prisma model names are inconsistent by history: older tables are snake_case
plural, newer ones are PascalCase with `@@map`. Do not rename. New tables added
in Phase 2 should follow the snake_case plural style so the majority pattern
wins over time, and should be given an explicit `@@map` only when the Prisma
name has to differ.

The `common/gaurds/` directory is misspelled. Leave it; renaming it touches
every import in the project for no functional gain.

## Frontend

### Data fetching

One file per backend domain in `client/src/api/`, exporting plain async
functions that use the shared axios instance from `client.ts`. Query and
mutation hooks live in `client/src/hooks/` and wrap those functions with
TanStack Query.

Components call hooks. Components do not call `src/api/` functions directly and
do not call axios directly.

### Query keys

Keep them structured and stable, because socket handlers invalidate by key:

```ts
['tasks', filters]
['tasks', taskId]
['self-actions', filters]
```

When a socket event arrives, invalidate the key. Do not write the socket payload
into the cache with `setQueryData`; the socket payload and the REST response are
not guaranteed to have the same shape.

### Route groups

`app/(public)/` and `app/(protected)/` are shells, not URL segments.
`app/vms/` is a third shell with its own navigation. Auth enforcement on the
client is `AuthContext` only; the API is the real gate.

### Forms

`react-hook-form` with `zod` through `@hookform/resolvers`. Shared schemas live
in `client/src/lib/validation.ts` and `taskValidation.ts`. Keep the zod schema
and the backend DTO in agreement, because `forbidNonWhitelisted` turns a
mismatch into a 400 with an unhelpful message.

Where the form field names and the DTO field names differ, map them in one named
function at the submit boundary, the way `VendorForm.toPayload` does, rather
than relying on the two lists happening to match. A cast to the payload type at
the call site hides exactly this mistake from `tsc`, which is how the projects
module shipped unable to write.

### UI

shadcn primitives in `client/components/ui/`, Tailwind v4, `lucide-react` for
icons. Do not hand-roll a dialog, a select, or a table; the primitives are
already there.

## Git

Commit messages in this repository are inconsistent (`Fixed_Bugs_12`,
`Added_Features`, `VMS_FIxes`). Do not copy that. Use conventional commits going
forward:

```
feat(leave): add leave balance calculation
fix(tasks): correct reviewed_at timestamp on close
docs(p2): add projects module spec
```

Scopes that make sense here: `auth`, `tasks`, `self-actions`, `requests`,
`transfers`, `scoring`, `hod-score`, `notifications`, `vms`, `client`, `schema`,
`docs`.

## Things this codebase does not have

Worth knowing so you do not go looking:

No tests. No test runner is configured in either `package.json`.

No linter configuration. The client has a `lint` script pointing at `eslint`
but no config file.

No migrations directory. Schema changes are applied with `prisma db push` and
by hand.

No CI. Nothing runs on push.

No global exception filter or response interceptor on the PerformX API. CareerX
has both.

If Phase 2 has budget for engineering hygiene rather than features, the highest
value item on that list is migrations, because without them there is no safe way
to add the fifteen or so tables Phase 2 needs. See
[Schema changes](p2_data_model.md).
