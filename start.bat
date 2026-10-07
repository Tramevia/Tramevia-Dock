@echo off
rem Tramevia Dock - Windows launcher (double-click). / Lanceur Windows (double-clic).
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Tramevia Dock
where node >nul 2>nul
if errorlevel 1 (
  echo [FR] Node.js n'est pas installe. Installe la version LTS depuis https://nodejs.org puis relance ce fichier.
  echo [EN] Node.js is not installed. Install the LTS version from https://nodejs.org and run this file again.
  start "" https://nodejs.org/
  pause
  exit /b 1
)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>24||(a===24&&b>=15)?0:1)"
if errorlevel 1 (
  echo [FR] Node.js 24.15 ou plus recent est requis. Mets a jour depuis https://nodejs.org
  echo [EN] Node.js 24.15 or newer is required. Update from https://nodejs.org
  pause
  exit /b 1
)
set TRAMEVIA_LAUNCHER=1
:run
rem (Re)install dependencies when missing or out of date (e.g. after an update).
node -e "const l=require('./package-lock.json').packages,f=require('fs');for(const k in l){if(!k.startsWith('node_modules/')||k.indexOf('/node_modules/')>0||l[k].dev||l[k].optional)continue;try{if(JSON.parse(f.readFileSync(k+'/package.json')).version!==l[k].version)process.exit(1)}catch{process.exit(1)}}"
if errorlevel 1 (
  echo [FR] Installation des dependances... / [EN] Installing dependencies...
  call npm ci --omit=dev --no-audit --no-fund
  if errorlevel 1 ( pause & exit /b 1 )
)
rem UPDATE CONTRACT: keep the next 3 lines identical in every version. The updater replaces this file while it runs;
rem cmd re-reads the file after each line, so every line that runs after a swap must end in "goto".
node src\server.js %* & if errorlevel 75 if not errorlevel 76 goto run
if %errorlevel% neq 0 if %errorlevel% neq 98 if exist .update\unconfirmed (node .update\rollback.mjs rollback && goto run)
pause
