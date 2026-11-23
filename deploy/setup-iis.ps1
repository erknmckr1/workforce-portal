<#
  workforce-portal -> IIS + SSL kurulum betiği
  Hedef: https://mes.midas.com.tr:3000  (IIS)  ->  http://localhost:3003 (Node backend)

  Yönetici olarak çalıştırın:
    powershell -ExecutionPolicy Bypass -File .\deploy\setup-iis.ps1

  Parametreler:
    -CertThumbprint  : LocalMachine\My (veya WebHosting) deposundaki sertifikanın parmak izi
    -PfxPath/-PfxPassword : .pfx dosyasından içe aktarmak için
    -SelfSigned      : Geçici olarak kendinden imzalı sertifika üret (tarayıcı uyarı verir)
    (Hiçbiri verilmezse site HTTPS bağlaması sertifikasız oluşturulur; win-acme sonra bağlar.)
    -SkipBuild       : npm build adımlarını atla
    -SkipBackendTask : Node backend için zamanlanmış görev oluşturma
#>
[CmdletBinding()]
param(
  [string]$HostName    = "mes.midas.com.tr",
  [int]   $HttpsPort   = 3000,
  [int]   $BackendPort = 3003,
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
  [string]$SiteName    = "workforce-portal",
  [string]$CertThumbprint,
  [string]$PfxPath,
  [securestring]$PfxPassword,
  [switch]$SelfSigned,
  [switch]$SkipBuild,
  [switch]$SkipBackendTask
)

$ErrorActionPreference = "Stop"
function Step($m){ Write-Host "`n==> $m" -ForegroundColor Cyan }
function Ok($m){ Write-Host "    [OK] $m" -ForegroundColor Green }
function Warn($m){ Write-Host "    [!] $m" -ForegroundColor Yellow }

# --- 0. Yönetici kontrolü ---------------------------------------------------
$id = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $id.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Bu betik Yönetici (Run as Administrator) olarak çalıştırılmalı."
}
$ClientDir = Join-Path $ProjectRoot "client"
$ServerDir = Join-Path $ProjectRoot "server"
$DistDir   = Join-Path $ClientDir "dist"

# --- 1. IIS özellikleri -----------------------------------------------------
Step "IIS rolleri kontrol ediliyor"
$features = "Web-Server","Web-Static-Content","Web-Default-Doc","Web-Http-Errors","Web-Http-Logging","Web-Stat-Compression","Web-Filtering","Web-Mgmt-Console","Web-Scripting-Tools"
if (Get-Command Install-WindowsFeature -ErrorAction SilentlyContinue) {
  $missing = $features | Where-Object { -not (Get-WindowsFeature $_).Installed }
  if ($missing) { Install-WindowsFeature $missing -IncludeManagementTools | Out-Null; Ok "Kuruldu: $($missing -join ', ')" } else { Ok "IIS rolleri mevcut" }
} else {
  Enable-WindowsOptionalFeature -Online -NoRestart -FeatureName IIS-WebServerRole,IIS-WebServer,IIS-StaticContent,IIS-DefaultDocument,IIS-HttpErrors,IIS-RequestFiltering,IIS-ManagementConsole,IIS-ManagementScriptingTools | Out-Null
  Ok "IIS özellikleri etkin"
}
Import-Module WebAdministration
$appcmd = "$env:windir\system32\inetsrv\appcmd.exe"

# --- 2. URL Rewrite + ARR ---------------------------------------------------
Step "URL Rewrite ve ARR kontrol ediliyor"
$rewriteOk = Test-Path "$env:windir\system32\inetsrv\rewrite.dll"
$arrOk     = Test-Path "$env:ProgramFiles\IIS\Application Request Routing\requestRouter.dll"
if (-not $rewriteOk -or -not $arrOk) {
  if (-not $rewriteOk) { Warn "URL Rewrite 2.1 yok  -> https://www.iis.net/downloads/microsoft/url-rewrite" }
  if (-not $arrOk)     { Warn "ARR 3.0 yok          -> https://www.iis.net/downloads/microsoft/application-request-routing" }
  throw "Eksik modülleri kurup betiği tekrar çalıştırın (önce URL Rewrite, sonra ARR)."
}
Ok "URL Rewrite ve ARR kurulu"

