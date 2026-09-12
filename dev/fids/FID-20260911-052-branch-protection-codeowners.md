# FID-20260911-052 — Branch Protection + CODEOWNERS: CI Guard Cannot Be Bypassed

**Date:** 2026-09-11 · **Follows:** FID-20260911-049/050 (repo remake + CI guard)

## What was configured

### CODEOWNERS (`.github/CODEOWNERS`)

Everything owned by `@savant0x`, with the attribution-critical surfaces
declared explicitly: `.githooks/`, `.github/workflows/attribution-guard.yml`,
`scripts/ensure-hooks.js`. With review required on `main`, guard changes
arrive by PR and render an owner-visible diff — they cannot slip in
silently.

### Branch protection on `main` (via REST `PUT …/branches/main/protection`)

| Setting | Value | Why |
|---|---|---|
| Required status check | `scan` (strict) | the attribution-guard job; strict = branch must be current with main |
| Require PR before merging | yes, 0 approvals | solo-repo friendly: the PR flow + CI is the gate, not review ceremony |
| Dismiss stale reviews | yes | new pushes re-gate |
| Enforce for admins | **yes** | the owner cannot bypass either — no exceptions |
| Require linear history | yes | no merge-commit spaghetti; rebase/squash only |
| Allow force pushes | **no** | history is immutable — the FID-049 guarantee holds |
| Allow deletions | **no** | `main` cannot be deleted |

## Live adversarial test

Direct push to `main` (empty probe commit, admin credentials):

```
remote: - Required status check "scan" is expected.
 ! [remote rejected] main -> main (protected branch hook declined)
```

Rejected. The local hooks (commit-msg, pre-push) remain the first gate;
branch protection is the second, unbypassable one — a `--no-verify` push
from an unarmed clone now dies at the remote unless it went through a PR
whose `scan` passed.

## Dogfood

This FID record itself was landed through the new flow: branch → PR →
`scan` green → rebase-merge — the first change to traverse the gate.
