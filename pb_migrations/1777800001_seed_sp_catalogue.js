/// <reference path="../pb_data/types.d.ts" />
// Seeds SP catalogue items. Idempotent — skips if records already exist.
migrate((db) => {
    const dao = Dao(db);
    try {
        const existing = dao.findRecordsByFilter("sp_catalogue", "id != ''", "", 1, 0);
        if (existing && existing.length > 0) return;
    } catch (_) {}

    const col = dao.findCollectionByNameOrId("sp_catalogue");
    const SP_CAT = [
        { name: "64 firewood",                 category: "Raw Renewable",       sp_value: 4,  demand_level: "Very low" },
        { name: "64 logs",                     category: "Raw Renewable",       sp_value: 6,  demand_level: "Low" },
        { name: "64 sticks",                   category: "Raw Renewable",       sp_value: 2,  demand_level: "Very low" },
        { name: "64 dry grass",                category: "Raw Renewable",       sp_value: 2,  demand_level: "Very low" },
        { name: "64 reeds",                    category: "Raw Renewable",       sp_value: 3,  demand_level: "Very low" },
        { name: "64 peat bricks",              category: "Fuel",                sp_value: 5,  demand_level: "Low" },
        { name: "64 charcoal",                 category: "Fuel",                sp_value: 8,  demand_level: "Moderate" },
        { name: "64 grain",                    category: "Agriculture & Food",  sp_value: 6,  demand_level: "Moderate" },
        { name: "10 bread",                    category: "Agriculture & Food",  sp_value: 6,  demand_level: "Moderate" },
        { name: "10 hearty meals (600+ sat.)", category: "Agriculture & Food",  sp_value: 12, demand_level: "Moderate" },
        { name: "64 vegetables",               category: "Agriculture & Food",  sp_value: 5,  demand_level: "Low-moderate" },
        { name: "64 smoked meat",              category: "Agriculture & Food",  sp_value: 10, demand_level: "Moderate" },
        { name: "64 fruit/preserves",          category: "Agriculture & Food",  sp_value: 5,  demand_level: "Low-moderate" },
        { name: "64 salt",                     category: "Agriculture & Food",  sp_value: 8,  demand_level: "Moderate" },
        { name: "64 boards/planks",            category: "Construction",        sp_value: 10, demand_level: "Low-moderate" },
        { name: "64 cobblestone blocks",       category: "Masonry",             sp_value: 8,  demand_level: "Low-moderate" },
        { name: "64 stone bricks",             category: "Masonry",             sp_value: 12, demand_level: "Moderate" },
        { name: "64 clay bricks",              category: "Masonry",             sp_value: 10, demand_level: "Moderate" },
        { name: "64 lime/mortar",              category: "Masonry",             sp_value: 10, demand_level: "Moderate" },
        { name: "64 flax fiber",               category: "Textiles & Leather",  sp_value: 7,  demand_level: "Moderate" },
        { name: "64 linen",                    category: "Textiles & Leather",  sp_value: 10, demand_level: "Moderate" },
        { name: "16 rope",                     category: "Textiles & Leather",  sp_value: 8,  demand_level: "Moderate" },
        { name: "16 leather",                  category: "Textiles & Leather",  sp_value: 8,  demand_level: "Moderate" },
        { name: "16 medium hides",             category: "Textiles & Leather",  sp_value: 6,  demand_level: "Low-moderate" },
        { name: "1 copper ingot",              category: "Early Metals",        sp_value: 6,  demand_level: "Moderate" },
        { name: "1 tin ingot",                 category: "Early Metals",        sp_value: 7,  demand_level: "Moderate" },
        { name: "1 bronze ingot",              category: "Early Metals",        sp_value: 10, demand_level: "Moderate+" },
        { name: "1 lead ingot",                category: "Early Metals",        sp_value: 6,  demand_level: "Moderate" },
        { name: "1 silver ingot",              category: "Early Metals",        sp_value: 14, demand_level: "Scarce" },
        { name: "1 gold ingot",                category: "Early Metals",        sp_value: 16, demand_level: "Scarce" },
        { name: "1 iron ingot",                category: "Mid Metals",          sp_value: 16, demand_level: "High" },
        { name: "1 meteoric iron ingot",       category: "Mid Metals",          sp_value: 20, demand_level: "High + scarce" },
        { name: "1 steel ingot",               category: "Late Metals",         sp_value: 28, demand_level: "Very high" },
        { name: "1 iron pickaxe head",         category: "Tools & Hardware",    sp_value: 18, demand_level: "High + labor" },
        { name: "1 iron shovel head",          category: "Tools & Hardware",    sp_value: 14, demand_level: "High + labor" },
        { name: "1 iron axe head",             category: "Tools & Hardware",    sp_value: 14, demand_level: "High + labor" },
        { name: "1 steel pickaxe head",        category: "Tools & Hardware",    sp_value: 32, demand_level: "Very high + labor" },
        { name: "1 steel shovel head",         category: "Tools & Hardware",    sp_value: 26, demand_level: "Very high + labor" },
        { name: "1 steel axe head",            category: "Tools & Hardware",    sp_value: 26, demand_level: "Very high + labor" },
        { name: "32 nails/fasteners",          category: "Tools & Hardware",    sp_value: 10, demand_level: "Moderate" },
        { name: "1 mechanical gear/part",      category: "Tools & Hardware",    sp_value: 25, demand_level: "High" },
        { name: "1 lantern",                   category: "Utility Goods",       sp_value: 10, demand_level: "Moderate" },
        { name: "16 resin",                    category: "Utility Goods",       sp_value: 7,  demand_level: "Moderate" },
        { name: "16 candles",                  category: "Utility Goods",       sp_value: 6,  demand_level: "Low-moderate" },
        { name: "10 powder charges",           category: "Military Supplies",   sp_value: 16, demand_level: "High" },
        { name: "32 musket balls/lead shot",   category: "Military Supplies",   sp_value: 10, demand_level: "Moderate" },
        { name: "1 iron spearhead",            category: "Military Supplies",   sp_value: 12, demand_level: "High + labor" },
        { name: "1 iron sword blade",          category: "Military Supplies",   sp_value: 16, demand_level: "High + labor" },
        { name: "1 steel sword blade",         category: "Military Supplies",   sp_value: 30, demand_level: "Very high + labor" },
        { name: "10 SMD",                      category: "Currency",            sp_value: 1,  demand_level: "Economy — 40% cap" },
        { name: "50 SMD",                      category: "Currency",            sp_value: 5,  demand_level: "Economy — 40% cap" },
        { name: "100 SMD",                     category: "Currency",            sp_value: 10, demand_level: "Economy — 40% cap" },
    ];
    for (const item of SP_CAT) {
        const rec = new Record(col);
        rec.set("name", item.name);
        rec.set("category", item.category);
        rec.set("sp_value", item.sp_value);
        rec.set("demand_level", item.demand_level);
        dao.saveRecord(rec);
    }
}, (db) => {
    const dao = Dao(db);
    try { dao.findRecordsByFilter("sp_catalogue", "id != ''", "", 999, 0).forEach(r => dao.deleteRecord(r)); } catch (_) {}
});
