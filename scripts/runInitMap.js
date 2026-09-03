/**
 * Wrapper script to load environment variables before running TypeScript
 */
const { spawn } = require('child_process');
const path = require('path');

// Run tsx with the TypeScript file
const child = spawn('npx', ['tsx', 'scripts/initializeMap.ts'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd()
});

child.on('exit', (code) => {
  process.exit(code);
});
