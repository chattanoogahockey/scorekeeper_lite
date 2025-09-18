@echo off
setlocal

echo ========================================
echo Scorekeeper Lite - Deployment Helper
echo ========================================

echo Installing dependencies...
npm install
if errorlevel 1 goto npm_error

echo.
echo Running validation (lint + tests + data checks)...
npm run validate
if errorlevel 1 goto validate_error

echo.
set /p GITHUB_USERNAME="GitHub username: "
set /p REPO_NAME="Repository name (default: scorekeeper_lite): "
if "%REPO_NAME%"=="" set REPO_NAME=scorekeeper_lite

echo.
if not exist .git (
    echo Initializing git repository...
    git init
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo Adding remote origin for https://github.com/%GITHUB_USERNAME%/%REPO_NAME%.git
    git remote add origin https://github.com/%GITHUB_USERNAME%/%REPO_NAME%.git
)

echo Pushing to GitHub...
git branch -M main
git push -u origin main
if errorlevel 1 goto push_error

echo.
echo ========================================
echo Deployment complete!
echo Site: https://%GITHUB_USERNAME%.github.io/%REPO_NAME%/
echo Worker Endpoint: remember to update SCOREKEEPER_CONFIG.syncEndpoint
echo ========================================

goto end

:npm_error
echo npm install failed. Check Node/npm setup.
goto end

:validate_error
echo Validation failed. Fix lint/test/data issues before deploying.
goto end

:push_error
echo Git push failed. Verify repository access and credentials.

goto end

:end
echo.
pause
endlocal