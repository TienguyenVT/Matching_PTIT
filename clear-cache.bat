@echo off
echo Clearing Next.js cache...

REM Clear Next.js build cache
if exist ".next" (
    rmdir /s /q .next
    echo ✓ Cleared .next folder
)

REM Clear node_modules cache (optional, uncomment if needed)
REM if exist "node_modules\.cache" (
REM     rmdir /s /q node_modules\.cache
REM     echo ✓ Cleared node_modules cache
REM )

echo.
echo ✅ Cache cleared successfully!
echo.
echo Now run:
echo   1. npm run dev (to start development server)
echo   2. npm run test:performance (in another terminal)
echo.
