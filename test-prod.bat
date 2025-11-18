@echo off
echo ========================================
echo   PRODUCTION PERFORMANCE TEST
echo ========================================
echo.

echo Step 0: Stopping any running dev servers...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /F /PID %%a > nul 2>&1
timeout /t 2 /nobreak > nul
echo ✅ Port 3000 freed!
echo.

echo Step 1: Building production bundle...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Build failed!
    exit /b 1
)
echo ✅ Build complete!
echo.

echo Step 2: Starting production server...
echo Please wait 10 seconds for server to start...
start /B npm run start
timeout /t 10 /nobreak > nul
echo ✅ Server started!
echo.

echo Step 3: Running performance tests...
call npm run test:performance
set TEST_RESULT=%errorlevel%
echo.

echo Step 4: Stopping production server...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /F /PID %%a > nul 2>&1
echo ✅ Server stopped!
echo.

if %TEST_RESULT% equ 0 (
    echo ========================================
    echo   ✅ ALL TESTS PASSED!
    echo ========================================
) else (
    echo ========================================
    echo   ❌ TESTS FAILED
    echo ========================================
)

exit /b %TEST_RESULT%
