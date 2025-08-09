param(
  [switch]$Run
)

# Resolve repo root (script can be run from anywhere)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = Resolve-Path (Join-Path $ScriptDir '..')
Write-Host "Script directory: $ScriptDir"
Write-Host "Repo root: $RepoRoot"
Set-Location $RepoRoot

function ExecOrFail([string]$cmd) {
  Write-Host "→ $cmd" -ForegroundColor Cyan
  cmd.exe /c $cmd
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Command failed with exit code $LASTEXITCODE: $cmd" -ForegroundColor Red
    exit $LASTEXITCODE
  }
}

function HasCommand([string]$name) {
  $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

# Ensure Node.js (LTS) is installed
$nodeOk = $false
try {
  $nodeVersion = (node -v) 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Detected Node.js $nodeVersion"
    $major = [int]($nodeVersion.TrimStart('v').Split('.')[0])
    if ($major -ge 18) { $nodeOk = $true }
  }
} catch {}

if (-not $nodeOk) {
  Write-Host "Node.js (>= 18) not found. Attempting to install LTS..." -ForegroundColor Yellow
  if (HasCommand 'winget') {
    ExecOrFail "winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements --silent"
    $nodeOk = $true
  } elseif (HasCommand 'choco') {
    ExecOrFail "choco install nodejs-lts -y"
    $nodeOk = $true
  } else {
    Write-Host "winget/chocolatey not available. Please install Node.js LTS from https://nodejs.org and re-run this script." -ForegroundColor Red
    exit 1
  }
}

# Re-evaluate node presence
try {
  $nodeVersion = (node -v)
  Write-Host "Using Node.js $nodeVersion"
} catch {
  Write-Host "Node.js still not available after install." -ForegroundColor Red
  exit 1
}

# Install dependencies
Write-Host "Installing root tools and workspace deps..." -ForegroundColor Green
ExecOrFail "npm install --no-audit --no-fund"
ExecOrFail "npm --prefix server install --no-audit --no-fund"
ExecOrFail "npm --prefix client install --no-audit --no-fund"

Write-Host "Installation complete." -ForegroundColor Green
Write-Host "- Frontend: http://localhost:5173"
Write-Host "- Backend:  http://localhost:4000"

if ($Run) {
  Write-Host "Starting apps (will open two dev servers)..." -ForegroundColor Green
  ExecOrFail "npm run dev"
} else {
  Write-Host "To start the apps now, run: npm run dev" -ForegroundColor Cyan
}