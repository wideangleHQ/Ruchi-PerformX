# Start here

You are reading the engineering handbook for RUCHI PerformX, an internal
platform built for Ruchi Foodline Pvt Ltd. If you have just joined the project,
read this page, then [Local setup](p1_setup.md), then
[Architecture](p1_architecture.md). After that you can jump to whichever module
you have been assigned.

Everything in the Phase 1 section describes code that exists in this repository
right now. Where the code disagrees with the original spec document, this
handbook follows the code and says so. The
[Known gaps](p1_known_gaps.md) page collects those disagreements in one place,
and it is the shortest path to understanding why some things look half finished.

## What the product does

PerformX turns office work into records that can be measured. Instead of tasks
living in WhatsApp threads and email, every piece of work becomes a row with an
owner, a deadline, a status history, and an audit trail.

There are two kinds of work, and keeping them separate is the whole point of
the product:

Assigned work is a task handed down by a superior. It has an assigner, an
assignee, a due date, and a lifecycle that ends in a formal review.

Self-initiated work is something an employee decided to do without being told.
It is recorded as a self action. It has no assigner and no approval step.

A naive system would rank the employee who received ten tasks above the one who
received three but solved eight problems on their own initiative. PerformX
scores both streams so that does not happen.

## The two repositories

This platform is two separate deployments that talk to each other over HTTP.

`Ruchi-PerformX` is the main application. NestJS API plus Next.js client plus a
PostgreSQL database on Supabase. It owns users, departments, tasks, self
actions, scoring, and visitor management. It is the identity provider for the
whole platform.

`CareerX` is the recruitment portal. Same stack, separate database, separate
deploy. It has its own handbook in `CareerX/docs`. It does not have its own
login screen: users sign in to PerformX and exchange that session for a CareerX
session. See [CareerX and VMS integration](p2_integration.md) for how the two
sides connect today and what Phase 2 changes.

## Phase status

Phase 1 is deployed and in use. It covers authentication, role-scoped
dashboards, self actions, the task lifecycle, requests, cross-department
transfers, comments, attachments, in-app and email notifications, Socket.IO
realtime, monthly scoring, a separate HOD scoring engine, and a full visitor
management subsystem.

Phase 2 is scoped but not started. It adds leave management, cross-department
projects, R&D reporting, company asset and password handover, a social layer on
the home dashboard, vendor management with an external vendor portal, a rebuilt
notification engine, and folding CareerX into PerformX as a tab. The plan lives
in [Plan and sequencing](p2_plan.md). The CSR foundation tab was in the original
Phase 2 scope and has already been delivered separately.

Phase 3 is a roadmap only. Microservices, multi-tenancy, and ERP integration.
Nothing in this handbook covers it.

## Vocabulary

You will see these words in code, in tickets, and in conversations with the
client. They do not always mean what you would guess.

**Task** is assigned work. Table `tasks`. Always has `assigned_by_id`.

**Self action** is self-initiated work. Table `self_actions`. Has
`created_by_id` and no assigner.

**Request** is an employee asking for something: budget, transport, help from
another department, or a task reassignment. Table `task_requests`. Approving
some request types generates a real task.

**Transfer** is moving an existing task from one department to another. It needs
the receiving side to accept. Table `task_transfers`.

**Escalation** is the automatic nudge chain when a task goes past its due date:
employee, then HOD, then MD.

**HOD** is Head of Department. **EA** and **PA** are the executive and personal
assistants to the MD, and in this system they carry near-MD visibility.
**MD** is the Managing Director, the top of every approval chain.

**VMS** is the Visitor Management System, the front desk subsystem. It lives
inside the PerformX API under `src/modules/vms` but has its own JWT, its own
login flow, and its own client routes. Treat it as a separate product that
happens to share a process.

## How to read the rest of this book

Each Phase 1 page tells you what the module does, which files implement it,
which tables it touches, and which endpoints it exposes. Each Phase 2 page is a
build spec: the tables to create, the endpoints to add, the screens to build,
and the decisions that are already made so you do not have to relitigate them.

File paths in this book are relative to the repository root. `server/src/...`
is the NestJS API, `client/...` is the Next.js app.
