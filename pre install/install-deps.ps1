# Installs npm dependencies for root, server, and client
param()

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = Resolve-Path (Join-Path $ScriptDir '..')
Set-Location $RepoRoot

function ExecOrFail([string]$cmd) {
  Write-Host "→ $cmd" -ForegroundColor Cyan
  cmd.exe /c $cmd
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Command failed with exit code $LASTEXITCODE: $cmd" -ForegroundColor Red
    exit $LASTEXITCODE
  }
}

ExecOrFail "npm --version"

Write-Host "Installing root tools and workspace deps..." -ForegroundColor Green
ExecOrFail "npm install --no-audit --no-fund"
ExecOrFail "npm --prefix server install --no-audit --no-fund"
ExecOrFail "npm --prefix client install --no-audit --no-fund"

Write-Host "Dependencies installed." -ForegroundColor Green