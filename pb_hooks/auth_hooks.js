// pb_hooks/auth_hooks.js
// Updates lastLogin on the staff collection after successful authentication.
// Requirement: AUTH-06 (per-account activity logged — last login visible to Head Admin).

onRecordAuthRequest((e) => {
    // Only track lastLogin for staff collection (not members)
    if (e.collection.name !== "staff") {
        e.next();
        return;
    }

    try {
        const record = e.record;
        record.set("lastLogin", new Date().toISOString());
        $app.dao().saveRecord(record);
    } catch (err) {
        // Non-fatal — log but do not fail the auth request
        console.error("[auth_hooks] Failed to update lastLogin:", err);
    }

    e.next();
}, "staff");
