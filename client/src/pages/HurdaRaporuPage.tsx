import { useState, useMemo, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  Clock,
  Layers,
  FileSpreadsheet,
  Calendar,
  RotateCcw,
  BarChart3,
  PieChart as PieChartIcon,
  Palette,
  Boxes,
  Grid,
  Sliders,
  Search,
} from "lucide-react";
import apiClient from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// --- TYPES ---
interface LocationReportItem {
  name: string;
  total: number;
  scrap: number;
  pending: number;
  scrapRate?: number;
  primaryDefect: string;
}

interface ReasonReportItem {
  name: string;
  count: number;
  percentage?: number;
  color?: string;
}

interface KaratReportItem {
  name: string;
  count: number;
  scrap?: number;
  pending?: number;
  scrapRate?: number;
  color?: string;
}

interface ColorReportItem {
  code: string;
  name: string;
  count: number;
  scrap: number;
  pending: number;
}

interface MaterialReportItem {
  material_no: string;
  description: string;
  count: number;
  scrap: number;
  pending: number;
  orderCount: number;
  primaryDefect: string;
  primaryLocation: string;
}

interface RootCauseCategoryItem {
  id: string;
  name: string;
  count: number;
  percentage: number;
  color: string;
  topReasons: Array<{ name: string; count: number }>;
}

interface StationDefectMatrix {
  reasons: string[];
  rows: Array<{
    location: string;
    total: number;
    scrap: number;
    counts: Record<string, number>;
  }>;
}

interface DailyTrendItem {
  date: string;
  scrap: number;
  pending: number;
  total: number;
}

interface ApiReportResponse {
  summary: {
    totalCount: number;
    scrapCount: number;
    pendingCount: number;
    scrapRate: number;
    topLocation: string;
    topReason: string;
  };
  byLocation: Array<{
    name: string;
    total: number;
    scrap: number;
    pending: number;
    scrapRate?: number;
    primaryDefect?: string;
  }>;
  byReason: ReasonReportItem[];
  byKarat: KaratReportItem[];
  byColor?: ColorReportItem[];
  byWireCode?: Array<{ wire_code: string; count: number; scrap: number; pending: number }>;
  byMaterial?: MaterialReportItem[];
  rootCauseDraft?: RootCauseCategoryItem[];
  stationDefectMatrix?: StationDefectMatrix;
  dailyTrend: DailyTrendItem[];
  availableFilters?: {
    locations: string[];
    karats: string[];
  };
}

interface FullReportData {
  summary: {
    totalCount: number;
    scrapCount: number;
    pendingCount: number;
    scrapRate: number;
    topLocation: string;
    topReason: string;
  };
  byLocation: LocationReportItem[];
  byReason: ReasonReportItem[];
  byKarat: KaratReportItem[];
  byColor?: ColorReportItem[];
  byMaterial?: MaterialReportItem[];
  rootCauseDraft?: RootCauseCategoryItem[];
  stationDefectMatrix?: StationDefectMatrix;
  dailyTrend: DailyTrendItem[];
}

const EMPTY_REPORT_DATA: FullReportData = {
  summary: {
    totalCount: 0,
    scrapCount: 0,
    pendingCount: 0,
    scrapRate: 0,
    topLocation: "-",
    topReason: "-",
  },
  byLocation: [],
  byReason: [],
  byKarat: [],
  byColor: [],
  byMaterial: [],
  rootCauseDraft: [],
  stationDefectMatrix: { reasons: [], rows: [] },
  dailyTrend: [],
};

const PIE_COLORS = ["#f43f5e", "#8b5cf6", "#ec4899", "#3b82f6", "#06b6d4", "#eab308", "#f97316"];

