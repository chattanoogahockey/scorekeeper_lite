@echo off
echo ========================================
echo 🚀 QUICK DEPLOY - Enter Your GitHub Info
echo ========================================

set /p GITHUB_USERNAME="Your GitHub username: "
set /p REPO_NAME="Repository name (default: scorekeeper_lite): "
if "%REPO_NAME%"=="" set REPO_NAME=scorekeeper_lite

echo.
echo 📡 Connecting to: https://github.com/%GITHUB_USERNAME%/%REPO_NAME%.git
echo.

git remote add origin https://github.com/%GITHUB_USERNAME%/%REPO_NAME%.git
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo 🎉 SUCCESS! CODE IS ON GITHUB!
    echo ========================================
    echo.
    echo 🌐 NEXT STEPS:
    echo =============
    echo 1. Go to: https://github.com/%GITHUB_USERNAME%/%REPO_NAME%/settings/pages
    echo 2. Select "Deploy from a branch"
    echo 3. Choose: main branch, /(root) folder
    echo 4. Click "Save"
    echo.
    echo 🚀 YOUR APP WILL BE LIVE AT:
    echo https://%GITHUB_USERNAME%.github.io/%REPO_NAME%/
    echo.
) else (
    echo.
    echo ❌ FAILED - Please check:
    echo - Your GitHub username is correct
    echo - Repository exists and is spelled correctly
    echo - You have push access to the repository
    echo.
)

pause