@echo off
setlocal

echo ========================================
echo Quick Deploy (existing remote required)
echo ========================================

echo Running validation before push...
npm run validate
if errorlevel 1 goto validate_error

echo.
echo Pushing to origin/main...
git push origin main
if errorlevel 1 goto push_error

echo.
echo Done! Visit your GitHub Pages site to confirm the update.
goto end

:validate_error
echo Validation failed. Fix issues before deploying.
goto end

:push_error
echo Git push failed. Ensure remote origin exists and you have permission.

goto end

:end
echo.
pause
endlocal