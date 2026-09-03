# PowerShell script to add logger imports and replace console statements
# Run from project root: .\scripts\add-logger-imports.ps1

$files = @(
    "app\api\harvest\route.ts",
    "app\api\move\route.ts",
    "app\api\tile\route.ts",
    "app\api\inventory\route.ts",
    "app\api\leaderboard\route.ts",
    "app\api\player\build-unit\route.ts",
    "app\api\player\upgrade-unit\route.ts",
    "app\api\factory\list\route.ts",
    "app\api\factory\upgrade\route.ts",
    "app\api\factory\abandon\route.ts",
    "app\api\factory\attack\route.ts",
    "app\api\factory\produce\route.ts",
    "app\api\factory\status\route.ts",
    "app\api\factory\build-unit\route.ts",
    "app\api\bank\deposit\route.ts",
    "app\api\bank\withdraw\route.ts",
    "app\api\bank\exchange\route.ts",
    "app\api\combat\base\route.ts",
    "app\api\combat\infantry\route.ts",
    "app\api\combat\logs\route.ts",
    "app\api\shrine\sacrifice\route.ts",
    "app\api\shrine\extend\route.ts",
    "app\api\tier\unlock\route.ts",
    "app\api\harvest\status\route.ts",
    "app\api\auth\register\route.ts",
    "app\api\assets\images\route.ts",
    "components\InventoryPanel.tsx",
    "components\FactoryButton.tsx",
    "components\TierUnlockPanel.tsx",
    "components\UnitBuildPanelEnhanced.tsx",
    "components\BattleLogViewer.tsx",
    "components\CombatAttackModal.tsx",
    "components\FactoryManagementPanel.tsx",
    "components\BattleLogLinks.tsx",
    "components\BattleLogModal.tsx",
    "components\HarvestStatus.tsx",
    "components\HarvestButton.tsx",
    "components\ControlsPanel.tsx",
    "app\leaderboard\page.tsx",
    "app\login\page.tsx",
    "app\register\page.tsx"
)

foreach ($file in $files) {
    $fullPath = Join-Path $PSScriptRoot "..\$file"
    
    if (Test-Path $fullPath) {
        Write-Host "Processing: $file" -ForegroundColor Cyan
        
        $content = Get-Content $fullPath -Raw
        
        # Check if logger is already imported
        if ($content -notmatch "import.*logger.*from") {
            # Find the last import statement and add logger import after it
            if ($content -match "(?sm)(import\s+.*?from\s+['\"].*?['\"];?\s*\n)") {
                $lastImport = $matches[0]
                $importLine = "import { logger } from '@/lib/logger';`n"
                $content = $content -replace [regex]::Escape($lastImport), "$lastImport$importLine"
                Write-Host "  ✓ Added logger import" -ForegroundColor Green
            }
        } else {
            Write-Host "  → Logger already imported" -ForegroundColor Yellow
        }
        
        # Replace console.error patterns
        $errorCount = ([regex]::Matches($content, "console\.error\(")).Count
        if ($errorCount -gt 0) {
            # Replace console.error('Message:', error) → logger.error('Message', error instanceof Error ? error : new Error(String(error)))
            $content = $content -replace "console\.error\(['`"]([^'`"]+)['`"],\s*(\w+)\);", 
                "logger.error('`$1', `$2 instanceof Error ? `$2 : new Error(String(`$2)));"
            
            # Replace simple console.error('Message:' + value) patterns
            $content = $content -replace "console\.error\(['`"]([^'`"]+)['`"]\);", "logger.error('`$1');"
            
            Write-Host "  ✓ Replaced $errorCount console.error() calls" -ForegroundColor Green
        }
        
        # Replace console.log patterns
        $logCount = ([regex]::Matches($content, "console\.log\(")).Count
        if ($logCount -gt 0) {
            # Replace console.log with logger.debug for development logging
            $content = $content -replace "console\.log\(['`"]([^'`"]+)['`"],\s*(\w+)\);", "logger.debug('`$1', { data: `$2 });"
            $content = $content -replace "console\.log\(['`"]([^'`"]+)['`"]\);", "logger.debug('`$1');"
            
            # Handle emoji patterns
            $content = $content -replace "console\.log\(['`"]✅\s*([^'`"]+)['`"]\);", "logger.success('`$1');"
            $content = $content -replace "console\.log\(['`"]🔄\s*([^'`"]+)['`"]\);", "logger.info('`$1');"
            $content = $content -replace "console\.log\(['`"]❌\s*([^'`"]+)['`"]\);", "logger.error('`$1');"
            
            Write-Host "  ✓ Replaced $logCount console.log() calls" -ForegroundColor Green
        }
        
        # Write back to file
        Set-Content -Path $fullPath -Value $content -NoNewline
    } else {
        Write-Host "  ✗ File not found: $file" -ForegroundColor Red
    }
}

Write-Host "`n✅ Logger migration complete! Remember to test the application." -ForegroundColor Green
