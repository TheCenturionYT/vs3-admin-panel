# Phase 1: Foundation - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers the structural backbone everything else builds on: PocketBase collections and API rules, SvelteKit scaffold with auth, staff login/logout, role enforcement (Head Admin vs Staff), a Staff Management page for creating and deactivating accounts, the dark gold medieval theme baseline, and a deployment guide that a non-developer can follow to get the app running.

Phase 1 does NOT include: faction/node/war data management (Phase 2), upkeep processing (Phase 3), or the player portal (Phase 4). Those sections of the UI are stubbed/disabled links in the sidebar.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
User is not familiar enough with code to direct implementation choices. All decisions in this phase are left to Claude's judgment. Constraints are captured below from project requirements and research.

### Deployment Path
- **D-01:** Railway is the PRIMARY deployment path. The step-by-step guide targets Railway — it requires only GitHub account, git push, and environment variable configuration in the Railway dashboard. No local command line knowledge required.
- **D-02:** Docker Compose is documented as a SECONDARY path (appendix or separate section of the guide) for users who prefer a VPS. Covers: clone repo, copy `.env`, `docker compose up -d`.
- **D-03:** Both paths share the same repository structure. No platform-specific code — Railway detects SvelteKit and PocketBase via Nixpacks/Dockerfile.

### Auth & Session Handling
- **D-04:** PocketBase superuser (the initial admin of the PocketBase admin UI) is created during first deploy via the Railway dashboard's one-shot CLI command or the PocketBase admin setup flow at `/admin`. This is documented in the deployment guide.
- **D-05:** Staff accounts (`staff` collection: username, password, role field) are created by the Head Admin through a Staff Management page in the SvelteKit app. PocketBase admin UI is used only for the initial superuser setup — day-to-day staff account management happens in the panel UI.
- **D-06:** Faction member accounts (`members` collection: username, password, faction relation) are also created through the Staff Management page by Head Admin or Staff.
- **D-07:** Session tokens use PocketBase SDK defaults (30-day tokens stored in localStorage, auto-refreshed on activity). Staff do not need to re-login daily.
- **D-08:** On session expiry, the app redirects to the login page with a "Session expired" notice.
- **D-09:** Login page is the app root for unauthenticated users — no public landing page. Authenticated users redirect to `/dashboard`.

### App Shell & Navigation
- **D-10:** Left sidebar navigation, persistent on desktop. Minimum viewport width 1024px (no mobile layout).
- **D-11:** Sidebar sections in Phase 1:
  - Dashboard (stub — shows "Phase 2" placeholder)
  - Staff Management (active — create/edit/deactivate staff and member accounts)
  - Server Log (stub — shows "Phase 2" placeholder)
  - Factions / Nodes / Wars / Diplomacy / SP Catalogue / Upkeep / Metrics — all shown as disabled nav items with a "Coming in Phase N" tooltip
- **D-12:** Top bar: current username + role badge (Head Admin / Staff) + logout button.
- **D-13:** The Staff Management page is the only substantive UI in Phase 1. It must demonstrate that role enforcement works: only Head Admin can create/deactivate accounts; Staff sees a read-only list.
- **D-14:** Portal route (`/portal`) exists as a SvelteKit route group separate from the staff app. Phase 1 ships a minimal login page for portal users with "Portal access coming soon" after login. This establishes the route structure for Phase 4.

### Visual Theme Foundation
- **D-15:** Full dark gold medieval theme established in Phase 1 via Tailwind CSS custom properties in `app.css`. All subsequent phases inherit these — do not redefine per-component.
- **D-16:** Palette (matches v1.2.1 reference, elevated):
  - Background primary: `#1a1410` (near-black dark brown)
  - Background secondary: `#231d14` (slightly lighter, for cards/panels)
  - Background tertiary: `#2c2518` (for hover states, inputs)
  - Gold accent: `#c4a45a` (muted medieval gold — primary brand color)
  - Gold hover: `#d4b46a` (lighter on hover)
  - Text primary: `#d4c5a0` (parchment off-white)
  - Text muted: `#8b7d65` (secondary text)
  - Border: `#3d3426` (subtle dark gold border)
  - Danger: `#8b2b2b` (muted red for destructive actions)
  - Success: `#3d6b3d` (muted green for positive states)
- **D-17:** Typography: system sans-serif for body/UI; CSS `font-family` stack prioritizing legible fonts. No custom font download in Phase 1 to keep deployment simple.
- **D-18:** shadcn-svelte components customized to the palette via CSS variable overrides. The component library is initialized in Phase 1 and shared across all subsequent phases.

