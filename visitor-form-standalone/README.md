# Midas Hediyelik Eşya - Ziyaretçi Giriş Formu (Bağımsız HTML / CSS / JS)

Bu paket, misafirlerin fabrika veya ofis girişinde QR kod okutarak kendi telefonlarından dolduracakları **mobil uyumlu Ziyaretçi Giriş Formu**dur. 

Hiçbir framework (React, Vue vb.) veya Node.js bağımlılığı gerektirmez. Saf **HTML5, CSS3 ve Vanilla JavaScript** ile kodlanmıştır.

---

## 📁 Klasör Yapısı

```
visitor-form-standalone/
├── index.html                 # Ana form ve başarı ekranı
├── css/
│   └── style.css              # Mobil öncelikli modern kurumsal tasarım
├── js/
│   ├── config.js              # API adresi ve kurumsal yapılandırma
│   ├── turkeyLocations.js     # 81 İl ve İlçe listesi (Çevrimdışı hazır)
│   └── app.js                 # Akıllı bölüm/kişi eşleşmesi, taksi mantığı, form gönderimi
└── README.md                  # Dağıtım ve kullanım kılavuzu
```

---

## 🚀 1. Yerel Olarak Test Etme

Portal sunucusu çalışırken (`server` port 3003):
* Tarayıcınızda doğrudan: **`http://localhost:3003/qr`** adresine giderek formu anında test edebilirsiniz.
* Aynı WiFi ağındaki bir cep telefonundan: **`http://<BILGISAYAR_IP>:3003/qr`** yazarak mobil deneyimi görebilirsiniz.
* Veya VS Code Live Server vb. herhangi bir yerel sunucu ile açabilirsiniz.

---

## 🌐 2. Farklı Bir Domaine Taşıma ve Yayınlama

Bu formu tamamen farklı bir domain veya hosting altında (Örn: `https://ziyaret.midas.com.tr` veya harici bir web sitesi) yayınlamak için:

1. `visitor-form-standalone` klasöründeki tüm dosyaları hedef hosting/sunucunuzun `public_html` veya web kök dizinine yükleyin.
2. **`js/config.js`** dosyasını açın:
   ```javascript
   window.VISITOR_CONFIG = {
     // Ana portalınızın API adresini buraya yazın:
     API_BASE_URL: "https://portal.midas.com.tr/api", // veya "http://192.168.0.77:3003/api"
     
     COMPANY_NAME: "Midas Hediyelik Eşya",
     // ...
   };
   ```
3. Hepsi bu kadar! Form hedef domain üzerinden çalışacak ve girilen ziyaretçi kayıtları anında ana portalınızdaki Güvenlik Terminali'ne düşecektir.

---

## ✨ İçerdiği Kurallar & Yetenekler

1. **Taksi Mantığı (Madde 1):**
   * Ulaşım şekli "Taksi", "Yaya" veya "Toplu Taşıma" seçildiğinde araç plakası ve yolcu sayısı gizlenir; ziyaretçi sadece bireysel olarak kaydedilir.
2. **İki Yönlü Akıllı Eşleşme (Madde 2):**
   * **Bölüm Seçilirse:** Bölümün varsayılan yetkilisi atanır, personeller o bölümle sınırlandırılır ve hızlı seçim butonları (*pill chips*) belirir.
   * **Kişi Yazılırsa:** İsim veya dahili no'ya göre öneriler çıkar; kişi seçildiğinde bağlı olduğu departman teyit amacıyla otomatik atanır.
3. **Araçlı Girişlerde Ek Yolcular (Madde 3):**
   * Araçlı ulaşımda kişi sayısı 1'den fazla seçildiğinde araçtaki diğer yolcular için Ad Soyad alanları zorunlu olarak açılır ve hepsi içerideki ziyaretçi olarak sisteme kaydedilir.
4. **KVKK Onayı:**
   * 6698 sayılı KVKK kapsamında aydınlatma metni modalı ve onay kutusu içerir.
