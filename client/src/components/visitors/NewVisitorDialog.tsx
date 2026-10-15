import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  UserPlus, 
  MapPin, 
  Clock, 
  Building2,
  Phone,
  User,
  Users,
  ShieldCheck,
  CalendarDays,
  FileText,
  Star
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import type { IVisitorContact } from "@/types/visitorContact";
import { cn } from "@/lib/utils";
import { PROVINCE_NAMES, getDistrictsByProvince } from "@/data/turkeyLocations";
import { 
  TRANSPORT_MODES, 
  VEHICLE_TRANSPORT_MODES 
} from "@/types/visitor";
import type { 
  TransportMode, 
  CreateVisitorDTO,
  CompanionDTO
} from "@/types/visitor";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { toast } from "sonner";

interface NewVisitorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (visitorData: CreateVisitorDTO) => void;
}

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

export default function NewVisitorDialog({
  open,
  onOpenChange,
  onSubmit,
}: NewVisitorDialogProps) {
  // Form State
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  
  // Ziyaret Edilen Bölüm & Kişi State (İki Yönlü Akıllı Eşleşme)
  const [visitedDepartment, setVisitedDepartment] = useState("");
  const [visitedPerson, setVisitedPerson] = useState("");
  const [personSearchQuery, setPersonSearchQuery] = useState("");
  const [isPersonDropdownOpen, setIsPersonDropdownOpen] = useState(false);
  const personDropdownRef = React.useRef<HTMLDivElement>(null);

  const [visitPurpose, setVisitPurpose] = useState("");
  
  // Gelinen Lokasyon State (Varsayılan İstanbul)
  const [originProvince, setOriginProvince] = useState<string>("İstanbul");
  const [originDistrict, setOriginDistrict] = useState<string>("Bahçelievler");
  
  // Ulaşım State
  const [transportMode, setTransportMode] = useState<TransportMode>("Otomobil");
  const [vehiclePassengerCount, setVehiclePassengerCount] = useState<string>("1");
  const [licensePlate, setLicensePlate] = useState<string>("");

  // Araçtaki Ek Ziyaretçiler / Yolcular (Kişi Sayısı > 1 ise)
  const [companions, setCompanions] = useState<CompanionDTO[]>([]);

  // Güvenlik Notu (Opsiyonel)
  const [notes, setNotes] = useState<string>("");

  // Otomatik Sistem Zamanı (Giriş) - Modal açıkken saniyelik güncel saat
  const [prevOpen, setPrevOpen] = useState(open);
  const [currentDateTime, setCurrentDateTime] = useState<Date>(() => new Date());

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setCurrentDateTime(new Date());
    }
  }

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [open]);

  // Dışarı tıklayınca kişi öneri açılır kutusunu kapat
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

  // Tanımlı Ziyaretçi Görüşme Personellerini Getir
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
    enabled: open,
  });

  // Kullanılabilir Departmanlar: Ayarlardan gelen tanımlı departmanlar veya genel liste
  const activeDepartments = useMemo(() => {
    const definedDepts = contactsData?.departments || [];
    if (definedDepts.length > 0) {
      return definedDepts;
    }
    return COMMON_DEPARTMENTS;
  }, [contactsData?.departments]);

  // Seçilen departmana ait personeller
  const departmentContacts = useMemo(() => {
    if (!contactsData?.contacts) return [];
    if (!visitedDepartment) return [];
    return contactsData.contacts.filter(
      (c) => c.departmentName.trim().toLowerCase() === visitedDepartment.trim().toLowerCase()
    );
  }, [contactsData?.contacts, visitedDepartment]);

  // Kişi Arama / Öneri Listesi (Kullanıcı yazarken veya odaklandığında)
  const filteredPersonSuggestions = useMemo(() => {
    const all = contactsData?.contacts || [];
    const query = personSearchQuery.trim().toLowerCase();

    // Eğer departman seçilmişse SADECE o departmandaki personeller
    let list = visitedDepartment.trim()
      ? all.filter(
          (c) => c.departmentName.trim().toLowerCase() === visitedDepartment.trim().toLowerCase()
        )
      : all;

    if (!query) {
      return list;
    }

    return list.filter(
      (c) =>
        c.fullName.toLowerCase().includes(query) ||
        (c.phoneExtension && c.phoneExtension.includes(query)) ||
        (!visitedDepartment && c.departmentName.toLowerCase().includes(query))
    );
  }, [contactsData?.contacts, visitedDepartment, personSearchQuery]);

  // 1. Departman Değiştiğinde: Varsayılan personeli otomatik ata ve kişileri o departmana daralt
  const handleDepartmentChange = (dept: string) => {
    setVisitedDepartment(dept);

    const inDept = (contactsData?.contacts || []).filter(
      (c) => c.departmentName.trim().toLowerCase() === dept.trim().toLowerCase()
    );

    // Varsa o departmanın varsayılan yetkilisi atanır
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

  // 2. Kişi Seçildiğinde: Kişiyi ata ve teyit olarak bağlı olduğu departmanı otomatik getir
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

  // İl değiştikçe bağlı ilçeleri güncelle (Performans için useMemo)
  const availableDistricts = useMemo(
    () => getDistrictsByProvince(originProvince),
    [originProvince]
  );

  const handleProvinceChange = (newProvince: string) => {
    setOriginProvince(newProvince);
    const districts = getDistrictsByProvince(newProvince);
    setOriginDistrict(districts[0] || "");
  };

  // Araçla gelindi mi?
  const isVehicleTransport = VEHICLE_TRANSPORT_MODES.includes(transportMode);

  // Araçtaki kişi sayısı değiştikçe ek yolcu alanlarını dinamik senkronize et
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

  // Form Sıfırlama
  const resetForm = () => {
    setFullName("");
    setCompany("");
    setPhone("");
    setVisitedDepartment("");
    setVisitedPerson("");
    setPersonSearchQuery("");
    setIsPersonDropdownOpen(false);
    setVisitPurpose("");
    setOriginProvince("İstanbul");
    setOriginDistrict("Bahçelievler");
    setTransportMode("Otomobil");
    setVehiclePassengerCount("1");
    setLicensePlate("");
    setNotes("");
    setCompanions([]);
  };

  // Form Gönderim
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Zorunlu Alan Kontrolleri
    if (!fullName.trim()) {
      toast.error("Lütfen ziyaretçi Adı ve Soyadını giriniz.");
      return;
    }

    const finalVisited = [visitedDepartment.trim(), visitedPerson.trim()]
      .filter(Boolean)
      .join(" - ");

    if (!finalVisited) {
      toast.error("Lütfen Görüşülecek Kişi veya Bölüm bilgisini belirtiniz.");
      return;
    }

    if (!originProvince || !originDistrict) {
      toast.error("Lütfen hareket edilen İl ve İlçe bilgisini seçiniz.");
      return;
    }

    if (!transportMode) {
      toast.error("Lütfen ulaşım şeklini seçiniz.");
      return;
    }

    // 2. Araçlı Ulaşım Koşullu Kontrolleri
    if (isVehicleTransport) {
      if (!licensePlate.trim()) {
        toast.error("Araçla gelen ziyaretçiler için Plaka zorunludur.");
        return;
      }
      const count = parseInt(vehiclePassengerCount, 10);
      if (isNaN(count) || count < 1) {
        toast.error("Araçtaki kişi sayısı en az 1 olmalıdır.");
        return;
      }
      if (count > 1) {
        for (let i = 0; i < companions.length; i++) {
          if (!companions[i].fullName.trim()) {
            toast.error(`Lütfen araçtaki ${i + 2}. ziyaretçinin (Yolcu ${i + 1}) Ad ve Soyadını giriniz.`);
            return;
          }
        }
      }
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
      notes: notes.trim() || undefined,
      source: "Güvenlik – Manuel Kayıt",
      companions: isVehicleTransport && companions.length > 0
        ? companions.map((c) => ({
            fullName: c.fullName.trim(),
            phone: c.phone?.trim() || undefined,
          }))
        : undefined,
    };

    onSubmit(payload);
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl border border-border bg-card shadow-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col min-h-full">
          {/* STICKY HEADER */}
          <DialogHeader className="sticky top-0 z-20 px-6 py-4 sm:px-8 sm:py-4.5 border-b border-border/70 bg-card/95 backdrop-blur-md shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                  <UserPlus size={22} />
                </div>
                <div className="space-y-0.5">
                  <DialogTitle className="text-lg sm:text-xl font-black text-foreground tracking-tight">
                    Yeni Ziyaretçi Ekle
                  </DialogTitle>
                  <DialogDescription className="text-xs font-semibold text-muted-foreground">
                    Güvenlik Manuel Kayıt Formu • Giriş & Ulaşım Bilgileri
                  </DialogDescription>
                </div>
              </div>

              {/* Otomatik Saat & Kayıt Bilgi Şeridi */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background border border-border/80 text-xs shadow-sm">
                  <CalendarDays size={14} className="text-indigo-500" />
                  <span className="text-muted-foreground font-semibold">Tarih:</span>
                  <span className="font-bold text-foreground">
                    {format(currentDateTime, "d MMMM yyyy", { locale: tr })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background border border-border/80 text-xs shadow-sm">
                  <Clock size={14} className="text-indigo-500" />
                  <span className="text-muted-foreground font-semibold">Giriş Saati:</span>
                  <span className="font-black text-indigo-600 dark:text-indigo-400">
                    {format(currentDateTime, "HH:mm")}
                  </span>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* FORM BODY: 2 SÜTUNLU YAN YANA VE TAM DENGELİ */}
          <div className="p-5 sm:p-6 lg:p-7 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 items-stretch">
            {/* SOL BLOK: ZİYARETÇİ VE GÖRÜŞME DETAYLARI (4 SATIR) */}
            <div className="bg-muted/15 border border-border/70 rounded-2xl p-5 flex flex-col justify-between">
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-border/60">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <User size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-foreground uppercase tracking-wider">
                    Ziyaretçi & Görüşme Bilgileri
                  </h4>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    Kişi, firma ve görüşülecek birim bilgileri
                  </p>
                </div>
              </div>

              <div className="space-y-3 my-auto">
                {/* 1. Satır: Ad Soyad (Tam Genişlik) */}
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                    Ad Soyad <span className="text-destructive font-black">*</span>
                  </Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Örn: Ahmet Yılmaz"
                    className="h-11 rounded-xl bg-background border-border/80 font-bold text-sm"
                    required
                  />
                </div>

                {/* 2. Satır: Firma ve Telefon (2 Sütun) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Firma / Kurum */}
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
                        className="h-11 pl-9 rounded-xl bg-background border-border/80 font-semibold text-sm"
                      />
                    </div>
                  </div>

                  {/* Telefon */}
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
                        className="h-11 pl-9 rounded-xl bg-background border-border/80 font-semibold text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Satır: Görüşülecek Kişi & Bölüm (2 Sütun Responsive Grid + İki Yönlü Akıllı Eşleşme) */}
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 1. Sütun: Bölüm / Departman */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                          Bölüm / Departman <span className="text-destructive font-black">*</span>
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
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none z-10" size={15} />
                        <Select
                          value={visitedDepartment}
                          onValueChange={handleDepartmentChange}
                        >
                          <SelectTrigger className="h-11 pl-9 rounded-xl bg-background border-border/80 font-bold text-sm">
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
                    </div>

                    {/* 2. Sütun: Görüşülecek Kişi (Akıllı Arama / Otomatik Tamamlama) */}
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
                          placeholder={visitedDepartment ? `${visitedDepartment} personeli yazın...` : "İsim ile arayın (Örn: Burak)..."}
                          className="h-11 pl-9 pr-8 rounded-xl bg-background border-border/80 font-bold text-sm"
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

                      {/* Akıllı Açılır Öneri Listesi (Dropdown Suggestions) */}
                      {isPersonDropdownOpen && filteredPersonSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-popover text-popover-foreground border border-border/80 rounded-xl shadow-xl z-50 overflow-hidden max-h-56 overflow-y-auto py-1">
                          <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground bg-muted/30 border-b border-border/40 flex items-center justify-between">
                            <span>
                              {visitedDepartment ? `${visitedDepartment} İlgilileri` : "Ziyaret Edilebilir Personeller"}
                            </span>
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
                                    {contact.departmentName} {contact.title ? `• ${contact.title}` : ""}
                                  </div>
                                </div>
                              </div>
                              {contact.phoneExtension && (
                                <span className="text-[11px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                                  Dah: {contact.phoneExtension}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Seçilen Bölüme Ait Personellerin Hızlı Butonları (Pill Buttons) */}
                  {departmentContacts.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
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
                                : "bg-muted/50 hover:bg-muted text-foreground border-border/70 hover:border-border"
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
                              <span
                                className={cn(
                                  "text-[10px] font-mono px-1 py-0.2 rounded",
                                  isSelected ? "bg-white/20 text-white" : "bg-background text-muted-foreground border border-border/50"
                                )}
                              >
                                {c.phoneExtension}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 4. Satır: Ziyaret Amacı */}
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                    Ziyaret Amacı <span className="text-[10px] font-normal">(Opsiyonel)</span>
                  </Label>
                  <Input
                    value={visitPurpose}
                    onChange={(e) => setVisitPurpose(e.target.value)}
                    placeholder="Örn: Toplantı, Numune Teslimi, Teknik Servis..."
                    className="h-11 rounded-xl bg-background border-border/80 font-semibold text-sm"
                    list="common-purposes"
                  />
                  <datalist id="common-purposes">
                    {COMMON_PURPOSES.map((purp) => (
                      <option key={purp} value={purp} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>

            {/* SAĞ BLOK: HAREKET LOKASYONU, ULAŞIM VE GÜVENLİK NOTU (4 SATIR) */}
            <div className="bg-muted/15 border border-border/70 rounded-2xl p-5 flex flex-col justify-between">
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-border/60">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <MapPin size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-foreground uppercase tracking-wider">
                    Lokasyon & Ulaşım Bilgisi
                  </h4>
                </div>
              </div>

              <div className="space-y-3 my-auto">
                {/* 1. Satır: Gelinen İl ve İlçe (Cascading 2 Sütun) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Gelinen İl */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                      Gelinen İl <span className="text-destructive font-black">*</span>
                    </Label>
                    <Select value={originProvince} onValueChange={handleProvinceChange}>
                      <SelectTrigger className="h-11 w-full rounded-xl bg-background border-border/80 font-bold text-sm">
                        <SelectValue placeholder="İl Seçiniz" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {PROVINCE_NAMES.map((prov) => (
                          <SelectItem key={prov} value={prov}>
                            {prov}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Gelinen İlçe (Cascading) */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                      Gelinen İlçe <span className="text-destructive font-black">*</span>
                    </Label>
                    <Select value={originDistrict} onValueChange={setOriginDistrict}>
                      <SelectTrigger className="h-11 w-full rounded-xl bg-background border-border/80 font-bold text-sm">
                        <SelectValue placeholder="İlçe Seçiniz" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {availableDistricts.map((dist) => (
                          <SelectItem key={dist} value={dist}>
                            {dist}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 2. Satır: Ulaşım Şekli */}
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                    Ulaşım Şekli <span className="text-destructive font-black">*</span>
                  </Label>
                  <Select 
                    value={transportMode} 
                    onValueChange={(val) => {
                      const mode = val as TransportMode;
                      setTransportMode(mode);
                      if (!VEHICLE_TRANSPORT_MODES.includes(mode)) {
                        setLicensePlate("");
                        handlePassengerCountChange("1");
                      }
                    }}
                  >
                    <SelectTrigger className="h-11 w-full rounded-xl bg-background border-border/80 font-bold text-sm">
                      <SelectValue placeholder="Ulaşım Şekli Seçiniz" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSPORT_MODES.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {mode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 3. Satır: Koşullu Araç Bilgileri (Plaka ve Kişi Sayısı) */}
                {isVehicleTransport ? (
                  <div className="h-15.5 px-3.5 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center animate-in fade-in duration-200">
                    {/* Plaka */}
                    <div className="space-y-0.5">
                      <Label className="text-[10px] font-bold text-foreground flex items-center gap-1">
                        Araç Plakası <span className="text-destructive font-black">*</span>
                      </Label>
                      <Input
                        value={licensePlate}
                        onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                        placeholder="34 XXX 000"
                        className="h-8 rounded-lg bg-background border-border font-mono font-black text-xs tracking-wider uppercase text-foreground"
                        required={isVehicleTransport}
                      />
                    </div>

                    {/* Araçtaki Kişi Sayısı */}
                    <div className="space-y-0.5">
                      <Label className="text-[10px] font-bold text-foreground flex items-center gap-1">
                        Araçtaki Kişi Sayısı <span className="text-destructive font-black">*</span>
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        max="50"
                        value={vehiclePassengerCount}
                        onChange={(e) => handlePassengerCountChange(e.target.value)}
                        placeholder="1"
                        className="h-8 rounded-lg bg-background border-border font-bold text-xs"
                        required={isVehicleTransport}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="h-15.5 px-3.5 rounded-xl bg-muted/30 border border-border/50 flex items-center gap-2.5 text-xs text-muted-foreground">
                    <ShieldCheck size={16} className="text-muted-foreground/60 shrink-0" />
                    <span>Yaya veya toplu taşımada araç plakası ve kişi sayısı gerekmez.</span>
                  </div>
                )}

                {/* 4. Satır: Güvenlik Notu / Açıklama (EN SAĞ ALT) */}
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                    Not / Açıklama <span className="text-[10px] font-normal">(Opsiyonel)</span>
                  </Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={15} />
                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Örn: Ziyaretçi kartı no: 14 verildi, taşeron firma..."
                      className="h-11 pl-9 rounded-xl bg-background border-border/80 font-semibold text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ARAÇTAKİ DİĞER YOLCULAR / ZİYARETÇİLER (KİŞİ SAYISI > 1) */}
          {isVehicleTransport && companions.length > 0 && (
            <div className="rounded-2xl bg-indigo-500/5 border border-indigo-500/20 p-4 sm:p-5 space-y-3 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-indigo-500/15">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Users size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-foreground uppercase tracking-wider">
                      Araçtaki Diğer Ziyaretçiler ({companions.length} Kişi)
                    </h4>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      Araç plakası, firma ve ziyaret bilgileri bu kişiler için otomatik ortak atanacaktır.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-md self-start sm:self-auto border border-indigo-500/20">
                  Bağlantılı Araç Grubu
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {companions.map((comp, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-background border border-border/80 shadow-xs space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-black">
                          {idx + 2}
                        </span>
                        Yolcu {idx + 1}
                      </span>
                      <span className="text-[10px] text-destructive font-black">* Zorunlu</span>
                    </div>

                    <div className="space-y-1.5">
                      <Input
                        value={comp.fullName}
                        onChange={(e) => handleCompanionChange(idx, "fullName", e.target.value)}
                        placeholder="Adı Soyadı *"
                        className="h-9 rounded-lg bg-muted/20 font-bold text-xs"
                        required
                      />
                      <Input
                        value={comp.phone || ""}
                        onChange={(e) => handleCompanionChange(idx, "phone", e.target.value)}
                        placeholder="Telefon (Opsiyonel)"
                        className="h-9 rounded-lg bg-muted/20 text-xs"
                        type="tel"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

          {/* STICKY FOOTER */}
          <div className="sticky bottom-0 z-20 px-6 py-4 sm:px-8 border-t border-border/70 bg-card/95 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold self-start sm:self-auto">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Kayıt Türü: <strong>Güvenlik – Manuel Kayıt</strong></span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-11 px-5 rounded-xl font-bold text-xs uppercase tracking-wider"
              >
                İptal
              </Button>
              <Button
                type="submit"
                className="h-11 px-7 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-indigo-600/25 transition-all"
              >
                Ziyaretçiyi Kaydet
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
