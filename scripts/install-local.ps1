param(
    [switch]$SkipDb,
    [switch]$SkipInstall,
    [switch]$Help
)

$ErrorActionPreference = 'Stop'

function Show-Usage {
    @'
Install the local PROACTIVE development stack.

Usage:
  powershell -ExecutionPolicy Bypass -File scripts/install-local.ps1 [options]

Options:
  -SkipDb         Do not run Prisma migrations or seed data.
  -SkipInstall    Do not run npm install.
  -Help           Show this help text.

Prerequisites:
  - Node.js 22 or newer
  - npm
  - PostgreSQL running and reachable by backend/.env DATABASE_URL unless -SkipDb is used
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
Require-Command npx

$NodeMajor = [int](node -p "Number(process.versions.node.split('.')[0])")
if ($NodeMajor -lt 22) {
    throw "Node.js 22 or newer is required. Current version: $(node --version)"
}

Write-Log 'Preparing environment files'
Copy-EnvIfMissing 'backend/.env.example' 'backend/.env'
Copy-EnvIfMissing 'admin-dashboard/.env.example' 'admin-dashboard/.env.local'
Copy-EnvIfMissing 'mobile-app/.env.example' 'mobile-app/.env'

if (-not $SkipInstall) {
    Write-Log 'Installing npm dependencies'
    Invoke-CheckedCommand 'npm' @('ci')
}
else {
    Write-Log 'Skipping npm install'
}

Write-Log 'Generating Prisma client'
Invoke-CheckedCommand 'npm' @('run', 'prisma:generate')

if (-not $SkipDb) {
    Write-Log 'Applying database migrations'
    Push-Location 'backend'
    try {
        Invoke-CheckedCommand 'npx' @('prisma', 'migrate', 'deploy')
    }
    finally {
        Pop-Location
    }

    Write-Log 'Seeding local demo accounts and sample data'
    Invoke-CheckedCommand 'npm' @('run', 'prisma:seed', '--workspace', '@proactive/backend')
}
else {
    Write-Log 'Skipping database migration and seed'
}

@'

Local installation complete.

Start the system in three terminals:
  npm run dev:backend
  npm run dev:admin
  npm run dev:mobile

Default URLs:
  Admin dashboard: http://localhost:3000
  Backend API:     http://localhost:3001

Seed accounts:
  Admin:      admin@proactive.local / Password123!
  Canvasser:  canvasser@proactive.local / Password123!

If database setup failed, confirm PostgreSQL is running and backend/.env DATABASE_URL is correct,
then rerun scripts/install-local.ps1 or scripts/install-local.sh.
'@ | Write-Host
