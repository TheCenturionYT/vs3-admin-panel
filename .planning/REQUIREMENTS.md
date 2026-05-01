# Requirements — VS3 Admin Panel v2.0.0

**Status:** v1 scope defined  
**Last updated:** 2026-05-01

---

## v1 Requirements

### Authentication & Access Control (AUTH)

- [ ] **AUTH-01**: Staff member can log in with username and password and stay logged in across page loads
- [ ] **AUTH-02**: Head Admin accounts can perform destructive actions (delete factions, delete nodes, wipe data); Staff accounts cannot
- [ ] **AUTH-03**: Faction member can log in with username and password and access the player portal
- [ ] **AUTH-04**: Faction member portal shows only that member's faction data — other factions' node states are not accessible even via direct API calls
- [ ] **AUTH-05**: Staff can create, edit, and deactivate staff accounts and faction member accounts from the admin panel
- [ ] **AUTH-06**: Per-account activity is logged (last login timestamp visible to Head Admin)

### Core Data Management (DATA)

- [ ] **DATA-01**: Staff can create, edit, and delete factions with name, type (PvP/PvE), color, and member roster
- [ ] **DATA-02**: Each faction member has a role: Leader, Officer, or Member
- [ ] **DATA-03**: Neutral Territory exists as a permanent system faction that owns all unclaimed nodes
- [ ] **DATA-04**: Staff can create, edit, and delete nodes with: name, node number, type (15 types), tier (1–4), owner faction, base upkeep SP, road connection flag and route note, notes field
- [ ] **DATA-05**: Military nodes display the correct tier label (Watchtower / Outpost / Fort / Bastion) and grant free reinforcement slots equal to their tier
- [ ] **DATA-06**: Staff can export all data as a timestamped JSON file and import a JSON backup to restore state
- [ ] **DATA-07**: SP Catalogue is accessible as a searchable, filterable reference tab showing all items with SP value, category, and demand level

### Upkeep Processing (UPKEEP)

- [ ] **UPKEEP-01**: Effective weekly upkeep per node is calculated as `ceil(baseUpkeep × overextensionMultiplier × (1 + warModifier))` where overextension scales with faction node count (1→×1.0, 2→×1.1, 3→×1.2, 4→×1.35, 5+→×1.5) and war modifier applies only to PvP factions at war (1 war→+15%, 2→+30%, 3+→+50%)
- [ ] **UPKEEP-02**: This calculation is computed from live data at read time — never stored — and is consistent across dashboard, node detail, submission preview, and deadline processing
- [ ] **UPKEEP-03**: Staff can log an upkeep submission against a node: select item from SP catalogue, enter quantity, auto-calculated SP total, optional staff note
- [ ] **UPKEEP-04**: Before committing a submission, the panel shows whether adding it would push Raw Renewable or Currency submissions past 40% of the node's weekly upkeep requirement
- [ ] **UPKEEP-05**: Staff can remove individual submissions from the current cycle
- [ ] **UPKEEP-06**: A configurable weekly deadline (day of week, hour, minute) triggers automatic processing of all owned nodes
- [ ] **UPKEEP-07**: Deadline processing calculates payment percentage (paid SP / required SP), applies instability delta (+0 if ≥100%, +1 if 50–99%, +2 if 1–49%, +2 if 0%), moves current cycle to cycle history, sets rollDue flag if instability > 0, advances deadline to next occurrence, and logs the outcome
- [ ] **UPKEEP-08**: Deadline processing is idempotent — re-running it after a crash does not double-apply instability to already-processed nodes
- [ ] **UPKEEP-09**: The deadline scheduler runs server-side on a schedule independent of any browser being open
- [ ] **UPKEEP-10**: Staff can bulk-process all overdue nodes in a single action rather than one at a time
- [ ] **UPKEEP-11**: The dashboard shows a "Last deadline run: X ago" indicator and alerts if no run has occurred in over 8 days

### Instability System (INSTAB)

- [ ] **INSTAB-01**: Each node has an instability level 0–5 with labeled states (Fully controlled / Minor unrest / Growing disorder / Serious instability / Near revolt / Open rebellion) and a corresponding instability chance % (0 / 5 / 15 / 30 / 50 / 75)
- [ ] **INSTAB-02**: When a node has instability > 0 and rollDue is true, staff can trigger a d100 instability check — if roll ≤ instability chance%, an event is triggered
- [ ] **INSTAB-03**: Triggered events are automatically selected from the node's type-specific event pool matching the v1.2.1 INSTAB_EVENTS table
- [ ] **INSTAB-04**: Each pending event shows its name, description, effect, and action buttons: Apply Instability (+N), Log SP Debt, Mark Output Penalty, Mark RP Handled, Resolve/Dismiss
- [ ] **INSTAB-05**: Staff can manually reduce a node's instability by 1 (costs 40 SP, logged as a submission)
- [ ] **INSTAB-06**: Instability roll history is logged per node with roll value, threshold, and whether an event was triggered

