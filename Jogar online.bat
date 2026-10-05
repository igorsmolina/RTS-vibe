@echo off
rem Abre o War Grid em http://localhost:5173 (precisa do Node.js). Necessario para salvar o progresso na nuvem.
cd /d "%~dp0"
node scripts\serve.cjs
pause
