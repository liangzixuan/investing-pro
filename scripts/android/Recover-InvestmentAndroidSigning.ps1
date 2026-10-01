#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateSet('Backup', 'RestoreCheck')][string]$Mode,
    [Parameter(Mandatory)][string]$OwnerSid,
    [Parameter(Mandatory)][string]$JavaHome,
    [Parameter(Mandatory)][string]$CertificateSha256,
    [Parameter(Mandatory)][string]$RecoveryDirectory,
    [Parameter(Mandatory)][string]$EvidenceDirectory,
    [string]$SigningDirectory,
    [string]$RestoreDirectory
)
Import-Module (Join-Path $PSScriptRoot 'Signing.Common.psm1') -Force
$ErrorActionPreference = 'Stop'
$secret = $null
$confirmation = $null
$sourceSecret = $null
$password = $null
$sourcePassword = $null
$toolEnvironment = @{}
$stage = 'admission'
$evidenceCreated = $false
try {
    Assert-NativeOwner $OwnerSid
    Assert-Fingerprint $CertificateSha256
    if ([Console]::IsInputRedirected -or [Console]::IsOutputRedirected) { throw 'interactive_terminal_required' }
    $keytool = Join-Path (Assert-SigningPath $JavaHome) 'bin/keytool.exe'
    $RecoveryDirectory = Assert-SigningPath $RecoveryDirectory
    $EvidenceDirectory = Assert-SigningPath $EvidenceDirectory
    Assert-SigningRepositorySeparation $RecoveryDirectory
    Assert-SeparatePaths $RecoveryDirectory $EvidenceDirectory
    if ($Mode -eq 'Backup') {
        $SigningDirectory = Assert-SigningPath $SigningDirectory
        Assert-SeparatePaths $SigningDirectory $RecoveryDirectory
        Assert-SeparatePaths $SigningDirectory $EvidenceDirectory
        if (Test-Path -LiteralPath $RecoveryDirectory) { throw 'new_directory_required' }
    } else {
        $RestoreDirectory = Assert-SigningPath $RestoreDirectory
        Assert-SigningRepositorySeparation $RestoreDirectory
        Assert-SeparatePaths $RestoreDirectory $RecoveryDirectory
        Assert-SeparatePaths $RestoreDirectory $EvidenceDirectory
        Assert-OrdinaryPath (Join-Path $RecoveryDirectory 'release.p12')
        if (-not [IO.File]::Exists((Join-Path $RecoveryDirectory 'release.p12')) -or
            (Test-Path -LiteralPath $RestoreDirectory)) { throw 'restore_inputs_invalid' }
    }
    New-SigningDirectory $EvidenceDirectory $OwnerSid
    $evidenceCreated = $true
    $stage = 'masked_recovery_input'
    $secret = Read-Host 'Recovery passphrase (20-256 characters; input hidden)' -AsSecureString
    if ($secret.Length -lt 20 -or $secret.Length -gt 256) { throw 'recovery_passphrase_invalid' }
    $password = ConvertFrom-SigningSecret $secret
    if ($password -match '[\x00-\x1f]') { throw 'recovery_passphrase_invalid' }
    if ($Mode -eq 'Backup') {
        $confirmation = Read-Host 'Confirm recovery passphrase (input hidden)' -AsSecureString
        if ((ConvertFrom-SigningSecret $confirmation) -cne $password) { throw 'recovery_confirmation_mismatch' }
        $stage = 'backup_export'
        $sourceSecret = Get-SigningPassword $SigningDirectory $OwnerSid
        Assert-SigningIdentity $SigningDirectory $CertificateSha256
        $sourcePassword = ConvertFrom-SigningSecret $sourceSecret
        New-SigningDirectory $RecoveryDirectory $OwnerSid
        $keystore = Join-Path $RecoveryDirectory 'release.p12'
        $toolEnvironment = @{ INVESTMENT_SOURCE_PASSWORD = $sourcePassword; INVESTMENT_RECOVERY_PASSWORD = $password }
        $arguments = @('-importkeystore', '-noprompt',
            '-srckeystore', (Join-Path $SigningDirectory 'release.p12'), '-srcstoretype', 'PKCS12',
            '-srcalias', 'investment-android-release', '-srcstorepass:env', 'INVESTMENT_SOURCE_PASSWORD',
            '-srckeypass:env', 'INVESTMENT_SOURCE_PASSWORD', '-destkeystore', $keystore,
            '-deststoretype', 'PKCS12', '-destalias', 'investment-android-release',
            '-deststorepass:env', 'INVESTMENT_RECOVERY_PASSWORD', '-destkeypass:env', 'INVESTMENT_RECOVERY_PASSWORD')
        [void](Invoke-SigningTool $keytool $arguments $toolEnvironment $RecoveryDirectory $EvidenceDirectory 'backup-export')
        $toolEnvironment.Clear()
        $sourcePassword = $null
    } else {
        $stage = 'restore_copy'
        New-SigningDirectory $RestoreDirectory $OwnerSid
        $keystore = Join-Path $RestoreDirectory 'release.p12'
        [IO.File]::Copy((Join-Path $RecoveryDirectory 'release.p12'), $keystore, $false)
    }
    Set-SigningAcl $keystore $OwnerSid
    $stage = 'restored_identity'
    if ((Export-SigningCertificate $keytool $keystore $password $EvidenceDirectory 'recovery-certificate') -cne $CertificateSha256) { throw 'recovery_certificate_mismatch' }
    $stage = 'private_key_proof'
    $request = Join-Path $EvidenceDirectory 'recovery-proof.csr'
    $toolEnvironment = @{ INVESTMENT_RECOVERY_PASSWORD = $password }
    [void](Invoke-SigningTool $keytool @('-certreq', '-keystore', $keystore, '-storetype', 'PKCS12',
        '-alias', 'investment-android-release', '-storepass:env', 'INVESTMENT_RECOVERY_PASSWORD',
        '-keypass:env', 'INVESTMENT_RECOVERY_PASSWORD', '-file', $request) $toolEnvironment $EvidenceDirectory $EvidenceDirectory 'recovery-sign')
    $toolEnvironment.Clear()
    $password = $null
    # JDK PKCS10 parsing verifies the request signature; the request public key comes from this alias's certificate.
    [void](Invoke-SigningTool $keytool @('-printcertreq', '-file', $request) @{} $EvidenceDirectory $EvidenceDirectory 'recovery-verify')
    Write-SigningJson (Join-Path $EvidenceDirectory 'result.json') ([ordered]@{
        status = if ($Mode -eq 'Backup') { 'encrypted_backup_written' } else { 'restored_private_key_verified' }
        package = 'app.investingpro.android'; certificateSha256 = $CertificateSha256
        restoredCopy = $Mode -eq 'RestoreCheck'; requestSha256 = Get-PublicHash $request
        independentCustodyAccepted = $false
    })
    Write-Output 'Recovery key identity and signature verified. Independent backup custody needs its own record.'
} catch {
    if ($evidenceCreated -and -not [IO.File]::Exists((Join-Path $EvidenceDirectory 'result.json'))) {
        Write-SigningJson (Join-Path $EvidenceDirectory 'result.json') @{ status = 'failed'; stage = $stage; retryAllowed = $false }
    }
    Write-Error 'Recovery stopped. Preserve the original custody and inspect the public receipt.' -ErrorAction Continue
    exit 1
} finally {
    $toolEnvironment.Clear()
    $password = $null
    $sourcePassword = $null
    foreach ($value in @($secret, $confirmation, $sourceSecret)) { if ($value -is [IDisposable]) { $value.Dispose() } }
}
