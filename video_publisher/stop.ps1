$ErrorActionPreference = 'Stop'
$pythonPath = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
& $pythonPath (Join-Path $PSScriptRoot 'main.py') stop
if ($LASTEXITCODE -ne 0) { throw 'Could not request stop' }
$pidFile = Join-Path $PSScriptRoot 'data\publisher.pid'
$deadline = (Get-Date).AddSeconds(30)
while ((Test-Path -LiteralPath $pidFile) -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 1 }
if (Test-Path -LiteralPath $pidFile) { Write-Host 'Still finishing an operation. Watch the log before restarting.' }
else { Write-Host 'Publisher stopped.' }
