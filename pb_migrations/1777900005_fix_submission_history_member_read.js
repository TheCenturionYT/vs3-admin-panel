/// <reference path="../pb_data/types.d.ts" />

// Allow member portal to read submission_history for their faction's nodes.
// Without this, the portal can't fall back to last-cycle outcome after submissions
// are cleared (confirmCycle deletes them), causing the paid badge to show "Unpaid"
// even for nodes that were fully paid.
//
// Rule mirrors the existing nodes/submissions pattern from the Phase 4 migration:
//   member auth (@request.auth.faction) must match the node's owner.
migrate((db) => {
    const dao = new Dao(db);
    const STAFF = '@request.auth.role = "head_admin" || @request.auth.role = "staff"';
    const MEMBER_SCOPED = STAFF + ' || @request.auth.faction = node.owner';

    try {
        const col = dao.findCollectionByNameOrId("submission_history");
        col.listRule = MEMBER_SCOPED;
        col.viewRule = MEMBER_SCOPED;
        dao.saveCollection(col);
        console.log("[migration] Opened submission_history read access to faction members");
    } catch (e) {
        console.error("[migration] Failed to update submission_history rules:", e);
    }
}, (db) => {
    const dao = new Dao(db);
    const STAFF = '@request.auth.role = "head_admin" || @request.auth.role = "staff"';
    try {
        const col = dao.findCollectionByNameOrId("submission_history");
        col.listRule = STAFF;
        col.viewRule = STAFF;
        dao.saveCollection(col);
    } catch (_) {}
});
