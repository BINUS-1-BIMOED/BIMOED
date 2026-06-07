# ESCOOD Backend

FastAPI backend for flood prediction, community report validation, and evacuation routing.

## Quick start

```bash
cd backend/app
python -m venv .venv
pip install -r requirements.txt   # use .venv\Scripts\pip on Windows if venv not activated
cp .env.example .env                # fill in DATABASE_URL
```

**Start the server** (pick one — do not run bare `uvicorn` unless the venv is activated):

```powershell
# PowerShell (easiest)
.\start.ps1
```

```bash
# Git Bash / WSL
bash start.sh
```

```bash
# Manual — always use python -m uvicorn from backend/app
cd backend/app
.venv/Scripts/python -m uvicorn main:app --reload --port 8000   # Git Bash on Windows
# .venv\Scripts\python -m uvicorn main:app --reload --port 8000  # PowerShell
```

API docs: http://localhost:8000/docs

## Key endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/risk?lat=&lng=` | Real-time risk score |
| GET | `/api/v1/risk/history?lat=&lng=` | Rainfall history |
| GET | `/api/v1/alerts?lat=&lng=` | Nearby alerts |
| POST | `/api/v1/reports` | Submit community report |
| POST | `/api/v1/reports/upload` | Report with photo |
| GET | `/api/v1/reports/{id}/validation` | AI validation result |
| GET | `/api/v1/safe-zones?lat=&lng=` | Evacuation centers |
| POST | `/api/v1/routes/evacuation` | Safest evacuation route |
| GET | `/api/v1/sync/bundle?region=medan` | Offline data bundle |

## Deploy

**Railway:** connect repo, set root to `backend`, uses `railway.toml`.

**Render:** uses `render.yaml` with Docker.

**Docker:**

```bash
cd backend
docker build -t escood-api .
docker run -p 8000:8000 --env-file app/.env escood-api
```
