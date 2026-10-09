@echo off
set "APP=%~dp0src-tauri\target\release\lifeos.exe"
if not exist "%APP%" (
  echo LifeOS has not been built yet. Run: npm run tauri build
  pause
  exit /b 1
)
start "LifeOS" "%APP%"
