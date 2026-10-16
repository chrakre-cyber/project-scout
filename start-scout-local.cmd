@echo off
cd /d "%~dp0"
set "NODE_EXTRA_CA_CERTS=%~dp0certs\prod-ca-2021.crt"
call npm.cmd run dev
pause
