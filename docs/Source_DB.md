# İzin Yönetimi — Yeni Proje Veritabanı Tasarımı (V3)

Bu doküman, mevcut sistemdeki hatalardan ve eksiklerden yola çıkarak sıfırdan kurgulanmış veritabanı şemasıdır.
**DB:** MSSQL | **ORM:** Sequelize

---

## 1. Lookup / Referans Tabloları

Bu tablolar sabit verileri tutar. Admin panelinden yönetilebilir, frontend'de dropdown olarak kullanılır.

### 1.1 `sections` (Bölümler)

Fabrikadaki ana bölümler.

| Sütun       | Tip                    | Açıklama                                       |
| ----------- | ---------------------- | ---------------------------------------------- |
| `id`        | INT PK AUTO            |                                                |
| `name`      | NVARCHAR(100) NOT NULL | "Üretim", "Kalite Kontrol", "İnsan Kaynakları" |
| `is_active` | BIT DEFAULT 1          | Pasif hale getirilebilir                       |

### 1.2 `departments` (Birimler)

Bölümlerin altındaki birimler. Her birim bir bölüme bağlıdır.

| Sütun        | Tip                    | Açıklama                              |
| ------------ | ---------------------- | ------------------------------------- |
| `id`         | INT PK AUTO            |                                       |
| `section_id` | INT FK → `sections.id` | Üst bölüm                             |
| `name`       | NVARCHAR(100) NOT NULL | "Montaj", "Paketleme", "Zincir Hattı" |
| `is_active`  | BIT DEFAULT 1          |                                       |

**İlişki:** `sections` 1:N → `departments`

### 1.3 `job_titles` (Görev / Ünvanlar)

Personel ünvanları için sabit liste.

| Sütun       | Tip                    | Açıklama                                         |
| ----------- | ---------------------- | ------------------------------------------------ |
| `id`        | INT PK AUTO            |                                                  |
| `name`      | NVARCHAR(100) NOT NULL | "Operatör", "Şef", "Müdür", "Uzman", "Teknisyen" |
| `is_active` | BIT DEFAULT 1          |                                                  |

### 1.4 `leave_statuses` (İzin Durumları)

| Sütun   | Tip                         | Açıklama                                                  |
| ------- | --------------------------- | --------------------------------------------------------- |
| `id`    | INT PK AUTO                 |                                                           |
| `code`  | VARCHAR(30) UNIQUE NOT NULL | `PENDING_AUTH1`, `PENDING_AUTH2`, `APPROVED`, `CANCELLED` |
| `label` | NVARCHAR(50) NOT NULL       | "1. Onaycı Bekleniyor", "Onaylandı" vb.                   |

**Başlangıç Verileri:**

| id  | code          | label                |
| --- | ------------- | -------------------- |
| 1   | PENDING_AUTH1 | 1. Onaycı Bekleniyor |
| 2   | PENDING_AUTH2 | 2. Onaycı Bekleniyor |
| 3   | APPROVED      | Onaylandı            |
| 4   | CANCELLED     | İptal Edildi         |

### 1.5 `leave_reasons` (İzin Sebepleri)

| Sütun                 | Tip                         | Açıklama                                                                                                     |
| --------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `id`                  | INT PK AUTO                 |                                                                                                              |
| `code`                | VARCHAR(30) UNIQUE NOT NULL | `ANNUAL`, `EXCUSE`, `DOCTOR_REFERRAL`, `DOCTOR_REST`                                                         |
| `label`               | NVARCHAR(100) NOT NULL      | "Yıllık İzin", "Mazeret İzni", "Doktor Sevk"                                                                 |
| `required_permission` | VARCHAR(50) NULL            | Bu sebebi seçebilmek için gereken permission kodu. NULL = herkes seçebilir. Örn: `leave.view_doctor_reasons` |
| `is_active`           | BIT DEFAULT 1               |                                                                                                              |

### 1.6 `leave_duration_types` (İzin Süre Türleri)

Tam gün, yarım gün ve saatlik izin senaryolarını destekler.

