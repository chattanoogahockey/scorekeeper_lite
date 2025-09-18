@echo off
setlocal

echo ========================================
echo Create GitHub Repo With gh
========================================

gh --version >nul 2>&1
if errorlevel 1 goto gh_missing

echo Running validation before publishing...
npm run validate
if errorlevel 1 goto validate_error

echo.
set /p REPO_NAME="Repository name (default: scorekeeper_lite): "
if "%REPO_NAME%"=="" set REPO_NAME=scorekeeper_lite

echo Creating %REPO_NAME% on GitHub and pushing current branch...
gh repo create %REPO_NAME% --public --source=. --remote=origin --push
if errorlevel 1 goto gh_error

echo.
echo Repository ready! Enable GitHub Pages from Settings > Pages (branch: main, folder: /(root)).
echo Update SCOREKEEPER_CONFIG.syncEndpoint with your Worker URL to enable syncing.

goto end

:gh_missing
echo GitHub CLI not found. Install from https://cli.github.com/ or use DEPLOY.bat.
goto end

:validate_error
echo Validation failed. Fix issues before creating the repo.
goto end

:gh_error
echo gh repo create failed. Check the CLI output above.

goto end

:end
echo.
pause
endlocal