### Wars & Sieges (WAR)

- [ ] **WAR-01**: Staff can declare a war between two factions with a casus belli, start date, and notes
- [ ] **WAR-02**: Active wars automatically apply the war upkeep modifier to all PvP faction nodes — no manual recalculation needed
- [ ] **WAR-03**: Staff can end a war and record the outcome
- [ ] **WAR-04**: War history is retained with start date, end date, parties, and outcome
- [ ] **WAR-05**: Staff can log a battle outcome on a node: attacker, defender, description, result, and whether ownership changed
- [ ] **WAR-06**: When a battle results in ownership transfer, the ownership timeline is updated automatically with method set to "violent"
- [ ] **WAR-07**: Staff can track active sieges: attacker, defender, objectives, start time, and resolution

### Diplomacy & Alliances (DIPLO)

- [ ] **DIPLO-01**: Staff can create alliances/treaties between two or more factions with type (Alliance / NAP / Trade Agreement / Vassalage / Coalition / Custom), terms, and start date
- [ ] **DIPLO-02**: Staff can end an alliance and record the end date
- [ ] **DIPLO-03**: Alliance history is retained and visible to both staff and faction member portal users

### Player Portal (PORTAL)

- [ ] **PORTAL-01**: Authenticated faction members see their faction's nodes with: name, type, tier, current instability level, upkeep status (paid/partial/unpaid), and current cycle payment progress
- [ ] **PORTAL-02**: Faction members cannot see any other faction's node data, instability levels, or payment status — enforced at the database query level
- [ ] **PORTAL-03**: Faction members can see the global war and alliance board: active wars with parties and casus belli, active alliances with type and parties
- [ ] **PORTAL-04**: Player portal is read-only — no submission, edit, or delete actions are available to faction member accounts

### Server Log & History (LOG)

- [ ] **LOG-01**: All significant events are written to a filterable server log: upkeep deadlines, instability events, battles, ownership transfers, war declarations, alliance changes, faction changes, node changes
- [ ] **LOG-02**: Server log can be filtered by event type, faction, node, and text search, and sorted by newest or oldest first
- [ ] **LOG-03**: Each node has a per-node history log showing all events affecting that node in chronological order
- [ ] **LOG-04**: Staff can add manual free-text log entries for rulings, RP events, and staff notes

### Metrics & Reporting (METRICS)

- [ ] **METRICS-01**: Metrics tab shows SP submission totals broken down by category, item, faction, and node
- [ ] **METRICS-02**: Dashboard shows a weekly SP owed vs paid bar chart per faction
- [ ] **METRICS-03**: Node list and dashboard show instability state visually (dot indicators, color-coded badges)

### User Experience (UX)

- [ ] **UX-01**: The panel uses a refined dark gold medieval aesthetic consistent with VS3's visual identity — same core color palette as v1.2.1 (dark backgrounds, gold accents, muted text) with elevated layout, clearer information hierarchy, and more polished component styling
- [ ] **UX-02**: Staff workflows are guided — forms pre-fill where possible, the panel warns before errors (cap violations, overdue deadlines, missing required fields), and common multi-step actions (log submission → check caps → confirm) are streamlined to minimize clicks and reduce the chance of mistakes

### Deployment (DEPLOY)

- [ ] **DEPLOY-01**: The application can be deployed by a non-developer following a step-by-step written guide with no prior coding experience required
- [ ] **DEPLOY-02**: Multiple staff members on different PCs can access the same panel simultaneously with real-time shared state
- [ ] **DEPLOY-03**: The deployment does not require paid third-party SaaS beyond the hosting provider

---

## v2 Requirements (Deferred)

- Contracts & bounties system (handbook §XVIII)
- Crimes & enforcement case logging (handbook §XVII)
- Temporal storms / server events scheduling (handbook §XV)
- Real-time push notifications to Discord
- Mobile-optimized layout

---

## Out of Scope

