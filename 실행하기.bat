@echo off
cd /d "%~dp0"
echo starting Recipe Cost Calculator Server...
powershell -NoProfile -ExecutionPolicy Bypass -File run-server.ps1
pause
