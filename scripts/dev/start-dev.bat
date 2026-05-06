@echo off
REM Start DarkFrame development server with Stripe webhook listener
REM This batch file works reliably on Windows without PATH issues

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║  Starting DarkFrame Development Environment            ║
echo ╚════════════════════════════════════════════════════════╝
echo.

REM Start both processes in parallel
start "DarkFrame Server" /B cmd /c "npm run dev:server"
start "Stripe Webhook Listener" /B cmd /c "npm run stripe:listen"

echo.
echo ✅ Both processes started!
echo.
echo Press Ctrl+C to stop all processes
echo.

REM Keep this window open
pause
