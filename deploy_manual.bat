@echo off
setlocal

echo ========================================
echo Manual Deployment Checklist
========================================

echo 1. npm install
echo 2. npm run validate
echo 3. git status (ensure only expected changes)
echo 4. git add .
echo 5. git commit -m "Your message"
echo 6. git push origin main

echo Run DEPLOY.bat if you want the automated helper.

echo ========================================

echo When GitHub Pages finishes publishing, visit:
echo https://github.io/YOUR-USERNAME/scorekeeper_lite/

echo Remember to update SCOREKEEPER_CONFIG.syncEndpoint with your Worker URL.

echo ========================================

echo.
pause
endlocal