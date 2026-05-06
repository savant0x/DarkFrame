# DarkFrame /dev Daily Archive Script
# Archives old entries and non-main files to keep /dev folder clean
# Usage: .\dev\scripts\archive-daily.ps1

param([switch]$DryRun)

$today = Get-Date -Format "yyyy-MM-dd"
$archiveDir = "dev\archives\$today"

Write-Host "Dev Daily Archive - $today" -ForegroundColor Cyan

# Create archive directory
if (-not (Test-Path $archiveDir)) {
    if (-not $DryRun) { New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null }
    Write-Host "Created: $archiveDir" -ForegroundColor Green
}

# Archive non-main tracking files
$mainFiles = @('planned.md','progress.md','completed.md','issues.md','roadmap.md','metrics.md','architecture.md','lessons-learned.md','suggestions.md','quality-control.md','decisions.md')

$extraFiles = Get-ChildItem "dev" -Filter "*.md" | Where-Object { ($_.Name -notin $mainFiles) -and ($_.LastWriteTime.Date -lt (Get-Date).Date) }

if ($extraFiles.Count -gt 0) {
    Write-Host "Found $($extraFiles.Count) files to archive:" -ForegroundColor Yellow
    foreach ($file in $extraFiles) {
        Write-Host "  $($file.Name)" -ForegroundColor Gray
        if (-not $DryRun) { Move-Item "dev\$($file.Name)" $archiveDir -Force }
    }
    Write-Host "Archived $($extraFiles.Count) files" -ForegroundColor Green
} else {
    Write-Host "No extra files to archive" -ForegroundColor Gray
}

# Check file sizes
$completedSize = [math]::Round((Get-Item "dev\completed.md").Length / 1KB, 2)
$progressSize = [math]::Round((Get-Item "dev\progress.md").Length / 1KB, 2)

Write-Host "`nFile Sizes:" -ForegroundColor Cyan
Write-Host "  completed.md: $completedSize KB $(if($completedSize -gt 50){'(LARGE - consider archiving old entries)'})" -ForegroundColor White
Write-Host "  progress.md: $progressSize KB $(if($progressSize -gt 10){'(Should be CLEAN SLATE)'})" -ForegroundColor White

Write-Host "`nRemaining files:" -ForegroundColor Cyan
Get-ChildItem "dev" -Filter "*.md" | Select-Object Name, @{Name="Size";Expression={"$([math]::Round($_.Length/1KB,1)) KB"}} | Format-Table -AutoSize

Write-Host "Archive complete!" -ForegroundColor Green
