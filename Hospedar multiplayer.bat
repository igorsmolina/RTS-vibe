@echo off
chcp 65001 >nul
title Servidor multiplayer
rem Liga o multiplayer neste PC com um clique: servidor + link publico (Cloudflare). Desliga sozinho no horario de corte (scriptshost-local.cjs).
cd /d "%~dp0"
where node >nul 2>nul || (
  echo Instale o Node.js em https://nodejs.org e abra este arquivo de novo.
  pause
  exit /b 1
)
where cloudflared >nul 2>nul || (
  echo Instalando o tunel da Cloudflare, aguarde...
  winget install -e --id Cloudflare.cloudflared --accept-source-agreements --accept-package-agreements
  echo.
  echo Pronto. Feche esta janela e abra este arquivo de novo.
  pause
  exit /b 0
)
if not exist node_modulesws call npm install --omit=dev --ignore-scripts --no-audit --no-fund
node scriptshost-local.cjs
pause
