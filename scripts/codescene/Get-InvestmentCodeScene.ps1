# Read hosted Investment metrics using the existing Windows DPAPI account credential.
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateRange(1, 9223372036854775807)]
    [long]$ProjectId,
    [switch]$IncludeRefactoringTargets
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$stage = 'credential'
$httpStatus = $null
$failureReason = 'credential_unavailable'
$secureToken = $null
$handler = $null
$client = $null
$tokenPointer = [IntPtr]::Zero

function Stop-Reader([string]$Reason) {
    $script:failureReason = $Reason
    throw 'CodeScene reader stopped.'
}

function Read-CodeSceneJson([string]$Route, [switch]$AllowMissingAnalysis) {
    $pattern = '^/v2/projects/' + $ProjectId + '(?:/analyses/(?:latest|[1-9][0-9]*)(?:/files\?page=1&page_size=10&order_by=change_frequency&fields=path,code_health,change_frequency,lines_of_code|/technical-debt\?refactoring_targets=true)?)?$'
    if ($Route -notmatch $pattern) { Stop-Reader 'route_rejected' }
    $script:httpStatus = $null
    $script:failureReason = 'request_failed'
    $request = $null
    $cancel = $null
    $response = $null
    $stream = $null
    $buffer = $null
    try {
        $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, ('https://api.codescene.io' + $Route))
        $cancel = [System.Threading.CancellationTokenSource]::new([TimeSpan]::FromSeconds(30))
        $buffer = [System.IO.MemoryStream]::new()
        $response = $client.SendAsync($request, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead, $cancel.Token).GetAwaiter().GetResult()
        $script:httpStatus = [int]$response.StatusCode
        if ($AllowMissingAnalysis -and $Route -eq "/v2/projects/$ProjectId/analyses/latest" -and $httpStatus -eq 404) {
            return @{ body = $null; status = 404 }
        }
        if ($httpStatus -ne 200) { Stop-Reader 'http_status' }
        if ($null -eq $response.Content.Headers.ContentType -or $response.Content.Headers.ContentType.MediaType -ne 'application/json') {
            Stop-Reader 'response_type'
        }
        $stream = $response.Content.ReadAsStreamAsync($cancel.Token).GetAwaiter().GetResult()
        $chunk = [byte[]]::new(8192)
        while (($size = $stream.ReadAsync($chunk, 0, $chunk.Length, $cancel.Token).GetAwaiter().GetResult()) -gt 0) {
            if ($buffer.Length + $size -gt 4194304) { Stop-Reader 'response_limit' }
            $buffer.Write($chunk, 0, $size)
        }
        $script:failureReason = 'response_invalid'
        $body = [System.Text.UTF8Encoding]::new($false, $true).GetString($buffer.ToArray()) | ConvertFrom-Json -AsHashtable -Depth 100 -DateKind String
        if ($body -isnot [System.Collections.IDictionary]) { Stop-Reader 'response_invalid' }
        return @{ body = $body; status = 200 }
    } finally {
        foreach ($resource in @($stream, $response, $request, $buffer, $cancel)) {
            if ($null -ne $resource) { $resource.Dispose() }
        }
    }
}

function Read-Number($Value) {
    # CodeScene uses '-' for unavailable historical scores. Missing stays null.
    if ($null -eq $Value -or ($Value -is [string] -and $Value -eq '-')) { return $null }
    if ($Value -isnot [byte] -and $Value -isnot [int] -and $Value -isnot [long] -and $Value -isnot [double] -and $Value -isnot [decimal]) {
        Stop-Reader 'metric_invalid'
    }
    if (-not [double]::IsFinite([double]$Value) -or $Value -lt 0) { Stop-Reader 'metric_invalid' }
    return $Value
}

function Read-Text($Value, [int]$Maximum = 120) {
    if ($null -eq $Value) { return $null }
    if ($Value -isnot [string] -or $Value.Length -gt $Maximum -or $Value -match '[\x00-\x1f\x7f]') { Stop-Reader 'response_invalid' }
    return $Value
}

function Read-FilePath($Value) {
    $path = Read-Text $Value 4096
    if ($null -eq $path -or $path -notmatch '^investing-pro/.+' -or $path -match '(^|/)\.\.(/|$)') { Stop-Reader 'response_invalid' }
    return $path
}

