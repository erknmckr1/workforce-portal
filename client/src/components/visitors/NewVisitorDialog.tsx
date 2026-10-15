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
  Briefcase,
  ShieldCheck,
  CalendarDays,
  FileText
} from "lucide-react";
import { PROVINCE_NAMES, getDistrictsByProvince } from "@/data/turkeyLocations";
import { 
  TRANSPORT_MODES, 
  VEHICLE_TRANSPORT_MODES 
} from "@/types/visitor";
import type { 
  TransportMode, 
  CreateVisitorDTO 
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
  const [visitedPersonOrDept, setVisitedPersonOrDept] = useState("");
  const [visitPurpose, setVisitPurpose] = useState("");
  
  // Gelinen Lokasyon State (Varsayılan İstanbul)
  const [originProvince, setOriginProvince] = useState<string>("İstanbul");
  const [originDistrict, setOriginDistrict] = useState<string>("Bahçelievler");
  
  // Ulaşım State
  const [transportMode, setTransportMode] = useState<TransportMode>("Otomobil");
  const [vehiclePassengerCount, setVehiclePassengerCount] = useState<string>("1");
  const [licensePlate, setLicensePlate] = useState<string>("");

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

  // Form Sıfırlama
  const resetForm = () => {
    setFullName("");
    setCompany("");
    setPhone("");
    setVisitedPersonOrDept("");
    setVisitPurpose("");
    setOriginProvince("İstanbul");
    setOriginDistrict("Bahçelievler");
    setTransportMode("Otomobil");
    setVehiclePassengerCount("1");
    setLicensePlate("");
    setNotes("");
  };

  // Form Gönderim
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Zorunlu Alan Kontrolleri
    if (!fullName.trim()) {
      toast.error("Lütfen ziyaretçi Adı ve Soyadını giriniz.");
      return;
    }

    if (!visitedPersonOrDept.trim()) {
      toast.error("Lütfen Ziyaret Edilen Kişi veya Bölümü belirtiniz.");
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
    }

    const payload: CreateVisitorDTO = {
      fullName: fullName.trim(),
      company: company.trim() || undefined,
      phone: phone.trim() || undefined,
      visitedPersonOrDept: visitedPersonOrDept.trim(),
      visitPurpose: visitPurpose.trim() || undefined,
      originProvince,
      originDistrict,
      transportMode,
      vehiclePassengerCount: isVehicleTransport ? parseInt(vehiclePassengerCount, 10) : undefined,
      licensePlate: isVehicleTransport ? licensePlate.trim().toUpperCase() : undefined,
      notes: notes.trim() || undefined,
      source: "Güvenlik – Manuel Kayıt",
    };

    onSubmit(payload);
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] sm:max-w-5xl lg:max-w-6xl xl:max-w-285 sm:h-auto lg:h-158.75 max-h-[94vh] overflow-y-auto lg:overflow-hidden p-0 gap-0 rounded-2xl border border-border bg-card shadow-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col h-full justify-between">
          {/* HEADER */}
          <DialogHeader className="px-6 py-4 sm:px-8 sm:py-4.5 border-b border-border/70 bg-muted/20 shrink-0">
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

          {/* FORM BODY: 2 SÜTUNLU YAN YANA VE TAM DENGELİ (4'ER SATIR) */}
          <div className="flex-1 p-5 sm:p-6 lg:p-7 grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 items-stretch">
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

                {/* 3. Satır: Görüşülecek Kişi / Bölüm (Tam Genişlik) */}
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                    Görüşülecek Kişi / Bölüm <span className="text-destructive font-black">*</span>
                  </Label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={15} />
                    <Input
                      value={visitedPersonOrDept}
                      onChange={(e) => setVisitedPersonOrDept(e.target.value)}
                      placeholder="Örn: Satınalma - Emre Bey"
                      className="h-11 pl-9 rounded-xl bg-background border-border/80 font-bold text-sm"
                      list="common-departments"
                      required
                    />
                  </div>
                  <datalist id="common-departments">
                    {COMMON_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept} />
                    ))}
                  </datalist>
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
                  <p className="text-[11px] text-muted-foreground font-medium">
                    Sera Gazı (CO₂e) ve Güvenlik Notları
                  </p>
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
                    onValueChange={(val) => setTransportMode(val as TransportMode)}
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
                        onChange={(e) => setVehiclePassengerCount(e.target.value)}
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

          {/* FOOTER */}
          <div className="px-6 py-4 sm:px-8 border-t border-border/70 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
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
