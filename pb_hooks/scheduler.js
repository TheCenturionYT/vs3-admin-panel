/// <reference path="../pb_data/types.d.ts" />
/**
 * VS3 Admin Panel — Server-Side Scheduler
 * ========================================
 * Phase: 3 — Upkeep Engine & Automation
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
 *   The handler records last_processed_ts on deadline_config to prevent double-applying
 *   instability if the job runs twice after a crash recovery. The stamp is written INSIDE
 *   the transaction so the idempotency gate is atomic with node updates.
 *   See REQUIREMENTS.md UPKEEP-08 for the full idempotency spec.
 *
 * SCHEDULER HEALTH (Phase 3):
 *   Each successful run writes a record to the job_run_log collection:
 *     { type: "upkeep_deadline_processor", status: "completed"|"error", details }
 *   This powers the "Last Run: X ago" dashboard widget and the >8-day alert.
 *   See REQUIREMENTS.md UPKEEP-11 and CLAUDE.md "Scheduler failure must be visible".
 *
 * PHASE 3 IMPLEMENTATION NOTES:
 *   - jsvm_calcUp must remain in sync with vs3-panel/src/lib/upkeep.ts (calcUpkeep).
 *     TypeScript cannot be imported in the JSVM context so the functions are duplicated.
 *   - All database writes inside $app.runInTransaction() use txApp.save(). Writes outside
 *     the transaction (writeJobRunLog, writeServerLog helpers) use $app.dao().saveRecord().
 *   - Neutral Territory nodes are skipped via filter — they have no faction upkeep scaling.
 *   - The cron runs every minute ("* * * * *"). The handler reads deadline_config and
 *     self-determines whether the current deadline has passed and not yet been processed.
 */

// === Inline upkeep calc — verbatim port of vs3-panel/src/lib/upkeep.ts ===
// Keep jsvm_calcUp in sync with vs3-panel/src/lib/upkeep.ts (calcUpkeep).
// Source: v1 Admin Panel/VS3_Panel_1_2_1.html oemul/wmul/calcUp functions.
function jsvm_oemul(n) { return n <= 1 ? 1 : n === 2 ? 1.1 : n === 3 ? 1.2 : n === 4 ? 1.35 : 1.5; }
function jsvm_wmul(w, type) { if (type === 'PvE') return 0; return w === 0 ? 0 : w === 1 ? 0.15 : w === 2 ? 0.3 : 0.5; }
function jsvm_calcUp(baseUpkeep, nodeCount, warCount, factionType, isNeutral) {
    if (isNeutral || !baseUpkeep) return baseUpkeep;
    return Math.ceil(baseUpkeep * jsvm_oemul(nodeCount) * (1 + jsvm_wmul(warCount, factionType)));
}

// === Helpers ===

// writeJobRunLog — records scheduler execution results in the job_run_log collection.
// Used both by the cron handler and the on-demand routerAdd endpoint.
// Uses $app.dao().saveRecord() (old API, consistent with log_hooks.js pattern).
function writeJobRunLog(jobType, status, details) {
    try {
        const col = $app.dao().findCollectionByNameOrId("job_run_log");
        const entry = new Record(col);
        entry.set("type", jobType);
        entry.set("status", status);          // "completed" | "error" | "skipped"
        entry.set("details", String(details || ""));
        $app.dao().saveRecord(entry);
    } catch (err) { console.error("[scheduler] job_run_log write failed:", err); }
}

// writeServerLog — writes a server_log entry for the upkeep deadline processed event.
// Mirrors the helper in log_hooks.js but scoped to scheduler use.
function writeServerLog(eventType, description, relatedFaction, relatedNode) {
    try {
        const col = $app.dao().findCollectionByNameOrId("server_log");
        const entry = new Record(col);
        entry.set("event_type", eventType);
        entry.set("description", description);
        entry.set("actor", "System");
        if (relatedFaction) entry.set("related_faction", relatedFaction);
        if (relatedNode) entry.set("related_node", relatedNode);
        $app.dao().saveRecord(entry);
    } catch (err) { console.error("[scheduler] server_log write failed:", err); }
}