### PocketBase Schema (Phase 1 Collections)
- **D-19:** Create these collections in Phase 1 (others added in later phases):
  - `staff` — username, password, role (enum: head_admin | staff), lastLogin (datetime), isActive (bool)
  - `members` — username, password, faction (relation → factions), isActive (bool)
  - `factions` — name only in Phase 1 (other fields added in Phase 2). Required to exist so `members.faction` relation is valid.
  - `job_run_log` — type (string), startedAt (datetime), completedAt (datetime), status (string), details (json) — created now so the scheduler health widget in Phase 3 has a table to query
  - `server_log` — type (string), message (text), factionId (relation nullable), nodeId (relation nullable), createdAt (datetime) — created now so the log viewer stub in Phase 1 can reference the real table
- **D-20:** Collection API rules:
  - `staff` list/view: `@request.auth.role = "head_admin" || @request.auth.id = id`
  - `staff` create/update: `@request.auth.role = "head_admin"`
  - `staff` delete: `@request.auth.role = "head_admin"`
  - `members` list/view: `@request.auth.role = "head_admin" || @request.auth.role = "staff"`
  - `members` create/update: `@request.auth.role = "head_admin" || @request.auth.role = "staff"`
  - `members` delete: `@request.auth.role = "head_admin"`

### Scheduler Architecture (Design Only — Implementation in Phase 3)
- **D-21:** Scheduler implementation chosen: **PocketBase JSVM hooks** (`pb_hooks/` directory). PocketBase 0.22.x supports `cronAdd()` in JavaScript hook files, which run server-side within the PocketBase process. No separate cron container or external service required. This is the simplest path for a non-developer deployment.
- **D-22:** Phase 1 creates the `pb_hooks/` directory structure and a placeholder hook file documenting the scheduler's eventual role. Actual deadline processing logic goes in Phase 3.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — project scope, core value, key decisions
- `.planning/REQUIREMENTS.md` — all 56 requirements; Phase 1 scope: AUTH-01–06, DEPLOY-01–03, UX-01–02
- `.planning/ROADMAP.md` — phase goals and success criteria
- `.planning/STATE.md` — key decisions locked, open questions

### Research
- `.planning/research/SUMMARY.md` — recommended stack, critical pitfalls (C1–C6), open questions
- `.planning/research/STACK.md` — PocketBase + SvelteKit rationale, auth architecture, collection rules patterns
- `.planning/research/PITFALLS.md` — critical failure modes to design against from day one

### Reference Implementation
- `Admin Panel/VS3_Panel_1_2_1.html` — v1 reference; Phase 1 needs the visual palette and navigation structure from this file; look at the CSS variables and sidebar structure
- `CLAUDE.md` — authoritative project constraints, auth architecture, critical constraints list

### External Docs
- PocketBase 0.22.x docs: https://pocketbase.io/docs/ — auth collections, API rules, JSVM hooks (`cronAdd`)
- SvelteKit routing docs: https://svelte.dev/docs/kit/routing — route groups, load functions, form actions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — fresh build. The v1.2.1 HTML panel (`Admin Panel/VS3_Panel_1_2_1.html`) is a reference for visual patterns and color palette, NOT code to reuse.

### Established Patterns
- The v1.2.1 panel uses a dark sidebar with gold borders and muted parchment text. Replicate this aesthetic in Tailwind custom properties.
- v1.2.1 uses tab-based navigation within modals. In v2, this becomes route-based navigation.

### Integration Points
- Phase 1 establishes the PocketBase collections that Phase 2 adds fields to. Schema must be additive — no breaking changes in Phase 2.
- Phase 1 establishes the Tailwind palette. All subsequent phase components inherit it without re-defining colors.
- The `job_run_log` and `server_log` collections created in Phase 1 are written by Phase 3's deadline processor.

</code_context>

<specifics>
## Specific Ideas

- The Staff Management page is the proof-of-concept for role enforcement: deleting a staff account must fail for a Staff-role user even if they call the PocketBase API directly (not just UI-hidden). This is tested in Phase 1's success criteria.
- The login page should use the gold medieval aesthetic from day one — not a generic placeholder. It's the first thing the user sees.
- Deployment guide should be written assuming the reader has never used a terminal. Railway steps are: create account → connect GitHub → deploy → set env vars in dashboard → done.

</specifics>

<deferred>
## Deferred Ideas

- Real-time multi-client sync beyond PocketBase SSE subscriptions — Phase 2+ concern
- Granular activity logs per staff account — Phase 2 (LOG-01 scope)
- Faction color picker in Staff Management — Phase 2 when factions are built
- Mobile layout — explicitly out of scope

</deferred>

---

*Phase: 1-Foundation*
*Context gathered: 2026-05-01*
