#requires -Version 5.1
# Public process/snapshot regression. No keytool, DPAPI, password or signing file.
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$NodePath,
    [Parameter(Mandatory)][string]$EvidenceDirectory
)
$ErrorActionPreference = 'Stop'
$module = Join-Path $PSScriptRoot 'Signing.Common.psm1'
Import-Module $module -Force
$NodePath = Assert-SigningPath $NodePath
Assert-OrdinaryPath $NodePath
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
Assert-NativeOwner $sid
Assert-SigningRuntime
$out = Assert-SigningPath $EvidenceDirectory
New-SigningDirectory $out $sid
Assert-SigningAcl $out $sid
$stage = 'runtime_prerequisites'
try {
    $probe = Join-Path $out 'runtime-prerequisite-probe.ps1'
    $missingEvidence = Join-Path $out 'runtime-refusal-effects'
    $probeSource = @'
param([string]$ModulePath, [string]$EvidencePath, [ValidateSet('healthy','missing')][string]$Mode)
$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSEdition -cne 'Desktop') { throw 'native_runtime_probe_required' }
if ($Mode -ceq 'missing') { $PSModuleAutoLoadingPreference = 'None' }
Import-Module $ModulePath -Force
if ([IO.Directory]::Exists($EvidencePath) -or [IO.File]::Exists($EvidencePath)) { throw 'fresh_probe_effect_path_required' }
if ($Mode -ceq 'healthy') {
    Assert-SigningRuntime
    if ((Get-Command Get-FileHash -ErrorAction Stop).ModuleName -cne 'Microsoft.PowerShell.Utility') { throw 'installed_hash_command_required' }
    [Console]::Out.Write('signing_runtime_available')
} else {
    if ($null -ne (Get-Command Get-FileHash -ErrorAction SilentlyContinue)) { throw 'missing_hash_command_required' }
    try {
        Assert-SigningRuntime
        [void][IO.Directory]::CreateDirectory($EvidencePath)
        throw 'expected_runtime_rejection_missing'
    } catch {
        if ($_.Exception.Message -cne 'signing_runtime_unavailable') { throw }
    }
    [Console]::Out.Write('signing_runtime_unavailable')
}
if ([IO.Directory]::Exists($EvidencePath) -or [IO.File]::Exists($EvidencePath)) { throw 'runtime_refusal_created_effect' }
'@
    [IO.File]::WriteAllText($probe, $probeSource, [Text.UTF8Encoding]::new($false))
    $powershell = Join-Path $PSHOME 'powershell.exe'
    foreach ($mode in @('healthy', 'missing')) {
        $value = Invoke-SigningTool $powershell @('-NoProfile', '-NonInteractive', '-File', $probe, '-ModulePath', $module, '-EvidencePath', $missingEvidence, '-Mode', $mode) @{} $out $out ('runtime-' + $mode) 20
        $expected = if ($mode -ceq 'healthy') { 'signing_runtime_available' } else { 'signing_runtime_unavailable' }
        if ($value -cne $expected -or [IO.Directory]::Exists($missingEvidence) -or [IO.File]::Exists($missingEvidence)) { throw 'runtime_prerequisite_probe_mismatch' }
    }
    $stage = 'short_streams'
    $program = "process.stdout.write('public-out');process.stderr.write('public-err')"
    $value = Invoke-SigningTool $NodePath @('-e',$program) @{INVESTMENT_PUBLIC_PROBE='synthetic'} $out $out 'short-streams' 20
    if ($value -cne 'public-out' -or [IO.File]::ReadAllText((Join-Path $out 'short-streams.stderr.txt')) -cne 'public-err') { throw 'short_stream_mismatch' }
    $stage = 'multi_chunk_streams'
    $program = "process.stdout.write('OUT-'.repeat(3000)+String.fromCharCode(8364)+'end');process.stderr.write('ERR-'.repeat(2300)+String.fromCharCode(955)+'end')"
    $expectedOut = ('OUT-' * 3000) + [char]8364 + 'end'
    $expectedErr = ('ERR-' * 2300) + [char]955 + 'end'
    $value = Invoke-SigningTool $NodePath @('-e',$program) @{} $out $out 'multi-chunk-streams' 20
    if ($value -cne $expectedOut -or [IO.File]::ReadAllText((Join-Path $out 'multi-chunk-streams.stdout.txt')) -cne $expectedOut -or [IO.File]::ReadAllText((Join-Path $out 'multi-chunk-streams.stderr.txt')) -cne $expectedErr) { throw 'multi_chunk_stream_mismatch' }
    $stage = 'snapshot'
    $fixture = Join-Path $out 'fixture-repository'
    $leaf = Join-Path $fixture 'apps/web/dist/managed-android'
    [void][IO.Directory]::CreateDirectory($leaf)
    [IO.File]::WriteAllText((Join-Path $leaf 'index.html'),'<p>invented fixture</p>',[Text.UTF8Encoding]::new($false))
    $evidence = Join-Path $out 'snapshot'
    New-SigningDirectory $evidence $sid
    Copy-SigningBuildInputs $fixture $evidence
    $record = Get-Content -LiteralPath (Join-Path $evidence 'preserved-build-inputs.json') -Raw | ConvertFrom-Json
    $copy = Join-Path $evidence 'preserved-build-inputs/apps/web/dist/managed-android/index.html'
    if ($record.files.Count -ne 1 -or $record.files[0].sha256 -cne (Get-PublicHash (Join-Path $leaf 'index.html')) -or (Get-PublicHash $copy) -cne $record.files[0].sha256 -or [IO.File]::ReadAllText($copy) -cne '<p>invented fixture</p>') { throw 'snapshot_mismatch' }
    Write-SigningJson (Join-Path $out 'result.json') ([ordered]@{
        status='passed'; publicOnly=$true; privateOperations=0; ownerAclVerified=$true
        runtimePrerequisiteAvailable=$true; runtimePrerequisiteRefusalBeforeEffects=$true
        shortStreamsVerified=$true; multiChunkStreamsVerified=$true; unicodeStreamsVerified=$true
        stdoutCharacters=$expectedOut.Length; stderrCharacters=$expectedErr.Length; snapshotFiles=1
        moduleSha256=Get-PublicHash $module
    })
    Write-Output ('Public regression passed. Result SHA256: '+(Get-PublicHash (Join-Path $out 'result.json')))
} catch {
    Write-SigningJson (Join-Path $out 'result.json') @{status='failed';stage=$stage;publicOnly=$true;error=$_.Exception.Message}
    Write-Output ('Public regression failed at '+$stage+'. Result SHA256: '+(Get-PublicHash (Join-Path $out 'result.json')))
    throw
}
