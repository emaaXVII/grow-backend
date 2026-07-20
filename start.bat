@echo off
echo Avvio backend GROW...
cd /d "%~dp0"
if not exist "node_modules\" (
  echo Installazione dipendenze...
  call npm install
)
echo.
echo Backend in esecuzione su http://localhost:3001
echo Premi Ctrl+C per fermarlo.
node server.js
