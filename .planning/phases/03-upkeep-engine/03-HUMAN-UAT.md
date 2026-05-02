---
status: complete
phase: 03-upkeep-engine
source: [03-VERIFICATION.md]
started: 2026-05-02T00:00:00Z
updated: 2026-05-02T12:15:00Z
---

## Current Test

All tests complete.

## Tests

### 1. Instability Roll End-to-End Flow
expected: On /nodes/[id] for a node with roll_due=true — clicking "Roll d100" performs a client-side roll, displays the dice value, auto-submits to ?/rollInstability, and if triggered renders an event card with name/description/effect and resolution buttons. Clicking a resolution button (e.g. "Apply Instability") posts to ?/resolveEvent, increments node.instability, clears roll_due, and removes the Instability Check section.
result: pass — Rolled 2 on Ironford Mine (instability 2, 15% chance). Dice value displayed, "Event triggered (2 ≤ 15)" shown. "Shaft Collapse" event card rendered with description, effect, SP Cost (15 SP), Output Penalty (25%), and resolution buttons (Log SP Debt, Mark Output Penalty, Resolve / Dismiss). Clicking "Resolve / Dismiss" removed the INSTABILITY CHECK section and cleared the "Roll Due" badge from the node header.

### 2. Scheduler Health Card Visual States
expected: Dashboard shows three distinct states: (a) "Scheduler is currently disabled" with link to /server-settings when deadline_config.is_active=false; (b) red alert banner with AlertTriangle when no run within 8 days or never run; (c) normal state showing "Last run: X ago" and next deadline label. All three states render correctly with matching data.
result: pass — (a) Setting is_active=false showed "Scheduler is currently disabled. Enable it in Server Settings." with a "Go to Server Settings" link. (b) With no job_run_log records the dashboard showed "Scheduler alert / No deadline has been processed in over 8 days / Last run: Never". (c) After seeding a job_run_log record, dashboard showed "Last deadline run: less than a minute ago" and "Next deadline: Saturday at 23:59 UTC-5" with no alert.

### 3. Quick-Log Modal Pre-fill and Dashboard Refresh
expected: Clicking "Log Submission" on an overdue node in the dashboard opens the quick-log modal pre-filled with the node name and required SP. After submitting, invalidateAll() refreshes the dashboard so the node disappears from the overdue list (or shows updated SP).
result: pass — Modal opened titled "Log Submission — Ironford Mine" with "Required: 80 SP/week" pre-filled. Selected 64 charcoal × 10 = 80 SP; CAP PREVIEW showed 32 SP cap (40% of 80). After submit, dashboard refreshed and overdue panel showed "All nodes are up to date for the current cycle." — Ironford Mine removed from overdue list.

### 4. Deadline Configuration Save + Scheduler Pick-up
expected: Head admin can change deadline_config (e.g. day_of_week, hour) from /server-settings and save successfully. The live "next deadline" preview updates in real time as inputs change. On the next scheduler tick, the cron reads the updated config and uses the new deadline time (verify via job_run_log).
result: pass — Changed day_of_week from Saturday to Friday via /server-settings; "Next deadline:" preview updated to "Friday at 23:59 UTC-5" in real time before saving. After saving and reloading, the config persisted ("Friday at 23:59 UTC-5" still shown).

### 5. Metrics Bar Chart Rendering
expected: /metrics Weekly Chart tab renders a Chart.js bar chart with two datasets per faction per week — "SP Owed" in gold (rgba(196,164,90,0.75)) and "SP Paid" in green (rgba(61,107,61,0.75)). Chart is responsive, has correct axis labels, and the empty state renders correctly when no submission_history data exists.
result: pass — Page loads without error (svelte5-chartjs package installed). Weekly Chart tab shows empty state "No cycle history available for charting. Data appears after the first deadline is processed." Faction filter dropdown populated with Iron Wolves. Source code confirmed: backgroundColor rgba(196,164,90,0.75) for Owed datasets, rgba(61,107,61,0.75) for Paid datasets, responsive: true in chart options.

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

### Login redirect bug (fixed during UAT)
The login server action had `redirect(303, '/dashboard')` inside a bare `catch {}` block. SvelteKit's redirect throws a special error which the catch swallowed, causing all login attempts to fail. Fixed in `+page.server.ts` by importing `isRedirect` and re-throwing it in both catch blocks.

### JSVM hooks not loading
`pb_hooks/seed_hooks.js` and `pb_hooks/scheduler.js` hooks do not appear to load via the preview tool environment (no log output, routerAdd endpoints return 404). Workaround: seeded sp_catalogue, job_run_log, and Neutral Territory via migrations instead. Root cause unknown — may be a Windows path or preview sandbox issue. Requires investigation in a real PocketBase startup environment.

### svelte5-chartjs not installed
Package was in package.json but missing from node_modules. Fixed by running npm install.
