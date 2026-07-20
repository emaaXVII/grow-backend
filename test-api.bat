@echo off
REM Test di base delle API del backend GROW
REM Presuppone che il server sia in esecuzione su http://localhost:3001

set BASE=http://localhost:3001
set PASS=0
set FAIL=0

echo --- Health Check ---
for /f %%i in ('curl -s -o nul -w "%%{http_code}" %BASE%/api/health') do set HEALTH=%%i
if "%HEALTH%"=="200" (echo   ✓ Health check & set /a PASS+=1) else (echo   ✗ Health check & set /a FAIL+=1)

echo --- Register ---
curl -s -X POST %BASE%/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"test@grow.app\",\"password\":\"test123\",\"nickname\":\"Test\"}" > register.json
findstr "token" register.json > nul
if %errorlevel%==0 (echo   ✓ Register & set /a PASS+=1) else (echo   ✗ Register & set /a FAIL+=1)

echo --- Login ---
curl -s -X POST %BASE%/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"test@grow.app\",\"password\":\"test123\"}" > login.json
findstr "token" login.json > nul
if %errorlevel%==0 (echo   ✓ Login & set /a PASS+=1) else (echo   ✗ Login & set /a FAIL+=1)

echo --- Results ---
echo Passati: %PASS%
echo Falliti: %FAIL%

del register.json login.json 2>nul