// computeCurrentDeadline — returns the ISO string of the most recent past deadline occurrence.
// All math is performed in UTC. The local deadline hour (H) in timezone offset (O, integer hours)
// converts to UTC hour as ((H - O) + 24) % 24. The function finds the most recent UTC date that
// matches the configured dayOfWeek at the computed utcHour:minute that is <= now.
function computeCurrentDeadline(dayOfWeek, hour, minute, tzOffset) {
    const utcHour = ((hour - tzOffset) % 24 + 24) % 24;
    const now = new Date();
    let dl = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour, minute, 0, 0));
    const dayDiff = (dl.getUTCDay() - dayOfWeek + 7) % 7;
    dl.setUTCDate(dl.getUTCDate() - dayDiff);
    if (dl > now) dl.setUTCDate(dl.getUTCDate() - 7);
    return dl.toISOString();
}

// === Main deadline processor ===
// Reads deadline_config, checks whether the current deadline has passed and not been processed,
// then iterates all non-Neutral nodes and applies upkeep settlement: instability delta,
// submission archival (→ submission_history), submission deletion, roll_due flag, and
// idempotency stamp on deadline_config (INSIDE the transaction).
function processDeadlines() {
    const configs = $app.dao().findRecordsByFilter("deadline_config", "", "", 1, 0);
    if (!configs || configs.length === 0) return { ran: false, reason: "no_config" };
    const cfg = configs[0];
    if (!cfg.getBool("is_active")) return { ran: false, reason: "inactive" };

    const dayOfWeek = cfg.getInt("day_of_week");
    const hour = cfg.getInt("hour");
    const minute = cfg.getInt("minute");
    const tzOffset = cfg.getInt("timezone_offset");
    const deadlineTs = computeCurrentDeadline(dayOfWeek, hour, minute, tzOffset);

    const now = new Date();
    if (now < new Date(deadlineTs)) return { ran: false, reason: "not_yet_due" };

    // Idempotency gate — compare last_processed_ts to the computed current deadline.
    // If they match, the deadline has already been processed for this cycle.
    if (cfg.getString("last_processed_ts") === deadlineTs) {
        return { ran: false, reason: "already_processed" };
    }

    // Resolve Neutral Territory faction ID to exclude its nodes from processing.
    // Neutral Territory has no upkeep scaling (isNeutral path in jsvm_calcUp).
    let neutralId = "";
    try {
        const neutral = $app.dao().findFirstRecordByData("factions", "name", "Neutral Territory");
        neutralId = neutral.getId();
    } catch (_) { /* ok if Neutral Territory faction does not exist */ }

    const filter = neutralId
        ? `owner != "" && owner != "${neutralId}"`
        : `owner != ""`;
    const nodes = $app.dao().findRecordsByFilter("nodes", filter, "", 0, 0);

    let processedCount = 0;

    // All node writes, submission_history creates, and the idempotency stamp are executed
    // in a single transaction. If anything throws, no partial state is committed.
    // Inside the transaction, use txApp.* exclusively (never $app.*).
    $app.runInTransaction((txApp) => {
        for (const node of nodes) {
            const nodeId = node.getId();
            const ownerId = node.getString("owner");

            // Fetch owner faction, all owner nodes, and active wars for upkeep calculation.
            // Effective upkeep is never stored — always recalculated at run time.
            const ownerFaction = txApp.findRecordById("factions", ownerId);
            const ownerNodes = txApp.findRecordsByFilter("nodes", `owner = "${ownerId}"`, "", 0, 0);
            const ownerWars = txApp.findRecordsByFilter(
                "wars",
                `(faction_a = "${ownerId}" || faction_b = "${ownerId}") && status = "active"`,
                "", 0, 0
            );

            const baseUpkeep = node.getInt("base_upkeep");
            const factionType = ownerFaction.getString("type");
            const req = jsvm_calcUp(baseUpkeep, ownerNodes.length, ownerWars.length, factionType, false);

            // Sum paid SP from current cycle submissions for this node.
            const subs = txApp.findRecordsByFilter("submissions", `node = "${nodeId}"`, "", 0, 0);
            let paid = 0;
            const snapshot = [];
            for (const s of subs) {
                paid += s.getInt("sp_value");
                snapshot.push({
                    item_name: s.getString("item_name"),
                    category: s.getString("category"),
                    qty: s.getInt("qty"),
                    sp_value: s.getInt("sp_value")
                });
            }

            // Payment percentage. req=0 edge case: treat as fully paid (no instability).
            const pct = req > 0 ? (paid / req) * 100 : 100;

            // Instability delta per CLAUDE.md and v1 logic:
            //   pct >= 100 → +0 (fully paid)
            //   pct >= 50  → +1 (partial, 50-99%)
            //   else       → +2 (underfunded <50% or completely unpaid 0%)
            let instabDelta;
            if (pct >= 100) instabDelta = 0;
            else if (pct >= 50) instabDelta = 1;
            else instabDelta = 2;

            // Cap instability at 5 (INSTAB_LABEL max).
            const currentInstab = node.getInt("instability");
            const newInstab = Math.min(5, currentInstab + instabDelta);

            // Outcome label for submission_history record.
            let outcome;
            if (pct >= 100) outcome = "paid";
            else if (pct >= 50) outcome = "partial";
            else if (pct > 0) outcome = "underfunded";
            else outcome = "unpaid";

            // Archive current cycle submissions as a snapshot in submission_history.
            const histCol = txApp.findCollectionByNameOrId("submission_history");
            const histRec = new Record(histCol);
            histRec.set("node", nodeId);
            histRec.set("deadline_ts", deadlineTs);
            histRec.set("paid_sp", paid);
            histRec.set("required_sp", req);
            histRec.set("outcome", outcome);
            histRec.set("instab_delta", instabDelta);
            histRec.set("snapshot", JSON.stringify(snapshot));
            txApp.save(histRec);

            // Delete current cycle submissions for this node (cleared after archival).
            for (const s of subs) txApp.delete(s);

            // Update node instability and set roll_due flag.
            // roll_due is set only when instabDelta > 0 AND newInstab > 0 (v1 line 449).
            node.set("instability", newInstab);
            if (instabDelta > 0 && newInstab > 0) node.set("roll_due", true);
            txApp.save(node);

            processedCount++;
        }

        // Stamp the idempotency key INSIDE the transaction so the gate is atomic
        // with the node updates. A second concurrent run sees the stamp and exits.
        cfg.set("last_processed_ts", deadlineTs);
        txApp.save(cfg);
    });

    writeServerLog(
        "upkeep_deadline_processed",
        "Processed " + processedCount + " nodes for deadline " + deadlineTs,
        null,
        null
    );
    return { ran: true, processedCount: processedCount, deadlineTs: deadlineTs };
}

