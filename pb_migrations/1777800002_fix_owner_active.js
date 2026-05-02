/// <reference path="../pb_data/types.d.ts" />
// Sets isActive=true on the Owner account if it exists and is currently inactive.
migrate((db) => {
    const dao = Dao(db);
    try {
        const owner = dao.findFirstRecordByData("staff", "username", "Owner");
        owner.set("isActive", true);
        dao.saveRecord(owner);
    } catch (_) {}
}, (db) => {});
