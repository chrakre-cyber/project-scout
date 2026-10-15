# QA-DEP-001 — dependency security review

Date: 15 October 2026 (Europe/Oslo)
Status: REVIEW. Dependency issue remains open upstream; no claim that all vulnerabilities are fixed or that the app is approved for publication.
Scope: investigate the five npm audit findings reported after local setup of DEV-005B0, make relevant corrections, and verify the current app. No product changes, deployment, database changes or credential changes.

## Findings

The active local app is `project_scout_DEV_005B` (contains `start-scout-local.cmd`). Current locked versions: Next.js and eslint-config-next 16.3.8, React 19.3.0.

`npm audit --json --ignore-scripts` returned five HIGH package findings on 15 October. These represent one underlying advisory propagated through:

`eslint-config-next@16.3.8 → @next/eslint-plugin-next@16.3.8 → fast-glob@3.3.1 → micromatch@4.0.8 → braces@3.0.3`.

Underlying issue: CVE-2026-93687 / GHSA-vfj7-8cjw-p6xm, stack exhaustion from deeply nested brace patterns. The advisory lists braces <=3.0.3 as affected and no patched release. Sources checked on the review date:

- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/micromatch/braces/blob/3.0.3/lib/compile.js
- npm registry metadata via `npm view braces@latest version` and `npm view @next/eslint-plugin-next@latest version dependencies --json`.

Registry checks returned braces 3.0.3 as latest and @next/eslint-plugin-next 16.4.1 still depending on fast-glob 3.3.1. A current compatible plugin upgrade therefore does not remove the affected chain. npm's proposed downgrade of eslint-config-next to 14.2.35 is not applied: it changes the major version of Next tooling without resolving this through a compatible upgrade. No audit suppression, forced override, local dependency patch or package downgrade was introduced.

## Reachability and remaining risk

All five packages occur under a devDependency, eslint-config-next. `npm audit --omit=dev --json --ignore-scripts` returned 0 vulnerabilities (42 production packages reported). No references to these packages were found in application source, project scripts or tests. No matching references were found in the generated `.next/server/**/*.nft.json` runtime file traces.

Installed `@next/eslint-plugin-next/dist/utils/get-root-dirs.js` only calls fast-glob when the ESLint setting `next.rootDir` is a string or array. Otherwise it uses `context.cwd` directly. The project's ESLint configuration does not supply that setting. This supports the assessment that normal app requests cannot supply a pattern to this path in the current configuration. It is not a general proof of absence of vulnerabilities or a guarantee for future tooling/configuration changes.

Residual risk: vulnerable code remains installed in development environments. Do not feed untrusted rootDir glob patterns to ESLint, and do not run tooling on unreviewed configurations with privileged credentials. Recheck before deployment and whenever dependency versions or lint configuration change. Close the underlying issue only after an upstream fix/removal is installed and audit plus project checks confirm it. No automatic security exception/production approval is granted by this review.

## Correction made

`tests/architecture.test.ts`: normalize the result of `path.relative` to `/` using `path.sep` before applying existing security rules. Native filesystem paths are unchanged. On Windows, backslashes previously caused five failures and caused some prefix-based architecture checks to scan empty groups. All existing assertions remain in place.

No application runtime code, package manifest, lockfile, SQL migrations, database data or secrets changed.

## Verification actually run

- Initial `npm run check`: typecheck and ESLint passed, unit suite failed 5/152 tests due to Windows path handling. Build did not run because the command stopped at tests.
- After correction, `npm run check`: exit 0. Typecheck passed, ESLint passed, all 152 tests in 14 files passed, Next.js production build passed.
- Non-blocking existing Vitest/Vite warning about future native config loading remains. Not changed in this task.
- Production dependency audit: 0 known vulnerabilities. Full audit: five HIGH package findings, one underlying open advisory.
- Runtime dependency traces checked for affected package names: no matches.

Not run: hosted login/search persistence smoke test, database/RLS integration tests, migration reset, authenticated browser tests. No configured local Docker executable was found. The previously user-confirmed 18 persisted results are historical evidence, not a test repeated today. No database writes were performed.

## Handoff

Changed source file: `tests/architecture.test.ts`. Review record: this file. No Git checkout is present in this local app copy, so no commit was created.

Dependency review is ready for review, with the upstream development-only issue explicitly open. Next: reconcile QA-001 / DEV-005A / DEV-005B0 review status and hosted smoke-test evidence before moving to the next dependent task. Live provider work remains blocked on BUS-002. This task does not change product scope or approve a deployment.
