# İzin Yönetimi Sayfası Analiz Raporu

Bu rapor, `/home/izinyonetimi` sayfasının frontend mimarisini, form/tablo bileşenlerini, state yönetimini ve backend API entegrasyonlarını detaylı bir şekilde incelemektedir. Mevcut kodu daha temiz, modüler ve yönetilebilir bir yapıya taşımak için bir referans (Source) niteliğindedir.

## 1. Sayfa ve Bileşen Hiyerarşisi

**Ana Sayfa (Route):**
`app/home/izinyonetimi/[action]/page.jsx`

- Sadece `flow === "izinyonetimi"` kontrolü yapar ve `LeaveManagement` bileşenini ekrana basar.

**Ana Bileşen:**
`components/izinYonetimSistemi/LeaveManagement.jsx`

- Sayfanın ana iskeletini tutar.
- İlk yüklendiğinde `/api/user/getAllUsers` isteği atar ve Redux'a tüm kullanıcıları kaydeder.
- Ekranı ikiye böler: Sol tarafta `UserCard`, sağ tarafta seçili akışa (flow) göre sekmeler (`TabButtons`) ve içerik.
- `LeaveConfig.js` üzerinden sekmeleri ve tabloları dinamik olarak çeker.

**Alt Bileşenler (`parts/` ve `popup/`):**

- **UserCard.jsx:** Redux'tan alınan oturum açmış kullanıcının (veya popup içindeyse işlem yapılan kullanıcının) bilgilerini ve izin bakiyesini gösterir.
- **TabButtons.jsx:** `LeaveConfig.js` içerisindeki sekme yapılarını buton olarak render eder ve aktif sekmeyi state olarak tutar.
- **HrLeaveForm.jsx:** İK veya yöneticilerin diğer personeller adına izin talebi oluşturduğu form. `id_dec` ile kullanıcı arama, filtreleme ve dropdown özelliklerine sahiptir.
- **İzinForm.jsx:** Standart personelin kendi adına izin talebi oluşturduğu form.
- **LeaveTable.jsx:** Material-UI `DataGrid` kullanarak izinleri listeler. Çoklu seçim, iptal, onaylama gibi işlemleri içerir. Toplu işlem yapabilme yeteneği vardır. Socket.io bağlantısı içerir (canlı güncellemeler için).
- **LeaveRangePicker.jsx:** Belirli bir tarih aralığındaki izinleri filtrelemek için kullanılır.
- **CreateLeavePopup.jsx:** İzin talebi oluşturmak için ekranı kaplayan, modüler olarak `LeaveManagement`'i kendi içinde tekrar çağıran bir modal/popup yapısıdır.

## 2. State Yönetimi (Redux)

Uygulamanın durumu üç ana Redux dilimi (slice) üzerinden yönetilmektedir:

- **globalSlice (`state.global`):**
  - `selectedFlow`: Hangi izin işleminin ("İzin Talebi Oluştur", "İzin Talebi Onayla", vb.) seçili olduğunu tutar.
  - `isCreateLeavePopup`: İzin oluşturma modalının açık olup olmadığını belirler.

