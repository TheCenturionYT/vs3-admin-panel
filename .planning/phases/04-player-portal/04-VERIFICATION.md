---
phase: 04-player-portal
verified: 2026-05-02T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Faction privacy enforcement via direct API call"
    expected: "A logged-in member crafting a direct GET to /api/collections/nodes/records (without any filter) receives ONLY their own faction's nodes — no other faction's nodes appear in the response"
    why_human: "PocketBase collection rule @request.auth.faction = owner is declared in migration code but cannot be confirmed active without a running PocketBase instance. The migration must have been applied (pb restart required) for the rule to be live."
  - test: "Portal topbar renders correctly in browser"
    expected: "Fixed 48px topbar shows 'VS3 Panel' in gold (#c4a45a), vertical separator, faction name, username on right, and Sign Out button. No AppSidebar or staff panel chrome renders."
    why_human: "Visual rendering and layout cannot be confirmed programmatically."
  - test: "Sign Out redirects to /login"
    expected: "Clicking Sign Out in the portal topbar ends the session and redirects to the login page"
    why_human: "Form action /login?/logout behavior requires a live browser session to verify."
---

# Phase 4: Player Portal — Verification Report

**Phase Goal:** Build a faction-scoped read-only Player Portal that lets members view their faction's nodes (with upkeep status) and the global war/alliance board — enforcing faction privacy at the database query level.
**Verified:** 2026-05-02
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A logged-in faction member sees their own faction's nodes with instability level, upkeep status, and cycle payment progress | VERIFIED | `+page.svelte` renders `data.nodes[]` with InstabilityDot, upkeep status badge (4 colors), progress bar, and "[paidSP] / [requiredSP] SP" text. Data fully computed server-side in `+page.server.ts`. |
| 2 | Faction privacy enforced at the database query level — member cannot see other factions' node data even via direct API calls | VERIFIED (code path) / UNCERTAIN (runtime) | Migration `1746316800_phase4_portal_rules.js` sets `listRule/viewRule` on nodes to `@request.auth.faction = owner`. Load function uses `locals.pb` (member token) exclusively. **Requires human verification** that migration was applied and rule is live. |
| 3 | Faction members can view the global war and alliance board — all active wars (parties, casus belli) and active alliances (type, parties) | VERIFIED | `+page.server.ts` queries `wars` and `diplomacy` collections globally (no faction filter). `+page.svelte` renders both in a `sm:grid-cols-2` grid with "War & Alliance Board" heading, "ACTIVE WARS" / "ACTIVE ALLIANCES" sub-labels. |
| 4 | Player portal is fully read-only — no submission, edit, or delete actions available | VERIFIED | Zero `<form>` elements in `+page.svelte` (grep confirms 0 matches). Zero `.create()/.update()/.delete()` calls in any portal route file. Sign-out form is in `+layout.svelte` only (correct). |

