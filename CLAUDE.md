# CLAUDE.md — VS3 Admin Panel v2.0.0

## Project

Web-based multi-user admin panel for VS3 (Vintage Season 3), a roleplay Vintage Story server.
Replaces a single-file localStorage HTML panel (v1.2.1) with a shared backend, authentication,
and automated upkeep processing. Season is live — build correctly, ship when ready.

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | PocketBase 0.22.x (single binary, built-in auth + RBAC + SQLite + real-time SSE) |
| Frontend | SvelteKit 2 + Svelte 5 (runes) |
| UI | shadcn-svelte + Tailwind CSS |
| Charts | Chart.js 4 via svelte-chartjs |
| Deployment | Railway (primary) or Docker Compose (VPS) |

## Reference Files

- `Admin Panel/VS3_Panel_1_2_1.html` — v1 reference implementation. **All calculation logic (calcUp, checkCaps, procDeadlines, INSTAB_EVENTS) must be ported from this file, not re-derived from handbook prose.**
- `Handbook/VS3_Rules_Node_Handbook_v1.4.6.html` — governance document (25+ sections). Key sections: VI (Nodes/Territory), VII (SP Catalogue), VIII (Instability/Upkeep), IX (Node Catalogue), XI (War Economy), XX (War Goals/Sieges). **v1.4.6 is the authoritative version — extended overextension table, harbor mechanics (§VIII.I), updated upgrade costs.**
- `.planning/` — PROJECT.md, REQUIREMENTS.md, ROADMAP.md, research/

## Core Business Logic

### Upkeep Formula
```
effectiveUpkeep = ceil(baseUpkeep × overextensionMul(nodeCount) × (1 + warMul(warCount)))
```
- overextensionMul: 1→×1.0, 2→×1.1, 3→×1.2, 4→×1.35, 5→×1.5, 6→×1.65, 7→×1.80, 8+→×2.00
- warMul (PvP factions only): 1war=+0.15, 2wars=+0.30, 3+wars=+0.50
- PvE factions: warMul is always 0, regardless of any wars
- Must be a single shared function; never store the computed value

### Standard Upkeep by Tier
T1=40 SP/week, T2=80, T3=160, T4=240

### 40% Category Caps
Raw Renewable and Currency each capped at 40% of weekly effective upkeep per cycle.
Preview must show impact BEFORE commit, not after.

### Instability Scale
0→0%, 1→5%, 2→15%, 3→30%, 4→50%, 5→75% event chance (INSTAB_CHANCE)
Instability delta: ≥100% paid=+0, 50-99%=+1, 1-49%=+2, 0%=+2

### Deadline Processing (8 steps — must be idempotent)
1. Detect overdue nodes (now > deadline timestamp)
2. Calculate payment% (paid SP / required SP)
3. Apply instability delta
4. Move current cycle submissions → cycleHistory
5. Set rollDue=true if instability > 0
6. Advance deadline to next occurrence
7. Write to serverLog and node history
8. Record processed key (nodeId + deadlineTimestamp) to prevent double-processing

### Instability Reduction
Costs 40 SP (logged as a submission), reduces instability by 1.

### Repair Costs (§VIII authoritative)
T1=50 SP, T2=100, T3=200, T4=300

### Upgrade Costs (§VIII.H authoritative — v1.4.6)
T1→T2=100 SP, T2→T3=300, T3→T4=600

### Military Node Tiers
T1=Watchtower, T2=Outpost, T3=Fort, T4=Bastion
Free reinforcement slots = tier number (no SP cost, but still subject to hard cap)

### SP Currency
10 SMD = 1 SP. Subject to 40% Currency cap.

## Auth Architecture

```
staff collection:     username, password, role (head_admin | staff)
members collection:   username, password, faction (relation → factions)
factions collection:  name, type (PvP | PvE), color, ...
```

PocketBase collection rules:
- Destructive ops: `@request.auth.role = "head_admin"`
- Portal data: `@request.auth.faction = faction.id` (query-level, not UI-level)

## Critical Constraints

1. **Faction privacy is enforced at the database query level** — never by hiding UI elements
2. **Deadline processor runs server-side** — not in browser (race conditions with multiple clients)
3. **Deadline processor is idempotent** — re-running after crash must not double-apply instability
4. **Business logic sourced from v1.2.1 JS** — not handbook prose (handbook has ambiguities)
5. **Head Admin gated at route AND collection rule level** — UI hiding alone is insufficient
6. **Scheduler failure must be visible** — "Last run: X ago" dashboard widget, alert if >8 days
7. **Effective upkeep is never stored** — always calculated at read time from live faction/war state

## Submission Flow (Do Not Change)

Players place items in in-game chest → post Discord submission → staff verifies in-game → staff logs in panel.
Panel replaces manual tracking after verification, not the Discord flow.

## Phase Structure

| Phase | Goal |
|-------|------|
| 1 — Foundation | PocketBase schema, auth, staff login, role enforcement, deployment scaffold |
| 2 — Core Data & Wars | Faction/Node/War/Diplomacy CRUD, ownership timeline, logs, dashboard |
| 3 — Upkeep Engine & Automation | SP submissions, caps, deadline processor, instability, metrics |
| 4 — Player Portal | Faction-scoped read-only portal with war/alliance board |

## Resolved Discrepancies (v1.4.6 audit)

- Repair costs: §VIII (50/100/200/300) is authoritative. §IX Tier Baseline values were stale — resolved.
- Upgrade costs: §VIII.H (100/300/600) is authoritative per v1.4.6. Panel upgrade submission item_names must match these values.
- Overextension multiplier: Extended to 8 tiers in v1.4.6 and updated in upkeep.ts accordingly.

## Pending Implementation (from v1.4.6 audit)

- **Harbor mechanics (§VIII.I):** New in v1.4.6 — harbor supply capacity, boat slot requirements. Not yet modeled in panel (Phase 3+ scope).
- **SP catalogue sync:** Verify all 46 catalogue items from handbook §VII are seeded in PocketBase.

## Visual Identity

Dark gold medieval aesthetic. Same core palette as v1.2.1 (dark backgrounds, gold accents, muted text).
Elevated layout, clearer information hierarchy, more polished component styling.
Desktop-first (minimum width ~1024px). No mobile optimization.
