/// <reference path="../pb_data/types.d.ts" />

// Add 'custom' to submissions.submission_type select field values.
// The 'custom' submission type is supported by the application but was missing
// from the PocketBase schema, causing custom submissions to be rejected by validation.
migrate((db) => {
    const dao = new Dao(db);
    try {
        const col = dao.findCollectionByNameOrId("submissions");
        const field = col.schema.getFieldByName("submission_type");
        if (field && !field.options.values.includes("custom")) {
            field.options = {
                maxSelect: 1,
                values: ["upkeep", "instability_reduction", "repair", "upgrade", "custom"]
            };
            dao.saveCollection(col);
            console.log("[migration] Added 'custom' to submissions.submission_type enum");
        }
    } catch (e) {
        console.error("[migration] Failed to update submission_type enum:", e);
    }
}, (db) => {
    const dao = new Dao(db);
    try {
        const col = dao.findCollectionByNameOrId("submissions");
        const field = col.schema.getFieldByName("submission_type");
        if (field) {
            field.options = {
                maxSelect: 1,
                values: ["upkeep", "instability_reduction", "repair", "upgrade"]
            };
            dao.saveCollection(col);
        }
    } catch (_) {}
});
