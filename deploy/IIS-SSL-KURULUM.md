# workforce-portal — IIS + SSL Yayın Rehberi

**Hedef adres:** `https://mes.midas.com.tr:3000` (yalnızca iç ağ)

```
Tarayıcı ──HTTPS:3000──▶ IIS (client/dist + web.config)
                            │  /api, /uploads, /photos, /it-attachments, /qr
                            └──HTTP──▶ localhost:3003  (Node / Express)
```

- 80 portuna dokunulmaz; diğer proje etkilenmez.
- 3003 dışarı açılmaz. Tarayıcı yalnızca 3000 ile konuşur (karışık içerik / CORS sorunu olmaz).

---

## Adım 1 — Ön gereksinimler (bir kez)

1. **URL Rewrite 2.1**: https://www.iis.net/downloads/microsoft/url-rewrite
2. **Application Request Routing 3.0**: https://www.iis.net/downloads/microsoft/application-request-routing
   (Önce URL Rewrite, sonra ARR kurulmalı.)
3. **İç DNS kaydı**: DNS sunucusunda (AD DNS) `mes` için A kaydı → bu sunucunun IP'si (örn. 192.168.3.5).
   `midas.com.tr` zonu iç DNS'te yoksa: `mes.midas.com.tr` adında yeni bir **Primary Zone** açıp boş isimli bir A kaydı ekleyin
   (böylece diğer midas.com.tr adresleri dış DNS'ten çözülmeye devam eder).

## Adım 2 — Kurulum betiği

Yönetici PowerShell:

```powershell
cd C:\Users\mdsadmin\Desktop\workforce-portal
powershell -ExecutionPolicy Bypass -File .\deploy\setup-iis.ps1
```

Betik şunları yapar: IIS rollerini kontrol eder, ARR proxy'yi açar, client + server build alır,
`workforce-portal` sitesini `https / 3000 / mes.midas.com.tr` bağlamasıyla oluşturur, firewall'da 3000'i açar
ve Node backend'i **açılışta otomatik başlayan, çökerse yeniden başlayan** bir zamanlanmış görev olarak kaydeder.

> Şu an `npm run dev` ile çalışan backend varsa önce kapatın; betik uyarır.

## Adım 3 — Ücretsiz SSL (Let's Encrypt, DNS doğrulaması)

Sunucu internetten erişilemediği ve 80 dolu olduğu için **HTTP doğrulaması çalışmaz**.
Bunun yerine **DNS-01** kullanılır: Let's Encrypt, `midas.com.tr`'nin **dış (public) DNS'ine** bir TXT kaydı eklemenizi ister.
Sunucunun dışarı açılmasına gerek yoktur.

1. win-acme indirin: https://www.win-acme.com → `C:\win-acme` içine çıkarın.
2. Site ID'sini öğrenin: `(Get-Website workforce-portal).id`
3. Yönetici PowerShell:

```powershell
cd C:\win-acme
.\wacs.exe --source manual --host mes.midas.com.tr `
  --validationmode dns-01 --validation manual `
  --store certificatestore --installation iis `
  --installationsiteid <SITE_ID> --sslport 3000 `
  --accepttos --emailaddress it@midas.com.tr
```

4. win-acme ekrana `_acme-challenge.mes.midas.com.tr` için bir TXT değeri yazar →
   bu kaydı alan adınızın **dış DNS panelinde** (domain sağlayıcınız) oluşturun, 1–2 dk bekleyip Enter'a basın.
5. Sertifika alınır ve 3000 bağlamasına otomatik takılır.

**Yenileme:** win-acme yenileme görevini kendisi kurar. Manuel DNS doğrulamasında her yenilemede yeni TXT değeri
istenir (yaklaşık 2 ayda bir). Bunu otomatikleştirmek için DNS sağlayıcınızın API eklentisini kullanın
(Cloudflare, Azure DNS, Route53 vb. — `--validation cloudflare` gibi). Sağlayıcınızı söylerseniz komutu ona göre hazırlarım.

**Alternatifler**
- Elinizde `*.midas.com.tr` wildcard `.pfx` varsa: `.\deploy\setup-iis.ps1 -SkipBuild -PfxPath C:\cert\wildcard.pfx`
- Şirket içi CA (AD CS) varsa oradan sertifika alıp `-CertThumbprint <parmak izi>` ile bağlayın; domain bilgisayarları zaten güvenir.
- Geçici test: `-SelfSigned` (tarayıcı uyarı verir).

## Adım 4 — Projede yapılan değişiklikler

| Dosya | Amaç |
|---|---|
| `client/public/web.config` | Proxy + SPA kuralları; her `npm run build`'de dist'e kopyalanır |
| `client/.env.production` (betik oluşturur) | `VITE_API_BASE_URL=/api` → build'de göreli API adresi (geliştirmede `.env` aynen kullanılır) |
| `deploy/setup-iis.ps1` | Kurulum betiği |

**Önerilen:** `server/.env` içindeki `API_BASE_URL=http://192.168.3.5:3003` değerini
`https://mes.midas.com.tr:3000` yapın (QR / e-posta bağlantıları bu adresle üretiliyorsa yeni adresi gösterir),
ardından backend'i yeniden başlatın: `Stop-ScheduledTask workforce-portal-backend; Start-ScheduledTask workforce-portal-backend`.

## Güncelleme (yeni sürüm yayınlama)

```powershell
cd C:\Users\mdsadmin\Desktop\workforce-portal\client; npm run build
cd ..\server; npm run build
Stop-ScheduledTask workforce-portal-backend; Start-ScheduledTask workforce-portal-backend
```

## Sorun giderme

| Belirti | Çözüm |
|---|---|
| `/api` 502.3 | Backend çalışmıyor → `Get-ScheduledTask workforce-portal-backend`, `netstat -ano | findstr 3003` |
| `/api` 404 | ARR proxy kapalı veya ARR kurulu değil |
| 500.19 | URL Rewrite kurulu değil |
| 500.50 | `allowedServerVariables` eksik (betik ekler) |
| Sayfa yenileyince 404 | `web.config` dist içinde yok → build'i tekrar alın |
| Sertifika uyarısı | Self-signed kullanılıyor ya da adres IP ile açılıyor; **mutlaka** `https://mes.midas.com.tr:3000` ile girin |
