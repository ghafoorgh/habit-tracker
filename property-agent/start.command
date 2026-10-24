#!/bin/bash
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js is not installed: https://nodejs.org"; read -r; exit 1; }
if [ ! -f .env ]; then cp .env.example .env; echo "Fill in .env (ANTHROPIC_API_KEY) and run this again."; open -e .env; exit 0; fi
[ -d node_modules ] || npm install
(sleep 4; open http://localhost:3000) &
npm start
