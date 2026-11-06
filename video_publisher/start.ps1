$ErrorActionPreference = 'Stop'
$pythonwPath = Join-Path $PSScriptRoot '.venv\Scripts\pythonw.exe'
if (-not (Test-Path -LiteralPath $pythonwPath)) { throw 'Run setup.ps1 first' }
$arguments = '"' + (Join-Path $PSScriptRoot 'main.py') + '" watch'
$worker = Start-Process -FilePath $pythonwPath -ArgumentList $arguments -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 2
if ($worker.HasExited) { throw 'Worker exited. Inspect logs\publisher.log (another instance may already be running).' }
Write-Host "Publisher started (PID $($worker.Id)). View main.py status or logs\publisher.log."