| Sütun              | Tip                         | Açıklama                                           |
| ------------------ | --------------------------- | -------------------------------------------------- |
| `id`               | INT PK AUTO                 |                                                    |
| `code`             | VARCHAR(20) UNIQUE NOT NULL | `FULL_DAY`, `HALF_DAY_AM`, `HALF_DAY_PM`, `HOURLY` |
| `label`            | NVARCHAR(50) NOT NULL       | Kullanıcı dostu etiket                             |
| `deduction_factor` | DECIMAL(3,2) NOT NULL       | Bakiyeden düşülecek çarpan                         |

**Başlangıç Verileri:**

| id  | code        | label                     | deduction_factor |
| --- | ----------- | ------------------------- | ---------------- |
| 1   | FULL_DAY    | Tam Gün                   | 1.00             |
| 2   | HALF_DAY_AM | Yarım Gün (Sabah)         | 0.50             |
| 3   | HALF_DAY_PM | Yarım Gün (Öğleden Sonra) | 0.50             |
| 4   | HOURLY      | Saatlik İzin              | 0.00             |

> **`deduction_factor` nasıl çalışır?**
>
> - Tam gün izin = gün sayısı × 1.00 → bakiyeden düşülür.
> - Yarım gün izin = gün sayısı × 0.50 → bakiyeden düşülür.
> - Saatlik izin = `deduction_factor` 0.00, çünkü saatlik izinde düşülen miktar ayrıca hesaplanır (aşağıda açıklandı).

---

## 2. Rol ve Yetki (Permission) Sistemi

### 2.1 `roles` (Roller)

| Sütun         | Tip                   | Açıklama                                                       |
| ------------- | --------------------- | -------------------------------------------------------------- |
| `id`          | INT PK AUTO           |                                                                |
| `name`        | NVARCHAR(50) NOT NULL | "Personel", "Şef", "Müdür", "İK", "Revir", "Güvenlik", "Admin" |
| `description` | NVARCHAR(200) NULL    | Açıklama                                                       |

### 2.2 `permissions` (Yetkiler)

| Sütun    | Tip                         | Açıklama                             |
| -------- | --------------------------- | ------------------------------------ |
| `id`     | INT PK AUTO                 |                                      |
| `module` | VARCHAR(50) NOT NULL        | `leave`, `production`, `quality` vb. |
| `code`   | VARCHAR(50) UNIQUE NOT NULL | Benzersiz yetki kodu                 |
| `label`  | NVARCHAR(100) NOT NULL      | Kullanıcı dostu açıklama             |

**İzin Modülü İçin Permission'lar:**

| code                        | label                                           | Tipik Roller |
| --------------------------- | ----------------------------------------------- | ------------ |
| `leave.create_own`          | Kendi adına izin talebi oluştur                 | Herkes       |
| `leave.create_for_others`   | Başkası adına izin oluştur                      | İK, Revir    |
| `leave.approve_first`       | 1. onaycı olarak onaylayabilir                  | Şef, Müdür   |
| `leave.approve_second`      | 2. onaycı olarak onaylayabilir                  | Müdür        |
| `leave.approve_any`         | Herhangi bir izni onaylayabilir (bypass)        | İK           |
| `leave.cancel_own`          | Kendi talebini iptal edebilir                   | Herkes       |
| `leave.cancel_any`          | Herhangi bir izni iptal edebilir                | İK           |
| `leave.view_all`            | Tüm izinleri görebilir                          | İK           |
| `leave.view_own_history`    | Kendi izin geçmişini görebilir                  | Herkes       |
| `leave.view_security`       | Çıkış yapacak personel listesi                  | Güvenlik     |
| `leave.view_doctor_reasons` | Doktor Sevk / İstirahat seçeneklerini görebilir | Revir        |
| `leave.update_balance`      | Personel izin bakiyesini manuel güncelleyebilir | İK, Admin    |

### 2.3 `role_permissions` (Pivot — Rol ↔ Yetki Eşlemesi)

| Sütun           | Tip                          |
| --------------- | ---------------------------- |
| `role_id`       | INT FK → `roles.id`          |
| `permission_id` | INT FK → `permissions.id`    |
| **PK:**         | (`role_id`, `permission_id`) |

> Admin panelinde bir role tıklanır → tüm permission'lar checkbox olarak listelenir → açılıp kapatılır.

### 2.4 E-Posta Bildirim Sistemi

