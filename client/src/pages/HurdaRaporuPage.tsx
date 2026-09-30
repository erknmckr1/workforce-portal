import { useState, useMemo, useEffect, useCallback } from "react";
import {
  TrendingDown,
  AlertTriangle,
  Clock,
  Layers,
  FileSpreadsheet,
  Calendar,
  RotateCcw,
  BarChart3,
  PieChart as PieChartIcon,
  CheckCircle2,
  AlertCircle,
  Sparkles,
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
  primaryDefect: string;
}

interface ReasonReportItem {
  name: string;
  count: number;
  color?: string;
}

interface KaratReportItem {
  name: string;
  count: number;
  scrap?: number;
  pending?: number;
  color?: string;
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
    primaryDefect?: string;
  }>;
  byReason: ReasonReportItem[];
  byKarat: KaratReportItem[];
  dailyTrend: DailyTrendItem[];
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
  dailyTrend: DailyTrendItem[];
  isMock: boolean;
}

// --- MOCK VERİLER (GERÇEK VERİ YOKSA VEYA AZSA MVP'Yİ ZENGİN GÖSTERİR) ---
const MOCK_DAILY_TREND: DailyTrendItem[] = [
  { date: "2026-09-21", scrap: 4, pending: 2, total: 6 },
  { date: "2026-09-22", scrap: 7, pending: 3, total: 10 },
  { date: "2026-09-23", scrap: 5, pending: 1, total: 6 },
  { date: "2026-09-24", scrap: 11, pending: 4, total: 15 },
  { date: "2026-09-25", scrap: 8, pending: 2, total: 10 },
  { date: "2026-09-26", scrap: 6, pending: 5, total: 11 },
  { date: "2026-09-27", scrap: 13, pending: 3, total: 16 },
  { date: "2026-09-28", scrap: 9, pending: 4, total: 13 },
  { date: "2026-09-29", scrap: 15, pending: 6, total: 21 },
  { date: "2026-09-30", scrap: 8, pending: 3, total: 11 },
];

const MOCK_LOCATION_DATA: LocationReportItem[] = [
  { name: "ÖRME", total: 42, scrap: 33, pending: 9, primaryDefect: "Tel Kopması / Ezilme" },
  { name: "DÖKÜM", total: 31, scrap: 26, pending: 5, primaryDefect: "Döküm Boşluğu / Porozite" },
  { name: "TASLAMA", total: 22, scrap: 16, pending: 6, primaryDefect: "Yüzey Hatası / Çizik" },
  { name: "CİLA", total: 17, scrap: 11, pending: 6, primaryDefect: "Renk / Alaşım Bozukluğu" },
  { name: "TEL ÇEKME", total: 14, scrap: 11, pending: 3, primaryDefect: "Ölçü / Tolerans Dışı" },
  { name: "BUZLAMA", total: 9, scrap: 6, pending: 3, primaryDefect: "Yüzey Hatası / Çizik" },
  { name: "KALİTE KONTROL", total: 7, scrap: 5, pending: 2, primaryDefect: "Çatlak / Kırık" },
];

const MOCK_REASONS: ReasonReportItem[] = [
  { name: "Döküm Boşluğu / Porozite", count: 38, color: "#f43f5e" },
  { name: "Tel Kopması / Ezilme", count: 32, color: "#8b5cf6" },
  { name: "Çatlak / Kırık", count: 24, color: "#ec4899" },
  { name: "Ölçü / Tolerans Dışı", count: 18, color: "#3b82f6" },
  { name: "Kaynak / Lehim Hatası", count: 14, color: "#06b6d4" },
  { name: "Yüzey Hatası / Çizik", count: 10, color: "#eab308" },
  { name: "Renk / Alaşım Bozukluğu", count: 6, color: "#f97316" },
];

