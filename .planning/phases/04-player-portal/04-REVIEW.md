---
phase: 04-player-portal
reviewed: 2026-05-02T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - vs3-panel/src/routes/(portal)/+layout.svelte
  - vs3-panel/src/routes/(portal)/+layout.server.ts
  - vs3-panel/src/routes/(portal)/portal/+page.server.ts
  - vs3-panel/src/routes/(portal)/portal/+page.svelte
  - pb_migrations/1746316800_phase4_portal_rules.js
findings:
  critical: 3
  warning: 3
  info: 1
  total: 7
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-05-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Five files implement the Phase 4 Player Portal: layout auth guard, portal data loader, portal UI, and the PocketBase collection-rule migration. The portal architecture is sound — auth is server-side, faction data is scoped by collection rules, and `calcUpkeep` is called correctly. However, three blockers were found: a hardcoded default password in `pb_hooks/seed_hooks.js` (not in scope for this review but visible in the same session), a SQL-injection-equivalent filter construction in the submissions query, and a factions `listRule` overshare that allows any member to enumerate all faction names. Two warnings cover a `getOne` that throws on a non-existent faction leaving the user on a broken layout, and an incorrect null guard that can never fire. One info item covers dead code in the migration.

---

## Critical Issues

### CR-01: Filter injection via string interpolation in submissions query

**File:** `vs3-panel/src/routes/(portal)/portal/+page.server.ts:54`

**Issue:** Node IDs are interpolated directly into a PocketBase filter string using string concatenation:

```ts
const nodeIds = rawNodes.map((n) => `"${n.id}"`).join(',');
allSubmissions = await locals.pb.collection('submissions').getFullList({
  filter: `node in (${nodeIds})`,
  fields: 'node,sp_value'
});
```

PocketBase record IDs are returned by the server and are typically 15-character alphanumeric strings, so in practice this is low-risk today. However, the code pattern is wrong: if a future code path ever inserts adversarial data into `rawNodes` (e.g., from a different query that expands a user-controlled field), the filter string is wide open to injection. More immediately, `rawNodes` comes from `getFullList` which is filtered by `owner = {:factionId}` — but if a bug elsewhere returns records with non-ID `id` values, this could produce malformed filter syntax that crashes the query unexpectedly. The project already uses `filterValues` for the nodes query (line 20-22); the same pattern must be used here.

**Fix:** PocketBase's JS SDK does not natively support `IN` with `filterValues` for a dynamic list, but the safe workaround is to build individual equality conditions:

```ts
// Build filter: node = "id1" || node = "id2" || ...
const nodeFilter = rawNodes
  .map((n, i) => `node = {:nid${i}}`)
  .join(' || ');
const nodeFilterValues = Object.fromEntries(
  rawNodes.map((n, i) => [`nid${i}`, n.id])
);
allSubmissions = await locals.pb.collection('submissions').getFullList({
  filter: nodeFilter,
  filterValues: nodeFilterValues,
  fields: 'node,sp_value'
});
```

---

### CR-02: factions `listRule` exposes all faction names to any authenticated member

**File:** `pb_migrations/1746316800_phase4_portal_rules.js:20`

**Issue:** The factions `listRule` is set to `MEMBER_OR_STAFF`:

```js
col.listRule = MEMBER_OR_STAFF;   // any member can list all factions
col.viewRule = '@request.auth.role = "head_admin" || @request.auth.role = "staff" || @request.auth.faction = id';
```

The `viewRule` correctly scopes a single-record lookup to the member's own faction. But the `listRule` governs `getFullList` / `getList`. Any member who calls `GET /api/collections/factions/records` (directly, not via the SvelteKit portal) will receive the full list of all factions — names, types, colors, and any other fields on the record. The project's `CLAUDE.md` constraint #1 states: "Faction privacy is enforced at the database query level — never by hiding UI elements." Exposing the faction roster to all members via the listRule violates this principle; faction membership and territory are considered sensitive competitive information in a PvP server.

**Fix:** Scope the `listRule` identically to the `viewRule` so that list queries are also restricted to the member's own faction:

```js
col.listRule = '@request.auth.role = "head_admin" || @request.auth.role = "staff" || @request.auth.faction = id';
col.viewRule = '@request.auth.role = "head_admin" || @request.auth.role = "staff" || @request.auth.faction = id';
```

---

### CR-03: Hardcoded default password in seed hook

**File:** `pb_hooks/seed_hooks.js:138`

**Issue:** The Owner staff account is seeded with a hardcoded password:

```js
owner.setPassword("Owner1488");
```

This password is committed to version control in plain text. Even described as a "dev convenience", this account is seeded on every PocketBase startup if the Owner record does not exist — including production deployments on Railway. Any attacker who reads this repository (public or leaked) can immediately log in as `head_admin` on any deployment that has not manually changed the password. This is a credentials-in-source-code vulnerability.

**Fix:** Remove the password from source. Either:
1. Read the initial password from an environment variable (`process.env.OWNER_INITIAL_PASSWORD` or equivalent in PocketBase JSVM via `$os.getenv("OWNER_INITIAL_PASSWORD")`), failing fast if absent.
2. Or remove the auto-seed entirely and require manual account creation via the PocketBase admin UI on first deploy.

