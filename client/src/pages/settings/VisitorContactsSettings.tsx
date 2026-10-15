import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Search,
  Building2,
  Star,
  Phone,
  CheckCircle2,
  Briefcase,
  UserCheck
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/providers/ConfirmProvider";
import type { IVisitorContact, CreateVisitorContactDTO, VisitorSuggestionsResponse } from "@/types/visitorContact";
import { cn } from "@/lib/utils";

export default function VisitorContactsSettings() {
  const queryClient = useQueryClient();
  const { confirm } = useConfirm();

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<IVisitorContact | null>(null);

  // Form State
  const [departmentName, setDepartmentName] = useState("");
  const [customDeptInput, setCustomDeptInput] = useState(false);
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [phoneExtension, setPhoneExtension] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);

  // Filtreler & Arama
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>("ALL");

  // 1. Ziyaretçi İletişim Kişilerini Getir
  const { data: contactsData, isLoading } = useQuery({
    queryKey: ["visitor-contacts"],
    queryFn: async () => {
      const res = await apiClient.get("/visitor-contacts");
      return res.data;
    },
  });

  const contacts: IVisitorContact[] = contactsData?.contacts || [];
  const existingDepartments: string[] = contactsData?.departments || [];

  // 2. Şirket Personeli ve Bölüm Önerilerini Getir
  const { data: suggestionsData } = useQuery<VisitorSuggestionsResponse>({
    queryKey: ["visitor-contact-suggestions"],
    queryFn: async () => {
      const res = await apiClient.get("/visitor-contacts/suggestions");
      return res.data;
    },
  });

  const companySections = suggestionsData?.sections || [];
  const companyStaff = suggestionsData?.staff || [];

  // Departman listesi birleşimi (Kayıtlı + Şirket bölümleri)
  const allDepartmentOptions = useMemo(() => {
    const set = new Set([...existingDepartments, ...companySections]);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
  }, [existingDepartments, companySections]);

