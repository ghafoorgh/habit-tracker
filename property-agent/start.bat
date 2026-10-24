@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download it from https://nodejs.org
  pause
  exit /b
)
if not exist .env (
  copy .env.example .env >nul
  echo Fill in .env ^(ANTHROPIC_API_KEY^), save it, then run start.bat again.
  notepad .env
  exit /b
)
if not exist node_modules call npm install
start "" http://localhost:3000
call npm start
pause
