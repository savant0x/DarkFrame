/**
 * Batch upload script for pushing all DarkFrame files to GitHub
 * Uses GitHub REST API to create/update files in bulk
 */

const fs = require('fs').promises;
const path = require('path');

// Configuration
const _OWNER = 'savant0x';
const _REPO = 'DarkFrame';
const _BRANCH = 'main';
const _GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Must be set

// Directories to exclude
const EXCLUDE_DIRS = ['node_modules', '.next', '.git', 'docs'];
const EXCLUDE_EXTENSIONS = ['.zip'];

/**
 * Get all files recursively from a directory
 */
async function getAllFiles(dir, fileList = []) {
  const files = await fs.readdir(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);
    
    if (stat.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(file)) {
        await getAllFiles(filePath, fileList);
      }
    } else {
      const ext = path.extname(file);
      if (!EXCLUDE_EXTENSIONS.includes(ext)) {
        fileList.push(filePath);
      }
    }
  }
  
  return fileList;
}

/**
 * Main upload function
 */
async function uploadAllFiles() {
  console.log('🚀 Starting GitHub upload...');
  
  const allFiles = await getAllFiles('D:\\dev\\DarkFrame');
  const filtered = allFiles.filter(f => {
    const rel = f.replace('D:\\dev\\DarkFrame\\', '');
    return ![
      'upload-to-github.js',
      'temp_types_batch.txt',
      'README_NEW.md'
    ].some(ex => rel.includes(ex));
  });
  
  console.log(`📊 Found ${filtered.length} files to upload`);
  console.log(`\n⚠️  NOTE: This script requires GitHub token and API access`);
  console.log(`💡 Recommended: Use MCP GitHub tools from VS Code instead\n`);
  
  // List files by folder
  const byFolder = {};
  filtered.forEach(f => {
    const rel = f.replace('D:\\dev\\DarkFrame\\', '');
    const folder = rel.split('\\')[0] || 'root';
    byFolder[folder] = (byFolder[folder] || 0) + 1;
  });
  
  console.log('📁 Files by folder:');
  Object.entries(byFolder).sort((a, b) => b[1] - a[1]).forEach(([folder, count]) => {
    console.log(`   ${folder}: ${count} files`);
  });
}

uploadAllFiles().catch(console.error);