function normalizeText(str: string): string {
  if (!str) return "";
  return str
    .replace(/İ/g, "i").replace(/I/g, "ı").replace(/ı/g, "i")
    .replace(/ğ/g, "g").replace(/Ğ/g, "g")
    .replace(/ü/g, "u").replace(/Ü/g, "u")
    .replace(/ş/g, "s").replace(/Ş/g, "s")
    .replace(/ö/g, "o").replace(/Ö/g, "o")
    .replace(/ç/g, "c").replace(/Ç/g, "c")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // Boşluk, tire vb. kaldırır (Satın Alma === Satınalma)
}

  // Seçili departmana ait personeller (Bölüm seçildikten sonra sadece o bölümdeki kişiler)
  const filteredStaffByDept = useMemo(() => {
    if (!departmentName.trim()) {
      return companyStaff;
    }
    const targetDeptNorm = normalizeText(departmentName);
    return companyStaff.filter((s) => {
      const secNorm = normalizeText(s.sectionName || "");
      const depNorm = normalizeText(s.departmentName || "");
      return (
        secNorm === targetDeptNorm ||
        depNorm === targetDeptNorm ||
        secNorm.includes(targetDeptNorm) ||
        targetDeptNorm.includes(secNorm)
      );
    });
  }, [companyStaff, departmentName]);

  // Arama filtresi (fullName ile sadece o bölümdeki personeller arasında filtreleme)
  const searchedStaff = useMemo(() => {
    if (!fullName.trim()) {
      return filteredStaffByDept;
    }
    const qNorm = normalizeText(fullName);
    return filteredStaffByDept.filter((s) =>
      normalizeText(s.fullName).includes(qNorm)
    );
  }, [filteredStaffByDept, fullName]);

  // Bölüm değiştiğinde çağrılan fonksiyon
  const handleDepartmentChange = (newDept: string) => {
    setDepartmentName(newDept);
    // Yeni bölümde personelin adı yoksa ad ve dahili no'yu sıfırla
    setFullName("");
    setPhoneExtension("");
  };

  // Ekleme / Güncelleme Mutasyonu
  const saveMutation = useMutation({
    mutationFn: async (dto: CreateVisitorContactDTO) => {
      if (editingContact) {
        const res = await apiClient.put(`/visitor-contacts/${editingContact.id}`, dto);
        return res.data;
      } else {
        const res = await apiClient.post("/visitor-contacts", dto);
        return res.data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["visitor-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["visitor-contacts-active"] });
      toast.success(data?.message || "Kayıt başarıyla kaydedildi.");
      closeDialog();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Kaydetme işlemi başarısız oldu.");
    },
  });

  // Varsayılan Yap Mutasyonu
  const setDefaultMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.patch(`/visitor-contacts/${id}/set-default`);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["visitor-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["visitor-contacts-active"] });
      toast.success(data?.message || "Varsayılan kişi güncellendi.");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "İşlem başarısız oldu.");
    },
  });

  // Silme Mutasyonu
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete(`/visitor-contacts/${id}`);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["visitor-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["visitor-contacts-active"] });
      toast.success(data?.message || "Kayıt silindi.");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Silme işlemi başarısız oldu.");
    },
  });

  // Dialog Aç / Kapat
  const openCreateDialog = () => {
    setEditingContact(null);
    const initialDept =
      selectedDeptFilter !== "ALL"
        ? selectedDeptFilter
        : allDepartmentOptions[0] || "";
    setDepartmentName(initialDept);
    setCustomDeptInput(false);
    setFullName("");
    setTitle("");
    setPhoneExtension("");
    setIsDefault(false);
    setIsActive(true);
    setIsDialogOpen(true);
  };

  const openEditDialog = (contact: IVisitorContact) => {
    setEditingContact(contact);
    setDepartmentName(contact.departmentName);
    setCustomDeptInput(!allDepartmentOptions.includes(contact.departmentName));
    setFullName(contact.fullName);
    setTitle(contact.title || "");
    setPhoneExtension(contact.phoneExtension || "");
    setIsDefault(contact.isDefault);
    setIsActive(contact.isActive);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingContact(null);
  };

  // Form Gönderimi
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!departmentName.trim()) {
      toast.error("Lütfen Bölüm / Departman seçiniz veya giriniz.");
      return;
    }
    if (!fullName.trim()) {
      toast.error("Lütfen Görüşülecek Kişi adını giriniz.");
      return;
    }

    saveMutation.mutate({
      departmentName: departmentName.trim(),
      fullName: fullName.trim(),
      title: title.trim() || undefined,
      phoneExtension: phoneExtension.trim() || undefined,
      isDefault,
      isActive,
    });
  };

  // Silme Onayı
  const handleDelete = async (contact: IVisitorContact) => {
    const isConfirmed = await confirm({
      title: "Yetkiliyi Sil",
      description: `"${contact.fullName}" (${contact.departmentName}) ziyaretçi listesinden silinecek. Onaylıyor musunuz?`,
      confirmText: "Evet, Sil",
      cancelText: "İptal",
      variant: "destructive",
    });

    if (isConfirmed) {
      deleteMutation.mutate(contact.id);
    }
  };

  // Filtrelenmiş Kişiler
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      const matchesSearch =
        c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.departmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.title && c.title.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesDept =
        selectedDeptFilter === "ALL" || c.departmentName === selectedDeptFilter;

      return matchesSearch && matchesDept;
    });
  }, [contacts, searchTerm, selectedDeptFilter]);

  // İstatistikler
  const totalDepartments = existingDepartments.length;
  const defaultCount = contacts.filter((c) => c.isDefault).length;

  return (
    <div className="space-y-6">
      {/* BAŞLIK & AÇIKLAMA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <UserCheck size={22} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-foreground tracking-tight">
                Ziyaretçi Görüşme Ayarları
              </h3>
              <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                Dış ziyaretçilerin randevulu/randevusuz görüşebileceği departman ve personelleri yönetin.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={openCreateDialog}
            className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-indigo-600/20 gap-1.5 cursor-pointer"
          >
            <Plus size={16} />
            <span>Yeni Kişi Ekle</span>
          </Button>
        </div>
      </div>

      {/* ÖZET KARTLARI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-muted/20 border border-border/70 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
            <Building2 size={20} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Ziyarete Açık Bölümler
            </div>
            <div className="text-xl font-black text-foreground">
              {totalDepartments} <span className="text-xs font-medium text-muted-foreground">Bölüm</span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-muted/20 border border-border/70 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <Users size={20} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Görüşülecek Yetkililer
            </div>
            <div className="text-xl font-black text-foreground">
              {contacts.length} <span className="text-xs font-medium text-muted-foreground">Kişi</span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-muted/20 border border-border/70 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Star size={20} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Varsayılan Muhataplar
            </div>
            <div className="text-xl font-black text-foreground">
              {defaultCount} <span className="text-xs font-medium text-muted-foreground">Atandı</span>
            </div>
          </div>
        </div>
      </div>

      {/* FİLTRE VE ARAMA ÇUBUĞU */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-muted/15 border border-border/70">
        <div className="relative w-full sm:w-72">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={14}
          />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Kişi, unvan veya bölüm ara..."
            className="h-9 pl-9 rounded-xl bg-background border-border/80 text-xs font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedDeptFilter("ALL")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer",
              selectedDeptFilter === "ALL"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-muted/40 text-muted-foreground hover:text-foreground"
            )}
          >
            Tüm Bölümler ({contacts.length})
          </button>
          {existingDepartments.map((dept) => {
            const count = contacts.filter((c) => c.departmentName === dept).length;
            return (
              <button
                key={dept}
                onClick={() => setSelectedDeptFilter(dept)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer",
                  selectedDeptFilter === dept
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-muted/40 text-muted-foreground hover:text-foreground"
                )}
              >
                {dept} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* TABLO LİSTESİ */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/70">
              <TableHead className="text-xs font-black uppercase tracking-wider text-muted-foreground py-3.5">
                Bölüm / Departman
              </TableHead>
              <TableHead className="text-xs font-black uppercase tracking-wider text-muted-foreground py-3.5">
                Görüşülecek Kişi
              </TableHead>
              <TableHead className="text-xs font-black uppercase tracking-wider text-muted-foreground py-3.5">
                Unvan & Dahili No
              </TableHead>
              <TableHead className="text-xs font-black uppercase tracking-wider text-muted-foreground py-3.5 text-center">
                Varsayılan Durumu
              </TableHead>
              <TableHead className="text-xs font-black uppercase tracking-wider text-muted-foreground py-3.5 text-right">
                İşlemler
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-xs text-muted-foreground font-semibold">
                  Görüşülecek kişiler yükleniyor...
                </TableCell>
              </TableRow>
            ) : filteredContacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center text-muted-foreground">
                      <Users size={22} />
                    </div>
                    <div className="font-bold text-sm text-foreground">Tanımlı Kişi Bulunamadı</div>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      {searchTerm || selectedDeptFilter !== "ALL"
                        ? "Arama kriterlerine uygun kişi bulunamadı."
                        : "Henüz ziyaretçi kabulü yapacak kişi tanımlanmadı. Sağ üstteki 'Yeni Kişi Ekle' butonunu kullanabilirsiniz."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredContacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  className="hover:bg-muted/20 transition-colors group"
                >
                  {/* BÖLÜM ADI */}
                  <TableCell className="py-3">
                    <Badge
                      variant="outline"
                      className="bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 font-bold text-xs px-2.5 py-0.5 rounded-lg"
                    >
                      <Building2 size={12} className="mr-1" />
                      {contact.departmentName}
                    </Badge>
                  </TableCell>

                  {/* KİŞİ ADI SOYADI */}
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-black text-xs flex items-center justify-center shrink-0">
                        {contact.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                          {contact.fullName}
                          {!contact.isActive && (
                            <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.2 rounded">
                              Pasif
                            </span>
                          )}
                        </div>
                        {contact.email && (
                          <div className="text-[11px] text-muted-foreground font-medium">
                            {contact.email}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* UNVAN & DAHİLİ NO */}
                  <TableCell className="py-3">
                    <div className="flex flex-col gap-0.5">
                      {contact.title ? (
                        <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
                          <Briefcase size={12} className="text-muted-foreground" />
                          <span>{contact.title}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/60 italic">-</span>
                      )}
                      {contact.phoneExtension && (
                        <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                          <Phone size={11} />
                          <span>Dahili: <strong>{contact.phoneExtension}</strong></span>
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* VARSAYILAN MUHATAP DURUMU */}
                  <TableCell className="py-3 text-center">
                    {contact.isDefault ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20 font-black text-[10px] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                        <CheckCircle2 size={11} />
                        Varsayılan Muhatap
                      </Badge>
                    ) : (
                      <button
                        onClick={() => setDefaultMutation.mutate(contact.id)}
                        disabled={setDefaultMutation.isPending}
                        className="text-[10px] font-bold text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 bg-muted/40 hover:bg-indigo-500/10 px-2 py-0.5 rounded-md border border-border/80 transition-all cursor-pointer inline-flex items-center gap-1"
                        title="Bu bölüm seçildiğinde forma otomatik gelmesi için varsayılan yap"
                      >
                        <Star size={10} />
                        Varsayılan Yap
                      </button>
                    )}
                  </TableCell>

                  {/* İŞLEMLER */}
                  <TableCell className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(contact)}
                        className="h-8 w-8 rounded-lg text-primary hover:bg-primary/10 cursor-pointer"
                        title="Düzenle"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(contact)}
                        className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 cursor-pointer"
                        title="Sil"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* YENİ EKLEME / DÜZENLEME MODALI */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[92vw] sm:max-w-lg p-0 gap-0 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          <form onSubmit={handleSubmit} className="flex flex-col">
            <DialogHeader className="p-6 pb-4 border-b border-border/70 bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                  <UserCheck size={20} />
                </div>
                <div className="space-y-0.5">
                  <DialogTitle className="text-lg font-black text-foreground">
                    {editingContact ? "Görüşülecek Kişiyi Düzenle" : "Yeni Görüşülecek Kişi Ekle"}
                  </DialogTitle>
                  <DialogDescription className="text-xs font-semibold text-muted-foreground">
                    Ziyaretçi kabulü yapacak yetkili personel ve bölüm bilgileri
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="p-6 space-y-4">
              {/* 1. BÖLÜM SEÇİMİ VEYA SERBEST GİRİŞ */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                    Bölüm / Departman <span className="text-destructive font-black">*</span>
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomDeptInput(!customDeptInput);
                      if (!customDeptInput) {
                        setDepartmentName("");
                      } else {
                        setDepartmentName(allDepartmentOptions[0] || "");
                      }
                    }}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    {customDeptInput ? "Listeden Seç" : "+ Yeni Bölüm Yaz"}
                  </button>
                </div>

                {customDeptInput ? (
                  <Input
                    value={departmentName}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    placeholder="Örn: Ar-Ge & Tasarım"
                    className="h-10 rounded-xl bg-background border-border/80 font-bold text-xs"
                    required
                  />
                ) : (
                  <select
                    value={departmentName}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-background border border-border/80 font-bold text-xs text-foreground outline-none focus:border-indigo-500 transition-all cursor-pointer"
                    required
                  >
                    {allDepartmentOptions.length === 0 && (
                      <option value="">Lütfen bölüm seçiniz</option>
                    )}
                    {allDepartmentOptions.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 2. KİŞİ ADI SOYADI */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                  Görüşülecek Kişi (Ad Soyad) <span className="text-destructive font-black">*</span>
                </Label>
                <div className="relative">
                  <Input
                    value={fullName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFullName(val);
                      // Sadece seçili bölümdeki personeller içinde tam eşleşme kontrol et
                      const match = filteredStaffByDept.find(
                        (s) => s.fullName.toLowerCase() === val.trim().toLowerCase()
                      );
                      if (match && match.phoneExtension) {
                        setPhoneExtension(match.phoneExtension);
                      }
                    }}
                    placeholder={
                      departmentName
                        ? `${departmentName} personel adı yazın veya aşağıdan seçin...`
                        : "Örn: Berkan Beyaz"
                    }
                    className="h-10 rounded-xl bg-background border-border/80 font-bold text-xs"
                    required
                  />
                </div>

                {/* HIZLI PERSONEL ÖNERİLERİ - SADECE SEÇİLİ BÖLÜM VE ARAMAYA GÖRE */}
                {!editingContact && (
                  <div className="pt-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                      <span>
                        {departmentName
                          ? `${departmentName} Personelleri (${searchedStaff.length})`
                          : `Personel Listesi (${searchedStaff.length})`}
                        :
                      </span>
                      {fullName && (
                        <button
                          type="button"
                          onClick={() => setFullName("")}
                          className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          Aramayı Temizle
                        </button>
                      )}
                    </div>
                    {searchedStaff.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/70 italic mt-1 bg-muted/20 p-2 rounded-lg border border-border/50">
                        {departmentName
                          ? `"${departmentName}" bölümünde aramanıza uygun personel bulunamadı. İsmi doğrudan yukarıya yazabilirsiniz.`
                          : "Personel bulunamadı. İsmi doğrudan yazabilirsiniz."}
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 mt-1 max-h-28 overflow-y-auto">
                        {searchedStaff.slice(0, 10).map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setFullName(s.fullName);
                              if (s.phoneExtension) {
                                setPhoneExtension(s.phoneExtension);
                              }
                            }}
                            className={cn(
                              "text-[10px] font-semibold px-2 py-1 rounded-md border transition-all cursor-pointer inline-flex items-center gap-1",
                              fullName === s.fullName
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                : "bg-muted/60 hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 border-border/60"
                            )}
                          >
                            <span>{s.fullName}</span>
                            {s.phoneExtension && (
                              <span
                                className={cn(
                                  "font-mono text-[9px] font-bold",
                                  fullName === s.fullName
                                    ? "text-white/80"
                                    : "text-indigo-600 dark:text-indigo-400"
                                )}
                              >
                                • Dah: {s.phoneExtension}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3. UNVAN & DAHİLİ TELEFON (2 SÜTUN) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">
                    Unvan <span className="text-[10px] font-normal">(Opsiyonel)</span>
                  </Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Örn: Satınalma Uzmanı"
                    className="h-10 rounded-xl bg-background border-border/80 text-xs font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">
                    Dahili No <span className="text-[10px] font-normal">(Opsiyonel)</span>
                  </Label>
                  <Input
                    value={phoneExtension}
                    onChange={(e) => setPhoneExtension(e.target.value)}
                    placeholder="Örn: 120"
                    className="h-10 rounded-xl bg-background border-border/80 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* 4. VARSAYILAN MUHATAP SWITCH */}
              <div className="p-3.5 rounded-xl bg-muted/20 border border-border/70 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Star size={13} className="text-amber-500" />
                    Bölümün Varsayılan Muhatabı Yap
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    Ziyaretçi formunda bu bölüm seçildiğinde kişi alanına otomatik bu isim atanır.
                  </p>
                </div>
                <Switch
                  checked={isDefault}
                  onCheckedChange={setIsDefault}
                  className="data-[state=checked]:bg-indigo-600"
                />
              </div>

              {/* 5. AKTİF / PASİF DURUMU */}
              {editingContact && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/10 border border-border/60">
                  <span className="text-xs font-bold text-foreground">Aktif Durumda</span>
                  <Switch
                    checked={isActive}
                    onCheckedChange={setIsActive}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>
              )}
            </div>

            <DialogFooter className="p-4 sm:p-6 border-t border-border/70 bg-muted/20 flex-row justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                className="h-10 px-5 rounded-xl font-bold text-xs uppercase tracking-wider"
              >
                İptal
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending}
                className="h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-indigo-600/20"
              >
                {editingContact ? "Güncelle" : "Kaydet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
