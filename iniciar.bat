@echo off
cd /d "%~dp0"
echo Iniciando UNE - Consumo Electrico...
echo http://localhost:%1
if "%1"=="" (
  echo http://localhost:3000
  node server.js
) else (
  echo http://localhost:%1
  node server.js %1
)
pause