- **userSlice (`state.user`):**
  - `userInfo`: Sisteme giriş yapmış olan, işlemi yapan mevcut kullanıcının bilgileri.
  - `user`: Üzerinde işlem yapılan (örneğin İK'nın aratıp bulduğu) kullanıcının verileri.
  - `allUser`: Sistemdeki tüm kullanıcıların listesi (arama/filtreleme ve isim eşleştirmeleri için).
  - `permissions`: Kullanıcının yetkileri ("1. Onay", "İptal" vb.).

- **workFlowManagement (`state.flowmanagement`):**
  - `selectedLeaveRow`: Tabloda tıklanan izin satırını tutar.
  - `records`: `LeaveTable` üzerinde gösterilecek olan izin kayıtları.
  - `filteredText`: Arama/filtreleme metni.

## 3. Backend API Etkileşimleri

Bileşenlerin axios ile backend sunucusuna attığı istekler şunlardır (`process.env.NEXT_PUBLIC_API_BASE_URL` üzerinden):

### Kullanıcı İşlemleri:

- `GET /api/user/getAllUsers`: Sistemdeki tüm personeli çeker. (`LeaveManagement`)
- `GET /api/user/{id_dec}/getuserinfo`: Belirli bir personelin detaylı bilgisini getirir. (`HrLeaveForm`)

### İzin Talebi İşlemleri (Formlar):

- `GET /api/leave/getLeaveReasons`: İzin nedenerini (Yıllık İzin, Mazeret vs.) çeker. (`HrLeaveForm`, `İzinForm`)
- `POST /api/leave/createNewLeave`: Personelin kendisi için izin oluşturması. JSON Body olarak `formData`, `selectedReason`, `id_dec`, `op_username`, `auth1`, `auth2` gider. (`İzinForm`)
- `POST /api/leave/createNewLeaveByIK`: İK'nın başka bir personel adına izin oluşturması. Ekstra olarak formu dolduranın bilgileri de gider. (`HrLeaveForm`)

### İzin Listeleme ve Tablolar (LeaveTable):

- `GET /api/leave/getPendingLeaves` (Bekleyen İzinler)
- `GET /api/leave/getApprovedLeaves` (Onaylananlar)
- `GET /api/leave/getPastLeaves` (Geçmiş İzinler)
- `GET /api/leave/getPendingApprovalLeaves` (Yönetici için beklemede olan onaylar)
- `GET /api/leave/getManagerApprovedLeaves` (Yönetici tarafından onaylananlar)
- `GET /api/leave/alltimeoff` (İK Tüm izinler)
- `GET /api/leave/leavesApprovedByTheInfirmary` (Revir onaylı izinler)
- `GET /api/leave/personelToBeChecked` (Güvenlik / Çıkış yapacaklar - Polling ile 3 dakikada bir çalışır)
- `GET /api/leave/getDateRangeLeave`: Tarih aralığına göre (start/end_date) izinleri getirir (`LeaveRangePicker`)

### İzin Onay/İptal Aksiyonları (LeaveTable):

- `GET /api/leave/approveLeave`: Tekil izin onayı (`leave_uniq_id`, `id_dec`).
- `GET /api/leave/cancelPendingApprovalLeave`: İzin iptali.
- `GET /api/leave/confirmSelections`: Seçili olan birden fazla izni aynı anda onaylama (`leaveIds` virgülle ayrılarak).
- `GET /api/leave/cancelSelectionsLeave`: Toplu izin iptali.

_(Not: Onay ve iptal işlemlerinde GET metodu kullanılmış, standart REST prensipleri gereği bunların POST, PUT veya PATCH olması daha uygundur.)_

## 4. Refactoring (Yeniden Düzenleme) İçin Tespit & Öneriler

Mevcut yapı temel olarak çalışıyor olsa da "daha düzenli ve mantığı bozmadan" yeniden ele almak için şu noktalara odaklanılabilir:

1. **GET Metodlarıyla Veri Değiştirme (Mutations):**
   - Onay (`approveLeave`), İptal (`cancelPendingApprovalLeave`) gibi veritabanında değişiklik yapan işlemler `GET` metodunda. Bunlar `Axios.post` veya `Axios.patch` olarak backend tarafında da düzeltilmelidir (Mevcut mantık bozulmayacaksa şimdilik bırakılabilir ama teknik borçtur).

2. **Socket.io ve Polling Sorunu:**
   - `LeaveTable.jsx` içinde hem Socket.io dinleyicisi var (`"updateLeaveTable"`) hem de `yaklasanizin` statüsünde 3 dakikalık bir `setInterval` (polling) var. Socket bağlantısında sorun olduğu ("SOCKET CALISMIYOR ÜZERİNDE ÇALIŞ") not düşülmüş. Eğer gerçek zamanlı Socket.io entegrasyonu tam çalışırsa, 3 dakikalık setInterval kaldırılmalı. Performansı arttırır.

3. **Komponent Büyüklüğü & Karmaşa (LeaveTable):**
   - `LeaveTable.jsx`, 400 satırın üzerinde ve API çağrıları, MUI Datagrid kolon konfigürasyonları, stil hesaplamaları ve onay/iptal logiğini iç içe bulunduruyor.
   - **Öneri:** Veri çekme mantıkları bir adet özel Hook içine (Örn: `useHandleLeaveRecords(status)`) alınabilir. Kolon tanımları (columns) ayrı bir konfigürasyon dosyasına veya fonksiyona taşınabilir.

4. **Kullanıcı Bilgisi Yönetimi (`activeUser` Kontrolü):**
   - Sayfanın çoğu yerinde `const activeUser = isCreateLeavePopup && user ? user : userInfo;` şeklinde bir if/else var. Bu durum Redux tarafında veya `useAuth()`/`useCurrentUser()` gibi genel bir hook yaratılarak daha merkezi bir yerden yönetilebilir, kod tekrarı önlenir.

5. **`LeaveConfig.js` ve Component Referansları:**
   - Config dosyası JSX (React komponentleri) tutuyor. `component: <IzinForm />` gibi. Normalde konfigürasyon dosyalarının sadece veri/string/key tutması, routing/rendering mekanizmasının ana komponent tarafında bu "key" leri match edip komponent dönmesi daha "clean" bir yaklaşımdır.

## Sonuç

Frontend tarafındaki parçalar (UserCard, Header, Formlar ve DataGrid) görsel ve işlevsel olarak başarılı bağımsızlaştırılmış. Refactoring aşamasında dosya isimlerini standartlaştırmak (örn: `İzinForm` yerine `IzinForm`, Türkçe karakterden kaçınmak), `LeaveTable` içindeki karmaşık iş mantığını hook'lara ayırmak projenin taşınabilirliğini ve bakımını ciddi oranda kolaylaştıracaktır.
