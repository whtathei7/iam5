[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string[]]$SourceUrl,

  [string]$InstallDirectory = (Join-Path $env:LOCALAPPDATA 'iam5-codex-node-pool'),

  [switch]$SkipAutostart
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Get-LanAddress {
  $routes = Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' -ErrorAction Stop |
    Sort-Object RouteMetric, InterfaceMetric
  foreach ($route in $routes) {
    $address = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex -ErrorAction SilentlyContinue |
      Where-Object { $_.IPAddress -notlike '169.254.*' } |
      Select-Object -First 1 -ExpandProperty IPAddress
    if ($address) { return $address }
  }
  throw '没有找到带默认路由的 IPv4 局域网地址。'
}

function ConvertTo-YamlSingleQuoted([string]$Value) {
  return "'" + $Value.Replace("'", "''") + "'"
}

$cleanSources = @($SourceUrl | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '^https?://' } | Select-Object -Unique)
if ($cleanSources.Count -eq 0) { throw '至少需要一个 http/https 订阅地址。' }
if ($cleanSources.Count -lt 2) {
  Write-Warning '当前只有一个订阅来源；本地筛选可以提高质量，但不能消除单后端共同故障。'
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$templatePath = Join-Path $repoRoot 'deploy\subs-check\config.example.yaml'
if (-not (Test-Path -LiteralPath $templatePath)) { throw "缺少模板：$templatePath" }

$lanAddress = Get-LanAddress
$releaseResponse = Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/beck-8/subs-check/releases/latest'
$releaseUri = if ($releaseResponse.BaseResponse.PSObject.Properties.Name -contains 'ResponseUri') {
  $releaseResponse.BaseResponse.ResponseUri.AbsoluteUri
} else {
  $releaseResponse.BaseResponse.RequestMessage.RequestUri.AbsoluteUri
}
$tag = [Uri]::UnescapeDataString(($releaseUri.TrimEnd('/') -split '/')[-1])
if ($tag -notmatch '^v(?<version>\d+\.\d+\.\d+)$') { throw "无法识别 subs-check 最新版本：$tag" }
$version = $Matches.version
$assetName = 'subs-check_Windows_x86_64.zip'
$assetUri = "https://github.com/beck-8/subs-check/releases/download/$tag/$assetName"
$checksumsName = "subs-check_${version}_checksums.txt"
$checksumsUri = "https://github.com/beck-8/subs-check/releases/download/$tag/$checksumsName"

New-Item -ItemType Directory -Force -Path $InstallDirectory | Out-Null
$downloadDirectory = Join-Path $InstallDirectory 'downloads'
New-Item -ItemType Directory -Force -Path $downloadDirectory | Out-Null
$archivePath = Join-Path $downloadDirectory $assetName
$checksumsPath = Join-Path $downloadDirectory $checksumsName

Write-Host "下载并校验 subs-check $tag ..."
Invoke-WebRequest -UseBasicParsing -Uri $assetUri -OutFile $archivePath
Invoke-WebRequest -UseBasicParsing -Uri $checksumsUri -OutFile $checksumsPath
$checksumLine = Get-Content -LiteralPath $checksumsPath | Where-Object { $_ -match [regex]::Escape($assetName) } | Select-Object -First 1
if (-not $checksumLine -or $checksumLine -notmatch '^([0-9a-fA-F]{64})\s+') { throw '校验文件中找不到 Windows x86_64 资产。' }
$expectedHash = $Matches[1].ToLowerInvariant()
$actualHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -ne $expectedHash) { throw "subs-check SHA256 不匹配：expected=$expectedHash actual=$actualHash" }

$runtimeDirectory = Join-Path $InstallDirectory 'runtime'
if (Test-Path -LiteralPath $runtimeDirectory) { Remove-Item -LiteralPath $runtimeDirectory -Recurse -Force }
New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null
Expand-Archive -LiteralPath $archivePath -DestinationPath $runtimeDirectory -Force
$executable = Get-ChildItem -LiteralPath $runtimeDirectory -Filter 'subs-check.exe' -Recurse | Select-Object -First 1 -ExpandProperty FullName
if (-not $executable) { throw '压缩包中没有找到 subs-check.exe。' }

$configDirectory = Join-Path $InstallDirectory 'config'
$outputDirectory = Join-Path $InstallDirectory 'output'
New-Item -ItemType Directory -Force -Path $configDirectory, $outputDirectory | Out-Null
$configPath = Join-Path $configDirectory 'config.yaml'
$apiKey = ([Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')).Substring(0, 48)
if (Test-Path -LiteralPath $configPath) {
  $oldKey = Select-String -LiteralPath $configPath -Pattern '^api-key:\s*["'']?([^"'']+)' | Select-Object -First 1
  if ($oldKey -and $oldKey.Matches[0].Groups[1].Value) { $apiKey = $oldKey.Matches[0].Groups[1].Value.Trim() }
}
$sourceLines = ($cleanSources | ForEach-Object { '  - ' + (ConvertTo-YamlSingleQuoted $_) }) -join "`n"
$config = (Get-Content -LiteralPath $templatePath -Raw).
  Replace('__LISTEN_ADDRESS__', $lanAddress).
  Replace('__API_KEY__', $apiKey).
  Replace('__SOURCE_URLS__', $sourceLines).
  Replace('output-dir: "./output"', 'output-dir: ' + (ConvertTo-YamlSingleQuoted $outputDirectory.Replace('\', '/')))
Set-Content -LiteralPath $configPath -Value $config -Encoding utf8NoBOM

$taskName = 'iam5 Codex Node Pool'
Get-CimInstance Win32_Process -Filter "Name='subs-check.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($InstallDirectory, [StringComparison]::OrdinalIgnoreCase) } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

if (-not $SkipAutostart) {
  try {
    $action = New-ScheduledTaskAction -Execute $executable -Argument ('-f "' + $configPath + '"') -WorkingDirectory $InstallDirectory
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Description '本地验证并输出适合 Codex/OpenAI 的可信节点池' -Force | Out-Null
  } catch {
    Write-Warning "无法注册登录启动任务，当前进程仍会启动：$($_.Exception.Message)"
  }
}

$process = Start-Process -FilePath $executable -ArgumentList @('-f', $configPath) -WorkingDirectory $InstallDirectory -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 3
if ($process.HasExited) { throw "subs-check 启动后立即退出，退出码：$($process.ExitCode)" }

$statusUri = "http://${lanAddress}:8199/admin"
$providerUri = "http://${lanAddress}:8199/sub/all.yaml"
Write-Host ''
Write-Host "已安装：$executable"
Write-Host "配置文件：$configPath"
Write-Host "管理页面：$statusUri"
Write-Host "OpenClash provider：$providerUri"
Write-Host "API Key：$apiKey"
Write-Host '首次检测包含 OpenAI 解锁和小流量测速，完成后才会出现 output/all.yaml。'
