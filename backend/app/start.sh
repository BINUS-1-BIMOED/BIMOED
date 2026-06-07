#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if [ ! -f ".venv/Scripts/python.exe" ] && [ ! -f ".venv/bin/python" ]; then
  echo "Creating virtual environment..."
  python -m venv .venv
  if [ -f ".venv/Scripts/pip.exe" ]; then
    .venv/Scripts/pip install -r requirements.txt
  else
    .venv/bin/pip install -r requirements.txt
  fi
fi

if [ -f ".venv/Scripts/python.exe" ]; then
  PYTHON=".venv/Scripts/python.exe"
else
  PYTHON=".venv/bin/python"
fi

echo "Starting ESCOOD API on http://localhost:8000"
exec "$PYTHON" -m uvicorn main:app --reload --port 8000
