// pb_hooks/collection_rules.pb.js
// Ensures Phase 3 collection rules are correctly set on every PocketBase startup.
// This guards against migration edge-cases where createRule null (superadmin-only)
// survives despite migration files attempting to change it.

onBeforeServe(() => {
    const STAFF = '@request.auth.role = "head_admin" || @request.auth.role = "staff"';
    const ADMIN  = '@request.auth.role = "head_admin"';

    const fixes = [
        // submission_history: staff must be able to create records (confirmCycle)
        { name: "submission_history", createRule: STAFF, updateRule: ADMIN },
        // server_log: staff must be able to create log entries
        { name: "server_log", createRule: STAFF, updateRule: ADMIN },
    ];

    for (const fix of fixes) {
        try {
            const col = $app.dao().findCollectionByNameOrId(fix.name);
            let dirty = false;

            if (col.createRule !== fix.createRule) {
                col.createRule = fix.createRule;
                dirty = true;
            }
            if (fix.updateRule !== undefined && col.updateRule !== fix.updateRule) {
                col.updateRule = fix.updateRule;
                dirty = true;
            }

            if (dirty) {
                $app.dao().saveCollection(col);
                console.log("[collection_rules] Fixed rules for: " + fix.name);
            }
        } catch (err) {
            console.error("[collection_rules] Failed to fix rules for " + fix.name + ": " + err);
        }
    }
});
