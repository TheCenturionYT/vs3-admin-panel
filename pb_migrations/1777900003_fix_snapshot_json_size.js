/// <reference path="../pb_data/types.d.ts" />

// Fix submission_history.snapshot JSON field maxSize.
// PocketBase defaults maxSize to 0 when not specified, which means 0 bytes allowed.
// Set to 100000 bytes (100KB) — enough for a full cycle's submission list.
migrate((db) => {
    const dao = new Dao(db);
    try {
        const col = dao.findCollectionByNameOrId("submission_history");
        const field = col.schema.getFieldByName("snapshot");
        if (field) {
            field.options = { maxSize: 100000 };
            dao.saveCollection(col);
            console.log("[migration] Fixed snapshot maxSize to 100000");
        }
    } catch (err) {
        console.error("[migration] Failed to fix snapshot maxSize:", err);
    }
}, (db) => {
    const dao = new Dao(db);
    try {
        const col = dao.findCollectionByNameOrId("submission_history");
        const field = col.schema.getFieldByName("snapshot");
        if (field) {
            field.options = { maxSize: 0 };
            dao.saveCollection(col);
        }
    } catch (_) {}
});
