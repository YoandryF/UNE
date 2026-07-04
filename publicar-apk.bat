@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"
title UNE - Publicar Actualización
color 0E

echo.
echo  ========================================
echo    UNE - Publicar Nueva Version APK
echo  ========================================
echo.

:: Leer versión actual del app-version.json
for /f "tokens=2 delims=:," %%a in ('findstr "latest" "C:\wamp64\www\UNE\data\app-version.json"') do (
    set "CURRENT=%%~a"
)
set "CURRENT=!CURRENT: =!"
set "CURRENT=!CURRENT:"=!"
echo  Version actual en servidor: !CURRENT!
echo.

:: Pedir nueva versión
set /p "NEW_VERSION=  Nueva version (ej: 1.2.0): "
if "!NEW_VERSION!"=="" (
    echo  [!] Debes ingresar una version.
    goto :end
)

:: Pedir changelog
set /p "CHANGELOG=  Changelog (descripcion breve): "
if "!CHANGELOG!"=="" set "CHANGELOG=Mejoras y correcciones"

:: Pedir fecha limite (forceDate)
set /p "FORCE_DATE=  Fecha obligatoria (YYYY-MM-DD, Enter=30 dias): "
if "!FORCE_DATE!"=="" (
    :: Calcular 30 días desde hoy usando PowerShell
    for /f %%d in ('powershell -command "(Get-Date).AddDays(30).ToString('yyyy-MM-dd')"') do set "FORCE_DATE=%%d"
)

echo.
echo  ----------------------------------------
echo   Version: !NEW_VERSION!
echo   Changelog: !CHANGELOG!
echo   Fecha obligatoria: !FORCE_DATE!
echo  ----------------------------------------
echo.
set /p "CONFIRM=  ¿Proceder? (s/n): "
if /i not "!CONFIRM!"=="s" goto :end

:: 1. Actualizar currentVersion en update_service.dart
echo.
echo  [1/5] Actualizando version en codigo Flutter...
powershell -command "(Get-Content 'C:\wamp64\www\APK\une_consumo\lib\update_service.dart') -replace \"currentVersion = '[^']+'\", \"currentVersion = '!NEW_VERSION!'\" | Set-Content 'C:\wamp64\www\APK\une_consumo\lib\update_service.dart'"

:: 2. Actualizar pubspec.yaml version
echo  [2/5] Actualizando pubspec.yaml...
powershell -command "$v='!NEW_VERSION!'; $build=[int]$v.Split('.')[0]*100+[int]$v.Split('.')[1]*10+[int]$v.Split('.')[2]; (Get-Content 'C:\wamp64\www\APK\une_consumo\pubspec.yaml') -replace 'version: .+', \"version: $v+$build\" | Set-Content 'C:\wamp64\www\APK\une_consumo\pubspec.yaml'"

:: 3. Compilar APK
echo  [3/5] Compilando APK (esto toma ~1 minuto)...
cd /d "C:\wamp64\www\APK\une_consumo"
flutter build apk --release >nul 2>&1
if !errorlevel! neq 0 (
    echo  [ERROR] Fallo la compilacion. Revisa errores con: flutter build apk --release
    goto :end
)
echo         Compilacion exitosa.

:: 4. Copiar APK al servidor
echo  [4/5] Copiando APK al servidor...
copy /y "build\app\outputs\flutter-apk\app-release.apk" "C:\wamp64\www\UNE\downloads\une-consumo.apk" >nul

:: 5. Actualizar app-version.json
echo  [5/5] Actualizando app-version.json...
(
echo {
echo   "latest": "!NEW_VERSION!",
echo   "minRequired": "!CURRENT!",
echo   "forceDate": "!FORCE_DATE!",
echo   "downloadUrl": "/downloads/une-consumo.apk",
echo   "changelog": "!CHANGELOG!"
echo }
) > "C:\wamp64\www\UNE\data\app-version.json"

:: Commit en ambos repos
echo.
echo  [OK] Publicacion completada.
echo.
echo  ========================================
echo   v!NEW_VERSION! publicada exitosamente
echo   Los usuarios veran la actualizacion
echo   al abrir la app o tocar "Actualizaciones"
echo   Sera obligatoria el !FORCE_DATE!
echo  ========================================
echo.

set /p "GIT=  ¿Hacer commit en git? (s/n): "
if /i "!GIT!"=="s" (
    cd /d "C:\wamp64\www\APK\une_consumo"
    git add -A >nul 2>&1
    git commit -m "release: v!NEW_VERSION! - !CHANGELOG!" >nul 2>&1
    cd /d "C:\wamp64\www\UNE"
    git add -A >nul 2>&1
    git commit -m "release: APK v!NEW_VERSION!" >nul 2>&1
    echo  [OK] Commits realizados.
)

:end
echo.
pause
