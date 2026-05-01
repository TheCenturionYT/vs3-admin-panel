# Domain Pitfalls

**Project:** VS3 Admin Panel v2
**Domain:** Self-hosted multi-user web admin panel with auth, RBAC, scheduled jobs, and complex business logic migration
**Researched:** 2026-05-01
**Confidence:** HIGH (patterns are well-established and domain-specific to this project's exact combination of risks)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or security breaches.

---

### Pitfall C1: Authorization Checked Only on the Frontend

**What goes wrong:** The player portal hides other factions' node data in the UI, but the API endpoint that fetches node data returns all factions' records without a server-side ownership check. Any faction member who opens browser DevTools and calls the API directly sees every node's state — which is explicitly a strategic secret per PROJECT.md.

**Why it happens:** The developer (in this case, the AI writing the code) wires up RBAC in the React/Vue component layer first because it's visible and testable. The API route is written to "just return the data" and the filtering is trusted to happen client-side. This is a classic confused deputy problem.

**Consequences:** Faction espionage. The player portal's entire privacy guarantee is defeated. Trust in the platform collapses if discovered.

**Prevention:**
- Every API route that returns node, faction, or upkeep data must filter by the authenticated user's `faction_id` on the server before returning any rows.
- Rule: if the UI hides it, the API must also refuse to return it. The UI filter is cosmetic; the API filter is the security boundary.
- In any ORM/query layer, build a reusable `scopeToFaction(userId)` query helper that is called automatically for player-role requests. Never allow a "return all" query to reach the wire for a faction-scoped user.
- Write an integration test that calls node endpoints as a faction-member token and asserts that zero rows from other factions appear in the response.

**Warning signs:**
- API routes are written to return `SELECT * FROM nodes` with no WHERE clause, relying on the caller to filter.
- No test exists that logs in as a faction member and hits the raw API.
- The word "filter" appears only in frontend component code, not in backend route handlers.

**Phase:** Must be addressed in the auth + RBAC phase (Phase 2 or equivalent). Do not defer to a "security pass" — by then, all routes will be written in the permissive pattern and the fix becomes a full audit.

---

### Pitfall C2: Plaintext or Weakly-Hashed Passwords Stored in SQLite

**What goes wrong:** Passwords are stored as MD5, SHA1, or base64 — or in the absolute worst case, plaintext — in the database file. Because this is self-hosted, the database file sits on a machine the non-developer host controls, and it may be copied, backed up to cloud storage, or inadvertently exposed.

**Why it happens:** The app is "just for a small team," security feels like over-engineering, and a quick `crypto.createHash('sha256')` feels like it counts. It doesn't.

**Consequences:** If the SQLite file is ever copied or exposed, all passwords are cracked within minutes. Staff reuse passwords. Real accounts get compromised.

**Prevention:**
- Use bcrypt (cost factor 12) or Argon2id. Both are available as well-maintained npm packages (`bcryptjs`, `argon2`).
- If using PocketBase, password hashing is handled correctly by default — do not bypass it with raw SQL inserts.
- Never write a seeding script or "reset password" admin command that accepts a plaintext password and stores it directly.

**Warning signs:**
- Any `require('crypto').createHash` call in a password storage path.
- A database seeding script that INSERTs a user row with a `password` column that isn't the output of a dedicated password hashing library.
- "I'll add proper hashing later" as a comment in the code.

**Phase:** Phase 1 (initial auth implementation). Non-negotiable from the first commit that writes a user record.

---

### Pitfall C3: Session Tokens That Never Expire or Are Stored Insecurely

**What goes wrong:** JWTs are issued with no expiry (or a 10-year expiry), or session tokens are stored in `localStorage` instead of `HttpOnly` cookies. A stolen token grants permanent access with no revocation path.

**Why it happens:** Expiring tokens create UX friction (users get logged out). `localStorage` is easy to read from JavaScript and feels simpler than cookie configuration.

**Consequences:** If any staff member's browser or device is compromised, or if an XSS vulnerability exists anywhere in the app, the attacker holds a permanent admin credential. For a panel that can delete nodes and wipe faction data, this is catastrophic.

**Prevention:**
- Access tokens: 15-minute to 1-hour expiry. Refresh tokens: 7–14 days, rotated on use.
- Store tokens in `HttpOnly; Secure; SameSite=Strict` cookies, not `localStorage` or `sessionStorage`.
- Implement a server-side token revocation table (even a simple "invalidated_tokens" set) so a compromised session can be killed without waiting for expiry.
- For a small staff team, a simple "log out everywhere" button that invalidates all sessions for a user is sufficient.

**Warning signs:**
- JWT `exp` field is absent or set to years in the future.
- `localStorage.setItem('token', ...)` anywhere in the auth flow.
- No logout endpoint that actually invalidates the token server-side (just deleting the client cookie is not enough for JWTs).

**Phase:** Phase 2 (auth implementation). The cookie/expiry configuration is set once and must be right at the start.

---

### Pitfall C4: Head Admin Privilege Escalation via Unguarded API Routes

**What goes wrong:** The UI correctly hides "Delete Node" and "Wipe Faction" buttons for Staff-role users. But the API endpoints `DELETE /nodes/:id` and `POST /factions/:id/wipe` have no role check — they only verify that the user is authenticated (any valid session). A Staff user who finds the route can invoke it directly.

**Why it happens:** Role checks are added to the frontend rendering logic ("show this button only if `user.role === 'head_admin'`") but the backend route middleware only checks `isAuthenticated`, not `isHeadAdmin`.

**Consequences:** Any Staff member can perform destructive actions. For a real staff team with potential interpersonal friction, this is a serious trust and data integrity risk.

**Prevention:**
- Every destructive route (`DELETE`, bulk operations, wipe actions) must have a `requireRole('head_admin')` middleware applied at the route definition level, not at the controller level.
- Create a middleware hierarchy: `requireAuth` → `requireStaff` → `requireHeadAdmin`. Each is its own function. Never inline the check.
- Audit: for every button in the UI that is hidden based on role, there must be a corresponding backend middleware assertion for that same role.

**Warning signs:**
- Backend routes use `requireAuth` as a catch-all without role-specific middleware for destructive actions.
- Role checks appear in frontend components but not in backend route files.
- No test that calls a DELETE endpoint with a Staff-role token and asserts a 403 response.

**Phase:** Phase 2 (auth + RBAC). Must be part of the middleware architecture, not an afterthought.

---

### Pitfall C5: Scheduled Job Silently Fails and Nobody Notices

**What goes wrong:** The weekly upkeep deadline processor runs as a `node-cron` job (or equivalent). One week it throws an uncaught exception — maybe a node has a null `base_upkeep`, maybe the database is locked, maybe the server was being restarted at exactly midnight on deadline day. The job exits silently. No instability events are generated, no payment statuses are updated, and the game data is now wrong. Staff discovers this days later when faction data looks off.

**Why it happens:** Scheduled jobs are wired up and tested once during development, then forgotten. Error handling inside the job callback is minimal. There is no alerting because "it's just a small app." The non-developer host has no idea how to check cron logs.

**Consequences:** Silent data corruption. Missed instability rolls. Upkeep cycles out of sync with the game. Staff spends hours manually reconstructing what the automated processor should have done.

**Prevention:**
- Wrap the entire job callback in a try/catch. On error: log the full stack trace to a persistent log file AND write a `job_run_log` database row with `status: 'FAILED'` and the error message.
- Build a visible "Last Run" dashboard widget on the admin panel home screen showing: last run time, status (SUCCESS/FAILED), and a summary (N nodes processed, M events generated). Staff will see a FAILED status on their next login.
- Store all job runs in a `scheduled_job_runs` table. Include a "run now" button (Head Admin only) so a failed job can be manually re-triggered without restarting the server.
- Make the job idempotent: running it twice for the same deadline week should detect that the deadline was already processed and skip, not double-apply instability.

**Warning signs:**
- The cron callback has no try/catch.
- No database table tracking job run history.
- The only way to know if a job ran is to SSH into the server and check stdout logs (which the non-developer host cannot do).
- The job is not idempotent — running it twice would corrupt data.

**Phase:** Phase 3 (scheduling). The logging infrastructure must be built alongside the first scheduled job, not added later.

---

### Pitfall C6: SQLite Write Contention Under Concurrent Use

**What goes wrong:** SQLite supports only one concurrent writer. When multiple staff members are using the panel simultaneously — one logging an upkeep submission, another updating a node, while the scheduled job also fires — writes queue and some fail with `SQLITE_BUSY` errors. The app surfaces this as a cryptic 500 error or silently drops the write.

**Why it happens:** SQLite feels like "just a file" and concurrent access is an afterthought. The issue is invisible during solo development testing.

**Consequences:** Lost upkeep submissions. Node updates that appeared to save but didn't. Intermittent errors that the non-developer host cannot diagnose.

**Prevention:**
- Enable WAL (Write-Ahead Logging) mode: `PRAGMA journal_mode=WAL;` — this allows one writer and multiple concurrent readers, which fits VS3's usage pattern perfectly.
- Set a busy timeout: `PRAGMA busy_timeout=5000;` — rather than immediately failing, SQLite will retry for 5 seconds.
- In the application layer, wrap all writes in a transaction with retry logic (most SQLite ORMs support this via `db.transaction()`).
- Use a single shared database connection instance across the app (not a new connection per request), configured with WAL mode on startup.

**Warning signs:**
- No `PRAGMA journal_mode=WAL` in the database initialization script.
- A new `Database(path)` instance created per-request rather than a singleton.
- No `busy_timeout` set.
- Concurrent-write tests never run during development.

**Phase:** Phase 1 (database setup). WAL mode must be enabled when the database is first initialized.

---

## Moderate Pitfalls

Mistakes that cause significant rework but not catastrophic failure.

---

### Pitfall M1: Overextension and War Modifier Logic Ported Incorrectly

**What goes wrong:** The overextension multiplier and war modifier calculations are re-implemented in the backend from memory or from a partial reading of the v1.2.1 HTML source. The formula is slightly wrong — an off-by-one in the node tier thresholds, or the war modifier stacking behavior differs from the handbook. Upkeep values are wrong for weeks before anyone notices.

**Why it happens:** The business logic in VS3_Panel_1_2_1.html is reference implementation — it is the source of truth. Rewriting it from the handbook alone risks misreading the rules. The handbook and the implementation may differ in edge cases (the implementation has already resolved ambiguities the handbook leaves open).

**Consequences:** Upkeep amounts are calculated incorrectly. Players paying the right amount per the rules are flagged as underpaying. Staff trust in the panel is destroyed.

**Prevention:**
- Treat VS3_Panel_1_2_1.html as the authoritative reference for all calculations, not the handbook. Where they conflict, the handbook governs — but differences must be explicitly identified and resolved.
- Port calculation functions one at a time, with unit tests that use known inputs and expected outputs derived from the v1.2.1 UI.
- Before launch, run parallel processing: enter one full week's worth of real submissions into both v1.2.1 and v2, compare every calculated value. Any delta is a bug.
- Do not skip the instability chance roll formula — it has specific node-type weighting that is easy to miss.

**Warning signs:**
- Backend calculation functions were written from the handbook prose, not by reading the v1.2.1 JavaScript implementation.
- No unit tests for the overextension multiplier, war modifier, or instability chance functions.
- The parallel-verification step is skipped because "it seemed fine in testing."

**Phase:** Phase 2–3 (upkeep processing). The calculation module should be tested in isolation before being wired to any UI.

---

### Pitfall M2: Deployment Guide Assumes Developer Knowledge

**What goes wrong:** The beginner deployment guide says things like "configure your environment variables," "ensure Node.js is on your PATH," or "run the migration script" without explaining what those phrases mean or how to verify they worked. The non-developer host gets stuck at step 3, cannot diagnose why, and either gives up or corrupts the database trying random things.

**Why it happens:** The guide is written by someone (or an AI) who finds these steps obvious. The gap between "knows what PATH means" and "does not know what PATH means" is enormous and invisible to the writer.

**Consequences:** Failed deployment. The non-developer cannot run the app at all. All the development work is inaccessible.

**Prevention:**
- Write the guide assuming the reader has never opened a terminal. Every step includes the exact command to type, the expected output, and what to do if the output looks different.
- Include a "verify this step worked" checkpoint after every major step (e.g., "You should see 'Server running on port 3000' — if you see an error instead, see Troubleshooting section X").
- Provide a `start.bat` / `start.sh` wrapper script that runs all startup steps (dependency check, database init, server start) in one command.
- Test the guide with the actual non-developer host before considering deployment "done." A guide that has never been used by its target audience is not a guide — it is a draft.

**Warning signs:**
- The guide uses jargon without defining it ("env vars," "daemon," "port forwarding").
- No troubleshooting section.
- The guide was written by the developer (or AI) and never walked through by the actual user.
- Steps assume tools are already installed without explaining how to install them.

**Phase:** Final deployment phase. But the wrapper script design should be decided in Phase 1 so the tech stack accommodates it.

---

### Pitfall M3: The Weekly Deadline Processor Is Not Idempotent

**What goes wrong:** The scheduled job runs, generates instability events, and updates payment statuses. Due to a server restart or a transient error, it runs a second time for the same deadline week. Now every node has double the instability delta, some nodes have two conflicting payment status records, and the SP submission history is wrong.

**Why it happens:** Idempotency is not a natural consideration when writing a "run once per week" job. The developer tests it once, it works, and the double-run scenario is never considered.

**Consequences:** Corrupted instability values. Double-charged factions. History log has duplicate entries. Manual cleanup required.

**Prevention:**
- Before processing any deadline, check `SELECT * FROM deadline_runs WHERE week_id = ?`. If a record exists with `status = 'COMPLETE'`, skip the run entirely and log a warning.
- All deadline processing happens inside a single database transaction. If any step fails, the entire transaction rolls back — no partial state is committed.
- The "run now" manual trigger must also respect the idempotency check (with a Head Admin override option if they knowingly need to re-run a failed partial run).

**Warning signs:**
- No `deadline_runs` table or equivalent "has this week been processed?" check.
- The job callback does not use a database transaction.
- A manual "run now" button has no warning about double-running.

**Phase:** Phase 3 (scheduling). Design idempotency before writing the first line of the processor.

---

### Pitfall M4: The Player Portal Leaks War/Alliance Relationships Via Inference

**What goes wrong:** The player portal correctly hides other factions' node details, but shows the "global war/alliance board" (per PROJECT.md requirements). A war declaration includes both factions by name. An alliance record names both parties. A faction member can now infer the resource pressure their enemies are under even without seeing node states — because knowing "Faction X is at war with Faction Y AND Faction Z simultaneously" is itself strategic information.

**Why it happens:** The requirement says "show global war/alliance board" and the implementation shows it faithfully. Nobody considered that the board itself is meta-information about other factions' political and military state.

**Consequences:** The privacy model is partially undermined. Faction members learn more than intended about rivals.

**Prevention:**
- Before implementing the war/alliance board, get explicit confirmation from the project owner on what level of global information faction members should see. "Global board" may mean "wars their own faction is in," not "all wars on the server."
- Default to minimal disclosure: show only wars and alliances involving the logged-in user's own faction. Show the existence of other wars as a count ("2 other active wars") without naming the parties.
- Document the decision explicitly in PROJECT.md Key Decisions so it is not accidentally reversed later.

**Warning signs:**
- The war/alliance board query returns all war records without filtering by `faction_id`.
- The requirement "global war/alliance board" is implemented as literally all-public without confirmation of scope.

**Phase:** Phase 2 (player portal). Clarify scope before building the board query.

---

### Pitfall M5: MVP Creep Delays the Upkeep Automation Core

**What goes wrong:** The roadmap starts adding "while we're in there" features — siege timers with real-time countdown UIs, rich metrics charts, instability heat maps — before the core upkeep automation loop is complete and tested. The project grows without ever delivering its core value ("process an entire weekly deadline in minutes").

**Why it happens:** The full feature list in PROJECT.md is large and compelling. Each phase adds features that seem "close to done." The scheduled deadline processor is unglamorous infrastructure that gets deprioritized in favor of visible UI work.

**Consequences:** The server's next upkeep cycle comes and staff still cannot use the panel for its primary purpose. The backlog grows. The project drifts into perpetual almost-done status.

**Prevention:**
- Phase 1 must deliver exactly one thing: staff can log an upkeep submission against a node and the system stores it correctly with correct calculations.
- Phase 2 must deliver the automated deadline processor end-to-end, including the instability event workflow, before any metrics, siege timers, or chart features are built.
- Treat metrics, heat maps, and rich history views as Phase 4+ features that only exist if Phase 1–3 are complete and validated by a real deadline run.
- Use the PROJECT.md "Core Value" statement as a gating question: "Does this feature directly serve 'process an entire weekly deadline in minutes'?" If no, it is deferred.

**Warning signs:**
- Metrics and chart work is started before the first scheduled deadline run has been completed end-to-end.
- The phase plan includes "nice to have" UI polish tasks before the processor is tested with real data.
- The siege timer UI is built before the upkeep deadline processor is proven.

**Phase:** Roadmap planning. The phase ordering must front-load the deadline processor explicitly.

---

## Minor Pitfalls

Mistakes that cause friction but are recoverable.

---

### Pitfall L1: No Audit Trail for Head Admin Destructive Actions

**What goes wrong:** A Head Admin deletes a node or wipes a faction's data. There is no record of who did it, when, or what the state was before deletion. The action cannot be reviewed or reversed.

**Why it happens:** The app is "for a trusted team" so audit logging feels like over-engineering. Hard deletes are simpler to implement than soft deletes with history.

**Prevention:**
- All destructive operations (DELETE node, DELETE faction, wipe data) should perform a soft delete (set `deleted_at` timestamp, archive the row) rather than a hard DELETE.
- Log every destructive action to the server event log with `actor_user_id`, `action`, `entity_type`, `entity_id`, and a JSON snapshot of the pre-deletion state.
- The server event log is already required in PROJECT.md — destructive actions are just one more event type to include.

**Warning signs:**
- DELETE SQL is used directly for permanent records.
- No `deleted_at` column or archive table.

**Phase:** Phase 1 (data model). Soft delete architecture must be in the schema from day one.

---

### Pitfall L2: The Database File Is Not Backed Up

**What goes wrong:** The SQLite database file (`vs3.db`) lives in the project directory on the non-developer's server. The server is wiped, crashes, or the file is accidentally deleted during an `npm install` that cleans the directory. All game data is lost.

**Why it happens:** Backup is "the user's responsibility" and not considered during development. The non-developer host does not know they need to back up a specific file.

**Prevention:**
- The deployment guide must explicitly name the database file path and state: "This is the only file that contains all your game data. Back it up regularly."
- Consider building a "Download Backup" button in the Head Admin panel that streams the SQLite file as a download. This makes backup a one-click operation the non-developer can actually perform.
- The startup wrapper script (`start.sh`) should optionally copy the database to a dated backup file on startup (e.g., `vs3_backup_2026-05-01.db`), keeping the last 7.

**Warning signs:**
- The deployment guide does not mention the database file by name.
- There is no backup mechanism of any kind.

**Phase:** Deployment phase. The backup button is a low-effort, high-value safety net.

---

### Pitfall L3: Real-Time Cap Enforcement Has Race Condition

**What goes wrong:** The 40% Raw Renewable / Currency cap (per PROJECT.md) is enforced client-side when a staff member enters a submission. Two staff members enter submissions simultaneously, both pass the cap check independently because they each see the current total before the other's write commits. The combined submissions exceed the cap.

**Why it happens:** The cap check reads from the database, then the write happens. With two concurrent writers, two reads can happen before either write, both showing the cap as not exceeded.

**Prevention:**
- Move the cap check inside the same database transaction as the INSERT for the submission row. Use a `SELECT SUM(sp_value) FOR UPDATE` (or SQLite equivalent — a deferred transaction that re-reads inside the transaction) immediately before the insert.
- In SQLite, use a single transaction that reads the current total and inserts the new record atomically. If the total would exceed the cap, the transaction rolls back and the API returns a 409 Conflict with the cap violation message.
- The client-side cap warning is still useful as UX (show before they even submit), but must not be the only enforcement point.

**Warning signs:**
- The cap check SQL query is executed before the transaction opens for the INSERT.
- The cap check is only in the frontend validation function.

**Phase:** Phase 2 (upkeep submission). The transactional pattern must be established from the first write path.

---

### Pitfall L4: Environment-Specific Configuration Hardcoded Into Source

**What goes wrong:** The database file path, port number, JWT secret, or session secret is hardcoded in the source files. The non-developer host cannot change the port without editing JavaScript. The JWT secret is committed to version control (or the same secret is used by everyone who deploys the app from the same repo).

**Why it happens:** Environment variables feel like complexity when "it works on my machine." Hardcoding is faster during development and easy to forget to externalize before shipping.

**Consequences:** Security: a hardcoded JWT secret in a public or shared repo means anyone can forge tokens. Flexibility: the non-developer cannot move the database or change the port without editing code.

**Prevention:**
- All configuration goes in a `.env` file from day one. A `.env.example` with placeholder values is committed; `.env` is gitignored.
- The startup guide walks the user through copying `.env.example` to `.env` and filling in the values (with sensible defaults pre-filled where safe).
- Generate a random JWT secret as part of the first-run setup — either a script that writes it to `.env`, or a startup check that generates and persists one if absent.

**Warning signs:**
- `const SECRET = 'mysecret'` anywhere in source.
- The port is defined as a literal number rather than `process.env.PORT || 3000`.
- `.env` is in `.gitignore` but `.env.example` does not exist.

**Phase:** Phase 1 (project setup). The `.env` pattern must be established before any secrets are introduced.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Auth implementation | Tokens stored in localStorage; no expiry | Use HttpOnly cookies + short expiry from day one (C3) |
| RBAC / player portal | Server-side filter missing; only UI hides data | requireFactionScope middleware on every data route (C1) |
| Head Admin actions | Role check only on frontend | requireRole('head_admin') middleware on every destructive route (C4) |
| Password storage | Weak hash or plaintext in SQLite | bcrypt cost 12 or Argon2id, no exceptions (C2) |
| Database setup | SQLite write contention under concurrent use | WAL mode + busy_timeout on init (C6) |
| Data model | Hard deletes lose history | Soft delete + audit log in schema from day one (L1) |
| Env config | Secrets hardcoded in source | .env pattern + .env.example before any secret exists (L4) |
| Calculation porting | Business logic re-derived from handbook, not v1.2.1 JS | Unit test each formula against known v1.2.1 outputs (M1) |
| Upkeep submission | Cap check has race condition | Transactional cap check inside the INSERT transaction (L3) |
| Scheduling | Job fails silently | job_run_log table + dashboard status widget (C5) |
| Scheduling | Job double-runs and corrupts data | Idempotency check before processing any deadline (M3) |
| Player portal | War board leaks faction intelligence | Confirm scope: own-faction-only vs. truly global (M4) |
| Deployment guide | Written for developers, not beginners | Test guide with actual non-developer host (M2) |
| Roadmap / scope | Metrics and UI built before deadline processor | Gate Phase 4+ features on completed deadline run (M5) |
| Backups | SQLite file not backed up | Backup button + startup copy in wrapper script (L2) |

---

## Sources

**Confidence note:** WebSearch and Bash tool access were denied in this research session. Findings are drawn from established security engineering knowledge (OWASP auth guidelines, SQLite concurrency documentation, Node.js scheduling patterns) and direct analysis of the PROJECT.md requirements. All pitfalls are grounded in the specific combination of this project's constraints: non-developer deployer, SQLite backend, Node.js scheduling, faction-scoped RBAC, and complex business logic migration. Confidence is HIGH because these are recurring, well-documented failure modes in exactly this class of application.

- OWASP Authentication Cheat Sheet — session management and token storage guidance
- OWASP Authorization Testing Guide — server-side enforcement requirement
- SQLite WAL documentation — concurrent write handling
- OWASP Cryptographic Storage Cheat Sheet — password hashing standards
- PROJECT.md (VS3 Admin Panel v2) — primary source for domain-specific risk identification
