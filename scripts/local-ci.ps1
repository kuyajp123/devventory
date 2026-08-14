param(
  [switch]$ListOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$tauriRoot = Join-Path $repositoryRoot 'src-tauri'

$checks = @(
  @{ Name = 'Frontend lint'; Directory = $repositoryRoot; Command = 'npm.cmd'; Arguments = @('run', 'lint') },
  @{ Name = 'Frontend format'; Directory = $repositoryRoot; Command = 'npm.cmd'; Arguments = @('run', 'format:check') },
  @{ Name = 'TypeScript'; Directory = $repositoryRoot; Command = 'npm.cmd'; Arguments = @('run', 'typecheck') },
  @{ Name = 'Frontend unit tests'; Directory = $repositoryRoot; Command = 'npm.cmd'; Arguments = @('run', 'test:unit') },
  @{ Name = 'Git hook tests'; Directory = $repositoryRoot; Command = 'npm.cmd'; Arguments = @('run', 'test:hooks') },
  @{ Name = 'Release tooling tests'; Directory = $repositoryRoot; Command = 'npm.cmd'; Arguments = @('run', 'test:release-tools') },
  @{ Name = 'Browser E2E tests'; Directory = $repositoryRoot; Command = 'npm.cmd'; Arguments = @('run', 'test:e2e') },
  @{ Name = 'Frontend production build'; Directory = $repositoryRoot; Command = 'npm.cmd'; Arguments = @('run', 'build') },
  @{ Name = 'Rust format'; Directory = $tauriRoot; Command = 'cargo'; Arguments = @('fmt', '--check') },
  @{ Name = 'Rust clippy'; Directory = $tauriRoot; Command = 'cargo'; Arguments = @('clippy', '--all-targets', '--all-features', '--', '-D', 'warnings') },
  @{ Name = 'Rust tests'; Directory = $tauriRoot; Command = 'cargo'; Arguments = @('test') },
  @{ Name = 'Rust check'; Directory = $tauriRoot; Command = 'cargo'; Arguments = @('check') },
  @{ Name = 'Rust dependency audit'; Directory = $tauriRoot; Command = 'cargo'; Arguments = @('audit') }
)

if ($ListOnly) {
  $checks | ForEach-Object { $_.Name }
  exit 0
}

if (-not (Test-Path -LiteralPath (Join-Path $repositoryRoot 'node_modules'))) {
  throw 'Frontend dependencies are missing. Run npm ci from the repository root.'
}

$nodeVersion = (& node --version).TrimStart('v')
if ($LASTEXITCODE -ne 0) {
  throw 'Node.js is unavailable. Install Node.js 24 or newer.'
}

$nodeMajorVersion = [int]($nodeVersion.Split('.')[0])
if ($nodeMajorVersion -lt 24) {
  throw "Node.js 24 or newer is required. Found $nodeVersion."
}

function Invoke-LocalCheck {
  param(
    [Parameter(Mandatory)]
    [hashtable]$Check,
    [Parameter(Mandatory)]
    [int]$Position,
    [Parameter(Mandatory)]
    [int]$Total
  )

  Write-Host ""
  Write-Host "[$Position/$Total] $($Check.Name)" -ForegroundColor Cyan
  $timer = [Diagnostics.Stopwatch]::StartNew()

  Push-Location -LiteralPath $Check.Directory
  try {
    & $Check.Command @($Check.Arguments)
    $exitCode = $LASTEXITCODE
  } finally {
    Pop-Location
    $timer.Stop()
  }

  if ($exitCode -ne 0) {
    throw "$($Check.Name) failed with exit code $exitCode."
  }

  Write-Host "$($Check.Name) passed in $($timer.Elapsed.ToString('hh\:mm\:ss'))." -ForegroundColor Green
}

$suiteTimer = [Diagnostics.Stopwatch]::StartNew()

try {
  for ($index = 0; $index -lt $checks.Count; $index++) {
    Invoke-LocalCheck -Check $checks[$index] -Position ($index + 1) -Total $checks.Count
  }
} catch {
  Write-Host ""
  Write-Error "Local CI stopped: $($_.Exception.Message)"
  exit 1
} finally {
  $suiteTimer.Stop()
}

Write-Host ""
Write-Host "Local CI passed all $($checks.Count) checks in $($suiteTimer.Elapsed.ToString('hh\:mm\:ss'))." -ForegroundColor Green
