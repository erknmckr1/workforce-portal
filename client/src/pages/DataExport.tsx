import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  FileSpreadsheet,
  Download,
  Filter,
  Layers,
  Settings2,
  Calendar,
  Building2,
  CheckSquare,
  Square,
  RotateCcw,
  Eye,
  Table as TableIcon,
  Loader2,
  HelpCircle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import OperatorIdModal from "@/components/terminal/OperatorIdModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ColumnDef {
  key: string;
  defaultLabel: string;
  enabled: boolean;
  customLabel: string;
}

interface DatasetConfig {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  hasAreaFilter: boolean;
  defaultColumns: Array<{ key: string; label: string }>;
}

const DATASETS: DatasetConfig[] = [
  {
    id: "parti_logs",
    title: "Parti Takip Logları",
    subtitle: "Parti & alt parti hareketleri, başlatma/bitirme kayıtları",
    icon: Layers,
    hasAreaFilter: false,
    defaultColumns: [
      { key: "record_date", label: "Kayıt Tarihi" },
      { key: "parti_no", label: "Parti No" },
      { key: "alt_parti", label: "Alt Parti No" },
      { key: "islem_label", label: "İşlem Adı" },
      { key: "islem_id", label: "İşlem Kodu" },
      { key: "action_label", label: "Durum" },
      { key: "operator_name", label: "Operatör" },
      { key: "operator_id", label: "Operatör Sicil / ID" },
    ],
  },
  {
    id: "work_logs",
    title: "Üretim İş Emirleri",
    subtitle: "MES istasyon iş emirleri, başlama/bitiş ve üretim süreleri",
    icon: Settings2,
    hasAreaFilter: true,
    defaultColumns: [
      { key: "start_date", label: "Başlama Zamanı" },
      { key: "end_date", label: "Bitiş Zamanı" },
      { key: "order_no", label: "Sipariş No" },
      { key: "material_no", label: "Malzeme No" },
      { key: "area_name", label: "Bölüm / İstasyon" },
      { key: "field", label: "Alan / Hat" },
      { key: "process_name", label: "Proses Adı" },
      { key: "machine_name", label: "Makine" },
      { key: "operator_id", label: "Operatör ID" },
      { key: "produced_qty_gr", label: "Üretilen Gramaj (gr)" },
      { key: "produced_qty_pcs", label: "Üretilen Adet" },
      { key: "scrap_qty_gr", label: "Hurda Gramaj (gr)" },
      { key: "status", label: "Durum" },
      { key: "finish_description", label: "Tamamlama Notu" },
    ],
  },
  {
    id: "measurements",
    title: "Ölçüm & Tartım Kayıtları",
    subtitle: "İstasyon giriş-çıkış tartımları, altın ayarı ve fire farkları",
    icon: TableIcon,
    hasAreaFilter: true,
    defaultColumns: [
      { key: "createdAt", label: "Kayıt Tarihi" },
      { key: "order_no", label: "Sipariş No" },
      { key: "material_no", label: "Malzeme No" },
      { key: "area_name", label: "Bölüm" },
      { key: "operator", label: "Operatör" },
      { key: "entry_measurement", label: "Giriş Ölçümü" },
      { key: "exit_measurement", label: "Çıkış Ölçümü" },
      { key: "entry_weight_50cm", label: "50cm Giriş (gr)" },
      { key: "exit_weight_50cm", label: "50cm Çıkış (gr)" },
      { key: "measurement_package", label: "Miktar / Adet" },
      { key: "gold_setting", label: "Altın Ayarı" },
      { key: "gold_pure_scrap", label: "Saf Hurda" },
      { key: "measurement_diff", label: "Ölçüm Farkı (Fire)" },
      { key: "weighed_quantity", label: "Tartılan Adet" },
      { key: "weighed_weight", label: "Tartılan Ağırlık" },
      { key: "result_weight", label: "Sonuç Ağırlık" },
      { key: "description", label: "Açıklama" },
    ],
  },
  {
    id: "scrap_measurements",
    title: "Hurda / Ramat Ölçümleri",
    subtitle: "Bölüm bazlı ramat toplama, hurda tartımları ve altın kazanımı",
    icon: TableIcon,
    hasAreaFilter: true,
    defaultColumns: [
      { key: "createdAt", label: "Kayıt Tarihi" },
      { key: "order_no", label: "Sipariş No" },
      { key: "area_name", label: "Bölüm" },
      { key: "operator_id", label: "Operatör ID" },
      { key: "entry_measurement", label: "Giriş Ölçümü" },
      { key: "exit_measurement", label: "Çıkış Ölçümü" },
      { key: "gold_setting", label: "Altın Ayarı" },
      { key: "gold_pure_scrap", label: "Saf Hurda" },
      { key: "measurement_diff", label: "Ölçüm Farkı" },
      { key: "weighed_quantity", label: "Tartılan Adet" },
      { key: "weighed_weight", label: "Tartılan Ağırlık" },
      { key: "result_weight", label: "Sonuç Ağırlık" },
    ],
  },
];

