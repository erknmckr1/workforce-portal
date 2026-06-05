# Onay Hiyerarşisi ve Senkronizasyon Notları

Bu doküman, `/settings/approvals` ekranı ve izin onay zinciri üzerinde yapılan son geliştirmelerin çalışma mantığını özetler.

İlgili commit için önerilen mesaj:

```bash
git commit -m "refactor: sync approval chains from section and department assignments"
```

## Amaç

Eski yapı `operator_table.auth1` ve `operator_table.auth2` alanlarını büyük ölçüde sabit bir mantıkla dolduruyordu:

```text
auth1 = department.supervisor_id
auth2 = section.manager_id
```

Bu yapı `Personel -> Yönetici -> Müdür` akışı için yeterliydi. Ancak `Ustabasi` rolü eklendikten sonra aynı department içindeki herkes için aynı `auth1/auth2` değerini yazmak doğru sonuç vermemeye başladı.

Yeni yaklaşımda `sections` ve `departments` tabloları onay hiyerarşisinin kaynak yapılandırmasıdır. `operator_table.auth1/auth2` ise bu yapılandırmadan üretilen çalışma alanı/cache gibi kullanılmaya devam eder.

## Kaynak Alanlar

### `sections.manager_id`

Bölüm müdürünü temsil eder.

Örnek:

```text
BilgiIslem section.manager_id = Kubilay Akkiz
```

### `departments.supervisor_id`

Birim yöneticisini temsil eder. Eski `Şef` karşılığı artık `Yönetici` olarak ele alınır.

Örnek:

```text
BilgiIslem department.supervisor_id = Ozcan Efe
```

### `departments.ustabasi_id`

Birim ustabaşısını temsil eder. Nullable bir alandır; her birimde ustabaşı olmak zorunda değildir.

Örnek:

```text
Paketleme department.ustabasi_id = ilgili ustabaşı
```

## `/settings/approvals` Ekranı

Ekranda iki ana alan vardır:

```text
Bölüm Yöneticileri
Birim Sorumluları
```

`Bölüm Yöneticileri` bölümünde `sections.manager_id` atanır.

`Birim Sorumluları` bölümünde iki ayrı seçim yapılır:

```text
Ustabaşı Ata      -> departments.ustabasi_id
Yönetici Ata      -> departments.supervisor_id
```

Sol tarafta bir bölüme tıklanınca sağ taraftaki birimler sadece o bölüme göre filtrelenir. `Tümü` butonu filtreyi kaldırır.

## Rol Adı Güncellemesi

DB'de eski `Şef` rol adı `Yönetici` olarak değiştirildi. Projede route izinleri, sidebar rolleri, ekran metinleri ve backend approver filtresi buna göre güncellendi.

Teknik kolon adları değiştirilmedi:

```text
departments.supervisor_id
operator_table.auth1
operator_table.auth2
```

Bu alanlar sistemin mevcut çalışma sözleşmesidir.

## Sync Helper Mantığı

Backend tarafında onay zinciri hesaplaması merkezi helper'a taşındı.

Ana helper:

```text
resolveApprovalChain(operator, department, section)
```

Bu helper kişinin sistem rolüne ek olarak approvals ekranındaki gerçek atamalarına da bakar. Yani bir kişi `role_id = Admin` olsa bile `department.supervisor_id` olarak atanmışsa izin akışında yönetici gibi davranabilir.

Öncelik sırası:

```text
1. Kişi section.manager_id ise:
   Müdür gibi davranır.
   auth1 = null
   auth2 = null

2. Kişi department.supervisor_id ise:
   Yönetici gibi davranır.
   auth1 = section.manager_id
   auth2 = null

3. Kişi department.ustabasi_id ise:
   Ustabaşı gibi davranır.
   auth1 = department.supervisor_id
   auth2 = section.manager_id

4. Kişi bu görevlerden hiçbirinde değilse:
   Normal çalışan akışı uygulanır.
```

Normal çalışan akışı:

```text
Eğer ustabaşı + yönetici varsa:
auth1 = ustabaşı
auth2 = yönetici

Eğer sadece yönetici varsa:
auth1 = yönetici
auth2 = müdür

Eğer sadece ustabaşı varsa:
auth1 = ustabaşı
auth2 = müdür
```

Bu mantık sayesinde her aktif personelin `auth1/auth2` değerleri department ve section atamalarından yeniden üretilebilir.

## Senkronizasyon Tetikleyicileri

### Bölüm müdürü değişirse

`PUT /personnel/section-manager/:id`

İlgili section ve o section'a bağlı department personellerinin onay zinciri yeniden hesaplanır.

### Birim yöneticisi değişirse

`PUT /personnel/department-supervisor/:id`

Sadece ilgili department personellerinin onay zinciri yeniden hesaplanır.

