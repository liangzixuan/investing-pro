# Windows PowerShell 5.1; importing this module performs no signing or file access.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:Package = 'app.investingpro.android'
$script:Alias = 'investment-android-release'

function Assert-SigningPath([string]$Path) {
    if ($Path.Length -lt 4 -or $Path -notmatch '^[A-Za-z]:[\\/]' -or $Path -match '[\x00-\x1f"<>|?*]' -or
        $Path.Substring(2).Contains(':') -or $Path -match '(^|[\\/])\.{1,2}([\\/]|$)' -or
        $Path -match '[. ]([\\/]|$)') { throw 'path_invalid' }
    return [IO.Path]::GetFullPath($Path).TrimEnd('\', '/')
}

function Assert-SeparatePaths([string]$First, [string]$Second) {
    $a = (Assert-SigningPath $First) + '\'
    $b = (Assert-SigningPath $Second) + '\'
    if ($a.StartsWith($b, [StringComparison]::OrdinalIgnoreCase) -or
        $b.StartsWith($a, [StringComparison]::OrdinalIgnoreCase)) { throw 'paths_overlap' }
}

function Assert-SigningVersion([string]$Code, [string]$Name) {
    if ($Code -cnotmatch '^[1-9][0-9]{0,9}$' -or [long]$Code -gt 2100000000 -or
        $Name -cnotmatch '^[0-9A-Za-z][0-9A-Za-z._+-]{0,63}$') { throw 'version_invalid' }
}

function Assert-Fingerprint([string]$Value) {
    if ($Value -cnotmatch '^[0-9a-f]{64}$') { throw 'fingerprint_invalid' }
}

function Assert-SigningRepositorySeparation([string]$Path) {
    $repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
    Assert-SeparatePaths $repository $Path
}

function Assert-NativeOwner([string]$OwnerSid) {
    if ($PSVersionTable.PSEdition -ne 'Desktop' -or $OwnerSid -notmatch '^S-1-5-21-[0-9-]+$' -or
        [Security.Principal.WindowsIdentity]::GetCurrent().User.Value -cne $OwnerSid) {
        throw 'native_owner_required'
    }
}

function Assert-OrdinaryPath([string]$Path) {
    $cursor = Assert-SigningPath $Path
    while ($cursor) {
        try {
            # Get-Item also observes a dangling reparse point; Test-Path may call it absent.
            $item = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw 'reparse_path_rejected'
            }
        } catch [System.Management.Automation.ItemNotFoundException] {
            # A future leaf/parent can be absent; every existing ancestor is still checked.
        }
        $cursor = [IO.Path]::GetDirectoryName($cursor)
    }
}

