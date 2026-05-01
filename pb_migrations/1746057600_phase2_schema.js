/// <reference path="../pb_data/types.d.ts" />

// Full schema migration — Phase 1 prerequisites + Phase 2 Core Data & Wars
migrate((db) => {
    const dao = Dao(db);
    const STAFF = '@request.auth.role = "head_admin" || @request.auth.role = "staff"';
    const ADMIN = '@request.auth.role = "head_admin"';

    function exists(name) {
        try { dao.findCollectionByNameOrId(name); return true; } catch (_) { return false; }
    }

    // ── P1-1. staff (auth collection) ─────────────────────────────────────
    if (!exists("staff")) {
        dao.saveCollection(new Collection({
            name: "staff", type: "auth",
            schema: [
                { name: "role",      type: "select", required: true,
                  options: { maxSelect: 1, values: ["head_admin","staff"] } },
                { name: "lastLogin", type: "date" },
                { name: "isActive",  type: "bool" }
            ],
            listRule:   '@request.auth.role = "head_admin" || @request.auth.id = id',
            viewRule:   '@request.auth.role = "head_admin" || @request.auth.id = id',
            createRule: ADMIN,
            updateRule: ADMIN,
            deleteRule: ADMIN
        }));
    }

    // ── P1-2. factions (create or expand from Phase 1 stub) ───────────────
    if (!exists("factions")) {
        dao.saveCollection(new Collection({
            name: "factions", type: "base",
            schema: [
                { name: "name",        type: "text", required: true },
                { name: "type",        type: "select", required: true,
                  options: { maxSelect: 1, values: ["PvP","PvE"] } },
                { name: "color",       type: "text" },
                { name: "description", type: "text" },
                { name: "is_system",   type: "bool" }
            ],
            listRule: STAFF, viewRule: STAFF, createRule: ADMIN,
            updateRule: ADMIN,
            deleteRule: '@request.auth.role = "head_admin" && is_system != true'
        }));
    } else {
        const col = dao.findCollectionByNameOrId("factions");
        if (!col.schema.getFieldByName("type")) {
            col.schema.addField(new SchemaField({
                name: "type", type: "select", required: true,
                options: { maxSelect: 1, values: ["PvP","PvE"] }
            }));
        }
        if (!col.schema.getFieldByName("color")) {
            col.schema.addField(new SchemaField({ name: "color", type: "text" }));
        }
        if (!col.schema.getFieldByName("description")) {
            col.schema.addField(new SchemaField({ name: "description", type: "text" }));
        }
        if (!col.schema.getFieldByName("is_system")) {
            col.schema.addField(new SchemaField({ name: "is_system", type: "bool" }));
        }
        col.listRule   = STAFF;
        col.viewRule   = STAFF;
        col.createRule = ADMIN;
        col.updateRule = ADMIN;
        col.deleteRule = '@request.auth.role = "head_admin" && is_system != true';
        dao.saveCollection(col);
    }

    const factionsId = dao.findCollectionByNameOrId("factions").id;

    // ── P1-3. members (auth collection — depends on factions) ─────────────
    if (!exists("members")) {
        dao.saveCollection(new Collection({
            name: "members", type: "auth",
            schema: [
                { name: "faction",  type: "relation", required: true,
                  options: { collectionId: factionsId, maxSelect: 1, cascadeDelete: false } },
                { name: "isActive", type: "bool" }
            ],
            listRule:   STAFF,
            viewRule:   STAFF,
            createRule: STAFF,
            updateRule: STAFF,
            deleteRule: ADMIN
        }));
    }

    // ── P1-4. job_run_log ─────────────────────────────────────────────────
    if (!exists("job_run_log")) {
        dao.saveCollection(new Collection({
            name: "job_run_log", type: "base",
            schema: [
                { name: "type",        type: "text", required: true },
                { name: "startedAt",   type: "date", required: true },
                { name: "completedAt", type: "date" },
                { name: "status",      type: "text", required: true },
                { name: "details",     type: "json" }
            ],
            listRule:   STAFF,
            viewRule:   STAFF,
            createRule: null,
            updateRule: null,
            deleteRule: ADMIN
        }));
    }

    // ── P1-5. server_log (create or expand from Phase 1 stub) ─────────────
    if (!exists("server_log")) {
        dao.saveCollection(new Collection({
            name: "server_log", type: "base",
            schema: [
                { name: "event_type",     type: "select", required: true,
                  options: { maxSelect: 1, values: [
                      "faction_change","node_change","war_event",
                      "diplomacy_event","ownership_transfer","manual_entry"
                  ]}},
                { name: "description",    type: "text", required: true },
                { name: "related_faction", type: "relation",
                  options: { collectionId: factionsId, maxSelect: 1, cascadeDelete: false } },
                { name: "actor",          type: "text" }
            ],
            listRule:   STAFF,
            viewRule:   STAFF,
            createRule: ADMIN,
            updateRule: ADMIN,
            deleteRule: ADMIN
        }));
    } else {
        const col = dao.findCollectionByNameOrId("server_log");
        if (!col.schema.getFieldByName("event_type")) {
            col.schema.addField(new SchemaField({
                name: "event_type", type: "select", required: true,
                options: { maxSelect: 1, values: [
                    "faction_change","node_change","war_event",
                    "diplomacy_event","ownership_transfer","manual_entry"
                ]}
            }));
        }
        if (!col.schema.getFieldByName("description")) {
            col.schema.addField(new SchemaField({ name: "description", type: "text", required: true }));
        }
        if (!col.schema.getFieldByName("related_faction")) {
            col.schema.addField(new SchemaField({
                name: "related_faction", type: "relation",
                options: { collectionId: factionsId, maxSelect: 1, cascadeDelete: false }
            }));
        }
        if (!col.schema.getFieldByName("actor")) {
            col.schema.addField(new SchemaField({ name: "actor", type: "text" }));
        }
        col.listRule   = STAFF;
        col.viewRule   = STAFF;
        col.createRule = ADMIN;
        col.updateRule = ADMIN;
        col.deleteRule = ADMIN;
        dao.saveCollection(col);
    }

    // ── 2-1. faction_members ──────────────────────────────────────────────
    if (!exists("faction_members")) {
        const membersId = dao.findCollectionByNameOrId("members").id;
        dao.saveCollection(new Collection({
            name: "faction_members", type: "base",
            schema: [
                { name: "faction", type: "relation", required: true,
                  options: { collectionId: factionsId, maxSelect: 1, cascadeDelete: false } },
                { name: "user",    type: "relation", required: true,
                  options: { collectionId: membersId,  maxSelect: 1, cascadeDelete: false } },
                { name: "role",    type: "select",   required: true,
                  options: { maxSelect: 1, values: ["Leader","Officer","Member"] } }
            ],
            listRule: STAFF, viewRule: STAFF, createRule: STAFF,
            updateRule: STAFF, deleteRule: ADMIN
        }));
    }

    // ── 2-2. nodes ────────────────────────────────────────────────────────
    if (!exists("nodes")) {
        dao.saveCollection(new Collection({
            name: "nodes", type: "base",
            schema: [
                { name: "name",        type: "text",   required: true },
                { name: "node_number", type: "number" },
                { name: "type",        type: "select", required: true,
                  options: { maxSelect: 1, values: [
                      "Farm","Ranch","Orchard","Mine","Quarry","Clay Pit","Forest",
                      "Lumber Mill","Resin Farm","Peat Bog","Salt Works","Workshop",
                      "Trade Post","Military Node","Harbor/River Landing"
                  ]}},
                { name: "tier",        type: "select", required: true,
                  options: { maxSelect: 1, values: ["1","2","3","4"] } },
                { name: "owner",       type: "relation",
                  options: { collectionId: factionsId, maxSelect: 1, cascadeDelete: false } },
                { name: "base_upkeep", type: "number" },
                { name: "has_road",    type: "bool" },
                { name: "road_note",   type: "text" },
                { name: "notes",       type: "text" },
                { name: "instability", type: "number",
                  options: { min: 0, max: 5 } },
                { name: "roll_due",    type: "bool" }
            ],
            listRule: STAFF, viewRule: STAFF, createRule: STAFF,
            updateRule: STAFF, deleteRule: ADMIN
        }));
    }

    const nodesId = dao.findCollectionByNameOrId("nodes").id;

    // ── 2-3. Add related_node to server_log ───────────────────────────────
    {
        const col = dao.findCollectionByNameOrId("server_log");
        if (!col.schema.getFieldByName("related_node")) {
            col.schema.addField(new SchemaField({
                name: "related_node", type: "relation",
                options: { collectionId: nodesId, maxSelect: 1, cascadeDelete: false }
            }));
            dao.saveCollection(col);
        }
    }

    // ── 2-4. node_ownership_history ───────────────────────────────────────
    if (!exists("node_ownership_history")) {
        dao.saveCollection(new Collection({
            name: "node_ownership_history", type: "base",
            schema: [
                { name: "node",          type: "relation", required: true,
                  options: { collectionId: nodesId,    maxSelect: 1, cascadeDelete: false } },
                { name: "faction",       type: "relation", required: true,
                  options: { collectionId: factionsId, maxSelect: 1, cascadeDelete: false } },
                { name: "transfer_date", type: "date",   required: true },
                { name: "method",        type: "select", required: true,
                  options: { maxSelect: 1, values: ["peaceful","violent","system"] } },
                { name: "staff_note",    type: "text" }
            ],
            listRule: STAFF, viewRule: STAFF, createRule: STAFF,
            updateRule: "", deleteRule: ADMIN
        }));
    }

    // ── 2-5. wars ─────────────────────────────────────────────────────────
    if (!exists("wars")) {
        dao.saveCollection(new Collection({
            name: "wars", type: "base",
            schema: [
                { name: "faction_a",   type: "relation", required: true,
                  options: { collectionId: factionsId, maxSelect: 1, cascadeDelete: false } },
                { name: "faction_b",   type: "relation", required: true,
                  options: { collectionId: factionsId, maxSelect: 1, cascadeDelete: false } },
                { name: "casus_belli", type: "text",   required: true },
                { name: "start_date",  type: "date",   required: true },
                { name: "end_date",    type: "date" },
                { name: "outcome",     type: "select",
                  options: { maxSelect: 1, values: ["Victory_A","Victory_B","Stalemate"] } },
                { name: "status",      type: "select", required: true,
                  options: { maxSelect: 1, values: ["active","ended"] } },
                { name: "notes",       type: "text" }
            ],
            listRule: STAFF, viewRule: STAFF, createRule: STAFF,
            updateRule: STAFF, deleteRule: ADMIN
        }));
    }

    const warsId = dao.findCollectionByNameOrId("wars").id;

    // ── 2-6. battles ──────────────────────────────────────────────────────
    if (!exists("battles")) {
        dao.saveCollection(new Collection({
            name: "battles", type: "base",
            schema: [
                { name: "war",                   type: "relation", required: true,
                  options: { collectionId: warsId,    maxSelect: 1, cascadeDelete: false } },
                { name: "node",                  type: "relation",
                  options: { collectionId: nodesId,   maxSelect: 1, cascadeDelete: false } },
                { name: "attacker",              type: "relation", required: true,
                  options: { collectionId: factionsId, maxSelect: 1, cascadeDelete: false } },
                { name: "defender",              type: "relation", required: true,
                  options: { collectionId: factionsId, maxSelect: 1, cascadeDelete: false } },
                { name: "result",                type: "text" },
                { name: "description",           type: "text" },
                { name: "battle_date",           type: "date", required: true },
                { name: "ownership_transferred", type: "bool" }
            ],
            listRule: STAFF, viewRule: STAFF, createRule: STAFF,
            updateRule: STAFF, deleteRule: ADMIN
        }));
    }

    // ── 2-7. sieges ───────────────────────────────────────────────────────
    if (!exists("sieges")) {
        dao.saveCollection(new Collection({
            name: "sieges", type: "base",
            schema: [
                { name: "war",             type: "relation", required: true,
                  options: { collectionId: warsId,    maxSelect: 1, cascadeDelete: false } },
                { name: "node",            type: "relation", required: true,
                  options: { collectionId: nodesId,   maxSelect: 1, cascadeDelete: false } },
                { name: "attacker",        type: "relation", required: true,
                  options: { collectionId: factionsId, maxSelect: 1, cascadeDelete: false } },
                { name: "defender",        type: "relation", required: true,
                  options: { collectionId: factionsId, maxSelect: 1, cascadeDelete: false } },
                { name: "objectives",      type: "text" },
                { name: "start_date",      type: "date", required: true },
                { name: "resolved",        type: "bool" },
                { name: "resolution_note", type: "text" }
            ],
            listRule: STAFF, viewRule: STAFF, createRule: STAFF,
            updateRule: STAFF, deleteRule: ADMIN
        }));
    }

    // ── 2-8. diplomacy ────────────────────────────────────────────────────
    if (!exists("diplomacy")) {
        dao.saveCollection(new Collection({
            name: "diplomacy", type: "base",
            schema: [
                { name: "type",        type: "select", required: true,
                  options: { maxSelect: 1, values: [
                      "Alliance","NAP","Trade Agreement","Vassalage","Coalition","Custom"
                  ]}},
                { name: "faction_a",   type: "relation", required: true,
                  options: { collectionId: factionsId, maxSelect: 1, cascadeDelete: false } },
                { name: "faction_b",   type: "relation", required: true,
                  options: { collectionId: factionsId, maxSelect: 1, cascadeDelete: false } },
                { name: "terms",       type: "text" },
                { name: "custom_name", type: "text" },
                { name: "start_date",  type: "date", required: true },
                { name: "end_date",    type: "date" },
                { name: "status",      type: "select", required: true,
                  options: { maxSelect: 1, values: ["active","ended"] } }
            ],
            listRule: STAFF, viewRule: STAFF, createRule: STAFF,
            updateRule: STAFF, deleteRule: ADMIN
        }));
    }

    // ── 2-9. sp_catalogue ─────────────────────────────────────────────────
    if (!exists("sp_catalogue")) {
        dao.saveCollection(new Collection({
            name: "sp_catalogue", type: "base",
            schema: [
                { name: "name",         type: "text",   required: true },
                { name: "category",     type: "select", required: true,
                  options: { maxSelect: 1, values: [
                      "Raw Renewable","Fuel","Agriculture & Food","Construction","Masonry",
                      "Textiles & Leather","Early Metals","Mid Metals","Late Metals",
                      "Tools & Hardware","Military Supplies","Utility Goods","Currency"
                  ]}},
                { name: "sp_value",     type: "number", required: true },
                { name: "demand_level", type: "text" }
            ],
            listRule: STAFF, viewRule: STAFF,
            createRule: ADMIN, updateRule: ADMIN, deleteRule: ADMIN
        }));
    }

}, (db) => {
    const dao = Dao(db);
    for (const name of [
        "sp_catalogue","diplomacy","sieges","battles","wars",
        "node_ownership_history","nodes","faction_members",
        "server_log","job_run_log","members","factions","staff"
    ]) {
        try { dao.deleteCollection(dao.findCollectionByNameOrId(name)); } catch (_) {}
    }
});
