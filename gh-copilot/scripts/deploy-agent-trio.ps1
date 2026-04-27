# Deploys the orchestrator agent trio (orchestrator, supervisor, worker)
# from this repo's agents/ folder to the user's Copilot agents directory,
# replacing any existing versions.

[CmdletBinding()]
param(
    [string]$DestinationPath = 'C:\Users\ben\.copilot\agents\'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$sourceDir = Join-Path -Path $PSScriptRoot -ChildPath '..\agents' | Resolve-Path | Select-Object -ExpandProperty Path

$trio = @(
    'orchestrator.agent.md',
    'supervisor.agent.md',
    'worker.agent.md'
)

$missing = @()
foreach ($file in $trio) {
    $src = Join-Path -Path $sourceDir -ChildPath $file
    if (-not (Test-Path -LiteralPath $src -PathType Leaf)) {
        $missing += $src
    }
}

if ($missing.Count -gt 0) {
    Write-Error "Missing source file(s):`n$($missing -join "`n")"
    exit 1
}

if (-not (Test-Path -LiteralPath $DestinationPath)) {
    New-Item -ItemType Directory -Path $DestinationPath -Force | Out-Null
}

foreach ($file in $trio) {
    $src = Join-Path -Path $sourceDir -ChildPath $file
    Copy-Item -LiteralPath $src -Destination $DestinationPath -Force
    Write-Host "Deployed $file -> $DestinationPath"
}
