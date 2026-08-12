# CSR foundation

A dedicated tab for the Ruchi Prativa Foundation, the company's CSR arm. The
smallest module in Phase 2 at ₹8,000, and the most straightforward: two tables,
CRUD, and a gallery.

The purpose is projection. The client wants CSR work to have a professional
presence inside the platform rather than living in a folder somewhere, and
wants the media collected in a form that can later feed the website and annual
reports.

## Tables

`csr_initiatives` and `csr_media`. Definitions in
[Schema changes](p2_data_model.md#csr).

An initiative has a title, description, goal, beneficiaries, outcome, a date
range, and an amount spent. Media rows attach photos to an initiative.

`amount_spent` is `Decimal(12,2)`. CSR spending is reported to regulators
annually, so the number needs to be exact, not a float.

## Rules

**Everyone can read.** Every employee sees the CSR tab and every initiative.
That is the point of putting it in the platform.

**A small group can write.** MD, EA, PA, and whoever the client designates as
the CSR coordinator. Not company wide.

**Nothing is hard deleted.** `deleted_at` on initiatives. CSR records feed
year-on-year reporting and a deleted year is a problem at audit time.

**Media is stored in Supabase.** Reuse the existing storage service and add a
`csr/` prefix, or a dedicated bucket if the client wants CSR media served
publicly later. A dedicated bucket is the better call if there is any chance the
photos end up on the public website, because bucket-level access policies are
easier to reason about than path-level ones.

## Endpoints

| Method | Path | Who |
| --- | --- | --- |
| GET | `/csr/initiatives` | all authenticated internal users |
| GET | `/csr/initiatives/:id` | all internal users |
| POST | `/csr/initiatives` | MD, EA, PA, CSR coordinator |
| PATCH | `/csr/initiatives/:id` | MD, EA, PA, CSR coordinator |
| DELETE | `/csr/initiatives/:id` | MD, EA, PA, soft delete |
| POST | `/csr/initiatives/:id/media` | MD, EA, PA, CSR coordinator |
| DELETE | `/csr/media/:id` | MD, EA, PA, CSR coordinator |
| GET | `/csr/summary` | all internal users |

Vendors do not get this tab.

`GET /csr/summary` returns the year-on-year aggregate: initiative count, total
spend, and beneficiary count per year. That is the view the MD wants and the
one that eventually goes into a report.

## Screens

**CSR landing.** The Foundation's mission at the top, then active initiatives as
cards with a photo, title, and progress. Completed initiatives below.

**Initiative detail.** Goal, beneficiaries, outcome, spend, date range, and the
photo gallery.

**Gallery.** A grid across all initiatives, filterable by initiative and by
year. This is the view that gets used when somebody needs a photo for the
website.

**Editor.** For the writing roles. Nothing unusual, but the outcome and
beneficiaries fields should be prominent rather than buried at the bottom of a
long form, because they are what the annual report needs and they are the fields
people skip.

## Scope discipline

The temptation here is to build a small CMS: rich text, drafts, scheduled
publishing, tagging, and public sharing. None of that is asked for. The scope
document describes a landing tab, an initiative tracker, a media gallery, and
contribution logging for year-on-year reporting.

Build those four things. At ₹8,000 in a month with six other modules, this one
earns its budget by being finished quickly and looking good, not by being
extensible.

If the client later asks for public-facing CSR pages, that is a website job for
`vyrox-landing` or whatever hosts the marketing site, reading from this API. It
is not a reason to build a publishing workflow now.