Step "ARR proxy etkinleştiriliyor"
& $appcmd set config -section:system.webServer/proxy /enabled:"True" /preserveHostHeader:"True" /reverseRewriteHostInResponseHeaders:"False" /timeout:"00:05:00" /commit:apphost | Out-Null
# web.config içindeki sunucu değişkenlerine izin ver
foreach ($v in "HTTP_X_FORWARDED_PROTO","HTTP_X_FORWARDED_HOST") {
  $exists = & $appcmd list config -section:system.webServer/rewrite/allowedServerVariables /commit:apphost | Select-String $v
  if (-not $exists) { & $appcmd set config -section:system.webServer/rewrite/allowedServerVariables /+"[name='$v']" /commit:apphost | Out-Null }
}
Ok "Proxy aktif"

# --- 3. Build ---------------------------------------------------------------
if (-not $SkipBuild) {
  Step "Client build (npm run build)"
  $envProd = Join-Path $ClientDir ".env.production"
  if (-not (Test-Path $envProd)) {
    Set-Content -Path $envProd -Encoding ASCII -Value "VITE_API_BASE_URL=/api"
    Ok ".env.production olusturuldu (VITE_API_BASE_URL=/api)"
  }
  Push-Location $ClientDir; try { npm run build; if ($LASTEXITCODE) { throw "Client build başarısız" } } finally { Pop-Location }
  Step "Server build (npm run build)"
  Push-Location $ServerDir; try { npm run build; if ($LASTEXITCODE) { throw "Server build başarısız" } } finally { Pop-Location }
}
if (-not (Test-Path (Join-Path $DistDir "index.html"))) { throw "$DistDir\index.html bulunamadı" }
if (-not (Test-Path (Join-Path $DistDir "web.config"))) {
  Copy-Item (Join-Path $ClientDir "public\web.config") $DistDir -Force
}
Ok "dist hazır: $DistDir"

# --- 4. Application Pool + Site --------------------------------------------
Step "IIS sitesi oluşturuluyor ($SiteName)"
$pool = "$SiteName-pool"
if (-not (Test-Path "IIS:\AppPools\$pool")) { New-WebAppPool $pool | Out-Null }
Set-ItemProperty "IIS:\AppPools\$pool" managedRuntimeVersion ""   # No Managed Code
Set-ItemProperty "IIS:\AppPools\$pool" startMode "AlwaysRunning"

# IIS'in dist klasörünü okuyabilmesi için izin
icacls $DistDir /grant "IIS AppPool\$($pool):(OI)(CI)RX" /T /Q | Out-Null
icacls $DistDir /grant "IUSR:(OI)(CI)RX" /T /Q | Out-Null

