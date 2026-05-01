# Roadmap — VS3 Admin Panel v2.0.0

**Milestone:** v1.0 (full v1 scope)
**Granularity:** Coarse
**Coverage:** 56/56 requirements mapped
**Last updated:** 2026-05-01
**Phase 1 completed:** 2026-05-01

---

## Phases

- [x] **Phase 1: Foundation** — PocketBase schema, auth system, staff login, role enforcement, and deployment scaffold ✓ 2026-05-01
- [ ] **Phase 2: Core Data & Wars** — Faction/Node/War/Diplomacy CRUD, ownership timeline, logs, and dashboard baseline
- [ ] **Phase 3: Upkeep Engine & Automation** — SP submissions, cap enforcement, deadline processor, instability system, and metrics
- [ ] **Phase 4: Player Portal** — Faction-scoped read-only portal with war/alliance board

---

## Phase Details

### Phase 1: Foundation
**Goal**: Staff can log in, roles are enforced at the database level, and the application is deployable by a non-developer
**Depends on**: Nothing
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, DEPLOY-01, DEPLOY-02, DEPLOY-03, UX-01, UX-02
**Success Criteria** (what must be TRUE):
  1. A staff member can open the app, log in with username/password, and stay logged in after closing and reopening the browser
  2. A Head Admin can perform a destructive action (e.g., delete a record) that a Staff account cannot — enforced at the PocketBase collection rule level, not just the UI
  3. A faction member account can be created and logged in, but attempting to query another faction's data via a direct API call returns an error or empty result
  4. A non-developer can follow the written deployment guide and have the application running on a fresh server with no prior coding experience
**Plans**: 6 plans in 3 waves

**Wave 1**
- [x] 01-01-PLAN.md — Project scaffold (SvelteKit, dependencies, adapter-node, VS3 palette)
- [x] 01-02-PLAN.md — PocketBase schema documentation and pb_hooks scheduler placeholder

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-03-PLAN.md — Auth foundation (hooks.server.ts, login, logout, route guards)
- [x] 01-04-PLAN.md — App shell (sidebar, topbar, stub pages for Dashboard and Server Log)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-05-PLAN.md — Staff Management page (account tables, Add/Edit modal, Deactivate dialog)
- [x] 01-06-PLAN.md — Deployment infrastructure (Dockerfiles, docker-compose.yml, DEPLOYMENT.md)

**Cross-cutting constraints:** Head Admin enforced at route AND collection rule level; shadcn init runs before VS3 palette is written to app.css; prerender=false on all authenticated routes
**UI hint**: yes

### Phase 2: Core Data & Wars
**Goal**: Staff can fully manage factions, nodes, wars, alliances, and all related history through the admin panel
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, WAR-01, WAR-02, WAR-03, WAR-04, WAR-05, WAR-06, WAR-07, DIPLO-01, DIPLO-02, DIPLO-03, LOG-01, LOG-02, LOG-03, LOG-04, METRICS-03
**Success Criteria** (what must be TRUE):
  1. Staff can create a faction with members and roles, create nodes assigned to that faction, and immediately see overextension and war modifiers auto-calculated on the faction view
  2. Staff can declare a war between two PvP factions and observe that the war upkeep modifier is instantly reflected in those factions' node upkeep displays — no manual recalculation
  3. Staff can log a battle outcome that results in ownership transfer, and the node's ownership timeline shows the new owner with method "violent" and the correct timestamp
  4. The server log shows filterable entries for faction changes, node changes, war declarations, alliance changes, and staff can add a free-text manual log entry
**Plans**: TBD
**UI hint**: yes

### Phase 3: Upkeep Engine & Automation
**Goal**: The weekly upkeep cycle runs automatically — staff logs submissions, the scheduler processes the deadline, instability events surface with action buttons, and the dashboard reports scheduler health
**Depends on**: Phase 2
**Requirements**: UPKEEP-01, UPKEEP-02, UPKEEP-03, UPKEEP-04, UPKEEP-05, UPKEEP-06, UPKEEP-07, UPKEEP-08, UPKEEP-09, UPKEEP-10, UPKEEP-11, INSTAB-01, INSTAB-02, INSTAB-03, INSTAB-04, INSTAB-05, INSTAB-06, METRICS-01, METRICS-02
**Success Criteria** (what must be TRUE):
  1. Staff can log an SP submission against a node and see a real-time warning before committing if Raw Renewable or Currency submissions would exceed 40% of that node's effective weekly upkeep
  2. At the configured deadline time, all owned nodes are automatically processed server-side with no browser open — payment status is calculated, instability deltas applied, and the cycle is moved to history; re-running the processor does not double-apply instability to already-processed nodes
  3. Nodes with instability > 0 and rollDue set show an actionable instability check on the dashboard — staff triggers a d100 roll, an event from the correct type-specific pool is presented if triggered, and staff resolves it via action buttons
  4. The dashboard shows "Last deadline run: X ago" and displays an alert if no run has occurred in over 8 days; the metrics tab shows SP submission totals by category, item, faction, and node alongside a weekly SP owed vs paid chart per faction
**Plans**: TBD
**UI hint**: yes

### Phase 4: Player Portal
**Goal**: Authenticated faction members can view their own faction's data and the global war/alliance board — and nothing else
**Depends on**: Phase 3
**Requirements**: PORTAL-01, PORTAL-02, PORTAL-03, PORTAL-04
**Success Criteria** (what must be TRUE):
  1. A logged-in faction member sees their own faction's nodes with current instability level, upkeep status, and cycle payment progress — and cannot see any other faction's node data even by crafting a direct API request
  2. A faction member can view the global war and alliance board showing all active wars (parties, casus belli) and active alliances (type, parties) — all other admin write actions are absent from the portal UI
**Plans**: TBD
**UI hint**: yes

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 6/6 | Complete | 2026-05-01 |
| 2. Core Data & Wars | 0/? | Not started | - |
| 3. Upkeep Engine & Automation | 0/? | Not started | - |
| 4. Player Portal | 0/? | Not started | - |
