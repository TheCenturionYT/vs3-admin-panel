/// <reference path="../pb_data/types.d.ts" />
// Seeds one job_run_log record so the scheduler health card can show "Last run: X ago".
// Idempotent — skips if a record already exists.
migrate((db) => {
    const dao = Dao(db);
    try {
        const existing = dao.findRecordsByFilter(
            "job_run_log", 'type = "upkeep_deadline_processor"', "", 1, 0
        );
        if (existing && existing.length > 0) return;
    } catch (_) {}

    const col = dao.findCollectionByNameOrId("job_run_log");
    const rec = new Record(col);
    rec.set("type", "upkeep_deadline_processor");
    rec.set("status", "success");
    rec.set("details", "UAT seed");
    dao.saveRecord(rec);
}, (db) => {});