if (Get-Website -Name $SiteName) { Remove-Website -Name $SiteName }
New-Website -Name $SiteName -PhysicalPath $DistDir -ApplicationPool $pool `
  -Port $HttpsPort -HostHeader $HostName -Ssl -SslFlags 1 | Out-Null   # SslFlags 1 = SNI
Ok "Site: https://$($HostName):$HttpsPort  ->  $DistDir"

# --- 5. Sertifika -----------------------------------------------------------
Step "Sertifika"
$cert = $null
if ($PfxPath) {
  if (-not $PfxPassword) { $PfxPassword = Read-Host "PFX şifresi" -AsSecureString }
  $cert = Import-PfxCertificate -FilePath $PfxPath -CertStoreLocation Cert:\LocalMachine\My -Password $PfxPassword -Exportable
} elseif ($CertThumbprint) {
  $cert = Get-ChildItem Cert:\LocalMachine\My, Cert:\LocalMachine\WebHosting -ErrorAction SilentlyContinue | Where-Object Thumbprint -eq $CertThumbprint | Select-Object -First 1
  if (-not $cert) { throw "Sertifika bulunamadı: $CertThumbprint" }
} elseif ($SelfSigned) {
  $cert = New-SelfSignedCertificate -DnsName $HostName -CertStoreLocation Cert:\LocalMachine\My -NotAfter (Get-Date).AddYears(2) -FriendlyName "$HostName (self-signed)"
  Warn "Kendinden imzalı sertifika üretildi; tarayıcılar uyarı verir (GPO ile dağıtılmadıkça)."
}
if ($cert) {
  $storeName = if ($cert.PSParentPath -like "*WebHosting*") { "WebHosting" } else { "My" }
  $binding = Get-WebBinding -Name $SiteName -Protocol https -Port $HttpsPort -HostHeader $HostName
  $binding.AddSslCertificate($cert.Thumbprint, $storeName)
  Ok "Sertifika bağlandı: $($cert.Subject)  [$($cert.Thumbprint)]  bitiş: $($cert.NotAfter)"
} else {
  Warn "Sertifika verilmedi. win-acme ile alıp bağlayın (deploy\IIS-SSL-KURULUM.md, Adım 3)."
}

# --- 6. Firewall ------------------------------------------------------------
Step "Windows Firewall"
$rule = "workforce-portal HTTPS $HttpsPort"
if (-not (Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName $rule -Direction Inbound -Protocol TCP -LocalPort $HttpsPort -Action Allow -Profile Domain,Private | Out-Null
}
Ok "$HttpsPort/TCP gelen bağlantılara açık (Domain/Private)"
Warn "3003 portunu dışarı açmayın; backend'e yalnızca IIS (localhost) erişsin."

# --- 7. Node backend: açılışta otomatik başlayan görev ---------------------
if (-not $SkipBackendTask) {
  Step "Node backend zamanlanmış görevi (açılışta otomatik başlar, çökerse yeniden başlar)"
  $node = (Get-Command node -ErrorAction Stop).Source
  $taskName = "workforce-portal-backend"
  Write-Host "    Ağ paylaşımlarına (\\fileserver, \\192.168.1.40) erişebilmesi için görev bir etki alanı hesabıyla çalışmalı."
  $cred = Get-Credential -Message "Backend'i çalıştıracak hesap (örn. MIDAS\mdsadmin)"
  $action   = New-ScheduledTaskAction -Execute $node -Argument "dist\server.js" -WorkingDirectory $ServerDir
  $trigger  = New-ScheduledTaskTrigger -AtStartup
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
               -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
  if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false }
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
     -User $cred.UserName -Password $cred.GetNetworkCredential().Password -RunLevel Highest | Out-Null

  $busy = Get-NetTCPConnection -LocalPort $BackendPort -State Listen -ErrorAction SilentlyContinue
  if ($busy) {
    Warn "$BackendPort portunu şu an başka bir süreç dinliyor (PID $($busy[0].OwningProcess)) - muhtemelen 'npm run dev'."
    Warn "Onu kapatıp şunu çalıştırın:  Start-ScheduledTask -TaskName $taskName"
  } else {
    Start-ScheduledTask -TaskName $taskName; Start-Sleep 5
    Ok "Backend başlatıldı"
  }
}

# --- 8. Test ----------------------------------------------------------------
Step "Kontrol"
try { $r = Invoke-WebRequest "http://localhost:$BackendPort/qr/" -UseBasicParsing -TimeoutSec 10; Ok "Backend yanıt veriyor ($($r.StatusCode))" } catch { Warn "Backend'e ulaşılamadı: $($_.Exception.Message)" }
Write-Host "`nTamamlandı. DNS'te $HostName -> bu sunucunun IP'si olmalı. Adres: https://$($HostName):$HttpsPort`n" -ForegroundColor Green
