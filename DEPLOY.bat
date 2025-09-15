@echo off
echo ========================================
echo 🚀 CHAHKY Scorekeeper - FINAL DEPLOYMENT
echo ========================================
echo.
echo This script will connect your local project to GitHub
echo and push everything to make your app live!
echo.

set /p GITHUB_USERNAME="Enter your GitHub username: "
set /p REPO_NAME="Enter repository name (default: scorekeeper_lite): "
if "%REPO_NAME%"=="" set REPO_NAME=scorekeeper_lite

echo.
echo 📡 Connecting to GitHub...
echo Repository: https://github.com/%GITHUB_USERNAME%/%REPO_NAME%.git
echo.

REM Add remote and push
git remote add origin https://github.com/%GITHUB_USERNAME%/%REPO_NAME%.git 2>nul
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo 🎉 SUCCESS! CODE PUSHED TO GITHUB!
    echo ========================================
    echo.
    echo ✅ Your code is now live on GitHub
    echo.
    echo 🌐 NEXT: Enable GitHub Pages
    echo ===============================
    echo 1. Go to: https://github.com/%GITHUB_USERNAME%/%REPO_NAME%/settings/pages
    echo 2. Select "Deploy from a branch"
    echo 3. Choose branch: main, folder: /(root)
    echo 4. Click "Save"
    echo.
    echo 🚀 YOUR APP WILL BE LIVE AT:
    echo https://%GITHUB_USERNAME%.github.io/%REPO_NAME%/
    echo.
    echo ===============================
    echo 🎯 READY TO SCORE SOME GAMES!
    echo ===============================
) else (
    echo.
    echo ❌ DEPLOYMENT FAILED
    echo ====================
    echo.
    echo Possible issues:
    echo • Repository doesn't exist yet
    echo • Wrong username/repository name
    echo • GitHub authentication needed
    echo.
    echo Please check and try again!
    echo.
)

echo.
echo Press any key to exit...
pause >nul