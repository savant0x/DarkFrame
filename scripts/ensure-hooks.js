/**
 * @file scripts/ensure-hooks.js
 * @overview Postinstall arming of the attribution guard.
 *
 * `core.hooksPath` is a per-clone local git setting — it does NOT travel with
 * the repository. Without this, every fresh clone has .githooks/ on disk but
 * unprotected (raw git ignores non-standard hook dirs). This runs on
 * `npm install` and arms the guard so no foreign agent attribution can ever
 * enter the history of any clone of this repo.
 *
 * Idempotent, silent-safe outside a git repo (CI tarballs, npm-pack, etc).
 */
const { execSync } = require('child_process');

try {
  execSync('git rev-parse --git-dir', { stdio: 'ignore' });
  execSync('git config core.hooksPath .githooks', { stdio: 'ignore' });
  console.log('[guard] attribution guard armed (core.hooksPath=.githooks)');
} catch {
  console.log('[guard] not a git checkout — attribution guard skipped');
}
