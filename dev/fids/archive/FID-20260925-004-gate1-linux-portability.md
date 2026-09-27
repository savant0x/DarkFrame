# FID-20260925-004 — Gate 1 is a Windows-only verdict: the route census normalises nothing, so the gate chain has never run past Gate 1 on CI

**Filename:** `FID-20260925-004-gate1-linux-portability.md`
**ID:** FID-20260925-004
**Severity:** HIGH
**Status:** closed (2026-09-26, commit `61bda4c`)
**Created:** 2026-09-25
**Trigger:** operator directive, 2026-09-25 — *"ok so, make the fid, run the perfection loop on it then present a final plan."* The subject was disambiguated by the operator's answer to a filed question (the FID-20260925-004/005 split): this FID takes the **Gate 1 portability defect**; `FID-20260925-005` takes the auto-farm collection/visibility defect. Per the Perfection Loop, this document is the artifact under the loop — **no code was written**; implementation is a separate step awaiting operator go-ahead.

---

## 1. Summary

`scripts/invertedRouteCensus.cjs` is Gate 1 of the 10-gate pre-push chain, and it is the first gate every push executes. Its false-positive retirement mechanism — a `WAIVERS` table of documented, hand-authored paths — compares a **stored path** (`'components\\admin\\PlayerDetailModal.tsx'`, written with literal backslashes) against a **derived path** (`c.file`, from `path.relative()`), and the normalisation between them is a **no-op**:

```js
file: 'components\\admin\\PlayerDetailModal.tsx',                                               // :142 — a Windows-shaped key
const w = WAIVERS.find((x) => c.file.endsWith(x.file.replace(/\\/g, '\\')) && …)                // :153 — backslash → backslash
```

`path.relative()` returns backslashes on Windows and **forward slashes on Linux**, so `c.file` is `components\admin\PlayerDetailModal.tsx` on this host and `components/admin/PlayerDetailModal.tsx` on `ubuntu-latest`. The `replace` was evidently meant to reconcile the two and does the opposite: it replaces a backslash with a backslash, so it can never fire. The waiver therefore matches **on Windows only**.

The consequence is not a wrong verdict about the code — the waived call site is a genuine false positive on both platforms (finding 1). The consequence is that **the gate chain has never executed past Gate 1 anywhere but this machine**. The chain is fail-fast (`exit 1` per gate), so the first-ever CI run died at Gate 1 and gates 3–10 — the Mongo census, the Law-17 schema census, the timestamp and host-timezone censuses, the ledger-integrity census, `npm run lint`, `npx tsc --noEmit` and `npm run test:ci` — **have never run on GitHub at all**. Every green chain this host has printed, including the one recorded in the 0.0.32–0.0.37 publish note, is a **one-platform verdict** for an estate whose whole thesis is "the gates are the enforcement boundary".

The fix is small and the correct pattern already exists in the tree (`scripts/ledgerIntegrityCensus.cjs:258`). The durable output is a **portability pin**: a test that runs the census under simulated POSIX separators inside the same suite CI runs, so a Windows-only gate becomes impossible to ship again — which matters because the platform that shipped it is the platform that cannot see it.

## 2. Evidence (RED)

### 2.1 The defect, at the byte

| # | Finding | File:Line | Evidence (command + output) |
| - | ------- | --------- | --------------------------- |
| 1 | **The waived call site is a real false positive on both platforms** — `action` is a closed domain and Next resolves both children at runtime | `components/admin/PlayerDetailModal.tsx:267`, `app/api/admin/vip/{grant,revoke}/route.ts` | `grep -n "api/admin/vip" components/admin/PlayerDetailModal.tsx` → `267: fetch(\`/api/admin/vip/${action}\`, …)`; the two literal child routes exist, so the *waiver's premise* is sound. The defect is that the waiver only works on one OS, not that it is wrong |
| 2 | **The waiver key is authored in the Windows separator convention** | `scripts/invertedRouteCensus.cjs:142` | `file: 'components\\admin\\PlayerDetailModal.tsx',` — JS source `'components\\admin\\…'`, i.e. the string contains literal backslashes |
| 3 | **The reconciling `replace` is a no-op: backslash → backslash** | `scripts/invertedRouteCensus.cjs:153` | `const w = WAIVERS.find((x) => c.file.endsWith(x.file.replace(/\\/g, '\\')) && c.raw.startsWith(x.rawPrefix));` — the pattern is `/\\/g` and the replacement is `'\\'`, the same character. The call is a copy, not a normalisation |
| 4 | **`c.file` is platform-dependent by construction, at three sites** | `scripts/invertedRouteCensus.cjs:98`, `:112`, `:115` | `grep -n "path\.relative" scripts/invertedRouteCensus.cjs` → `61: … path.relative(API_DIR, f).replace(/\\/g, '/')`, `98: unparsed.push({ file: path.relative(ROOT, file) …`, `112: calls.push({ file: path.relative(ROOT, file) …`, `115: calls.push({ file: path.relative(ROOT, file) …` — **count: 4**. `:61` (the route set) *does* normalise; the three call-site/unparsed sites do not. The file knew the rule and applied it in one branch of two |
| 5 | **The no-op reads as a fix, which is why review passed it** | `scripts/invertedRouteCensus.cjs:153` | A `replace` whose pattern and replacement are the same character is *visually* a normalisation. Every reader — including the session that added the waiver and the session that wrote the CI workflow — read "`\\` → `/`" because that is what the line is *for*. This is the defect class recorded as its own finding, not a typo |