- **Discord bot integration** — team's workflow is Discord-verify then manually enter; panel replaces the record-keeping, not the verification
- **In-game mod integration** — would require a separate Vintage Story mod, out of scope
- **Public node map** — faction node states are strategic information; other factions must not see them
- **Mobile layout** — admin tool used on desktop during play sessions
- **Granular field-level audit logging** — event-level server log is sufficient for a 3–6 person high-trust team
- **CSV/PDF export reports** — metrics tab + JSON export is sufficient

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| AUTH-01 | Phase 1 — Foundation | Pending |
| AUTH-02 | Phase 1 — Foundation | Pending |
| AUTH-03 | Phase 1 — Foundation | Pending |
| AUTH-04 | Phase 1 — Foundation | Pending |
| AUTH-05 | Phase 1 — Foundation | Pending |
| AUTH-06 | Phase 1 — Foundation | Pending |
| DEPLOY-01 | Phase 1 — Foundation | Pending |
| DEPLOY-02 | Phase 1 — Foundation | Pending |
| DEPLOY-03 | Phase 1 — Foundation | Pending |
| UX-01 | Phase 1 — Foundation | Pending |
| UX-02 | Phase 1 — Foundation | Pending |
| DATA-01 | Phase 2 — Core Data & Wars | Pending |
| DATA-02 | Phase 2 — Core Data & Wars | Pending |
| DATA-03 | Phase 2 — Core Data & Wars | Pending |
| DATA-04 | Phase 2 — Core Data & Wars | Pending |
| DATA-05 | Phase 2 — Core Data & Wars | Pending |
| DATA-06 | Phase 2 — Core Data & Wars | Pending |
| DATA-07 | Phase 2 — Core Data & Wars | Pending |
| WAR-01 | Phase 2 — Core Data & Wars | Pending |
| WAR-02 | Phase 2 — Core Data & Wars | Pending |
| WAR-03 | Phase 2 — Core Data & Wars | Pending |
| WAR-04 | Phase 2 — Core Data & Wars | Pending |
| WAR-05 | Phase 2 — Core Data & Wars | Pending |
| WAR-06 | Phase 2 — Core Data & Wars | Pending |
| WAR-07 | Phase 2 — Core Data & Wars | Pending |
| DIPLO-01 | Phase 2 — Core Data & Wars | Pending |
| DIPLO-02 | Phase 2 — Core Data & Wars | Pending |
| DIPLO-03 | Phase 2 — Core Data & Wars | Pending |
| LOG-01 | Phase 2 — Core Data & Wars | Pending |
| LOG-02 | Phase 2 — Core Data & Wars | Pending |
| LOG-03 | Phase 2 — Core Data & Wars | Pending |
| LOG-04 | Phase 2 — Core Data & Wars | Pending |
| METRICS-03 | Phase 2 — Core Data & Wars | Pending |
| UPKEEP-01 | Phase 3 — Upkeep Engine & Automation | Pending |
| UPKEEP-02 | Phase 3 — Upkeep Engine & Automation | Pending |
| UPKEEP-03 | Phase 3 — Upkeep Engine & Automation | Pending |
| UPKEEP-04 | Phase 3 — Upkeep Engine & Automation | Pending |
| UPKEEP-05 | Phase 3 — Upkeep Engine & Automation | Pending |
| UPKEEP-06 | Phase 3 — Upkeep Engine & Automation | Pending |
| UPKEEP-07 | Phase 3 — Upkeep Engine & Automation | Pending |
| UPKEEP-08 | Phase 3 — Upkeep Engine & Automation | Pending |
| UPKEEP-09 | Phase 3 — Upkeep Engine & Automation | Pending |
| UPKEEP-10 | Phase 3 — Upkeep Engine & Automation | Pending |
| UPKEEP-11 | Phase 3 — Upkeep Engine & Automation | Pending |
| INSTAB-01 | Phase 3 — Upkeep Engine & Automation | Pending |
| INSTAB-02 | Phase 3 — Upkeep Engine & Automation | Pending |
| INSTAB-03 | Phase 3 — Upkeep Engine & Automation | Pending |
| INSTAB-04 | Phase 3 — Upkeep Engine & Automation | Pending |
| INSTAB-05 | Phase 3 — Upkeep Engine & Automation | Pending |
| INSTAB-06 | Phase 3 — Upkeep Engine & Automation | Pending |
| METRICS-01 | Phase 3 — Upkeep Engine & Automation | Pending |
| METRICS-02 | Phase 3 — Upkeep Engine & Automation | Pending |
| PORTAL-01 | Phase 4 — Player Portal | Pending |
| PORTAL-02 | Phase 4 — Player Portal | Pending |
| PORTAL-03 | Phase 4 — Player Portal | Pending |
| PORTAL-04 | Phase 4 — Player Portal | Pending |
