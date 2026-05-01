// pb_hooks/export_hooks.js
// Custom JSVM route that assembles all game data as a single JSON export.
// Requirement: DATA-06 (staff can export all data as timestamped JSON).
// Auth: any authenticated user (staff or head_admin) — enforced by $apis.requireAuth().

routerAdd("GET", "/api/vs3/export", (e) => {
    try {
        const data = {
            exported_at: new Date().toISOString(),
            factions:               $app.dao().findRecordsByFilter('factions',               '', '-created', 0, 0),
            nodes:                  $app.dao().findRecordsByFilter('nodes',                  '', '-created', 0, 0),
            wars:                   $app.dao().findRecordsByFilter('wars',                   '', '-created', 0, 0),
            battles:                $app.dao().findRecordsByFilter('battles',                '', '-created', 0, 0),
            sieges:                 $app.dao().findRecordsByFilter('sieges',                 '', '-created', 0, 0),
            diplomacy:              $app.dao().findRecordsByFilter('diplomacy',              '', '-created', 0, 0),
            server_log:             $app.dao().findRecordsByFilter('server_log',             '', '-created', 0, 0),
            node_ownership_history: $app.dao().findRecordsByFilter('node_ownership_history', '', '-created', 0, 0),
            faction_members:        $app.dao().findRecordsByFilter('faction_members',        '', '-created', 0, 0)
        };
        return e.json(200, data);
    } catch (err) {
        console.error('[export_hooks] Export failed:', err);
        return e.json(500, { error: 'Export failed.' });
    }
}, $apis.requireAuth());
