# İzin Yönetimi Yeniden Kurgulama (Senaryo ve Mimari Önerisi)

Bu belge, mevcut İzin Yönetimi (`/home/izinyonetimi`) sayfasının sıfırdan, daha temiz, ölçeklenebilir ve mantıklı bir yapıda yeniden geliştirilmesi için hazırlanmış adım adım bir kurgudur.

---

## 1. Temel Aktörler ve Roller

Sistemi kullanacak 4 ana profil bulunmaktadır:

1. **Standart Personel:** Kendi adına izin talebi oluşturur ve geçmiş izinlerini görüntüler.
2. **Yönetici (1. ve 2. Onaycılar):** Kendi altındaki personelin izinlerini görür, onaylar veya reddeder.
3. **İnsan Kaynakları (İK):** Tüm personelin izinlerini görür, herhangi bir personel adına izin oluşturabilir, izinleri düzenleyebilir/iptal edebilir.
4. **Güvenlik / Revir:** Giriş/çıkış yapacak (yaklaşan izni olan) personelleri görüntüler veya revir özelinde izin oluşturur.

---

## 2. Kullanıcı Akış Senaryoları (User Flows)

### Akış 1: Standart Personel İzin Talebi

1. Personel `/home/izinyonetimi` sayfasına girer.
2. Form ekranında "İzin Başlangıç", "İşe Dönüş", "İzin Sebebi", "Telefon", "Adres" ve "Açıklama" alanlarını doldurur.
3. Form gönderildiğinde (`POST /api/leave/createNewLeave`), sistem kullanıcının sahip olduğu **1. Onaycı** (auth1) ve **2. Onaycı** (auth2) bilgilerini de alarak durumu "1. Onaycı Bekleniyor (Status: 1)" olarak işaretler.
4. "Geçmiş İzinlerim" sekmesinde personel kendi talebinin durumunu (`Pending`, `Approved`, `Rejected` vs.) takip eder.

### Akış 2: İK'nın Personel Adına İzin Oluşturması

1. İK yetkilisi, modal/sayfa üzerinden "Personel İzin Talebi Oluştur" sekmesini seçer.
2. Personelin `id_dec` (Sicil No vb.) numarasını girer sistem API üzerinden personeli doğrular.
3. Personel bilgileri ekranda kart olarak belirir. Modül, kullanıcının `op_username`, `auth1`, `auth2` bilgilerini state'e alır.
4. İK, izin formunu doldurup kaydeder (`POST /api/leave/createNewLeaveByIK`). İzin direkt onaylı (Status: 3) veya standart onay sürecine (Status: 1) tabi tutularak sisteme işlenir.

### Akış 3: Yönetici Onay ve İptal Süreci

1. Yönetici sayfaya girdiğinde konfigürasyon (LeaveConfig) ona "Bekleyen Onaylar" sekmesini gösterir.
2. Sistem, oturum açan kişinin ID'sini (`auth1` veya `auth2` olarak) içeren bekleyen talepleri getirir.
3. Yönetici tablodan çoklu seçim yapar veya tekil satırdaki **Onay (GiConfirmed)** / **İptal (GiCancel)** butonlarına basar.
4. `POST /api/leave/workflow` (Önerilen yeni API) endpoint'ine işlem (approve/reject) ve izin ID'leri gönderilir.
5. Veritabanında izin durumu güncellenir ve tablo eşzamanlı (tercihen Optimistic UI veya Socket ile) yenilenir.

### Akış 4: Güvenlik / Kapı Kontrol (Live Data)

1. Güvenlik personeli "Çıkış Yapacak Personel" sekmesine girer.
2. Sistem içinde bulunduğumuz zaman dilimi ile izin başlangıç saati eşleşenleri veya yaklaşanları (Örn: +/- 2 saat) listeler.
3. Bu ekran **Socket.io** üzerinden canlı beslenir. (Eğer backend tarafında Socket tetiklenmiyorsa SWR/React Query ile 30 saniyede bir arkaplanda sessizce polling yapılır).

---

## 3. Yeni Front-End Mimari Kurgusu (Öneri)

Mevcut dosya yapısı olan `components/izinYonetimSistemi/...` altındaki "her şeyi tek dosyada tutma" ve "büyük if/else blokları" yerine daha modüler bir yaklaşım önerilmektedir.

### 📁 Klasör Yapısı