Mevcut sistemde `nodemailer` ile mail gönderimi yapılıyor. Yeni projede de bu akış korunmalıdır.

**Mail tetikleme noktaları:**

| Olay                          | Kime gönderilir?    | İçerik                                         |
| ----------------------------- | ------------------- | ---------------------------------------------- |
| İzin talebi oluşturuldu       | `auth1` (1. Onaycı) | Personel bilgileri + Tarihler + Onay/Red linki |
| 1. Onay yapıldı (auth2 varsa) | `auth2` (2. Onaycı) | Aynı içerik + Onay/Red linki                   |
| Son onay yapıldı (APPROVED)   | Güvenlik e-postası  | Çıkış yapacak personel bilgisi                 |
| İzin iptal edildi             | İlgili personel     | İptal bildirimi                                |

> **Güvenlik Notu:** Eski sistemde mail içindeki linkler GET isteği ile direkt onay/iptal yapıyordu (güvenlik açığı). Yeni projede mail linki, kullanıcıyı **uygulamaya yönlendirmeli** ve JWT token kontrolü yapılmalıdır.

### 2.5 Backend İş Kuralları (Kritik)

Yeni projede aşağıdaki kurallar backend servislerine gömülmelidir:

1. **İzin onaylandığında (Status → APPROVED):**
   - `leave_activity_logs` tablosuna kayıt yazılmalı
   - Güvenliğe e-posta gönderilmeli
   - ⏳ **[PHASE 2]** `leave_balance` otomatik olarak düşürülecek
   - ⏳ **[PHASE 2]** `leave_balance_logs` tablosuna kayıt yazılacak

2. **İzin iptal edildiğinde (Status → CANCELLED):**
   - `leave_activity_logs` tablosuna iptal kaydı yazılmalı
   - ⏳ **[PHASE 2]** Eğer izin önceden APPROVED ise, bakiye geri iade edilecek
   - ⏳ **[PHASE 2]** `leave_balance_logs` tablosuna iade kaydı yazılacak

3. **API Metod Kuralları:**
   - Okuma: `GET`
   - Oluşturma: `POST`
   - Onay/İptal (durum güncelleme): `PATCH`
   - Bakiye güncelleme: `PUT`
   - Silme: `DELETE` (izin kayıtları silinmemeli, sadece CANCELLED yapılmalı)

4. **Auth Middleware:**
   - Tüm izin API'leri JWT token kontrolünden geçmeli
   - Token içindeki `permissions` dizisi ile endpoint yetki kontrolü yapılmalı

> **Phase 2 Notu:** `leave_balance`, `leave_balance_logs`, `deducted_from_balance` sütunları ve tablosu DB'de **şimdiden oluşturulacak** ama ilk versiyonda otomatik bakiye düşürme/iade mantığı aktif edilmeyecek. DB yapısı hazır olduğu için ileride sadece servis katmanına birkaç satır eklenerek devreye alınacak.

---

## 3. Kullanıcı Tablosu

### 3.1 `operator_table` (Kullanıcılar)

