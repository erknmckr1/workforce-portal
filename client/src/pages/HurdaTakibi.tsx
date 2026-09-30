import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  AlertTriangle,
  Search,
  Plus,
  Trash2,
  Edit3,
  Eye,
  FileSpreadsheet,
  X,
  Upload,
  Clock,
  Loader2,
  Calendar,
} from "lucide-react";
import apiClient from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import { useDebounce } from "@/hooks/useDebounce";
import DataTable, { type DataTableColumn } from "@/components/common/DataTable";

interface ScrapRecord {
  id: number;
  order_no: string;
  karat: string | null;
  color: string | null;
  description: string | null;
  wire_code: string | null;
  defect_note: string | null;
  is_scrap: boolean;
  scrap_location: string | null;
  scrap_reason: string | null;
  image_url: string | null;
  operator_id: string | null;
  created_at: string;
  updated_at: string;
  Operator?: {
    id_dec: string;
    name: string;
    surname: string;
  };
}

const DEFAULT_LOCATIONS = [
  "ÖRME",
  "DÖKÜM",
  "CİLA",
  "TEL ÇEKME",
  "BUZLAMA",
  "ÇEKİÇ",
  "KURU TIRAŞ",
  "TASLAMA",
  "KALİTE KONTROL",
];
const KARAT_OPTIONS = ["8", "9", "10", "14", "18", "21", "22"];
const COLOR_OPTIONS = [
  { code: "Y", label: "Y - Yeşil / Sarı" },
  { code: "K", label: "K - Kırmızı / Rose" },
  { code: "B", label: "B - Beyaz" },
];

const DEFAULT_SCRAP_IMAGE = "/images/sample-scrap.svg";