function Read-Page($Value) {
    if ($Value -isnot [System.Collections.IDictionary]) { Stop-Reader 'pagination_invalid' }
    $page = $Value['page']
    $maximum = $Value['max_pages']
    if ($null -ne $page -and (($page -isnot [int] -and $page -isnot [long]) -or $page -ne 1)) { Stop-Reader 'pagination_invalid' }
    if ($null -ne $maximum -and (($maximum -isnot [int] -and $maximum -isnot [long]) -or $maximum -lt 0)) { Stop-Reader 'pagination_invalid' }
    return [ordered]@{ page = $page; maxPages = $maximum }
}

try {
    if (-not $IsWindows) { Stop-Reader 'windows_required' }
    $tokenPath = Join-Path $env:LOCALAPPDATA 'Nourishing/CodeScene/rest-api-token.clixml'
    if (-not (Test-Path -LiteralPath $tokenPath -PathType Leaf)) { Stop-Reader 'credential_unavailable' }
    $secureToken = Import-Clixml -LiteralPath $tokenPath
    if ($secureToken -isnot [System.Security.SecureString]) { Stop-Reader 'credential_invalid' }
    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $false
    $client = [System.Net.Http.HttpClient]::new($handler, $false)
    $client.Timeout = [TimeSpan]::FromSeconds(30)
    $tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
    $client.DefaultRequestHeaders.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer))
    [void]$client.DefaultRequestHeaders.Accept.ParseAdd('application/json')
    [void]$client.DefaultRequestHeaders.UserAgent.ParseAdd('Investment-CodeSceneReader/1.0')

    $stage = 'project'
    $project = (Read-CodeSceneJson "/v2/projects/$ProjectId")['body']
    if (($project['id'] -isnot [int] -and $project['id'] -isnot [long]) -or $project['id'] -ne $ProjectId -or $project['name'] -cne 'Investment') { Stop-Reader 'project_identity' }
    $remotes = $project['configured_git_remote_urls']
    if ($remotes -isnot [array] -or $remotes.Count -ne 1 -or $remotes[0] -isnot [string] -or $remotes[0] -cnotmatch '^https://github\.com/liangzixuan/investing-pro(?:\.git)?$') { Stop-Reader 'project_repository' }
    $report = [ordered]@{
        retrievedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
        status = 'latest_analysis_unavailable'
        projectId = $ProjectId
        projectName = 'Investment'
        configuredGitRemoteUrls = @($remotes)
        analysisStatus = Read-Text $project['analysis_status'] 80
        analysisId = $null
        analysisTime = $null
        repositoryRevisions = @()
        metrics = $null
        mostChangedFiles = @()
        filePagination = $null
        refactoringTargets = $null
        latestAnalysisHttpStatus = $null
        limits = 'Read-only snapshot, no retries. At most ten files ordered by change frequency; optional targets cover only the returned first page. No complete findings list or current branch acceptance is implied.'
    }
    $stage = 'latest_analysis'
    $latest = Read-CodeSceneJson "/v2/projects/$ProjectId/analyses/latest" -AllowMissingAnalysis
    $report['latestAnalysisHttpStatus'] = $latest['status']
    if ($latest['status'] -eq 200) {
        $analysis = $latest['body']
        if (($analysis['project_id'] -isnot [int] -and $analysis['project_id'] -isnot [long]) -or $analysis['project_id'] -ne $ProjectId -or ($analysis['id'] -isnot [int] -and $analysis['id'] -isnot [long]) -or $analysis['id'] -lt 1) { Stop-Reader 'analysis_identity' }
        $revisions = $analysis['analysis_repo_revisions']
        if ($revisions -isnot [array] -or $revisions.Count -ne 1 -or $revisions[0] -isnot [System.Collections.IDictionary]) { Stop-Reader 'analysis_revision' }
        $revision = $revisions[0]
        if ($revision['repo'] -cnotin @('investing-pro', 'liangzixuan/investing-pro', 'https://github.com/liangzixuan/investing-pro', 'https://github.com/liangzixuan/investing-pro.git') -or $revision['revision'] -isnot [string] -or $revision['revision'] -cnotmatch '^[a-f0-9]{40}$') { Stop-Reader 'analysis_revision' }
        $report['analysisId'] = $analysis['id']
        $report['analysisTime'] = Read-Text $analysis['readable_analysis_time']
        $report['repositoryRevisions'] = @([ordered]@{ repo = $revision['repo']; revision = $revision['revision'] })
        $metrics = $analysis['high_level_metrics']
        if ($null -ne $metrics -and $metrics -isnot [System.Collections.IDictionary]) { Stop-Reader 'metric_invalid' }
        if ($null -ne $metrics) {
            $selected = [ordered]@{}
            foreach ($key in @('lines_of_code', 'current_score', 'month_score', 'year_score', 'code_health_weighted_average_current', 'code_health_weighted_average_last_month', 'code_health_weighted_average_last_year', 'code_health_now_worst_performer', 'code_health_month_worst_performer', 'code_health_year_worst_performer', 'hotspots_code_health_now_weighted_average', 'hotspots_code_health_month_weighted_average', 'hotspots_code_health_year_weighted_average')) {
                $selected[$key] = Read-Number $metrics[$key]
            }
            $report['metrics'] = $selected
        }
        $stage = 'files'
        $files = (Read-CodeSceneJson ("/v2/projects/$ProjectId/analyses/{0}/files?page=1&page_size=10&order_by=change_frequency&fields=path,code_health,change_frequency,lines_of_code" -f $analysis['id']))['body']
        $report['filePagination'] = Read-Page $files
        if ($files['files'] -isnot [array] -or $files['files'].Count -gt 10) { Stop-Reader 'pagination_invalid' }
        $report['mostChangedFiles'] = @($files['files'] | ForEach-Object {
            if ($_ -isnot [System.Collections.IDictionary]) { Stop-Reader 'response_invalid' }
            $health = $_['code_health']
            if ($null -ne $health -and $health -isnot [System.Collections.IDictionary]) { Stop-Reader 'metric_invalid' }
            $scores = $null
            if ($null -ne $health) { $scores = [ordered]@{ current_score = Read-Number $health['current_score']; month_score = Read-Number $health['month_score']; year_score = Read-Number $health['year_score'] } }
            [ordered]@{ path = Read-FilePath $_['path']; codeHealth = $scores; changeFrequency = Read-Number $_['change_frequency']; linesOfCode = Read-Number $_['lines_of_code'] }
        })
        if ($IncludeRefactoringTargets) {
            $stage = 'refactoring_targets'
            $targets = (Read-CodeSceneJson ("/v2/projects/$ProjectId/analyses/{0}/technical-debt?refactoring_targets=true" -f $analysis['id']))['body']
            $pagination = Read-Page $targets
            if ($targets['result'] -isnot [array]) { Stop-Reader 'pagination_invalid' }
            $rows = @($targets['result'] | ForEach-Object {
                if ($_ -isnot [System.Collections.IDictionary]) { Stop-Reader 'response_invalid' }
                [ordered]@{ file_name = Read-FilePath $_['file_name']; refactoring_target = Read-Text $_['refactoring_target'] 80; code_health_score = Read-Number $_['code_health_score']; revisions = Read-Number $_['revisions']; loc = Read-Number $_['loc']; friction = Read-Number $_['friction']; friction_last_month = Read-Number $_['friction_last_month']; friction_last_year = Read-Number $_['friction_last_year'] }
            })
            $report['refactoringTargets'] = [ordered]@{ page = $pagination['page']; max_pages = $pagination['maxPages']; result = $rows }
        }
        $report['status'] = 'analysis_available'
    }
    $stage = 'output'
    $failureReason = 'output_failed'
    $report | ConvertTo-Json -Depth 15
} catch {
    # Never surface credential, HTTP exception, response-body or parser details.
    [ordered]@{ status = 'failed'; stage = $stage; reason = $failureReason; httpStatus = $httpStatus } | ConvertTo-Json -Compress
    exit 1
} finally {
    if ($tokenPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer) }
    foreach ($resource in @($client, $handler, $secureToken)) {
        if ($resource -is [System.IDisposable]) { try { $resource.Dispose() } catch { } }
    }
}
