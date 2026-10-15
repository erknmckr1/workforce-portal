import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import type { IVisitorContact } from "@/types/visitorContact";
import { PROVINCE_NAMES, getDistrictsByProvince } from "@/data/turkeyLocations";
import { 
  TRANSPORT_MODES, 
  VEHICLE_TRANSPORT_MODES 
} from "@/types/visitor";
import type { TransportMode, CreateVisitorDTO, CompanionDTO } from "@/types/visitor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  User, 
  Building2, 
  Phone, 
  Car, 
  ShieldCheck, 
  Star, 
  CheckCircle2, 
  AlertCircle,
  Users,
  Flame,
  Camera,
  HardHat,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const COMMON_DEPARTMENTS = [
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

const COMMON_PURPOSES = [
  "Toplantı / Görüşme",
  "Mal Kabul / Teslimat",
  "Teknik Servis / Bakım",
  "İş Görüşmesi / Mülakat",
  "Denetim / Kontrol",
  "Ziyaret",
  "Diğer",
];

export default function VisitorRegisterPage() {
  // Form State
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");

  // İki Yönlü Bölüm & Kişi Eşleşmesi
  const [visitedDepartment, setVisitedDepartment] = useState("");
  const [visitedPerson, setVisitedPerson] = useState("");
  const [personSearchQuery, setPersonSearchQuery] = useState("");
  const [isPersonDropdownOpen, setIsPersonDropdownOpen] = useState(false);
  const personDropdownRef = useRef<HTMLDivElement>(null);

  const [visitPurpose, setVisitPurpose] = useState("");

  // Lokasyon & Ulaşım
  const [originProvince, setOriginProvince] = useState<string>("İstanbul");
  const [originDistrict, setOriginDistrict] = useState<string>("Bahçelievler");
  const [transportMode, setTransportMode] = useState<TransportMode>("Otomobil");
  const [vehiclePassengerCount, setVehiclePassengerCount] = useState<string>("1");
  const [licensePlate, setLicensePlate] = useState<string>("");
  const [companions, setCompanions] = useState<CompanionDTO[]>([]);

  // KVKK Onay
  const [kvkkAccepted, setKvkkAccepted] = useState(false);

  // Gönderim & Başarı Durumu
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedVisitor, setSubmittedVisitor] = useState<{
    fullName: string;
    visited: string;
    entryTime: string;
  } | null>(null);

  // Click outside listener for dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        personDropdownRef.current &&
        !personDropdownRef.current.contains(event.target as Node)
      ) {
        setIsPersonDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Aktif Yetkili Kişileri ve Departmanları Getir
  const { data: contactsData } = useQuery({
    queryKey: ["visitor-contacts-active"],
    queryFn: async () => {
      const res = await apiClient.get("/visitor-contacts/active");
      return res.data as {
        success: boolean;
        contacts: IVisitorContact[];
        departments: string[];
        defaultByDepartment: Record<string, string>;
      };
    },
    staleTime: 1000 * 60 * 2,
  });

  const activeDepartments = useMemo(() => {
    const definedDepts = contactsData?.departments || [];
    if (definedDepts.length > 0) return definedDepts;
    return COMMON_DEPARTMENTS;
  }, [contactsData?.departments]);

  const departmentContacts = useMemo(() => {
    if (!contactsData?.contacts || !visitedDepartment) return [];
    return contactsData.contacts.filter(
      (c) => c.departmentName.trim().toLowerCase() === visitedDepartment.trim().toLowerCase()
    );
  }, [contactsData?.contacts, visitedDepartment]);

  const filteredPersonSuggestions = useMemo(() => {
    const all = contactsData?.contacts || [];
    const query = personSearchQuery.trim().toLowerCase();

    let list = visitedDepartment.trim()
      ? all.filter(
          (c) => c.departmentName.trim().toLowerCase() === visitedDepartment.trim().toLowerCase()
        )
      : all;

    if (!query) return list;

    return list.filter(
      (c) =>
        c.fullName.toLowerCase().includes(query) ||
        (c.phoneExtension && c.phoneExtension.includes(query)) ||
        (!visitedDepartment && c.departmentName.toLowerCase().includes(query))
    );
  }, [contactsData?.contacts, visitedDepartment, personSearchQuery]);

  // Departman seçimi
  const handleDepartmentChange = (dept: string) => {
    setVisitedDepartment(dept);

    const inDept = (contactsData?.contacts || []).filter(
      (c) => c.departmentName.trim().toLowerCase() === dept.trim().toLowerCase()
    );

    const defaultPerson = inDept.find((c) => c.isDefault) || inDept[0];
    if (defaultPerson) {
      setVisitedPerson(defaultPerson.fullName);
      setPersonSearchQuery(defaultPerson.fullName);
    } else {
      setVisitedPerson("");
      setPersonSearchQuery("");
    }
    setIsPersonDropdownOpen(false);
  };

  // Kişi seçimi
  const handlePersonSelect = (contact: IVisitorContact) => {
    setVisitedPerson(contact.fullName);
    setPersonSearchQuery(contact.fullName);
    setVisitedDepartment(contact.departmentName);
    setIsPersonDropdownOpen(false);
  };

  const handlePersonInputChange = (val: string) => {
    setPersonSearchQuery(val);
    setVisitedPerson(val);
    setIsPersonDropdownOpen(true);
  };

  // İl / İlçe
  const availableDistricts = useMemo(
    () => getDistrictsByProvince(originProvince),
    [originProvince]
  );

  const handleProvinceChange = (newProvince: string) => {
    setOriginProvince(newProvince);
    const districts = getDistrictsByProvince(newProvince);
    setOriginDistrict(districts[0] || "");
  };

  // Ulaşım
  const isVehicleTransport = VEHICLE_TRANSPORT_MODES.includes(transportMode);

  const handlePassengerCountChange = (val: string) => {
    setVehiclePassengerCount(val);
    const count = parseInt(val, 10);
    if (!isNaN(count) && count > 1) {
      const needed = Math.min(count - 1, 49);
      setCompanions((prev) => {
        const next = [...prev];
        while (next.length < needed) {
          next.push({ fullName: "", phone: "" });
        }
        return next.slice(0, needed);
      });
    } else {
      setCompanions([]);
    }
  };

  const handleCompanionChange = (index: number, field: "fullName" | "phone", value: string) => {
    setCompanions((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], [field]: value };
      }
      return next;
    });
  };

  // Gönderim
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.error("Lütfen Ad ve Soyadınızı giriniz.");
      return;
    }

    const finalVisited = [visitedDepartment.trim(), visitedPerson.trim()]
      .filter(Boolean)
      .join(" - ");

    if (!finalVisited) {
      toast.error("Lütfen Görüşülecek Kişi veya Bölüm bilgisini belirtiniz.");
      return;
    }

    if (isVehicleTransport) {
      if (!licensePlate.trim()) {
        toast.error("Araçla gelen ziyaretçiler için Araç Plakası zorunludur.");
        return;
      }
      const count = parseInt(vehiclePassengerCount, 10);
      if (count > 1) {
        for (let i = 0; i < companions.length; i++) {
          if (!companions[i].fullName.trim()) {
            toast.error(`Lütfen araçtaki ${i + 2}. yolcunun Ad ve Soyadını giriniz.`);
            return;
          }
        }
      }
    }

    if (!kvkkAccepted) {
      toast.error("Lütfen Ziyaretçi Aydınlatma Metni ve İSG kurallarını onaylayınız.");
      return;
    }

    const payload: CreateVisitorDTO = {
      fullName: fullName.trim(),
      company: company.trim() || undefined,
      phone: phone.trim() || undefined,
      visitedPersonOrDept: finalVisited,
      visitPurpose: visitPurpose.trim() || undefined,
      originProvince,
      originDistrict,
      transportMode,
      vehiclePassengerCount: isVehicleTransport ? parseInt(vehiclePassengerCount, 10) : undefined,
      licensePlate: isVehicleTransport ? licensePlate.trim().toUpperCase() : undefined,
      source: "QR – Ziyaretçi Kaydı",
      companions: isVehicleTransport && companions.length > 0
        ? companions.map((c) => ({
            fullName: c.fullName.trim(),
            phone: c.phone?.trim() || undefined,
          }))
        : undefined,
    };

    try {
      setIsSubmitting(true);
      await apiClient.post("/visitors", payload);
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      setSubmittedVisitor({
        fullName: fullName.trim(),
        visited: finalVisited,
        entryTime: timeStr,
      });
      toast.success("Ziyaretçi kaydınız başarıyla oluşturuldu.");
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      toast.error(errorObj?.response?.data?.message || "Kayıt işlemi sırasında bir hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFullName("");
    setCompany("");
    setPhone("");
    setVisitedDepartment("");
    setVisitedPerson("");
    setPersonSearchQuery("");
    setVisitPurpose("");
    setOriginProvince("İstanbul");
    setOriginDistrict("Bahçelievler");
    setTransportMode("Otomobil");
    setVehiclePassengerCount("1");
    setLicensePlate("");
    setCompanions([]);
    setKvkkAccepted(false);
    setSubmittedVisitor(null);
  };

  // ==========================================
  // BAŞARI EKRANI (KAYIT TAMAMLANDI)
  // ==========================================
  if (submittedVisitor) {
    return (
      <div className="space-y-6 text-center py-2 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
          <CheckCircle2 size={36} />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-black text-foreground">Kayıt Başarıyla Alındı</h2>
          <p className="text-xs text-muted-foreground font-medium">
            Giriş bilginiz güvenlik terminaline iletildi.
          </p>
        </div>

        {/* Özet Kartı */}
        <div className="bg-muted/40 border border-border/80 rounded-2xl p-4 text-left space-y-2 text-xs">
          <div className="flex justify-between items-center py-1 border-b border-border/50">
            <span className="text-muted-foreground font-semibold">Ziyaretçi:</span>
            <span className="font-bold text-foreground">{submittedVisitor.fullName}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-border/50">
            <span className="text-muted-foreground font-semibold">Görüşülecek:</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">{submittedVisitor.visited}</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-muted-foreground font-semibold">Giriş Saati:</span>
            <span className="font-mono font-bold text-foreground">{submittedVisitor.entryTime}</span>
          </div>
        </div>

        {/* Tesis Kuralları Hatırlatma */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-left space-y-2.5">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-black text-xs uppercase tracking-wider">
            <AlertCircle size={15} />
            <span>Fabrika Ziyaret Kuralları</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-muted-foreground font-semibold">
            <div className="flex items-center gap-1.5">
              <HardHat size={14} className="text-amber-500 shrink-0" />
              <span>Üretim alanlarında baret ve yelek takınız.</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Camera size={14} className="text-amber-500 shrink-0" />
              <span>İzinsiz fotoğraf ve video çekimi yasaktır.</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Flame size={14} className="text-amber-500 shrink-0" />
              <span>Sadece belirlenmiş sigara alanlarını kullanınız.</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Car size={14} className="text-amber-500 shrink-0" />
              <span>Fabrika sahasında azami hız 20 km/s'dir.</span>
            </div>
          </div>
        </div>

        <Button
          onClick={handleReset}
          className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs uppercase tracking-wider gap-2 cursor-pointer"
        >
          <span>Yeni Ziyaretçi Kaydı Yap</span>
          <ArrowRight size={14} />
        </Button>
      </div>
    );
  }

  // ==========================================
  // KAYIT FORMU
  // ==========================================
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Üst Bilgilendirme */}
      <div className="text-center pb-2 border-b border-border/60">
        <h2 className="text-lg font-black text-foreground">Ziyaretçi Giriş Formu</h2>
        <p className="text-xs text-muted-foreground font-medium mt-0.5">
          Lütfen tesisimize giriş için gerekli bilgileri doldurunuz.
        </p>
      </div>

      {/* 1. Ad Soyad */}
      <div className="space-y-1">
        <Label className="text-xs font-bold text-foreground flex items-center gap-1">
          Adınız Soyadınız <span className="text-destructive font-black">*</span>
        </Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={15} />
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Örn: Ahmet Yılmaz"
            className="h-11 pl-9 rounded-xl font-bold text-sm bg-background border-border/80"
            required
          />
        </div>
      </div>

      {/* 2. Firma & Telefon (2 Sütun) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
            Firma / Kurum <span className="text-[10px] font-normal">(Opsiyonel)</span>
          </Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={15} />
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Örn: ABC Ltd."
              className="h-11 pl-9 rounded-xl font-semibold text-sm bg-background border-border/80"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
            Telefon <span className="text-[10px] font-normal">(Opsiyonel)</span>
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={15} />
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05XX XXX XX XX"
              type="tel"
              className="h-11 pl-9 rounded-xl font-semibold text-sm bg-background border-border/80"
            />
          </div>
        </div>
      </div>

      {/* 3. İKİ YÖNLÜ BÖLÜM VE GÖRÜŞÜLECEK KİŞİ */}
      <div className="space-y-2 p-3 rounded-2xl bg-muted/30 border border-border/70">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Bölüm / Departman */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                Görüşülecek Bölüm <span className="text-destructive font-black">*</span>
              </Label>
              {visitedDepartment && (
                <button
                  type="button"
                  onClick={() => {
                    setVisitedDepartment("");
                    setVisitedPerson("");
                    setPersonSearchQuery("");
                  }}
                  className="text-[10px] text-muted-foreground hover:text-destructive font-semibold cursor-pointer"
                >
                  Sıfırla
                </button>
              )}
            </div>
            <Select value={visitedDepartment} onValueChange={handleDepartmentChange}>
              <SelectTrigger className="h-11 rounded-xl font-bold text-sm bg-background border-border/80">
                <SelectValue placeholder="Bölüm Seçiniz" />
              </SelectTrigger>
              <SelectContent className="max-h-60 rounded-xl">
                {activeDepartments.map((dept) => {
                  const count = (contactsData?.contacts || []).filter(
                    (c) => c.departmentName.trim().toLowerCase() === dept.trim().toLowerCase()
                  ).length;
                  return (
                    <SelectItem key={dept} value={dept} className="font-semibold text-xs">
                      <div className="flex items-center justify-between w-full gap-2">
                        <span>{dept}</span>
                        {count > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-mono">
                            {count} kişi
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Görüşülecek Kişi */}
          <div className="space-y-1 relative" ref={personDropdownRef}>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                Görüşülecek Kişi <span className="text-destructive font-black">*</span>
              </Label>
              {visitedPerson && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                  <ShieldCheck size={11} /> Onaylandı
                </span>
              )}
            </div>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" size={15} />
              <Input
                value={personSearchQuery}
                onChange={(e) => handlePersonInputChange(e.target.value)}
                onFocus={() => setIsPersonDropdownOpen(true)}
                placeholder={visitedDepartment ? `${visitedDepartment} yetkilisi...` : "İsim ile arayın..."}
                className="h-11 pl-9 pr-8 rounded-xl font-bold text-sm bg-background border-border/80"
                required
              />
              {personSearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setPersonSearchQuery("");
                    setVisitedPerson("");
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground text-xs p-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Öneri Listesi */}
            {isPersonDropdownOpen && filteredPersonSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover text-popover-foreground border border-border/80 rounded-xl shadow-xl z-50 overflow-hidden max-h-52 overflow-y-auto py-1">
                <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground bg-muted/30 border-b border-border/40 flex items-center justify-between">
                  <span>Yetkili Personeller</span>
                  <span className="font-mono">{filteredPersonSuggestions.length} kişi</span>
                </div>
                {filteredPersonSuggestions.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handlePersonSelect(contact);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors flex items-center justify-between gap-2 border-b border-border/30 last:border-b-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 text-xs font-bold">
                        {contact.fullName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-foreground truncate flex items-center gap-1.5">
                          <span>{contact.fullName}</span>
                          {contact.isDefault && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-extrabold">
                              Varsayılan
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {contact.departmentName}
                        </div>
                      </div>
                    </div>
                    {contact.phoneExtension && (
                      <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        Dah: {contact.phoneExtension}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Hızlı Seçim Butonları (Pill Buttons) */}
        {departmentContacts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Hızlı Seçim:
            </span>
            {departmentContacts.map((c) => {
              const isSelected = visitedPerson.trim().toLowerCase() === c.fullName.trim().toLowerCase();
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setVisitedPerson(c.fullName);
                    setPersonSearchQuery(c.fullName);
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer active:scale-95",
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-background hover:bg-muted text-foreground border-border/80"
                  )}
                >
                  {c.isDefault && (
                    <Star
                      size={11}
                      className={isSelected ? "text-amber-300 fill-amber-300" : "text-amber-500 fill-amber-500"}
                    />
                  )}
                  <span>{c.fullName}</span>
                  {c.phoneExtension && (
                    <span className={cn("text-[10px] font-mono", isSelected ? "text-indigo-100" : "text-muted-foreground")}>
                      ({c.phoneExtension})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Ziyaret Amacı */}
      <div className="space-y-1">
        <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
          Ziyaret Amacı <span className="text-[10px] font-normal">(Opsiyonel)</span>
        </Label>
        <Input
          value={visitPurpose}
          onChange={(e) => setVisitPurpose(e.target.value)}
          placeholder="Örn: Toplantı, Mal Kabul, Teknik Servis..."
          className="h-11 rounded-xl font-semibold text-sm bg-background border-border/80"
          list="qr-purposes"
        />
        <datalist id="qr-purposes">
          {COMMON_PURPOSES.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>

      {/* 5. Gelinen Lokasyon (İl ve İlçe) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs font-bold text-foreground flex items-center gap-1">
            Gelinen İl <span className="text-destructive font-black">*</span>
          </Label>
          <Select value={originProvince} onValueChange={handleProvinceChange}>
            <SelectTrigger className="h-11 rounded-xl font-bold text-sm bg-background border-border/80">
              <SelectValue placeholder="İl Seçiniz" />
            </SelectTrigger>
            <SelectContent className="max-h-60 rounded-xl">
              {PROVINCE_NAMES.map((prov) => (
                <SelectItem key={prov} value={prov} className="font-semibold text-xs">
                  {prov}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-bold text-foreground flex items-center gap-1">
            Gelinen İlçe <span className="text-destructive font-black">*</span>
          </Label>
          <Select value={originDistrict} onValueChange={setOriginDistrict}>
            <SelectTrigger className="h-11 rounded-xl font-bold text-sm bg-background border-border/80">
              <SelectValue placeholder="İlçe Seçiniz" />
            </SelectTrigger>
            <SelectContent className="max-h-60 rounded-xl">
              {availableDistricts.map((dist) => (
                <SelectItem key={dist} value={dist} className="font-semibold text-xs">
                  {dist}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 6. Ulaşım Şekli */}
      <div className="space-y-1">
        <Label className="text-xs font-bold text-foreground flex items-center gap-1">
          Ulaşım Şekli <span className="text-destructive font-black">*</span>
        </Label>
        <Select
          value={transportMode}
          onValueChange={(val: TransportMode) => {
            setTransportMode(val);
            if (!VEHICLE_TRANSPORT_MODES.includes(val)) {
              setLicensePlate("");
              setVehiclePassengerCount("1");
              setCompanions([]);
            }
          }}
        >
          <SelectTrigger className="h-11 rounded-xl font-bold text-sm bg-background border-border/80">
            <SelectValue placeholder="Ulaşım Şekli Seçiniz" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {TRANSPORT_MODES.map((mode) => (
              <SelectItem key={mode} value={mode} className="font-semibold text-xs">
                {mode}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 7. Araç Bilgileri (Eğer Araçlı Ulaşım İse) */}
      {isVehicleTransport && (
        <div className="p-3.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                Araç Plakası <span className="text-destructive font-black">*</span>
              </Label>
              <Input
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                placeholder="Örn: 34 ABC 123"
                className="h-11 rounded-xl font-black uppercase text-sm tracking-wider bg-background border-border/80"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                Araçtaki Kişi Sayısı <span className="text-destructive font-black">*</span>
              </Label>
              <Select value={vehiclePassengerCount} onValueChange={handlePassengerCountChange}>
                <SelectTrigger className="h-11 rounded-xl font-bold text-sm bg-background border-border/80">
                  <SelectValue placeholder="Kişi Sayısı" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((num) => (
                    <SelectItem key={num} value={String(num)} className="font-semibold text-xs">
                      {num} Kişi {num === 1 ? "(Sadece Siz)" : `(Siz + ${num - 1} Yolcu)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Araçtaki Ek Yolcular */}
          {companions.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-indigo-500/10">
              <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                <Users size={13} />
                <span>Araçtaki Diğer Yolcular</span>
              </div>
              {companions.map((comp, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    value={comp.fullName}
                    onChange={(e) => handleCompanionChange(idx, "fullName", e.target.value)}
                    placeholder={`Yolcu ${idx + 1} Adı Soyadı`}
                    className="h-10 text-xs font-semibold rounded-xl bg-background border-border/80"
                    required
                  />
                  <Input
                    value={comp.phone || ""}
                    onChange={(e) => handleCompanionChange(idx, "phone", e.target.value)}
                    placeholder="Telefon (Opsiyonel)"
                    type="tel"
                    className="h-10 text-xs font-semibold rounded-xl bg-background border-border/80"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 8. KVKK & İSG Onay Kutusu */}
      <div className="pt-1">
        <label className="flex items-start gap-2.5 cursor-pointer text-xs text-muted-foreground select-none">
          <input
            type="checkbox"
            checked={kvkkAccepted}
            onChange={(e) => setKvkkAccepted(e.target.checked)}
            className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4 shrink-0"
            required
          />
          <span className="leading-tight">
            Fabrika sahası içerisinde geçerli <strong>İş Sağlığı ve Güvenliği</strong> kurallarına uyacağımı ve <strong>KVKK Aydınlatma Metni</strong>'ni okuyup kabul ettiğimi onaylıyorum.
          </span>
        </label>
      </div>

      {/* Kayıt Butonu */}
      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
      >
        {isSubmitting ? "Kaydediliyor..." : "Ziyaretçi Girişini Tamamla"}
      </Button>
    </form>
  );
}
