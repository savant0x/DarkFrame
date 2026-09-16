# DarkFrame - Quick Start Script
# Run this to set up MongoDB and start the server

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  DarkFrame - Complete Setup Guide" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env.local exists and has valid MongoDB URI
$envPath = ".env.local"
if (Test-Path $envPath) {
    $content = Get-Content $envPath -Raw
    if ($content -match "mongodb\+srv://") {
        Write-Host "✅ MongoDB URI already configured!" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "⚠️  MongoDB URI not configured yet" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "QUICK SETUP OPTIONS:" -ForegroundColor Cyan
        Write-Host "--------------------" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Option 1: MongoDB Atlas (FREE Cloud - Recommended)" -ForegroundColor Green
        Write-Host "  1. Visit: https://www.mongodb.com/cloud/atlas/register"
        Write-Host "  2. Create free account (M0 tier - no credit card)"
        Write-Host "  3. Create cluster (takes 3-5 minutes)"
        Write-Host "  4. Click 'Connect' → 'Drivers' → Copy connection string"
        Write-Host "  5. Replace <password> with your database password"
        Write-Host ""
        Write-Host "Example URI format:" -ForegroundColor Yellow
        Write-Host "REDACTED_MONGO_URI_username:password@cluster.xxxxx.mongodb.net/darkframe"
        Write-Host ""
        Write-Host "Option 2: Local MongoDB" -ForegroundColor Green
        Write-Host "  1. Download: https://www.mongodb.com/try/download/community"
        Write-Host "  2. Install and start MongoDB service"
        Write-Host "  3. Use URI: mongodb://localhost:27017/darkframe"
        Write-Host ""
        
        $response = Read-Host "Do you have a MongoDB URI ready? (y/n)"
        
        if ($response -eq "y" -or $response -eq "Y") {
            $mongoUri = Read-Host "Enter your MongoDB URI"
            "MONGODB_URI=$mongoUri" | Out-File -FilePath $envPath -Encoding UTF8
            Write-Host ""
            Write-Host "✅ MongoDB URI configured!" -ForegroundColor Green
            Write-Host ""
        } else {
            Write-Host ""
            Write-Host "Please set up MongoDB and run this script again." -ForegroundColor Yellow
            Write-Host ""
            exit
        }
    }
}

# Initialize map
Write-Host "Step 1: Initializing 150×150 map..." -ForegroundColor Cyan
Write-Host "------------------------------------" -ForegroundColor Cyan
npm run init-map

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Map initialized successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Step 2: Starting development server..." -ForegroundColor Cyan
    Write-Host "---------------------------------------" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🚀 Server will start at: http://localhost:3000" -ForegroundColor Green
    Write-Host "📝 First visit: http://localhost:3000/register" -ForegroundColor Green
    Write-Host ""
    Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
    Write-Host ""
    
    npm run dev
} else {
    Write-Host ""
    Write-Host "❌ Map initialization failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "1. MongoDB URI incorrect - check .env.local"
    Write-Host "2. Network connection issues"
    Write-Host "3. MongoDB cluster not ready yet (wait 5 minutes)"
    Write-Host ""
    Write-Host "Check the error message above for details." -ForegroundColor Yellow
    Write-Host ""
}