const DEFAULT_SCRAP_REASONS = [
  "Döküm Boşluğu / Porozite",
  "Çatlak / Kırık",
  "Tel Kopması / Ezilme",
  "Ölçü / Tolerans Dışı",
  "Kaynak / Lehim Hatası",
  "Yüzey Hatası / Çizik",
  "Renk / Alaşım Bozukluğu",
  "Çapak / Deformasyon",
  "Yanlış Montaj / Taş Düşmesi",
  "Diğer",
];

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

  // Form State
  const [formOrderNo, setFormOrderNo] = useState("");
  const [formKarat, setFormKarat] = useState("");
  const [formColor, setFormColor] = useState("Y");
  const [formDescription, setFormDescription] = useState("");
  const [formWireCode, setFormWireCode] = useState("");
  const [formDefectNote, setFormDefectNote] = useState("");
  const [formIsScrap, setFormIsScrap] = useState(true);
  const [formScrapLocation, setFormScrapLocation] = useState("ÖRME");
  const [formScrapReason, setFormScrapReason] = useState("Döküm Boşluğu / Porozite");
  const [formCustomReason, setFormCustomReason] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isFetchingSap, setIsFetchingSap] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // SAP'den Sipariş Bilgisi Sorgula
  const handleFetchSapOrder = async (orderNo: string) => {
    const clean = orderNo.trim();
    if (!clean) return;
    setIsFetchingSap(true);
    try {
      const res = await apiClient.get(`/scrap-tracking/order/${clean}`);
      const data = res.data;
      if (data) {
        if (data.karat) setFormKarat(data.karat);
        if (data.color) setFormColor(data.color);
        if (data.description) setFormDescription(data.description);
        toast.success(`Sipariş bilgileri SAP'den getirildi (${clean})`);
      }
    } catch {
      // Bulunamadıysa sessizce devam et
    } finally {
      setIsFetchingSap(false);
    }
  };

  // Yeni Kayıt Aç veya Düzenle
  const handleOpenModal = (record?: ScrapRecord) => {
    if (record) {
      setEditingRecord(record);
      setFormOrderNo(record.order_no);
      setFormKarat(record.karat || "");
      setFormColor(record.color || "Y");
      setFormDescription(record.description || "");
      setFormWireCode(record.wire_code || "");
      setFormDefectNote(record.defect_note || "");
      setFormIsScrap(record.is_scrap);
      setFormScrapLocation(record.scrap_location || "ÖRME");

      const isKnownReason = DEFAULT_SCRAP_REASONS.includes(record.scrap_reason || "");
      if (record.scrap_reason) {
        if (isKnownReason) {
          setFormScrapReason(record.scrap_reason);
          setFormCustomReason("");
        } else {
          setFormScrapReason("Diğer");
          setFormCustomReason(record.scrap_reason);
        }
      } else {
        setFormScrapReason("Döküm Boşluğu / Porozite");
        setFormCustomReason("");
      }

      setSelectedFile(null);
      setFilePreviewUrl(record.image_url || null);
    } else {
      setEditingRecord(null);
      setFormOrderNo("");
      setFormKarat("");
      setFormColor("Y");
      setFormDescription("");
      setFormWireCode("");
      setFormDefectNote("");
      setFormIsScrap(true);
      setFormScrapLocation("ÖRME");
      setFormScrapReason("Döküm Boşluğu / Porozite");
      setFormCustomReason("");
      setSelectedFile(null);
      setFilePreviewUrl(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
    setSelectedFile(null);
    setFilePreviewUrl(null);
  };

  // Dosya Seçildiğinde
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setFilePreviewUrl(URL.createObjectURL(file));
    }
  };

  // Form Kaydet
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formOrderNo.trim()) {
      toast.error("Lütfen Sipariş Numarasını giriniz.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("order_no", formOrderNo.trim());
      formData.append("karat", formKarat.trim());
      formData.append("color", formColor.trim());
      formData.append("description", formDescription.trim());
      formData.append("wire_code", formWireCode.trim());
      formData.append("defect_note", formDefectNote.trim());
      formData.append("is_scrap", String(formIsScrap));
      formData.append("scrap_location", formScrapLocation.trim());

      const finalReason =
        formScrapReason === "Diğer"
          ? formCustomReason.trim() || "Diğer"
          : formScrapReason;
      formData.append("scrap_reason", finalReason.trim());

      if (selectedFile) {
        formData.append("image", selectedFile);
      }

      if (editingRecord) {
        await apiClient.put(`/scrap-tracking/${editingRecord.id}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Hurda kaydı başarıyla güncellendi.");
      } else {
        await apiClient.post("/scrap-tracking", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Yeni hurda kaydı oluşturuldu.");
      }

      handleCloseModal();
      fetchRecords();
    } catch (error: unknown) {
      console.error("Kaydetme hatası:", error);
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Kayıt kaydedilirken hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
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
    <div className="w-full h-full min-w-full flex flex-col">
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
        onRefresh={fetchRecords}
        isRefreshing={isLoading}
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

            {/* Hurda Nedeni Filtresi */}
            <select
              value={selectedReason}
              onChange={(e) => {
                setSelectedReason(e.target.value);
                setPage(1);
              }}
              className="h-8 px-2 bg-muted/40 border border-border/80 rounded-lg text-xs font-bold text-foreground outline-none cursor-pointer max-w-36 truncate"
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
              className="h-8 px-2 bg-muted/40 border border-border/80 rounded-lg text-xs font-bold text-foreground outline-none cursor-pointer"
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
              className="h-8 px-2 bg-muted/40 border border-border/80 rounded-lg text-xs font-bold text-foreground outline-none cursor-pointer"
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
              className="h-8 px-2 bg-muted/40 border border-border/80 rounded-lg text-xs font-bold text-foreground outline-none cursor-pointer max-w-32 truncate"
            >
              <option value="ALL">Tüm İstasyonlar</option>
              {DEFAULT_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>

            {/* Excel Dışa Aktar Butonu */}
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1.5 px-2.5 h-8 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg font-bold text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-xs"
              title="Excel Olarak İndir"
            >
              <FileSpreadsheet size={13} />
              <span className="hidden sm:inline">Excel</span>
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
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-tight text-foreground">
                    {editingRecord ? "Hurda Kaydını Düzenle" : "Yeni Hurda / Hata Kaydı"}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Üretim esnasında ayrılan parça veya hatalı yarı mamul bilgileri
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Sipariş No */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-foreground">
                    Sipariş No <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={formOrderNo}
                      onChange={(e) => setFormOrderNo(e.target.value)}
                      onBlur={() => handleFetchSapOrder(formOrderNo)}
                      placeholder="Örn: 2111588 veya 4060992"
                      className="w-full h-11 px-3.5 bg-muted/30 border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:border-rose-500 transition-all font-mono"
                    />
                    {isFetchingSap && (
                      <Loader2
                        size={16}
                        className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-rose-500"
                      />
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground block">
                    Yazıp alandan çıktığınızda SAP'den ayar/renk/açıklama otomatik gelir.
                  </span>
                </div>

                {/* Ayar */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-foreground">
                    Ayar (Karat)
                  </label>
                  <select
                    value={formKarat}
                    onChange={(e) => setFormKarat(e.target.value)}
                    className="w-full h-11 px-3.5 bg-muted/30 border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:border-rose-500 transition-all cursor-pointer"
                  >
                    <option value="">Ayar Seçiniz (veya SAP'den gelir)</option>
                    {KARAT_OPTIONS.map((k) => (
                      <option key={k} value={k}>
                        {k} Ayar
                      </option>
                    ))}
                  </select>
                </div>

                {/* Renk */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-foreground">
                    Renk
                  </label>
                  <select
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="w-full h-11 px-3.5 bg-muted/30 border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:border-rose-500 transition-all cursor-pointer"
                  >
                    {COLOR_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tel Kodu */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-foreground">
                    Tel Kodu
                  </label>
                  <input
                    type="text"
                    value={formWireCode}
                    onChange={(e) => setFormWireCode(e.target.value)}
                    placeholder="Örn: YT003135 veya YT001025"
                    className="w-full h-11 px-3.5 bg-muted/30 border border-border rounded-xl text-xs font-mono font-bold text-foreground outline-none focus:border-rose-500 transition-all"
                  />
                </div>
              </div>

              {/* Açıklama / Model Adı */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-foreground">
                  Açıklama (Model / Zincir Adı)
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Örn: IB EZME TONDO 50 TR"
                  className="w-full h-11 px-3.5 bg-muted/30 border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:border-rose-500 transition-all"
                />
              </div>

              {/* Hata Sebebi / Not */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-foreground">
                  Hata Detayı / Not
                </label>
                <textarea
                  rows={2}
                  value={formDefectNote}
                  onChange={(e) => setFormDefectNote(e.target.value)}
                  placeholder="Örn: Halka ağzından güverse yapmış, astar geri çekiliyor..."
                  className="w-full p-3 bg-muted/30 border border-border rounded-xl text-xs font-medium text-foreground outline-none focus:border-rose-500 transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Hurda Nedeni */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-foreground">
                    Hurda Nedeni <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formScrapReason}
                    onChange={(e) => setFormScrapReason(e.target.value)}
                    className="w-full h-11 px-3.5 bg-muted/30 border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:border-rose-500 transition-all cursor-pointer"
                  >
                    {DEFAULT_SCRAP_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Hurda Yeri (İstasyon) */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-foreground">
                    Hurda Yeri (İstasyon)
                  </label>
                  <select
                    value={formScrapLocation}
                    onChange={(e) => setFormScrapLocation(e.target.value)}
                    className="w-full h-11 px-3.5 bg-muted/30 border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:border-rose-500 transition-all cursor-pointer"
                  >
                    {DEFAULT_LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Eğer Diğer seçildiyse özel metin kutusu */}
              {formScrapReason === "Diğer" && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-foreground">
                    Özel Hurda Nedeni Belirtiniz
                  </label>
                  <input
                    type="text"
                    value={formCustomReason}
                    onChange={(e) => setFormCustomReason(e.target.value)}
                    placeholder="Örn: Özel kalıp patlaması, hatalı kaplama vb."
                    className="w-full h-11 px-3.5 bg-muted/30 border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:border-rose-500 transition-all"
                  />
                </div>
              )}

              {/* Hurda Mı? Checkbox */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-foreground block">
                  Hurda Durumu
                </label>
                <label className="flex items-center gap-3 h-11 px-4 bg-muted/30 border border-border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={formIsScrap}
                    onChange={(e) => setFormIsScrap(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer accent-rose-600"
                  />
                  <span className="text-xs font-black uppercase tracking-wide text-foreground">
                    {formIsScrap ? "Kesinleşen Hurda" : "İncelemede / Takip Edilecek"}
                  </span>
                </label>
              </div>

              {/* Görsel Yükleme (MVP: Standart Stok Görsel Önizleme) */}
              <div className="space-y-2 pt-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-foreground flex items-center justify-between">
                  <span>Hurda Görseli</span>
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  className="hidden"
                />

                {filePreviewUrl ? (
                  <div className="relative p-3 bg-muted/30 border border-border rounded-2xl flex items-center gap-4">
                    <div className="w-20 h-20 rounded-xl overflow-hidden border border-border bg-black/5 shrink-0 shadow-xs">
                      <img src={filePreviewUrl} alt="Önizleme" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <span className="text-xs font-bold text-foreground block">
                        {selectedFile ? selectedFile.name : "Özel Yüklenen Görsel"}
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        Özel görsel başarıyla seçildi
                      </span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer block"
                      >
                        Görseli Değiştir
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setFilePreviewUrl(null);
                      }}
                      className="p-2 hover:bg-muted text-muted-foreground hover:text-rose-500 rounded-lg cursor-pointer"
                      title="Görseli Kaldır (Stok Görsele Dön)"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="p-3.5 bg-muted/30 border border-border rounded-2xl flex items-center gap-4">
                    <div className="w-20 h-20 rounded-xl overflow-hidden border border-border bg-black/10 shrink-0 shadow-xs relative">
                      <img
                        src={DEFAULT_SCRAP_IMAGE}
                        alt="Standart Stok Görsel"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground block">
                          Standart Stok Görsel
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          MVP
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Her kayıtta otomatik olarak mikroskop kalite kontrol hata görseli kullanılır.
                      </p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-500 hover:text-rose-600 hover:underline cursor-pointer pt-1"
                      >
                        <Upload size={13} />
                        <span>Farklı Fotoğraf Yükle (İsteğe Bağlı)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Buttons */}
              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-5 py-2.5 bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-600/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  <span>{editingRecord ? "Güncelle" : "Kaydet"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
