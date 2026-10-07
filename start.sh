#!/usr/bin/env bash
# Tramevia Dock - macOS/Linux launcher. / Lanceur macOS/Linux.
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "[FR] Node.js n'est pas installé : https://nodejs.org (version LTS)."
  echo "[EN] Node.js is not installed: https://nodejs.org (LTS version)."
  exit 1
fi
if ! node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>24||(a===24&&b>=15)?0:1)"; then
  echo "[FR] Node.js 24.15 ou plus récent requis. / [EN] Node.js 24.15+ required."
  exit 1
fi
# (Re)install dependencies when missing or out of date (e.g. after an update).
if ! node -e "const l=require('./package-lock.json').packages,f=require('fs');for(const k in l){if(!k.startsWith('node_modules/')||k.indexOf('/node_modules/')>0||l[k].dev||l[k].optional)continue;try{if(JSON.parse(f.readFileSync(k+'/package.json')).version!==l[k].version)process.exit(1)}catch{process.exit(1)}}"; then
  echo "[FR] Installation des dépendances… / [EN] Installing dependencies…"
  npm ci --omit=dev --no-audit --no-fund
fi
exec node src/server.js "$@"
