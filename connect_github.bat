@echo off
echo ========================================
echo The Scorekeeper - GitHub Connection
echo ========================================

set /p GITHUB_USERNAME="Enter your GitHub username: "
set /p REPO_NAME="Enter repository name (default: scorekeeper_lite): "
if "%REPO_NAME%"=="" set REPO_NAME=scorekeeper_lite

echo.
echo Connecting to GitHub repository...
echo Repository: https://github.com/%GITHUB_USERNAME%/%REPO_NAME%.git
echo.

git remote add origin https://github.com/%GITHUB_USERNAME%/%REPO_NAME%.git
git branch -M main
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo ✅ SUCCESS! Your code is now on GitHub!
    echo ========================================
    echo.
    echo Next steps:
    echo 1. Go to: https://github.com/%GITHUB_USERNAME%/%REPO_NAME%/settings/pages
    echo 2. Select "Deploy from a branch"
    echo 3. Choose "main" branch and "/ (root)" folder
    echo 4. Click "Save"
    echo.
    echo Your app will be live at:
    echo https://%GITHUB_USERNAME%.github.io/%REPO_NAME%/
    echo.
    echo ========================================
) else (
    echo.
    echo ❌ ERROR: Push failed
    echo.
    echo Possible issues:
    echo - Repository doesn't exist
    echo - Wrong username/repository name
    echo - Authentication issues
    echo.
    echo Try again or check your GitHub credentials.
)

pause