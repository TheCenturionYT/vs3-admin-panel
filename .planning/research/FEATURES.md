# Feature Landscape

**Domain:** Game server admin panel — roleplay Minecraft server (Vintage Story mod)
**Project:** VS3 Admin Panel v2
**Researched:** 2026-05-01
**Sources:** VS3_Panel_1_2_1.html (v1 reference implementation), VS3_Rules_Node_Handbook_v1.3.0.html, PROJECT.md

---

## Source Context

This document is grounded in two primary sources: the working v1 panel (single-file JS,
~1,100 lines) and the v1.3.0 handbook (25 sections). Claims about what features exist,
what calculations they require, and what complexity they carry are HIGH confidence — they
come from reading actual implemented code, not speculation about the domain.

---

## Table Stakes

Features that are load-bearing. Without them the panel fails its stated job.
Staff would fall back to manual Discord cross-referencing immediately.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Node CRUD** | Every other feature references nodes | Low | Name, number, type, tier, owner, base upkeep, road, notes. All exist in v1. |
| **Faction CRUD** | Nodes are meaningless without owners | Low | Name, type (PvP/PvE), color, members roster. Exists in v1. |
| **Upkeep calculation** | Core formula: base × overextension multiplier × war modifier | Medium | Three-way formula with ceiling arithmetic. Auto-derives from faction node count + war count. Exists in v1. |
| **SP submission logging** | The primary staff action each cycle | Low | Item picker from SP catalogue, qty, auto-calculated SP, cap preview, staff note. Exists in v1. |
| **40% cap enforcement** | Hard rule: Raw Renewable and Currency each capped at 40% of weekly upkeep | Medium | Must calculate across all submissions for current cycle, warn in real time before adding. Exists in v1. |
| **Instability tracking** | 0–5 scale drives the weekly roll mechanic | Low | Per-node field. Increments on underpayment. Exists in v1. |
| **Weekly deadline processing** | The deadline IS the core business logic — calculates payment status, applies instability deltas, queues rolls | High | Requires knowing "overdue" state per node, applying +1/+2 instability deltas, cycling currentCycleSubmissions → cycleHistory, setting next deadline. Exists in v1 as procDeadlines(). |
| **Instability roll** | After deadline, nodes with instability > 0 need a d100 roll against instability-tier threshold | Medium | Roll result vs INSTAB_CHANCE[tier], event drawn from node-type-specific pool. Exists in v1 as rollInstab. |
| **Instability event resolution** | Staff must act on triggered events (apply SP debt, apply instability, mark RP handled, dismiss) | Medium | Per-event action buttons. Pending events queue per node. Exists in v1. |
| **War declaration and tracking** | Wars change upkeep multipliers for all PvP faction nodes | Low | Casus belli, start date, both parties. Active war drives wmul() in calcUp(). Exists in v1. |
| **Ownership transfer** | Nodes change hands during battles; records need timestamps and method | Low | peaceful / violent / contested method enum, faction-to-faction transition, note. Exists in v1. |
| **Server log** | Filterable audit trail covering all significant events | Medium | Filter by type, faction, node, text search, time sort. Exists in v1 as renderHistory(). |
| **Multi-user shared state** | v1 is localStorage-only — the defining reason for v2 | High | Backend with real-time sync across 2+ staff PCs. Does NOT exist in v1; is the primary new requirement. |
| **Authentication (staff tiers)** | Head Admin vs Staff permission boundary | Medium | Head Admin gets delete/wipe actions. Staff gets everything else. Does NOT exist in v1. |
| **Faction-scoped player portal** | Faction members see only their own nodes + global war/alliance board | Medium | Read-only views with data filtered at the query level, not CSS hide. Does NOT exist in v1. |
| **Dashboard with active alerts** | Staff needs at-a-glance situational awareness | Low | Rolls due, overdue nodes, high instability, damaged nodes, pending events. Exists in v1. |
| **SP Catalogue reference** | Staff needs to look up item SP values during submission | Low | Searchable, filterable by category and SP value. Exists in v1. |
| **Data export / import** | Backup and restore for self-hosted deployments | Low | JSON export with timestamp. Exists in v1. |

