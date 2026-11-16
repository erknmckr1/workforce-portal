import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import { toast } from "sonner";
import { format, subDays, startOfWeek, startOfMonth } from "date-fns";
import * as XLSX from "xlsx";
import DataTable, { type DataTableColumn } from "@/components/common/DataTable";
import {
  Calendar,
  Download,
  Loader2,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  Award,
  Layers,
  Percent,
  Filter,
  X,
  User,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from "recharts";

// --- TYPES ---
interface QualitySummaryKPIs {
  totalChecks: number;
  totalGoodGr: number;
  totalRepairGr: number;
  totalRepairItems: number;
  totalOrders: number;
  totalMaterials: number;
  repairRate: number;
  topDefect: string;
  topDept: string;
}

interface DailyTrendItem {
  date: string;
  totalChecks: number;
  goodGr: number;
  repairCount: number;
  repairGr: number;
}

interface DefectParetoItem {
  reasonId: number;
  reasonName: string;
  count: number;
  totalQty: number;
}

interface DepartmentBreakdownItem {
  department: string;
  count: number;
  totalQty: number;
}

interface OperatorPerformanceItem {
  operatorId: string;
  operatorName: string;
  totalChecks: number;
  totalGoodGr: number;
  repairItemsCount: number;
  totalRepairGr: number;
  jobsWithRepair: number;
  detectionRate: number;
}

interface AvailableOperator {
  id: string;
  name: string;
}

interface QualitySummaryResponse {
  success: boolean;
  data: {
    kpis: QualitySummaryKPIs;
    dailyTrend: DailyTrendItem[];
    defectPareto: DefectParetoItem[];
    departmentBreakdown: DepartmentBreakdownItem[];
    operatorPerformance: OperatorPerformanceItem[];
    availableOperators: AvailableOperator[];
  };
}

interface QualityDetailItem {
  repair_id: number;
  work_log_id: number;
  order_no: string;
  material_no: string;
  operator_id: string;
  operator_name: string;
  repair_reason_id: number;
  repair_reason_name: string;
  repair_qty_gr: number;
  target_department: string;
  good_qty_gr: number;
  start_date: string;
  end_date: string;
  finish_description: string;
}

interface QualityDetailsResponse {
  success: boolean;
  data: QualityDetailItem[];
  pagination: {
    totalCount: number;
    currentPage: number;
    limit: number;
    totalPages: number;
  };
}

const COLORS = [
  "#f59e0b",
  "#ef4444",
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#6366f1",
  "#14b8a6",
  "#84cc16",
  "#a855f7",
];

export default function KaliteKontrolRaporu() {
  // --- FILTERS STATE ---
  const [datePreset, setDatePreset] = useState<"ALL" | "THIS_MONTH" | "THIS_WEEK" | "YESTERDAY" | "TODAY" | "CUSTOM">("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [selectedOperator, setSelectedOperator] = useState<string>("ALL");
  const [selectedDefect, setSelectedDefect] = useState<string>("ALL");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");

  // Detay tablosu arama ve sayfalama
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Tarih Preset Değişimi
  const handlePresetChange = (preset: "ALL" | "THIS_MONTH" | "THIS_WEEK" | "YESTERDAY" | "TODAY" | "CUSTOM") => {
    setDatePreset(preset);
    setPage(1);

    const todayStr = format(new Date(), "yyyy-MM-dd");

    if (preset === "ALL") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "TODAY") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "YESTERDAY") {
      const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
      setStartDate(yesterday);
      setEndDate(yesterday);
    } else if (preset === "THIS_WEEK") {
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
      setStartDate(weekStart);
      setEndDate(todayStr);
    } else if (preset === "THIS_MONTH") {
      const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
      setStartDate(monthStart);
      setEndDate(todayStr);
    }
  };

  // --- 1. ÖZET VE GRAFİK VERİSİ QUERY ---
  const {
    data: summaryRes,
    isLoading: isSummaryLoading,
    isFetching: isSummaryFetching,
    refetch: refetchSummary,
  } = useQuery<QualitySummaryResponse>({
    queryKey: ["qualityReportSummary", startDate, endDate, selectedOperator, selectedDefect, selectedDept],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (selectedOperator !== "ALL") params.append("operatorId", selectedOperator);
      if (selectedDefect !== "ALL") params.append("defectReason", selectedDefect);
      if (selectedDept !== "ALL") params.append("targetDept", selectedDept);

      const res = await apiClient.get(`/quality-report/summary?${params.toString()}`);
      return res.data;
    },
  });

  // --- 2. DETAY LİSTESİ QUERY ---
  const {
    data: detailsRes,
    isLoading: isDetailsLoading,
    isFetching: isDetailsFetching,
    refetch: refetchDetails,
  } = useQuery<QualityDetailsResponse>({
    queryKey: [
      "qualityReportDetails",
      startDate,
      endDate,
      selectedOperator,
      selectedDefect,
      selectedDept,
      searchTerm,
      page,
      limit,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (selectedOperator !== "ALL") params.append("operatorId", selectedOperator);
      if (selectedDefect !== "ALL") params.append("defectReason", selectedDefect);
      if (selectedDept !== "ALL") params.append("targetDept", selectedDept);
      if (searchTerm.trim()) params.append("search", searchTerm.trim());
      params.append("page", String(page));
      params.append("limit", String(limit));

      const res = await apiClient.get(`/quality-report/details?${params.toString()}`);
      return res.data;
    },
  });

  const summary = summaryRes?.data;
  const kpis = summary?.kpis;
  const details = detailsRes?.data || [];
  const pagination = detailsRes?.pagination;

  // Reusable DataTable Kolon Tanımları
  const detailColumns = useMemo<DataTableColumn<QualityDetailItem>[]>(
    () => [
      {
        header: "Tarih",
        accessor: (row) => (
          <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
            {row.start_date ? format(new Date(row.start_date), "yyyy-MM-dd HH:mm") : "-"}
          </span>
        ),
        width: "135px",
      },
      {
        header: "Sipariş No",
        accessor: (row) => <span className="font-mono font-bold text-foreground">{row.order_no}</span>,
        width: "120px",
      },
      {
        header: "Malzeme No",
        accessor: (row) => <span className="font-mono text-xs text-muted-foreground">{row.material_no}</span>,
        width: "120px",
      },
      {
        header: "Kalite Operatörü",
        accessor: (row) => <span className="font-semibold text-foreground">{row.operator_name}</span>,
      },
      {
        header: "Kusur Nedeni",
        accessor: (row) => (
          <span className="inline-block px-2.5 py-1 rounded-xl text-xs font-black bg-rose-500/10 text-rose-500 border border-rose-500/20 whitespace-nowrap">
            {row.repair_reason_name}
          </span>
        ),
      },
      {
        header: "Tamir Gr",
        align: "right",
        accessor: (row) => (
          <span className="font-mono font-bold text-rose-500 whitespace-nowrap">
            {row.repair_qty_gr.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gr
          </span>
        ),
      },
      {
        header: "Sevk Edilen Bölüm",
        accessor: (row) => (
          <span className="inline-block px-2.5 py-1 rounded-xl text-xs font-bold bg-muted text-muted-foreground whitespace-nowrap">
            {row.target_department}
          </span>
        ),
      },
      {
        header: "Sağlam Gr",
        align: "right",
        accessor: (row) => (
          <span className="font-mono text-emerald-500 font-semibold whitespace-nowrap">
            {row.good_qty_gr.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gr
          </span>
        ),
      },
      {
        header: "Not / Açıklama",
        accessor: (row) => (
          <span className="text-xs text-muted-foreground max-w-xs truncate block" title={row.finish_description}>
            {row.finish_description || "-"}
          </span>
        ),
      },
    ],
    []
  );

  // Tüm filtreleri temizle
  const handleResetFilters = () => {
    setDatePreset("ALL");
    setStartDate("");
    setEndDate("");
    setSelectedOperator("ALL");
    setSelectedDefect("ALL");
    setSelectedDept("ALL");
    setSearchTerm("");
    setPage(1);
    toast.info("Tüm filtreler sıfırlandı.");
  };

  // Aktif Filtre Kontrolü ve Seçili Operatör Adı
  const hasActiveFilters =
    datePreset !== "ALL" ||
    startDate !== "" ||
    endDate !== "" ||
    selectedOperator !== "ALL" ||
    selectedDefect !== "ALL" ||
    selectedDept !== "ALL" ||
    searchTerm.trim() !== "";

  const selectedOperatorName = useMemo(() => {
    if (selectedOperator === "ALL") return "";
    const found = summary?.availableOperators?.find((o) => o.id === selectedOperator);
    return found ? found.name : `ID: ${selectedOperator}`;
  }, [selectedOperator, summary?.availableOperators]);

  // Grafikten Kusur Filtreleme (Drill-down / Toggle)
  const handleToggleDefect = (reasonName: string) => {
    if (selectedDefect === reasonName) {
      setSelectedDefect("ALL");
      toast.info("Kusur filtresi kaldırıldı.");
    } else {
      setSelectedDefect(reasonName);
      toast.success(`"${reasonName}" kusuru filtrelendi.`);
    }
    setPage(1);
  };

  // Grafikten Departman Filtreleme (Drill-down / Toggle)
  const handleToggleDept = (deptName: string) => {
    if (selectedDept === deptName) {
      setSelectedDept("ALL");
      toast.info("Bölüm filtresi kaldırıldı.");
    } else {
      setSelectedDept(deptName);
      toast.success(`"${deptName}" bölümü filtrelendi.`);
    }
    setPage(1);
  };

  // --- EXCEL / CSV DIŞA AKTARMA ---
  const handleExportExcel = () => {
    try {
      if (!summary) {
        toast.warning("Dışa aktarılacak veri henüz yüklenmedi.");
        return;
      }

      const wb = XLSX.utils.book_new();

      // 1. KPI Özeti
      const kpiData = [
        ["METRİK", "DEĞER"],
        ["Toplam Kalite Kontrol İş Emri", kpis?.totalChecks || 0],
        ["Toplam Sağlam Onaylanan (Gram)", kpis?.totalGoodGr || 0],
        ["Toplam Tespit Edilen Tamir / Fire (Gram)", kpis?.totalRepairGr || 0],
        ["Toplam Tamirli Parça Adedi", kpis?.totalRepairItems || 0],
        ["Genel Tamir / Fire Oranı (%)", `%${kpis?.repairRate || 0}`],
        ["En Yaygın Kusur", kpis?.topDefect || "-"],
        ["En Çok İade Alan Bölüm", kpis?.topDept || "-"],
      ];
      const wsKpi = XLSX.utils.aoa_to_sheet(kpiData);
      XLSX.utils.book_append_sheet(wb, wsKpi, "KPI_Ozeti");

      // 2. Operatör Performansı
      const opData = [
        ["Operatör ID", "Operatör Adı", "Kontrol Sayısı", "Sağlam Gr", "Tamirli İş", "Tamir Gr", "Hata Tespit Oranı (%)"],
        ...(summary.operatorPerformance || []).map((op) => [
          op.operatorId,
          op.operatorName,
          op.totalChecks,
          op.totalGoodGr,
          op.jobsWithRepair,
          op.totalRepairGr,
          `%${op.detectionRate}`,
        ]),
      ];
      const wsOp = XLSX.utils.aoa_to_sheet(opData);
      XLSX.utils.book_append_sheet(wb, wsOp, "Operator_Performansi");

      // 3. Kusur Pareto
      const paretoData = [
        ["Kusur Adı", "Adet", "Toplam Miktar (Gr)"],
        ...(summary.defectPareto || []).map((p) => [p.reasonName, p.count, p.totalQty]),
      ];
      const wsPareto = XLSX.utils.aoa_to_sheet(paretoData);
      XLSX.utils.book_append_sheet(wb, wsPareto, "Kusur_Pareto");

      // 4. Detay Kayıtları (Mevcut Görünüm)
      const detailRows = [
        [
          "Tamir ID",
          "İş Log ID",
          "Sipariş No",
          "Malzeme No",
          "Operatör",
          "Kusur Nedeni",
          "Tamir Miktarı (Gr)",
          "Sevk Edilen Bölüm",
          "Sağlam Gr",
          "Tarih",
          "Açıklama",
        ],
        ...details.map((d) => [
          d.repair_id,
          d.work_log_id,
          d.order_no,
          d.material_no,
          d.operator_name,
          d.repair_reason_name,
          d.repair_qty_gr,
          d.target_department,
          d.good_qty_gr,
          d.start_date ? format(new Date(d.start_date), "yyyy-MM-dd HH:mm") : "",
          d.finish_description || "",
        ]),
      ];
      const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
      XLSX.utils.book_append_sheet(wb, wsDetail, "Tamir_Detay_Kayitlari");

      const fileName = `Kalite_Kontrol_Raporu_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("Excel raporu başarıyla indirildi.");
    } catch (err) {
      console.error("Export Excel Error:", err);
      toast.error("Excel aktarımı sırasında bir hata oluştu.");
    }
  };

  // Yenileme
  const handleRefreshAll = () => {
    refetchSummary();
    refetchDetails();
    toast.success("Veriler güncellendi.");
  };

  const isGlobalFetching = isSummaryFetching || isDetailsFetching;

  return (
    <div className="w-full mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
      {/* 1. ÜST KONTROL & AKSİYON BARI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-border/60 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight uppercase text-foreground">
              Kalite Kontrol & <span className="text-amber-500">Tamir Performansı</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              Canlı MES Verisi
            </span>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium">
            Montaj & Kalite istasyonunda kontrol edilen iş emirleri, tespit edilen kusurlar ve operatör analitiği.
          </p>
        </div>

        {/* Butonlar */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleRefreshAll}
            disabled={isGlobalFetching}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-border bg-card hover:bg-muted text-xs font-bold text-foreground transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={15} className={isGlobalFetching ? "animate-spin text-amber-500" : ""} />
            <span>Yenile</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all shadow-md shadow-emerald-600/20 active:scale-95"
          >
            <Download size={15} />
            <span>Excel'e Aktar</span>
          </button>
        </div>
      </div>

      {/* 2. GELİŞMİŞ FİLTRE VE TARİH SEÇİCİ BÖLÜMÜ */}
      <div className="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tarih Preset Butonları */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-black uppercase tracking-wider text-muted-foreground mr-1 flex items-center gap-1">
              <Calendar size={14} /> Tarih:
            </span>
            {(
              [
                { id: "ALL", label: "Tüm Zamanlar" },
                { id: "THIS_MONTH", label: "Bu Ay" },
                { id: "THIS_WEEK", label: "Bu Hafta" },
                { id: "YESTERDAY", label: "Dün" },
                { id: "TODAY", label: "Bugün" },
                { id: "CUSTOM", label: "Özel Tarih" },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetChange(preset.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  datePreset === preset.id
                    ? "bg-amber-500 text-black shadow-md font-black"
                    : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Filtreleri Sıfırla */}
          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-rose-500 transition-colors"
          >
            <RotateCcw size={14} />
            Filtreleri Sıfırla
          </button>
        </div>

        {/* Detaylı Filtre Seçimleri Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-2 border-t border-border/40">
          {/* Özel Tarih Başlangıç */}
          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block mb-1">
              Başlangıç Tarihi
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDatePreset("CUSTOM");
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Özel Tarih Bitiş */}
          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block mb-1">
              Bitiş Tarihi
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDatePreset("CUSTOM");
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Kalite Operatörü Seçimi */}
          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block mb-1">
              Kalite Operatörü
            </label>
            <select
              value={selectedOperator}
              onChange={(e) => {
                setSelectedOperator(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">Tüm Operatörler</option>
              {summary?.availableOperators?.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.name}
                </option>
              ))}
            </select>
          </div>

          {/* Kusur Nedeni Seçimi */}
          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block mb-1">
              Kusur Nedeni
            </label>
            <select
              value={selectedDefect}
              onChange={(e) => {
                setSelectedDefect(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">Tüm Kusurlar</option>
              {summary?.defectPareto?.map((p) => (
                <option key={p.reasonId} value={p.reasonName}>
                  {p.reasonName} ({p.count} adet)
                </option>
              ))}
            </select>
          </div>

          {/* Sevk Edilen Bölüm Seçimi */}
          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block mb-1">
              Sevk Edilen Bölüm
            </label>
            <select
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">Tüm Bölümler</option>
              <option value="MONTAJ">MONTAJ</option>
              <option value="TAMİR TEZGAHI">TAMİR TEZGAHI</option>
              <option value="CİLA">CİLA</option>
              <option value="MİNE">MİNE</option>
              <option value="DÖKÜM">DÖKÜM</option>
              <option value="YALDIZ">YALDIZ</option>
              <option value="LAZER">LAZER</option>
              <option value="Diğer / Belirtilmemiş">Diğer / Belirtilmemiş</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2.1 AKTİF FİLTRE ÇİPLERİ (FILTER CHIPS) */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-xs animate-in fade-in duration-300">
          <span className="font-black uppercase tracking-wider text-amber-500 flex items-center gap-1.5 shrink-0">
            <Filter size={13} /> Aktif Filtreler:
          </span>

          {/* Tarih Çipi */}
          {(datePreset !== "ALL" || startDate || endDate) && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-card border border-border font-bold text-foreground shadow-2xs">
              <Calendar size={12} className="text-amber-500" />
              <span>
                {datePreset === "TODAY"
                  ? "Bugün"
                  : datePreset === "YESTERDAY"
                  ? "Dün"
                  : datePreset === "THIS_WEEK"
                  ? "Bu Hafta"
                  : datePreset === "THIS_MONTH"
                  ? "Bu Ay"
                  : `${startDate || "..."} - ${endDate || "..."}`}
              </span>
              <button
                onClick={() => handlePresetChange("ALL")}
                className="hover:text-rose-500 transition-colors cursor-pointer ml-0.5"
                title="Tarih filtresini kaldır"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {/* Operatör Çipi */}
          {selectedOperator !== "ALL" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-card border border-border font-bold text-foreground shadow-2xs">
              <User size={12} className="text-amber-500" />
              <span>Operatör: {selectedOperatorName}</span>
              <button
                onClick={() => {
                  setSelectedOperator("ALL");
                  setPage(1);
                }}
                className="hover:text-rose-500 transition-colors cursor-pointer ml-0.5"
                title="Operatör filtresini kaldır"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {/* Kusur Çipi */}
          {selectedDefect !== "ALL" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-card border border-rose-500/30 text-rose-500 font-bold shadow-2xs">
              <ShieldAlert size={12} />
              <span>Kusur: {selectedDefect}</span>
              <button
                onClick={() => {
                  setSelectedDefect("ALL");
                  setPage(1);
                }}
                className="hover:text-rose-700 transition-colors cursor-pointer ml-0.5"
                title="Kusur filtresini kaldır"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {/* Departman Çipi */}
          {selectedDept !== "ALL" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-card border border-border font-bold text-foreground shadow-2xs">
              <Layers size={12} className="text-purple-500" />
              <span>Bölüm: {selectedDept}</span>
              <button
                onClick={() => {
                  setSelectedDept("ALL");
                  setPage(1);
                }}
                className="hover:text-rose-500 transition-colors cursor-pointer ml-0.5"
                title="Departman filtresini kaldır"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {/* Arama Çipi */}
          {searchTerm.trim() !== "" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-card border border-border font-bold text-foreground shadow-2xs">
              <Search size={12} className="text-muted-foreground" />
              <span>Arama: "{searchTerm.trim()}"</span>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setPage(1);
                }}
                className="hover:text-rose-500 transition-colors cursor-pointer ml-0.5"
                title="Aramayı temizle"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {/* Hepsini Temizle */}
          <button
            onClick={handleResetFilters}
            className="text-[11px] font-bold text-muted-foreground hover:text-rose-500 underline ml-auto transition-colors cursor-pointer"
          >
            Tüm Filtreleri Temizle
          </button>
        </div>
      )}

      {/* 3. ANA KPI KARTLARI (5'Lİ GRID) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {/* KPI 1: Toplam Kontrol */}
        <div className="p-6 rounded-3xl bg-card border border-border relative overflow-hidden group hover:border-amber-500/40 transition-all shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Toplam Kontrol
            </span>
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-3xl font-black text-foreground tracking-tight">
              {isSummaryLoading ? (
                <Loader2 className="animate-spin text-amber-500" size={24} />
              ) : (
                kpis?.totalChecks?.toLocaleString("tr-TR") || 0
              )}
            </h3>
            <p className="text-xs font-semibold text-emerald-500">
              Sağlam:{" "}
              {((kpis?.totalGoodGr || 0) / 1000).toLocaleString("tr-TR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              kg
            </p>
          </div>
        </div>

        {/* KPI 2: Tespit Edilen Tamir */}
        <div className="p-6 rounded-3xl bg-card border border-border relative overflow-hidden group hover:border-rose-500/40 transition-all shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Tespit Edilen Tamir
            </span>
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-3xl font-black text-rose-500 tracking-tight">
              {isSummaryLoading ? (
                <Loader2 className="animate-spin text-rose-500" size={24} />
              ) : (
                kpis?.totalRepairItems?.toLocaleString("tr-TR") || 0
              )}
            </h3>
            <p className="text-xs font-semibold text-rose-400">
              Tamir Fire:{" "}
              {((kpis?.totalRepairGr || 0) / 1000).toLocaleString("tr-TR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              kg
            </p>
          </div>
        </div>

        {/* KPI 3: Fire / Tamir Oranı */}
        <div className="p-6 rounded-3xl bg-card border border-border relative overflow-hidden group hover:border-indigo-500/40 transition-all shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Fire / Tamir Oranı
            </span>
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Percent size={20} />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-3xl font-black text-indigo-500 tracking-tight">
              {isSummaryLoading ? (
                <Loader2 className="animate-spin text-indigo-500" size={24} />
              ) : (
                `%${kpis?.repairRate || 0}`
              )}
            </h3>
            <p className="text-xs font-semibold text-muted-foreground">
              Tamir Gr / Toplam İş Gr
            </p>
          </div>
        </div>

        {/* KPI 4: En Yaygın Kusur */}
        <div className="p-6 rounded-3xl bg-card border border-border relative overflow-hidden group hover:border-amber-500/40 transition-all shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              En Yaygın Kusur
            </span>
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <ShieldAlert size={20} />
            </div>
          </div>
          <div className="space-y-1">
            <h3
              className="text-xl font-black text-foreground tracking-tight truncate"
              title={kpis?.topDefect || "-"}
            >
              {isSummaryLoading ? (
                <Loader2 className="animate-spin text-amber-500" size={24} />
              ) : (
                kpis?.topDefect || "-"
              )}
            </h3>
            <p className="text-xs font-semibold text-muted-foreground">
              En çok tekrarlanan hata
            </p>
          </div>
        </div>

        {/* KPI 5: En Çok Sevk Edilen Bölüm */}
        <div className="p-6 rounded-3xl bg-card border border-border relative overflow-hidden group hover:border-purple-500/40 transition-all shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              En Çok Sevk Bölümü
            </span>
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Layers size={20} />
            </div>
          </div>
          <div className="space-y-1">
            <h3
              className="text-xl font-black text-foreground tracking-tight truncate"
              title={kpis?.topDept || "-"}
            >
              {isSummaryLoading ? (
                <Loader2 className="animate-spin text-purple-500" size={24} />
              ) : (
                kpis?.topDept || "-"
              )}
            </h3>
            <p className="text-xs font-semibold text-muted-foreground">
              Düzeltme hedef istasyonu
            </p>
          </div>
        </div>
      </div>

      {/* 4. GRAFİK BÖLÜMÜ (GÜNLÜK TREND, PARETO VE HEDEF BÖLÜMLER) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grafik 1: Günlük Seyir Trendi (2 Kolon) */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-card border border-border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black tracking-tight text-foreground uppercase">
                Günlük Kontrol & Tamir Trendi
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                Zaman içindeki kontrol adedi ve tespit edilen tamirli iş yoğunluğu
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
              <span className="text-xs font-bold text-muted-foreground">Kontrol Adedi</span>
              <span className="w-3 h-3 rounded-full bg-rose-500 inline-block ml-2" />
              <span className="text-xs font-bold text-muted-foreground">Tamir Adedi</span>
            </div>
          </div>

          <div className="h-72 w-full pt-4">
            {isSummaryLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="animate-spin text-amber-500" size={32} />
              </div>
            ) : !summary?.dailyTrend || summary.dailyTrend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm font-medium">
                Seçili tarih aralığında trend verisi bulunamadı.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={summary.dailyTrend}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorChecks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorRepairs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(val) => {
                      try {
                        return format(new Date(val), "dd MMM");
                      } catch {
                        return val;
                      }
                    }}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(17, 24, 39, 0.95)",
                      borderRadius: "16px",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#fff",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalChecks"
                    name="Kontrol Sayısı"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorChecks)"
                  />
                  <Area
                    type="monotone"
                    dataKey="repairCount"
                    name="Tamir Kaydı"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRepairs)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Grafik 2: Hedef Bölüm Dağılımı Donut (1 Kolon) */}
        <div className="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black tracking-tight text-foreground uppercase">
                Sevk Edilen Bölümler
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                Tamire gönderilen ürünlerin departman dağılımı (Dilime tıklayarak filtreleyin)
              </p>
            </div>
            {selectedDept !== "ALL" && (
              <button
                onClick={() => handleToggleDept(selectedDept)}
                className="text-xs font-bold text-amber-500 hover:underline cursor-pointer"
              >
                Filtreyi Kaldır
              </button>
            )}
          </div>

          <div className="h-72 w-full flex items-center justify-center">
            {isSummaryLoading ? (
              <Loader2 className="animate-spin text-amber-500" size={32} />
            ) : !summary?.departmentBreakdown || summary.departmentBreakdown.length === 0 ? (
              <div className="text-muted-foreground text-sm font-medium">
                Departman verisi bulunamadı.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summary.departmentBreakdown}
                    dataKey="count"
                    nameKey="department"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={4}
                  >
                    {summary.departmentBreakdown.map((entry, index) => {
                      const isSelected = selectedDept === entry.department;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          opacity={selectedDept === "ALL" || isSelected ? 1 : 0.35}
                          stroke={isSelected ? "#ffffff" : undefined}
                          strokeWidth={isSelected ? 3 : 0}
                          className="cursor-pointer transition-all"
                          onClick={() => handleToggleDept(entry.department)}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(17, 24, 39, 0.95)",
                      borderRadius: "16px",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#fff",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                    formatter={(
                      value: number | string | readonly (number | string)[] | undefined,
                      name: string | number | undefined,
                      item: { payload?: { totalQty?: number } }
                    ) => [
                      `${Number(value || 0).toLocaleString()} adet (${item?.payload?.totalQty || 0} gr) - Tıkla & Filtrele`,
                      String(name || "Bölüm"),
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* 5. KUSUR PARETO GRAFİĞİ (TOP 12 HATA) */}
      <div className="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black tracking-tight text-foreground uppercase">
              Kusur Nedenleri Pareto Dağılımı (Top 12)
            </h3>
            <p className="text-xs text-muted-foreground font-medium">
              En çok seçilen hata ve tamir gerekçeleri (Sütuna tıklayarak tabloyu o kusura göre filtreleyebilirsiniz)
            </p>
          </div>
          {selectedDefect !== "ALL" && (
            <button
              onClick={() => handleToggleDefect(selectedDefect)}
              className="text-xs font-bold text-amber-500 hover:underline cursor-pointer"
            >
              Kusur Filtresini Kaldır
            </button>
          )}
        </div>

        <div className="h-72 w-full pt-4">
          {isSummaryLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="animate-spin text-amber-500" size={32} />
            </div>
          ) : !summary?.defectPareto || summary.defectPareto.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm font-medium">
              Kusur verisi bulunamadı.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={summary.defectPareto}
                margin={{ top: 10, right: 10, left: -10, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis
                  dataKey="reasonName"
                  tick={{ fontSize: 10, angle: -25, textAnchor: "end" }}
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(17, 24, 39, 0.95)",
                    borderRadius: "16px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                  formatter={(
                    value: number | string | readonly (number | string)[] | undefined,
                    _name: string | number | undefined,
                    item: { payload?: { totalQty?: number } }
                  ) => [
                    `${Number(value || 0).toLocaleString()} adet (${item?.payload?.totalQty || 0} gr) - Tıkla & Filtrele`,
                    "Kusur Sayısı",
                  ]}
                />
                <Bar dataKey="count" fill="#f59e0b" radius={[8, 8, 0, 0]}>
                  {summary.defectPareto.map((entry, index) => {
                    const isSelected = selectedDefect === entry.reasonName;
                    return (
                      <Cell
                        key={`bar-${index}`}
                        fill={isSelected ? "#f59e0b" : COLORS[index % COLORS.length]}
                        opacity={selectedDefect === "ALL" || isSelected ? 1 : 0.35}
                        stroke={isSelected ? "#ffffff" : undefined}
                        strokeWidth={isSelected ? 2 : 0}
                        className="cursor-pointer transition-all"
                        onClick={() => handleToggleDefect(entry.reasonName)}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 6. OPERATÖR PERFORMANS TABLOSU */}
      <div className="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-black tracking-tight text-foreground uppercase flex items-center gap-2">
              <Award className="text-amber-500" size={20} />
              Kalite Operatörleri Performans Tablosu
            </h3>
            <p className="text-xs text-muted-foreground font-medium">
              Her personelin incelediği iş hacmi, yakaladığı kusur adedi ve tespit hassasiyeti
            </p>
          </div>
          <span className="text-xs font-bold text-muted-foreground">
            Toplam {summary?.operatorPerformance?.length || 0} operatör
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-[11px] font-black uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="py-3.5 px-4">Operatör Adı & Sicil</th>
                <th className="py-3.5 px-4 text-right">Kontrol Sayısı</th>
                <th className="py-3.5 px-4 text-right">Sağlam Ürün (kg)</th>
                <th className="py-3.5 px-4 text-right">Tamirli İş</th>
                <th className="py-3.5 px-4 text-right">Tamir Gr</th>
                <th className="py-3.5 px-4 text-right">Hata Tespit Oranı</th>
                <th className="py-3.5 px-4 text-center">Filtrele</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-medium">
              {isSummaryLoading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted-foreground">
                    <Loader2 className="animate-spin text-amber-500 mx-auto mb-2" size={24} />
                    Operatör performans verileri yükleniyor...
                  </td>
                </tr>
              ) : !summary?.operatorPerformance || summary.operatorPerformance.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground text-sm">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                summary.operatorPerformance.map((op) => (
                  <tr
                    key={op.operatorId}
                    className="hover:bg-muted/30 transition-colors group cursor-pointer"
                    onClick={() => {
                      setSelectedOperator(op.operatorId);
                      setPage(1);
                      toast.info(`${op.operatorName} filtrelendi.`);
                    }}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 font-black text-xs flex items-center justify-center">
                          {op.operatorName?.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-foreground">{op.operatorName}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            ID: {op.operatorId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-foreground">
                      {op.totalChecks.toLocaleString("tr-TR")}
                    </td>
                    <td className="py-3.5 px-4 text-right text-emerald-500 font-bold">
                      {(op.totalGoodGr / 1000).toLocaleString("tr-TR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      kg
                    </td>
                    <td className="py-3.5 px-4 text-right text-rose-500 font-black">
                      {op.jobsWithRepair.toLocaleString("tr-TR")}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-foreground">
                      {op.totalRepairGr.toLocaleString("tr-TR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      gr
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-black ${
                          op.detectionRate > 5
                            ? "bg-rose-500/10 text-rose-500"
                            : op.detectionRate > 0
                            ? "bg-amber-500/10 text-amber-500"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        %{op.detectionRate}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOperator(op.operatorId);
                          setPage(1);
                          toast.info(`${op.operatorName} seçildi.`);
                        }}
                        className="px-3 py-1 rounded-xl text-xs font-bold border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                      >
                        Seç
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. DETAYLI TAMİR VE KALİTE LOGLARI (REUSABLE DATATABLE BİLEŞENİ) */}
      <DataTable
        title="Detaylı Tamir & Kusur Kayıtları"
        subtitle="İş emri, parça, tespit edilen kusur ve sevk edilen birim detayları"
        icon={<AlertTriangle size={18} className="text-rose-500" />}
        iconClassName="bg-rose-500/10 border-rose-500/20"
        columns={detailColumns}
        data={details}
        keyExtractor={(item) => item.repair_id}
        page={page}
        totalPages={pagination?.totalPages || 1}
        totalCount={pagination?.totalCount || 0}
        limit={limit}
        onPageChange={(newPage) => setPage(newPage)}
        onLimitChange={(newLimit) => {
          setLimit(newLimit);
          setPage(1);
        }}
        limitOptions={[10, 25, 50, 100]}
        isLoading={isDetailsLoading}
        loadingMessage="Kusur ve tamir detay kayıtları yükleniyor..."
        emptyTitle="Kusur Kaydı Bulunamadı"
        emptyDescription="Seçili filtrelere uygun herhangi bir tamir veya kusur kaydı bulunamadı."
        heightClassName="h-auto min-h-[500px]"
        headerActions={
          <div className="relative w-64 sm:w-80">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              placeholder="Sipariş No, Malzeme veya Personel..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-border bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        }
      />
    </div>
  );
}
