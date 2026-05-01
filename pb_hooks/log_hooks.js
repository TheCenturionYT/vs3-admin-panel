// pb_hooks/log_hooks.js
// Writes server_log entries after create/update operations on key collections.
// Requirement: LOG-01 through LOG-12 (automated audit trail for all data mutations).
//
// Rules:
//   - Every hook body is wrapped in try/catch — a failed log write never breaks the
//     original operation.
//   - Uses $app.dao().saveRecord() per JSVM API contract (never $app.save()).
//   - e.next() is called at the end of every hook, inside or outside the try/catch,
//     so the original operation always completes.

// ---------------------------------------------------------------------------
// Helper: write a single server_log entry.
// ---------------------------------------------------------------------------
function writeServerLog(eventType, description, relatedFaction, relatedNode) {
    const col = $app.dao().findCollectionByNameOrId("server_log");
    const entry = new Record(col);
    entry.set("event_type", eventType);
    entry.set("description", description);
    entry.set("actor", "System");
    if (relatedFaction) {
        entry.set("related_faction", relatedFaction);
    }
    if (relatedNode) {
        entry.set("related_node", relatedNode);
    }
    $app.dao().saveRecord(entry);
}

// ---------------------------------------------------------------------------
// factions — AfterCreateSuccess
// ---------------------------------------------------------------------------
onRecordAfterCreateSuccess((e) => {
    try {
        writeServerLog(
            "faction_change",
            'Faction "' + e.record.getString("name") + '" was created.',
            e.record.getId(),
            null
        );
    } catch (err) {
        console.error("[log_hooks] factions create log failed:", err);
    }
    e.next();
}, "factions");

// ---------------------------------------------------------------------------
// factions — AfterUpdateSuccess
// ---------------------------------------------------------------------------
onRecordAfterUpdateSuccess((e) => {
    try {
        writeServerLog(
            "faction_change",
            'Faction "' + e.record.getString("name") + '" was updated.',
            e.record.getId(),
            null
        );
    } catch (err) {
        console.error("[log_hooks] factions update log failed:", err);
    }
    e.next();
}, "factions");

// ---------------------------------------------------------------------------
// nodes — AfterCreateSuccess
// ---------------------------------------------------------------------------
onRecordAfterCreateSuccess((e) => {
    try {
        writeServerLog(
            "node_change",
            'Node "' + e.record.getString("name") + '" was created.',
            e.record.getString("owner"),
            e.record.getId()
        );
    } catch (err) {
        console.error("[log_hooks] nodes create log failed:", err);
    }
    e.next();
}, "nodes");

// ---------------------------------------------------------------------------
// nodes — AfterUpdateSuccess
// ---------------------------------------------------------------------------
onRecordAfterUpdateSuccess((e) => {
    try {
        writeServerLog(
            "node_change",
            'Node "' + e.record.getString("name") + '" was updated.',
            e.record.getString("owner"),
            e.record.getId()
        );
    } catch (err) {
        console.error("[log_hooks] nodes update log failed:", err);
    }
    e.next();
}, "nodes");

// ---------------------------------------------------------------------------
// wars — AfterCreateSuccess
// ---------------------------------------------------------------------------
onRecordAfterCreateSuccess((e) => {
    try {
        writeServerLog(
            "war_event",
            "War declared between factions " + e.record.getString("faction_a") + " and " + e.record.getString("faction_b") + ".",
            e.record.getString("faction_a"),
            null
        );
    } catch (err) {
        console.error("[log_hooks] wars create log failed:", err);
    }
    e.next();
}, "wars");

// ---------------------------------------------------------------------------
// wars — AfterUpdateSuccess
// ---------------------------------------------------------------------------
onRecordAfterUpdateSuccess((e) => {
    try {
        writeServerLog(
            "war_event",
            "War updated (ID: " + e.record.getId() + ").",
            e.record.getString("faction_a"),
            null
        );
    } catch (err) {
        console.error("[log_hooks] wars update log failed:", err);
    }
    e.next();
}, "wars");

// ---------------------------------------------------------------------------
// battles — AfterCreateSuccess
// ---------------------------------------------------------------------------
onRecordAfterCreateSuccess((e) => {
    try {
        writeServerLog(
            "war_event",
            "Battle logged on war " + e.record.getString("war") + ".",
            e.record.getString("attacker"),
            e.record.getString("node")
        );
    } catch (err) {
        console.error("[log_hooks] battles create log failed:", err);
    }
    e.next();
}, "battles");

// ---------------------------------------------------------------------------
// sieges — AfterCreateSuccess
// ---------------------------------------------------------------------------
onRecordAfterCreateSuccess((e) => {
    try {
        writeServerLog(
            "war_event",
            "Siege started on node " + e.record.getString("node") + ".",
            e.record.getString("attacker"),
            e.record.getString("node")
        );
    } catch (err) {
        console.error("[log_hooks] sieges create log failed:", err);
    }
    e.next();
}, "sieges");

// ---------------------------------------------------------------------------
// sieges — AfterUpdateSuccess
// Only write a log entry when the siege transitions to resolved=true.
// ---------------------------------------------------------------------------
onRecordAfterUpdateSuccess((e) => {
    try {
        if (e.record.getBool("resolved") === true) {
            writeServerLog(
                "war_event",
                "Siege on node " + e.record.getString("node") + " resolved.",
                e.record.getString("attacker"),
                e.record.getString("node")
            );
        }
    } catch (err) {
        console.error("[log_hooks] sieges update log failed:", err);
    }
    e.next();
}, "sieges");

// ---------------------------------------------------------------------------
// diplomacy — AfterCreateSuccess
// ---------------------------------------------------------------------------
onRecordAfterCreateSuccess((e) => {
    try {
        writeServerLog(
            "diplomacy_event",
            "Diplomacy agreement created (type: " + e.record.getString("type") + ").",
            e.record.getString("faction_a"),
            null
        );
    } catch (err) {
        console.error("[log_hooks] diplomacy create log failed:", err);
    }
    e.next();
}, "diplomacy");

// ---------------------------------------------------------------------------
// diplomacy — AfterUpdateSuccess
// ---------------------------------------------------------------------------
onRecordAfterUpdateSuccess((e) => {
    try {
        writeServerLog(
            "diplomacy_event",
            "Diplomacy agreement ended (type: " + e.record.getString("type") + ").",
            e.record.getString("faction_a"),
            null
        );
    } catch (err) {
        console.error("[log_hooks] diplomacy update log failed:", err);
    }
    e.next();
}, "diplomacy");

// ---------------------------------------------------------------------------
// node_ownership_history — AfterCreateSuccess
// ---------------------------------------------------------------------------
onRecordAfterCreateSuccess((e) => {
    try {
        writeServerLog(
            "ownership_transfer",
            "Ownership of node " + e.record.getString("node") + " transferred via " + e.record.getString("method") + ".",
            e.record.getString("faction"),
            e.record.getString("node")
        );
    } catch (err) {
        console.error("[log_hooks] node_ownership_history create log failed:", err);
    }
    e.next();
}, "node_ownership_history");
