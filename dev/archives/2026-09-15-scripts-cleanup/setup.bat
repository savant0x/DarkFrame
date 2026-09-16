@echo off
echo ============================================
echo   DarkFrame - Complete Setup Guide
echo ============================================
echo.
echo Step 1: MongoDB Atlas Setup (FREE)
echo --------------------------------------------
echo 1. Go to: https://www.mongodb.com/cloud/atlas/register
echo 2. Create a free account (no credit card required)
echo 3. Click "Create a New Cluster"
echo 4. Choose FREE tier (M0)
echo 5. Click "Create Cluster" (takes 3-5 minutes)
echo.
echo Step 2: Get Connection String
echo --------------------------------------------
echo 1. Click "Connect" on your cluster
echo 2. Click "Drivers"
echo 3. Copy the connection string (looks like):
echo    REDACTED_MONGO_URI_username:password@cluster.xxxxx.mongodb.net/
echo.
echo Step 3: Configure Environment
echo --------------------------------------------
echo Paste your MongoDB URI when prompted below:
echo.
set /p MONGO_URI="Enter MongoDB URI: "
echo MONGODB_URI=%MONGO_URI% > .env.local
echo.
echo ✅ .env.local configured!
echo.
echo Step 4: Initialize Map
echo --------------------------------------------
echo Running map initialization...
call npm run init-map
echo.
echo Step 5: Start Development Server
echo --------------------------------------------
echo Starting Next.js server...
call npm run dev
