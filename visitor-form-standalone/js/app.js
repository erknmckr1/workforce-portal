/**
 * Midas Ziyaretçi Giriş Formu - Ana Mantık ve API Entegrasyonu
 * Tamamen Vanilla JavaScript (Çerçeve veya kütüphane bağımlılığı yoktur)
 */

(function () {
  "use strict";

  // Yapılandırma
  const CONFIG = window.VISITOR_CONFIG || {
    API_BASE_URL: "http://localhost:3003/api",
    DEFAULT_PROVINCE: "İstanbul",
    DEFAULT_DISTRICT: "Bahçelievler",
  };

  // State
  let allContacts = [];
  let allDepartments = [];
  let defaultByDept = {};
  let selectedContact = null;

  // DOM Elemanları
  const form = document.getElementById("visitorForm");
  const successCard = document.getElementById("successCard");
  const submitBtn = document.getElementById("submitBtn");

  const fullNameInput = document.getElementById("fullName");
  const companyInput = document.getElementById("company");
  const phoneInput = document.getElementById("phone");

  const departmentSelect = document.getElementById("departmentSelect");
  const resetDeptBtn = document.getElementById("resetDeptBtn");
  const personInput = document.getElementById("personInput");
  const clearPersonBtn = document.getElementById("clearPersonBtn");
  const personVerifiedBadge = document.getElementById("personVerifiedBadge");
  const personSuggestions = document.getElementById("personSuggestions");
  const popupTitle = document.getElementById("popupTitle");
  const popupCount = document.getElementById("popupCount");
  const popupList = document.getElementById("popupList");
  const pillsContainer = document.getElementById("pillsContainer");
  const pillsList = document.getElementById("pillsList");

  const visitPurposeSelect = document.getElementById("visitPurpose");
  const provinceSelect = document.getElementById("provinceSelect");
  const districtSelect = document.getElementById("districtSelect");

  const transportModeSelect = document.getElementById("transportMode");
  const vehicleBox = document.getElementById("vehicleBox");
  const licensePlateInput = document.getElementById("licensePlate");
  const passengerCountSelect = document.getElementById("passengerCount");
  const companionsContainer = document.getElementById("companionsContainer");
  const companionsList = document.getElementById("companionsList");

  const kvkkCheck = document.getElementById("kvkkCheck");
  const openKvkkModal = document.getElementById("openKvkkModal");
  const closeKvkkModal = document.getElementById("closeKvkkModal");
  const confirmKvkkBtn = document.getElementById("confirmKvkkBtn");
  const kvkkModal = document.getElementById("kvkkModal");

  const newRegBtn = document.getElementById("newRegBtn");
  const toast = document.getElementById("toast");

  // =========================================================================
  // 1. BAŞLANGIÇ YÜKLEMESİ (INIT)
  // =========================================================================
  function init() {
    // Yıl Bilgisi
    const yearSpan = document.getElementById("yearSpan");
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();

    // İlleri ve İlçeleri Doldur
    initLocationSelects();

    // Ulaşım Modu Değişimi Dinleyicisi
    initTransportMode();

    // Telefon Maskesi Dinleyicisi
    initPhoneFormatter();

    // KVKK Modal Dinleyicileri
    initKvkkModal();

    // Form Gönderim & Yenileme Dinleyicileri
    form.addEventListener("submit", handleFormSubmit);
    newRegBtn.addEventListener("click", resetToNewForm);

    // Dışarı tıklayınca öneri açılır kutusunu kapat
    document.addEventListener("click", function (e) {
      if (!personSuggestions.contains(e.target) && e.target !== personInput) {
        closeSuggestions();
      }
    });

    // API'den Yetkili Personel ve Departmanları Çek
    fetchActiveContacts();
  }

  // =========================================================================
  // 2. LOKASYON SEÇİMLERİ (İL & İLÇE)
  // =========================================================================
  function initLocationSelects() {
    const provinces = window.PROVINCE_NAMES || [];
    provinceSelect.innerHTML = '<option value="">İl Seçiniz...</option>';

    provinces.forEach(function (prov) {
      const opt = document.createElement("option");
      opt.value = prov;
      opt.textContent = prov;
      if (prov === CONFIG.DEFAULT_PROVINCE) opt.selected = true;
      provinceSelect.appendChild(opt);
    });

    updateDistricts(CONFIG.DEFAULT_PROVINCE, CONFIG.DEFAULT_DISTRICT);

    provinceSelect.addEventListener("change", function () {
      updateDistricts(this.value, "");
    });
  }

  function updateDistricts(provinceName, selectDistrictName) {
    districtSelect.innerHTML = '<option value="">İlçe Seçiniz...</option>';
    if (!provinceName || typeof window.getDistrictsByProvince !== "function") return;

    const districts = window.getDistrictsByProvince(provinceName);
    districts.forEach(function (dist) {
      const opt = document.createElement("option");
      opt.value = dist;
      opt.textContent = dist;
      if (dist === selectDistrictName) opt.selected = true;
      districtSelect.appendChild(opt);
    });
  }

  // =========================================================================
  // 3. TELEFON FORMATLAMA
  // =========================================================================
  function initPhoneFormatter() {
    phoneInput.addEventListener("input", function (e) {
      let x = e.target.value.replace(/\D/g, "").match(/(\d{0,4})(\d{0,3})(\d{0,2})(\d{0,2})/);
      if (!x[2]) {
        e.target.value = x[1];
      } else {
        e.target.value = !x[3]
          ? x[1] + " " + x[2]
          : !x[4]
          ? x[1] + " " + x[2] + " " + x[3]
          : x[1] + " " + x[2] + " " + x[3] + " " + x[4];
      }
    });
  }

  // =========================================================================
  // 4. ULAŞIM ŞEKLİ & ARAÇTAKİ EK YOLCULAR (MADDE 1 & MADDE 3)
  // =========================================================================
  const VEHICLE_MODES = ["Otomobil", "Motosiklet", "Servis"];

  function initTransportMode() {
    transportModeSelect.addEventListener("change", function () {
      const mode = this.value;

      // MADDE 1: Taksi, Yaya veya Toplu Taşıma seçilirse plaka ve kişi sayısı GİZLENİR
      if (!VEHICLE_MODES.includes(mode)) {
        vehicleBox.classList.remove("active");
        licensePlateInput.value = "";
        passengerCountSelect.value = "1";
        renderCompanions(1);
      } else {
        // Araçlı ulaşım ise kutuyu göster
        vehicleBox.classList.add("active");
      }
    });

    // MADDE 3: Kişi sayısı 1'den fazla seçilirse dinamik yolcu formu açılır ve zorunlu tutulur
    passengerCountSelect.addEventListener("change", function () {
      const count = parseInt(this.value, 10) || 1;
      renderCompanions(count);
    });
  }

  function renderCompanions(count) {
    companionsList.innerHTML = "";
    if (count <= 1) {
      companionsContainer.style.display = "none";
      return;
    }

    companionsContainer.style.display = "block";
    const needed = count - 1; // 1 kişi sürücü/ana ziyaretçi, kalanlar yolcu

    for (let i = 0; i < needed; i++) {
      const row = document.createElement("div");
      row.className = "companion-row";
      row.innerHTML = `
        <input type="text" class="form-input no-icon companion-name" placeholder="Yolcu ${i + 1} Adı Soyadı *" required>
        <input type="tel" class="form-input no-icon companion-phone" placeholder="Telefon (Opsiyonel)" maxlength="14">
      `;
      companionsList.appendChild(row);
    }
  }

  // =========================================================================
  // 5. YETKİLİ PERSONEL VE BÖLÜM ÇEKME (API ENTEGRASYONU)
  // =========================================================================
  async function fetchActiveContacts() {
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/visitor-contacts/active`);
      if (!res.ok) throw new Error("API yanıt vermedi");
      const data = await res.json();

      if (data && data.success) {
        allContacts = data.contacts || [];
        allDepartments = data.departments || [];
        defaultByDept = data.defaultByDepartment || {};
        populateDepartmentSelect(allDepartments);
        initTwoWayMatching();
      } else {
        fallbackToDefaultDepartments();
      }
    } catch (err) {
      console.warn("Ziyaretçi yetkili kişileri çekilemedi, varsayılan liste kullanılıyor:", err);
      fallbackToDefaultDepartments();
    }
  }

  function fallbackToDefaultDepartments() {
    const common = [
      "Satınalma",
      "İnsan Kaynakları",
      "Bilgi İşlem",
      "Muhasebe & Finans",
      "Kalite Güvence",
      "Üretim",
      "Planlama & Lojistik",
      "Teknik Bakım",
      "Yönetim",
    ];
    allDepartments = common;
    allContacts = [];
    populateDepartmentSelect(common);
    initTwoWayMatching();
  }

  function populateDepartmentSelect(depts) {
    departmentSelect.innerHTML = '<option value="">Bölüm Seçiniz...</option>';
    depts.forEach(function (dept) {
      const count = allContacts.filter(
        (c) => c.departmentName.trim().toLowerCase() === dept.trim().toLowerCase()
      ).length;
      const opt = document.createElement("option");
      opt.value = dept;
      opt.textContent = count > 0 ? `${dept} (${count} kişi)` : dept;
      departmentSelect.appendChild(opt);
    });
  }

  // =========================================================================
  // 6. İKİ YÖNLÜ BÖLÜM VE KİŞİ AKILLI EŞLEŞMESİ (MADDE 2)
  // =========================================================================
  function initTwoWayMatching() {
    // 1. Bölüm Seçildiğinde (Örn: Satınalma)
    departmentSelect.addEventListener("change", function () {
      const dept = this.value;
      if (!dept) {
        resetDeptBtn.style.display = "none";
        pillsContainer.style.display = "none";
        pillsList.innerHTML = "";
        personVerifiedBadge.style.display = "none";
        return;
      }

      resetDeptBtn.style.display = "inline-block";

      // O bölümdeki personeller
      const inDept = allContacts.filter(
        (c) => c.departmentName.trim().toLowerCase() === dept.trim().toLowerCase()
      );

      // Varsayılan personel ata (isDefault veya ilk kişi)
      const defaultPerson = inDept.find((c) => c.isDefault) || inDept[0];
      if (defaultPerson) {
        selectContact(defaultPerson, false); // Formda otomatik göster
      } else {
        personInput.value = "";
        selectedContact = null;
        personVerifiedBadge.style.display = "none";
      }

      // Bölüme ait personellerin hızlı butonlarını (pills) çiz
      renderDepartmentPills(inDept);
    });

    // Sıfırla Butonu
    resetDeptBtn.addEventListener("click", function () {
      departmentSelect.value = "";
      personInput.value = "";
      selectedContact = null;
      resetDeptBtn.style.display = "none";
      clearPersonBtn.style.display = "none";
      personVerifiedBadge.style.display = "none";
      pillsContainer.style.display = "none";
      pillsList.innerHTML = "";
      closeSuggestions();
    });

    // 2. Kişi Yazıldığında / Odaklandığında
    personInput.addEventListener("input", function () {
      const val = this.value.trim();
      clearPersonBtn.style.display = val ? "block" : "none";
      personVerifiedBadge.style.display = "none";
      selectedContact = null;
      renderSuggestions(val);
    });

    personInput.addEventListener("focus", function () {
      renderSuggestions(this.value.trim());
    });

    clearPersonBtn.addEventListener("click", function () {
      personInput.value = "";
      selectedContact = null;
      clearPersonBtn.style.display = "none";
      personVerifiedBadge.style.display = "none";
      renderSuggestions("");
    });
  }

  // Öneri Açılır Listesini Çiz
  function renderSuggestions(query) {
    const selectedDept = departmentSelect.value.trim().toLowerCase();
    const qLower = query.toLowerCase();

    // Eğer bölüm seçilmişse SADECE o bölümdeki personelleri listele
    let list = selectedDept
      ? allContacts.filter((c) => c.departmentName.trim().toLowerCase() === selectedDept)
      : allContacts;

    if (qLower) {
      list = list.filter(
        (c) =>
          c.fullName.toLowerCase().includes(qLower) ||
          (c.phoneExtension && c.phoneExtension.includes(qLower)) ||
          (!selectedDept && c.departmentName.toLowerCase().includes(qLower))
      );
    }

    if (list.length === 0) {
      closeSuggestions();
      return;
    }

    popupTitle.textContent = selectedDept ? `${departmentSelect.value} Personelleri` : "Yetkili Personeller";
    popupCount.textContent = `${list.length} kişi`;
    popupList.innerHTML = "";

    list.forEach(function (contact) {
      const item = document.createElement("div");
      item.className = "popup-item";
      item.innerHTML = `
        <div class="item-left">
          <div class="avatar-initial">${contact.fullName.charAt(0)}</div>
          <div>
            <div class="item-name">
              ${contact.fullName}
              ${contact.isDefault ? '<span class="default-tag">Varsayılan</span>' : ""}
            </div>
            <div class="item-dept">${contact.departmentName} ${contact.title ? "• " + contact.title : ""}</div>
          </div>
        </div>
        ${contact.phoneExtension ? `<span class="item-ext">Dah: ${contact.phoneExtension}</span>` : ""}
      `;

      item.addEventListener("mousedown", function (e) {
        e.preventDefault();
        selectContact(contact, true);
        closeSuggestions();
      });

      popupList.appendChild(item);
    });

    personSuggestions.classList.add("active");
  }

  function closeSuggestions() {
    personSuggestions.classList.remove("active");
  }

  // Kişi Seçildiğinde (Teyit olarak Bölüm Otomatik Atanır)
  function selectContact(contact, shouldUpdateDept) {
    selectedContact = contact;
    personInput.value = contact.fullName;
    clearPersonBtn.style.display = "block";
    personVerifiedBadge.style.display = "inline";

    if (shouldUpdateDept && contact.departmentName) {
      // Formda ziyaretçiye teyit sağlamak için bölümü otomatik seç
      departmentSelect.value = contact.departmentName;
      resetDeptBtn.style.display = "inline-block";

      // O bölümdeki personellerin butonlarını güncelle
      const inDept = allContacts.filter(
        (c) => c.departmentName.trim().toLowerCase() === contact.departmentName.trim().toLowerCase()
      );
      renderDepartmentPills(inDept);
    } else {
      updateActivePill(contact.fullName);
    }
  }

  // Bölüme Ait Hızlı Butonları Çiz
  function renderDepartmentPills(contacts) {
    pillsList.innerHTML = "";
    if (!contacts || contacts.length === 0) {
      pillsContainer.style.display = "none";
      return;
    }

    pillsContainer.style.display = "flex";

    contacts.forEach(function (c) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pill-btn" + (selectedContact && selectedContact.fullName === c.fullName ? " active" : "");
      btn.innerHTML = `
        ${c.isDefault ? '<span class="star-icon">★</span>' : ""}
        <span>${c.fullName}</span>
        ${c.phoneExtension ? `<span class="ext-tag">(${c.phoneExtension})</span>` : ""}
      `;

      btn.addEventListener("click", function () {
        selectContact(c, false);
      });

      pillsList.appendChild(btn);
    });
  }

  function updateActivePill(fullName) {
    const buttons = pillsList.querySelectorAll(".pill-btn");
    buttons.forEach((btn) => {
      if (btn.textContent.includes(fullName)) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  // =========================================================================
  // 7. FORM DOĞRULAMA VE GÖNDERİM
  // =========================================================================
  async function handleFormSubmit(e) {
    e.preventDefault();

    // 1. Temel Doğrulamalar
    const fullName = fullNameInput.value.trim();
    if (!fullName) {
      showToast("Lütfen Ad ve Soyadınızı giriniz.", "error");
      fullNameInput.focus();
      return;
    }

    const dept = departmentSelect.value.trim();
    const person = personInput.value.trim();
    const visited = [dept, person].filter(Boolean).join(" - ");

    if (!visited) {
      showToast("Lütfen Görüşülecek Kişi veya Bölüm belirtiniz.", "error");
      personInput.focus();
      return;
    }

    const originProvince = provinceSelect.value;
    const originDistrict = districtSelect.value;
    if (!originProvince || !originDistrict) {
      showToast("Lütfen gelinen İl ve İlçe bilgisini seçiniz.", "error");
      return;
    }

    const transportMode = transportModeSelect.value;
    const isVehicle = VEHICLE_MODES.includes(transportMode);
    let licensePlate = undefined;
    let passengerCount = undefined;
    let companions = undefined;

    // 2. Araçlı Ulaşım Doğrulamaları
    if (isVehicle) {
      licensePlate = licensePlateInput.value.trim().toUpperCase();
      if (!licensePlate) {
        showToast("Araçla gelen ziyaretçiler için Plaka zorunludur.", "error");
        licensePlateInput.focus();
        return;
      }

      passengerCount = parseInt(passengerCountSelect.value, 10) || 1;

      // Ek yolcular doğrulaması
      if (passengerCount > 1) {
        const nameInputs = companionsList.querySelectorAll(".companion-name");
        const phoneInputs = companionsList.querySelectorAll(".companion-phone");
        companions = [];

        for (let i = 0; i < nameInputs.length; i++) {
          const compName = nameInputs[i].value.trim();
          if (!compName) {
            showToast(`Lütfen araçtaki ${i + 2}. yolcunun Ad ve Soyadını giriniz.`, "error");
            nameInputs[i].focus();
            return;
          }
          companions.push({
            fullName: compName,
            phone: phoneInputs[i]?.value.trim() || undefined,
          });
        }
      }
    }

    // 3. KVKK Onayı
    if (!kvkkCheck.checked) {
      showToast("Lütfen KVKK Aydınlatma Metnini onaylayınız.", "error");
      kvkkCheck.focus();
      return;
    }

    // Payload Hazırla
    const payload = {
      fullName: fullName,
      company: companyInput.value.trim() || undefined,
      phone: phoneInput.value.trim() || undefined,
      visitedPersonOrDept: visited,
      visitPurpose: visitPurposeSelect.value.trim() || undefined,
      originProvince: originProvince,
      originDistrict: originDistrict,
      transportMode: transportMode,
      vehiclePassengerCount: isVehicle ? passengerCount : undefined,
      licensePlate: isVehicle ? licensePlate : undefined,
      source: "QR – Ziyaretçi Kaydı",
      companions: isVehicle && companions && companions.length > 0 ? companions : undefined,
    };

    // Buton Durumu: Loading
    setSubmitting(true);

    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/visitors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && (result.success !== false)) {
        // Kayıt Başarılı: Başarı Ekranını Göster
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

        document.getElementById("resFullName").textContent = fullName;
        document.getElementById("resVisited").textContent = visited;
        document.getElementById("resEntryTime").textContent = timeStr;

        form.style.display = "none";
        successCard.classList.add("active");
        showToast("Ziyaretçi girişiniz başarıyla kaydedildi.", "success");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        throw new Error(result.message || "Kayıt işlemi sunucu tarafından reddedildi.");
      }
    } catch (err) {
      console.error("Kayıt Hatası:", err);
      showToast(err.message || "Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol ediniz.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function setSubmitting(isSubmitting) {
    if (isSubmitting) {
      submitBtn.disabled = true;
      submitBtn.classList.add("loading");
    } else {
      submitBtn.disabled = false;
      submitBtn.classList.remove("loading");
    }
  }

  // =========================================================================
  // 8. YENİ KAYIT FORMU SIFIRLAMA
  // =========================================================================
  function resetToNewForm() {
    form.reset();
    selectedContact = null;
    resetDeptBtn.style.display = "none";
    clearPersonBtn.style.display = "none";
    personVerifiedBadge.style.display = "none";
    pillsContainer.style.display = "none";
    pillsList.innerHTML = "";

    // Varsayılan İl/İlçe
    provinceSelect.value = CONFIG.DEFAULT_PROVINCE;
    updateDistricts(CONFIG.DEFAULT_PROVINCE, CONFIG.DEFAULT_DISTRICT);

    // Varsayılan Ulaşım
    transportModeSelect.value = "Otomobil";
    vehicleBox.classList.add("active");
    passengerCountSelect.value = "1";
    renderCompanions(1);

    successCard.classList.remove("active");
    form.style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // =========================================================================
  // 9. KVKK MODAL & BİLDİRİM TOAST
  // =========================================================================
  function initKvkkModal() {
    openKvkkModal.addEventListener("click", function () {
      kvkkModal.classList.add("active");
    });

    closeKvkkModal.addEventListener("click", function () {
      kvkkModal.classList.remove("active");
    });

    confirmKvkkBtn.addEventListener("click", function () {
      kvkkCheck.checked = true;
      kvkkModal.classList.remove("active");
    });

    kvkkModal.addEventListener("click", function (e) {
      if (e.target === kvkkModal) {
        kvkkModal.classList.remove("active");
      }
    });
  }

  let toastTimeout;
  function showToast(msg, type) {
    clearTimeout(toastTimeout);
    toast.textContent = msg;
    toast.className = `toast-msg show ${type || ""}`;

    toastTimeout = setTimeout(function () {
      toast.classList.remove("show");
    }, 4000);
  }

  // Başlat
  document.addEventListener("DOMContentLoaded", init);
})();
