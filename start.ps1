# start.ps1 — launches the full Muse stack, each process in its own PowerShell window.
# Zero extra dependencies. Run from the repo root:  .\start.ps1
$root = $PSScriptRoot

# ── hifi-api (Tidal lossless proxy, port 8000) ────────────────────────────────
$hifi        = Join-Path $root "hifi-api"
$venvPy      = Join-Path $hifi ".venv\Scripts\python.exe"
$tokenFile   = Join-Path $hifi "token.json"
$hifiStarted = $false

if (-not (Test-Path $venvPy)) {
    Write-Host "[hifi-api] venv missing - run .\setup.ps1 first. Skipping hifi-api." -ForegroundColor Yellow
} elseif (-not (Test-Path $tokenFile)) {
    Write-Host "[hifi-api] token.json missing - authenticate once, then re-run:" -ForegroundColor Yellow
    Write-Host "    cd hifi-api; .\.venv\Scripts\python.exe tidal_auth\tidal_auth.py" -ForegroundColor Yellow
} else {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", `
        "& '$venvPy' -m uvicorn main:app --host 127.0.0.1 --port 8000" -WorkingDirectory $hifi
    $hifiStarted = $true
}

# ── Muse Backend (API + worker) and Frontend ──────────────────────────────────
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev"    -WorkingDirectory "$root\Backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run worker" -WorkingDirectory "$root\Backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev"    -WorkingDirectory "$root\Frontend"

$hifiMsg = if ($hifiStarted) { "hifi-api (8000), " } else { "" }
Write-Host "Started: ${hifiMsg}API (5000), worker, frontend (3000)." -ForegroundColor Green
Write-Host "Open http://localhost:3000 once the frontend finishes compiling." -ForegroundColor Green
