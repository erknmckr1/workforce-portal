import { useState, useMemo, useCallback } from "react";
import { 
  UserCheck, 
  UserPlus, 
  History, 
  FileSpreadsheet, 
  Search, 
  Clock, 
  MapPin, 
  Building2, 
  LogOut, 
  QrCode,
  Shield,
  Calendar,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import DataTable, { type DataTableColumn } from "@/components/common/DataTable";
import NewVisitorDialog from "@/components/visitors/NewVisitorDialog";
import VisitorExitDialog from "@/components/visitors/VisitorExitDialog";
import type { IVisitor, CreateVisitorDTO } from "@/types/visitor";
import { useDebounce } from "@/hooks/useDebounce";
import { format } from "date-fns";
import { toast } from "sonner";
import apiClient from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface VisitorDbRecord {
  id: number | string;
  fullName: string;
  company?: string | null;
  phone?: string | null;
  visitedPersonOrDept: string;
  visitPurpose?: string | null;
  originProvince: string;
  originDistrict: string;
  transportMode: string;
  vehiclePassengerCount?: number | null;
  licensePlate?: string | null;
  entryTime: string | Date;
  exitTime?: string | Date | null;
  isInside: boolean;
  source: string;
  notes?: string | null;
  createdAt?: string;
}

const INSIDE_COLUMNS: DataTableColumn<IVisitor>[] = [
  { header: "Giriş Saati", width: "95px" },
  { header: "Ziyaretçi Adı Soyadı", width: "180px" },
  { header: "Firma / Kurum", width: "160px" },
  { header: "Ziyaret Edilen Kişi / Bölüm" },
  { header: "Geldiği Yer (İl / İlçe)", width: "160px" },
  { header: "Ulaşım & Plaka", width: "150px" },
  { header: "Güvenlik Notu", width: "180px" },
  { header: "Kayıt Türü", width: "90px" },
  { header: "İşlem", align: "right", width: "105px" },
];

const HISTORY_COLUMNS: DataTableColumn<IVisitor>[] = [
  { header: "Tarih", width: "95px" },
  { header: "Giriş - Çıkış Saati", width: "135px" },
  { header: "Ziyaretçi Adı Soyadı", width: "180px" },
  { header: "Firma / Kurum", width: "160px" },
  { header: "Ziyaret Edilen Kişi / Bölüm" },
  { header: "Geldiği Yer (İl / İlçe)", width: "160px" },
  { header: "Ulaşım & Plaka", width: "150px" },
  { header: "Güvenlik Notu", width: "180px" },
  { header: "Kayıt Türü", width: "90px" },
];

export default function VisitorTrackingPage() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"inside" | "history">("inside");
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 250);

  // Tarih Filtresi State
  const [datePreset, setDatePreset] = useState<string>("ALL"); // ALL, TODAY, YESTERDAY, THIS_WEEK, THIS_MONTH, CUSTOM
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  // Sayfalama (Pagination) State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Dialog States
  const [isNewVisitorOpen, setIsNewVisitorOpen] = useState(false);
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
  const [selectedVisitorForExit, setSelectedVisitorForExit] = useState<IVisitor | null>(null);

  // MSSQL Gerçek Veritabanı Sorgusu (Her 5 saniyede bir otomatik yenilenir)
  const { data: rawVisitors = [], isFetching, isLoading } = useQuery({
    queryKey: ["visitors"],
    queryFn: async () => {
      const res = await apiClient.get("/visitors");
      return res.data;
    },
    refetchInterval: 5000,
  });

  // DB Verilerini Arayüz Formatına Dönüştür
  const visitors: IVisitor[] = useMemo(() => {
    return rawVisitors.map((v: VisitorDbRecord) => {
      const entryDateObj = v.entryTime ? new Date(v.entryTime) : new Date();
      const exitDateObj = v.exitTime ? new Date(v.exitTime) : null;
      return {
        id: v.id,
        fullName: v.fullName,
        company: v.company || undefined,
        phone: v.phone || undefined,
        visitedPersonOrDept: v.visitedPersonOrDept,
        visitPurpose: v.visitPurpose || undefined,
        originProvince: v.originProvince,
        originDistrict: v.originDistrict,
        transportMode: v.transportMode as IVisitor["transportMode"],
        vehiclePassengerCount: v.vehiclePassengerCount || undefined,
        licensePlate: v.licensePlate || undefined,
        entryDate: format(entryDateObj, "yyyy-MM-dd"),
        entryTime: format(entryDateObj, "HH:mm"),
        exitDate: exitDateObj ? format(exitDateObj, "yyyy-MM-dd") : undefined,
        exitTime: exitDateObj ? format(exitDateObj, "HH:mm") : undefined,
        notes: v.notes || undefined,
        source: (v.source || "Güvenlik – Manuel Kayıt") as IVisitor["source"],
        status: v.isInside ? "inside" : "exited",
        createdAt: v.createdAt,
      };
    });
  }, [rawVisitors]);

  // Yeni Ziyaretçi Ekleme Mutasyonu (MSSQL POST /api/visitors)
  const createMutation = useMutation({
    mutationFn: async (dto: CreateVisitorDTO) => {
      const res = await apiClient.post("/visitors", dto);
      return res.data;
    },
    onSuccess: (data: VisitorDbRecord) => {
      queryClient.invalidateQueries({ queryKey: ["visitors"] });
      toast.success(`${data.fullName || "Ziyaretçi"} girişi başarıyla kaydedildi.`);
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { message?: string } } };
      toast.error(errorObj?.response?.data?.message || "Ziyaretçi kaydı kaydedilemedi.");
    },
  });

  // Çıkış İşlemi Mutasyonu (MSSQL PUT /api/visitors/:id/exit)
  const exitMutation = useMutation({
    mutationFn: async ({
      visitorId,
      exitDate,
      exitTime,
    }: {
      visitorId: string | number;
      exitDate: string;
      exitTime: string;
    }) => {
      const fullExitTime = new Date(`${exitDate}T${exitTime}:00`);
      const res = await apiClient.put(`/visitors/${visitorId}/exit`, {
        exitTime: fullExitTime.toISOString(),
      });
      return res.data;
    },
    onSuccess: (data: VisitorDbRecord) => {
      queryClient.invalidateQueries({ queryKey: ["visitors"] });
      toast.success(`${data.fullName || "Ziyaretçi"} çıkışı kaydedildi ve geçmişe aktarıldı.`);
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { message?: string } } };
      toast.error(errorObj?.response?.data?.message || "Çıkış işlemi kaydedilemedi.");
    },
  });

  // Yeni Ziyaretçi Ekleme
  const handleCreateVisitor = (dto: CreateVisitorDTO) => {
    createMutation.mutate(dto);
  };

  // Çıkış İşlemi
  const handleConfirmExit = (visitorId: string | number, exitDate: string, exitTime: string) => {
    exitMutation.mutate({ visitorId, exitDate, exitTime });
  };

  // Açılan Çıkış Modalı
  const handleOpenExitDialog = (visitor: IVisitor) => {
    setSelectedVisitorForExit(visitor);
    setIsExitDialogOpen(true);
  };

  // İstatistikler
  const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const insideVisitors = useMemo(() => visitors.filter((v) => v.status === "inside"), [visitors]);
  const exitedVisitors = useMemo(() => visitors.filter((v) => v.status === "exited"), [visitors]);
  const todayVisitors = useMemo(() => visitors.filter((v) => v.entryDate === todayStr), [visitors, todayStr]);
  const vehicleVisitors = useMemo(() => visitors.filter((v) => !!v.licensePlate), [visitors]);

  // Tarih Filtresi Fonksiyonu
  const matchesDatePreset = useCallback(
    (entryDate: string) => {
      if (datePreset === "ALL") return true;
      const now = new Date();
      const formatYmd = (d: Date) => format(d, "yyyy-MM-dd");

      if (datePreset === "TODAY") {
        return entryDate === todayStr;
      }
      if (datePreset === "YESTERDAY") {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return entryDate === formatYmd(yesterday);
      }
      if (datePreset === "THIS_WEEK") {
        const day = now.getDay() || 7;
        const monday = new Date(now);
        monday.setDate(now.getDate() - day + 1);
        return entryDate >= formatYmd(monday) && entryDate <= todayStr;
      }
      if (datePreset === "THIS_MONTH") {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        return entryDate >= formatYmd(firstDay) && entryDate <= todayStr;
      }
      if (datePreset === "CUSTOM") {
        if (customStartDate && entryDate < customStartDate) return false;
        if (customEndDate && entryDate > customEndDate) return false;
        return true;
      }
      return true;
    },
    [datePreset, todayStr, customStartDate, customEndDate]
  );

  // Aktif Sekmeye ve Arama/Tarihe Göre Filtreleme
  const currentTabVisitors = activeTab === "inside" ? insideVisitors : exitedVisitors;

  const filteredVisitors = useMemo(() => {
    return currentTabVisitors.filter((v) => {
      // 1. Tarih Filtresi
      if (!matchesDatePreset(v.entryDate)) return false;

      // 2. Arama Filtresi
      if (!debouncedSearch.trim()) return true;
      const lower = debouncedSearch.toLowerCase();
      return (
        v.fullName.toLowerCase().includes(lower) ||
        (v.company && v.company.toLowerCase().includes(lower)) ||
        v.visitedPersonOrDept.toLowerCase().includes(lower) ||
        (v.licensePlate && v.licensePlate.toLowerCase().includes(lower)) ||
        v.originProvince.toLowerCase().includes(lower) ||
        v.originDistrict.toLowerCase().includes(lower) ||
        (v.notes && v.notes.toLowerCase().includes(lower))
      );
    });
  }, [currentTabVisitors, debouncedSearch, matchesDatePreset]);

  // Sayfalama
  const totalCount = filteredVisitors.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const paginatedVisitors = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredVisitors.slice(start, start + limit);
  }, [filteredVisitors, page, limit]);

  // EXCEL DIŞA AKTARMA (GHG & Yönetim Sistemleri Ulaşım Verileri)
  const handleExportExcel = () => {
    if (filteredVisitors.length === 0) {
      toast.warning("Dışa aktarılacak ziyaretçi kaydı bulunmuyor.");
      return;
    }

    const headers = [
      "Ziyaretçi Adı Soyadı",
      "Firma / Kurum",
      "Telefon",
      "Ziyaret Edilen Kişi / Bölüm",
      "Ziyaret Amacı",
      "Geldiği İl (Hareket Noktası)",
      "Geldiği İlçe (Hareket Noktası)",
      "Ulaşım Şekli",
      "Araçtaki Kişi Sayısı",
      "Araç Plakası",
      "Giriş Tarihi",
      "Giriş Saati",
      "Çıkış Tarihi",
      "Çıkış Saati",
      "Durum",
      "Kayıt Yöntemi",
      "Güvenlik Notu",
    ];

    const rows = filteredVisitors.map((v) => [
      `"${v.fullName}"`,
      `"${v.company || ""}"`,
      `"${v.phone || ""}"`,
      `"${v.visitedPersonOrDept}"`,
      `"${v.visitPurpose || ""}"`,
      `"${v.originProvince}"`,
      `"${v.originDistrict}"`,
      `"${v.transportMode}"`,
      v.vehiclePassengerCount || "",
      `"${v.licensePlate || ""}"`,
      `"${v.entryDate}"`,
      `"${v.entryTime}"`,
      `"${v.exitDate || ""}"`,
      `"${v.exitTime || ""}"`,
      `"${v.status === "inside" ? "İçeride" : "Çıkış Yaptı"}"`,
      `"${v.source}"`,
      `"${(v.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(";"), ...rows.map((e) => e.join(";"))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Midas_Ziyaretci_Raporu_${format(new Date(), "yyyyMMdd_HHmm")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Ziyaretçi ve ulaşım verileri Excel (CSV) formatında indirildi.");
  };

  return (
    <div className="w-full h-full min-w-full flex flex-col animate-in fade-in duration-200">
      <DataTable
        title={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Tab Seçici */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/60">
              <button
                onClick={() => {
                  setActiveTab("inside");
                  setPage(1);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer",
                  activeTab === "inside"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <UserCheck size={14} />
                <span>İçeridekiler</span>
                <span
                  className={cn(
                    "px-1.5 py-0.2 rounded-md text-[10px] font-black",
                    activeTab === "inside"
                      ? "bg-white/20 text-white"
                      : "bg-muted text-foreground"
                  )}
                >
                  {insideVisitors.length}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("history");
                  setPage(1);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer",
                  activeTab === "history"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <History size={14} />
                <span>Geçmiş Kayıtlar</span>
                <span
                  className={cn(
                    "px-1.5 py-0.2 rounded-md text-[10px] font-black",
                    activeTab === "history"
                      ? "bg-white/20 text-white"
                      : "bg-muted text-foreground"
                  )}
                >
                  {exitedVisitors.length}
                </span>
              </button>
            </div>

            {/* İstatistik Rozetleri */}
            <div className="hidden xl:flex items-center gap-1.5 ml-2">
              <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                Şu An İçeride: <strong className="font-black">{insideVisitors.length}</strong>
              </span>
              <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-secondary text-foreground border border-border">
                Bugün Toplam: <strong className="font-black">{todayVisitors.length}</strong>
              </span>
              <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                Araçlı: <strong className="font-black">{vehicleVisitors.length}</strong>
              </span>
            </div>
          </div>
        }
        icon={activeTab === "inside" ? <UserCheck size={16} /> : <History size={16} />}
        iconClassName="bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"
        hideTotalBadge
        columns={activeTab === "inside" ? INSIDE_COLUMNS : HISTORY_COLUMNS}
        data={paginatedVisitors}
        keyExtractor={(r) => r.id}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={(l) => {
          setLimit(l);
          setPage(1);
        }}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ["visitors"] })}
        isRefreshing={isFetching}
        isLoading={isLoading}
        heightClassName="h-full min-h-[500px]"
        headerActions={
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Arama Alanı (Debounced Search) */}
            <div className="relative w-36 sm:w-44 lg:w-52">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={14}
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                placeholder="Ad, firma, plaka..."
                className="w-full h-8 pl-8 pr-7 bg-muted/40 border border-border/80 rounded-lg text-xs font-bold placeholder:text-muted-foreground/60 outline-none focus:border-indigo-500 transition-all text-foreground"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Aramayı Temizle"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Tarih Filtresi */}
            <div className="flex items-center gap-1">
              <div className="relative">
                <select
                  value={datePreset}
                  onChange={(e) => {
                    setDatePreset(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 pl-2 pr-6 bg-muted/40 border border-border/80 rounded-lg text-xs font-bold text-foreground outline-none cursor-pointer appearance-none"
                  title="Tarih Filtresi"
                >
                  <option value="ALL">Tüm Tarihler</option>
                  <option value="TODAY">Bugün</option>
                  <option value="YESTERDAY">Dün</option>
                  <option value="THIS_WEEK">Bu Hafta</option>
                  <option value="THIS_MONTH">Bu Ay</option>
                  <option value="CUSTOM">Özel Aralık...</option>
                </select>
                <Calendar
                  size={12}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
              </div>

              {datePreset === "CUSTOM" && (
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => {
                      setCustomStartDate(e.target.value);
                      setPage(1);
                    }}
                    className="h-8 px-1.5 bg-muted/40 border border-border/80 rounded-lg text-[11px] font-bold text-foreground outline-none cursor-pointer"
                    title="Başlangıç Tarihi"
                  />
                  <span className="text-xs text-muted-foreground">-</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => {
                      setCustomEndDate(e.target.value);
                      setPage(1);
                    }}
                    className="h-8 px-1.5 bg-muted/40 border border-border/80 rounded-lg text-[11px] font-bold text-foreground outline-none cursor-pointer"
                    title="Bitiş Tarihi"
                  />
                </div>
              )}
            </div>

            {/* Excel Dışa Aktar Butonu */}
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-2.5 h-8 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg font-bold text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-xs"
              title="Excel Olarak İndir"
            >
              <FileSpreadsheet size={13} />
              <span className="hidden sm:inline">Excel</span>
            </button>

            {/* Yeni Ziyaretçi Ekle Butonu */}
            <button
              onClick={() => setIsNewVisitorOpen(true)}
              className="flex items-center gap-1.5 px-3 h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider shadow-sm shadow-indigo-600/20 transition-all cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <UserPlus size={14} />
              <span>Yeni Kayıt</span>
            </button>
          </div>
        }
        emptyTitle={
          activeTab === "inside"
            ? "Tesis İçerisinde Ziyaretçi Bulunmuyor"
            : "Henüz Geçmiş Ziyaretçi Kaydı Bulunamadı"
        }
        emptyDescription={
          searchTerm
            ? "Arama kriterlerinize uygun ziyaretçi kaydı bulunamadı."
            : activeTab === "inside"
            ? "Şu anda tesiste kayıtlı aktif misafir bulunmuyor. Yeni kayıt oluşturabilirsiniz."
            : "Seçili tarih aralığında çıkış yapmış ziyaretçi kaydı bulunmuyor."
        }
        emptyAction={
          activeTab === "inside" ? (
            <button
              onClick={() => setIsNewVisitorOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-xs"
            >
              + Yeni Ziyaretçi Ekle
            </button>
          ) : undefined
        }
        renderRow={(visitor) => {
          if (activeTab === "inside") {
            return (
              <tr
                key={visitor.id}
                className="hover:bg-muted/30 transition-colors font-medium text-foreground"
              >
                {/* Giriş Saati */}
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1.5 font-black text-xs text-indigo-600 dark:text-indigo-400">
                    <Clock size={13} />
                    <span>{visitor.entryTime}</span>
                  </div>
                </td>

                {/* Ad Soyad & Telefon */}
                <td className="py-2.5 px-3">
                  <div className="flex flex-col">
                    <span className="font-bold text-xs text-foreground">
                      {visitor.fullName}
                    </span>
                    {visitor.phone && (
                      <span className="text-[10px] text-muted-foreground font-semibold">
                        {visitor.phone}
                      </span>
                    )}
                  </div>
                </td>

                {/* Firma / Kurum */}
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                    {visitor.company ? (
                      <>
                        <Building2 size={13} className="text-muted-foreground shrink-0" />
                        <span className="truncate max-w-36">{visitor.company}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground italic font-normal text-[11px]">Bireysel</span>
                    )}
                  </div>
                </td>

                {/* Ziyaret Edilen Kişi / Bölüm */}
                <td className="py-2.5 px-3">
                  <div className="flex flex-col">
                    <span className="font-bold text-xs text-foreground">
                      {visitor.visitedPersonOrDept}
                    </span>
                    {visitor.visitPurpose && (
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {visitor.visitPurpose}
                      </span>
                    )}
                  </div>
                </td>

                {/* Geldiği Yer (İl / İlçe) */}
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1 text-xs font-bold text-foreground">
                    <MapPin size={12} className="text-indigo-500 shrink-0" />
                    <span>{visitor.originProvince}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-muted-foreground font-medium">{visitor.originDistrict}</span>
                  </div>
                </td>

                {/* Ulaşım Şekli & Plaka */}
                <td className="py-2.5 px-3">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 rounded bg-muted/40">
                        {visitor.transportMode}
                      </Badge>
                      {visitor.vehiclePassengerCount && visitor.vehiclePassengerCount > 1 && (
                        <span className="text-[9px] font-bold text-muted-foreground">
                          ({visitor.vehiclePassengerCount} kişi)
                        </span>
                      )}
                    </div>
                    {visitor.licensePlate && (
                      <span className="font-mono font-black text-[11px] uppercase tracking-wider text-foreground">
                        {visitor.licensePlate}
                      </span>
                    )}
                  </div>
                </td>

                {/* Güvenlik Notu */}
                <td className="py-2.5 px-3">
                  {visitor.notes ? (
                    <span
                      className="text-[11px] font-medium text-foreground line-clamp-2"
                      title={visitor.notes}
                    >
                      {visitor.notes}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40 text-[11px]">-</span>
                  )}
                </td>

                {/* Kayıt Türü */}
                <td className="py-2.5 px-3">
                  {visitor.source === "QR – Ziyaretçi Kaydı" ? (
                    <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 border-none text-[9px] font-bold gap-1 px-1.5 py-0.5">
                      <QrCode size={10} />
                      QR
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[9px] font-bold gap-1 px-1.5 py-0.5">
                      <Shield size={10} />
                      Manuel
                    </Badge>
                  )}
                </td>

                {/* Çıkış Yap Butonu */}
                <td className="py-2.5 px-3 text-right">
                  <button
                    onClick={() => handleOpenExitDialog(visitor)}
                    className="h-7 px-2.5 rounded-lg bg-destructive/10 hover:bg-destructive text-destructive hover:text-white font-bold text-[11px] uppercase tracking-wider border border-destructive/20 transition-all cursor-pointer active:scale-95 inline-flex items-center gap-1"
                  >
                    <LogOut size={12} />
                    <span>Çıkış Yap</span>
                  </button>
                </td>
              </tr>
            );
          }

          // Geçmiş Kayıtlar Satırı
          return (
            <tr
              key={visitor.id}
              className="hover:bg-muted/30 transition-colors font-medium text-foreground"
            >
              {/* Tarih */}
              <td className="py-2.5 px-3">
                <span className="font-bold text-xs text-foreground">
                  {visitor.entryDate}
                </span>
              </td>

              {/* Giriş - Çıkış Saati */}
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <span className="text-indigo-600 dark:text-indigo-400">{visitor.entryTime}</span>
                  <span className="text-muted-foreground font-normal">→</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{visitor.exitTime || "-"}</span>
                </div>
              </td>

              {/* Ad Soyad */}
              <td className="py-2.5 px-3">
                <div className="flex flex-col">
                  <span className="font-bold text-xs text-foreground">
                    {visitor.fullName}
                  </span>
                  {visitor.phone && (
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      {visitor.phone}
                    </span>
                  )}
                </div>
              </td>

              {/* Firma */}
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                  {visitor.company ? (
                    <>
                      <Building2 size={13} className="text-muted-foreground shrink-0" />
                      <span className="truncate max-w-36">{visitor.company}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground italic font-normal text-[11px]">Bireysel</span>
                  )}
                </div>
              </td>

              {/* Görüşülen Kişi / Bölüm */}
              <td className="py-2.5 px-3">
                <div className="flex flex-col">
                  <span className="font-bold text-xs text-foreground">
                    {visitor.visitedPersonOrDept}
                  </span>
                  {visitor.visitPurpose && (
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {visitor.visitPurpose}
                    </span>
                  )}
                </div>
              </td>

              {/* Geldiği Yer */}
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-1 text-xs font-bold text-foreground">
                  <MapPin size={12} className="text-indigo-500 shrink-0" />
                  <span>{visitor.originProvince}</span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-muted-foreground font-medium">{visitor.originDistrict}</span>
                </div>
              </td>

              {/* Ulaşım & Plaka */}
              <td className="py-2.5 px-3">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 rounded bg-muted/40">
                      {visitor.transportMode}
                    </Badge>
                    {visitor.vehiclePassengerCount && visitor.vehiclePassengerCount > 1 && (
                      <span className="text-[9px] font-bold text-muted-foreground">
                        ({visitor.vehiclePassengerCount} kişi)
                      </span>
                    )}
                  </div>
                  {visitor.licensePlate && (
                    <span className="font-mono font-black text-[11px] uppercase tracking-wider text-foreground">
                      {visitor.licensePlate}
                    </span>
                  )}
                </div>
              </td>

              {/* Güvenlik Notu */}
              <td className="py-2.5 px-3">
                {visitor.notes ? (
                  <span
                    className="text-[11px] font-medium text-foreground line-clamp-2"
                    title={visitor.notes}
                  >
                    {visitor.notes}
                  </span>
                ) : (
                  <span className="text-muted-foreground/40 text-[11px]">-</span>
                )}
              </td>

              {/* Kayıt Türü */}
              <td className="py-2.5 px-3">
                {visitor.source === "QR – Ziyaretçi Kaydı" ? (
                  <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-none text-[9px] font-bold gap-1 px-1.5 py-0.5">
                    <QrCode size={10} />
                    QR
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[9px] font-bold gap-1 px-1.5 py-0.5">
                    <Shield size={10} />
                    Manuel
                  </Badge>
                )}
              </td>
            </tr>
          );
        }}
      />

      {/* MODAL: YENİ ZİYARETÇİ EKLE */}
      <NewVisitorDialog
        open={isNewVisitorOpen}
        onOpenChange={setIsNewVisitorOpen}
        onSubmit={handleCreateVisitor}
      />

      {/* MODAL: ZİYARETÇİ ÇIKIŞ İŞLEMİ */}
      <VisitorExitDialog
        open={isExitDialogOpen}
        onOpenChange={setIsExitDialogOpen}
        visitor={selectedVisitorForExit}
        onConfirmExit={handleConfirmExit}
      />
    </div>
  );
}
