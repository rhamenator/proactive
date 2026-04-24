param(
    [string]$ApiUrl = '',
    [switch]$PreviewEnv,
    [switch]$ProductionEnv,
    [switch]$SkipInstall,
    [switch]$Help
)

$ErrorActionPreference = 'Stop'

function Show-Usage {
    @'
Prepare the PROACTIVE mobile app on a developer/build machine.

This script does not run on iOS or Android devices. It prepares the Expo
workspace and environment files used to run Expo locally or build installable
mobile artifacts through EAS.

Usage:
  powershell -ExecutionPolicy Bypass -File scripts/install-mobile.ps1 [options]

Options:
  -ApiUrl URL       Set EXPO_PUBLIC_API_URL in mobile-app/.env.
  -PreviewEnv       Create mobile-app/.env.preview from the preview template if missing.
  -ProductionEnv    Create mobile-app/.env.production from the production template if missing.
  -SkipInstall      Do not run npm install.
  -Help             Show this help text.

Examples:
  powershell -ExecutionPolicy Bypass -File scripts/install-mobile.ps1
  powershell -ExecutionPolicy Bypass -File scripts/install-mobile.ps1 -ApiUrl http://10.0.2.2:3001
  powershell -ExecutionPolicy Bypass -File scripts/install-mobile.ps1 -PreviewEnv -ApiUrl https://api-preview.example.org
'@ | Write-Host
}

if ($Help) {
    Show-Usage
    exit 0
}

$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

function Write-Log {
    param([string]$Message)

    Write-Host "`n==> $Message"
}

function Copy-EnvIfMissing {
    param(
        [string]$SourceFile,
        [string]$TargetFile
    )

    if (Test-Path $TargetFile) {
        Write-Host "Keeping existing $TargetFile"
        return
    }

    Copy-Item $SourceFile $TargetFile
    Write-Host "Created $TargetFile from $SourceFile"
}

function Set-EnvValue {
    param(
        [string]$File,
        [string]$Key,
        [string]$Value
    )

    $Pattern = "(?m)^$([regex]::Escape($Key))=.*$"
    $Entry = "$Key=$Value"

    if (Test-Path $File) {
        $Content = Get-Content $File -Raw
        if ($Content -match $Pattern) {
            $Updated = [regex]::Replace($Content, $Pattern, $Entry)
            Set-Content -Path $File -Value $Updated -NoNewline
            return
        }
    }

    Add-Content -Path $File -Value $Entry
}

function Require-Command {
    param([string]$CommandName)

    if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
        throw "Missing required command: $CommandName"
    }
}

function Invoke-CheckedCommand {
    param(
        [string]$FilePath,
        [string[]]$ArgumentList = @()
    )

    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: $FilePath $($ArgumentList -join ' ')"
    }
}

Require-Command node
Require-Command npm

$NodeMajor = [int](node -p "Number(process.versions.node.split('.')[0])")
if ($NodeMajor -lt 22) {
    throw "Node.js 22 or newer is required. Current version: $(node --version)"
}

Write-Log 'Preparing mobile environment files'
Copy-EnvIfMissing 'mobile-app/.env.example' 'mobile-app/.env'

if ($PreviewEnv) {
    Copy-EnvIfMissing 'mobile-app/.env.preview.example' 'mobile-app/.env.preview'
}

if ($ProductionEnv) {
    Copy-EnvIfMissing 'mobile-app/.env.production.example' 'mobile-app/.env.production'
}

if ($ApiUrl) {
    Set-EnvValue 'mobile-app/.env' 'EXPO_PUBLIC_API_URL' $ApiUrl
    if (Test-Path 'mobile-app/.env.preview') {
        Set-EnvValue 'mobile-app/.env.preview' 'EXPO_PUBLIC_API_URL' $ApiUrl
    }
    if (Test-Path 'mobile-app/.env.production') {
        Set-EnvValue 'mobile-app/.env.production' 'EXPO_PUBLIC_API_URL' $ApiUrl
    }
    Write-Host "Set EXPO_PUBLIC_API_URL=$ApiUrl"
}

if (-not $SkipInstall) {
    Write-Log 'Installing npm dependencies'
    Invoke-CheckedCommand 'npm' @('ci')
}
else {
    Write-Log 'Skipping npm install'
}

Write-Log 'Checking mobile TypeScript build'
Invoke-CheckedCommand 'npm' @('run', 'typecheck', '--workspace', 'mobile-app')

@'

Mobile setup complete.

For local development:
  npm run dev:backend
  npm run dev:mobile

Useful API URLs:
  iOS simulator:      http://localhost:3001
  Android emulator:   http://10.0.2.2:3001
  Physical device:    http://<your-computer-LAN-IP>:3001

For internal preview binaries:
  cd mobile-app
  npx eas login
  npm run eas:build:ios:preview
  npm run eas:build:android:preview
'@ | Write-Host
