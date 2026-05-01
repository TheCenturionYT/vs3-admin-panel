# PocketBase Schema Reference — VS3 Admin Panel v2.0.0

**Phase:** 1 (Foundation)
**Last updated:** 2026-05-01
**Status:** Authoritative — all Phase 1 collections defined here

This document is the reference for configuring PocketBase collections via the admin UI.
The deployment guide links here for the schema setup step. Do not modify API rules without
updating this document.

---

## Overview

Phase 1 creates five collections. Two are auth collections (staff, members), three are base collections (factions, job_run_log, server_log).

| Collection | Type | Purpose |
|------------|------|---------|
| staff | Auth | Staff accounts — Head Admin and Staff roles |
| members | Auth | Faction member accounts for the player portal |
| factions | Base | Faction registry — name only in Phase 1 |
| job_run_log | Base | Scheduler health log — written by Phase 3 deadline processor |
| server_log | Base | Append-only event log — written by Phase 2/3 operations |

**IMPORTANT — Rule syntax notes (from PocketBase docs):**
- Rule = `null` → **locked** — only PocketBase superuser (admin) can perform this action. The SvelteKit app, which authenticates as a staff user (not superuser), CANNOT perform it.
- Rule = `""` (empty string) → **anyone** can perform this action, including unauthenticated requests.
- Rule = `"expression"` → only allowed if the filter expression evaluates to true for the current auth context.

Never set create/update/delete rules to empty string `""` on any collection — this would allow unauthenticated writes.

---

## Collection: staff (Auth)

**Purpose:** Staff accounts with username/password login. Two roles: head_admin and staff.

### Fields

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| username | text | yes | — | Unique. Built into PocketBase auth collections. |
| password | password | yes | — | Built into PocketBase auth collections (bcrypt). |
| role | select | yes | staff | Options: `head_admin`, `staff`. Single-value select. |
| lastLogin | datetime | no | null | Updated by a JSVM onRecordAuthRequest hook (Phase 1 includes this hook). |
| isActive | bool | yes | true | Used to deactivate accounts without deleting them. |

### API Rules

| Operation | Rule |
|-----------|------|
| List | `@request.auth.role = "head_admin" \|\| @request.auth.id = id` |
| View | `@request.auth.role = "head_admin" \|\| @request.auth.id = id` |
| Create | `@request.auth.role = "head_admin"` |
| Update | `@request.auth.role = "head_admin"` |
| Delete | `@request.auth.role = "head_admin"` |

**Rule rationale:**
- List/View: A staff user can view their own record (for profile display) but cannot list all staff. Head Admin can list all.
- Create/Update/Delete: Only Head Admin can manage staff accounts. This is the API-level enforcement of AUTH-02.

### Verification

After setting rules, test with a Staff-role token:
- GET /api/collections/staff/records → should return only the requesting user's own record (due to `id = id` filter)
- POST /api/collections/staff/records → should return 403 Forbidden
- DELETE /api/collections/staff/records/{id} → should return 403 Forbidden

---

## Collection: members (Auth)

**Purpose:** Faction member accounts for the player portal (Phase 4). Created and managed by staff via the Staff Management page.

### Fields

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| username | text | yes | — | Unique. Built into PocketBase auth collections. |
| password | password | yes | — | Built into PocketBase auth collections (bcrypt). |
| faction | relation | yes | — | Relation to `factions` collection. Single relation. Required — every member belongs to a faction. |
| isActive | bool | yes | true | Used to deactivate without deleting. |

### API Rules

| Operation | Rule |
|-----------|------|
| List | `@request.auth.role = "head_admin" \|\| @request.auth.role = "staff"` |
| View | `@request.auth.role = "head_admin" \|\| @request.auth.role = "staff"` |
| Create | `@request.auth.role = "head_admin" \|\| @request.auth.role = "staff"` |
| Update | `@request.auth.role = "head_admin" \|\| @request.auth.role = "staff"` |
| Delete | `@request.auth.role = "head_admin"` |

**Rule rationale:**
- List/View/Create/Update: Any staff member (Head Admin or Staff) can manage member accounts.
- Delete: Only Head Admin can permanently delete member accounts. Staff can deactivate (set isActive=false) but not delete.

**Phase 4 addition:** When the player portal is built (Phase 4), add a view rule for members themselves: `@request.auth.collectionName = "members" && @request.auth.id = id`. Do NOT add this in Phase 1 — the portal is a stub.

---

## Collection: factions (Base)

**Purpose:** Faction registry. Phase 1 stores name only. Phase 2 adds type, color, and member roster fields.

### Fields

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| name | text | yes | — | Unique faction name. |

**Phase 2 additions (do not add now):** type (select: PvP/PvE), color (text, hex), notes, etc.

### API Rules