| Sütun           | Tip                                            | Açıklama                                |
| --------------- | ---------------------------------------------- | --------------------------------------- |
| `id_dec`        | VARCHAR(255) **PK**                            | Sicil numarası                          |
| `id_hex`        | VARCHAR(255) **UNIQUE** NOT NULL               | Kart okuyucu ID'si                      |
| `name`          | NVARCHAR(100) NOT NULL                         | Ad                                      |
| `surname`       | NVARCHAR(100) NOT NULL                         | Soyad                                   |
| `nick_name`     | NVARCHAR(100) NULL                             | Takma ad / Kısa çağrılma ismi           |
| `short_name`    | NVARCHAR(50) NULL                              | Kısaltma (tablolarda görünen kısa isim) |
| `op_password`   | VARCHAR(255) NULL                              | Şifre (hash'lenmiş olarak saklanmalı)   |
| `email`         | VARCHAR(255) NULL                              | E-posta adresi                          |
| `gender`        | VARCHAR(10) NULL                               | Cinsiyet                                |
| `address`       | NVARCHAR(255) NULL                             | Ev adresi                               |
| `role_id`       | INT FK → `roles.id` NOT NULL                   | Kullanıcının rolü                       |
| `section`       | INT FK → `sections.id` NULL                    | Bölüm                                   |
| `department`    | INT FK → `departments.id` NULL                 | Birim                                   |
| `title`         | INT FK → `job_titles.id` NULL                  | Görev / Ünvan                           |
| `auth1`         | VARCHAR(255) FK → `operator_table.id_dec` NULL | 1. Onaycı                               |
| `auth2`         | VARCHAR(255) FK → `operator_table.id_dec` NULL | 2. Onaycı                               |
| `leave_balance` | DECIMAL(5,2) DEFAULT 0                         | Kalan yıllık izin bakiyesi (gün)        |
| `route`         | VARCHAR(255) NULL                              | Servis güzergahı                        |
| `stop_name`     | VARCHAR(255) NULL                              | Servis durağı                           |
| `is_active`     | BIT DEFAULT 1                                  | Aktif mi?                               |
| `created_at`    | DATETIMEOFFSET DEFAULT GETDATE()               | Kaydın oluşturulma zamanı               |

**Eski tabloya göre değişiklikler:**

| Değişiklik                                 | Açıklama                        |
| ------------------------------------------ | ------------------------------- |
| `op_username` → `name` + `surname`         | Ad ve soyad ayrıştırıldı        |
| `nick_name` eklendi                        | Takma ad desteği                |
| `op_section` (string) → `section` (INT FK) | Lookup tablosundan seçilecek    |
| `part` (string) → `department` (INT FK)    | Lookup tablosundan seçilecek    |
| `title` (string) → `title` (INT FK)        | Lookup tablosundan seçilecek    |
| `auth1/auth2` (JSON Text) → Düz FK         | JSON parse riski ortadan kalktı |
| ~~`is_admin`~~ kaldırıldı                  | `role_id` + permissions yönetir |
| ~~`is_approver`~~ kaldırıldı               | `role_id` + permissions yönetir |
| ~~`op_name`~~ kaldırıldı                   | `name` + `surname` yeterli      |
| ~~`shift_validator`~~ kaldırıldı           | Ayrı modülde ele alınmalı       |

---

## 4. İzin Kayıt Tabloları

### 4.1 `leave_records` (Ana İzin Tablosu)

| Sütun                    | Tip                                                | Açıklama                                    |
| ------------------------ | -------------------------------------------------- | ------------------------------------------- |
| `id`                     | INT PK AUTO                                        | Otomatik artan. Race condition riski sıfır. |
| `user_id`                | VARCHAR(255) FK → `operator_table.id_dec` NOT NULL | İzni talep eden kişi                        |
| `leave_reason_id`        | INT FK → `leave_reasons.id` NOT NULL               | İzin sebebi                                 |
| `leave_status_id`        | INT FK → `leave_statuses.id` NOT NULL              | Mevcut durum                                |
| `leave_duration_type_id` | INT FK → `leave_duration_types.id` NOT NULL        | Tam gün / Yarım gün / Saatlik               |
| `auth1_user_id`          | VARCHAR(255) FK → `operator_table.id_dec` NOT NULL | 1. Onaycı                                   |
| `auth2_user_id`          | VARCHAR(255) FK → `operator_table.id_dec` NULL     | 2. Onaycı (yoksa NULL)                      |
| `start_date`             | DATETIMEOFFSET NOT NULL                            | İzin başlangıç tarih + saat                 |
| `end_date`               | DATETIMEOFFSET NOT NULL                            | İzin bitiş tarih + saat                     |
| `total_days`             | DECIMAL(5,2) NULL                                  | Hesaplanan toplam gün (Örn: 2.0, 0.5)       |
| `total_hours`            | DECIMAL(5,2) NULL                                  | Saatlik izinlerde toplam saat (Örn: 3.5)    |
| `deducted_from_balance`  | DECIMAL(5,2) DEFAULT 0                             | Bakiyeden düşülen miktar                    |
| `description`            | NVARCHAR(500) NULL                                 | Açıklama                                    |
| `phone`                  | VARCHAR(20) NULL                                   | İzindeyken ulaşılacak telefon               |
| `address`                | NVARCHAR(255) NULL                                 | İzindeyken ulaşılacak adres                 |
| `created_by`             | VARCHAR(255) FK → `operator_table.id_dec` NOT NULL | Kim oluşturdu? (Kendisi / İK / Revir)       |
| `created_at`             | DATETIMEOFFSET DEFAULT GETDATE()                   |                                             |
| `auth1_responded_at`     | DATETIMEOFFSET NULL                                | 1. onaycı işlem zamanı                      |
| `auth2_responded_at`     | DATETIMEOFFSET NULL                                | 2. onaycı işlem zamanı                      |
| `cancelled_at`           | DATETIMEOFFSET NULL                                | İptal tarihi                                |
| `cancelled_by`           | VARCHAR(255) FK → `operator_table.id_dec` NULL     | Kim iptal etti                              |

### 4.2 Süre Hesaplama Mantığı

İzin oluşturulurken backend'de şu hesap yapılır:

```
Eğer leave_duration_type = FULL_DAY:
   total_days = iş günü hesabı (start_date → end_date)
   total_hours = NULL
   deducted_from_balance = total_days × 1.00

Eğer leave_duration_type = HALF_DAY_AM veya HALF_DAY_PM:
   total_days = 0.5
   total_hours = NULL
   deducted_from_balance = 0.50

Eğer leave_duration_type = HOURLY:
   total_days = NULL
   total_hours = saat farkı (end_date - start_date)
   deducted_from_balance = total_hours / günlük_çalışma_saati
   Örnek: 3 saat izin, günlük 8 saat → 3/8 = 0.375 gün düşülür
```

> **Günlük çalışma saati** bir sistem ayarı (settings tablosu veya .env) olarak tutulmalıdır. Genellikle 8 veya 9 saattir.

### 4.3 `leave_balance_logs` (İzin Bakiye Hareketleri)

| Sütun             | Tip                                                | Açıklama                                                                                     |
| ----------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `id`              | INT PK AUTO                                        |                                                                                              |
| `user_id`         | VARCHAR(255) FK → `operator_table.id_dec` NOT NULL |                                                                                              |
| `leave_record_id` | INT FK → `leave_records.id` NULL                   | Hangi izne bağlı? (Yıl başı tanımı ise NULL)                                                 |
| `change_amount`   | DECIMAL(5,2) NOT NULL                              | +14.00, -2.00, -0.50, -0.375, +2.00 (iade)                                                   |
| `balance_after`   | DECIMAL(5,2) NOT NULL                              | İşlem sonrası kalan bakiye                                                                   |
| `reason`          | NVARCHAR(100) NOT NULL                             | "Yıllık izin tanımlaması", "Tam gün izin kullanımı", "Saatlik izin (3 saat)", "İptal iadesi" |
| `created_at`      | DATETIMEOFFSET DEFAULT GETDATE()                   |                                                                                              |

**Bakiye akış senaryoları:**

| Olay                            | `change_amount` | Açıklama                                |
| ------------------------------- | --------------- | --------------------------------------- |
| Yıl başı tanımlaması            | +14.00          | Yıllık hak edilen izin                  |
| Tam gün izin onaylandı (2 gün)  | -2.00           | 2 iş günü düşürüldü                     |
| Yarım gün izin onaylandı        | -0.50           | Yarım gün düşürüldü                     |
| Saatlik izin onaylandı (3 saat) | -0.375          | 3/8 = 0.375 gün düşürüldü               |
| Onaylanmış izin iptal edildi    | +2.00           | İade (eski düşülen miktar geri eklenir) |

### 4.4 `leave_activity_logs` (İzin İşlem Geçmişi / Audit Trail)

Bu tablo, izin sürecinde gerçekleşen **her aksiyonun** kaydını tutar. Kim, ne zaman, hangi izin üzerinde ne yaptı — tamamı izlenebilir.

| Sütun             | Tip                                                | Açıklama                                  |
| ----------------- | -------------------------------------------------- | ----------------------------------------- |
| `id`              | INT PK AUTO                                        |                                           |
| `leave_record_id` | INT FK → `leave_records.id` NOT NULL               | Hangi izin kaydına ait                    |
| `performed_by`    | VARCHAR(255) FK → `operator_table.id_dec` NOT NULL | İşlemi yapan kişi                         |
| `action`          | VARCHAR(30) NOT NULL                               | İşlem türü kodu                           |
| `old_status_id`   | INT FK → `leave_statuses.id` NULL                  | İşlem öncesi durum (ilk oluşturmada NULL) |
| `new_status_id`   | INT FK → `leave_statuses.id` NULL                  | İşlem sonrası durum                       |
| `details`         | NVARCHAR(500) NULL                                 | Ek açıklama / notlar                      |
| `ip_address`      | VARCHAR(45) NULL                                   | İşlemi yapanın IP adresi                  |
| `created_at`      | DATETIMEOFFSET DEFAULT GETDATE()                   | İşlem zamanı                              |

**`action` için kullanılacak sabit kodlar:**

| action kodu            | Ne zaman yazılır?                           | Açıklama                                                                 |
| ---------------------- | ------------------------------------------- | ------------------------------------------------------------------------ |
| `CREATED`              | İzin talebi ilk oluşturulduğunda            | `performed_by` = talebi oluşturan kişi                                   |
| `CREATED_BY_HR`        | İK başka personel adına izin oluşturduğunda | `performed_by` = İK personeli                                            |
| `CREATED_BY_INFIRMARY` | Revir personel adına izin oluşturduğunda    | `performed_by` = Revir personeli                                         |
| `APPROVED_AUTH1`       | 1. onaycı onayladığında                     | `old_status` = PENDING_AUTH1, `new_status` = PENDING_AUTH2 veya APPROVED |
| `APPROVED_AUTH2`       | 2. onaycı onayladığında                     | `old_status` = PENDING_AUTH2, `new_status` = APPROVED                    |
| `APPROVED_BY_HR`       | İK direkt onayladığında (bypass)            | `performed_by` = İK personeli                                            |
| `CANCELLED_BY_USER`    | Kullanıcı kendi talebini iptal ettiğinde    | `new_status` = CANCELLED                                                 |
| `CANCELLED_BY_HR`      | İK herhangi bir izni iptal ettiğinde        | `performed_by` = İK personeli                                            |
| `CANCELLED_BY_MANAGER` | Yönetici reddettiğinde                      | `performed_by` = Yönetici                                                |
| `BALANCE_DEDUCTED`     | Bakiye düşürüldüğünde                       | `details` = "-2.00 gün düşürüldü"                                        |
| `BALANCE_REFUNDED`     | İptal sonrası bakiye iade edildiğinde       | `details` = "+2.00 gün iade edildi"                                      |

**Örnek kayıtlar:**

| leave_record_id | performed_by | action           | old_status    | new_status    | details                         | created_at       |
| --------------- | ------------ | ---------------- | ------------- | ------------- | ------------------------------- | ---------------- |
| 42              | 1001         | CREATED          | NULL          | PENDING_AUTH1 | "Yıllık izin talebi"            | 2026-03-06 09:00 |
| 42              | 2050         | APPROVED_AUTH1   | PENDING_AUTH1 | PENDING_AUTH2 | NULL                            | 2026-03-06 10:15 |
| 42              | 3001         | APPROVED_AUTH2   | PENDING_AUTH2 | APPROVED      | NULL                            | 2026-03-06 14:30 |
| 42              | 3001         | BALANCE_DEDUCTED | NULL          | NULL          | "-2.00 gün düşürüldü"           | 2026-03-06 14:30 |
| 42              | 9999         | CANCELLED_BY_HR  | APPROVED      | CANCELLED     | "Personel talebi üzerine iptal" | 2026-03-07 08:00 |
| 42              | 9999         | BALANCE_REFUNDED | NULL          | NULL          | "+2.00 gün iade edildi"         | 2026-03-07 08:00 |

> **Bu tablonun faydası:** Herhangi bir izin kaydı üzerine tıklandığında, o iznin tüm yaşam döngüsü (timeline) kronolojik sırayla gösterilebilir. "Kim ne zaman onayladı?", "İK ne zaman iptal etti?" gibi sorulara anında cevap verir. Denetim (audit) için de kritiktir.

---

## 5. İlişki Diyagramı (ER)

```
┌─────────────┐
│  sections   │
└──────┬──────┘
       │ 1:N
       ▼
┌──────────────┐      ┌─────────────┐
│ departments  │      │ job_titles  │
└──────────────┘      └──────┬──────┘
       │                     │
       │ FK                  │ FK
       ▼                     ▼
┌─────────────────────────────────────────┐
│           operator_table                │
│  (id_dec PK)                            │
│  role_id FK → roles                     │
│  section FK → sections                  │
│  department FK → departments            │
│  title FK → job_titles                  │
│  auth1 FK → operator_table (self)       │
│  auth2 FK → operator_table (self)       │
└───────┬────────────────┬────────────────┘
        │                │
        │ 1:N            │ 1:N
        ▼                ▼
┌────────────────┐  ┌──────────────────┐
│ leave_records  │  │leave_balance_logs│
│  user_id       │  │  user_id         │
│  created_by    │  │  leave_record_id │
│  cancelled_by  │  └──────────────────┘
│  auth1_user_id │
│  auth2_user_id │
└──┬──────┬──────┬──────────────────┐
   │      │      │                  │
   │FK    │FK    │FK                │ 1:N
   ▼      ▼     ▼                  ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐
│leave_statuses│ │leave_reasons │ │leave_duration_types  │
└──────────────┘ └──────────────┘ └──────────────────────┘
                                 ┌──────────────────────┐
                                 │ leave_activity_logs  │
                                 │  leave_record_id FK  │
                                 │  performed_by FK     │
                                 │  old_status_id FK    │
                                 │  new_status_id FK    │
                                 └──────────────────────┘

┌────────┐  N:M  ┌─────────────┐
│ roles  │◄─────►│ permissions │
└────────┘       └─────────────┘
      (role_permissions pivot)
```

---

## 6. Eski → Yeni Eşleme Özeti

| Eski Yapı                                   | Sorun                   | Yeni Yapı                                |
| ------------------------------------------- | ----------------------- | ---------------------------------------- |
| `leave_status = "1"`                        | Sihirli sayı            | `leave_status_id` FK → `leave_statuses`  |
| `leave_reason = "Yıllık İzin"` (string)     | FK yok                  | `leave_reason_id` FK → `leave_reasons`   |
| `op_username` (leave_records'a kopyalanmış) | Denormalizasyon         | Kaldırıldı, JOIN ile çekilecek           |
| `leave_uniq_id` (manuel artırma)            | Race condition          | `id` INT AUTO_INCREMENT                  |
| Sadece tam gün izin desteği                 | Yarım gün / saatlik yok | `leave_duration_type_id` + `total_hours` |
| Bakiye hiç güncellenmiyor                   | Veri tutarsızlığı       | `leave_balance` + `leave_balance_logs`   |
| `op_section`, `part` (string)               | Sabit liste değil       | `section`, `department` FK               |
| `title` (string)                            | Sabit liste değil       | `title` FK → `job_titles`                |
| `auth1/auth2` (JSON Text)                   | Parse riski             | Düz VARCHAR FK                           |
| `is_admin`, `is_approver` (flag)            | Rol varken gereksiz     | Kaldırıldı                               |
| `if (roleId === 7)` hardcoded               | Bakımsız                | permission code ile kontrol              |
| `op_username` tek alan                      | Ad-Soyad ayrıştırılamaz | `name` + `surname` + `nick_name`         |

---

## 7. Toplam Tablo Listesi

| #   | Tablo                  | Amaç                                      |
| --- | ---------------------- | ----------------------------------------- |
| 1   | `sections`             | Bölüm lookup                              |
| 2   | `departments`          | Birim lookup (section'a bağlı)            |
| 3   | `job_titles`           | Ünvan lookup                              |
| 4   | `roles`                | Rol tanımları                             |
| 5   | `permissions`          | Yetki tanımları (modül bazlı)             |
| 6   | `role_permissions`     | Rol ↔ Yetki eşleme (pivot)                |
| 7   | `operator_table`       | Kullanıcılar                              |
| 8   | `leave_statuses`       | İzin durum lookup                         |
| 9   | `leave_reasons`        | İzin sebep lookup                         |
| 10  | `leave_duration_types` | İzin süre tipi lookup (tam/yarım/saatlik) |
| 11  | `leave_records`        | Ana izin kayıtları                        |
| 12  | `leave_balance_logs`   | Bakiye hareket geçmişi                    |
| 13  | `leave_activity_logs`  | İzin işlem geçmişi (Audit Trail)          |