### 2.2 Reproduction: the same tree, two separator regimes

The faithful shim patches the **results** of `path.join` and `path.relative` only, and never touches `path.sep` (reassigning `path.sep` corrupts Node's internals on Windows, where `path` *is* `path.win32`; a single-sided shim fabricates failures — both lessons were learned the hard way earlier the same session and are recorded in `SESSION-2026-09-25-002.md` §3.2).

```
=== NORMAL (Windows) RUN ===
routes: 240 · call sites: 301 (unparsed: 0)

=== WAIVED (1) — documented false positives ===
  components\admin\PlayerDetailModal.tsx:267  /api/admin/vip/${action}
    reason: action domain is {grant, revoke}; …

=== MISSING (0) — called but no route matches ===
=== UNPARSED (0) — unverified call sites (refuse the gate) ===
EXIT=0
```

```
=== POSIX-SEPARATOR SIMULATION (same SHAs, same tree) ===
routes: 240 · call sites: 301 (unparsed: 0)

=== WAIVED (0) — documented false positives ===

=== MISSING (1) — called but no route matches ===
  components/admin/PlayerDetailModal.tsx:267  /api/admin/vip/${action}

=== UNPARSED (0) — unverified call sites (refuse the gate) ===
EXIT=1
```

**Byte-for-byte identical to the CI failure**, captured from run `36153908928` and pasted in `SESSION-2026-09-25-002.md` §3.2:

```
🔍 gate-chain: running .githooks/pre-push over 25e8078…605a849
🔍 pre-push: inverted route census (called-but-never-built gate)...
routes: 240 · call sites: 301 (unparsed: 0)
=== WAIVED (0) — documented false positives ===
=== MISSING (1) — called but no route matches ===
  components/admin/PlayerDetailModal.tsx:267  /api/admin/vip/${action}
##[error]Process completed with exit code 1.
```

Same 240 routes, same 301 call sites, same one MISSING line, same exit code — reproduced locally, on a Windows host, with no Linux machine involved. The simulated run is not an inference about Linux; it is the CI transcript.

### 2.3 Blast radius: the gates that have never run

| # | Finding | File:Line | Evidence (command + output) |
| - | ------- | --------- | --------------------------- |
| 6 | **The chain is fail-fast, so Gate 1 gates nine gates that follow it** | `.githooks/pre-push` | Each gate ends in `exit 1`/`exit 2` on refusal; Gate 1 is the first executable gate. The CI run above terminated at Gate 1, 34 s in — no `✅ pre-push: mongo eradication census clean`, no `eslint clean`, no `typecheck clean`, no `test suite clean`, no `attribution scan clean` line exists in any CI log |
| 7 | **Gate 1's own wrapper carries no separator logic — the defect is wholly inside the census** | `.githooks/pre-push` (Gate 1 block) | `census_out="$(node scripts/invertedRouteCensus.cjs 2>&1)"; census_status=$?` then `tail -n 30`. No path comparison, no `path.sep`, no glob. Fixing the census fixes the gate; the hook needs no change |
| 8 | **Exactly one gate is Linux-hostile; the other four censuses are separator-safe** | `scripts/{schemaConsumer,timestampConvention,hostTimezone,ledgerIntegrity}Census.cjs` | ```
schemaConsumerCensus        native exit=0  posix exit=0  SEPARATOR-SAFE
timestampConventionCensus   native exit=0  posix exit=0  SEPARATOR-SAFE
hostTimezoneCensus          native exit=0  posix exit=0  SEPARATOR-SAFE
ledgerIntegrityCensus       native exit=0  posix exit=0  SEPARATOR-SAFE
``` — measured under the same faithful shim. The portability gap is bounded to one gate, so the fix has one target |
| 9 | **The correct pattern is already in-tree, one directory over** | `scripts/ledgerIntegrityCensus.cjs:258`, `dev/scripts/audit/dead-wire-audit.cjs:34` | `grep -n "split(path\.sep)\.join" scripts/*.cjs dev/scripts/audit/*.cjs` → `scripts/ledgerIntegrityCensus.cjs:258: const rel = path.relative(ROOT, file).split(path.sep).join('/');` and `dev/scripts/audit/dead-wire-audit.cjs:34: … add(file.split(path.sep).join('/'));` — two prior authors solved this exact problem and neither convention reached the census. This is a **drift** defect as much as a portability one |
| 10 | **The gate's verdict is not the only divergence — the toolchain is, and it is unmeasured rather than unfixed** | `.github/workflows/gate-chain.yml` | `node-version: 'lts/*'` resolved to Node **v24.21.0** / npm **11.19.0** in run `36153908928`, against this host's Node 25.2.1. Recorded as a known, deliberate divergence (no `engines`, no `.nvmrc`); it is a *forecast*, not a proven defect — gates 3–10 have simply never executed there, so no assertion about them is available in either direction |

### 2.4 Call-graph notes (Law 4)

A real runtime path, and the comparison is what breaks it.

`git push` → `.githooks/pre-push` (or `.github/workflows/gate-chain.yml` piping a synthesized ref line into it) → **Gate 1** → `node scripts/invertedRouteCensus.cjs` (`process.cwd()` = repo root) → `walk()` over `components/ lib/ hooks/ utils/ context/ app/` → `path.relative(ROOT, file)` → `calls[].file` → `matches(c.parts)` returns `null` for the `${action}` template → `WAIVERS.find(…)` → **`:153`'s no-op comparison fails on Linux** → `missing.push(c)` → `process.exit(1)` → hook `exit 1`. The comparison is reached on every run, by construction, for exactly one call site. Nothing is unwired; there is no alternate path that could have masked this.

The three derived-path sites are also the fix's reachability surface: a helper introduced at `:98`/`:112`/`:115` is called **three times per run**, on every file, unconditionally — so a helper with no caller is not a risk that needs arguing about (finding 4's `count: 4`).

## 3. Impact Analysis

- **Who/what is affected:** every push, on every clone, on every platform other than Windows — and transitively the entire `main` history's authority claim. `gate-chain.yml` has never once reported green; `attribution-guard.yml` (a separate workflow) passes in 11 s, so the failure is isolated to this chain, not to CI as a whole.
- **Failure modes if unfixed:**
  1. **The enforcement boundary is fictional on CI.** Nine of ten gates — including all three Law-3 verification commands — are exercised only by a hook that `.github/workflows/gate-chain.yml`'s own comment describes as "bypassable (`--no-verify`, an unarmed clone with no `core.hooksPath`)". The comment's argument is that CI is "the unbypassable backstop"; the backstop has never reached past its first gate.
  2. **A red CI is quieter than no CI.** `gate-chain` failing on every push trains the operator to read the red as background noise, which is exactly the state that lets a *real* regression merge as "oh, that's the known one".
  3. **It is unfalsifiable from this host.** The failure mode is invisible to the platform that owns the code: a Windows developer running the full 10-gate chain gets 10 green lines. Nothing in the chain reports what platform produced its verdict.
- **Blast radius of the fix:**
  - **Direct:** `scripts/invertedRouteCensus.cjs` (one helper, three call sites, one waiver key, one comparison) and one new test file. No schema, no route, no client, no dependency, no hook change (finding 7).
  - **Transitively:** the census's output becomes platform-stable, so local and CI logs are finally comparable line-for-line — which is what makes a CI Gate 1 failure diagnosable at all.
  - **Downstream, deliberately not claimed:** fixing Gate 1 does **not** make CI green. It removes the reason CI *stops* at Gate 1. Gates 3–10 are then exercised for the first time (finding 8 says the four censuses are separator-safe, but Node v24-vs-25 behaviour, `npm ci` resolution, `lts/*` drift and lint/typecheck/test behaviour on `ubuntu-latest` are all **unmeasured**). The honest forecast is: Gate 1 will pass; some later gate may fail for its own reasons, and that failure will be a *new, informative* signal rather than a silenced one. This is recorded as a limitation in §8, not as an expected outcome.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | Yes — and the point of the fix is precisely that it must hold on a platform this host cannot run. Normalising **once, at derivation** (`path.relative(...).split(path.sep).join('/')`) makes the invariant "`c.file` is always POSIX" true by construction at all three sites, rather than restoring a per-comparison match that happens to work when both sides are written the same way. It is also correct on a hypothetical Windows host that emits forward slashes: `split('\\').join('/')` is then already a no-op, so the property holds in both directions instead of being pinned to one. Retaining `endsWith` is rejected below for the hostile-attacker question. |
| Scales? | Yes, and strictly better than the status quo. Today the comparison is `O(waivers)` per unrouted call site with a hidden platform precondition; the fix keeps the same `O(waivers)` comparison with the precondition removed. No new I/O, no new pass, no new dependency. Cost is a `.split()`/`.join()` per harvested call site on a ~0.7 s gate that already reads and regex-scans 300+ files — unmeasurable at that scale, and it is the same cost the two in-tree precedents already pay (finding 9). |
| Survives a hostile attacker? | Yes, and this FID hardens a hole the fix could otherwise leave open. `endsWith` is a **suffix** test: a future file at, say, `dev/archives/…/components/admin/PlayerDetailModal.tsx` that calls a different `/api/admin/vip/${…}` template would inherit the waiver's immunity for free — a waiver table that suppresses a class rather than a location is a gate hole an attacker (or an honest refactor) can widen without noticing. The matcher becomes `c.file === x.file`, an **exact** repo-relative path match, which is what the waiver always meant. A second, independent wall is added at authoring time: the census refuses (`exit 2`) if any waiver key contains a backslash, so the Windows-shaped key that caused this defect cannot be introduced again even by someone who never reads §2. Neither change relaxes the exit contract: MISSING and UNPARSED still refuse the push on every platform. |
| Maintainable in 2 years? | Yes — this is the question the defect actually failed. The broken artifact was not logic but a **convention**: two authors solved the same separators problem correctly (finding 9) and a third wrote a line that *looks* like the same solution and isn't. The fix collapses three raw derivations into one named helper (`relPath`) — so the next author has one place to look and one convention to copy — states the invariant in the census's header, and adds the portability test (finding 2.2) that makes the convention machine-checked on the only platform where it can silently rot. A convention with a test survives its author's memory; a convention without one is what we just measured. |
| Sets the standard for the industry? | Yes, and the generalisable half is bigger than the fix: **a cross-platform gate must prove its own platform-independence, because the developer's platform is the one that cannot see the bug.** The estate's own thesis — one gate definition, two callers, CI as the unbypassable backstop (FID-20260924-004) — was defeated not by a missing gate but by a gate that silently meant "Windows". Most CI failures are visible to the author; this class is not, which is why the durable artifact is a test that simulates the *other* platform rather than a comment asking people to be careful. Stating the gate's platform as part of its verdict is the practice worth exporting. |

All five are `yes`. No redesign required.

## 5. Proposed Fix (GREEN)

### Approach

**Normalise at derivation, once, in one named helper; make the waiver key POSIX; make the comparison exact; make the authoring mistake unlandable; pin the whole thing with a test that runs the other platform's separators on this one.**

The rejected alternative is the smallest one on the page — repairing `:153` to `.replace(/\\/g, '/')` — and it is rejected because it leaves the *stored* key Windows-shaped and the *printed* path platform-dependent: every future waiver would have to be authored in backslashes and every future reader would have to know that, which is the exact convention that failed (finding 5). Normalising at derivation makes the whole file speak one convention.

### Alternatives considered

| Alternative | Why rejected |
| ----------- | ------------ |
| Repair `:153` in place: `x.file.replace(/\\/g, '/')` | Fixes the symptom and preserves the disease. The waiver key stays Windows-shaped, so every new waiver must be authored in the convention of one platform; the printed `WAIVED`/`MISSING` lines stay backslashed locally and slashed in CI, so logs remain incomparable; and nothing makes the mistake detectable. It is the change that would have been made by someone who read `:153` and not `:142` |
| Use `path.posix.relative()` instead of `path.relative()` | Wrong tool: `path.posix` on Windows does not understand `C:\…` inputs, so it would need the same shimming anyway, and it hides the platform distinction inside an import rather than stating the invariant. Also departs from the pattern the two in-tree precedents already established |
| `.replace(/\\\\/g, '/')` at the comparison (the "correct" `replace`) | Still a per-comparison normalisation of one side only, so a correctly-authored POSIX key on Linux and a Windows `c.file` on Windows still depend on the two sides agreeing by luck. It also leaves finding 4's three raw sites producing platform-dependent output |
| Add a `--posix` flag / env var to the census and run CI with it | Makes the gate's behaviour a function of how it was invoked, so the local and CI verdicts are *definitionally* different again — the opposite of the chain's "single definition, two callers" property (FID-20260924-004). Also would not be exercised locally, i.e. by the machine that owns the defect |
| Move the waiver table into a config file (`waivers.json`) | Larger surface for one entry, adds a parse-and-validate path, and moves the documented reason away from the gate that uses it. No gain against the actual failure mode (authoring convention), and it makes the new self-check harder to place |
| Put the portability test in a CI-only workflow step (`bash` + `sed` shim) | Same argument as the flag: a check that runs only where the defect cannot be reproduced. The pin must run in `npm run test:ci` (Gate 10, local **and** CI) — its whole purpose is to fail on **Windows**, the platform that shipped the bug |
| Delete the waiver and fix the call site instead | The call site is a genuine static-analysis false positive (finding 1): `action` is a closed domain and both children exist. "Fixing" it would mean contorting correct code to satisfy a scanner. The waiver mechanism is right; only its keying was wrong |
| `endsWith` → `startsWith` / regex-prefix matching | Suffix and prefix tests share the forgery weakness (see question 4). Repo-relative paths are unique, so exact equality is both the strictest and the simplest correct test |

### Changes

| File | Action | Description |
| ---- | ------ | ----------- |
| `scripts/invertedRouteCensus.cjs` | modify | (1) Add `relPath(abs)` = `path.relative(ROOT, abs).split(path.sep).join('/')`, with a comment naming the precedent (`ledgerIntegrityCensus.cjs:258`) and the failure it prevents. (2) Route **all three** raw sites (`:98`, `:112`, `:115`) through it, so `calls[].file` and `unparsed[].file` are POSIX on every platform. (3) Re-key the waiver to `'components/admin/PlayerDetailModal.tsx'`. (4) Replace the matcher with `c.file === x.file && c.raw.startsWith(x.rawPrefix)` — the no-op `replace` is **deleted, not repaired**. (5) Add a fail-closed self-check over `WAIVERS` that refuses (`exit 2`, with the offending entry named) if any key contains `\`, so the Windows-shaped key cannot be reintroduced. (6) Header note: output paths are POSIX on every platform, making local and CI transcripts comparable |
| `__tests__/scripts/invertedRouteCensus.test.ts` | create | The portability pin, in the suite Gate 10 already runs on both platforms. Spawns the real script in a child process twice — once natively, once under the faithful POSIX shim (`path.join` and `path.relative` **results** only; `path.sep` is never reassigned, per the recorded lesson) — and asserts: both exit 0; both print `WAIVED (1)` and `MISSING (0)` and `UNPARSED (0)`; and the waived path string is **identical and forward-slashed** in both transcripts. Plus a non-spawning assertion that no waiver key contains a backslash, which pins the §5(5) self-check from the outside |

**Verification plan** (from `protocol.config.yaml` → `single_agent.protocol.verification`, run unchanged):

1. `npx tsc --noEmit` → 0 errors.
2. `npm run lint` → exit 0 with 0 errors / 0 warnings.
3. `npm run test:ci` → all suites pass, including the two new assertions.
4. `node scripts/ledgerIntegrityCensus.cjs` → exit 0 (Gate 7 is untouched but shares the chain).
5. `node scripts/invertedRouteCensus.cjs` → `WAIVED (1)`, `MISSING (0)`, `UNPARSED (0)`, exit 0 — **and**, under the shim, the identical transcript with exit 0. This is the acceptance criterion for the defect.
6. The full 10-gate chain over the commit range, captured with the working measurement idiom (`out="$(printf … | bash .githooks/pre-push origin "$URL" 2>&1)"; ec=$?` — `${PIPESTATUS[0]}` after a `printf | … | tail` pipeline reports `printf`'s status, a trap already paid for once).
7. **The red drill, which is the only thing that proves the pin is a pin:** the new test run against the **pre-fix** census must fail on the POSIX assertion (expected: `WAIVED (0)` / `MISSING (1)` where the test requires `WAIVED (1)` / `MISSING (0)`). A regression test never observed to fail is not known to be a regression test.

**Call-graph reachability plan:** no new production function is introduced — `relPath` is module-internal, and the reachability argument is the one finding 4 already makes mechanically: `grep -c 'path\.relative' scripts/invertedRouteCensus.cjs` → **4**, of which **3** are the derivation sites that must route through the helper, each executed unconditionally on every file of every run. The post-fix claim to be pasted in §7 is `grep -n 'relPath'` showing the definition plus exactly three call sites, and a chained `grep -c 'path\.relative(ROOT'` → `0` (no raw derivation survives). The new test's three assertion names appearing in a real `npm run test:ci` run is the second, independent reachability witness.

## 6. Audit Record

Double audit — two independent methods, evidence pasted, no self-reporting. **Note on method choice for a document-bound loop:** the Perfection Loop runs on the FID, not on the code, and no code exists yet — so "static analysis" cannot mean "typecheck the change". Method 1 is therefore the **re-execution of every command this document cites**, and the artefact under audit is the document's claim-set. Where the template's default (typecheck/lint/test) applies only post-implementation, that obligation is carried forward explicitly into §7 rather than silently dropped.

| Method | What was checked | Evidence (command + output) | Result |
| ------ | ---------------- | --------------------------- | ------ |
| Method 1: static analysis — every cited command re-executed | The two separator regimes; the four sibling censuses; the four `path.relative` sites; the pre-push Gate 1 wrapper; the route-set precedent; the correct in-tree pattern | §2.2's two transcripts (native `WAIVED (1)`/`MISSING (0)`/`EXIT=0` vs POSIX `WAIVED (0)`/`MISSING (1)`/`EXIT=1`); §2.3 finding 8's four-census table (all `native exit=0  posix exit=0  SEPARATOR-SAFE`); `grep -n "path\.relative" scripts/invertedRouteCensus.cjs` → `61, 98, 112, 115` (**count: 4**); `grep -n "split(path\.sep)\.join" scripts/*.cjs dev/scripts/audit/*.cjs` → `ledgerIntegrityCensus.cjs:258`, `dead-wire-audit.cjs:34`; `.githooks/pre-push` Gate 1 block read in full (`node … 2>&1` piped to `tail -n 30`, no path logic) | pass |
| Method 2: manual re-read against this FID | Every file:line in §2 re-derived rather than recalled (waiver key `:142`, matcher `:153`, sites `:98/:112/:115`, route-set normalisation `:61`); the CI transcript compared character-by-character against the simulated one (240/301, one MISSING line, same path, same exit code); each §4 answer checked against a specific finding rather than asserted; the rejection table re-read against findings 3, 4 and 9 | §2.1 findings 1–5 each re-grepped for this document; the CI transcript in §2.2 quoted from `SESSION-2026-09-25-002.md` §3.2, which captured it from run `36153908928` | pass |
| Law 4 / Perfection-Loop caller check — **does any new symbol this FID adds have a production caller?** | `relPath` (new, module-internal) and the new test file | `relPath` has **three** planned call sites, all unconditional per-run, enumerated mechanically at §2.1 finding 4 (`count: 4`, of which `:61` keeps its existing equivalent form); the test file is executed by Gate 10's `npm run test:ci` via the vitest include glob `**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}` (`vitest.config.ts`), so it is not a parked file. **Zero-caller check: satisfied** — nothing is added that could be dead on arrival | pass |
| Caller check on the *removed* symbol | The no-op `replace` at `:153` — is anything else relying on it? | It appears exactly once in the file (`grep -n "replace(/\\\\\\\\/g, '\\\\\\\\')" scripts/invertedRouteCensus.cjs` → the single `:153` line); the sibling correct form at `:61` uses a different pattern (`/\\/g` → `'/'`) and is untouched. Deleting it cannot orphan a caller | pass |

- **Audit outcome: PASS → status `loop-complete`.** The loop converged on the document; the status describes the **document**, not the code. The plan is final and pending implementation. This is a stop point — **no code was written** and implementation requires operator go-ahead (§7).

### Method 1 re-run against the changed tree (§7 obligation 5, 2026-09-26)

| Command | Post-implementation output | Result |
| ------- | -------------------------- | ------ |
| `node scripts/invertedRouteCensus.cjs` (native) | `routes: 240 · call sites: 301 (unparsed: 0)` · `WAIVED (1)` — `components/admin/PlayerDetailModal.tsx:267  /api/admin/vip/${action}` · `MISSING (0)` · `UNPARSED (0)` · `EXIT=0` | pass |
| same, under the faithful POSIX shim (`path.join`/`path.relative` results only) | byte-identical transcript, `EXIT=0` | pass — the acceptance criterion |
| `grep -n "relPath" scripts/invertedRouteCensus.cjs` | `:30` (header), `:47` (definition), `:113` / `:127` / `:130` (exactly three call sites) | pass |
| `grep -n "path\.relative(ROOT" scripts/invertedRouteCensus.cjs` | `48:  return path.relative(ROOT, abs).split(path.sep).join('/');` — **count 1, the helper's own body** (see the corrected claim in §7) | pass with correction |
| `npx tsc --noEmit` | `TSC_EXIT=0` | pass |
| `npm run lint` | `LINT_EXIT=0` (0 errors / 0 warnings) | pass |
| `npm run test:ci` | `Test Files 137 passed (137) · Tests 1328 passed (1328)` (1325 baseline + the 3 new pin assertions) | pass |
| `node scripts/ledgerIntegrityCensus.cjs` | `LEDGER_EXIT=0` · `ledger census clean` | pass |
| full 10-gate chain (`printf '<ref> <local> <ref> <remote>' \| bash .githooks/pre-push origin "$URL"`, `$?` on the capture) | all ten `✅` lines — census clean (240 · 301), mongo clean, schema census (57 tables — 57 live), timestamp clean, host-tz clean, ledger clean, `eslint clean (0 errors, 0 warnings)`, `typecheck clean (0 errors)`, `test suite clean (1328 passed (1328))`, attribution scan clean (`605a849…86aad5a`) · **`CHAIN_EXIT=0`** | pass |
- **Circuit breakers (`perfection_loop`):** `max_change_percent_per_pass: 10` — one pass to GREEN; the fix rewrites a single predicate plus three call sites inside a 167-line script, and the pass-to-pass delta after the audit was 0 (no §5 change was required), so the 2%-delta convergence test and the 2-consecutive-pass requirement are met trivially rather than by iteration count. `oscillation_reappearances: 3` — none; no issue was revised and then re-revised. `max_iterations: 10` — 1 iteration used. `flag_for_review_after_iterations: 5` — not reached.
- **Termination condition:** the deep audit produced **zero actionable improvements** to §5. The three candidate refinements surfaced during the audit — (i) normalise `:61`'s route-set path through the same helper for symmetry, (ii) assert the waiver count as well as the waiver identity in the test, (iii) report the running platform in the census's first output line — were each rejected as **change for its own sake**: (i) is already correct and routing it through the helper would obscure that it needs a *second*, different transformation (`/route.ts` suffix removal); (ii) is a tautology that would pass against the pre-fix script and therefore cannot be part of any drill; (iii) is a new output field with no consumer, which is the exact shape the caller check rejects. Zero actionable items remain; the loop is COMPLETE.

## 7. Implementation Record

- **Status:** `implemented` (2026-09-26) — the implementation EXISTS in the codebase and gates pass; the **G2 commit is outstanding**, so this FID is not yet `closed` and not archival-eligible. Operator go-ahead was given explicitly on 2026-09-26: *"Implement FID-20260925-004 — the Gate 1 portability fix, with the red drill and full gates."* (Filed 2026-09-25; implemented 2026-09-26.)
- **Files changed:** `scripts/invertedRouteCensus.cjs` (modified — `relPath` helper + three routed derivation sites, POSIX waiver key, exact `===` matcher with the no-op `replace` **deleted**, authoring-time `exit 2` self-check, header path-invariant note); `__tests__/scripts/invertedRouteCensus.test.ts` (created — the portability pin). Nothing else touched.
- **Obligations, discharged with evidence:**
  1. **Gate output pasted** — `npx tsc --noEmit` `TSC_EXIT=0`; `npm run lint` `LINT_EXIT=0`; `npm run test:ci` `Test Files 137 passed (137) · Tests 1328 passed (1328)`. See the §6 Method-1 re-run table.
  2. **Both post-fix transcripts + chain** — native and shimmed transcripts are **byte-identical** (`routes: 240 · call sites: 301 (unparsed: 0)` · `WAIVED (1)` · `  components/admin/PlayerDetailModal.tsx:267  /api/admin/vip/${action}` · `MISSING (0)` · `UNPARSED (0)` · `EXIT=0`), and the full chain printed all ten ✅ lines with `CHAIN_EXIT=0`.
  3. **Red drill (the pin seen to fail):** against the **pre-fix** census, `npx vitest run __tests__/scripts/invertedRouteCensus.test.ts` = **3 failed (3)** — (i) the POSIX run exits 1 where the test requires 0, (ii) the waived path is `components\admin\PlayerDetailModal.tsx` (backslashed) where the POSIX run prints none (the waiver does not fire), (iii) the source-level assertion names `waiver key authored in Windows separators: components\\admin\\PlayerDetailModal.tsx`. Above the drill, the pre-fix transcripts reproduce the CI failure byte-for-byte: native `WAIVED (1) / MISSING (0) / EXIT=0` vs POSIX `WAIVED (0) / MISSING (1) / components/admin/PlayerDetailModal.tsx:267 / EXIT=1` (`routes: 240 · call sites: 301` in both). Post-fix the same file is **3 passed (3)** — drilled red-then-green, as required.
  4. **Reachability greps, with one corrected prediction:** `grep -n 'relPath'` → `:47` definition + exactly three call sites (`:113`, `:127`, `:130`), satisfying the §2.3 finding-4 mechanical argument. The chained `grep -c 'path\.relative(ROOT'` returns **1, not the §5 plan's predicted 0** — the single hit is `:48`, the `relPath` body itself. The claim as drafted was internally inconsistent (the helper cannot derive without deriving); the invariant that holds is *"no raw derivation survives **outside** `relPath`"*, and `grep -n 'path\.relative(ROOT'` shows `:48` is the only occurrence. Corrected here rather than papered over.
  5. **Method 1 re-run against the changed tree** — recorded in the §6 table above (post-implementation row set).
  6. **`dev/tmp/` scratch** — none created by this implementation: the drill's transcript scratch lived in `/tmp`, outside the tree. `dev/tmp/` contains only the pre-existing `timestamp-pre-state.json` (2026-09-23, not this session's, gates green with it present). Nothing to remove.

## 8. Closure

- **Gates:** [x] typecheck 0 errors · [x] lint 0 errors / 0 warnings · [x] tests pass (1328/1328) · [x] call-graph proven (`relPath` definition + 3 call sites; no raw derivation outside the helper) · [x] **portability drill red-then-green** (3 failed pre-fix → 3 passed post-fix).
- **Commit hash (G2 — required for `closed`):** **`61bda4c`** — `fix(gates): the inverted-route census normalises at derivation, so Gate 1 stops being a Windows-only verdict (FID-20260925-004)`, committed 2026-09-26 under explicit operator approval of the agent-run staging plan (G1). **Closure probe (Law 16):** `git commit` output for `61bda4c` → `2 files changed, 140 insertions(+), 5 deletions(-)` — `scripts/invertedRouteCensus.cjs` modified and `__tests__/scripts/invertedRouteCensus.test.ts` created, exactly the two files §5 names and nothing else. Status `closed`; this file is archived to `dev/fids/archive/` with the CHANGELOG/VERSION 0.0.39 ledger commit.
- **Staging plan (path-scoped, G3/G4 — prepared for the operator; the agent does not execute git):** the implementation commit is `git add scripts/invertedRouteCensus.cjs __tests__/scripts/invertedRouteCensus.test.ts` (logical-atomic: the gate fix and its pin); the ledger commit is `git add dev/fids/FID-20260925-004-gate1-linux-portability.md SCOPE.md CHANGELOG.md VERSION dev/session-summaries/` — **never `git add -A`**. Two commits because a gate fix whose own pin is in the same commit cannot be drilled independently; the FID-20260924-003 precedent ("a chain commit whose own tree would fail its new gate is a worse artifact than either half alone") is the same reasoning in the other direction.
- **Commit message (G8):** implementation — `fix(gates): the inverted-route census normalises at derivation, so Gate 1 stops being a Windows-only verdict (FID-20260925-004)`; ledger — `docs(ledger): FID-20260925-004 filed closed on <hash> — Gate 1 is platform-independent and pinned by a POSIX-separator drill; SCOPE item 66 re-pointed, CHANGELOG/VERSION 0.0.39 (FID-20260925-004)`.
- **Ledger actions at closure:** re-point `SCOPE.md` `[OPEN-OUT-OF-SCOPE]` item 66 (which currently reads *"Not filed as a FID because no directive named it and no work was done on it"* — both halves became false the moment this document was filed); add a Step-Status-Ledger row for this FID (`SCOPE.md` row numbering is currently governed by the duplicate-heading defect recorded at row 125, so the row is added to the `[OPEN-OUT-OF-SCOPE]` table's item sequence and cross-referenced); append a `CHANGELOG.md` entry and bump `VERSION` to `0.0.39`; log the archival in the session summary.
- **Archive:** on close, move to `dev/fids/archive/`. **Not archived at `loop-complete`** — archival happens only at a terminal status, and this document is live in `dev/fids/` pending implementation.
- **Honest limitations:**
  1. **This fix is a precondition, not a green CI.** It removes the reason the chain stops at Gate 1. Gates 3–10 have still never executed on `ubuntu-latest`, and no claim about them is made here. The four censuses are separator-safe (finding 8); the Lua/node/maven-free remainder is unmeasured. The realistic outcome of the next push is "Gate 1 passes, and we finally learn what gates 3–10 do on CI" — which is a *better* failure mode, not a guaranteed pass.
  2. **The separator simulation is a simulation.** It reproduces the CI transcript byte-for-byte (§2.2) and is faithful on the two axes that matter (both `join` and `relative` patched, `path.sep` untouched), but it is not `ubuntu-latest`. The acceptance criterion is therefore stated as *"the census is byte-identical under both separator regimes, proven locally"* — not "CI is green", which this host cannot establish.
  3. **The Node divergence is unproven in both directions.** `lts/*` (v24.21.0) vs this host (25.2.1) is recorded, not diagnosed. It may be innocent; it has simply never been exercised on the same tree.

---

**Final status:** `implemented` (was `loop-complete`). Gate 1 compared a Windows-shaped waiver key against a platform-derived path through a `replace` that replaced a backslash with a backslash, so the route census returned `MISSING (1)` and refused the push on every non-Windows platform — the reason the fail-fast chain had executed gates 3–10 only on one machine. Implemented 2026-09-26 exactly as planned: derivation normalised once through `relPath`, waiver re-keyed to POSIX, comparison exact, a backslash-keyed waiver refused at authoring time (`exit 2`), and the convention pinned by a test that runs POSIX separators inside the suite CI already runs — drilled red (3/3 failed against the pre-fix census) then green (3/3). Gates: tsc 0 · lint 0 · suite 1328/1328 · full 10-gate chain `CHAIN_EXIT=0` · both separator regimes byte-identical. **Closed 2026-09-26 on `61bda4c`** (operator-approved staging plan; ledger closure in the same session's commit).