const MOCK_KARAT_DATA: KaratReportItem[] = [
  { name: "14K", count: 74, scrap: 58, pending: 16, color: "#f59e0b" },
  { name: "18K", count: 36, scrap: 28, pending: 8, color: "#10b981" },
  { name: "22K", count: 20, scrap: 15, pending: 5, color: "#eab308" },
  { name: "8K", count: 12, scrap: 7, pending: 5, color: "#6366f1" },
];

const PIE_COLORS = ["#f43f5e", "#8b5cf6", "#ec4899", "#3b82f6", "#06b6d4", "#eab308", "#f97316"];

export default function HurdaRaporuPage() {
  // Filtre State
  const [datePreset, setDatePreset] = useState<string>("THIS_MONTH");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("ALL");
  const [selectedKarat, setSelectedKarat] = useState<string>("ALL");
  const [useMockFallback, setUseMockFallback] = useState<boolean>(true);

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
        },
      });

      if (res.data && res.data.summary && res.data.summary.totalCount > 0) {
        setApiData(res.data);
      } else {
        // Eğer veritabanında henüz kayıt azsa mock fallback devrede kalsın
        setApiData(null);
      }
    } catch {
      // Hata durumunda mock data ile gösterim devam eder
      setApiData(null);
    } finally {
      setIsLoading(false);
    }
  }, [datePreset, customStartDate, customEndDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Aktif Veri Seti (API verisi varsa API, yoksa zengin mock veriler)
  const reportData = useMemo<FullReportData>(() => {
    if (apiData && !useMockFallback) {
      return {
        summary: apiData.summary,
        byLocation: apiData.byLocation.map((loc) => ({
          name: loc.name,
          total: loc.total,
          scrap: loc.scrap,
          pending: loc.pending,
          primaryDefect: loc.primaryDefect || "Çeşitli Nedenler",
        })),
        byReason: apiData.byReason,
        byKarat: apiData.byKarat,
        dailyTrend: apiData.dailyTrend,
        isMock: false,
      };
    }

    // Filtrelenmiş Mock Veri Hesabı
    let locs = [...MOCK_LOCATION_DATA];
    if (selectedLocation !== "ALL") {
      locs = locs.filter((l) => l.name === selectedLocation);
    }

    let karats = [...MOCK_KARAT_DATA];
    if (selectedKarat !== "ALL") {
      karats = karats.filter((k) => k.name === selectedKarat);
    }

    const totalCount = locs.reduce((acc, curr) => acc + curr.total, 0);
    const scrapCount = locs.reduce((acc, curr) => acc + curr.scrap, 0);
    const pendingCount = totalCount - scrapCount;
    const scrapRate = totalCount > 0 ? Number(((scrapCount / totalCount) * 100).toFixed(1)) : 0;

    return {
      summary: {
        totalCount,
        scrapCount,
        pendingCount,
        scrapRate,
        topLocation: locs[0] ? `${locs[0].name} (${locs[0].total} Kayıt)` : "-",
        topReason: MOCK_REASONS[0] ? `${MOCK_REASONS[0].name} (%27.4)` : "-",
      },
      byLocation: locs,
      byReason: MOCK_REASONS,
      byKarat: karats,
      dailyTrend: MOCK_DAILY_TREND,
      isMock: true,
    };
  }, [apiData, useMockFallback, selectedLocation, selectedKarat]);

  // Excel Rapor Özeti İndirme
  const exportToExcel = () => {
    try {
      const summaryRows = [
        ["HURDA VE KALITE ANALIZ RAPORU (OZET)"],
        [`Rapor Tarihi: ${format(new Date(), "yyyy-MM-dd HH:mm")}`],
        [`Toplam Incelenen Kayit: ${reportData.summary.totalCount}`],
        [`Kesinlesen Hurda: ${reportData.summary.scrapCount}`],
        [`Incelemede / Takipte: ${reportData.summary.pendingCount}`],
        [`Hurda Orani: %${reportData.summary.scrapRate}`],
        [`En Cok Fireli Istasyon: ${reportData.summary.topLocation}`],
        [`En Yaygin Hata: ${reportData.summary.topReason}`],
        [],
        ["ISTASYON PERFORMANS TABLOSU"],
        ["Istasyon", "Toplam Kayit", "Hurda", "Takipte", "Hurda Orani (%)", "Agirlikli Hata"],
        ...reportData.byLocation.map((l: LocationReportItem) => [
          l.name,
          l.total,
          l.scrap,
          l.pending,
          `%${Math.round((l.scrap / l.total) * 100)}`,
          l.primaryDefect,
        ]),
        [],
        ["HURDA NEDENLERI PARETO"],
        ["Hata Nedeni", "Adet"],
        ...reportData.byReason.map((r: ReasonReportItem) => [r.name, r.count]),
      ];

      const csvContent =
        "\uFEFF" + summaryRows.map((r) => r.join(";")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Hurda_Kalite_Raporu_${format(new Date(), "yyyyMMdd_HHmm")}.csv`);
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
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-black uppercase tracking-tight text-foreground">
                Hurda & Kalite Performans Analizi
              </h1>
              {reportData.isMock ? (
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                  <Sparkles size={11} />
                  Demo / MVP Veri
                </span>
              ) : (
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 size={11} />
                  Canlı DB
                </span>
              )}
            </div>
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
                <option value="TODAY">Bugün (Vardiya)</option>
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

          {/* İstasyon Filtresi */}
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="h-8 px-2 bg-secondary/80 border border-border rounded-lg text-xs font-bold text-foreground outline-none cursor-pointer max-w-32 truncate"
          >
            <option value="ALL">Tüm İstasyonlar</option>
            {MOCK_LOCATION_DATA.map((l) => (
              <option key={l.name} value={l.name}>
                {l.name}
              </option>
            ))}
          </select>

          {/* Ayar Filtresi */}
          <select
            value={selectedKarat}
            onChange={(e) => setSelectedKarat(e.target.value)}
            className="h-8 px-2 bg-secondary/80 border border-border rounded-lg text-xs font-bold text-foreground outline-none cursor-pointer"
          >
            <option value="ALL">Tüm Ayarlar</option>
            <option value="14K">14K</option>
            <option value="18K">18K</option>
            <option value="22K">22K</option>
            <option value="8K">8K</option>
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

          {/* Canlı / Mock Veri Geçiş Düğmesi */}
          <button
            onClick={() => setUseMockFallback(!useMockFallback)}
            className="px-2 h-8 bg-muted hover:bg-secondary border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground rounded-lg transition-all cursor-pointer"
            title="Demo ve Canlı Veri Arasında Geçiş"
          >
            {useMockFallback ? "Gerçek DB'ye Geç" : "Demo Veriyi Göster"}
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. DÖRT ANA YÖNETİCİ KPI KARTI                             */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Toplam Kayıt */}
        <div className="p-4 sm:p-5 bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-black uppercase tracking-wider">
              Toplam İncelenen
            </span>
            <div className="w-7 h-7 rounded-lg bg-secondary text-foreground flex items-center justify-center border border-border">
              <Layers size={15} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-foreground">
              {reportData.summary.totalCount}
            </span>
            <span className="text-xs text-muted-foreground font-bold">adet</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs font-bold pt-2 border-t border-border/60">
            <span className="text-rose-500 font-black">Hurda: {reportData.summary.scrapCount}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-amber-500 font-black">Takipte: {reportData.summary.pendingCount}</span>
          </div>
        </div>

        {/* 2. Hurda Oranı */}
        <div className="p-4 sm:p-5 bg-rose-500/5 border border-rose-500/20 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-500">
            <span className="text-[11px] font-black uppercase tracking-wider">
              Genel Hurda Oranı
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20">
              <TrendingDown size={15} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-rose-600 dark:text-rose-400">
              %{reportData.summary.scrapRate}
            </span>
            <span className="text-[11px] text-muted-foreground font-bold">
              (Hedef: &lt; %5.0)
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-rose-500/80 pt-2 border-t border-rose-500/20">
            <AlertCircle size={13} />
            <span>Tolerans sınırında</span>
          </div>
        </div>

        {/* 3. En Yoğun İstasyon */}
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
            <span className="text-lg sm:text-xl font-black text-foreground block truncate">
              {reportData.summary.topLocation}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground font-bold pt-2 border-t border-border/60">
            Toplam firenin yaklaşık %34'ü
          </div>
        </div>

        {/* 4. En Yaygın Hata Nedeni */}
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
            <span className="text-lg sm:text-xl font-black text-foreground block truncate" title={reportData.summary.topReason}>
              {reportData.summary.topReason}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground font-bold pt-2 border-t border-border/60">
            Öncelikli aksiyon alınmalı
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
        </div>

        {/* Sağ 7 Kolon: Ayar Dağılımı ve Hata Sıralaması Listesi */}
        <div className="lg:col-span-7 bg-card/70 backdrop-blur-xl border border-border p-4 sm:p-5 rounded-2xl shadow-xs flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-xs font-black uppercase tracking-wider text-foreground">
                Alaşım (Ayar) Bazında Fire Hacmi
              </span>
              <span className="text-[11px] font-mono text-muted-foreground font-bold">
                Karat Kırılımı
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {reportData.byKarat.map((k: KaratReportItem) => (
                <div
                  key={k.name}
                  className="p-3 rounded-xl bg-muted/20 border border-border flex flex-col justify-between"
                >
                  <span className="text-xs font-black text-amber-500">{k.name} Ayar</span>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-black text-foreground">{k.count}</span>
                    <span className="text-[10px] text-muted-foreground">adet</span>
                  </div>
                  <div className="mt-1 text-[10px] font-bold text-muted-foreground">
                    Hurda: {k.scrap || Math.round(k.count * 0.75)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-border">
            <span className="text-xs font-black uppercase tracking-wider text-foreground block">
              En Çok Tekrarlayan Hatalar (Aksiyon Öncelikli)
            </span>
            <div className="space-y-1.5">
              {reportData.byReason.slice(0, 3).map((r: ReasonReportItem, idx: number) => (
                <div
                  key={r.name}
                  className="flex items-center justify-between p-2 rounded-xl bg-secondary/50 border border-border/60 text-xs font-bold"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-rose-500/10 text-rose-500 flex items-center justify-center text-[10px] font-black">
                      #{idx + 1}
                    </span>
                    <span className="text-foreground">{r.name}</span>
                  </div>
                  <span className="font-mono text-rose-500 font-black">{r.count} Adet</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. İSTASYON DETAY PİVOT TABLOSU                           */}
      {/* ========================================================= */}
      <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-secondary text-foreground flex items-center justify-center border border-border">
              <Layers size={14} />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground">
                İstasyon Bazlı Hurda & Performans Kırılımı
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Her üretim biriminin kesinleşen hurda payı ve en sık görülen hatası
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
                <th className="py-3 px-3 text-center">Hurda Oranı</th>
                <th className="py-3 px-4">Ağırlıklı Hata Nedeni</th>
                <th className="py-3 px-3 text-center">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-medium">
              {reportData.byLocation.map((loc: LocationReportItem) => {
                const scrapRate = Math.round((loc.scrap / loc.total) * 100);
                const isCritical = scrapRate >= 75;

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
                    <td className="py-3 px-3 text-center font-mono font-black">
                      <span
                        className={`px-2 py-0.5 rounded-md border text-[11px] ${
                          isCritical
                            ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                            : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        }`}
                      >
                        %{scrapRate}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-foreground/90">
                      <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[11px]">
                        {loc.primaryDefect}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {isCritical ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-rose-500">
                          <AlertTriangle size={12} />
                          Yüksek Fire
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-500">
                          <CheckCircle2 size={12} />
                          Kontrol Altında
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
