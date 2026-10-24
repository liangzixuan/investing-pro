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

Check 'admits the installed public hash command' { Assert-SigningRuntime }
Check 'checks runtime before configuration, evidence and custody' {
    $tokens = $null
    $errors = $null
    $build = [Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'Build-InvestmentAndroidRelease.ps1'), [ref]$tokens, [ref]$errors)
    Equal $errors.Count 0
    $commands = @($build.FindAll({ param($node) $node -is [Management.Automation.Language.CommandAst] }, $true))
    $runtime = @($commands | Where-Object { $_.GetCommandName() -ceq 'Assert-SigningRuntime' })
    Equal $runtime.Count 1
    foreach ($name in @('Assert-SigningPath', 'New-SigningDirectory', 'Get-SigningPassword')) {
        $later = @($commands | Where-Object { $_.GetCommandName() -ceq $name })
        if ($later.Count -eq 0 -or @($later | Where-Object { $_.Extent.StartOffset -le $runtime[0].Extent.StartOffset }).Count -ne 0) { throw 'runtime_preflight_order_invalid' }
    }
    $configurationRead = @($build.FindAll({ param($node) $node -is [Management.Automation.Language.InvokeMemberExpressionAst] -and $node.Member.Value -ceq 'ReadAllBytes' }, $true))
    Equal $configurationRead.Count 1
    if ($configurationRead[0].Extent.StartOffset -le $runtime[0].Extent.StartOffset) { throw 'runtime_preflight_order_invalid' }
    $stages = @($build.FindAll({ param($node) $node -is [Management.Automation.Language.AssignmentStatementAst] -and $node.Left -is [Management.Automation.Language.VariableExpressionAst] -and $node.Left.VariablePath.UserPath -ceq 'stage' }, $true))
    if ($stages.Count -eq 0) { throw 'constant_stage_required' }
    foreach ($stage in $stages) {
        $value = @($stage.Right.FindAll({ param($node) $node -is [Management.Automation.Language.StringConstantExpressionAst] }, $true))
        if ($value.Count -ne 1 -or $stage.Right.Extent.Text -cne ("'" + $value[0].Value + "'")) { throw 'constant_stage_required' }
    }
    Equal $stages[0].Right.Extent.Text "'runtime_prerequisites'"
    if ($stages[0].Extent.StartOffset -ge $runtime[0].Extent.StartOffset) { throw 'runtime_stage_order_invalid' }
    $errorCommands = @($commands | Where-Object { $_.GetCommandName() -ceq 'Write-Error' })
    Equal $errorCommands.Count 1
    $message = @($errorCommands[0].FindAll({ param($node) $node -is [Management.Automation.Language.ExpandableStringExpressionAst] }, $true))
    Equal $message.Count 1
    Equal $message[0].NestedExpressions.Count 1
    Equal $message[0].NestedExpressions[0].VariablePath.UserPath 'stage'
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
