param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('install', 'uninstall')]
    [string]$Action
)

$ErrorActionPreference = 'Stop'

function Pause-Prompt {
    # Only pause when running in an interactive session to prevent the window from closing immediately.
    if ([Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
        Write-Host 'Press any key to exit...'
        try {
            [void][Console]::ReadKey($true)
        }
        catch {
            Read-Host | Out-Null
        }
    }
}

function Get-EnvMap {
    param([string]$Path)

    $values = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) {
            continue
        }

        $parts = $line -split '=', 2
        if ($parts.Count -ne 2) {
            continue
        }

        $values[$parts[0]] = $parts[1]
    }

    return $values
}

$ThisDir = Split-Path -Parent $PSCommandPath
$RootCaPath = Join-Path $ThisDir 'rootCA.pem'
$TempDir = $null

try {
    # Somewhat redundant, as `mkcert` also checks for the presence of `rootCA.pem` in the `$env:CAROOT` directory.
    # That being said, it saves an unnecessary download of the `mkcert` binary if both the bundled binary and the certificate are missing.
    if (-not (Test-Path -LiteralPath $RootCaPath)) {
        throw "[mkcert-containerized] Expected root CA certificate at $RootCaPath"
    }

    # Prefer `PROCESSOR_ARCHITEW6432` (the OS architecture) over `PROCESSOR_ARCHITECTURE` (the current process architecture), so 32-bit `PowerShell` on 64-bit `Windows` still reports the machine's actual 64-bit architecture.
    $HostArch = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
    if ($HostArch -eq 'ARM64') {
        $BinaryArchitecture = 'WINDOWS_ARM64'
        $BinaryFilename = 'mkcert-windows-arm64.exe'
    }
    else {
        $BinaryArchitecture = 'WINDOWS_AMD64'
        $BinaryFilename = 'mkcert-windows-amd64.exe'
    }

    $MkcertArg = if ($Action -eq 'install') { '-install' } else { '-uninstall' }
    $ActionDescription = if ($Action -eq 'install') {
        'install root CA certificate to the system trust store'
    }
    else {
        'uninstall root CA certificate from the system trust store'
    }
    $CompleteMessage = if ($Action -eq 'install') { 'Installation complete.' } else { 'Uninstallation complete.' }

    $BinaryBundledPath = Join-Path $ThisDir $BinaryFilename
    if (Test-Path -LiteralPath $BinaryBundledPath) {
        $BinaryPath = $BinaryBundledPath
        Write-Host "[mkcert-containerized] Using bundled mkcert binary at $BinaryPath..."
    }
    else {
        $BinaryDownloadUrl = $null
        $EnvPath = Join-Path $ThisDir 'mkcert-containerized.env'
        if (Test-Path -LiteralPath $EnvPath) {
            $Values = Get-EnvMap -Path $EnvPath
            $BinaryEnvKey = "MKCERT_${BinaryArchitecture}_URL"
            if ($Values.ContainsKey($BinaryEnvKey) -and -not [string]::IsNullOrWhiteSpace($Values[$BinaryEnvKey])) {
                $BinaryDownloadUrl = $Values[$BinaryEnvKey]
            }
        }

        # Fall back to known stable `mkcert` release download URLs if neither bundled binary nor environment metadata exists.
        if ([string]::IsNullOrWhiteSpace($BinaryDownloadUrl)) {
            $FallbackUrls = @{
                'WINDOWS_AMD64' = 'https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-windows-amd64.exe'
                'WINDOWS_ARM64' = 'https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-windows-arm64.exe'
            }
            $BinaryDownloadUrl = $FallbackUrls[$BinaryArchitecture]
        }

        if ([string]::IsNullOrWhiteSpace($BinaryDownloadUrl)) {
            throw "[mkcert-containerized] No mkcert download URL is available for $BinaryArchitecture"
        }

        $TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ('mkcert-containerized-' + [System.Guid]::NewGuid().ToString('N'))
        $CacheDir = Join-Path $TempDir '.bin'
        New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null

        $BinaryPath = Join-Path $CacheDir 'mkcert.exe'
        Write-Host "[mkcert-containerized] Downloading mkcert binary from $BinaryDownloadUrl to $BinaryPath..."
        Invoke-WebRequest -UseBasicParsing -Uri $BinaryDownloadUrl -OutFile $BinaryPath
        Write-Host '[mkcert-containerized] Download complete.'
    }

    Write-Host "[mkcert-containerized] Setting CAROOT environment variable to $ThisDir..."
    $env:CAROOT = $ThisDir
    Write-Host "[mkcert-containerized] Running mkcert binary to $ActionDescription..."
    & $BinaryPath $MkcertArg
    Write-Host "[mkcert-containerized] $CompleteMessage"
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}
finally {
    if ($null -ne $TempDir) {
        Write-Host '[mkcert-containerized] Cleaning up temporary files...'
        Remove-Item -LiteralPath $TempDir -Force -Recurse -ErrorAction SilentlyContinue
        Write-Host '[mkcert-containerized] Cleanup complete.'
    }
    Pause-Prompt
}