```js
const initialPassword = $os.getenv("OWNER_INITIAL_PASSWORD");
if (!initialPassword) {
    console.error("[seed_hooks] OWNER_INITIAL_PASSWORD env var not set — skipping Owner seed.");
} else {
    owner.set("username", "Owner");
    owner.set("role", "head_admin");
    owner.setPassword(initialPassword);
    $app.dao().saveRecord(owner);
}
```

---

## Warnings

### WR-01: `faction` null check after `getOne` is unreachable — real error goes unhandled

**File:** `vs3-panel/src/routes/(portal)/portal/+page.server.ts:38-40`

**Issue:** `locals.pb.collection('factions').getOne(factionId)` (line 17) throws a PocketBase `ClientResponseError` with status 404 if the record does not exist. It never returns `null`. The null check on line 38 can therefore never be true:

```ts
if (!faction) {
  error(500, 'Faction not found');
}
```

The actual failure mode is that a 404 from `getOne` causes the `Promise.all` to reject, propagating an unhandled PocketBase error to the user as a 500 with a raw SDK message rather than a clean `error(500, 'Faction not found')`. The intended guard is correct in intent but wrong in placement — it must be a `try/catch` around the `getOne` call itself, or `getOne` should be replaced with a query that returns null.

**Fix:**

```ts
let faction;
try {
  faction = await locals.pb.collection('factions').getOne(factionId);
} catch {
  error(500, 'Faction not found');
}
```

Then remove the `if (!faction)` check on line 38.

---

### WR-02: Layout falls back to raw `factionId` string in header on faction lookup failure

**File:** `vs3-panel/src/routes/(portal)/+layout.server.ts:21-24`

**Issue:** When the faction `getOne` call fails in the layout loader, the fallback is:

```ts
factionName = factionId;
```

`factionId` is a raw PocketBase record ID (a 15-character opaque alphanumeric string). The layout header displays this value directly as `{data.user.factionName}`. Users will see their faction header replaced with a meaningless string like `abc123xyz789def` rather than an error message. The comment says "portal page.server.ts will error properly" — but it will not, because `page.server.ts` also calls `getOne(factionId)` and that call can throw too (see WR-01). Both callers have the same race to handle a missing or inaccessible faction. The fallback should either be an empty string or a human-readable placeholder like `"Unknown Faction"`.

**Fix:**

```ts
factionName = 'Unknown Faction';
```

---

### WR-03: `effectiveUpkeep` is calculated with `nodeCount` of the full faction, but `base_upkeep` may be 0 for nodes missing the field

**File:** `vs3-panel/src/routes/(portal)/portal/+page.server.ts:83-89`

**Issue:** `calcUpkeep` is called with `(node.base_upkeep as number) ?? 0`. If `base_upkeep` is stored as `0` in the database (a legitimately possible value for newly created nodes without an assigned upkeep), `calcUpkeep` returns `0` because of its early return:

```ts
if (isNeutral || !baseUpkeep) return baseUpkeep;
```

The `!baseUpkeep` guard treats `0` and missing/null as the same case — which is correct by design (a node with no base upkeep has no effective upkeep). However, `requiredSP` is then `0`, and `paymentPct = paidSP / requiredSP` is a division by zero:

```ts
const paymentPct = requiredSP > 0 ? paidSP / requiredSP : 0;
```

The guard `requiredSP > 0` on line 93 correctly avoids the NaN. This is not a crash — but the display result is that a node with `base_upkeep = 0` shows `paidSP / 0 SP` with status `Paid` regardless of actual submissions. This is misleading. More importantly, the `upkeepStatus` for a zero-upkeep node with `paidSP > 0` will show `Paid` (paymentPct = 0 → `Unpaid` branch because `paidSP / 0` returns `0` via the guard). Actually re-reading: `paymentPct = 0` means the `Unpaid` branch fires — a node with `base_upkeep = 0` and any paid SP will appear "Unpaid", which is also wrong.

A node with `base_upkeep = 0` should arguably show a neutral "N/A" status. The current logic renders it incorrectly in both the status badge and the progress bar.

**Fix:** Add an explicit `N/A` branch for zero-required-upkeep nodes:

```ts
let upkeepStatus: 'Paid' | 'Partial' | 'Underfunded' | 'Unpaid' | 'N/A';
if (requiredSP === 0) upkeepStatus = 'N/A';
else if (paymentPct >= 1) upkeepStatus = 'Paid';
// ...
```

Handle the `N/A` case in the Svelte template with an appropriate badge.

---

## Info

### IN-01: Unused `STAFF` constant in migration down() function

**File:** `pb_migrations/1746316800_phase4_portal_rules.js:60`

**Issue:** The `STAFF` constant is declared in the down() revert function but is also declared in the up() function's outer scope (line 14). In the down() function body, the constant is used directly in the loop, so this is not broken. However, the declaration on line 60 shadows the one from up() scope (they are in separate function scopes so there is no actual shadowing), but the duplication is unnecessary and was likely copy-pasted.

**Fix:** No behavioral impact. Cosmetically, the constant declaration on line 14 inside the `migrate(up, down)` up-function is separate from the one on line 60 in the down-function. Both are needed as written since they are in separate closure scopes. No change required — this is documentation noise only.

---

_Reviewed: 2026-05-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
