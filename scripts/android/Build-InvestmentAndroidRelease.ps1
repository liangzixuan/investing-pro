#requires -Version 5.1
[CmdletBinding()]
param([Parameter(Mandatory)][string]$PublicConfiguration)
Import-Module (Join-Path $PSScriptRoot 'Signing.Common.psm1') -Force
$ErrorActionPreference = 'Stop'
$secret = $null
$password = $null
$childEnvironment = @{}
$evidence = $null
$stage = 'admission'
try {
    $PublicConfiguration = Assert-SigningPath $PublicConfiguration
    Assert-OrdinaryPath $PublicConfiguration
    $configurationBytes = [IO.File]::ReadAllBytes($PublicConfiguration)
    $configurationHash = [Security.Cryptography.SHA256]::Create()
    try { $configurationSha256 = ([BitConverter]::ToString($configurationHash.ComputeHash($configurationBytes))).Replace('-', '').ToLowerInvariant() }
    finally { $configurationHash.Dispose() }
    $config = [Text.Encoding]::UTF8.GetString($configurationBytes).TrimStart([char]0xfeff) | ConvertFrom-Json
    $fields = @('ownerSid', 'repository', 'javaHome', 'javaUserHome', 'androidHome', 'androidUserHome', 'gradleUserHome',
        'nodePath', 'gitPath', 'signingDirectory', 'evidenceDirectory', 'sourceSha', 'certificateSha256',
        'versionCode', 'versionName', 'publishableKey')
    if (@($config.PSObject.Properties).Count -ne $fields.Count) { throw 'build_configuration_invalid' }
    foreach ($field in $fields) {
        if ($config.PSObject.Properties.Name -notcontains $field -or $config.$field -isnot [string] -or [string]::IsNullOrEmpty($config.$field)) { throw 'build_configuration_invalid' }
    }
    Assert-NativeOwner $config.ownerSid
    Assert-SigningVersion $config.versionCode $config.versionName
    Assert-Fingerprint $config.certificateSha256
    if ($config.sourceSha -cnotmatch '^[0-9a-f]{40}$' -or $config.publishableKey -cnotmatch '^pk_live_[A-Za-z0-9_-]+$') { throw 'build_identity_invalid' }
    foreach ($field in @('repository', 'javaHome', 'javaUserHome', 'androidHome', 'androidUserHome', 'gradleUserHome', 'nodePath', 'gitPath', 'signingDirectory', 'evidenceDirectory')) {
        $config.$field = Assert-SigningPath $config.$field
        Assert-OrdinaryPath $config.$field
    }
    if (-not [IO.Directory]::Exists($config.javaUserHome)) { throw 'java_user_home_required' }
    Assert-SeparatePaths $config.javaUserHome $config.repository
    Assert-SeparatePaths $config.javaUserHome $config.signingDirectory
    Assert-SeparatePaths $config.javaUserHome $config.evidenceDirectory
    Assert-SeparatePaths $config.repository $config.signingDirectory
    Assert-SeparatePaths $config.repository $config.evidenceDirectory
    Assert-SeparatePaths $config.signingDirectory $config.evidenceDirectory
    New-SigningDirectory $config.evidenceDirectory $config.ownerSid
    $evidence = $config.evidenceDirectory
    $stage = 'source_identity'
    $gitArguments = @('--no-replace-objects', '-c', ('safe.directory=' + $config.repository.Replace('\', '/')), '-C', $config.repository)
    $head = (Invoke-SigningTool $config.gitPath ($gitArguments + @('rev-parse', 'HEAD')) @{} $config.repository $evidence 'source-head').Trim()
    if ($head -cne $config.sourceSha) { throw 'source_identity_mismatch' }
    $state = Invoke-SigningTool $config.gitPath ($gitArguments + @('status', '--porcelain=v1', '--untracked-files=normal')) @{} $config.repository $evidence 'source-state'
    if ($state.Length -ne 0) { throw 'clean_source_required' }
    $stage = 'preserve_build_inputs'
    Copy-SigningBuildInputs $config.repository $evidence
    $stage = 'private_custody'
    $secret = Get-SigningPassword $config.signingDirectory $config.ownerSid
    Assert-SigningIdentity $config.signingDirectory $config.certificateSha256
    $password = ConvertFrom-SigningSecret $secret
    $keytool = Join-Path $config.javaHome 'bin/keytool.exe'
    $keystore = Join-Path $config.signingDirectory 'release.p12'
    if ((Export-SigningCertificate $keytool $keystore $password $evidence 'input-certificate') -cne $config.certificateSha256) { throw 'certificate_mismatch' }
    $web = Join-Path $config.repository 'apps/web'
    $android = Join-Path $web 'android'
    $childEnvironment = @{
        JAVA_HOME = $config.javaHome; ANDROID_HOME = $config.androidHome
        ANDROID_USER_HOME = $config.androidUserHome; GRADLE_USER_HOME = $config.gradleUserHome
        PATH = ([IO.Path]::GetDirectoryName($config.nodePath) + ';' + (Join-Path $config.javaHome 'bin') + ';' + (Join-Path $env:SystemRoot 'System32'))
        INVESTMENT_CLIENT_PROFILE = 'managed'; INVESTMENT_CLERK_ENVIRONMENT = 'production'
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = $config.publishableKey
        INVESTMENT_CLERK_TRIAL_API_ORIGIN = 'https://investment-managed-6abac57a.appwrite.network'
        INVESTMENT_BUILD_SHA = $config.sourceSha
    }
    $stage = 'web_build'
    [void](Invoke-SigningTool $config.nodePath @((Join-Path $web 'node_modules/vite/bin/vite.js'), 'build', '--config', 'vite.clerk-trial.config.ts') $childEnvironment $web $evidence 'web-build' 180)
    $stage = 'capacitor_sync'
    [void](Invoke-SigningTool $config.nodePath @((Join-Path $web 'node_modules/@capacitor/cli/bin/capacitor'), 'sync', 'android') $childEnvironment $web $evidence 'capacitor-sync' 120)
    $childEnvironment.INVESTMENT_ANDROID_KEYSTORE = $keystore
    $childEnvironment.INVESTMENT_ANDROID_STORE_PASSWORD = $password
    $childEnvironment.INVESTMENT_ANDROID_KEY_ALIAS = 'investment-android-release'
    $childEnvironment.INVESTMENT_ANDROID_KEY_PASSWORD = $password
    $stage = 'release_build'
    # Invoke the checked-in wrapper main directly; no shell interpolation or global Java options.
    $gradleArguments = @('-Dorg.gradle.appname=gradlew', ('-Duser.home=' + $config.javaUserHome),
        '-classpath', (Join-Path $android 'gradle/wrapper/gradle-wrapper.jar'), 'org.gradle.wrapper.GradleWrapperMain',
        ('-Duser.home=' + $config.javaUserHome), '--no-daemon', '--offline', '--console=plain', '-PinvestmentClientProfile=managed',
        ('-PinvestmentVersionCode=' + $config.versionCode), ('-PinvestmentVersionName=' + $config.versionName), 'assembleRelease')
    [void](Invoke-SigningTool (Join-Path $config.javaHome 'bin/java.exe') $gradleArguments $childEnvironment $android $evidence 'assemble-release' 900)
    $childEnvironment.Clear()
    $password = $null
    $stage = 'artifact_identity'
    $apk = Join-Path $android 'app/build/outputs/apk/release/app-release.apk'
    $copy = Join-Path $evidence ('Investment-' + $config.versionName + '-release.apk')
    [IO.File]::Copy($apk, $copy, $false)
    $badging = Invoke-SigningTool (Join-Path $config.androidHome 'build-tools/35.0.0/aapt2.exe') @('dump', 'badging', $copy) @{} $evidence $evidence 'apk-badging'
    $packageLine = "package: name='app.investingpro.android' versionCode='" + $config.versionCode + "' versionName='" + $config.versionName + "'"
    if (-not $badging.StartsWith($packageLine, [StringComparison]::Ordinal) -or $badging -match '(?m)^application-debuggable') { throw 'apk_identity_mismatch' }
    $signature = Invoke-SigningTool (Join-Path $config.javaHome 'bin/java.exe') @('-jar',
        (Join-Path $config.androidHome 'build-tools/35.0.0/lib/apksigner.jar'), 'verify', '--verbose', '--print-certs', $copy) @{} $evidence $evidence 'apk-signature'
    $expected = 'Signer #1 certificate SHA-256 digest: ' + $config.certificateSha256
    if (-not $signature.Contains($expected) -or $signature -notmatch '(?m)^Number of signers: 1\s*$' -or
        $signature -notmatch '(?m)^Verified using v2 scheme .*: true\s*$') { throw 'apk_signature_mismatch' }
    $stage = 'source_preservation'
    $finalState = Invoke-SigningTool $config.gitPath ($gitArguments + @('status', '--porcelain=v1', '--untracked-files=normal')) @{} $config.repository $evidence 'source-state-after'
    if ($finalState.Length -ne 0) { throw 'source_changed_during_build' }
    $finalHead = (Invoke-SigningTool $config.gitPath ($gitArguments + @('rev-parse', 'HEAD')) @{} $config.repository $evidence 'source-head-after').Trim()
    if ($finalHead -cne $config.sourceSha -or (Get-PublicHash $PublicConfiguration) -cne $configurationSha256) { throw 'build_inputs_changed' }
    Write-SigningJson (Join-Path $evidence 'result.json') ([ordered]@{
        status = 'production_apk_built'; package = 'app.investingpro.android'; sourceSha = $config.sourceSha
        versionCode = [long]$config.versionCode; versionName = $config.versionName
        certificateSha256 = $config.certificateSha256; apkSha256 = Get-PublicHash $copy
        apkBytes = ([IO.FileInfo]$copy).Length; configurationSha256 = $configurationSha256
        backupAccepted = $false; deviceAccepted = $false
    })
    Write-Output 'Production APK built and signature checked. Recovery and device acceptance remain separate.'
} catch {
    if ($null -ne $evidence -and -not [IO.File]::Exists((Join-Path $evidence 'result.json'))) {
        Write-SigningJson (Join-Path $evidence 'result.json') @{ status = 'failed'; stage = $stage; retryAllowed = $false }
    }
    Write-Error 'Release build stopped. Inspect the bounded public evidence before another operation.' -ErrorAction Continue
    exit 1
} finally {
    $childEnvironment.Clear()
    $password = $null
    if ($null -ne $secret) { $secret.Dispose() }
}
