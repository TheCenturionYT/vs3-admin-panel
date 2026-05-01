/**
 * VS3 Admin Panel — Server-Side Scheduler
 * ========================================
 * Phase: PLACEHOLDER (Phase 1 establishes structure; Phase 3 implements logic)
 *
 * This file is loaded by PocketBase at startup via the JSVM hooks system.
 * cronAdd() is a global function provided by the PocketBase JSVM runtime.
 * It is NOT available in SvelteKit or any browser context.
 *
 * CRITICAL CONSTRAINTS (enforced by CLAUDE.md):
 *   - Deadline processing MUST run here (server-side), never in SvelteKit.
 *   - SvelteKit-based timers would not survive restarts and cause race conditions
 *     when multiple staff members have the app open simultaneously.
 *   - The actual processing logic (calcUp, procDeadlines, instability) is ported
 *     from Admin Panel/VS3_Panel_1_2_1.html in Phase 3, NOT derived from handbook prose.
 *
 * IDEMPOTENCY REQUIREMENT (Phase 3):
 *   The handler must record a "processed key" (nodeId + deadlineTimestamp) to prevent
 *   double-applying instability if the job runs twice after a crash recovery.
 *   See REQUIREMENTS.md UPKEEP-08 for the full idempotency spec.
 *
 * SCHEDULER HEALTH (Phase 3):
 *   Each run must write a record to the job_run_log collection:
 *     { type: "upkeep_deadline_processor", startedAt, completedAt, status, details }
 *   This powers the "Last Run: X ago" dashboard widget and the >8-day alert.
 *   See REQUIREMENTS.md UPKEEP-11 and CLAUDE.md "Scheduler failure must be visible".
 */

// Register the weekly upkeep deadline processor.
// Cron expression "0 0 * * 0" = every Sunday at 00:00 UTC.
// Phase 3 will replace the placeholder handler with real processing logic.
// The job ID "upkeep_deadline_processor" is stable — changing it would
// register a duplicate job on restart (safe, but avoidable).
cronAdd("upkeep_deadline_processor", "0 0 * * 0", function () {
    // PHASE 3 IMPLEMENTATION GOES HERE.
    // Do NOT implement business logic in Phase 1.
    //
    // Phase 3 tasks:
    //   1. Detect overdue nodes (now > deadline timestamp)
    //   2. Calculate payment% (paid SP / required SP)
    //   3. Apply instability delta (UPKEEP-07 rules)
    //   4. Move current cycle submissions → cycleHistory
    //   5. Set rollDue=true if instability > 0
    //   6. Advance deadline to next occurrence
    //   7. Write to server_log and node history
    //   8. Record processed key (nodeId + deadlineTimestamp) → idempotency
    //   9. Write job_run_log record with status and details

    console.log("[scheduler] upkeep_deadline_processor triggered — Phase 3 implementation pending");
});
