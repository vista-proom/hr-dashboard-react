# Request admin rights if not already running as admin
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Start-Process powershell "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

Write-Host "Killing any process on port 4000..."
try {
    $pid = (Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue).OwningProcess
    if ($pid) { Stop-Process -Id $pid -Force; Write-Host "Port 4000 cleared." }
    else { Write-Host "No process using port 4000." }
} catch { Write-Host "Error checking port 4000: $_" }

# Start server
Write-Host "Starting server..."
Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command `"
    cd '$PSScriptRoot\server'; npm install; npm run dev`""

# Wait a bit before starting client
Start-Sleep -Seconds 3

# Start client
Write-Host "Starting client..."
Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command `"
    cd '$PSScriptRoot\client'; npm install; npm run dev`""

Write-Host "Both server and client are starting..."