---

## Feature Details — Table Stakes Requiring Special Attention

These table stakes carry non-obvious design complexity that will affect architecture and phase ordering.

### Upkeep Calculation Chain

The effective upkeep for a node is:

```
effectiveUpkeep = ceil(baseUpkeep × overextensionMultiplier(nodeCount) × (1 + warModifier(warCount)))
```

Where:
- `overextensionMultiplier`: 1→×1.0, 2→×1.1, 3→×1.2, 4→×1.35, 5+→×1.5
- `warModifier` (PvP factions only): 1 war→+15%, 2 wars→+30%, 3+ wars→+50%
- Both multipliers auto-derive from live faction state (node count, active war count)

This calculation must be consistent everywhere: submission preview, node list, dashboard chart,
metrics, and deadline processing. A single shared calculation function is required — not repeated
inline logic.

### Deadline Processing Is a State Machine

Each node transitions through: `active → overdue → processed → reset`. The processor must:
1. Detect overdue nodes (now > deadline timestamp)
2. Calculate payment pct (paid SP / required SP)
3. Apply instability delta (+0/+1/+2) based on payment bracket
4. Move current cycle submissions to cycleHistory
5. Set `rollDue = true` if instability > 0
6. Advance deadline to next occurrence
7. Write to serverLog and node history
8. Record processed deadline key to prevent double-processing on page reload

This is the highest-complexity single function in the panel. In v1 it runs on every page load
(procDeadlines()). In v2 with a shared backend, it must run server-side on a schedule to prevent
race conditions between staff clients.

### 40% Cap Must Preview Before Commit

Staff logs submissions one at a time. The cap check must show — before the user clicks "Log" —
what the running totals will be after this submission. This requires the cap calculation to
include the candidate submission in the preview without committing it. The v1 implementation
calls `checkCaps(node, [{category, totalSP}])` with a preview array.

---

## Differentiators

