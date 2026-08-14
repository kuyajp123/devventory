param(
  [string]$SigningKeyPath = (Join-Path ([Environment]::GetFolderPath('UserProfile')) '.tauri\devventory-updater.key')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path -LiteralPath $SigningKeyPath -PathType Leaf)) {
  throw "Updater signing key was not found at $SigningKeyPath."
}

$previousKey = $env:TAURI_SIGNING_PRIVATE_KEY
$previousPassword = $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD
$passwordPointer = [IntPtr]::Zero

try {
  $securePassword = Read-Host 'Updater signing key password' -AsSecureString
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  $env:TAURI_SIGNING_PRIVATE_KEY = (Resolve-Path -LiteralPath $SigningKeyPath).Path
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)

  Push-Location -LiteralPath $repositoryRoot
  try {
    & node 'scripts/release/cli.mjs' 'local'
    if ($LASTEXITCODE -ne 0) {
      throw "Local release stopped with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }
} finally {
  if ($passwordPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  }
  $env:TAURI_SIGNING_PRIVATE_KEY = $previousKey
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $previousPassword
}
