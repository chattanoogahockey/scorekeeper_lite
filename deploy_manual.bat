@echo off
echo CHAHKY Scorekeeper - Manual GitHub Setup
echo ========================================

set /p GITHUB_USERNAME="Enter your GitHub username: "
set /p REPO_NAME="Enter repository name (default: scorekeeper_lite): "
if "%REPO_NAME%"=="" set REPO_NAME=scorekeeper_lite

echo.
echo Step 1: Create repository on GitHub
echo ===================================
echo 1. Go to: https://github.com/new
echo 2. Repository name: %REPO_NAME%
echo 3. Make it Public
echo 4. DO NOT initialize with README, .gitignore, or license
echo 5. Click "Create repository"
echo.
echo Press any key when you've created the repository...
pause >nul

echo.
echo Step 2: Connect and push to GitHub
echo ===================================

echo Adding remote origin...
git remote add origin https://github.com/%GITHUB_USERNAME%/%REPO_NAME%.git

echo Setting main branch...
git branch -M main

echo Pushing to GitHub...
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ✅ Successfully pushed to GitHub!
    echo.
    echo Step 3: Enable GitHub Pages
    echo ===========================
    echo 1. Go to: https://github.com/%GITHUB_USERNAME%/%REPO_NAME%/settings/pages
    echo 2. Select "Deploy from a branch"
    echo 3. Choose "main" branch and "/ (root)" folder
    echo 4. Click "Save"
    echo.
    echo Your app will be live at: https://%GITHUB_USERNAME%.github.io/%REPO_NAME%/
    echo.
) else (
    echo.
    echo ❌ Push failed. Please check your GitHub credentials and try again.
    echo.
)

pause