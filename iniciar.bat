@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"
title UNE - Consumo Electrico
color 0B

echo.
echo  ========================================
echo    UNE - Consumo Electrico
echo    Servidor Local
echo  ========================================
echo.

:: Obtener IP local
set "LOCAL_IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4" ^| findstr "192.168"') do (
    set "LOCAL_IP=%%a"
)
if defined LOCAL_IP set "LOCAL_IP=!LOCAL_IP: =!"

:: Puerto por defecto
set "DEFAULT_PORT=3000"
set "PORT=%DEFAULT_PORT%"

:: Verificar si el puerto por defecto esta disponible
netstat -an 2>nul | findstr ":%DEFAULT_PORT% " | findstr "LISTENING" >nul 2>&1
if !errorlevel!==0 (
    echo  [!] El puerto %DEFAULT_PORT% esta OCUPADO.
    echo.
    goto :pedir_puerto
)

echo  [OK] Puerto %DEFAULT_PORT% disponible.
echo.
echo  Opciones:
echo    [1] Iniciar en puerto %DEFAULT_PORT% (por defecto)
echo    [2] Elegir un puerto personalizado
echo.
set /p "OPCION=  Opcion (1/2): "
if "!OPCION!"=="2" goto :pedir_puerto
goto :iniciar

:pedir_puerto
echo.
set /p "PORT=  Ingresa el puerto deseado: "
if "!PORT!"=="" set "PORT=3000"

:: Verificar si el puerto elegido esta disponible
netstat -an 2>nul | findstr ":!PORT! " | findstr "LISTENING" >nul 2>&1
if !errorlevel!==0 (
    echo.
    echo  [!] El puerto !PORT! tambien esta ocupado.
    goto :pedir_puerto
)

:iniciar
echo.
echo  ========================================
echo   Iniciando en puerto !PORT!...
echo   Local:  http://localhost:!PORT!
if defined LOCAL_IP echo   Red:    http://!LOCAL_IP!:!PORT!
echo  ========================================
echo.
echo   Usa Ctrl+C para detener.
echo.

node server.js !PORT!

if !errorlevel! neq 0 (
    echo.
    echo  [ERROR] El servidor no pudo iniciar.
    echo  Puede que el puerto !PORT! este en uso.
    echo.
    set /p "RETRY=  Intentar con otro puerto? (s/n): "
    if /i "!RETRY!"=="s" goto :pedir_puerto
)

echo.
echo  Servidor detenido.
pause
