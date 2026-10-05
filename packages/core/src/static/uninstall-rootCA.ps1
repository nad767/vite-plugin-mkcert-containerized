$ScriptDir = Split-Path -Parent $PSCommandPath
& (Join-Path $ScriptDir 'manage-rootCA.ps1') -Action uninstall
