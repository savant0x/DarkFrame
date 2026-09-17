# AUDIT — Next.js 16 deprecation sweep (2026-09-17, session 042)

**Operator directive:** sweep the codebase for other Next.js 16 deprecations beyond
middleware — APIs, config keys, and route conventions that will break on upgrade.
**Method:** the deprecation inventory was built from the **installed next@16.3.5
dist** (`warnOnce`/`errorOnce`/`Error`/`@deprecated` strings under `dist/server`,
`dist/build`, `dist/lib`, `dist/client`, `dist/api`), then every class was swept
against `app/ components/ lib/ hooks/ scripts/ server.ts next.config.js`.
**Baseline:** HEAD `8bbd90a`; post-middleware→proxy migration (session 038).

## Verdict summary

| # | Deprecated class (dist evidence) | Codebase verdict |
|---|---|---|
| 1 | `middleware.ts` file convention → `proxy.ts` | **Already migrated** (session 038) — the sweep's origin |
| 2 | Route-segment `runtime: 'edge'` ("The Edge Runtime is deprecated"); segment `runtime` key now forbidden in proxy | **Absent.** No `runtime: 'edge'` anywhere; the proxy carries no runtime key since 038 |
| 3 | Segment config `preferredRegion` (warn + `@deprecated`) | **Absent** |
| 4 | `request.ua` removed from NextRequest ("The request.ua has been removed") | **Absent** (no `.ua` access on NextRequest) |
| 5 | `next/legacy/image` ("@deprecated … will be removed") | **Absent** |
| 6 | Config `images.domains` ("is deprecated" → use remotePatterns) | **Absent** — no `images` key in next.config.js at all |
| 7 | Config `skipMiddlewareUrlNormalize` ("is deprecated") | **Absent** |
| 8 | Config `eslint` key ("no longer supported in next.config") | **Absent** — lint runs via `eslint .` script (flat config) |
| 9 | `icss` option (Error), `target` property (Error) | **Absent** |
| 10 | `<Link legacyBehavior>` ("`legacyBehavior` is deprecated") | **Absent** |
| 11 | AMP route convention (`amp: true`, `?amp=1`) | **Absent** — all `amp` grep hits are `timestamp:` false positives |
| 12 | Custom-server removed internals (`app.render*` — renders an Error) | **Absent** — `server.ts` uses only `app.prepare()` + `getRequestHandler()` |
| 13 | Sync `cookies()`/`headers()` (async in 15+) | **Absent** — no un-awaited call sites |
| 14 | `next/head` in App Router | **Absent** |
| 15 | `@next/font` (dead package) | **Absent** — `next/font/google` (supported) only, `app/layout.tsx:8` |
| 16 | `unstable_*` / `experimental_*` next imports | **Absent** |
| 17 | `next lint` (removed in 16) | **Absent** — package.json `"lint": "eslint ."` |
| 18 | Pages-Router file conventions | **Absent** — no `pages/` directory; full App Router |

## Notable context recorded during the sweep

- **exFAT constraint (from next.config comment):** Turbopack panics on this volume;
  scripts pin `--webpack`. This is an environment constraint, not a code deprecation,
  but it means in-repo boots/builds will not surface Turbopack-only warnings.
- **Environment strays (outside the repo):** `C:\Users\spenc\package{,-lock}.json`
  (caused the home-dir lockfile-inference warning, neutralized by `outputFileTracingRoot`
  in session 039) — deletion is an operator call.
- **CHANGELOG ordering defect (repo, cosmetic):** the `[0.0.5]` block sits *below*
  `[0.0.4]` from the parallel session's mid-file insertion; newest-first ordering is
  the file's own convention. Not reordered here (parallel session's entry).
- **Codemod run rule:** the warning strings name `@next/codemod@canary` runs; this
  audit establishes none are needed — if a future upgrade warns, rerun this audit's
  greps against the new dist's strings before touching code.

## Conclusion

The middleware→proxy migration (session 038) was the **last** active Next.js 16
deprecation in the codebase. Every other deprecated API, config key, and route
convention in the installed 16.3.5's warning surface is absent. No code changes
required; no gates re-run (zero source modifications this session).