### Birim ustabaşı değişirse

`PUT /personnel/department-ustabasi/:id`

Sadece ilgili department personellerinin onay zinciri yeniden hesaplanır.

### Tüm Yetkileri Senkronize Et butonu

`POST /personnel/sync-approvals`

Tüm aktif personeller çekilir. Her biri için:

```text
1. Kişinin department kaydı bulunur.
2. Department'ın bağlı olduğu section bulunur.
3. resolveApprovalChain ile yeni auth1/auth2 hesaplanır.
4. Mevcut auth1/auth2 farklıysa operator_table güncellenir.
```

Bu buton, canlı DB'deki tüm aktif personelleri mevcut section/department atamalarına göre yeniden düzenler.

## İzin Oluşturma Davranışı

İzin oluşturma backend'de `POST /leave` ile yapılır.

Normal durumda izin kaydı oluşturulurken `operator_table.auth1` ve `operator_table.auth2` okunur ve izin kaydına snapshot olarak yazılır:

```text
leave_records.auth1_user_id = operator_table.auth1
leave_records.auth2_user_id = operator_table.auth2
```

Bu snapshot önemlidir; ileride manager değişse bile eski izin kaydının onaycıları geriye dönük değişmez.

## Onay Zinciri Olmayan Üst Seviye Kullanıcılar

`section.manager_id` olan kişiler şu an müdür gibi kabul edilir ve `auth1/auth2` alanları boş bırakılır.

Bu kişilerin normal izin oluşturması eski validasyonda hata veriyordu. Bu nedenle geçici bir otomatik onay kuralı eklendi.

Yeni kural:

```text
Eğer hedef kullanıcının auth1 ve auth2 alanları ikisi de boşsa:
izin talebi doğrudan Onaylandı statüsüyle oluşturulur.
```

Bu durumda:

```text
leave_status_id = 3
auth1_user_id = null
auth2_user_id = null
```

Aktivite loguna otomatik onay açıklaması yazılır ve kullanıcıya otomatik onay bildirimi gönderilir.

## Otomatik Onaylanan İzinlerin İptali

Hard delete yapılmaz. İptal işlemi soft delete mantığındadır:

```text
leave_status_id = 4
cancelled_at = işlem zamanı
cancelled_by = işlemi yapan kullanıcı
```

Normal kullanıcılar bekleyen izinleri iptal edebilir:

```text
leave_status_id = 1 veya 2
```

Ek istisna:

```text
leave_status_id = 3
auth1_user_id = null
auth2_user_id = null
```

Bu kayıtlar otomatik onaylanmış zincirsiz izin kabul edilir ve izin sahibi tarafından iptal edilebilir.

Bu istisna hem `Leaves.tsx` hem de kiosk tarafındaki kullanıcı talepleri ekranında gösterilir.

## Bilinen Risk ve Sonraki İyileştirme

Otomatik onaylanan zincirsiz izinleri şu an şu koşulla ayırt ediyoruz:

```text
leave_status_id = 3
auth1_user_id boş
auth2_user_id boş
```

Bu çalışır, ancak en sağlam model değildir. Çünkü `auth1/auth2` boşluğu üzerinden anlam çıkarıyoruz.

Daha sağlam gelecek tasarım:

```text
leave_records.approval_mode
```

Örnek değerler:

```text
NORMAL
AUTO_NO_APPROVER
AUTO_REVIR
MANUAL_ADMIN
```

Bu durumda otomatik onaylı zincirsiz izin şu şekilde anlaşılır:

```text
leave_status_id = 3
approval_mode = AUTO_NO_APPROVER
```

Bu alan eklenirse bug riski azalır ve raporlama/debug tarafı daha net olur.

## Örnekler

### BilgiIslem, ustabaşı yok

```text
section.manager_id = Kubilay Akkiz
department.supervisor_id = Ozcan Efe
department.ustabasi_id = null
```

Normal personel:

```text
auth1 = Ozcan Efe
auth2 = Kubilay Akkiz
```

Ozcan Efe department yöneticisi ise:

```text
auth1 = Kubilay Akkiz
auth2 = null
```

Kubilay Akkiz section manager ise:

```text
auth1 = null
auth2 = null
```

Kubilay izin oluşturursa izin otomatik onaylanır.

### Birimde ustabaşı ve yönetici varsa

```text
department.ustabasi_id = Ustabaşı
department.supervisor_id = Yönetici
section.manager_id = Müdür
```

Normal personel:

```text
auth1 = Ustabaşı
auth2 = Yönetici
```

Ustabaşı:

```text
auth1 = Yönetici
auth2 = Müdür
```

Yönetici:

```text
auth1 = Müdür
auth2 = null
```

Müdür:

```text
auth1 = null
auth2 = null
```