// === Cron registration: every minute ===
// The handler reads deadline_config on each tick and self-determines whether processing is needed.
// Skipped ticks (not_yet_due, already_processed, inactive) do NOT write a job_run_log row
// to avoid flooding the table. Only successful runs and errors are logged.
cronAdd("upkeep_deadline_processor", "* * * * *", function () {
    try {
        const result = processDeadlines();
        if (result.ran) {
            writeJobRunLog(
                "upkeep_deadline_processor",
                "completed",
                "Processed " + result.processedCount + " nodes (deadline " + result.deadlineTs + ")"
            );
        }
    } catch (err) {
        console.error("[scheduler] processDeadlines failed:", err);
        writeJobRunLog("upkeep_deadline_processor", "error", String(err));
    }
});

// === On-demand bulk-process route (UPKEEP-10) ===
// POST /api/vs3/process-deadlines — requires an authenticated staff or head_admin session.
// Calls processDeadlines() once. The idempotency gate makes double-clicks safe.
// Returns the processDeadlines() result object directly so callers can distinguish
// ran=true (work done), ran=false/already_processed (nothing to do), etc.
routerAdd("POST", "/api/vs3/process-deadlines", function (e) {
    try {
        const result = processDeadlines();
        if (result.ran) {
            writeJobRunLog(
                "upkeep_deadline_processor",
                "completed",
                "Manual run: " + result.processedCount + " nodes (deadline " + result.deadlineTs + ")"
            );
        }
        return e.json(200, result);
    } catch (err) {
        console.error("[scheduler] manual processDeadlines failed:", err);
        writeJobRunLog("upkeep_deadline_processor", "error", "Manual: " + String(err));
        return e.json(500, { error: "Processing failed" });
    }
}, $apis.requireAuth());
