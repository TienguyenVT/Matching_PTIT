@echo off
echo Fixing optimization errors...

echo Installing dependencies...
call npm install

echo Clearing Next.js cache...
if exist .next\ rmdir /s /q .next

echo Setup complete! Run 'npm run dev' to start the optimized app.
pause
