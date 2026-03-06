param(
    [string]$RepoPath = ".",
    [string]$Remote = "origin",
    [string]$Branch = "master",
    [int]$MaxAttempts = 8
)

$ErrorActionPreference = "Continue"

function Write-Step([string]$msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$ts] $msg"
}

function Is-RetryableNetworkError([string]$text) {
    if (-not $text) { return $false }
    return $text -match "Failed to connect to github\.com port 443" `
        -or $text -match "Could not connect to server" `
        -or $text -match "Empty reply from server" `
        -or $text -match "Recv failure" `
        -or $text -match "Connection was reset"
}

function Invoke-Push([bool]$UseIpv4) {
    $args = @(
        "-C", $repo,
        "-c", "http.sslbackend=schannel",
        "-c", "http.version=HTTP/1.1",
        "push"
    )
    if ($UseIpv4) {
        $args += "--ipv4"
    }
    $args += @($Remote, $Branch)

    $out = (& git @args 2>&1 | Out-String).Trim()
    return @{
        ExitCode = $LASTEXITCODE
        Output   = $out
        Command  = "git " + ($args -join " ")
    }
}

$repo = (Resolve-Path $RepoPath).Path

if (-not (Test-Path (Join-Path $repo ".git"))) {
    throw "Not a git repository: $repo"
}

if ($MaxAttempts -lt 1) {
    $MaxAttempts = 1
}

Write-Step "Start safe push: repo=$repo remote=$Remote branch=$Branch maxAttempts=$MaxAttempts"

for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    foreach ($useIpv4 in @($false, $true)) {
        $mode = if ($useIpv4) { "ipv4" } else { "default" }
        Write-Step "Push attempt $attempt/$MaxAttempts ($mode)"

        $result = Invoke-Push -UseIpv4:$useIpv4
        if ($result.ExitCode -eq 0) {
            Write-Step "Push succeeded"
            exit 0
        }

        $msg = ($result.Output | Select-Object -Last 1)
        Write-Step "Push failed: $msg"

        if (-not (Is-RetryableNetworkError([string]$result.Output))) {
            Write-Step "Non-network error detected, stop retry."
            Write-Host $result.Command
            $result.Output | ForEach-Object { Write-Host $_ }
            exit $result.ExitCode
        }
    }

    if ($attempt -lt $MaxAttempts) {
        $sleepSec = [Math]::Min(30, (3 * $attempt))
        Write-Step "Transient network error, retry in $sleepSec seconds..."
        Start-Sleep -Seconds $sleepSec
    }
}

Write-Step "Reached max attempts, push still failed."
exit 1
