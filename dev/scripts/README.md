# /dev/scripts - Automation Scripts

Utility scripts for maintaining the /dev tracking system.

## 📦 archive-daily.ps1

**Purpose:** Automate daily cleanup of /dev folder

**What it does:**
1. Creates `dev/archives/YYYY-MM-DD/` folder
2. Archives non-main .md files older than today
3. Reports file sizes for completed.md and progress.md
4. Lists remaining files in /dev

**Usage:**
```powershell
# From project root
.\dev\scripts\archive-daily.ps1
```

**What it archives:**
- CURRENT_STATUS.md
- NEXT-SESSION.md
- Testing guides
- Quick reference files
- Any dated documentation

**What it NEVER archives:**
- The 11 main tracking files (planned, progress, completed, etc.)
- lessons-learned.md (preserved forever)

**Manual steps still needed:**
- Archiving old entries from completed.md (if file > 50 KB)
- Cleaning progress.md to "CLEAN SLATE" status

## 🎯 Quick Command

For ECHO to run full archive with completed.md cleanup, just say:

```
/dev cleanup
```

or

```
archive old files
```

ECHO will:
1. Run the automation script
2. Find date cutoffs in completed.md
3. Archive old entries
4. Clean progress.md
5. Update headers with archive references