**Score:** 4/4 truths verified (1 UNCERTAIN sub-item on runtime enforcement — routes to human verification)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `vs3-panel/src/routes/(portal)/+layout.svelte` | Portal shell topbar, no AppSidebar | VERIFIED | Fixed 48px header (bg #231d14, border #3d3426), "VS3 Panel" in gold (#c4a45a), Separator, factionName, username, sign-out form with Loader2 spinner. AppSidebar: 0 occurrences confirmed. |
| `vs3-panel/src/routes/(portal)/+layout.server.ts` | Auth guard returning user.factionId and user.factionName | VERIFIED | Checks `collectionName === 'members'`, redirects staff to /dashboard, fetches faction name via `locals.pb.collection('factions').getOne(factionId)`, returns `{ user: { id, username, factionId, factionName } }`. |
| `vs3-panel/src/routes/(portal)/portal/+page.server.ts` | Load function: faction, nodes[], wars[], alliances[], calcUpkeep per node | VERIFIED | Promise.all with 4 queries via `locals.pb`; `calcUpkeep()` called per node; paidSP computed from submissions collection; upkeepStatus enum ('Paid'/'Partial'/'Underfunded'/'Unpaid') assigned server-side. |
| `vs3-panel/src/routes/(portal)/portal/+page.svelte` | Full portal page — 2 sections, 120+ lines | VERIFIED | 205 lines. My Faction Nodes section + War & Alliance Board section. No placeholder/stub content. |
| `pb_migrations/1746316800_phase4_portal_rules.js` | PocketBase collection rules enabling member read access | VERIFIED | Updates nodes listRule/viewRule to `@request.auth.faction = owner`; factions viewRule scoped to `@request.auth.faction = id`; wars/diplomacy opened to members; submissions scoped to `@request.auth.faction = node.owner`. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `+layout.server.ts` | `+layout.svelte` | `data.user.factionName` passed as layout data | WIRED | `+layout.svelte` renders `{data.user.factionName}` in topbar (line 19). Layout server returns `factionName` in user object (line 23). |
| `+page.server.ts` | `$lib/upkeep.ts` | `calcUpkeep()` imported and called per node | WIRED | Line 3: `import { calcUpkeep } from '$lib/upkeep'`. Line 83: `calcUpkeep(node.base_upkeep, nodeCount, factionWarCount, faction.type, false)` called inside `rawNodes.map()`. |
| `+page.server.ts` | `locals.pb` | Member-scoped PocketBase client for all queries | WIRED | All 4 parallel queries use `locals.pb.collection(...)`. No admin client referenced anywhere in portal route files. |
| `+page.svelte` | `+page.server.ts` | `let { data } = $props()` consuming nodes[], wars[], alliances[], faction | WIRED | `data.nodes`, `data.wars`, `data.alliances`, `data.faction.name` all referenced in template. |
| `+page.svelte` | `InstabilityDot.svelte` | `import InstabilityDot` + `<InstabilityDot level={node.instability} size="lg" />` | WIRED | Import at line 2; usage at line 91 inside node card loop with correct `size="lg"` prop. InstabilityDot accepts `level: number; size?: 'sm' | 'lg'` — confirmed. |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `+page.svelte` | `data.nodes[]` | `+page.server.ts` → `locals.pb.collection('nodes').getFullList({ filter: 'owner = {:factionId}' })` | Yes — live PocketBase query with faction-scoped filter | FLOWING |
| `+page.svelte` | `data.wars[]` | `+page.server.ts` → `locals.pb.collection('wars').getFullList({ filter: 'status = "active"' })` | Yes — live PocketBase query, global active wars | FLOWING |
| `+page.svelte` | `data.alliances[]` | `+page.server.ts` → `locals.pb.collection('diplomacy').getFullList({ filter: 'status = "active"' })` | Yes — live PocketBase query on `diplomacy` collection (correct schema name) | FLOWING |
| `+page.svelte` | `node.paidSP` | `+page.server.ts` → `locals.pb.collection('submissions').getFullList({ filter: 'node in (...)' })` aggregated per node | Yes — live query summing `sp_value` from submissions | FLOWING |
| `+page.svelte` | `node.requiredSP` / `node.upkeepStatus` | `calcUpkeep()` from `$lib/upkeep.ts` called at load time | Yes — computed from live faction/war state, never stored | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — portal routes require a running PocketBase + browser session; no standalone CLI entry points to test.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PORTAL-01 | 04-01, 04-02 | Faction members see nodes with instability level, upkeep status, cycle payment progress | SATISFIED | `+page.svelte` renders all fields. Server load computes upkeepStatus ('Paid'/'Partial'/'Underfunded'/'Unpaid'), paidSP, requiredSP, instability level per node. |
| PORTAL-02 | 04-01 | Privacy enforced at DB query level — no other faction's data visible even via direct API | SATISFIED (code) | Migration sets node listRule to `@request.auth.faction = owner`. Load uses `locals.pb` (member token). Human verification needed to confirm migration applied. |
| PORTAL-03 | 04-02 | Global war and alliance board visible to all members | SATISFIED | Wars queried globally (no faction filter). Diplomacy queried globally. Both rendered in two-column grid in `+page.svelte`. |
| PORTAL-04 | 04-01, 04-02 | Portal is fully read-only — no write actions available | SATISFIED | Zero `<form>` elements in `+page.svelte`. Zero `.create/.update/.delete` calls in portal route files. |

No orphaned requirements — all 4 PORTAL-* requirements claimed across plans 04-01 and 04-02 are present in REQUIREMENTS.md under Phase 4.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `+page.server.ts` | 56–63 | Submissions fetch wrapped in try/catch with silent fallback to `allSubmissions = []` | Info | Non-fatal: paidSP displays as 0 if submissions query fails. Acceptable for a read display; no data corruption risk. |

No stubs, no TODO comments, no hardcoded placeholder data, no empty state passed to rendering. The `allSubmissions = []` fallback is a non-fatal error handler, not a stub — paidSP gracefully degrades to 0 rather than crashing the portal load.

---

## Schema Deviations — All Self-Corrected

The implementation correctly adapted to the actual Phase 2/3 schema in three places where the plan was aspirational:

1. **Collection name**: Plan used `alliances` — actual schema has `diplomacy` (two-party with `faction_a/faction_b`). Implementation queries `diplomacy` correctly.
2. **Node filter field**: Plan used `filter: 'faction = {:factionId}'` — actual schema uses `owner` as the faction relation on nodes. Implementation uses `filter: 'owner = {:factionId}'` and the migration rule is `@request.auth.faction = owner`. Consistent.
3. **paidSP source**: Plan assumed `node.cycle_paid_sp` field — this field does not exist on nodes. Implementation aggregates from the `submissions` collection, which is the correct source of truth.

These are correct adaptations, not deviations requiring action.

---

## Human Verification Required

### 1. PocketBase Collection Rule Enforcement

**Test:** Log in as a faction member. In browser devtools (Network tab) or using curl with the member auth token, make a direct GET request to `/api/collections/nodes/records` with no filter query parameter.

**Expected:** Response returns only nodes where `owner` matches the logged-in member's faction ID. Nodes from all other factions are absent from the response — not hidden in UI, absent from the API response body.

**Why human:** The PocketBase collection rule `@request.auth.faction = owner` is declared in `pb_migrations/1746316800_phase4_portal_rules.js` but takes effect only after PocketBase restarts and runs the migration. Cannot verify rule is live without a running PocketBase instance.

### 2. Portal Topbar Visual Rendering

**Test:** Navigate to `/portal` as a logged-in faction member in a browser.

**Expected:** Fixed 48px topbar with dark background (#231d14), "VS3 Panel" in gold, vertical separator, faction name (not faction ID), member username on the right, and a Sign Out button. No staff AppSidebar, no staff navigation links, no admin controls.

**Why human:** Layout and visual rendering cannot be confirmed programmatically.

### 3. Sign Out Flow

**Test:** Click Sign Out in the portal topbar.

**Expected:** Session ends, browser redirects to `/login`. Spinner (Loader2) appears on the button during the redirect.

**Why human:** Form submission behavior and session invalidation require a live browser session.

---

## Gaps Summary

No gaps found. All 4 PORTAL requirements have implementation evidence. The 3 human verification items above are all behavioral/visual — they cannot block a code-level PASS but should be confirmed before the portal is considered production-ready.

The only flag of note is that PORTAL-02 (faction privacy) depends on the Phase 4 migration being applied at runtime. The migration file exists and is correctly written, but a developer must confirm PocketBase was restarted to activate it.

---

_Verified: 2026-05-02_
_Verifier: Claude (gsd-verifier)_
