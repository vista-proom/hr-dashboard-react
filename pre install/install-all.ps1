param(
  [switch]$Run
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = Resolve-Path (Join-Path $ScriptDir '..')
Set-Location $RepoRoot

function ExecOrFail([string]$cmd) {
  Write-Host "→ $cmd" -ForegroundColor Cyan
  & powershell -NoProfile -ExecutionPolicy Bypass -Command $cmd
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Command failed with exit code $LASTEXITCODE: $cmd" -ForegroundColor Red
    exit $LASTEXITCODE
  }
}

# 1) Ensure Node is present
& "$ScriptDir/install-node.ps1"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 2) Install npm deps
& "$ScriptDir/install-deps.ps1"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Setup complete." -ForegroundColor Green
Write-Host "- Frontend: http://localhost:5173"
Write-Host "- Backend:  http://localhost:4000"

if ($Run) {
  Write-Host "Starting both apps (dev mode)..." -ForegroundColor Green
  cmd.exe /c "npm run dev"
}