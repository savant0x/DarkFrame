/**
 * @file scripts/dev-start.js
 * @created 2025-10-24
 * @overview Development server startup script with PATH fix for Windows
 * 
 * This script ensures System32 is in PATH before starting concurrently,
 * preventing "spawn cmd.exe ENOENT" errors on Windows.
 */

const { spawn } = require('child_process');
const path = require('path');

// Add System32 to PATH if on Windows and not already present
if (process.platform === 'win32') {
  const system32 = 'C:\\Windows\\System32';
  if (!process.env.PATH.includes(system32)) {
    console.log('🔧 Adding System32 to PATH...');
    process.env.PATH = `${process.env.PATH};${system32}`;
  }
}

// Start concurrently with the dev servers
// Using single command string with shell to fix DEP0190 warning
// (DEP0190: Passing args array with shell: true is deprecated)
const command = 'npx concurrently --kill-others --names "SERVER,STRIPE" --prefix-colors "cyan,magenta" npm:dev:server npm:stripe:listen';

const concurrently = spawn(
  command,
  {
    stdio: 'inherit',
    shell: true,
    env: process.env
  }
);

// Handle exit
concurrently.on('close', (code) => {
  process.exit(code);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  concurrently.kill('SIGINT');
});
