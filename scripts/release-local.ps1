param(
  [string]$SigningKeyPath = (Join-Path ([Environment]::GetFolderPath('UserProfile')) '.tauri\devventory-updater.key')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path -LiteralPath $SigningKeyPath -PathType Leaf)) {
  throw "Updater signing key was not found at $SigningKeyPath."
}

$resolvedSigningKeyPath = (Resolve-Path -LiteralPath $SigningKeyPath).Path
$exitCode = 1

Push-Location -LiteralPath $repositoryRoot
try {
  & node 'scripts/release/local-release.mjs' $resolvedSigningKeyPath
  $exitCode = $LASTEXITCODE
} finally {
  Pop-Location
}

exit $exitCode
