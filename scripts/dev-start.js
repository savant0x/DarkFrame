/**
 * @file scripts/dev-start.js
 * @created 2025-10-24
 * @updated 2026-05-06 — Standard Next.js dev server
 * @overview Development server startup script
 *
 * Starts the Next.js development server with Turbopack hot reload.
 * Stripe listener removed — run manually with `npm run stripe:listen` when needed.
 */

const { spawn } = require('child_process');

// Ensure System32 is in PATH on Windows
if (process.platform === 'win32') {
  const system32 = 'C:\\Windows\\System32';
  if (!process.env.PATH.includes(system32)) {
    process.env.PATH = `${process.env.PATH};${system32}`;
  }
}

const command = 'next dev';

const child = spawn(command, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

child.on('close', (code) => {
  process.exit(code);
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});