const PREDEFINED_AREAS = [
  { id: "all", name: "Tüm Bölümler" },
  { id: "taslama", name: "Taslama" },
  { id: "tezgah", name: "Tezgah" },
  { id: "cila", name: "Cila" },
  { id: "kalite", name: "Kalite Kontrol" },
  { id: "buzlama", name: "Buzlama" },
  { id: "cekic", name: "Çekiç" },
  { id: "kurutiras", name: "Kuru Tıraş" },
  { id: "telcekme", name: "Tel Çekme" },
];

export default function DataExport() {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("parti_logs");

  // Filtreler
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const activeDataset = useMemo(
    () => DATASETS.find((d) => d.id === selectedDatasetId) || DATASETS[0],
    [selectedDatasetId]
  );

  // Sütun Özelleştirme State'i (Her veri seti için dinamik harita)
  const [columnConfigs, setColumnConfigs] = useState<Record<string, ColumnDef[]>>(() => {
    const initial: Record<string, ColumnDef[]> = {};
    DATASETS.forEach((ds) => {
      initial[ds.id] = ds.defaultColumns.map((col) => ({
        key: col.key,
        defaultLabel: col.label,
        enabled: true,
        customLabel: col.label,
      }));
    });
    return initial;
  });

  const currentColumns = columnConfigs[selectedDatasetId] || [];

  // Sütun açma/kapama
  const toggleColumn = (key: string) => {
    setColumnConfigs((prev) => ({
      ...prev,
      [selectedDatasetId]: prev[selectedDatasetId].map((col) =>
        col.key === key ? { ...col, enabled: !col.enabled } : col
      ),
    }));
  };

  // Sütun başlığı değiştirme (Alias)
  const updateColumnLabel = (key: string, newLabel: string) => {
    setColumnConfigs((prev) => ({
      ...prev,
      [selectedDatasetId]: prev[selectedDatasetId].map((col) =>
        col.key === key ? { ...col, customLabel: newLabel } : col
      ),
    }));
  };

  // Tümünü Seç / Kaldır
  const setAllColumns = (enabled: boolean) => {
    setColumnConfigs((prev) => ({
      ...prev,
      [selectedDatasetId]: prev[selectedDatasetId].map((col) => ({
        ...col,
        enabled,
      })),
    }));
  };

  // Varsayılan Başlıklara Sıfırla
  const resetColumnLabels = () => {
    setColumnConfigs((prev) => ({
      ...prev,
      [selectedDatasetId]: prev[selectedDatasetId].map((col) => ({
        ...col,
        enabled: true,
        customLabel: col.defaultLabel,
      })),
    }));
    toast.success("Sütun başlıkları varsayılan isimlerine sıfırlandı.");
  };

  // Hızlı Tarih Seçimleri
  const handleQuickDate = (type: "today" | "week" | "month" | "all") => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    if (type === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (type === "week") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().split("T")[0]);
      setEndDate(todayStr);
    } else if (type === "month") {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      setStartDate(d.toISOString().split("T")[0]);
      setEndDate(todayStr);
    } else if (type === "all") {
      setStartDate("");
      setEndDate("");
    }
  };

  const [isExporting, setIsExporting] = useState(false);

  // Veri Çekme Sorgusu (Önizleme ve Toplam Sayı için)
  const {
    data: responseData,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["exportData", selectedDatasetId, startDate, endDate, selectedArea],
    queryFn: async () => {
      const res = await apiClient.get("/export/data", {
        params: {
          dataset: selectedDatasetId,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          areaName: activeDataset.hasAreaFilter && selectedArea !== "all" ? selectedArea : undefined,
        },
      });
      return res.data as { dataset: string; count: number; totalCount: number; data: any[] };
    },
  });

  const records = responseData?.data || [];
  const totalCount = responseData?.totalCount ?? records.length;
  const enabledColumns = currentColumns.filter((c) => c.enabled);

  // Tarih ve Sayı formatlayıcı (Önizleme tablosu için)
  const formatCellValue = (key: string, val: any) => {
    if (val === null || val === undefined) return "-";
    if (
      (key.includes("date") || key.includes("Time") || key === "createdAt") &&
      typeof val === "string" &&
      !isNaN(Date.parse(val))
    ) {
      try {
        return format(new Date(val), "dd.MM.yyyy HH:mm:ss", { locale: tr });
      } catch {
        return val;
      }
    }
    if (key === "status") {
      const statusMap: Record<number, string> = {
        1: "Başladı",
        2: "Duraklatıldı",
        3: "İptal Edildi",
        4: "Tamamlandı",
        5: "Hazırlık (Setup)",
        9: "Durduruldu",
      };
      if (typeof val === "number" && statusMap[val]) {
        return statusMap[val];
      }
    }
    if (typeof val === "number") {
      return Number.isInteger(val) ? val : Number(val.toFixed(3));
    }
    return String(val);
  };

  // İndirme akışını başlat (Önce kullanıcı doğrulama modalını aç)
  const handleInitiateExport = () => {
    if (totalCount === 0) {
      toast.error("Dışa aktarılacak kayıt bulunamadı.");
      return;
    }

    if (enabledColumns.length === 0) {
      toast.error("Lütfen en az bir sütun seçiniz.");
      return;
    }

    setIsAuthModalOpen(true);
  };

  // Backend üzerinden Excel oluştur ve doğrudan tarayıcıya indir
  const handleOperatorSubmit = async (operatorId: string) => {
    setIsAuthModalOpen(false);
    setIsExporting(true);
    const toastId = toast.loading("Excel dosyası sunucuda hazırlanıyor, lütfen bekleyiniz...");

    try {
      const response = await apiClient.post(
        "/export/download-excel",
        {
          operatorId,
          dataset: activeDataset.id,
          datasetTitle: activeDataset.title,
          areaName: selectedArea,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          columns: enabledColumns.map((c) => ({
            key: c.key,
            label: c.customLabel.trim() || c.defaultLabel,
          })),
        },
        {
          responseType: "blob",
        }
      );

      // İndirilen dosya adını al veya varsayılan oluştur
      const dateStr = format(new Date(), "yyyyMMdd_HHmm");
      const fileName = `${activeDataset.id}_${dateStr}.xlsx`;

      // Blob verisinden indirme linki tetikle
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      const serverCount = response.headers["x-record-count"] || totalCount;
      toast.success(`${serverCount} kayıt içeren Excel başarıyla indirildi!`, { id: toastId });
    } catch (err: any) {
      console.error("Backend Excel Export Error:", err);
      toast.error(
        err?.response?.data?.message || "Excel dosyası oluşturulurken bir hata oluştu.",
        { id: toastId }
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      {/* SAYFA BAŞLIĞI (Portal Standardı PageHeader) */}
      <PageHeader
        title="Veri Dışa Aktarma Merkezi"
        description="Saha ve üretim kayıtlarını filtreleyin, sütunları özelleştirin ve Excel olarak indirin"
        icon={FileSpreadsheet}
        action={
          <button
            onClick={handleInitiateExport}
            disabled={isLoading || isExporting || totalCount === 0}
            className={cn(
              "px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all select-none cursor-pointer active:scale-95 shrink-0",
              totalCount > 0 && !isLoading && !isExporting
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/20"
                : "bg-secondary text-muted-foreground/40 border border-border cursor-not-allowed"
            )}
          >
            {isExporting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            <span>{isExporting ? "Excel Hazırlanıyor..." : "Excel İndir (.xlsx)"}</span>
            {totalCount > 0 && (
              <span className="ml-1 text-[11px] font-mono px-1.5 py-0.5 rounded bg-black/20 text-white">
                {totalCount.toLocaleString("tr-TR")}
              </span>
            )}
          </button>
        }
      />

      {/* 1. VERİ KÜMESİ SEÇİMİ (4 KART) */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Layers size={14} className="text-primary" />
          1. Veri Kümesini Seçiniz
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {DATASETS.map((ds) => {
            const isSelected = ds.id === selectedDatasetId;
            const Icon = ds.icon;
            return (
              <button
                key={ds.id}
                type="button"
                onClick={() => setSelectedDatasetId(ds.id)}
                className={cn(
                  "p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-4 select-none relative overflow-hidden active:scale-95",
                  isSelected
                    ? "bg-primary/5 border-primary text-foreground shadow-md ring-1 ring-primary/30"
                    : "bg-card border-border text-muted-foreground hover:border-border hover:bg-secondary/40"
                )}
              >
                <div className="flex items-start justify-between w-full">
                  <div
                    className={cn(
                      "p-2.5 rounded-xl border",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-secondary text-foreground border-border"
                    )}
                  >
                    <Icon size={20} />
                  </div>
                  {isSelected && (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                      Seçili
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-tight text-foreground">
                    {ds.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                    {ds.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. FİLTRELEME ALANI */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Filter size={14} className="text-primary" />
            2. Filtre Seçenekleri
          </h2>
          {isFetching && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <Loader2 size={13} className="animate-spin text-primary" />
              <span>Veriler alınıyor...</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Başlangıç Tarihi */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
              <Calendar size={13} />
              Başlangıç Tarihi
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-secondary/60 border border-border rounded-xl font-mono text-xs font-bold text-foreground focus:outline-none focus:border-foreground"
            />
          </div>

          {/* Bitiş Tarihi */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
              <Calendar size={13} />
              Bitiş Tarihi
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-secondary/60 border border-border rounded-xl font-mono text-xs font-bold text-foreground focus:outline-none focus:border-foreground"
            />
          </div>

          {/* Bölüm / İstasyon Filtresi (Sadece ilgili tablolarda) */}
          {activeDataset.hasAreaFilter && (
            <div className="md:col-span-3 space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                <Building2 size={13} />
                Bölüm / İstasyon
              </label>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-secondary/60 border border-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:border-foreground cursor-pointer"
              >
                {PREDEFINED_AREAS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Hızlı Butonlar */}
          <div className={cn("space-y-1.5", activeDataset.hasAreaFilter ? "md:col-span-3" : "md:col-span-6")}>
            <label className="text-xs font-bold text-muted-foreground uppercase">
              Hızlı Tarih Seçimi
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleQuickDate("today")}
                className="px-2.5 py-2 bg-secondary hover:bg-muted text-foreground text-xs font-bold rounded-lg border border-border transition-all cursor-pointer"
              >
                Bugün
              </button>
              <button
                type="button"
                onClick={() => handleQuickDate("week")}
                className="px-2.5 py-2 bg-secondary hover:bg-muted text-foreground text-xs font-bold rounded-lg border border-border transition-all cursor-pointer"
              >
                Son 7 Gün
              </button>
              <button
                type="button"
                onClick={() => handleQuickDate("month")}
                className="px-2.5 py-2 bg-secondary hover:bg-muted text-foreground text-xs font-bold rounded-lg border border-border transition-all cursor-pointer"
              >
                Bu Ay
              </button>
              <button
                type="button"
                onClick={() => handleQuickDate("all")}
                className="px-2.5 py-2 bg-secondary hover:bg-muted text-foreground text-xs font-bold rounded-lg border border-border transition-all cursor-pointer"
              >
                Tümü
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. SÜTUN ÖZELLEŞTİRME & YENİDEN ADLANDIRMA PANELİ */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Settings2 size={15} />
              3. Sütunları Seçin ve Başlıklarını Belirleyin
            </h2>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              Excel dosyasına dahil etmek istediğiniz sütunları işaretleyin. Dilerseniz başlık kutularına
              tıklayarak sütun adını özelleştirebilirsiniz.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setAllColumns(true)}
              className="px-2.5 py-1.5 bg-secondary hover:bg-muted text-foreground text-xs font-bold rounded-lg border border-border transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CheckSquare size={13} />
              <span>Tümünü Seç</span>
            </button>
            <button
              type="button"
              onClick={() => setAllColumns(false)}
              className="px-2.5 py-1.5 bg-secondary hover:bg-muted text-foreground text-xs font-bold rounded-lg border border-border transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Square size={13} />
              <span>Temizle</span>
            </button>
            <button
              type="button"
              onClick={resetColumnLabels}
              className="px-2.5 py-1.5 bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-bold rounded-lg border border-border transition-all flex items-center gap-1.5 cursor-pointer"
              title="Varsayılan Başlıklara Dön"
            >
              <RotateCcw size={13} />
              <span>Sıfırla</span>
            </button>
          </div>
        </div>

        {/* Sütunlar Izgarası */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {currentColumns.map((col) => (
            <div
              key={col.key}
              className={cn(
                "p-3 rounded-xl border transition-all flex flex-col gap-2",
                col.enabled
                  ? "bg-secondary/40 border-border"
                  : "bg-muted/10 border-border/40 opacity-50"
              )}
            >
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={col.enabled}
                    onChange={() => toggleColumn(col.key)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                  <span className="text-xs font-mono text-muted-foreground font-bold truncate max-w-[140px]">
                    {col.key}
                  </span>
                </label>
                {col.customLabel !== col.defaultLabel && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded">
                    Özel
                  </span>
                )}
              </div>

              {/* Düzenlenebilir Başlık Girdisi */}
              <input
                type="text"
                disabled={!col.enabled}
                value={col.customLabel}
                placeholder={col.defaultLabel}
                onChange={(e) => updateColumnLabel(col.key, e.target.value)}
                className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs font-bold text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-all disabled:cursor-not-allowed"
                title="Excel Sütun Başlığı"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 4. CANLI ÖNİZLEME TABLOSU (İLK 10 SATIR) */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Eye className="text-primary" size={16} />
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
              4. Canlı Tablo Önizleme
            </h2>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-secondary border border-border text-foreground">
              Toplam {totalCount.toLocaleString("tr-TR")} Kayıt (İlk {records.length} Önizleniyor)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:block">
              {enabledColumns.length} sütun seçili
            </span>
            <button
              onClick={handleInitiateExport}
              disabled={isLoading || isExporting || totalCount === 0}
              className={cn(
                "px-3.5 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all select-none cursor-pointer active:scale-95 shrink-0",
                totalCount > 0 && !isLoading && !isExporting
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                  : "bg-secondary text-muted-foreground/40 border border-border cursor-not-allowed"
              )}
            >
              {isExporting ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Download size={13} />
              )}
              <span>{isExporting ? "Hazırlanıyor..." : "Excel İndir"}</span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="h-48 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="animate-spin text-primary" size={28} />
            <span className="text-xs font-bold">Veriler yükleniyor...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <HelpCircle size={32} className="opacity-40" />
            <p className="text-sm font-bold">Seçilen filtrelere uygun kayıt bulunamadı.</p>
            <p className="text-xs">Lütfen tarih aralığını genişletmeyi veya farklı bir bölüm seçmeyi deneyin.</p>
          </div>
        ) : enabledColumns.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground text-xs font-bold">
            Lütfen önizlemek ve Excel çıktısına eklemek için en az bir sütun işaretleyin.
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-secondary/70 border-b border-border">
                  <th className="py-3 px-3.5 font-black uppercase text-muted-foreground w-12 text-center border-r border-border">
                    #
                  </th>
                  {enabledColumns.map((col) => (
                    <th
                      key={col.key}
                      className="py-3 px-4 font-black uppercase tracking-wider text-foreground border-r border-border last:border-r-0 whitespace-nowrap"
                    >
                      {col.customLabel.trim() || col.defaultLabel}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {records.slice(0, 10).map((row, idx) => (
                  <tr key={idx} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-3.5 text-center font-mono text-muted-foreground border-r border-border">
                      {idx + 1}
                    </td>
                    {enabledColumns.map((col) => {
                      const val = row[col.key];
                      return (
                        <td
                          key={col.key}
                          className="py-2.5 px-4 font-mono font-medium text-foreground border-r border-border last:border-r-0 whitespace-nowrap"
                        >
                          {formatCellValue(col.key, val)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* GÜVENLİK VE DENETİM İÇİN OPERATÖR ID DOĞRULAMA MODALI */}
      <OperatorIdModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSubmit={handleOperatorSubmit}
      />
    </div>
  );
}
