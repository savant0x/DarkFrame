#!/usr/bin/env node
/*
  dev/scripts/archive_completed.js
  Purpose: Archive older entries from dev/completed.md into categorized archives
  Usage: node dev/scripts/archive_completed.js [--keep N] [--dry-run]
  Default keep: 30 entries
*/
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const completedPath = path.join(root, 'completed.md');
const archivesDir = path.join(root, 'archives');
const archivePrefix = 'completed_archive';
const manifestPath = path.join(archivesDir, 'manifest.json');

const argv = require('minimist')(process.argv.slice(2));
const keep = parseInt(argv.keep || argv.k || 30, 10);
const dryRun = argv.dry || argv['dry-run'] || false;

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readCompleted() {
  return fs.readFileSync(completedPath, 'utf8');
}

function writeArchiveFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function writeCompleted(content) {
  fs.writeFileSync(completedPath, content, 'utf8');
}

function loadManifest() {
  if (!fs.existsSync(manifestPath)) return { archives: [] };
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    return { archives: [] };
  }
}

function saveManifest(m) {
  fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2), 'utf8');
}

function parseTopLevelEntries(raw) {
  // Split by top-level FID headings (## [FID-...]) while preserving them
  const lines = raw.split(/\r?\n/);
  const indices = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^## \[FID-/.test(lines[i])) indices.push(i);
  }
  if (indices.length === 0) return { header: raw, entries: [] };
  const header = lines.slice(0, indices[0]).join('\n') + '\n';
  const entries = [];
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = i + 1 < indices.length ? indices[i + 1] : lines.length;
    entries.push(lines.slice(start, end).join('\n'));
  }
  return { header, entries };
}

function inferCategoryFromFID(entry) {
  // Find the FID and try to infer a phase or year-month
  const match = entry.match(/^## \[FID-(\d{6})(?:\d{3,})?/m);
  // FID date pattern: FID-YYYYMMDD-XXX
  const matchFull = entry.match(/^## \[FID-(\d{8})/m);
  if (matchFull) {
    const d = matchFull[1];
    const year = d.slice(0, 4);
    const month = d.slice(4, 6);
    const day = d.slice(6, 8);
    return { year, month, day, date: `${year}-${month}-${day}` };
  }
  // fallback: misc
  return { year: 'misc', month: '', day: '', date: 'misc' };
}

function run() {
  ensureDir(archivesDir);
  const raw = readCompleted();
  const { header, entries } = parseTopLevelEntries(raw);

  if (entries.length <= keep) {
    console.log(`No archiving required; entries=${entries.length} <= keep=${keep}`);
    return;
  }

  const toKeep = entries.slice(0, keep); // newest first if file is newest at top
  const toArchive = entries.slice(keep);

  // Group archive entries by year/month/day
  const grouped = {};
  toArchive.forEach((e) => {
    const cat = inferCategoryFromFID(e);
    const key = cat.date;
    if (!grouped[key]) grouped[key] = { entries: [], year: cat.year, month: cat.month, day: cat.day };
    grouped[key].entries.push(e);
  });

  const manifest = loadManifest();
  const createdFiles = [];

  for (const key of Object.keys(grouped)) {
    const { entries, year, month, day } = grouped[key];
    const archiveSubdir = path.join(archivesDir, year, month, day);
    ensureDir(archiveSubdir);
    const filename = `${archivePrefix}_${key}.md`;
    const filePath = path.join(archiveSubdir, filename);

    let content = `# DarkFrame - Completed Features Archive (${key})\n\n`;
    content += `> Archived snapshot from dev/completed.md - ${key}\n\n`;
    content += `**Archive FID:** FID-${key.replace(/-/g, '')}-ARCH\n\n`;
    content += entries.join('\n\n') + '\n\n';

    if (dryRun) {
      console.log(`[DRY RUN] Would write ${filePath} with ${entries.length} entries`);
    } else {
      writeArchiveFile(filePath, content);
      createdFiles.push({ file: filePath, count: entries.length, category: key, date: key });
      console.log(`Wrote archive ${filePath} (${entries.length} entries)`);
    }
  }

  // Compose new completed.md content: header + kept entries
  const newContent = header + '\n' + toKeep.join('\n\n') + '\n';

  if (dryRun) {
    console.log('[DRY RUN] Would update dev/completed.md (trimmed older entries)');
    return;
  }

  // Save updates
  writeCompleted(newContent);

  // Update manifest
  manifest.archives = manifest.archives || [];
  createdFiles.forEach((f) => manifest.archives.push(f));
  saveManifest(manifest);

  console.log('Archival complete. Manifest updated.');
}

try {
  run();
} catch (err) {
  console.error('ERROR', err);
  process.exit(1);
}