function Set-SigningAcl([string]$Path, [string]$OwnerSid) {
    Assert-OrdinaryPath $Path
    $directory = [IO.Directory]::Exists($Path)
    $acl = if ($directory) { [IO.Directory]::GetAccessControl($Path) } else { [IO.File]::GetAccessControl($Path) }
    $sid = [Security.Principal.SecurityIdentifier]::new($OwnerSid)
    $current = [Security.Principal.WindowsIdentity]::GetCurrent()
    $existingOwner = $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value
    if ($existingOwner -cne $current.User.Value -and $existingOwner -cne $current.Owner.Value) {
        throw 'foreign_owner_rejected'
    }
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($rule in @($acl.GetAccessRules($true, $false, [Security.Principal.SecurityIdentifier]))) {
        [void]$acl.RemoveAccessRuleSpecific($rule)
    }
    $inheritance = if ($directory) { [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit' } else { [Security.AccessControl.InheritanceFlags]::None }
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', $inheritance, 'None', 'Allow'))
    $acl.SetOwner($sid)
    if ($directory) { [IO.Directory]::SetAccessControl($Path, $acl) } else { [IO.File]::SetAccessControl($Path, $acl) }
    Assert-SigningAcl $Path $OwnerSid
}

function Assert-SigningAcl([string]$Path, [string]$OwnerSid) {
    Assert-OrdinaryPath $Path
    $directory = [IO.Directory]::Exists($Path)
    $acl = if ($directory) { [IO.Directory]::GetAccessControl($Path) } else { [IO.File]::GetAccessControl($Path) }
    $rules = @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
    $inheritance = if ($directory) { [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit' } else { [Security.AccessControl.InheritanceFlags]::None }
    if (-not $acl.AreAccessRulesProtected -or $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $OwnerSid -or $rules.Count -ne 1) {
        throw 'signing_acl_invalid'
    }
    $rule = $rules[0]
    if ($rule.IsInherited -or $rule.IdentityReference.Value -cne $OwnerSid -or
        $rule.AccessControlType -ne 'Allow' -or $rule.FileSystemRights -ne 'FullControl' -or
        $rule.InheritanceFlags -ne $inheritance -or $rule.PropagationFlags -ne 'None') { throw 'signing_acl_invalid' }
}

function New-SigningDirectory([string]$Path, [string]$OwnerSid) {
    $target = Assert-SigningPath $Path
    Assert-OrdinaryPath $target
    if (Test-Path -LiteralPath $target) { throw 'new_directory_required' }
    $parent = [IO.Path]::GetDirectoryName($target)
    if (-not [IO.Directory]::Exists($parent)) { throw 'existing_parent_required' }
    [void][IO.Directory]::CreateDirectory($target)
    Set-SigningAcl $target $OwnerSid
}

function Write-SigningJson([string]$Path, $Value) {
    $bytes = [Text.UTF8Encoding]::new($false).GetBytes(($Value | ConvertTo-Json -Depth 8) + "`n")
    $stream = [IO.File]::Open($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
}

function Get-PublicHash([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Copy-SigningBuildInputs([string]$Repository, [string]$EvidenceDirectory) {
    # Only known generated native inputs/outputs. Never enumerate private custody.
    $roots = @('apps/web/dist/managed-android', 'apps/web/android/app/src/main/assets/public',
        'apps/web/android/app/src/main/assets/capacitor.config.json', 'apps/web/android/app/src/main/assets/capacitor.plugins.json',
        'apps/web/android/app/src/main/res/xml/config.xml', 'apps/web/android/capacitor.settings.gradle',
        'apps/web/android/app/capacitor.build.gradle', 'apps/web/android/capacitor-cordova-android-plugins',
        'apps/web/android/app/build/outputs')
    $sourceRoot = (Assert-SigningPath $Repository) + '\'
    $destinationRoot = (Assert-SigningPath (Join-Path $EvidenceDirectory 'preserved-build-inputs')) + '\'
    if (Test-Path -LiteralPath $destinationRoot) { throw 'new_snapshot_required' }
    $pending = [Collections.Generic.Queue[string]]::new()
    $entries = [Collections.Generic.List[object]]::new()
    $missing = [Collections.Generic.List[string]]::new()
    foreach ($relative in $roots) {
        $source = Join-Path $Repository $relative
        Assert-OrdinaryPath $source
        if (Test-Path -LiteralPath $source) { $pending.Enqueue($source) } else { $missing.Add($relative) }
    }
    $seen = 0
    [long]$bytes = 0
    while ($pending.Count -gt 0) {
        if (++$seen -gt 4096) { throw 'snapshot_entry_limit' }
        $source = Assert-SigningPath $pending.Dequeue()
        Assert-OrdinaryPath $source
        if (-not $source.StartsWith($sourceRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'snapshot_source_escape' }
        $relative = $source.Substring($sourceRoot.Length)
        $destination = Assert-SigningPath (Join-Path $destinationRoot $relative)
        if (-not $destination.StartsWith($destinationRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'snapshot_target_escape' }
        if ([IO.Directory]::Exists($source)) {
            [void][IO.Directory]::CreateDirectory($destination)
            foreach ($child in [IO.Directory]::EnumerateFileSystemEntries($source)) {
                if ($pending.Count + $seen -ge 4096) { throw 'snapshot_entry_limit' }
                $pending.Enqueue($child)
            }
            continue
        }
        $input = [IO.File]::Open($source, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
        try {
            $length = $input.Length
            $bytes += $length
            if ($bytes -gt 536870912) { throw 'snapshot_byte_limit' }
            $sha = [Security.Cryptography.SHA256]::Create()
            try { $hash = ([BitConverter]::ToString($sha.ComputeHash($input))).Replace('-', '').ToLowerInvariant() }
            finally { $sha.Dispose() }
            $input.Position = 0
            [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination))
            $output = [IO.File]::Open($destination, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
            try {
                $buffer = [byte[]]::new(65536)
                [long]$copied = 0
                while (($count = $input.Read($buffer, 0, $buffer.Length)) -gt 0) {
                    $copied += $count
                    if ($copied -gt $length) { throw 'snapshot_source_changed' }
                    $output.Write($buffer, 0, $count)
                }
                if ($copied -ne $length) { throw 'snapshot_source_changed' }
            } finally { $output.Dispose() }
            if ((Get-PublicHash $destination) -cne $hash) { throw 'snapshot_copy_mismatch' }
        } finally { $input.Dispose() }
        $entries.Add([ordered]@{ path = $relative.Replace('\', '/'); bytes = $length; sha256 = $hash })
    }
    Write-SigningJson (Join-Path $EvidenceDirectory 'preserved-build-inputs.json') ([ordered]@{
        files = @($entries.ToArray()); missing = @($missing.ToArray()); bytes = $bytes; enumeratedEntries = $seen
    })
}

function ConvertTo-ToolArgument([string]$Value) {
    # Windows argv quoting; no command shell is used by Invoke-SigningTool.
    if ($Value -match '[\x00-\x1f"]') { throw 'argument_invalid' }
    return '"' + ($Value -replace '(\\+)$', '$1$1') + '"'
}

function Invoke-SigningTool {
    param([string]$Executable, [string[]]$Arguments, [hashtable]$Environment,
        [string]$WorkingDirectory, [string]$EvidenceDirectory, [string]$Name,
        [int]$TimeoutSeconds = 60, [int]$OutputCharacters = 2097152)
    if ($Name -cnotmatch '^[a-z][a-z0-9-]{0,50}$' -or $TimeoutSeconds -lt 1 -or $TimeoutSeconds -gt 900) { throw 'tool_budget_invalid' }
    Assert-OrdinaryPath $Executable
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $Executable
    $info.Arguments = (($Arguments | ForEach-Object { ConvertTo-ToolArgument $_ }) -join ' ')
    $info.WorkingDirectory = $WorkingDirectory
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardInput = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.EnvironmentVariables.Clear()
    foreach ($key in @('SystemRoot', 'WINDIR', 'SystemDrive', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'ComSpec')) {
        $value = [Environment]::GetEnvironmentVariable($key, 'Process')
        if ($null -ne $value) { $info.EnvironmentVariables[$key] = $value }
    }
    foreach ($key in $Environment.Keys) { $info.EnvironmentVariables[$key] = $Environment[$key] }
    Write-SigningJson (Join-Path $EvidenceDirectory ($Name + '.intent.json')) ([ordered]@{
        executable = $Executable; executableSha256 = Get-PublicHash $Executable
        arguments = $Arguments; workingDirectory = $WorkingDirectory
        suppliedEnvironmentNames = @($Environment.Keys | Sort-Object)
        timeoutSeconds = $TimeoutSeconds; combinedOutputCharacterLimit = $OutputCharacters
    })
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $info
    $out = [Text.StringBuilder]::new()
    $err = [Text.StringBuilder]::new()
    $started = [DateTimeOffset]::UtcNow
    $status = 'start_failed'
    $exitCode = $null
    $collected = $false
    try {
        [void]$process.Start()
        $process.StandardInput.Close()
        $outBuffer = [char[]]::new(4096)
        $errBuffer = [char[]]::new(4096)
        $outRead = $process.StandardOutput.ReadAsync($outBuffer, 0, $outBuffer.Length)
        $errRead = $process.StandardError.ReadAsync($errBuffer, 0, $errBuffer.Length)
        $status = 'running'
        while ($null -ne $outRead -or $null -ne $errRead -or -not $process.HasExited) {
            if (([DateTimeOffset]::UtcNow - $started).TotalSeconds -gt $TimeoutSeconds) { $status = 'timeout'; break }
            foreach ($side in @('out', 'err')) {
                $read = if ($side -eq 'out') { $outRead } else { $errRead }
                if ($null -eq $read -or -not $read.IsCompleted) { continue }
                $count = $read.GetAwaiter().GetResult()
                if ($out.Length + $err.Length + $count -gt $OutputCharacters) { $status = 'output_limit'; break }
                # Keep each original char[]: a conditional pipeline enumerates it into object[].
                if ($side -eq 'out') {
                    [void]$out.Append($outBuffer, 0, $count)
                    if ($count -gt 0) { $outRead = $process.StandardOutput.ReadAsync($outBuffer, 0, $outBuffer.Length) }
                    else { $outRead = $null }
                } else {
                    [void]$err.Append($errBuffer, 0, $count)
                    if ($count -gt 0) { $errRead = $process.StandardError.ReadAsync($errBuffer, 0, $errBuffer.Length) }
                    else { $errRead = $null }
                }
            }
            if ($status -ne 'running') { break }
            [Threading.Thread]::Sleep(10)
        }
        if ($status -eq 'running') { $exitCode = $process.ExitCode; $status = 'completed'; $collected = $true }
    } catch { $status = 'tool_failed' } finally {
        if (-not $collected) {
            try { if (-not $process.HasExited) { $process.Kill(); [void]$process.WaitForExit(5000) } } catch { }
        }
        $process.Dispose()
        $info.EnvironmentVariables.Clear()
        $encoding = [Text.UTF8Encoding]::new($false)
        [IO.File]::WriteAllText((Join-Path $EvidenceDirectory ($Name + '.stdout.txt')), $out.ToString(), $encoding)
        [IO.File]::WriteAllText((Join-Path $EvidenceDirectory ($Name + '.stderr.txt')), $err.ToString(), $encoding)
        Write-SigningJson (Join-Path $EvidenceDirectory ($Name + '.json')) ([ordered]@{
            status = $status; startedAt = $started.ToString('o'); finishedAt = [DateTimeOffset]::UtcNow.ToString('o')
            exitCode = $exitCode; streamsComplete = $collected; possibleUncollectedChildren = -not $collected
            stdoutSha256 = Get-PublicHash (Join-Path $EvidenceDirectory ($Name + '.stdout.txt'))
            stderrSha256 = Get-PublicHash (Join-Path $EvidenceDirectory ($Name + '.stderr.txt'))
        })
    }
    if (-not $collected -or $exitCode -ne 0) { throw 'tool_not_successful' }
    return $out.ToString()
}

function Get-SigningPassword([string]$Directory, [string]$OwnerSid) {
    Assert-SigningAcl $Directory $OwnerSid
    foreach ($name in @('release.p12', 'password.clixml', 'identity.json')) { Assert-SigningAcl (Join-Path $Directory $name) $OwnerSid }
    $secret = Import-Clixml -LiteralPath (Join-Path $Directory 'password.clixml')
    if ($secret -isnot [Security.SecureString] -or $secret.Length -lt 20) { throw 'signing_secret_invalid' }
    return $secret
}

function ConvertFrom-SigningSecret([Security.SecureString]$Secret) {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secret)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

function Assert-SigningIdentity([string]$Directory, [string]$Fingerprint) {
    Assert-Fingerprint $Fingerprint
    $identity = Get-Content -LiteralPath (Join-Path $Directory 'identity.json') -Raw | ConvertFrom-Json
    if ($identity.package -cne $script:Package -or $identity.alias -cne $script:Alias -or
        $identity.certificateSha256 -cne $Fingerprint) { throw 'signing_identity_mismatch' }
}

function Export-SigningCertificate([string]$Keytool, [string]$Keystore, [string]$Password, [string]$EvidenceDirectory, [string]$Name) {
    $certificate = Join-Path $EvidenceDirectory ($Name + '.cer')
    [void](Invoke-SigningTool $Keytool @('-exportcert', '-keystore', $Keystore, '-storetype', 'PKCS12', '-alias', $script:Alias, '-storepass:env', 'INVESTMENT_SIGNING_PASSWORD', '-file', $certificate) @{ INVESTMENT_SIGNING_PASSWORD = $Password } $EvidenceDirectory $EvidenceDirectory $Name)
    return Get-PublicHash $certificate
}

Export-ModuleMember -Function *-Signing*, Assert-SeparatePaths, Assert-Fingerprint, Assert-NativeOwner, Assert-OrdinaryPath, Get-PublicHash, ConvertTo-ToolArgument
