@echo off
setlocal

echo ========================================
echo Connect Local Repo To GitHub

echo This script only adds the remote and pushes the current branch.
echo Make sure you have run npm run validate before calling this.
echo ========================================

echo.
set /p GITHUB_USERNAME="GitHub username: "
set /p REPO_NAME="Repository name (default: scorekeeper_lite): "
if "%REPO_NAME%"=="" set REPO_NAME=scorekeeper_lite

git remote get-url origin >nul 2>&1
if errorlevel 1 (
    git remote add origin https://github.com/%GITHUB_USERNAME%/%REPO_NAME%.git
) else (
    echo Remote already configured. Skipping add.
)

echo Setting main branch and pushing...
git branch -M main
git push -u origin main
if errorlevel 1 goto push_error

echo.
echo Remote ready! GitHub Pages URL:
echo https://%GITHUB_USERNAME%.github.io/%REPO_NAME%/

goto end

:push_error
echo Push failed. Verify repository existence and credentials.

goto end

:end
echo.
pause
endlocal