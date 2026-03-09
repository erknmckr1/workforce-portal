# İzin Yönetimi Modülü Yeniden Kodlama Rehberi (Saf İş Akışı)

Bu doküman, yeni proje kurgulanırken sadece verinin nasıl aktığına (data flow) ve kullanıcının senaryo adımlarına odaklanmaktadır. Komponent veya React özel yapıları içermez. Sadece mantıksal işleyişi barındırır.

## 1. Sistemdeki Roller ve Kritik İhtiyaçlar

Sistemin düzgün çalışabilmesi için veritabanından çekilecek _Session/User_ objesinde şu bilgilerin **mutlak surette** erişilebilir olması gerekir:

- `id_dec` (Kullanıcı benzersiz sicil numarası / ID'si)
- `op_username` (Ad Soyad)
- `roleId` veya yetki seviyesi (Personel mi, İK mı, Yönetici mi?)
- `auth1` (Bu personelin iznini onaylayacak 1. Yöneticinin ID'si)
- `auth2` (Bu personelin iznini onaylayacak 2. Yöneticinin ID'si)

## 2. Akış: İzin Talebi Oluşturma (Create)

**Kimin İçin:** Standart Personel veya İK. (İK yapıyorsa ekstra olarak önce işlem yapacağı personeli bulması gerekir).

1. **Gerekli Veriler (Form):**
   - İzin Başlangıç Tarihi (Tarih ve Saat)
   - İşe Dönüş Tarihi (Tarih ve Saat)
   - İzin Nedeni (Yıllık İzin, Mazeret vb. - Opsiyonlar DB'den gelir)
   - Ulaşılabilecek Adres, Telefon
   - Açıklama

2. **Validasyon (Ön Uç Kontrolü):**
   - Tüm zorunlu alanlar dolduruldu mu?
   - Başlangıç tarihi, İşe Dönüş tarihinden **önce** mi? (Eğer değilse hata dön!)

3. **Veri Gönderimi (POST API):**
   - Gelen veri paketi şu şekilde olmalıdır: Form bilgileri + Hedef Kullanıcı ID + Hedef Kullanıcı Adı + `auth1` + `auth2`.
   - **Backend İşlemi:** İzin statüsü `Status = 1` (1. Onaycı Bekleniyor) olarak veritabanına kaydedilir.
   - (İsteğe bağlı ekstra: İK oluşturuyorsa direk `Status = 3` (Onaylandı) çekilebilir).

## 3. Akış: Onaylama Süreci (Approve/Reject)

**Kimin İçin:** Yöneticiler (`auth1`, `auth2`) ve İnsan Kaynakları.

1. **Verinin Çekilmesi:**
   - Yönetici listeleme ekranına girdiğinde: `GET /api/leave/pending` çağrılır.
   - **Backend Mantığı:** Gelen istekteki kullanıcının ID'sine bakılır. Eğer veritabanında `auth1 === User.ID` ve `Status === 1` olan kayıtlar varsa veya `auth2 === User.ID` ve `Status === 2` olan kayıtlar varsa döndürülür.

2. **Onay İşlemi:**
   - Yönetici bir faturayı onaylar gibi izni seçer ve "Onayla" der.
   - **Frontend:** İzin ID'sini ve İşlem Yapan (Yönetici) ID'sini backend'e atar.
   - **Backend İşleyişi:**
     - İznin şu anki durumuna bakar.
     - `Status === 1` ise, durumu `Status = 2` (2. Onaycı Bekliyor) yapar. (Eğer `auth2` yoksa direkt `Status = 3` yapabilir, kurum kültürüne göre).
     - `Status === 2` ise, durumu `Status = 3` (Onaylandı) yapar.

3. **Red / İptal İşlemi:**
   - Aynı liste üzerinden "İptal Et" denir.
   - **Backend İşleyişi:** İznin durumunu `Status = 4` (İptal Edildi / Reddedildi) olarak günceller.

_(Not: Toplu işlemlerde bu mantık, bir array (dizi) içerisindeki ID'ler için döngüyle veya DB'de `WHERE IN(ids..)` komutuyla çalıştırılır)._

## 4. Akış: Veri Görüntüleme ve Güvenlik/Revir

1. **Geçmiş İzinlerim / Bütün İzinler:**
   - Bu alan tamamen veri okuma (DataGrid, Tablo) işlemidir.
   - Personel kendi geçmişini çekerken sadece `WHERE user_id = my_id` der.
   - İK tümünü çekerken `SELECT *` der. Filtreleme eklenebilir (Örn: Sadece belirli tarihtekiler).

2. **Güvenlik (Çıkış Yapacak Personel):**
   - **Amaç:** Sadece şuan kapıdan çıkma yetkisi olan kişileri görmek.
   - **Sorgu Mantığı:** Bugünü ve şu anki saati al. İzin başlangıç saati şu anki saate yakın olan (Örn: +/- 2 saat içinde başlayacaklar) ve `Status === 3` (Tamamen onaylanmış) kayıtları filtrele.
   - **UI Davranışı:** Sayfa yenilenmeye ihtiyaç duymamalı, ya arka planda 30 saniyede bir o listeyi tekrar API'den çekmeli ya da WebSocket üzerinden dinlemeli.

## 5. Projeye Başlarken Tavsiye Edilen Adımlar (Özet)

1. DB Yapınızı (Schema) yukarıdaki `Status` senaryosunu karşılayacak şekilde kurun ($1=Bekliyor, 2=Son Onay, 3=Onaylandı, 4=İptal$).
2. API uçlarınızı (Endpoints) oluşturun.
   - `POST /leave` (Oluşturma)
   - `GET /leave?status=pending` (Sorgulama)
   - `PATCH /leave/:id` (Durum Güncelleme)
3. Form ekranını tasarlayıp POST akışını bağlayın.
4. Tablo/Liste ekranını tasarlayıp GET ve PATCH(aksiyon) akışını bağlayın.
5. Kullanıcı yetkilerine (Role bazlı görünümlere) göre menüleri sakla/göster kurallarını uygulayın.
