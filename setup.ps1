# setup.ps1 — first-time setup. Installs all dependencies (npm + hifi-api Python venv).
# Run from the repo root:  .\setup.ps1
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

# ── npm dependencies (root, Backend, Frontend) ────────────────────────────────
Write-Host "Installing npm dependencies (root, Backend, Frontend)..." -ForegroundColor Cyan
npm install
npm --prefix Backend install
npm --prefix Frontend install

# ── hifi-api Python environment (Tidal lossless proxy) ────────────────────────
Write-Host "Setting up hifi-api Python venv..." -ForegroundColor Cyan
$hifi   = Join-Path $root "hifi-api"
$venvPy = Join-Path $hifi ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPy)) {
    python -m venv (Join-Path $hifi ".venv")
}
& $venvPy -m pip install --upgrade pip
& $venvPy -m pip install -r (Join-Path $hifi "requirements.txt")
& $venvPy -m pip install -r (Join-Path $hifi "tidal_auth\requirements.txt")

# ── Backend .env (points the Backend at the local hifi-api) ───────────────────
$envFile = Join-Path $root "Backend\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "Creating Backend\.env..." -ForegroundColor Cyan
    # Leading comment line keeps any BOM off the first key so dotenv parses cleanly.
    @(
        "# Backend environment configuration.",
        "TIDAL_API_BASE_URL=http://localhost:8000",
        "LASTFM_API_KEY="
    ) | Set-Content -Path $envFile -Encoding utf8
}

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
if (-not (Test-Path (Join-Path $hifi "token.json"))) {
    Write-Host "ONE-TIME: authenticate hifi-api with your Tidal account before first run:" -ForegroundColor Yellow
    Write-Host "    cd hifi-api; .\.venv\Scripts\python.exe tidal_auth\tidal_auth.py" -ForegroundColor Yellow
}
Write-Host "Launch everything with:  .\start.ps1" -ForegroundColor Green
