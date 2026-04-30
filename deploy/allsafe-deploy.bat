@echo off
:: ============================================================================
::  Allsafe — Windows deploy launcher
::  Double-click this file to update / check / restart the server over SSH.
::  No git, no scp, no PowerShell required — uses Windows built-in OpenSSH.
::
::  First run asks for server host / user / branch and saves them to:
::    %APPDATA%\allsafe-deploy\config.cfg
::  (so the next run is one click).
:: ============================================================================
setlocal EnableDelayedExpansion
chcp 65001 >NUL
title Allsafe :: deploy

:: ----- locate ssh.exe (Windows OpenSSH) -----
where ssh >NUL 2>&1
if errorlevel 1 (
    echo.
    echo  [ERROR] ssh.exe not found.
    echo  Install OpenSSH Client:
    echo    Settings -^> Apps -^> Optional features -^> Add a feature -^> OpenSSH Client
    echo.
    pause
    exit /b 1
)

:: ----- config file -----
set "CFG_DIR=%APPDATA%\allsafe-deploy"
set "CFG=%CFG_DIR%\config.cfg"
if not exist "%CFG_DIR%" mkdir "%CFG_DIR%" >NUL 2>&1

if not exist "%CFG%" goto CONFIGURE
call :LOAD_CFG

:MENU
cls
echo.
echo   ╔══════════════════════════════════════════════════════╗
echo   ║              ALLSAFE — DEPLOY LAUNCHER               ║
echo   ╚══════════════════════════════════════════════════════╝
echo.
echo     Server : %SSH_USER%@%SSH_HOST%
echo     Branch : %BRANCH%
echo     APPDIR : %APP_DIR%
echo.
echo   ─────────────────────────────────────────────────────────
echo     [1]  Pull and deploy   (runs update.sh on server)
echo     [2]  Server status     (pm2 + health check)
echo     [3]  Tail logs         (Ctrl+C to exit)
echo     [4]  Restart Node      (pm2 restart)
echo     [5]  Reload nginx
echo     [6]  Open SSH shell
echo     [7]  Reconfigure (host / user / branch)
echo     [0]  Exit
echo   ─────────────────────────────────────────────────────────
echo.
set /p CHOICE=  ^>  Choice:

if "%CHOICE%"=="1" goto DEPLOY
if "%CHOICE%"=="2" goto STATUS
if "%CHOICE%"=="3" goto LOGS
if "%CHOICE%"=="4" goto RESTART
if "%CHOICE%"=="5" goto NGINX
if "%CHOICE%"=="6" goto SHELL
if "%CHOICE%"=="7" goto CONFIGURE
if "%CHOICE%"=="0" goto END
goto MENU


:: ============================================================================
::  Actions
:: ============================================================================

:DEPLOY
cls
echo.
echo   ── Pulling fresh code from %BRANCH% and running update.sh ─────────────
echo.
ssh -t %SSH_USER%@%SSH_HOST% ^
  "curl -fsSL https://raw.githubusercontent.com/alexkonstich-byte/neuro-chat/%BRANCH%/deploy/update.sh | BRANCH=%BRANCH% APP_DIR='%APP_DIR%' GIT=1 bash"
echo.
echo   ── Done. Press any key to return to the menu ─────────────────────────
pause >NUL
goto MENU

:STATUS
cls
echo.
echo   ── pm2 status ────────────────────────────────────────────────────────
echo.
ssh -t %SSH_USER%@%SSH_HOST% "pm2 status; echo; echo '── /api/auth/me ──'; curl -s -o /dev/null -w 'HTTP %%{http_code}\n' http://127.0.0.1:3001/api/auth/me"
echo.
pause
goto MENU

:LOGS
cls
echo.
echo   ── Live logs (Ctrl+C to stop) ────────────────────────────────────────
echo.
ssh -t %SSH_USER%@%SSH_HOST% "pm2 logs neuro-server"
goto MENU

:RESTART
cls
echo.
echo   ── pm2 restart neuro-server ──────────────────────────────────────────
echo.
ssh -t %SSH_USER%@%SSH_HOST% "pm2 restart neuro-server && sleep 1 && pm2 status"
echo.
pause
goto MENU

:NGINX
cls
echo.
echo   ── nginx -t ^&^& systemctl reload nginx ───────────────────────────────
echo.
ssh -t %SSH_USER%@%SSH_HOST% "sudo nginx -t && sudo systemctl reload nginx && echo OK"
echo.
pause
goto MENU

:SHELL
cls
echo.
echo   ── Interactive shell on %SSH_USER%@%SSH_HOST%. Type 'exit' to come back ──
echo.
ssh -t %SSH_USER%@%SSH_HOST%
goto MENU


:: ============================================================================
::  Configure / load
:: ============================================================================

:CONFIGURE
cls
echo.
echo   ── First-run configuration ────────────────────────────────────────────
echo   These will be saved to: %CFG%
echo.
set /p SSH_HOST=  Server host  (e.g. neurochat.space or 1.2.3.4):
if "%SSH_HOST%"=="" goto CONFIGURE
set /p SSH_USER=  SSH user     (default: dev):
if "%SSH_USER%"=="" set SSH_USER=dev
set /p BRANCH=  Branch        (default: redesign-bootstrap-voice-fixes):
if "%BRANCH%"=="" set BRANCH=redesign-bootstrap-voice-fixes
set /p APP_DIR=  Install path  (default: /opt/neuro):
if "%APP_DIR%"=="" set APP_DIR=/opt/neuro

(
  echo SSH_HOST=%SSH_HOST%
  echo SSH_USER=%SSH_USER%
  echo BRANCH=%BRANCH%
  echo APP_DIR=%APP_DIR%
) > "%CFG%"

echo.
echo   ── Saved. Testing connection ─────────────────────────────────────────
ssh -o ConnectTimeout=5 -o BatchMode=no %SSH_USER%@%SSH_HOST% "echo Connected as $(whoami) on $(hostname)"
if errorlevel 1 (
  echo.
  echo   [WARN] Connection test failed. Check host / SSH key / firewall.
  echo         You can still try the menu, but commands will hang on auth.
)
echo.
pause
goto MENU

:LOAD_CFG
for /f "usebackq tokens=1,* delims==" %%A in ("%CFG%") do (
  if /i "%%A"=="SSH_HOST" set "SSH_HOST=%%B"
  if /i "%%A"=="SSH_USER" set "SSH_USER=%%B"
  if /i "%%A"=="BRANCH"   set "BRANCH=%%B"
  if /i "%%A"=="APP_DIR"  set "APP_DIR=%%B"
)
exit /b 0

:END
echo.
echo   bye.
endlocal
exit /b 0
