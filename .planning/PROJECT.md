# VS3 Admin Panel v2

## What This Is

A web-based admin panel for managing VS3 (Vintage Season 3), a roleplay Minecraft server built on Vintage Story. It replaces and expands on the existing single-file HTML panel (v1.2.1) with a shared backend, multi-user authentication, and automation of the server's complex economic and political systems. A small staff team (3–6 people) uses the full admin view; faction members get a scoped read-only player portal showing only their own faction's data.

## Core Value

Upkeep cycle management must be fast, accurate, and automated — staff should be able to process an entire weekly deadline in minutes, not hours of manual Discord cross-referencing and hand-rolled dice.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Authentication & Access Control**
- [ ] Staff can log in with username/password; sessions persist across page loads
- [ ] Two staff tiers: Head Admin (full access including destructive actions) and Staff (manage everything except delete/wipe)
- [ ] Faction member accounts can log in and see a player portal scoped to their faction only
- [ ] Player portal shows own faction's nodes + global war/alliance board; other factions' node states are hidden

**Upkeep Processing**
- [ ] Staff can log upkeep submissions (item, qty, SP value, staff note) against a node — mirrors the existing Discord-verify-then-enter flow
- [ ] Panel auto-calculates effective upkeep per node (base × overextension multiplier × war modifier)
- [ ] Real-time cap enforcement: warn when a submission would push Raw Renewable or Currency past 40% of weekly upkeep
- [ ] Weekly deadline auto-processes all nodes at the configured day/time — calculates payment status, applies instability deltas, rolls instability chance per node, generates event if triggered
- [ ] Instability events are auto-selected by node type and presented to staff with action buttons (apply SP debt, apply instability, mark RP handled, dismiss)
- [ ] Staff can bulk-process all overdue nodes in one action (not one by one)

**Nodes**
- [ ] Full node CRUD: name, number, type, tier, owner faction, base upkeep, road connection, notes
- [ ] Node management tabs: Overview, Upkeep, Output (SMD), Rolls, Battles, Ownership, History
- [ ] Instability reduction (−1 / 40 SP), damage toggling, tier upgrade tracking all in-panel
- [ ] Ownership timeline with method (peaceful, violent, contested) tracked per transfer

**Factions**
- [ ] Full faction CRUD: name, type (PvP/PvE), color, members with roles (Leader, Officer, Member)
- [ ] Overextension and war modifier auto-calculated and displayed
- [ ] Military node bonus (free reinforcement slots) tracked per faction

**Wars & Sieges**
- [ ] Declare and end wars with casus belli and outcome notes
- [ ] War upkeep modifier auto-applied to all PvP faction nodes when at war
- [ ] Battle outcome logging per node: attacker, defender, result, node transfer if applicable
- [ ] Siege tracking: active sieges with timer, attacking/defending faction, objectives, resolution

**Alliances & Diplomacy**
- [ ] Create and end alliances, NAPs, trade agreements, vassalage, coalitions
- [ ] Alliance history with parties, type, and date range

**Server Log & History**
- [ ] Filterable server event log: all upkeep deadlines, instability events, battles, ownership transfers, war declarations
- [ ] Per-node history tab showing all events in chronological order

**Metrics & Reporting**
- [ ] SP submission metrics: by category, by item, by faction, by node
- [ ] Weekly SP owed vs paid chart per faction
- [ ] Instability heat map across all nodes

**Deployment**
- [ ] Self-hostable with a beginner-friendly guide (non-developer can follow)
- [ ] No per-user cost — runs on a single server instance the team controls

### Out of Scope

- Contracts & bounties — not requested for v1
- Crimes & enforcement logging — not requested for v1
- Temporal storms / server events — not requested for v1
- Discord bot integration — would add complexity; staff still enters data manually
- Mobile-optimized layout — admin tools used on desktop
- Public node map visible to all players — faction privacy is a core design requirement

## Context

- **Existing panel**: VS3_Panel_1_2_1.html — a single-file vanilla JS app with full feature set for node/faction/war/upkeep management, saving to browser localStorage. The data model, SP catalogue, instability event tables, and calculation logic are all reference implementations for v2.
- **Handbook**: VS3_Rules_Node_Handbook_v1.3.0.html — 25-section governance document defining all the rules the panel enforces. Key sections: VI (Nodes & Territory), VII (SP Catalogue), VIII (Instability & Upkeep), XI (War Economy), XX (War Goals & Sieges).
- **Submission flow**: Players place items in an in-game chest, post a Discord submission, staff verifies the chest in-game, then enters the submission into the panel. The panel does not replace Discord — it replaces the manual tracking after verification.
- **Season is live**: The server is already running. No hard timeline, but every cycle that runs without v2 is more manual work.
- **Data**: Starting fresh — no migration from v1.2.1 localStorage data.
- **Visual reference**: Dark gold medieval aesthetic from v1.2.1 — same color palette, refined layout, more visual hierarchy.

## Constraints

- **Tech**: Must be self-hostable by a non-developer following a guide. Backend must support shared real-time access across multiple PCs. No reliance on paid third-party SaaS beyond the hosting provider.
- **Users**: 3–6 staff + an unspecified number of faction member accounts (read-only player portal).
- **Security**: Faction node states must be invisible to members of other factions. Head Admin actions (delete, wipe) must require elevated credentials.
- **Scope**: v1 is upkeep automation + wars/sieges + player portal. Additional handbook systems (contracts, crimes, espionage) are future milestones.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fresh build, not port of v1.2.1 | v1.2.1 localStorage architecture can't support multi-user shared state; clean start avoids legacy debt | — Pending |
| Player portal is faction-scoped | Other factions' node states are strategic information — hiding them is a design requirement, not a UX choice | — Pending |
| Staff still enters data manually | Discord-verify-then-enter flow is trusted and sufficient; removing it would require in-game mod integration out of scope | — Pending |
| Tech stack TBD | Research phase will determine the simplest self-hostable stack (likely PocketBase or lightweight Node.js + SQLite) | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-01 after initialization*
