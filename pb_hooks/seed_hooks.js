// pb_hooks/seed_hooks.js
// Seeds required baseline data on PocketBase startup.
// Requirement: SEED-01 (Neutral Territory system faction), SEED-02 (SP Catalogue items).
//
// Rules:
//   - Each seed block is independent — one failure must not prevent the other.
//   - Never crash PocketBase startup; all errors are caught and logged.
//   - Uses $app.dao().saveRecord() per JSVM API contract.

onBootstrap((e) => {
    // -------------------------------------------------------------------------
    // SEED 1: Neutral Territory faction
    // -------------------------------------------------------------------------
    try {
        const factionsCol = $app.dao().findCollectionByNameOrId("factions");

        let alreadyExists = false;
        try {
            $app.dao().findFirstRecordByData("factions", "name", "Neutral Territory");
            alreadyExists = true;
        } catch (_) {
            // Record not found — we need to create it.
        }

        if (!alreadyExists) {
            const neutral = new Record(factionsCol);
            neutral.set("name", "Neutral Territory");
            neutral.set("type", "PvE");
            neutral.set("color", "#6b6255");
            neutral.set("is_system", true);
            $app.dao().saveRecord(neutral);
            console.log("[seed_hooks] Seeded 'Neutral Territory' faction.");
        } else {
            console.log("[seed_hooks] 'Neutral Territory' faction already exists — skipping.");
        }
    } catch (err) {
        console.error("[seed_hooks] Failed to seed Neutral Territory faction:", err);
    }

    // -------------------------------------------------------------------------
    // SEED 2: SP Catalogue items
    // -------------------------------------------------------------------------
    try {
        const existing = $app.dao().findRecordsByFilter("sp_catalogue", "", "", 1, 0);

        if (existing.length > 0) {
            console.log("[seed_hooks] sp_catalogue already has records — skipping seed.");
        } else {
            const catalogueCol = $app.dao().findCollectionByNameOrId("sp_catalogue");

            // Sourced verbatim from Admin Panel/VS3_Panel_1_2_1.html — SP_CAT array.
            // Fields: n=name, c=category, v=sp_value, d=demand_level
            const SP_CAT = [
                { name: "64 firewood",                  category: "Raw Renewable",        sp_value: 4,  demand_level: "Very low" },
                { name: "64 logs",                      category: "Raw Renewable",        sp_value: 6,  demand_level: "Low" },
                { name: "64 sticks",                    category: "Raw Renewable",        sp_value: 2,  demand_level: "Very low" },
                { name: "64 dry grass",                 category: "Raw Renewable",        sp_value: 2,  demand_level: "Very low" },
                { name: "64 reeds",                     category: "Raw Renewable",        sp_value: 3,  demand_level: "Very low" },
                { name: "64 peat bricks",               category: "Fuel",                 sp_value: 5,  demand_level: "Low" },
                { name: "64 charcoal",                  category: "Fuel",                 sp_value: 8,  demand_level: "Moderate" },
                { name: "64 grain",                     category: "Agriculture & Food",   sp_value: 6,  demand_level: "Moderate" },
                { name: "10 bread",                     category: "Agriculture & Food",   sp_value: 6,  demand_level: "Moderate" },
                { name: "10 hearty meals (600+ sat.)",  category: "Agriculture & Food",   sp_value: 12, demand_level: "Moderate" },
                { name: "64 vegetables",                category: "Agriculture & Food",   sp_value: 5,  demand_level: "Low-moderate" },
                { name: "64 smoked meat",               category: "Agriculture & Food",   sp_value: 10, demand_level: "Moderate" },
                { name: "64 fruit/preserves",           category: "Agriculture & Food",   sp_value: 5,  demand_level: "Low-moderate" },
                { name: "64 salt",                      category: "Agriculture & Food",   sp_value: 8,  demand_level: "Moderate" },
                { name: "64 boards/planks",             category: "Construction",         sp_value: 10, demand_level: "Low-moderate" },
                { name: "64 cobblestone blocks",        category: "Masonry",              sp_value: 8,  demand_level: "Low-moderate" },
                { name: "64 stone bricks",              category: "Masonry",              sp_value: 12, demand_level: "Moderate" },
                { name: "64 clay bricks",               category: "Masonry",              sp_value: 10, demand_level: "Moderate" },
                { name: "64 lime/mortar",               category: "Masonry",              sp_value: 10, demand_level: "Moderate" },
                { name: "64 flax fiber",                category: "Textiles & Leather",   sp_value: 7,  demand_level: "Moderate" },
                { name: "64 linen",                     category: "Textiles & Leather",   sp_value: 10, demand_level: "Moderate" },
                { name: "16 rope",                      category: "Textiles & Leather",   sp_value: 8,  demand_level: "Moderate" },
                { name: "16 leather",                   category: "Textiles & Leather",   sp_value: 8,  demand_level: "Moderate" },
                { name: "16 medium hides",              category: "Textiles & Leather",   sp_value: 6,  demand_level: "Low-moderate" },
                { name: "1 copper ingot",               category: "Early Metals",         sp_value: 6,  demand_level: "Moderate" },
                { name: "1 tin ingot",                  category: "Early Metals",         sp_value: 7,  demand_level: "Moderate" },
                { name: "1 bronze ingot",               category: "Early Metals",         sp_value: 10, demand_level: "Moderate+" },
                { name: "1 lead ingot",                 category: "Early Metals",         sp_value: 6,  demand_level: "Moderate" },
                { name: "1 silver ingot",               category: "Early Metals",         sp_value: 14, demand_level: "Scarce" },
                { name: "1 gold ingot",                 category: "Early Metals",         sp_value: 16, demand_level: "Scarce" },
                { name: "1 iron ingot",                 category: "Mid Metals",           sp_value: 16, demand_level: "High" },
                { name: "1 meteoric iron ingot",        category: "Mid Metals",           sp_value: 20, demand_level: "High + scarce" },
                { name: "1 steel ingot",                category: "Late Metals",          sp_value: 28, demand_level: "Very high" },
                { name: "1 iron pickaxe head",          category: "Tools & Hardware",     sp_value: 18, demand_level: "High + labor" },
                { name: "1 iron shovel head",           category: "Tools & Hardware",     sp_value: 14, demand_level: "High + labor" },
                { name: "1 iron axe head",              category: "Tools & Hardware",     sp_value: 14, demand_level: "High + labor" },
                { name: "1 steel pickaxe head",         category: "Tools & Hardware",     sp_value: 32, demand_level: "Very high + labor" },
                { name: "1 steel shovel head",          category: "Tools & Hardware",     sp_value: 26, demand_level: "Very high + labor" },
                { name: "1 steel axe head",             category: "Tools & Hardware",     sp_value: 26, demand_level: "Very high + labor" },
                { name: "32 nails/fasteners",           category: "Tools & Hardware",     sp_value: 10, demand_level: "Moderate" },
                { name: "1 mechanical gear/part",       category: "Tools & Hardware",     sp_value: 25, demand_level: "High" },
                { name: "1 lantern",                    category: "Utility Goods",        sp_value: 10, demand_level: "Moderate" },
                { name: "16 resin",                     category: "Utility Goods",        sp_value: 7,  demand_level: "Moderate" },
                { name: "16 candles",                   category: "Utility Goods",        sp_value: 6,  demand_level: "Low-moderate" },
                { name: "10 powder charges",            category: "Military Supplies",    sp_value: 16, demand_level: "High" },
                { name: "32 musket balls/lead shot",    category: "Military Supplies",    sp_value: 10, demand_level: "Moderate" },
                { name: "1 iron spearhead",             category: "Military Supplies",    sp_value: 12, demand_level: "High + labor" },
                { name: "1 iron sword blade",           category: "Military Supplies",    sp_value: 16, demand_level: "High + labor" },
                { name: "1 steel sword blade",          category: "Military Supplies",    sp_value: 30, demand_level: "Very high + labor" },
                { name: "10 SMD",                       category: "Currency",             sp_value: 1,  demand_level: "Economy — 40% cap" },
                { name: "50 SMD",                       category: "Currency",             sp_value: 5,  demand_level: "Economy — 40% cap" },
                { name: "100 SMD",                      category: "Currency",             sp_value: 10, demand_level: "Economy — 40% cap" },
            ];

            for (const item of SP_CAT) {
                const record = new Record(catalogueCol);
                record.set("name", item.name);
                record.set("category", item.category);
                record.set("sp_value", item.sp_value);
                record.set("demand_level", item.demand_level);
                $app.dao().saveRecord(record);
            }

            console.log("[seed_hooks] Seeded " + SP_CAT.length + " SP catalogue items.");
        }
    } catch (err) {
        console.error("[seed_hooks] Failed to seed sp_catalogue:", err);
    }

    e.next();
});
