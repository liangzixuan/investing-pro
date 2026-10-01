#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$OwnerSid,
    [Parameter(Mandatory)][string]$SigningDirectory,
    [Parameter(Mandatory)][string]$JavaHome,
    [Parameter(Mandatory)][string]$EvidenceDirectory
)
Import-Module (Join-Path $PSScriptRoot 'Signing.Common.psm1') -Force
$ErrorActionPreference = 'Stop'
$secret = $null
$password = $null
$stage = 'admission'
$evidenceCreated = $false
try {
    Assert-NativeOwner $OwnerSid
    $SigningDirectory = Assert-SigningPath $SigningDirectory
    $EvidenceDirectory = Assert-SigningPath $EvidenceDirectory
    Assert-SigningRepositorySeparation $SigningDirectory
    Assert-SeparatePaths $SigningDirectory $EvidenceDirectory
    $keytool = Join-Path (Assert-SigningPath $JavaHome) 'bin/keytool.exe'
    Assert-OrdinaryPath $keytool
    if (-not [IO.File]::Exists($keytool) -or (Test-Path -LiteralPath $SigningDirectory) -or
        (Test-Path -LiteralPath $EvidenceDirectory)) { throw 'setup_inputs_invalid' }
    New-SigningDirectory $EvidenceDirectory $OwnerSid
    $evidenceCreated = $true
    $stage = 'new_private_directory'
    New-SigningDirectory $SigningDirectory $OwnerSid
    $stage = 'password_custody'
    $random = [byte[]]::new(32)
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($random); $password = [Convert]::ToBase64String($random) }
    finally { $rng.Dispose(); [Array]::Clear($random, 0, $random.Length) }
    $secret = ConvertTo-SecureString $password -AsPlainText -Force
    $secretPath = Join-Path $SigningDirectory 'password.clixml'
    $secret | Export-Clixml -LiteralPath $secretPath
    Set-SigningAcl $secretPath $OwnerSid
    $roundTrip = Import-Clixml -LiteralPath $secretPath
    try {
        if ($roundTrip -isnot [Security.SecureString] -or
            (ConvertFrom-SigningSecret $roundTrip) -cne $password) { throw 'dpapi_roundtrip_failed' }
    } finally { if ($roundTrip -is [IDisposable]) { $roundTrip.Dispose() } }
    $stage = 'key_creation'
    $keystore = Join-Path $SigningDirectory 'release.p12'
    $arguments = @('-genkeypair', '-keystore', $keystore, '-storetype', 'PKCS12',
        '-alias', 'investment-android-release', '-keyalg', 'RSA', '-keysize', '3072',
        '-sigalg', 'SHA256withRSA', '-validity', '10000', '-dname', 'CN=Investment Android Release',
        '-storepass:env', 'INVESTMENT_SIGNING_PASSWORD', '-keypass:env', 'INVESTMENT_SIGNING_PASSWORD')
    [void](Invoke-SigningTool $keytool $arguments @{ INVESTMENT_SIGNING_PASSWORD = $password } $SigningDirectory $EvidenceDirectory 'create-key' 60)
    Set-SigningAcl $keystore $OwnerSid
    $stage = 'public_identity'
    $fingerprint = Export-SigningCertificate $keytool $keystore $password $EvidenceDirectory 'release-certificate'
    $identity = [ordered]@{ package = 'app.investingpro.android'; alias = 'investment-android-release'; certificateSha256 = $fingerprint }
    $identityPath = Join-Path $SigningDirectory 'identity.json'
    Write-SigningJson $identityPath $identity
    Set-SigningAcl $identityPath $OwnerSid
    Write-SigningJson (Join-Path $EvidenceDirectory 'result.json') ([ordered]@{
        status = 'local_signing_custody_created'; identity = $identity
        backupAccepted = $false; ownerSid = $OwnerSid
    })
    Write-Output 'Local signing custody created. Independent recovery remains unverified.'
} catch {
    if ($evidenceCreated -and -not [IO.File]::Exists((Join-Path $EvidenceDirectory 'result.json'))) {
        Write-SigningJson (Join-Path $EvidenceDirectory 'result.json') @{ status = 'failed'; stage = $stage; retryAllowed = $false }
    }
    Write-Error 'Signing setup stopped. Retain any created material and inspect the public receipt before another operation.' -ErrorAction Continue
    exit 1
} finally {
    $password = $null
    if ($null -ne $secret) { $secret.Dispose() }
}
