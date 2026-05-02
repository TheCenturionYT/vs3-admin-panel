---
status: partial
phase: 04-player-portal
source: [04-VERIFICATION.md]
started: 2026-05-02T00:00:00Z
updated: 2026-05-02T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. PocketBase collection rule enforcement (PORTAL-02 runtime check)
expected: A member querying `/api/collections/nodes/records` directly (without a filter) receives only their own faction's nodes — the migration `1746316800_phase4_portal_rules.js` sets `@request.auth.faction = owner` on the nodes collection. PocketBase must be restarted with the migration applied for this to activate.
result: [pending]

### 2. Portal topbar visual rendering
expected: Navigate to `/portal` as a logged-in member. Topbar shows: gold "VS3 Panel" label (color #c4a45a), vertical separator, faction name (readable string — not a raw 15-char record ID), username on the right, and a Sign Out button. No AppSidebar is rendered.
result: [pending]

### 3. Sign Out flow
expected: Clicking the Sign Out button ends the member session and redirects the browser to `/login`.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
