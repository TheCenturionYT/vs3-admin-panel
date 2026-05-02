// Temporary UAT test helper — DELETE after testing
// Seeds a job_run_log record on startup so the scheduler health card shows "Last run: X ago"
console.log("[test_helpers] Hook file loaded.");

onAfterBootstrap((e) => {
    try {
        const col = $app.dao().findCollectionByNameOrId("job_run_log");
        // Only seed if no upkeep_deadline_processor run exists
        const existing = $app.dao().findRecordsByFilter(
            "job_run_log", 'type = "upkeep_deadline_processor"', "", 1, 0
        );
        if (!existing || existing.length === 0) {
            const rec = new Record(col);
            rec.set("type", "upkeep_deadline_processor");
            rec.set("status", "success");
            rec.set("details", "UAT test seed");
            $app.dao().saveRecord(rec);
            console.log("[test_helpers] Seeded job_run_log test record, id=" + rec.id);
        } else {
            console.log("[test_helpers] job_run_log already has upkeep run — skip seed.");
        }
    } catch (err) {
        console.error("[test_helpers] Failed to seed job_run_log:", err);
    }
});
