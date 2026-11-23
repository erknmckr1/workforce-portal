<#
  mes.midas.com.tr icin ucretsiz Let's Encrypt sertifikasi (DNS dogrulamasi)
  - win-acme yoksa GitHub'dan indirir (C:\win-acme)
  - Sertifikayi LocalMachine\My deposuna alir (IIS'e henuz baglamaz)
  - Sonunda parmak izini (Thumbprint) yazar ve deploy\cert-thumbprint.txt dosyasina kaydeder

  Yonetici PowerShell'de:
    cd C:\Users\mdsadmin\Desktop\workforce-portal
    powershell -ExecutionPolicy Bypass -File .\deploy\ssl-al.ps1
#>
param(
  [string]$HostName = "mes.midas.com.tr",
  [string]$WacsDir  = "C:\win-acme",
  [string]$Email
)
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$id = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $id.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Bu betik Yonetici (Run as Administrator) olarak calistirilmali."
}

# 1) win-acme
$wacs = Join-Path $WacsDir "wacs.exe"
if (-not (Test-Path $wacs)) {
  Write-Host "==> win-acme indiriliyor..." -ForegroundColor Cyan
  $rel = Invoke-RestMethod "https://api.github.com/repos/win-acme/win-acme/releases/latest" -Headers @{ "User-Agent" = "ps" }
  $asset = $rel.assets | Where-Object { $_.name -match "x64\.pluggable\.zip$" } | Select-Object -First 1
  if (-not $asset) { throw "win-acme indirme dosyasi bulunamadi. https://www.win-acme.com adresinden elle indirip $WacsDir icine cikarin." }
  $zip = Join-Path $env:TEMP $asset.name
  Invoke-WebRequest $asset.browser_download_url -OutFile $zip -UseBasicParsing
  New-Item -ItemType Directory -Force -Path $WacsDir | Out-Null
  Expand-Archive $zip -DestinationPath $WacsDir -Force
  Get-ChildItem $WacsDir -Recurse | Unblock-File
  Write-Host "    [OK] win-acme $($rel.tag_name) -> $WacsDir" -ForegroundColor Green
} else {
  Write-Host "    [OK] win-acme zaten var: $wacs" -ForegroundColor Green
}

if (-not $Email) { $Email = Read-Host "Bildirim e-posta adresi (orn. it@midas.com.tr)" }

Write-Host ""
Write-Host "==> Sertifika istegi baslatiliyor" -ForegroundColor Cyan
Write-Host "    Birazdan ekranda bir TXT kaydi (Record) ve deger (Content) gorunecek." -ForegroundColor Yellow
Write-Host "    1) Bu kaydi Hostinger DNS paneline ekleyin." -ForegroundColor Yellow
Write-Host "    2) Ikinci bir PowerShell penceresinde kontrol edin:" -ForegroundColor Yellow
Write-Host "         nslookup -type=TXT _acme-challenge.$HostName 8.8.8.8" -ForegroundColor White
Write-Host "    3) Deger gorununce BU pencereye donup Enter'a basin." -ForegroundColor Yellow
Write-Host ""

& $wacs --source manual --host $HostName `
  --validationmode dns-01 --validation manual `
  --store certificatestore --certificatestore My `
  --installation none `
  --accepttos --emailaddress $Email
if ($LASTEXITCODE -ne 0) { Write-Host "win-acme hata kodu: $LASTEXITCODE" -ForegroundColor Red }

# 3) Sonuc
$cert = Get-ChildItem Cert:\LocalMachine\My |
  Where-Object { $_.Subject -like "*$HostName*" -and $_.Issuer -notlike "*$HostName*" } |
  Sort-Object NotAfter -Descending | Select-Object -First 1
if ($cert) {
  $out = Join-Path $PSScriptRoot "cert-thumbprint.txt"
  $cert.Thumbprint | Set-Content $out -Encoding ASCII
  Write-Host ""
  Write-Host "==> SERTIFIKA HAZIR" -ForegroundColor Green
  Write-Host "    Konu      : $($cert.Subject)"
  Write-Host "    Veren     : $($cert.Issuer)"
  Write-Host "    Bitis     : $($cert.NotAfter)"
  Write-Host "    Thumbprint: $($cert.Thumbprint)"
  Write-Host "    (deploy\cert-thumbprint.txt dosyasina kaydedildi)"
} else {
  Write-Host "Sertifika depoda bulunamadi; yukaridaki win-acme ciktisini kontrol edin." -ForegroundColor Red
}
