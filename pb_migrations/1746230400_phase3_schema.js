/// <reference path="../pb_data/types.d.ts" />

// Phase 3: Upkeep Engine & Automation schema migration
// Creates: submissions, submission_history, deadline_config, instability_rolls, job_run_log (if absent)
// Seeds:   deadline_config default row (Saturday 23:59 UTC-5, is_active=true)
migrate((db) => {
    const dao = new Dao(db);
    const STAFF = '@request.auth.role = "head_admin" || @request.auth.role = "staff"';
    const ADMIN = '@request.auth.role = "head_admin"';

    function exists(name) {
        try { dao.findCollectionByNameOrId(name); return true; } catch (_) { return false; }
    }

    const nodesId       = dao.findCollectionByNameOrId("nodes").id;
    const spCatalogueId = dao.findCollectionByNameOrId("sp_catalogue").id;
    const staffId       = dao.findCollectionByNameOrId("staff").id;

    // ── 3-1. submissions ─────────────────────────────────────────────────
    if (!exists("submissions")) {
        dao.saveCollection(new Collection({
            name: "submissions", type: "base",
            schema: [
                { name: "node",            type: "relation", required: true,
                  options: { collectionId: nodesId, maxSelect: 1, cascadeDelete: false } },
                { name: "item",            type: "relation",
                  options: { collectionId: spCatalogueId, maxSelect: 1, cascadeDelete: false } },
                { name: "item_name",       type: "text" },
                { name: "category",        type: "text" },
                { name: "qty",             type: "number" },
                { name: "sp_value",        type: "number" },
                { name: "submission_type", type: "select", required: true,
                  options: { maxSelect: 1, values: ["upkeep","instability_reduction","repair","upgrade"] } },
                { name: "staff_note",      type: "text" },
                { name: "submitted_by",    type: "relation",
                  options: { collectionId: staffId, maxSelect: 1, cascadeDelete: false } }
            ],
            listRule:   STAFF,
            viewRule:   STAFF,
            createRule: STAFF,
            updateRule: STAFF,
            deleteRule: STAFF
        }));
    }

    // ── 3-2. submission_history ──────────────────────────────────────────
    if (!exists("submission_history")) {
        dao.saveCollection(new Collection({
            name: "submission_history", type: "base",
            schema: [
                { name: "node",        type: "relation", required: true,
                  options: { collectionId: nodesId, maxSelect: 1, cascadeDelete: false } },
                { name: "deadline_ts", type: "date" },
                { name: "paid_sp",     type: "number" },
                { name: "required_sp", type: "number" },
                { name: "outcome",     type: "select",
                  options: { maxSelect: 1, values: ["paid","partial","underfunded","unpaid"] } },
                { name: "instab_delta", type: "number" },
                { name: "snapshot",    type: "json" }
            ],
            listRule:   STAFF,
            viewRule:   STAFF,
            createRule: null,
            updateRule: null,
            deleteRule: ADMIN
        }));
    }

    // ── 3-3. deadline_config ─────────────────────────────────────────────
    if (!exists("deadline_config")) {
        dao.saveCollection(new Collection({
            name: "deadline_config", type: "base",
            schema: [
                { name: "day_of_week",      type: "number" },
                { name: "hour",             type: "number" },
                { name: "minute",           type: "number" },
                { name: "timezone_offset",  type: "number" },
                { name: "is_active",        type: "bool" },
                { name: "last_processed_ts", type: "text" }
            ],
            listRule:   STAFF,
            viewRule:   STAFF,
            createRule: ADMIN,
            updateRule: ADMIN,
            deleteRule: null
        }));
    }

    // ── 3-4. instability_rolls ───────────────────────────────────────────
    if (!exists("instability_rolls")) {
        dao.saveCollection(new Collection({
            name: "instability_rolls", type: "base",
            schema: [
                { name: "node",            type: "relation", required: true,
                  options: { collectionId: nodesId, maxSelect: 1, cascadeDelete: false } },
                { name: "roll",            type: "number" },
                { name: "threshold",       type: "number" },
                { name: "triggered",       type: "bool" },
                { name: "event_name",      type: "text" },
                { name: "event_desc",      type: "text" },
                { name: "event_effect",    type: "text" },
                { name: "sp_cost",         type: "number" },
                { name: "instab_add",      type: "number" },
                { name: "output_penalty",  type: "number" },
                { name: "is_choice",       type: "bool" },
                { name: "is_rp",           type: "bool" },
                { name: "resolved",        type: "bool" },
                { name: "resolved_action", type: "select",
                  options: { maxSelect: 1, values: ["apply_instability","log_sp_debt","mark_output_penalty","mark_rp_handled","dismiss"] } },
                { name: "staff_note",      type: "text" }
            ],
            listRule:   STAFF,
            viewRule:   STAFF,
            createRule: STAFF,
            updateRule: STAFF,
            deleteRule: ADMIN
        }));
    }

    // ── 3-5. job_run_log ─────────────────────────────────────────────────
    // Note: job_run_log was created in Phase 2 migration (P1-4) with additional
    // fields (startedAt, completedAt). The exists() guard will skip creation if
    // it already exists. This block handles fresh installs where Phase 3 runs first.
    if (!exists("job_run_log")) {
        dao.saveCollection(new Collection({
            name: "job_run_log", type: "base",
            schema: [
                { name: "type",    type: "text", required: true },
                { name: "status",  type: "text", required: true },
                { name: "details", type: "text" }
            ],
            listRule:   STAFF,
            viewRule:   STAFF,
            createRule: null,
            updateRule: null,
            deleteRule: ADMIN
        }));
    }

    // ── 3-6. Seed default deadline_config row ────────────────────────────
    const cfgCol = dao.findCollectionByNameOrId("deadline_config");
    const existing = dao.findRecordsByFilter("deadline_config", "id != ''", "", 1, 0);
    if (!existing || existing.length === 0) {
        const rec = new Record(cfgCol);
        rec.set("day_of_week", 6);
        rec.set("hour", 23);
        rec.set("minute", 59);
        rec.set("timezone_offset", -5);
        rec.set("is_active", true);
        rec.set("last_processed_ts", "");
        dao.saveRecord(rec);
    }

}, (db) => {
    const dao = new Dao(db);
    // Drop Phase 3 collections in reverse dependency order.
    // job_run_log is owned by the Phase 2 migration — do NOT drop it here.
    for (const name of [
        "instability_rolls",
        "deadline_config",
        "submission_history",
        "submissions"
        // job_run_log is owned by the Phase 2 migration — do NOT drop it here
    ]) {
        try { dao.deleteCollection(dao.findCollectionByNameOrId(name)); } catch (_) {}
    }
});
