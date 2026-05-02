---
status: partial
phase: 03-upkeep-engine
source: [03-VERIFICATION.md]
started: 2026-05-02T00:00:00Z
updated: 2026-05-02T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Instability Roll End-to-End Flow
expected: On /nodes/[id] for a node with roll_due=true — clicking "Roll d100" performs a client-side roll, displays the dice value, auto-submits to ?/rollInstability, and if triggered renders an event card with name/description/effect and resolution buttons. Clicking a resolution button (e.g. "Apply Instability") posts to ?/resolveEvent, increments node.instability, clears roll_due, and removes the Instability Check section.
result: [pending]

### 2. Scheduler Health Card Visual States
expected: Dashboard shows three distinct states: (a) "Scheduler is currently disabled" with link to /server-settings when deadline_config.is_active=false; (b) red alert banner with AlertTriangle when no run within 8 days or never run; (c) normal state showing "Last run: X ago" and next deadline label. All three states render correctly with matching data.
result: [pending]

### 3. Quick-Log Modal Pre-fill and Dashboard Refresh
expected: Clicking "Log Submission" on an overdue node in the dashboard opens the quick-log modal pre-filled with the node name and required SP. After submitting, invalidateAll() refreshes the dashboard so the node disappears from the overdue list (or shows updated SP).
result: [pending]

### 4. Deadline Configuration Save + Scheduler Pick-up
expected: Head admin can change deadline_config (e.g. day_of_week, hour) from /server-settings and save successfully. The live "next deadline" preview updates in real time as inputs change. On the next scheduler tick, the cron reads the updated config and uses the new deadline time (verify via job_run_log).
result: [pending]

### 5. Metrics Bar Chart Rendering
expected: /metrics Weekly Chart tab renders a Chart.js bar chart with two datasets per faction per week — "SP Owed" in gold (rgba(196,164,90,0.75)) and "SP Paid" in green (rgba(61,107,61,0.75)). Chart is responsive, has correct axis labels, and the empty state renders correctly when no submission_history data exists.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
