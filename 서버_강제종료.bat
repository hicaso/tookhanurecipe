@echo off
chcp 65001 >nul
echo ==================================================
echo  레시피 원가 계산기 백그라운드 서버 종료기
echo ==================================================
echo.
echo 백그라운드에 숨어있는 서버 프로세스를 찾아 종료합니다...
powershell -Command "Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -match 'recipe-cost-calculator' -and $_.CommandLine -match 'run-server.ps1' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
echo.
echo 서버 종료가 완료되었습니다. 창을 닫으셔도 됩니다.
pause >nul
