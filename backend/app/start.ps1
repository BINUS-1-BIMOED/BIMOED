$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Host "Creating virtual environment..."
    python -m venv .venv
    .\.venv\Scripts\pip install -r requirements.txt
}

Write-Host "Starting ESCOOD API on http://localhost:8000"
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