| Operation | Rule |
|-----------|------|
| List | `@request.auth.role = "head_admin" \|\| @request.auth.role = "staff"` |
| View | `@request.auth.role = "head_admin" \|\| @request.auth.role = "staff"` |
| Create | `@request.auth.role = "head_admin"` |
| Update | `@request.auth.role = "head_admin"` |
| Delete | `@request.auth.role = "head_admin"` |

---

## Collection: job_run_log (Base)

**Purpose:** Scheduler health log. Each run of the deadline processor writes one record here. The dashboard widget reads this collection to show "Last run: X ago" and the >8-day alert. Written exclusively by the JSVM scheduler — the SvelteKit app only reads it.

### Fields

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| type | text | yes | — | Job type identifier (e.g. "upkeep_deadline_processor") |
| startedAt | datetime | yes | — | When the job run began |
| completedAt | datetime | no | null | When the job run finished (null if still running or crashed) |
| status | text | yes | — | "success", "error", or "running" |
| details | json | no | null | Structured result data: nodes processed count, errors array, etc. |

### API Rules

| Operation | Rule |
|-----------|------|
| List | `@request.auth.role = "head_admin" \|\| @request.auth.role = "staff"` |
| View | `@request.auth.role = "head_admin" \|\| @request.auth.role = "staff"` |
| Create | `null` (locked — only JSVM hook can write; SvelteKit cannot create records) |
| Update | `null` (locked — only JSVM hook can update; SvelteKit cannot modify records) |
| Delete | `@request.auth.role = "head_admin"` |

**IMPORTANT:** Create and Update rules are `null` (locked to superuser only). The JSVM scheduler hook runs as the PocketBase superuser internally and can write to locked collections. SvelteKit (which authenticates as a staff user) cannot write to this collection — it can only read it. This is intentional.

---

## Collection: server_log (Base)

**Purpose:** Append-only event log for all significant server events. Phase 2 and 3 write to it; Phase 1 creates it so the Server Log stub page can reference the real collection structure.

### Fields

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| type | text | yes | — | Event type (e.g. "upkeep_deadline", "war_declared", "ownership_transfer") |
| message | text | yes | — | Human-readable event description |
| factionId | relation | no | null | Relation to `factions` collection (nullable — some events are not faction-specific) |
| nodeId | text | no | null | Placeholder text field in Phase 1. Changed to relation → nodes in Phase 2 when the nodes collection is created. |
| createdAt | datetime | yes | — | Timestamp of the event |

**Phase 2 change:** nodeId changes from text to a relation → nodes collection. The field is text in Phase 1 only to avoid a dependency on the nodes collection which does not exist yet.

### API Rules

| Operation | Rule |
|-----------|------|
| List | `@request.auth.role = "head_admin" \|\| @request.auth.role = "staff"` |
| View | `@request.auth.role = "head_admin" \|\| @request.auth.role = "staff"` |
| Create | `@request.auth.role = "head_admin" \|\| @request.auth.role = "staff"` |
| Update | `null` (locked — logs are append-only; once written, never edited) |
| Delete | `@request.auth.role = "head_admin"` |

**IMPORTANT:** Update rule is `null` (locked). Server log entries are immutable once written. This is intentional — the log is an audit trail.

---

## Additional JSVM Hook: lastLogin Tracking

The file `pb_hooks/auth_hooks.js` implements AUTH-06. It updates the `lastLogin` field on staff records whenever a staff member authenticates. See that file for implementation details.

---

## Schema Setup Checklist (for Deployment Guide)

In PocketBase admin UI (https://your-pocketbase-url/_/ → Collections tab):

- [ ] Create `staff` as an **Auth** collection
  - [ ] Add field: `role` (select, required, options: head_admin, staff)
  - [ ] Add field: `lastLogin` (datetime, optional)
  - [ ] Add field: `isActive` (bool, default: true)
  - [ ] Set API rules as specified above
- [ ] Create `members` as an **Auth** collection
  - [ ] Add field: `faction` (relation → factions, required, single)
  - [ ] Add field: `isActive` (bool, default: true)
  - [ ] Set API rules as specified above
- [ ] Create `factions` as a **Base** collection
  - [ ] Add field: `name` (text, required, unique)
  - [ ] Set API rules as specified above
- [ ] Create `job_run_log` as a **Base** collection
  - [ ] Add fields: type, startedAt, completedAt, status, details (as specified)
  - [ ] Set API rules (create/update = null/locked)
- [ ] Create `server_log` as a **Base** collection
  - [ ] Add fields: type, message, factionId, nodeId, createdAt (as specified)
  - [ ] Set API rules (update = null/locked)
- [ ] Verify rules are configured correctly (null means locked, not empty string)

---

*Schema Version: Phase 1*
*Next update: Phase 2 (factions fields expansion, nodes collection added, server_log.nodeId converted to relation)*