Features that lift the panel from "adequate" to "excellent" for this specific use case.
None are required to run a cycle, but each meaningfully reduces staff cognitive load.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Bulk process overdue nodes** | One click processes all overdue nodes instead of node-by-node | Low | Iterate procDeadlines over filtered list. Not in v1 — v1 processes all on page load automatically. |
| **Node detail modal with tabs** | Overview / Upkeep / Output / Rolls / Battles / Ownership / History per node in one place | Medium | v1 has this (renderNodeModal with 7 stabs). The pattern itself is the differentiator vs a flat list view. |
| **Instability dot visualization** | 5-dot colored display of instability state with % chance label | Low | Pure UI. v1 has `idots()`. Very low effort, high legibility payoff. |
| **SP submission cap bar** | Progress bar showing Raw Renewable % and Currency % used vs 40% cap | Low | Prevents staff from accidentally exceeding caps and invalidating a submission. |
| **Overextension/war modifier display** | Per-faction row shows ×N overext and +N% war mod live | Low | Staff immediately sees why a faction's upkeep jumped. |
| **Weekly SP owed vs paid chart** | Bar chart per faction showing owed (faction color) vs paid (outcome color) | Medium | SVG bar chart in v1. Gives staff a cycle snapshot without reading each node. |
| **Metrics: SP by category/item/faction/node** | Donut chart + top items table | Medium | Useful for identifying faction payment patterns and potential rule abuse. |
| **Instability heat visualization** | Color-coded instability state per node on dashboard | Low | badging: paid / partial / unpaid / unstable / damaged. Exists in v1. |
| **Manual log entry** | Staff can add free-text log entries for rulings, RP events, custom notes | Low | Needed for "mark RP handled" events and staff-discretion situations. In v1 as addManualLog. |
| **Upgrade tracking with paid/unpaid state** | Log T1→T2 upgrades, track SP payment, mark paid | Low | In v1. Prevents upgrades from being forgotten mid-process. |
| **Damage toggle** | Single click marks node as damaged (50% output) or repaired | Low | Simple boolean with SP cost display. In v1. |
| **Road connection flag** | Track whether a node has a valid 3-wide road to HQ, with route description | Low | Rule reference: §44. Reduces instability pressure. One flag + optional note. |
| **Alliance/treaty history with type labels** | Color-coded labels: Alliance / NAP / Trade Agreement / Vassalage / Coalition / Custom | Low | Diplomacy ledger. Faction portal should show this (it's not secret). |
| **Faction color picker** | Color-coded faction dots throughout the UI | Low | Provides visual faction identity. In v1 with preset swatches + hex override. |
| **Wipe confirmation with verification code** | Typed code required to wipe all data | Low | Prevents accidental destruction. In v1 with VERIFY_CODE constant. |

---

## Differentiators Specific to v2 (Not Possible in v1)

These are features that become possible only because v2 has a real backend and multi-user auth.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Server-side deadline scheduler** | Deadlines auto-process at the configured day/time even if no browser is open | Medium | Cron job or background worker. Eliminates dependency on a staff member having the panel open. |
| **Real-time state sync** | Two staff members editing simultaneously see each other's changes | High | Requires either polling, websockets, or a backend that pushes changes (PocketBase subscriptions, etc.) |
| **Per-account last-seen / activity** | Know which staff logged in when | Low | Auth audit trail. Useful for accountability on small teams. |
| **Faction member login scoping** | Member logs in, sees exactly their faction's nodes — no other data visible | Medium | Row-level security at query time, not client-side filtering. |

---

## Anti-Features

Features that sound useful but would add complexity without proportional payoff for this
specific product and team size.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Discord bot integration** | Would require a separate bot process, token management, webhook configuration, and synchronization logic. Doubles the surface area. The team's workflow is Discord-verify then manually enter — the panel replaces the manual entry, not the verification. | Staff manually enters submissions as they do now. Panel is the record of truth after verification. |
| **In-game mod integration** | Would require a Vintage Story mod, its own update cycle, permission scoping on the game server, and a bidirectional API. Enormously out of scope. | Manual entry remains the data entry method. |
| **Public node map** | Faction node locations and states are strategic information. A public map leaks it. | Player portal shows only own faction nodes + global war/alliance board. Other factions' node states stay hidden. |
| **Mobile-optimized layout** | This is a staff admin tool used at a desktop during play sessions. Responsive layout adds CSS complexity for a surface that won't be used. | Desktop-first layout with reasonable minimum width (1024px). |
| **Real-time notifications / push alerts** | Push notifications (browser push API, email, Discord webhook) require auth tokens, service workers, and user permission flows. Small team; staff are already in Discord. | Dashboard alerts on next page load are sufficient. |
| **Contracts & bounties system** | Explicitly out of scope for v1 per PROJECT.md. Complex object graph (contract terms, parties, deadlines, fulfillment conditions). | Defer to a future milestone. Handbook §XVI covers this. |
| **Crimes & enforcement logging** | Out of scope for v1. Requires a separate entity type and case-file UI. | Defer to future milestone. |
| **Temporal storms / server events** | Out of scope for v1. | Defer to future milestone. |
| **Granular per-node resource output tracking** | v1 has an SMD output log and a resource notes tab per node. In practice the primary record-keeping need is the upkeep cycle. Complex output tracking creates data entry burden for staff. | Keep output tab simple: SMD log + freeform resource notes. Don't try to model full node economy output. |
| **Role-based fine-grained permissions** | Only two tiers are needed (Head Admin, Staff). A full RBAC system (roles, permissions, resource ACLs) would be over-engineered for 3–6 staff. | Two-tier auth: Head Admin flag on user record gates delete/wipe routes. |
| **CSV / PDF export reports** | Adds a reporting layer (chart libraries, PDF generation) for a team that reads the panel directly. The metrics tab is the report. | JSON backup export is sufficient. Metrics tab provides the visual summaries. |
| **Audit log for individual field edits** | Field-level change tracking (previous value → new value per edit) is significantly more complex than event-level logging. Small team with high trust. | Server log records the event (node edited, faction edited) with type and timestamp. That is sufficient. |

---

## Feature Dependencies

```
Authentication + sessions
  └─ Staff tier check (Head Admin flag)
       └─ Delete/wipe routes gated
  └─ Faction member account
       └─ Player portal (faction-scoped read-only views)

Faction CRUD
  └─ Node CRUD (owner field references factions)
       └─ Upkeep calculation (nodeCount per faction)
            └─ 40% cap enforcement (per-node per-cycle)
                 └─ SP submission logging (real-time cap preview)
                      └─ Deadline processing (calculates paid vs required)
                           └─ Instability delta application
                                └─ Instability roll (rollDue flag)
                                     └─ Event resolution (pending events queue)

War declaration
  └─ War upkeep modifier (wmul applied in calcUp)
       └─ Battle log (per-node)
            └─ Ownership transfer (battle result → node reassignment)

Alliance CRUD
  └─ Diplomacy history

Server log
  └─ All other features write to it (logEv calls)
       └─ Per-node history (addNH calls)
```

---

## MVP Recommendation

### Must ship in Phase 1 (core loop is broken without these)

1. Authentication — staff login with two tiers; faction member login with scoped portal
2. Faction CRUD — name, type, color, members roster
3. Node CRUD — name, number, type, tier, owner, base upkeep, road, notes
4. SP submission logging with real-time 40% cap enforcement
5. Upkeep calculation (the formula must be correct from day one — everything depends on it)
6. Weekly deadline processing — server-side scheduler
7. Instability delta application and roll queue
8. Instability event resolution (action buttons per pending event)
9. Dashboard with active alerts
10. Filterable server log
11. SP Catalogue reference tab
12. Data export

### Ship in Phase 2 (war/diplomacy loop)

13. War declaration and tracking with upkeep modifier auto-application
14. Battle log per node with ownership transfer
15. Siege tracking
16. Alliance/treaty CRUD with history
17. Bulk process overdue nodes action

### Ship in Phase 3 (visibility and analysis)

18. Metrics tab (SP by category/item/faction/node with charts)
19. Weekly SP owed vs paid chart on dashboard
20. Node history tab refinements
21. Upgrade tracking with paid/unpaid state

### Defer (future milestones)

- Contracts and bounties (handbook §XVI)
- Crimes and enforcement logging
- Temporal storms / server events
- Real-time multi-client sync beyond basic backend shared state (advanced websocket push)

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Table stakes features | HIGH | Read directly from v1 implementation + handbook rules |
| Calculation logic | HIGH | Read directly from v1 calcUp(), checkCaps(), procDeadlines() |
| Anti-features | HIGH | Grounded in PROJECT.md explicit out-of-scope list + complexity analysis |
| Differentiators | HIGH | v1 features confirmed present, v2 differentiators confirmed absent from v1 |
| Complexity estimates | MEDIUM | Based on v1 code reading; v2 backend implementation may shift some estimates |

---

## Key Insight for Roadmap

The feature set is well-understood and fully specified — v1 is the reference implementation
and the handbook is the rules document. The work in v2 is not discovering what to build; it is
rebuilding the same feature set correctly (multi-user, server-side, with proper auth) and
adding the three things v1 cannot support (shared state, scheduled deadlines, player portal).

The highest-risk feature is deadline processing: it is the most complex, it runs on a schedule
rather than on demand, and it must be idempotent (safe to re-run). This should be treated as
the first integration test milestone, not as a "Phase 3 polish" item.
