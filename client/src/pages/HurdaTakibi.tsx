import React, { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  Search,
  Plus,
  Trash2,
  Edit3,
  Eye,
  FileSpreadsheet,
  X,
  Clock,
  Loader2,
  Calendar,
  ListFilter,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import apiClient from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";
import DataTable, { type DataTableColumn } from "@/components/common/DataTable";
import ScrapFormModal from "@/components/scrap/ScrapFormModal";
import {
  type ScrapRecord,
  DEFAULT_LOCATIONS,
  KARAT_OPTIONS,
  DEFAULT_SCRAP_REASONS,
  DEFAULT_SCRAP_IMAGE,
} from "@/types/scrap";

const SCRAP_COLUMNS: DataTableColumn<ScrapRecord>[] = [
  { header: "Görsel", align: "center", width: "55px" },
  { header: "Tarih", width: "95px" },
  { header: "Saat", width: "70px" },
  { header: "Sipariş No", width: "115px" },
  { header: "Ayar / Renk", width: "105px" },
  { header: "Açıklama (Model)" },
  { header: "Tel Kodu", width: "105px" },
  { header: "Hurda Yeri", width: "110px" },
  { header: "Hurda Nedeni", width: "140px" },
  { header: "Durum", width: "100px" },
  { header: "Hata / Not" },
  { header: "İşlemler", align: "center", width: "80px" },
];

export default function HurdaTakibi() {
  // Veri ve Yüklenme Durumları
  const [records, setRecords] = useState<ScrapRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Arama ve Filtre State
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 400); // Debounce: Kullanıcı yazmayı bıraktıktan 400ms sonra backend isteği atılır
  const [selectedKarat, setSelectedKarat] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL"); // ALL, SCRAP, PENDING
  const [selectedLocation, setSelectedLocation] = useState<string>("ALL");
  const [selectedReason, setSelectedReason] = useState<string>("ALL");

  // Tarih Filtresi State
  const [datePreset, setDatePreset] = useState<string>("ALL"); // ALL, TODAY, YESTERDAY, THIS_WEEK, THIS_MONTH, CUSTOM
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  // Açılır/Kapanır Filtre Paneli State
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Aktif Filtre Sayısı
  const activeFilterCount =
    (datePreset !== "ALL" ? 1 : 0) +
    (selectedReason !== "ALL" ? 1 : 0) +
    (selectedKarat !== "ALL" ? 1 : 0) +
    (selectedStatus !== "ALL" ? 1 : 0) +
    (selectedLocation !== "ALL" ? 1 : 0);

  // Filtreleri Sıfırlama
  const handleResetFilters = () => {
    setDatePreset("ALL");
    setCustomStartDate("");
    setCustomEndDate("");
    setSelectedReason("ALL");
    setSelectedKarat("ALL");
    setSelectedStatus("ALL");
    setSelectedLocation("ALL");
    setPage(1);
  };

  // Mobil Pull-to-Refresh State & Handlers
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 5) {
      setTouchStart(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStart;
    if (diff > 0) {
      setPullDistance(Math.min(diff, 80));
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance >= 60 && !isLoading) {
      toast.info("Kayıtlar yenileniyor...");
      fetchRecords();
    }
    setTouchStart(null);
    setPullDistance(0);
  };

  // Sayfalama (Pagination) State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Global İstatistikler
  const [stats, setStats] = useState({
    total: 0,
    scrapCount: 0,
    pendingCount: 0,
    withImage: 0,
  });

  // Modal Durumları
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ScrapRecord | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  // Backend'den Verileri Çekme (Debounced Search, Tarih ve Neden Filtreleri Entegre)
  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      let startDateParam: string | undefined;
      let endDateParam: string | undefined;

      const today = new Date();
      const formatYmd = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      if (datePreset === "TODAY") {
        startDateParam = formatYmd(today);
        endDateParam = formatYmd(today);
      } else if (datePreset === "YESTERDAY") {
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        startDateParam = formatYmd(y);
        endDateParam = formatYmd(y);
      } else if (datePreset === "THIS_WEEK") {
        const d = new Date(today);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Pazartesi
        const monday = new Date(d.setDate(diff));
        startDateParam = formatYmd(monday);
        endDateParam = formatYmd(today);
      } else if (datePreset === "THIS_MONTH") {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        startDateParam = formatYmd(firstDay);
        endDateParam = formatYmd(today);
      } else if (datePreset === "CUSTOM") {
        if (customStartDate) startDateParam = customStartDate;
        if (customEndDate) endDateParam = customEndDate;
      }

      const res = await apiClient.get("/scrap-tracking", {
        params: {
          search: debouncedSearch.trim() || undefined,
          karat: selectedKarat !== "ALL" ? selectedKarat : undefined,
          is_scrap:
            selectedStatus === "SCRAP"
              ? "true"
              : selectedStatus === "PENDING"
              ? "false"
              : undefined,
          scrap_location: selectedLocation !== "ALL" ? selectedLocation : undefined,
          scrap_reason: selectedReason !== "ALL" ? selectedReason : undefined,
          start_date: startDateParam,
          end_date: endDateParam,
          page,
          limit,
        },
      });

      setRecords(res.data.data || []);
      setTotalCount(res.data.totalCount || 0);
      setTotalPages(res.data.totalPages || 1);
      if (res.data.stats) {
        setStats(res.data.stats);
      }
    } catch (error) {
      console.error("Hurda kayıtları yüklenemedi:", error);
      toast.error("Hurda kayıtları yüklenirken bir sorun oluştu.");
    } finally {
      setIsLoading(false);
    }
  }, [
    debouncedSearch,
    selectedKarat,
    selectedStatus,
    selectedLocation,
    selectedReason,
    datePreset,
    customStartDate,
    customEndDate,
    page,
    limit,
  ]);

  // Filtreler veya sayfa değiştiğinde backend sorgusunu tetikle
  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Yeni Kayıt Aç veya Düzenle
  const handleOpenModal = (record?: ScrapRecord) => {
    setEditingRecord(record || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
  };

  // Kayıt Sil
  const handleDelete = async (id: number) => {
    if (!window.confirm("Bu hurda kaydını silmek istediğinize emin misiniz?")) return;
    setIsDeleting(id);
    try {
      await apiClient.delete(`/scrap-tracking/${id}`);
      toast.success("Kayıt başarıyla silindi.");
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setTotalCount((prev) => Math.max(prev - 1, 0));
    } catch {
      toast.error("Kayıt silinirken hata oluştu.");
    } finally {
      setIsDeleting(null);
    }
  };

  // Excel Dışa Aktar (Backend Filtreli Tüm Veriyi İndirme)
  const exportToExcel = async () => {
    try {
      toast.info("Excel verileri hazırlanıyor...");

      let startDateParam: string | undefined;
      let endDateParam: string | undefined;

      const today = new Date();
      const formatYmd = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      if (datePreset === "TODAY") {
        startDateParam = formatYmd(today);
        endDateParam = formatYmd(today);
      } else if (datePreset === "YESTERDAY") {
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        startDateParam = formatYmd(y);
        endDateParam = formatYmd(y);
      } else if (datePreset === "THIS_WEEK") {
        const d = new Date(today);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        startDateParam = formatYmd(monday);
        endDateParam = formatYmd(today);
      } else if (datePreset === "THIS_MONTH") {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        startDateParam = formatYmd(firstDay);
        endDateParam = formatYmd(today);
      } else if (datePreset === "CUSTOM") {
        if (customStartDate) startDateParam = customStartDate;
        if (customEndDate) endDateParam = customEndDate;
      }

      const res = await apiClient.get("/scrap-tracking", {
        params: {
          search: debouncedSearch.trim() || undefined,
          karat: selectedKarat !== "ALL" ? selectedKarat : undefined,
          is_scrap:
            selectedStatus === "SCRAP"
              ? "true"
              : selectedStatus === "PENDING"
              ? "false"
              : undefined,
          scrap_location: selectedLocation !== "ALL" ? selectedLocation : undefined,
          scrap_reason: selectedReason !== "ALL" ? selectedReason : undefined,
          start_date: startDateParam,
          end_date: endDateParam,
          page: 1,
          limit: 10000,
        },
      });

      const dataToExport: ScrapRecord[] = res.data.data || records;
      if (dataToExport.length === 0) {
        toast.warning("Dışa aktarılacak kayıt bulunmuyor.");
        return;
      }

      const headers = [
        "Sipariş No",
        "Ayar",
        "Renk",
        "Açıklama",
        "Tel Kodu",
        "Hurda Yeri",
        "Hurda Nedeni",
        "Hurda Durumu",
        "Hata / Not",
        "Görsel Linki",
        "Kayıt Tarihi",
      ];

      const rows = dataToExport.map((r) => [
        `"${r.order_no}"`,
        `"${r.karat || ""}"`,
        `"${r.color || ""}"`,
        `"${(r.description || "").replace(/"/g, '""')}"`,
        `"${r.wire_code || ""}"`,
        `"${r.scrap_location || ""}"`,
        `"${r.scrap_reason || ""}"`,
        `"${r.is_scrap ? "HURDA" : "TAKİPTE"}"`,
        `"${(r.defect_note || "").replace(/"/g, '""')}"`,
        `"${r.image_url ? window.location.origin + r.image_url : ""}"`,
        `"${format(new Date(r.created_at), "yyyy-MM-dd HH:mm")}"`,
      ]);

      const csvContent =
        "\uFEFF" + [headers.join(";"), ...rows.map((row) => row.join(";"))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Hurda_Takibi_${format(new Date(), "yyyyMMdd_HHmm")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Excel formatında dışa aktarıldı.");
    } catch {
      toast.error("Excel verisi alınırken hata oluştu.");
    }
  };

  return (
    <div
      className="w-full h-full min-w-full flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Mobil Pull-to-Refresh Görsel Göstergesi */}
      {pullDistance > 15 && (
        <div
          style={{ height: `${pullDistance}px` }}
          className="flex items-center justify-center text-xs font-bold text-rose-500 overflow-hidden transition-all duration-75 shrink-0 bg-rose-500/5 border-b border-rose-500/20"
        >
          <RotateCcw
            size={14}
            className={cn("mr-1.5 transition-transform", pullDistance >= 60 ? "animate-spin text-rose-500" : "")}
            style={{ transform: `rotate(${pullDistance * 4}deg)` }}
          />
          <span>{pullDistance >= 60 ? "Yenilemek için bırakın" : "Yenilemek için çekin"}</span>
        </div>
      )}

      {/* REUSABLE DATA TABLE (BAŞLIK, İSTATİSTİKLER, ARAMA, FİLTRELER VE BUTONLAR TEK BİRLEŞİK HEADER'DA) */}
      <DataTable
        title={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-sm uppercase tracking-tight text-foreground">
              Hurda & Kalite Takibi
            </span>
            <div className="flex items-center gap-1.5 ml-1">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-secondary text-foreground border border-border">
                Toplam: <strong className="font-black">{stats.total}</strong>
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-500 border border-rose-500/20">
                Hurda: <strong className="font-black">{stats.scrapCount}</strong>
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20">
                Takipte: <strong className="font-black">{stats.pendingCount}</strong>
              </span>
            </div>
          </div>
        }
        icon={<AlertTriangle size={16} />}
        iconClassName="bg-rose-500/10 text-rose-500 border border-rose-500/20"
        hideTotalBadge
        columns={SCRAP_COLUMNS}
        data={records}
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
        isLoading={isLoading}
        heightClassName="h-full min-h-[500px]"
        headerActions={
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
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
                placeholder="Sipariş no, model..."
                className="w-full h-8 pl-8 pr-7 bg-muted/40 border border-border/80 rounded-lg text-xs font-bold placeholder:text-muted-foreground/60 outline-none focus:border-rose-500 transition-all text-foreground"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
                {searchTerm !== debouncedSearch ? (
                  <span title="Yazmayı bıraktığınızda aranacak (Debounce)">
                    <Loader2 size={12} className="animate-spin text-muted-foreground" />
                  </span>
                ) : searchTerm ? (
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setPage(1);
                    }}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Aramayı Temizle"
                  >
                    <X size={12} />
                  </button>
                ) : null}
              </div>
            </div>

            {/* Açılır / Kapanır Filtre Butonu */}
            <button
              type="button"
              onClick={() => setIsFilterOpen((prev) => !prev)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 sm:px-3 h-8 rounded-lg font-bold text-xs transition-all cursor-pointer active:scale-95 border",
                isFilterOpen || activeFilterCount > 0
                  ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/80"
              )}
              title="Filtreleme seçeneklerini göster / gizle"
            >
              <ListFilter size={13} />
              <span className="hidden xs:inline sm:inline">Filtreler</span>
              {activeFilterCount > 0 && (
                <span className="min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-black">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown
                size={13}
                className={cn(
                  "transition-transform duration-200",
                  isFilterOpen && "rotate-180"
                )}
              />
            </button>

            {/* Excel Dışa Aktar Butonu */}
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1.5 px-2.5 h-8 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg font-bold text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-xs"
              title="Excel Olarak İndir"
            >
              <FileSpreadsheet size={13} />
              <span className="hidden sm:inline">Excel</span>
            </button>

            {/* Yenile Butonu (Masaüstünde Excel'in hemen yanında, mobilde gizli) */}
            <button
              onClick={fetchRecords}
              disabled={isLoading}
              className="hidden sm:flex items-center gap-1.5 px-2.5 h-8 bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground border border-border/80 rounded-lg font-bold text-xs transition-colors cursor-pointer active:scale-95 disabled:opacity-50 shadow-xs"
              title="Kayıtları Yenile"
            >
              <RotateCcw
                size={13}
                className={isLoading ? "animate-spin text-rose-500" : ""}
              />
              <span>Yenile</span>
            </button>

            {/* Yeni Hurda Kaydı Butonu */}
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-1.5 px-3 h-8 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider shadow-sm shadow-rose-600/20 transition-all cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <Plus size={14} />
              <span>Yeni Kayıt</span>
            </button>
          </div>
        }
        filterContent={
          (isFilterOpen || activeFilterCount > 0) ? (
            <div className="space-y-2">
              {/* AÇILIR KAPANIR FİLTRE PANELİ */}
              {isFilterOpen && (
                <div className="p-2.5 sm:p-3 rounded-xl bg-secondary/40 border border-border/80 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mr-1">
                    <ListFilter size={13} className="text-rose-500" />
                    <span>Filtrele:</span>
                  </div>

                  {/* Tarih Filtresi */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="relative">
                      <select
                        value={datePreset}
                        onChange={(e) => {
                          setDatePreset(e.target.value);
                          setPage(1);
                        }}
                        className="h-8 pl-2.5 pr-7 bg-background/80 border border-border/80 rounded-lg text-xs font-bold text-foreground outline-none cursor-pointer appearance-none hover:border-border transition-colors"
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
                          className="h-8 px-2 bg-background/80 border border-border/80 rounded-lg text-[11px] font-bold text-foreground outline-none cursor-pointer"
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
                          className="h-8 px-2 bg-background/80 border border-border/80 rounded-lg text-[11px] font-bold text-foreground outline-none cursor-pointer"
                          title="Bitiş Tarihi"
                        />
                      </div>
                    )}
                  </div>

                  {/* Hurda Nedeni Filtresi */}
                  <select
                    value={selectedReason}
                    onChange={(e) => {
                      setSelectedReason(e.target.value);
                      setPage(1);
                    }}
                    className="h-8 px-2.5 bg-background/80 border border-border/80 rounded-lg text-xs font-bold text-foreground outline-none cursor-pointer max-w-44 truncate hover:border-border transition-colors"
                    title="Hurda Nedeni Filtresi"
                  >
                    <option value="ALL">Tüm Nedenler</option>
                    {DEFAULT_SCRAP_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>

                  {/* Ayar Filtresi */}
                  <select
                    value={selectedKarat}
                    onChange={(e) => {
                      setSelectedKarat(e.target.value);
                      setPage(1);
                    }}
                    className="h-8 px-2.5 bg-background/80 border border-border/80 rounded-lg text-xs font-bold text-foreground outline-none cursor-pointer hover:border-border transition-colors"
                    title="Ayar Filtresi"
                  >
                    <option value="ALL">Tüm Ayarlar</option>
                    {KARAT_OPTIONS.map((k) => (
                      <option key={k} value={k}>
                        {k} Ayar
                      </option>
                    ))}
                  </select>

                  {/* Durum Filtresi */}
                  <select
                    value={selectedStatus}
                    onChange={(e) => {
                      setSelectedStatus(e.target.value);
                      setPage(1);
                    }}
                    className="h-8 px-2.5 bg-background/80 border border-border/80 rounded-lg text-xs font-bold text-foreground outline-none cursor-pointer hover:border-border transition-colors"
                    title="Durum Filtresi"
                  >
                    <option value="ALL">Tüm Durumlar</option>
                    <option value="SCRAP">Hurda</option>
                    <option value="PENDING">Takipte</option>
                  </select>

                  {/* İstasyon Filtresi */}
                  <select
                    value={selectedLocation}
                    onChange={(e) => {
                      setSelectedLocation(e.target.value);
                      setPage(1);
                    }}
                    className="h-8 px-2.5 bg-background/80 border border-border/80 rounded-lg text-xs font-bold text-foreground outline-none cursor-pointer max-w-36 truncate hover:border-border transition-colors"
                    title="İstasyon / Bölüm Filtresi"
                  >
                    <option value="ALL">Tüm İstasyonlar</option>
                    {DEFAULT_LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>

                  {/* Sıfırla Butonu (Aktif filtre varsa panel içinde) */}
                  {activeFilterCount > 0 && (
                    <button
                      onClick={handleResetFilters}
                      className="flex items-center gap-1 px-2.5 h-8 text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors ml-auto cursor-pointer"
                      title="Tüm filtreleri sıfırla"
                    >
                      <RotateCcw size={12} />
                      <span>Filtreleri Sıfırla</span>
                    </button>
                  )}
                </div>
              )}

              {/* AKTİF FİLTRE ROZETLERİ (CHIPS) - Panel kapalıyken seçili filtreleri gösterir */}
              {activeFilterCount > 0 && !isFilterOpen && (
                <div className="flex items-center gap-1.5 flex-wrap px-1 text-xs">
                  <span className="text-[11px] font-bold text-muted-foreground mr-0.5">
                    Aktif Filtreler:
                  </span>

                  {datePreset !== "ALL" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-foreground border border-border text-[11px] font-bold">
                      <span>
                        Tarih:{" "}
                        {datePreset === "TODAY"
                          ? "Bugün"
                          : datePreset === "YESTERDAY"
                          ? "Dün"
                          : datePreset === "THIS_WEEK"
                          ? "Bu Hafta"
                          : datePreset === "THIS_MONTH"
                          ? "Bu Ay"
                          : "Özel"}
                      </span>
                      <button
                        onClick={() => {
                          setDatePreset("ALL");
                          setPage(1);
                        }}
                        className="hover:text-rose-500 cursor-pointer ml-0.5"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  )}

                  {selectedReason !== "ALL" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-foreground border border-border text-[11px] font-bold">
                      <span>Neden: {selectedReason}</span>
                      <button
                        onClick={() => {
                          setSelectedReason("ALL");
                          setPage(1);
                        }}
                        className="hover:text-rose-500 cursor-pointer ml-0.5"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  )}

                  {selectedKarat !== "ALL" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-foreground border border-border text-[11px] font-bold">
                      <span>{selectedKarat} Ayar</span>
                      <button
                        onClick={() => {
                          setSelectedKarat("ALL");
                          setPage(1);
                        }}
                        className="hover:text-rose-500 cursor-pointer ml-0.5"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  )}

                  {selectedStatus !== "ALL" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-foreground border border-border text-[11px] font-bold">
                      <span>
                        Durum: {selectedStatus === "SCRAP" ? "Hurda" : "Takipte"}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedStatus("ALL");
                          setPage(1);
                        }}
                        className="hover:text-rose-500 cursor-pointer ml-0.5"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  )}

                  {selectedLocation !== "ALL" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-foreground border border-border text-[11px] font-bold">
                      <span>Bölüm: {selectedLocation}</span>
                      <button
                        onClick={() => {
                          setSelectedLocation("ALL");
                          setPage(1);
                        }}
                        className="hover:text-rose-500 cursor-pointer ml-0.5"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  )}

                  <button
                    onClick={handleResetFilters}
                    className="text-[11px] font-bold text-rose-500 hover:text-rose-600 hover:underline ml-1 cursor-pointer"
                  >
                    Temizle
                  </button>
                </div>
              )}
            </div>
          ) : null
        }
        emptyTitle="Henüz Kayıt Bulunamadı"
        emptyDescription="Arama kriterlerinize uygun hurda kaydı bulunamadı veya henüz hiçbir kayıt girilmemiş."
        emptyAction={
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-xs"
          >
            Yeni Hurda Kaydı Ekle
          </button>
        }
        renderRow={(record) => {
          const recDate = new Date(record.created_at);
          const dateStr = recDate.toLocaleDateString("tr-TR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });
          const timeStr = recDate.toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <tr
              key={record.id}
              className="hover:bg-muted/30 transition-colors font-medium text-foreground"
            >
              {/* Görsel Thumbnail */}
              <td className="py-2.5 px-3 text-center">
                <button
                  onClick={() => setPreviewImage(record.image_url || DEFAULT_SCRAP_IMAGE)}
                  className="w-10 h-10 rounded-lg overflow-hidden border border-border/80 bg-black/5 hover:border-rose-500 hover:scale-105 transition-all cursor-pointer relative group/img shadow-2xs mx-auto block"
                  title="Görseli İncele (Büyüt)"
                >
                  <img
                    src={record.image_url || DEFAULT_SCRAP_IMAGE}
                    alt={record.order_no}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity text-white">
                    <Eye size={13} />
                  </div>
                </button>
              </td>

              {/* Tarih */}
              <td className="py-2.5 px-3 font-mono text-muted-foreground font-bold whitespace-nowrap">
                {dateStr}
              </td>

              {/* Saat */}
              <td className="py-2.5 px-3 font-mono text-muted-foreground font-bold whitespace-nowrap">
                {timeStr}
              </td>

              {/* Sipariş No */}
              <td className="py-2.5 px-3 font-mono font-black text-foreground whitespace-nowrap">
                <span className="px-2 py-0.5 rounded bg-secondary border border-border font-bold">
                  #{record.order_no}
                </span>
              </td>

              {/* Ayar & Renk */}
              <td className="py-2.5 px-3 font-bold text-foreground whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-black text-[11px]">
                    {record.karat ? `${record.karat}K` : "-"}
                  </span>
                  {record.color && (
                    <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-black text-[11px]">
                      {record.color}
                    </span>
                  )}
                </div>
              </td>

              {/* Açıklama */}
              <td className="py-2.5 px-3 font-bold text-foreground max-w-xs truncate" title={record.description || ""}>
                {record.description || "-"}
              </td>

              {/* Tel Kodu */}
              <td className="py-2.5 px-3 font-mono font-bold text-muted-foreground whitespace-nowrap">
                {record.wire_code || "-"}
              </td>

              {/* Hurda Yeri */}
              <td className="py-2.5 px-3 font-bold whitespace-nowrap">
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[11px]">
                  {record.scrap_location || "BELİRTİLMEDİ"}
                </span>
              </td>

              {/* Hurda Nedeni */}
              <td className="py-2.5 px-3 whitespace-nowrap">
                {record.scrap_reason ? (
                  <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[11px] font-bold">
                    {record.scrap_reason}
                  </span>
                ) : (
                  <span className="text-muted-foreground/60 text-xs font-medium">-</span>
                )}
              </td>

              {/* Hurda Durumu */}
              <td className="py-2.5 px-3 whitespace-nowrap">
                {record.is_scrap ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-xs">
                    <AlertTriangle size={11} />
                    HURDA
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-amber-600 text-white shadow-xs">
                    <Clock size={11} />
                    TAKİPTE
                  </span>
                )}
              </td>

              {/* Hata Notu */}
              <td className="py-2.5 px-3 text-muted-foreground font-medium max-w-sm truncate" title={record.defect_note || ""}>
                {record.defect_note || "-"}
              </td>

              {/* İşlemler */}
              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={() => handleOpenModal(record)}
                    className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Düzenle"
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(record.id)}
                    disabled={isDeleting === record.id}
                    className="p-1.5 hover:bg-rose-500/10 rounded-lg text-muted-foreground hover:text-rose-500 transition-colors cursor-pointer"
                    title="Sil"
                  >
                    {isDeleting === record.id ? (
                      <Loader2 size={15} className="animate-spin text-rose-500" />
                    ) : (
                      <Trash2 size={15} />
                    )}
                  </button>
                </div>
              </td>
            </tr>
          );
        }}
      />

      {/* YENİ KAYIT / DÜZENLEME MODALI */}
      <ScrapFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={fetchRecords}
        initialRecord={editingRecord}
      />

      {/* GÖRSELİ BÜYÜTÜP İNCELEME LIGHTBOX MODALI */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[85vh] bg-card border border-border rounded-3xl overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="p-3.5 border-b border-border bg-card/80 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                <AlertTriangle size={15} className="text-rose-500" />
                Hurda / Mikroskop Hata Görseli
              </span>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1.5 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-black/30">
              <img
                src={previewImage}
                alt="Hurda Detay"
                className="max-w-full max-h-[72vh] object-contain rounded-xl shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
