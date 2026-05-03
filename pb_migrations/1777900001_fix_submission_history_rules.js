/// <reference path="../pb_data/types.d.ts" />

// Fix submission_history collection rules.
// createRule was null (PocketBase superadmin only), blocking staff from running confirmCycle.
migrate((db) => {
    const dao = new Dao(db);
    const STAFF = '@request.auth.role = "head_admin" || @request.auth.role = "staff"';
    const ADMIN = '@request.auth.role = "head_admin"';
    try {
        const col = dao.findCollectionByNameOrId("submission_history");
        col.createRule = STAFF;
        col.updateRule = ADMIN;
        dao.saveCollection(col);
    } catch (_) {}
}, (db) => {
    const dao = new Dao(db);
    try {
        const col = dao.findCollectionByNameOrId("submission_history");
        col.createRule = null;
        col.updateRule = null;
        dao.saveCollection(col);
    } catch (_) {}
});
