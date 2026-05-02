/// <reference path="../pb_data/types.d.ts" />

// Phase 4 migration — update collection read rules to allow member portal access.
// Members need to read:
//   factions    — their own faction record (scoped by @request.auth.faction = id)
//   nodes       — nodes owned by their faction (scoped by @request.auth.faction = owner)
//   wars        — all active wars (global — intentional per PORTAL-03/threat model T-04-04)
//   diplomacy   — all active agreements (global — intentional per PORTAL-03/threat model T-04-04)
//
// Write rules are NOT changed — members have no create/update/delete access.

migrate((db) => {
    const dao = new Dao(db);
    const STAFF = '@request.auth.role = "head_admin" || @request.auth.role = "staff"';
    const MEMBER_OR_STAFF = '@request.auth.role = "head_admin" || @request.auth.role = "staff" || @request.auth.collectionName = "members"';

    // factions — members can only list/view their own faction record (scoped by auth.faction = id)
    {
        const col = dao.findCollectionByNameOrId("factions");
        const FACTION_SCOPED = '@request.auth.role = "head_admin" || @request.auth.role = "staff" || @request.auth.faction = id';
        col.listRule = FACTION_SCOPED;
        col.viewRule = FACTION_SCOPED;
        dao.saveCollection(col);
    }

    // nodes — members can list/view nodes owned by their faction
    {
        const col = dao.findCollectionByNameOrId("nodes");
        col.listRule = '@request.auth.role = "head_admin" || @request.auth.role = "staff" || @request.auth.faction = owner';
        col.viewRule = '@request.auth.role = "head_admin" || @request.auth.role = "staff" || @request.auth.faction = owner';
        dao.saveCollection(col);
    }

    // wars — members can read all active wars (global board, no faction filter)
    {
        const col = dao.findCollectionByNameOrId("wars");
        col.listRule = MEMBER_OR_STAFF;
        col.viewRule = MEMBER_OR_STAFF;
        dao.saveCollection(col);
    }

    // diplomacy — members can read all active agreements (global board)
    {
        const col = dao.findCollectionByNameOrId("diplomacy");
        col.listRule = MEMBER_OR_STAFF;
        col.viewRule = MEMBER_OR_STAFF;
        dao.saveCollection(col);
    }

    // submissions — members can read submissions for their faction's nodes (current cycle paid SP)
    {
        const col = dao.findCollectionByNameOrId("submissions");
        col.listRule = '@request.auth.role = "head_admin" || @request.auth.role = "staff" || @request.auth.faction = node.owner';
        col.viewRule = '@request.auth.role = "head_admin" || @request.auth.role = "staff" || @request.auth.faction = node.owner';
        dao.saveCollection(col);
    }

}, (db) => {
    // Revert: restore STAFF-only rules
    const dao = new Dao(db);
    const STAFF = '@request.auth.role = "head_admin" || @request.auth.role = "staff"';

    for (const name of ["factions", "nodes", "wars", "diplomacy", "submissions"]) {
        try {
            const col = dao.findCollectionByNameOrId(name);
            col.listRule = STAFF;
            col.viewRule = STAFF;
            dao.saveCollection(col);
        } catch (_) {}
    }
});
