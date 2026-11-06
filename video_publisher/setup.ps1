param([switch]$RegisterAtLogon)
$ErrorActionPreference = 'Stop'
$projectDirectory = $PSScriptRoot
$pythonPath = Join-Path $projectDirectory '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) {
    python -m venv (Join-Path $projectDirectory '.venv')
    if ($LASTEXITCODE -ne 0) { throw 'Virtual environment creation failed' }
}
& $pythonPath -m pip install -r (Join-Path $projectDirectory 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
foreach ($directory in @('data','logs','video_output')) {
    New-Item -ItemType Directory -Path (Join-Path $projectDirectory $directory) -Force | Out-Null
}
$environmentFile = Join-Path $projectDirectory '.env'
if (-not (Test-Path -LiteralPath $environmentFile)) {
    Copy-Item -LiteralPath (Join-Path $projectDirectory '.env.example') -Destination $environmentFile
}
foreach ($binary in @('ffmpeg','ffprobe')) {
    if (-not (Get-Command $binary -ErrorAction SilentlyContinue)) { throw "$binary is required on PATH" }
}
if ($RegisterAtLogon) {
    $taskName = 'BLUR Video Publisher'
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        throw "Task '$taskName' already exists; inspect it before replacing it"
    }
    $userIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $pythonwPath = Join-Path $projectDirectory '.venv\Scripts\pythonw.exe'
    $arguments = '"' + (Join-Path $projectDirectory 'main.py') + '" watch'
    $action = New-ScheduledTaskAction -Execute $pythonwPath -Argument $arguments -WorkingDirectory $projectDirectory
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $userIdentity
    $principal = New-ScheduledTaskPrincipal -UserId $userIdentity -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
    Write-Host "Registered '$taskName' for this user's next logon."
}
Write-Host 'Setup complete. Configure .env, verify the accounts, then use start.ps1. Publishing remains controlled by .env.'
