@echo off
echo The Scorekeeper - GitHub Deployment Script
echo ==============================================

set /p GITHUB_USERNAME="Enter your GitHub username: "
set /p REPO_NAME="Enter repository name (default: scorekeeper_lite): "
if "%REPO_NAME%"=="" set REPO_NAME=scorekeeper_lite

echo.
echo Creating GitHub repository: %GITHUB_USERNAME%/%REPO_NAME%
echo.

REM Check if GitHub CLI is available
gh --version >nul 2>&1
if %errorlevel% neq 0 (
    echo GitHub CLI not found. Please install it from: https://cli.github.com/
    echo Or create the repository manually at: https://github.com/new
    echo.
    echo After creating the repository, run these commands:
    echo git remote add origin https://github.com/%GITHUB_USERNAME%/%REPO_NAME%.git
    echo git branch -M main
    echo git push -u origin main
    pause
    exit /b 1
)

REM Create GitHub repository
echo Creating repository on GitHub...
gh repo create %REPO_NAME% --public --source=. --remote=origin --push

if %errorlevel% equ 0 (
    echo.
    echo ✅ Repository created successfully!
    echo.
    echo Your app will be available at: https://%GITHUB_USERNAME%.github.io/%REPO_NAME%/
    echo.
    echo To enable GitHub Pages:
    echo 1. Go to: https://github.com/%GITHUB_USERNAME%/%REPO_NAME%/settings/pages
    echo 2. Select "Deploy from a branch"
    echo 3. Choose "main" branch and "/ (root)" folder
    echo 4. Click "Save"
    echo.
) else (
    echo.
    echo ❌ Failed to create repository. Please try manually.
    echo.
)

pause