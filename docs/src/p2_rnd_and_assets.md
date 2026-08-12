# R&D and company assets

Two modules that share a page because both are about restricted visibility. R&D
is invite-only. Assets are self-scoped with three exceptions.

# Innovation and R&D

A supervised, narrower version of projects, for product research. Membership is
by invitation from the MD or EA/PA, and the whole team's output is visible to
those two roles.

## Build it as a variant of projects

The scope document calls R&D "a supervised, simplified version of the Projects
module." Take that literally.

Add two columns to `projects`:

```prisma
is_rnd       Boolean @default(false)
rnd_category String? @db.VarChar(100)
```

An R&D project is a project with `is_rnd = true`. It gets the checklist, the
message thread, the outcome log, and the closure report for free. What changes
is who can see it and who can create it.

Two new tables carry what projects cannot express:

`rnd_team_members` is the company-wide R&D roster, independent of any single
project. A user is on the R&D team or they are not. `user_id` is unique.

`rnd_reports` is the structured research submission: category, product area,
findings, recommendation, supporting data. Definitions in
[Schema changes](p2_data_model.md#rd).

## Rules

**The MD and EA/PA constitute the team.** Only they can add or remove
`rnd_team_members` rows.

**Only team members can submit reports.** Not company wide. This is the one
place in Phase 2 where "employee" is not enough; check membership in the
service.

**The MD and EA/PA see everything.** Every report from every research thread,
immediately on submission.

**Team members see their own thread.** The scope document says a member "views
past R&D submissions within their own research thread for continuity." Read that
as: scoped by `rnd_reports.category`, so a member researching packaging sees the
packaging history but not the pricing history.

**History is retained per category.** Never hard delete an R&D report. There is
no delete endpoint in the list below and that is deliberate.

## Endpoints

Team management:

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/rnd/team` | MD, EA, PA |
| POST | `/rnd/team` | MD, EA, PA |
| DELETE | `/rnd/team/:userId` | MD, EA, PA |
| GET | `/rnd/team/me` | any, returns whether the caller is a member |

`GET /rnd/team/me` is what the client uses to decide whether to render the R&D
nav item at all. Without it the tab shows for everyone and 403s on click, which
looks broken.

Reports:

| Method | Path | Who |
| --- | --- | --- |
| POST | `/rnd/reports` | R&D team members only |
| GET | `/rnd/reports` | MD and EA/PA see all, members see their categories |
| GET | `/rnd/reports/:id` | MD, EA/PA, or the submitter |
| PATCH | `/rnd/reports/:id` | submitter, before MD views it |
| GET | `/rnd/reports/categories` | members and above |

R&D projects use the ordinary project endpoints with an `is_rnd` filter. Add the
membership check to the project service for projects where `is_rnd` is true.

## Screens

**R&D tab, hidden unless the caller is a member or MD/EA/PA.** Gate on
`/rnd/team/me`.

**Submit a report.** Four fields: product or area researched, findings,
recommendation, supporting data. Plus a category selector. Keep it structured;
the value of this module is that reports are comparable, and a single free-text
box destroys that.

**Report history.** Grouped by category, newest first, with the submitter's name
and date.

**MD view.** Everything across every category, with unread reports marked.

# Company assets

Extends the existing passwords idea into tracked company assets with a handover
workflow for offboarding.

## The one thing to get right

Passwords are stored encrypted, never in plaintext, never reversibly-encoded and
called encrypted.

```prisma
secret_cipher String?   // AES-256-GCM ciphertext, base64
secret_iv     String?   @db.VarChar(64)
```

Use Node's built-in `crypto` with AES-256-GCM. A key from an environment
variable, a fresh random IV per record, and the auth tag stored alongside the
ciphertext. No new dependency needed.

```ts
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const KEY = Buffer.from(process.env.ASSET_ENCRYPTION_KEY!, 'base64'); // 32 bytes

export function encrypt(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    cipher: Buffer.concat([enc, tag]).toString('base64'),
    iv: iv.toString('base64'),
  };
}
```

Things that are not encryption and must not be used here: base64 alone, a
reversible XOR, or bcrypt. Bcrypt is one-way; you cannot show the user their
password back, which is the entire feature.

`ASSET_ENCRYPTION_KEY` is a new required environment variable. Add it to the
setup docs when you add it to the code.

Decryption happens only when a caller who is allowed to see the secret asks for
that specific record. Never decrypt in a list endpoint. The list shows labels,
usernames, and URLs; the secret comes from a separate call to
`GET /assets/:id/reveal`, and that call writes an `audit_logs` row every time.

## Visibility

Four rules, in priority order:

1. An employee sees assets where `owner_id` is their own user id. Nothing else.
2. EA, PA, and MD see every asset, company wide.
3. HR sees every asset belonging to one employee, when viewing that employee's
   profile. Not a company-wide list.
4. Vendors see nothing. This module is not exposed to `VENDOR` at all.

Rule 3 is what powers offboarding. HR opens a departing employee's profile and
gets a complete list of what has to be handed over.

Implement these as one method in the service that returns a Prisma `where`
clause based on the caller, and call it from every read. Do not scatter the
branches across endpoints.

## Handover

`asset_handovers` records the transfer of one asset from one user to another.
The flow:

```
HR opens the leaver's profile
        |
        v
Selects assets to transfer, picks the new owner per asset
        |
        v
asset_handovers rows created, completed_at null
        |
        v
New owner confirms receipt        -> completed_at set
company_assets.owner_id rewritten -> in the same transaction
```

Rewriting `owner_id` before the new owner confirms would hide the asset from the
leaver while HR is still working through the list. Rewrite it on confirmation,
inside the transaction that sets `completed_at`.

Notify the new owner when a handover is created and notify HR when it is
confirmed.

## Endpoints

| Method | Path | Who |
| --- | --- | --- |
| GET | `/assets` | own assets, or all for EA/PA/MD |
| POST | `/assets` | any internal user, owner is the caller |
| GET | `/assets/:id` | owner, EA/PA/MD, HR viewing that employee |
| GET | `/assets/:id/reveal` | same, decrypts and audits |
| PATCH | `/assets/:id` | owner, EA/PA/MD |
| DELETE | `/assets/:id` | owner, EA/PA/MD, soft delete |
| GET | `/assets/employee/:userId` | EA, PA, MD, HR |
| POST | `/assets/handovers` | HR, EA, PA, MD |
| GET | `/assets/handovers/pending` | the receiving user |
| PATCH | `/assets/handovers/:id/confirm` | the receiving user |

Documents are a separate `asset_type` on the same table, with `file_url` and
`storage_path` pointing at Supabase instead of a `secret_cipher`. Reuse the
existing upload path from the attachments module rather than writing a second
uploader.

## Screens

**My assets.** A list with the label, type, username, and URL. The secret is
masked with a reveal button that calls `/reveal` and audits. Copy to clipboard
without displaying is better than displaying, if you have the time.

**Employee assets.** For HR, EA, PA, MD. Same list, scoped to one employee,
reached from that employee's profile.

**Handover.** For HR during offboarding. The leaver's full asset list with a
new-owner picker per row and a single submit. Show progress: how many handed
over, how many confirmed, how many outstanding.

**Pending handovers.** For the receiving employee. Confirm receipt, one row at a
time or in bulk.

## Audit

Every reveal, every create, every edit, every handover step writes an
`audit_logs` row. This module holds the company's credentials; the log is what
answers "who saw the bank portal password and when."

`audit_logs.entity` should be `'company_asset'` or `'asset_handover'`, and
`new_value` must never contain the plaintext secret. Log the fact of the access,
not the contents.
