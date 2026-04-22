# Setup TODOs

## uv (required before Python tasks work)

uv is installed at `C:\Users\tgeldard\.local\bin\uv.exe` but needs to be on PATH.

1. Add to PATH permanently (run once in PowerShell as admin):
   ```powershell
   [Environment]::SetEnvironmentVariable("PATH", $env:PATH + ";$env:USERPROFILE\.local\bin", "User")
   ```

2. Restart terminal, then from the repo root:
   ```bash
   uv sync
   ```
   This generates `uv.lock` and installs all workspace members.

3. Verify per-app isolation:
   ```bash
   uv sync --package trace2-backend
   uv sync --package spc-backend
   uv sync --package envmon-backend
   ```

4. Commit the generated `uv.lock`:
   ```bash
   git add uv.lock && git commit -m "chore: add uv.lock"
   ```

## Next code steps

- Replace `from backend.utils.db import ...` in each app with `from shared_db.client import ...`
  (apps/trace2, apps/spc, apps/envmon all have their own utils/db.py — delete after migrating)
- Push ConnectIO-RAD to GitHub and add secrets: `DATABRICKS_HOST`, `DATABRICKS_TOKEN`
- Run `databricks bundle validate --target uat` from each `apps/<name>/` to verify bundle paths