```text
components/leave-management/
│
├── 📂 forms/
│   ├── CreateLeaveForm.jsx   (Standart personel formu)
│   ├── HrLeaveForm.jsx       (İK için personel seçmeli form)
│   └── FormElements.jsx      (Seçici, DatePicker gibi ortak UI elementleri)
│
├── 📂 tables/
│   ├── LeaveDataGrid.jsx     (Ortak MUI DataGrid kapsayıcısı, sadece 'columns' ve 'data' alır)
│   ├── TableActions.jsx      (Onay/İptal butonlarının tutulduğu kolon renderer bileşeni)
│   └── LeaveRangePicker.jsx  (Tarih filtreleme komponenti)
│
├── 📂 layout/
│   ├── LeaveLayout.jsx       (Ekranı ikiye bölen ana iskelet, sol: Profil, sağ: İçerik)
│   ├── UserProfileCard.jsx   (Kimin için işlem yapılıyorsa onun bilgilerini gösterir)
│   └── NavigationTabs.jsx    (Yetkiye göre sekmeleri render eder)
│
├── 📂 hooks/
│   ├── useLeaveConfig.js     (Kullanıcı yetkisine (roleId) göre hangi tab/butonların gösterileceğini döndürür)
│   ├── useLeaveMutations.js  (Onay, İptal, Kayıt gibi POST/PATCH istekleri, React Query önerilir)
│   └── useLeaveQueries.js    (Tablo verilerini çeken GET istekleri, Socket.io veya SWR/React Query burada yönetilir)
│
└── index.jsx                 (Ana giriş dosyası - Eski LeaveManagement.jsx muadili)
```

### 🧠 Modernizasyon İçin Kritik Teknik Kararlar

1. **State Yönetimi (Redux yerine React Query / SWR):**
   - Sunucu verilerini (Tablodaki izinleri, kullanıcı listesini) Redux'ta tutmak yerine **TanStack Query (React Query)** veya **SWR** kullanılmalıdır. Bu araçlar önbellekleme, loading state kontrolü, hata yönetimi ve arka planda veri yenileme (polling) işlemlerini otomatik çözer. Redux sadece `selectedFlow` veya `isPopupOpen` gibi UI stateleri için kullanılmalıdır.

2. **API Metodlarının Düzeltilmesi (CRUD Standartları):**
   - Eski sistemde `GET /api/leave/approveLeave` gibi işlemler yapılıyordu. Yeni sistemde:
     - Okuma işlemleri (Tablolar) -> `GET`
     - Yeni İzin Kaydı -> `POST`
     - İzin Onaylama / İptal -> `PATCH` veya `PUT`
     - İzin Silme -> `DELETE`

3. **LeaveConfig Mantığının Hook'laştırılması:**
   - Eski sistemde `LeaveConfig.js` içinde `<IzinForm />` şeklinde JSX tutuluyordu. Bu anti-desen (anti-pattern) olarak kabul edilir.
   - Yeni sistemde bir Hook veya JS Object sadece enum/string key'ler tutmalı: `componentKey: "STANDARD_FORM"`. Ana `index.jsx` ise switch-case ile veya mapping objesiyle ilgili komponenti render etmelidir.

4. **Socket.io ve Polling Karmaşasının Çözülmesi:**
   - Güvenlik gibi anlık ekranlarda, Socket.io implementasyonu backend'de sağlıklı değilse, React Query'nin `refetchInterval: 60000` (60 saniyede bir istek at) özelliği kullanılmalıdır. Bu kod karmaşasını tek satıra indirir.

5. **`activeUser` Karmaşasını Gidermek:**
   - İkide bir `activeUser = isPopup ? user : userInfo` kontrolünü her dosyada yapmak yerine, en üstte (Layout seviyesinde) bir `<LeaveContext.Provider value={{ targetUser }}>` açılıp, alt komponentler sadece kimi hedef alacağını bu context'ten bilmelidir.

---

## 4. Uygulama Adımları (Roadmap)

Eğer yeni projede bu sistemi kurgulamaya başlayacaksanız şu sırayı takip etmelisiniz:

1. **Adım 1:** Yukarıdaki klasör yapısını oluşturun. UI kütüphaneleri (MUI DataGrid, Form validator olarak react-hook-form ve yup/zod) kurun.
2. **Adım 2:** API bağlantılarını yönetecek `useLeaveQueries` ve `useLeaveMutations` hook'larını yazın (mock data veya gerçek API url'leri ile).
3. **Adım 3:** Profil Kartı (`UserProfileCard`) ve Sekme (`NavigationTabs`) bileşenlerini yaparak ekran iskeletini oturtun.
4. **Adım 4:** Önce standart kullanıcının formunu (`CreateLeaveForm`) ve tablosunu (`LeaveDataGrid`) sisteme entegre edin.
5. **Adım 5:** Yöneticiler için onay/iptal butonlarını Datagrid'in `columns` özelliğine render ederek `mutations` hook'u ile bağlayın.
6. **Adım 6:** Son olarak İK ekranlarını ve Güvenlik (Canlı) ekranlarının özel durumlarını ekleyin.
