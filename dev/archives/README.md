# Archival Strategy & Usage

This folder stores archived snapshots of `dev/completed.md`, organized by category (year-month) to avoid a single monolithic archive file.

Usage:

- Run the archival script to move older entries into categorized archive files:

  node dev/scripts/archive_completed.js --keep 30

- Dry-run (no writes):

  node dev/scripts/archive_completed.js --keep 30 --dry-run

Files:
- completed_archive_YYYY-MM-DD_<category>.md - categorized archives
- manifest.json - listing of created archives and counts

Policy:
- Default retention: keep the most recent 30 top-level FID entries in `dev/completed.md`.
- Archives are named by the snapshot date and category (e.g., 2025-10-19_2025-10). Category is year-month inferred from FID dates.

Scheduling & CI:
- You can schedule this script as a cron job or use a GitHub Actions workflow to run periodically.
- When running in CI, use the --dry-run flag for testing first.
