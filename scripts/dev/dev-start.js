const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

if (process.platform === 'win32') {
  const system32 = 'C:\\Windows\\System32';
  if (!process.env.PATH.includes(system32)) process.env.PATH = `${process.env.PATH};${system32}`;
}

// Ensure .next directory exists with write permissions before Turbopack starts
const nextDir = path.join(__dirname, '..', '..', '.next');
try { fs.mkdirSync(nextDir, { recursive: true }); } catch {}

// Spawn next dev directly
const nextBin = path.join(__dirname, '..', '..', 'node_modules', 'next', 'dist', 'bin', 'next');
const nextDev = spawn(process.execPath, [nextBin, 'dev', '-p', '3000'], {
  stdio: 'inherit',
  env: process.env,
});
nextDev.on('close', (code) => process.exit(code));
process.on('SIGINT', () => nextDev.kill());