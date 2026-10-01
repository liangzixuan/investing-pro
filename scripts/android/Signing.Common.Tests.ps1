#requires -Version 5.1
# Pure guards only: no keytool, Gradle, DPAPI, ACL or filesystem mutation.
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'Signing.Common.psm1') -Force
$passed = 0
function Check([string]$Name, [scriptblock]$Body) {
    & $Body
    $script:passed++
    Write-Output ('PASS ' + $Name)
}
function Reject([scriptblock]$Body, [string]$Reason) {
    try { & $Body; throw 'expected_rejection_missing' }
    catch { if ($_.Exception.Message -cne $Reason) { throw } }
}
function Equal($Actual, $Expected) {
    if ($Actual -cne $Expected) { throw 'assertion_failed' }
}

Check 'normalizes absolute slash paths without opening them' { Equal (Assert-SigningPath 'C:/Signing Store/new') 'C:\Signing Store\new' }
foreach ($bad in @('', 'relative', 'C:relative', 'C:\', '\\server\share\key', 'C:\a\..\key', 'C:\a\.\key', 'C:\a:stream', 'C:\a.\key', 'C:\a \key', 'C:\a"b')) {
    Check ('rejects unsafe path: ' + $bad) { Reject { Assert-SigningPath $bad } 'path_invalid' }
}
Check 'rejects embedded line break' { Reject { Assert-SigningPath "C:\a`nb" } 'path_invalid' }
Check 'rejects matching paths regardless of case' { Reject { Assert-SeparatePaths 'C:\Signing' 'c:/signing/' } 'paths_overlap' }
Check 'rejects nested evidence path' { Reject { Assert-SeparatePaths 'C:\Signing' 'C:\Signing\evidence' } 'paths_overlap' }
Check 'rejects reversed overlap' { Reject { Assert-SeparatePaths 'C:\Signing\key' 'C:\Signing' } 'paths_overlap' }
Check 'accepts sibling directories with a shared prefix' { Assert-SeparatePaths 'C:\Signing' 'C:\Signing-backup' }
Check 'rejects private material inside source repository' { Reject { Assert-SigningRepositorySeparation (Join-Path $PSScriptRoot 'private') } 'paths_overlap' }
Check 'accepts first production version' { Assert-SigningVersion '1' '1.0.0' }
Check 'accepts last permitted version code' { Assert-SigningVersion '2100000000' 'release+1' }
foreach ($bad in @('0', '-1', '01', '1.0', '2100000001', '99999999999')) {
    Check ('rejects bad version code: ' + $bad) { Reject { Assert-SigningVersion $bad '1.0' } 'version_invalid' }
}
Check 'rejects shell characters in version name' { Reject { Assert-SigningVersion '1' '1&echo' } 'version_invalid' }
Check 'rejects oversized version name' { Reject { Assert-SigningVersion '1' ('a' * 65) } 'version_invalid' }
Check 'accepts canonical public certificate hash' { Assert-Fingerprint ('a' * 64) }
Check 'rejects colon-delimited certificate hash' { Reject { Assert-Fingerprint ('aa:' * 31 + 'aa') } 'fingerprint_invalid' }
Check 'rejects uppercase certificate hash' { Reject { Assert-Fingerprint ('A' * 64) } 'fingerprint_invalid' }
Check 'quotes a spaced argument without a shell' { Equal (ConvertTo-ToolArgument 'C:\Path With Space\key.p12') '"C:\Path With Space\key.p12"' }
Check 'preserves argv trailing slash' { Equal (ConvertTo-ToolArgument 'C:\Path\') '"C:\Path\\"' }
Check 'refuses embedded quote in tool argument' { Reject { ConvertTo-ToolArgument 'a"b' } 'argument_invalid' }
Check 'refuses newline in tool argument' { Reject { ConvertTo-ToolArgument "a`nb" } 'argument_invalid' }
Write-Output ($passed.ToString() + ' pure guard checks passed.')
