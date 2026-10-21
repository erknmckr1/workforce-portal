/**
 * Midas Ziyaretçi Giriş Formu - Yapılandırma Dosyası
 * 
 * Bu form farklı bir domainde veya hostingde barındırılacağı zaman,
 * sadece aşağıdaki API_BASE_URL adresini ana portal sunucunuzun API adresine
 * (örn: "https://portal.midas.com.tr/api" veya "http://192.168.0.77:3003/api")
 * yönlendirmeniz yeterlidir.
 */
window.VISITOR_CONFIG = {
  // Backend API Adresi (Ana sunucuya bağlanır)
  API_BASE_URL: (function() {
    // Eğer aynı sunucu üzerinden /qr altında çalışıyorsa otomatik aynı origin'i kullan
    if (window.location.port === "3003" || window.location.pathname.startsWith("/qr")) {
      return window.location.origin + "/api";
    }
    // Farklı bir domain/port üzerinden çalışıyorsa varsayılan API adresi
    return "http://localhost:3003/api";
  })(),

  // Kurumsal Bilgiler
  COMPANY_NAME: "Midas Hediyelik Eşya",
  COMPANY_FULL_NAME: "Midas Hediyelik Eşya San. ve Tic. A.Ş.",
  PORTAL_TITLE: "Ziyaretçi Giriş ve Bilgilendirme Sistemi",
  
  // Varsayılan İl ve İlçe
  DEFAULT_PROVINCE: "İstanbul",
  DEFAULT_DISTRICT: "Bahçelievler"
};