export default function HurdaRaporuPage() {
  // Filtre State
  const [datePreset, setDatePreset] = useState<string>("ALL");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("ALL");
  const [selectedKarat, setSelectedKarat] = useState<string>("ALL");
  const [materialSearch, setMaterialSearch] = useState<string>("");

  // Veri State
  const [apiData, setApiData] = useState<ApiReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // API'den Rapor Çekme
  const fetchReport = useCallback(async () => {
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

      const res = await apiClient.get("/scrap-tracking/report", {
        params: {
          start_date: startDateParam,
          end_date: endDateParam,
          location: selectedLocation !== "ALL" ? selectedLocation : undefined,
          karat: selectedKarat !== "ALL" ? selectedKarat : undefined,
        },
      });

      if (res.data && res.data.summary) {
        setApiData(res.data);
      } else {
        setApiData(null);
      }
    } catch (err) {
      console.error("fetchReport error:", err);
      setApiData(null);
    } finally {
      setIsLoading(false);
    }
  }, [datePreset, customStartDate, customEndDate, selectedLocation, selectedKarat]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Dinamik Filtre Seçenekleri (Backend'den dönen gerçek istasyon ve ayarlar)
  const availableLocations = useMemo(() => {
    return apiData?.availableFilters?.locations || [];
  }, [apiData?.availableFilters?.locations]);

  const availableKarats = useMemo(() => {
    return apiData?.availableFilters?.karats || [];
  }, [apiData?.availableFilters?.karats]);

  // Aktif Veri Seti (Doğrudan Canlı Veritabanı)
  const reportData = useMemo<FullReportData>(() => {
    if (!apiData) {
      return EMPTY_REPORT_DATA;
    }

    return {
      summary: apiData.summary,
      byLocation: apiData.byLocation.map((loc) => ({
        name: loc.name,
        total: loc.total,
        scrap: loc.scrap,
        pending: loc.pending,
        scrapRate:
          loc.scrapRate !== undefined
            ? loc.scrapRate
            : loc.total > 0
            ? Math.round((loc.scrap / loc.total) * 100)
            : 0,
        primaryDefect: loc.primaryDefect || "Çeşitli Nedenler",
      })),
      byReason: apiData.byReason,
      byKarat: apiData.byKarat,
      byColor: apiData.byColor || [],
      byMaterial: apiData.byMaterial || [],
      rootCauseDraft: apiData.rootCauseDraft || [],
      stationDefectMatrix: apiData.stationDefectMatrix || { reasons: [], rows: [] },
      dailyTrend: apiData.dailyTrend,
    };
  }, [apiData]);

  // Malzeme Arama Filtrelemesi
  const filteredMaterials = useMemo(() => {
    const list = reportData.byMaterial || [];
    if (!materialSearch.trim()) return list;
    const q = materialSearch.toLowerCase().trim();
    return list.filter(
      (m) =>
        m.material_no.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q)) ||
        (m.primaryDefect && m.primaryDefect.toLowerCase().includes(q)) ||
        (m.primaryLocation && m.primaryLocation.toLowerCase().includes(q))
    );
  }, [reportData.byMaterial, materialSearch]);

  // Altın Rengi Toplamı ve Standart Renk Dağılımı
  const totalColorCount = useMemo(() => {
    return (reportData.byColor || []).reduce((acc, c) => acc + (c.count || 0), 0);
  }, [reportData.byColor]);

  const standardColors = useMemo(() => {
    const colorItems = reportData.byColor || [];
    const configs = [
      {
        code: "Y",
        name: "Sarı Altın",
        badgeStyle: "bg-amber-500/10 text-amber-500 border-amber-500/20",
        barColor: "bg-amber-500",
      },
      {
        code: "B",
        name: "Beyaz Altın",
        badgeStyle: "bg-sky-500/10 text-sky-400 border-sky-500/20",
        barColor: "bg-sky-400",
      },
      {
        code: "K",
        name: "Rose Altın",
        badgeStyle: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        barColor: "bg-rose-400",
      },
    ];

    return configs.map((cfg) => {
      const found = colorItems.find((c) => c.code === cfg.code);
      const count = found ? found.count : 0;
      const scrap = found ? found.scrap : 0;
      const pending = found ? found.pending : 0;
      const percentage = totalColorCount > 0 ? Math.round((count / totalColorCount) * 100) : 0;
      return {
        ...cfg,
        count,
        scrap,
        pending,
        percentage,
      };
    });
  }, [reportData.byColor, totalColorCount]);

  // Excel Rapor Özeti İndirme
  const exportToExcel = () => {
    try {
      const summaryRows = [
        ["HURDA VE KALITE ANALIZ RAPORU (OZET)"],
        [`Rapor Tarihi: ${format(new Date(), "yyyy-MM-dd HH:mm")}`],
        [`Toplam Incelenen Kayit: ${reportData.summary.totalCount}`],
        [`Kesinlesen Hurda: ${reportData.summary.scrapCount}`],
        [`Incelemede / Takipte: ${reportData.summary.pendingCount}`],
        [`En Cok Fireli Istasyon: ${reportData.summary.topLocation}`],
        [`En Yaygin Hata: ${reportData.summary.topReason}`],
        [],
        ["MALZEME (MATERIAL_NO) BAZINDA FIRE ANALIZI"],
        [
          "Malzeme Kodu",
          "Aciklama",
          "Toplam Kayit",
          "Hurda",
          "Takipte",
          "Farkli Siparis Sayisi",
          "Agirlikli Kusur",
          "Agirlikli Istasyon",
        ],
        ...(reportData.byMaterial || []).map((m: MaterialReportItem) => [
          m.material_no,
          m.description,
          m.count,
          m.scrap,
          m.pending,
          m.orderCount,
          m.primaryDefect,
          m.primaryLocation,
        ]),
        [],
        ["KOK NEDEN SINIFLANDIRMASI (TASLAK)"],
        ["Kategori", "Adet", "Yuzde Payi (%)"],
        ...(reportData.rootCauseDraft || []).map((c: RootCauseCategoryItem) => [
          c.name,
          c.count,
          `%${c.percentage}`,
        ]),
        [],
        ["ISTASYON FIRE DAGILIMI"],
        ["Istasyon", "Toplam Kayit", "Hurda", "Takipte", "Genel Pay (%)", "Agirlikli Hata"],
        ...reportData.byLocation.map((l: LocationReportItem) => [
          l.name,
          l.total,
          l.scrap,
          l.pending,
          `%${reportData.summary.totalCount > 0 ? ((l.total / reportData.summary.totalCount) * 100).toFixed(1) : 0}`,
          l.primaryDefect,
        ]),
        [],
        ["HURDA NEDENLERI PARETO"],
        ["Hata Nedeni", "Adet", "Yuzde Payi"],
        ...reportData.byReason.map((r: ReasonReportItem) => [
          r.name,
          r.count,
          r.percentage !== undefined ? `%${r.percentage}` : "-",
        ]),
        [],
        ["AYAR BAZINDA KIRILIM"],
        ["Ayar", "Toplam Kayit", "Hurda", "Takipte"],
        ...reportData.byKarat.map((k: KaratReportItem) => [
          k.name,
          k.count,
          k.scrap ?? 0,
          k.pending ?? 0,
        ]),
        [],
        ["ALTIN RENGI (ALASIM) DAGILIMI"],
        ["Alaşım Rengi", "Toplam Kayit", "Hurda", "Takipte"],
        ...(reportData.byColor || []).map((c: ColorReportItem) => [
          c.name,
          c.count,
          c.scrap,
          c.pending,
        ]),
      ];

      const csvContent =
        "\uFEFF" + summaryRows.map((r) => r.join(";")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `Hurda_Kalite_Raporu_${format(new Date(), "yyyyMMdd_HHmm")}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Rapor Excel formatında dışa aktarıldı.");
    } catch {
      toast.error("Excel oluşturulurken bir hata meydana geldi.");
    }
  };

  return (
    <div className="w-full space-y-4 pb-12 animate-in fade-in duration-300">
      {/* ========================================================= */}
      {/* 1. ÜST KONTROL BAR: TARİH, FİLTRELER VE AKSİYONLAR        */}
      {/* ========================================================= */}
      <div className="bg-card/70 backdrop-blur-xl border border-border p-3.5 sm:p-4 rounded-2xl shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0 shadow-xs">
            <BarChart3 size={18} />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-black uppercase tracking-tight text-foreground">
              Hurda & Kalite Performans Analizi
            </h1>
            <p className="text-[11px] text-muted-foreground font-medium">
              Vardiya, istasyon bazlı fireler ve Pareto kalite göstergeleri
            </p>
          </div>
        </div>

        {/* Filtre Kontrolleri */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tarih Filtresi */}
          <div className="flex items-center gap-1">
            <div className="relative">
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value)}
                className="h-8 pl-2 pr-6 bg-secondary/80 border border-border rounded-lg text-xs font-bold text-foreground outline-none cursor-pointer appearance-none"
              >
                <option value="ALL">Tüm Zamanlar</option>
                <option value="THIS_MONTH">Bu Ay</option>
                <option value="THIS_WEEK">Bu Hafta</option>
                <option value="TODAY">Bugün (Vardiya)</option>
                <option value="YESTERDAY">Dün</option>
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
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="h-8 px-1.5 bg-secondary/80 border border-border rounded-lg text-[11px] font-bold text-foreground outline-none cursor-pointer"
                />
                <span className="text-xs text-muted-foreground">-</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="h-8 px-1.5 bg-secondary/80 border border-border rounded-lg text-[11px] font-bold text-foreground outline-none cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* İstasyon Filtresi (Dinamik) */}
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="h-8 px-2 bg-secondary/80 border border-border rounded-lg text-xs font-bold text-foreground outline-none cursor-pointer max-w-36 truncate"
          >
            <option value="ALL">Tüm İstasyonlar</option>
            {availableLocations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>

          {/* Ayar Filtresi (Dinamik) */}
          <select
            value={selectedKarat}
            onChange={(e) => setSelectedKarat(e.target.value)}
            className="h-8 px-2 bg-secondary/80 border border-border rounded-lg text-xs font-bold text-foreground outline-none cursor-pointer"
          >
            <option value="ALL">Tüm Ayarlar</option>
            {availableKarats.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>

          {/* Yenile */}
          <button
            onClick={fetchReport}
            className="p-1.5 bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer border border-border"
            title="Yenile"
          >
            <RotateCcw size={14} className={isLoading ? "animate-spin text-rose-500" : ""} />
          </button>

          {/* Excel Çıktısı */}
          <button
            onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3 h-8 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg font-bold text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-xs"
          >
            <FileSpreadsheet size={13} />
            <span>Excel Rapor</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. ÜÇ ANA YÖNETİCİ KPI KARTI                              */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* 1. Toplam Kayıt */}
        <div className="p-4 sm:p-5 bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-black uppercase tracking-wider">
              Toplam Hurda Kaydı
            </span>
            <div className="w-7 h-7 rounded-lg bg-secondary text-foreground flex items-center justify-center border border-border">
              <Layers size={15} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-foreground">
              {reportData.summary.totalCount}
            </span>
            <span className="text-xs text-muted-foreground font-bold">adet kayıt</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs font-bold pt-2 border-t border-border/60">
            <span className="text-rose-500 font-black">Hurda (Kesinleşen): {reportData.summary.scrapCount}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-amber-500 font-black">İncelemede: {reportData.summary.pendingCount}</span>
          </div>
        </div>

        {/* 2. En Yoğun İstasyon */}
        <div className="p-4 sm:p-5 bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-black uppercase tracking-wider">
              En Yoğun İstasyon
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
              <AlertTriangle size={15} />
            </div>
          </div>
          <div className="mt-3">
            <span
              className="text-lg sm:text-xl font-black text-foreground block truncate"
              title={reportData.summary.topLocation}
            >
              {reportData.summary.topLocation}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground font-bold pt-2 border-t border-border/60">
            {reportData.byLocation[0] && reportData.summary.totalCount > 0
              ? `Toplam firelerin yaklaşık %${Math.round(
                  (reportData.byLocation[0].total / reportData.summary.totalCount) * 100
                )}'i bu istasyonda`
              : "Veri yok"}
          </div>
        </div>

        {/* 3. En Yaygın Hata Nedeni */}
        <div className="p-4 sm:p-5 bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-black uppercase tracking-wider">
              En Yaygın Hata (Pareto)
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center border border-purple-500/20">
              <PieChartIcon size={15} />
            </div>
          </div>
          <div className="mt-3">
            <span
              className="text-lg sm:text-xl font-black text-foreground block truncate"
              title={reportData.summary.topReason}
            >
              {reportData.summary.topReason}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground font-bold pt-2 border-t border-border/60">
            {reportData.byReason[0] && reportData.byReason[0].percentage !== undefined
              ? `%${reportData.byReason[0].percentage} pay ile en yüksek kalite kusuru`
              : "Öncelikli aksiyon alınmalı"}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. ÇİFT GRAFİK: ZAMAN TRENDİ & İSTASYON KARŞILAŞTIRMASI    */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Sol 7 Kolon: Günlük Hurda Seyri (AreaChart) */}
        <div className="lg:col-span-7 bg-card/70 backdrop-blur-xl border border-border p-4 sm:p-5 rounded-2xl shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-rose-500" />
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground">
                Günlük Hurda & Takip Hareketi Seyri
              </h2>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="flex items-center gap-1.5 text-rose-500">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                Hurda
              </span>
              <span className="flex items-center gap-1.5 text-amber-500">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                Takipte
              </span>
            </div>
          </div>

          {reportData.dailyTrend.length === 0 ? (
            <div className="h-64 sm:h-72 w-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground border border-dashed border-border/60 rounded-xl mt-2">
              <Calendar size={32} className="opacity-30 mb-2" />
              <p className="text-xs font-bold">Seçili filtre aralığında günlük hareket kaydı bulunamadı.</p>
              <p className="text-[11px] text-muted-foreground/80 mt-1">
                Farklı bir tarih aralığı veya 'Tüm Zamanlar' seçebilirsiniz.
              </p>
            </div>
          ) : (
            <div className="h-64 sm:h-72 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={reportData.dailyTrend}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="chartScrap" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e11d48" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="chartPending" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground, #888)" }}
                    tickFormatter={(v) => {
                      const p = v.split("-");
                      return p.length === 3 ? `${p[2]}/${p[1]}` : v;
                    }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground, #888)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card, #18181b)",
                      borderColor: "var(--color-border, #27272a)",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="scrap"
                    name="Hurda"
                    stroke="#e11d48"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#chartScrap)"
                  />
                  <Area
                    type="monotone"
                    dataKey="pending"
                    name="Takipte"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#chartPending)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Sağ 5 Kolon: İstasyon Karşılaştırması (BarChart) */}
        <div className="lg:col-span-5 bg-card/70 backdrop-blur-xl border border-border p-4 sm:p-5 rounded-2xl shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-indigo-500" />
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground">
                İstasyon Hacim Karşılaştırması
              </h2>
            </div>
            <span className="text-[11px] font-mono font-bold text-muted-foreground">
              Adet Bazında
            </span>
          </div>

          {reportData.byLocation.length === 0 ? (
            <div className="h-64 sm:h-72 w-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground border border-dashed border-border/60 rounded-xl mt-2">
              <BarChart3 size={32} className="opacity-30 mb-2" />
              <p className="text-xs font-bold">İstasyon verisi bulunamadı.</p>
            </div>
          ) : (
            <div className="h-64 sm:h-72 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={reportData.byLocation}
                  margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="name"
                    angle={-30}
                    textAnchor="end"
                    interval={0}
                    tick={{ fontSize: 10, fill: "var(--color-muted-foreground, #888)" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground, #888)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card, #18181b)",
                      borderColor: "var(--color-border, #27272a)",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  />
                  <Bar dataKey="scrap" name="Hurda" fill="#e11d48" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pending" name="Takipte" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. PARETO HATA NEDENLERİ & AYAR DAĞILIMI                   */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Sol 5 Kolon: Donut Grafik (Hata Nedenleri) */}
        <div className="lg:col-span-5 bg-card/70 backdrop-blur-xl border border-border p-4 sm:p-5 rounded-2xl shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <PieChartIcon size={16} className="text-purple-500" />
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground">
                Hurda Nedenleri Pareto Dağılımı
              </h2>
            </div>
          </div>

          {reportData.byReason.length === 0 ? (
            <div className="h-60 sm:h-64 w-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground border border-dashed border-border/60 rounded-xl">
              <PieChartIcon size={32} className="opacity-30 mb-2" />
              <p className="text-xs font-bold">Hata nedeni kaydı bulunamadı.</p>
            </div>
          ) : (
            <div className="h-60 sm:h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reportData.byReason}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {reportData.byReason.map((_entry: ReasonReportItem, index: number) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card, #18181b)",
                      borderColor: "var(--color-border, #27272a)",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  />
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    wrapperStyle={{ fontSize: 10, paddingTop: 10 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Sağ 7 Kolon: Hata Nedenleri Pareto Sıralaması */}
        <div className="lg:col-span-7 bg-card/70 backdrop-blur-xl border border-border p-4 sm:p-5 rounded-2xl shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <span className="text-xs font-black uppercase tracking-wider text-foreground">
              En Çok Tekrarlayan Hata Nedenleri (Pareto Dağılımı)
            </span>
            <span className="text-[11px] font-mono text-muted-foreground font-bold">
              Aksiyon Öncelikli
            </span>
          </div>

          {reportData.byReason.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
              Kayıtlı hata nedeni bulunmuyor.
            </div>
          ) : (
            <div className="space-y-2">
              {reportData.byReason.slice(0, 5).map((r: ReasonReportItem, idx: number) => (
                <div
                  key={r.name}
                  className="p-2.5 rounded-xl bg-secondary/40 border border-border/60 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-rose-500/10 text-rose-500 flex items-center justify-center text-[10px] font-black shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="text-foreground truncate">{r.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.percentage !== undefined && (
                        <span className="text-[11px] font-mono text-muted-foreground font-bold">
                          %{r.percentage}
                        </span>
                      )}
                      <span className="font-mono text-rose-500 font-black text-xs">
                        {r.count} Adet
                      </span>
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-rose-500 transition-all"
                      style={{ width: `${r.percentage || 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. ALAŞIM (AYAR & RENK) VE MALZEME BAZLI FIRE ANALİZİ     */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Sol 5 Kolon: Alaşım & Altın Rengi Dağılımı */}
        <div className="lg:col-span-5 bg-card/70 backdrop-blur-xl border border-border p-4 sm:p-5 rounded-2xl shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Palette size={16} className="text-amber-500" />
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground">
                Alaşım ve Altın Rengi Dağılımı
              </h2>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground font-bold">
              Ayar & Renk
            </span>
          </div>

          {/* Ayar (Karat) Kırılımı */}
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
              Ayar (Karat) Kırılımı
            </span>
            {reportData.byKarat.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                Ayar bazlı veri bulunamadı.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {reportData.byKarat.map((k: KaratReportItem) => (
                  <div
                    key={k.name}
                    className="p-2.5 rounded-xl bg-secondary/40 border border-border flex flex-col justify-between"
                  >
                    <span className="text-xs font-black text-amber-500">{k.name} Ayar</span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-lg font-black text-foreground">{k.count}</span>
                      <span className="text-[10px] text-muted-foreground">adet</span>
                    </div>
                    <div className="mt-1 text-[10px] font-bold text-muted-foreground flex items-center justify-between pt-1 border-t border-border/50">
                      <span className="text-rose-500 font-black">H: {k.scrap ?? 0}</span>
                      <span className="text-amber-500 font-black">T: {k.pending ?? 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Altın Rengi (Alaşım) Dağılımı */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
                Altın Rengi (Alaşım) Dağılımı
              </span>
              <span className="text-[10px] font-mono text-muted-foreground font-bold">
                Sarı / Beyaz / Rose
              </span>
            </div>

            {/* Renk Dağılım Segmenti Barı */}
            {totalColorCount > 0 && (
              <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden flex">
                {standardColors.map(
                  (c) =>
                    c.percentage > 0 && (
                      <div
                        key={c.code}
                        className={`${c.barColor} h-full transition-all`}
                        style={{ width: `${c.percentage}%` }}
                        title={`${c.name}: %${c.percentage} (${c.count} adet)`}
                      />
                    )
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {standardColors.map((colorItem) => (
                <div
                  key={colorItem.code}
                  className="p-2.5 rounded-xl bg-secondary/40 border border-border flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.5 rounded-md border ${colorItem.badgeStyle}`}
                    >
                      {colorItem.name}
                    </span>
                    {colorItem.percentage > 0 && (
                      <span className="text-[10px] font-mono font-bold text-muted-foreground">
                        %{colorItem.percentage}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1">
                    <span className="text-lg font-black text-foreground">{colorItem.count}</span>
                    <span className="text-[10px] text-muted-foreground font-bold">adet</span>
                  </div>
                  <div className="mt-1 text-[10px] font-bold text-muted-foreground flex items-center justify-between pt-1 border-t border-border/50">
                    <span className="text-rose-500 font-black">H: {colorItem.scrap}</span>
                    <span className="text-amber-500 font-black">T: {colorItem.pending}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sağ 7 Kolon: Malzeme (MATERIAL_NO) Bazlı Kalite & Fire Analizi */}
        <div className="lg:col-span-7 bg-card/70 backdrop-blur-xl border border-border p-4 sm:p-5 rounded-2xl shadow-xs flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Boxes size={16} className="text-blue-500" />
              <div>
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground">
                  Malzeme (Material No) Bazlı Fire Analizi
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Malzeme Hızlı Arama */}
              <div className="relative">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Malzeme ara..."
                  value={materialSearch}
                  onChange={(e) => setMaterialSearch(e.target.value)}
                  className="h-7 w-28 sm:w-36 pl-7 pr-2 bg-secondary/80 border border-border rounded-lg text-[11px] font-bold text-foreground placeholder:text-muted-foreground outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 font-mono font-bold text-[11px] border border-blue-500/20 shrink-0">
                {filteredMaterials.length} Malzeme
              </span>
            </div>
          </div>

          {filteredMaterials.length > 0 ? (
            <div className="max-h-[350px] overflow-y-auto pr-1.5 custom-scrollbar space-y-2">
              {filteredMaterials.map((mat, idx) => (
                <div
                  key={mat.material_no}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl bg-secondary/40 border border-border/60 gap-2 text-xs"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-blue-500/10 text-blue-500 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-foreground">
                          {mat.material_no}
                        </span>
                        {mat.orderCount > 1 && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 text-[10px] font-bold border border-amber-500/20">
                            {mat.orderCount} Farklı Siparişte
                          </span>
                        )}
                      </div>
                      {mat.description && mat.description !== "-" && (
                        <p className="text-[11px] text-muted-foreground truncate font-medium">
                          {mat.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/90 font-medium mt-0.5">
                        <span>
                          İstasyon: <strong className="text-foreground">{mat.primaryLocation}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Kusur: <strong className="text-rose-500">{mat.primaryDefect}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <span className="px-2 py-1 rounded-lg bg-secondary text-foreground font-mono font-bold text-[11px] border border-border">
                      {mat.count} Kayıt
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-500 font-mono font-black text-[11px] border border-rose-500/20">
                      {mat.scrap} Hurda
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
              {materialSearch
                ? "Aramanıza uygun malzeme bulunamadı."
                : "Malzeme kodu bilgisi içeren hurda kaydı bulunamadı."}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 6. (MADDE 1) KUSUR KÖK NEDEN SINIFLANDIRMASI (TASLAK)    */}
      {/* ========================================================= */}
      <div className="bg-card/70 backdrop-blur-xl border border-border p-4 sm:p-5 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-purple-500" />
            <div>
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground">
                Kusur Kök Neden Sınıflandırması
              </h2>
            </div>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 w-fit">
            Taslak Kategori Şablonu
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Kusurların kök neden sınıflarına göre taslak gruplaması (Kategori kuralları ve eşleşmeleri sonradan özelleştirilecektir).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {reportData.rootCauseDraft?.map((cat) => (
            <div
              key={cat.id}
              className="p-3.5 rounded-xl bg-secondary/40 border border-border flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-foreground">
                  <span className="truncate" title={cat.name}>
                    {cat.name}
                  </span>
                  <span className="font-mono font-black" style={{ color: cat.color }}>
                    %{cat.percentage}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                  />
                </div>
                <div className="mt-1.5 text-[11px] font-bold text-muted-foreground">
                  {cat.count} Adet Bildirim
                </div>
              </div>

              {/* Top reasons in this category */}
              <div className="pt-2 border-t border-border/50 space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Öne Çıkan Hatalar
                </span>
                {cat.topReasons && cat.topReasons.length > 0 ? (
                  cat.topReasons.map((r) => (
                    <div key={r.name} className="flex items-center justify-between text-[11px]">
                      <span className="truncate text-foreground/80 font-medium" title={r.name}>
                        {r.name}
                      </span>
                      <span className="font-mono font-bold text-muted-foreground ml-1.5">
                        {r.count}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-[10px] text-muted-foreground italic">Kayıt yok</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 7. (MADDE 3) İSTASYON × HATA ÇAPRAZ MATRİSİ (ISI HARİTASI) */}
      {/* ========================================================= */}
      <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-secondary text-foreground flex items-center justify-center border border-border">
              <Grid size={14} className="text-rose-500" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground">
                İstasyon × Hata Çapraz Isı Haritası (Matris)
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Hangi üretim istasyonunun hangi spesifik hataları ürettiğini gösteren çapraz analiz
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground font-bold">
            Çapraz Dağılım
          </span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-muted/30 border-b border-border font-black text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-4 sticky left-0 bg-card/90 backdrop-blur-md z-10">İstasyon</th>
                <th className="py-3 px-3 text-center">Toplam</th>
                {reportData.stationDefectMatrix?.reasons.map((rName) => (
                  <th key={rName} className="py-3 px-3 text-center max-w-32 truncate" title={rName}>
                    {rName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-medium">
              {!reportData.stationDefectMatrix?.rows ||
              reportData.stationDefectMatrix.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={2 + (reportData.stationDefectMatrix?.reasons.length || 0)}
                    className="py-6 text-center text-muted-foreground text-xs font-bold"
                  >
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                reportData.stationDefectMatrix.rows.map((row) => (
                  <tr key={row.location} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-black text-foreground sticky left-0 bg-card/90 backdrop-blur-md z-10">
                      {row.location}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-foreground">
                      {row.total}
                    </td>
                    {reportData.stationDefectMatrix?.reasons.map((rName) => {
                      const count = row.counts[rName] || 0;
                      if (count === 0) {
                        return (
                          <td
                            key={rName}
                            className="py-3 px-3 text-center font-mono text-muted-foreground/30"
                          >
                            -
                          </td>
                        );
                      }
                      const isHot = count >= 3;
                      return (
                        <td key={rName} className="py-3 px-3 text-center font-mono">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-black ${
                              isHot
                                ? "bg-rose-500/20 text-rose-500 border border-rose-500/30"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            }`}
                          >
                            {count}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 8. İSTASYON DETAY PİVOT TABLOSU                           */}
      {/* ========================================================= */}
      <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-secondary text-foreground flex items-center justify-center border border-border">
              <Layers size={14} />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground">
                İstasyon Bazlı Fire Dağılımı
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Üretim birimlerinin toplam fire hacmi, kesinleşen hurda ve inceleme adetleri
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-secondary text-foreground border border-border">
            {reportData.byLocation.length} İstasyon
          </span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-muted/30 border-b border-border font-black text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-4">İstasyon</th>
                <th className="py-3 px-3 text-center">Toplam Kayıt</th>
                <th className="py-3 px-3 text-center text-rose-500">Hurda</th>
                <th className="py-3 px-3 text-center text-amber-500">Takipte</th>
                <th className="py-3 px-3 text-center">Fire Hacim Payı</th>
                <th className="py-3 px-4">Ağırlıklı Hata Nedeni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-medium">
              {reportData.byLocation.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground text-xs font-bold"
                  >
                    Seçili filtrelere uygun istasyon verisi bulunamadı.
                  </td>
                </tr>
              ) : (
                reportData.byLocation.map((loc: LocationReportItem) => {
                  const share =
                    reportData.summary.totalCount > 0
                      ? Number(((loc.total / reportData.summary.totalCount) * 100).toFixed(1))
                      : 0;

                  return (
                    <tr key={loc.name} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-black text-foreground">{loc.name}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-foreground">
                        {loc.total}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-rose-500">
                        {loc.scrap}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-amber-500">
                        {loc.pending}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center justify-center gap-2">
                          <span className="font-mono font-black text-xs text-foreground">
                            %{share}
                          </span>
                          <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden hidden sm:block">
                            <div
                              className="h-full bg-rose-500 rounded-full transition-all"
                              style={{ width: `${share}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-foreground/90">
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[11px]">
                          {loc.primaryDefect}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
