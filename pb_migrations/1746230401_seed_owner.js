/// <reference path="../pb_data/types.d.ts" />

// Seeds the "Owner" head_admin staff account for development/testing.
// Idempotent: skips if the account already exists.
migrate((db) => {
    const dao = Dao(db);

    let alreadyExists = false;
    try {
        dao.findFirstRecordByData("staff", "username", "Owner");
        alreadyExists = true;
    } catch (_) {}

    if (alreadyExists) {
        return;
    }

    const staffCol = dao.findCollectionByNameOrId("staff");
    const owner = new Record(staffCol);
    owner.set("username", "Owner");
    owner.set("role", "head_admin");
    owner.set("isActive", true);
    owner.setPassword("Owner1488");
    dao.saveRecord(owner);

}, (db) => {
    const dao = Dao(db);
    try {
        const owner = dao.findFirstRecordByData("staff", "username", "Owner");
        dao.deleteRecord(owner);
    } catch (_) {}
});
