/// <reference path="../pb_data/types.d.ts" />

// Enables username-based authentication on the staff and members collections.
// These were created with allowUsernameAuth: false (PocketBase default) in the Phase 2 migration.
migrate((db) => {
    const dao = new Dao(db);

    for (const name of ["staff", "members"]) {
        try {
            const col = dao.findCollectionByNameOrId(name);
            const opts = col.authOptions();
            opts.setAllowUsernameAuth(true);
            if (opts.minPasswordLength() < 5) {
                opts.setMinPasswordLength(5);
            }
            col.setAuthOptions(opts);
            dao.saveCollection(col);
        } catch (err) {
            // Collection may not exist on all installs — skip silently
        }
    }

}, (db) => {
    // Rollback: leave auth options as-is (reverting to false would break active sessions)
});
