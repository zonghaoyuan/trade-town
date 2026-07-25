[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$RunId,
    [string]$TownBackendUrl = 'http://127.0.0.1:8000',
    [string]$TranslationCacheDir = 'F:\26Advx\TradeTown\runtime\translation-cache',
    [ValidateRange(1, 65535)]
    [int]$Port = 41241
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node -ErrorAction Stop).Source
$tsx = Join-Path $projectRoot 'node_modules\tsx\dist\cli.mjs'
$entry = Join-Path $projectRoot 'services\market-town-a2a\src\index.ts'

$env:A2A_PORT = [string]$Port
$env:A2A_PUBLIC_BASE_URL = "http://127.0.0.1:$Port"
$env:TOWN_BACKEND_URL = $TownBackendUrl.TrimEnd('/')
$env:TOWN_RUN_ID = $RunId
$env:TOWN_REPLAY_TOTAL_DAYS = '30'
$env:TOWN_TRANSLATION_CACHE_DIR = $TranslationCacheDir

& $node $tsx $entry
exit $LASTEXITCODE
