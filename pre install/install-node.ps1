# Ensures Node.js LTS (>= 18) is installed
param()

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
  } elseif (HasCommand 'choco') {
    ExecOrFail "choco install nodejs-lts -y"
  } else {
    Write-Host "winget/chocolatey not available. Please install Node.js LTS from https://nodejs.org and re-run." -ForegroundColor Red
    exit 1
  }
}

try {
  $nodeVersion = (node -v)
  Write-Host "Using Node.js $nodeVersion" -ForegroundColor Green
} catch {
  Write-Host "Node.js still not available after install." -ForegroundColor Red
  exit 1
}