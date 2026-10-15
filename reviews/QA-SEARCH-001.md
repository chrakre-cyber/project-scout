# QA-SEARCH-001 — search and storage follow-up

15 October 2026. Status: REVIEW / authenticated smoke test pending.

Scope: reconcile DEV-005A / DEV-005B0 review evidence, inspect current hosted access configuration without changing data, and correct inaccurate retention wording. No deployment, database mutation, provider integration or credential change.

## Confirmed today

Connected to the configured hosted database as the existing restricted `scout_ingest` role, with certificate validation enabled. Ran only SELECT queries on PostgreSQL system metadata inside a read-only transaction, then rolled it back. Did not read tenant records or print connection details/secrets.

- RLS is enabled on dealerships, dealership_members, search_agents, search_runs and search_run_results.
- `scout_ingest` has no superuser, BYPASSRLS, create-role or create-database permission. No direct table SELECT/INSERT/UPDATE/DELETE privileges on the five tables checked. Column checks on search_runs/search_run_results also show no SELECT/INSERT/UPDATE for this role.
- The five expected trusted functions exist as SECURITY DEFINER and are executable by scout_ingest. Ordinary `authenticated` users cannot execute them.
- Ordinary users can insert only agent_id, requested_agent_version, request_token and provider into search_runs, cannot update its columns, and cannot insert/update result columns.
- Hosted SELECT policies require own dealership and unexpired records. search_runs additionally requires an active rights profile; search_run_results follows the visible parent run. This confirms the visibility policy correction is present hosted.

These are metadata checks, not a new behavioural proof of isolation between two logged-in firms. Function bodies, all possible grants/role memberships and all runtime paths have not been exhaustively audited here.

## Correction

The run detail page promised automatic deletion at expires_at although periodic purge is not configured. Changed the label to `Utløper senest` and explained that records become hidden at expiry (or earlier when rights cease), physical deletion happens during cleanup, and automatic cleanup is not yet configured. Updated the SearchRun.expiresAt comment accordingly. No retention rules or database policies changed.

Files changed:
- src/app/agents/[id]/runs/[runId]/page.tsx
- src/server/search-runs.ts (comment only)
- reviews/QA-SEARCH-001.md (this record)

Verification: npm run check, exit 0. TypeScript and ESLint passed, all 152 tests in 14 files passed, production build passed. No new test was added for this wording correction. Existing non-blocking Vitest warning remains.

## Evidence and remaining work

Prior review reports document local RLS/integration/E2E coverage. The earlier chat `Extract Supabase migration file` records the owner's successful hosted search with 18 results still visible after reload. This is historical owner-confirmed evidence, not repeated today.

No local Docker executable/test stack was found, so destructive local database tests were not run. Existing test harness explicitly refuses hosted targets; this safeguard remains unchanged. No browser session was available in the connected browser. Asked the owner to start start-scout-local.cmd, open localhost:3000 and sign in for the remaining smoke test.

Still pending: current authenticated search and reload, correct expiry wording in browser, behaviour under ordinary users from two different firms, and approval of the remaining QA-001 / DEV-005A / DEV-005B0 review evidence. Their status is not promoted to DONE by this follow-up. DEV-005B remains blocked on provider agreements (BUS-002). Automatic purge remains future work under DEV-013.

Next action: with the owner signed in, run a synthetic search on the existing broad Volkswagen test agent, verify completion/result count, reload and confirm persistence. Do not expect an exact count without checking the current fixture/criteria. Do not use hosted data resets or change credentials to enable the test.

## Owner-verified hosted smoke test completed 15 October 2026

Christian ran the existing broad Volkswagen test agent while logged in to Actant. Screenshot shows completed status, 18 matches, 0 needs-review, and the corrected expiry text. Reload retained completed status and 18 results, explicitly confirmed by Christian.

The two existing users were confirmed to belong to the same Actant firm. Christian created a third Auth user, then a separate Merovo testfirma B via the existing admin helpers. With that ordinary user logged in: the Actant run URL returned the generic not-found page with no results (screenshot), and My Agents was empty (owner confirmation). Christian then returned to the ordinary Actant account.

This supersedes the pending owner smoke-test steps above. Evidence is owner screenshots and confirmations, not automated browser execution. The checked direction is B -> Actant, read access through the UI and a direct run URL. Reverse direction, direct API writes, concurrent agent limit and the full DB regression suite were not repeated today. Existing QA review statuses remain REVIEW until their complete acceptance criteria are approved. The extra user and firm remain available for later testing; no cleanup/deletion performed.

Next planned development dependency: TAX-001 and TAX-002 must define and validate the initial calculation profile before DEV-007. DEV-006/live source remains blocked on BUS-002. No tax profile or calculation rules chosen in this follow-up.
