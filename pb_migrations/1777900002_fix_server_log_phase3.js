/// <reference path="../pb_data/types.d.ts" />

// Fix server_log for Phase 3 confirmCycle compatibility:
// 1. Add cycle_confirmed, instability_event, upkeep_payment to event_type select values
// 2. Add related_node relation field (nodes collection)
// 3. Open createRule from ADMIN → STAFF so all staff can write log entries
migrate((db) => {
    const dao = new Dao(db);
    const STAFF = '@request.auth.role = "head_admin" || @request.auth.role = "staff"';

    try {
        const nodesId = dao.findCollectionByNameOrId("nodes").id;
        const col = dao.findCollectionByNameOrId("server_log");

        // Expand event_type select to include Phase 3 types
        const eventTypeField = col.schema.getFieldByName("event_type");
        if (eventTypeField) {
            eventTypeField.options = {
                maxSelect: 1,
                values: [
                    "faction_change", "node_change", "war_event",
                    "diplomacy_event", "ownership_transfer", "manual_entry",
                    "cycle_confirmed", "instability_event", "upkeep_payment"
                ]
            };
        }

        // Add related_node relation field if not already present
        if (!col.schema.getFieldByName("related_node")) {
            col.schema.addField(new SchemaField({
                name: "related_node",
                type: "relation",
                options: { collectionId: nodesId, maxSelect: 1, cascadeDelete: false }
            }));
        }

        // Allow all staff to create log entries (confirmCycle must work for staff, not just head_admin)
        col.createRule = STAFF;

        dao.saveCollection(col);
    } catch (_) {}

}, (db) => {
    const dao = new Dao(db);
    const ADMIN = '@request.auth.role = "head_admin"';
    try {
        const col = dao.findCollectionByNameOrId("server_log");
        // Revert event_type to Phase 2 values only
        const eventTypeField = col.schema.getFieldByName("event_type");
        if (eventTypeField) {
            eventTypeField.options = {
                maxSelect: 1,
                values: [
                    "faction_change", "node_change", "war_event",
                    "diplomacy_event", "ownership_transfer", "manual_entry"
                ]
            };
        }
        col.createRule = ADMIN;
        dao.saveCollection(col);
    } catch (_) {}
});
