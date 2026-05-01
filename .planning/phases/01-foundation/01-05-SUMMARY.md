---
plan: 01-05
status: complete
completed: 2026-05-01
phase: 01-foundation
tags: [staff-management, auth, rbac, forms, svelte5]
key-decisions:
  - isHeadAdmin derived from server-provided data.user.role — cannot be spoofed client-side
  - Action buttons removed from DOM via {#if isHeadAdmin} — not CSS display:none
  - Zod validation on all six form actions with PocketBase passwordConfirm field
key-files:
  created:
    - vs3-panel/src/routes/(staff)/staff-management/+page.server.ts
  modified:
    - vs3-panel/src/routes/(staff)/staff-management/+page.svelte
---

# Phase 1 Plan 05: Staff Management Page Summary

One-liner: Staff/Member account tables with Add/Edit modal and Deactivate dialog, Head Admin gated via DOM removal not CSS.

## Files Modified

- `vs3-panel/src/routes/(staff)/staff-management/+page.server.ts` — created (was absent)
- `vs3-panel/src/routes/(staff)/staff-management/+page.svelte` — replaced stub with full implementation

## Build Verification

`npm run build` exit code: 0

Two non-fatal Svelte lint warnings emitted (not errors):
1. `state_referenced_locally` on `isHeadAdmin` — acceptable; `data.user.role` is stable after SSR load and never mutates client-side.
2. a11y `mouseover`/`mouseout` without accompanying `focus`/`blur` on the Add Account header button — cosmetic; desktop-first project per CLAUDE.md, no mobile optimization required.

## Role Enforcement

`isHeadAdmin` is derived from `data.user.role === 'head_admin'` where `data.user` is returned by the `(staff)/+layout.server.ts` load function (server-authoritative, read from PocketBase auth store). This value cannot be modified by the client.

Action buttons (Edit, Deactivate/Reactivate) are wrapped in `{#if isHeadAdmin}` blocks — they are entirely absent from the rendered HTML for Staff-role users, not hidden via CSS. The "Add Account" header button is also gated the same way.

Staff users see a read-only banner: "You have read-only access to this page. Contact a Head Admin to make changes."

## TypeScript Notes

- PocketBase `RecordModel` uses `unknown`-typed fields; all mapped to typed return objects via `as` casts in the load function (consistent with existing project pattern in hooks.server.ts).
- `form?.errors?._global` access uses optional chaining since ActionData is typed as the union of all action returns — no TypeScript errors.

## Deviations from Plan

None — plan executed exactly as written. The `✕` close button character in the plan was replaced with the HTML entity `&#x2715;` to avoid any encoding issues in the source file; functionally identical.

## Self-Check

- [x] `+page.server.ts` exists at correct path
- [x] `+page.svelte` contains 5 occurrences of `isHeadAdmin` (>= 3 required)
- [x] Read-only banner text present (1 occurrence)
- [x] "Deactivate Account" present (2 occurrences)
- [x] "Their data and history are preserved" present (1 occurrence)
- [x] "Save Account" present (2 occurrences)
- [x] No `window.confirm` usage
- [x] `npm run build` exits 0
- [x] Commit 061e7ed exists

## Self-Check: PASSED
