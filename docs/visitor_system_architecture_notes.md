# Ziyaretçi Takip Sistemi - Mimari & State Yönetimi Notları

Bu doküman, Ziyaretçi Kayıt ve Takip Sistemi geliştirilirken ele alınan performans optimizasyonları, state yönetimi mimarisi (React Query vs. Yerel State) ve Debounce stratejilerini içermektedir.

---

## 1. Gecikmenin (Input Delay / Lag) Asıl Sebebi ve Çözümü

### Sorun:
Formdaki girdiler yerel `useState` ile çalışıyordu; ancak her harfe basıldığında arka planda şu gerçekleşiyordu:
* **İlçe Sıralama Maliyeti:** Formda herhangi bir harf yazıldığında (Ad Soyad, Telefon, Plaka vb.) `NewVisitorDialog` bileşeni baştan render oluyor ve `getDistrictsByProvince()` fonksiyonu **her harf vuruşunda** Türkiye'nin ilçelerini `localeCompare("tr")` algoritmasıyla yeniden sıralıyordu.
* JavaScript'in yerelleştirme (Intl) motoru her tuşta onlarca kez çalıştığı için mikrosaniyelik takılmalara (input stutter) sebep oluyordu.

### Uygulanan Çözüm:
1. **`client/src/data/turkeyLocations.ts`:** Tüm illerin ilçeleri dosya yüklendiğinde hafızada **yalnızca 1 kez** önceden sıralandı (`PRE_SORTED_DISTRICTS`).
2. **`NewVisitorDialog.tsx`:** İlçe seçimi `useMemo` içine alındı:
   ```typescript
   const availableDistricts = useMemo(
     () => getDistrictsByProvince(originProvince),
     [originProvince]
   );
   ```
3. Artık harfe basıldığında CPU'da 0 işlem yapılıyor; anında `O(1)` hızla tepki veriyor.

---

## 2. State Yönetim Stratejisi: React Query vs. Yerel State

Modern frontend mimarisinde state'ler kesin sınırlarla ikiye ayrılmalıdır:

### ❌ Form Inputlarında React Query Kullanılmamalıdır (Client State):
* Yazı yazılan input alanlarının `value` değerlerini doğrudan React Query cache'ine bağlamak **gecikmeyi daha da artırır**.
* Çünkü React Query asenkron bir *Server State* yöneticisidir. Inputların anlık değeri yerel `useState` olarak kalmalı, form "Kaydet" dendiğinde tek seferde sunucuya iletilmelidir.

### ✅ Sunucu İletişimi ve Listelemede React Query Şarttır (Server State):
Backend API endpoint'leri bağlandığında React Query şu şekilde kurgulanacaktır:
1. **`useQuery(["visitors"])`:**
   * Güvenlik ekranındaki "İçerideki Ziyaretçiler" listesini sunucudan çekecektir.
   * `refetchInterval: 5000` (5 saniyede bir polling) verilerek, bir ziyaretçi dış kapıdaki QR kodu okutup formunu gönderdiği anda güvenlik görevlisinin ekranına **sayfayı yenilemeden otomatik düşmesi** sağlanacaktır.
2. **`useMutation`:**
   * Güvenlik ekranından veya QR ekranından "Ziyaretçiyi Kaydet" butonuna basıldığında `POST /api/visitors` çalışacak ve `queryClient.invalidateQueries({ queryKey: ["visitors"] })` tetiklenerek tablo anında güncellenecektir.
   * Çıkış işleminde `PUT /api/visitors/:id/exit` çalışacak ve aynı şekilde cache geçersiz kılınacaktır.

---

## 3. Debounce Kullanım Prensipleri

* **Form Girdilerinde:** Debounce kullanılmaz (kullanıcı yazdığı harfi anında 0 ms'de ekranda görmelidir).
* **Arama Kutusunda:** `VisitorTrackingPage` üzerindeki arama kutusuna **`useDebounce(searchTerm, 250)`** entegre edilmiştir. Güvenlik görevlisi arama kutusuna harfleri hızlıca yazarken ekran takılmaz; yazma durduktan 250 ms sonra liste akıcı şekilde süzülür.

---

## 4. İleride Ele Alınacak Notlar / Yol Haritası
- [ ] Backend `Visitor` Sequelize modeli ve `visitors` veritabanı tablosunun oluşturulması (`server/src/models/Visitor.ts`).
- [ ] `/api/visitors` CRUD route ve controller yapısının kurulması.
- [ ] Frontend'deki yerel state'in `useQuery` ve `useMutation` (React Query) kancalarına bağlanması.
- [ ] QR kod ile dışarıdan gelen ziyaretçinin formunu tamamladığında güvenliğe WebSocket veya polling ile anlık bildirim düşmesi.
