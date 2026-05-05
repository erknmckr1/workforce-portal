import { useState, useMemo, useRef, useEffect } from "react";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  User,
  Search,
  Download,
  Filter,
  Loader2,
  Clock,
  LogIn,
  LogOut,
  CheckCircle2,
  X,
  TrendingUp,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { usePersonnel } from "@/hooks/usePersonnel";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

import type {
  Personnel,
  MovementReportItem,
  LateArrivalItem,
} from "@/types/mes";

// --- TYPES / INTERFACES ---
interface ChartDataItem {
  date: string;
  hours: number;
}

// --- CONFIGURATION / CONSTANTS ---
const SHIFT_START = "07:30:00";
const SHIFT_END = "17:00:00";
const LATE_THRESHOLD = "07:45";

// --- HELPERS ---
const formatTimeToUTC = (dateString: string | null) => {
  if (!dateString) return null;
  const d = new Date(dateString);
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  const seconds = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};

const timeToSeconds = (timeStr: string) => {
  const [h, m, s] = timeStr.split(":").map(Number);
  return h * 3600 + m * 60 + (s || 0);
};

const isLateEntry = (entryTime: string | null) => {
  if (!entryTime) return false;
  return timeToSeconds(entryTime) > timeToSeconds(SHIFT_START);
};

const isEarlyExit = (exitTime: string | null) => {
  if (!exitTime) return false;
  return timeToSeconds(exitTime) < timeToSeconds(SHIFT_END);
};

// --- CUSTOM COMPONENTS ---
interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/90 backdrop-blur-xl border border-border p-4 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
          {label}
        </p>
        <p className="text-xl font-black text-amber-500">
          {payload[0].value}{" "}
          <span className="text-xs text-foreground/50">Saat</span>
        </p>
      </div>
    );
  }
  return null;
};

const PersonnelMovementReport = () => {
  const navigate = useNavigate();

  // -- STATE --
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(
    null,
  );
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLateArrivalsModalOpen, setIsLateArrivalsModalOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchParams, setSearchParams] = useState<{
    operatorId: string;
    startDate: string;
    endDate: string;
  } | null>(null);

  // -- DATA FETCHING --
  const { data: personnelResponse, isLoading: isLoadingPersonnel } =
    usePersonnel(1, 15, debouncedSearch);

  const personnelList = useMemo(
    () => (personnelResponse?.data as Personnel[]) || [],
    [personnelResponse],
  );

  // Bireysel Rapor
  const { data, isLoading, isFetching } = useQuery<MovementReportItem[]>({
    queryKey: ["personnelMovement", searchParams],
    queryFn: async () => {
      if (!searchParams) return [];
      const response = await apiClient.get("/mes/reports/personnel-movement", {
        params: searchParams,
      });
      return response.data;
    },
    enabled: !!searchParams,
  });

  // Bugünün Geç Kalanları (Toplu)
  const { data: lateArrivals, isLoading: isLoadingLate } = useQuery<
    LateArrivalItem[]
  >({
    queryKey: ["lateArrivalsToday"],
    queryFn: async () => {
      const response = await apiClient.get("/mes/reports/late-arrivals", {
        params: { threshold: LATE_THRESHOLD },
      });
      return response.data;
    },
    enabled: isLateArrivalsModalOpen,
  });

  const chartData = useMemo<ChartDataItem[]>(() => {
    if (!data) return [];
    return data.map((row) => ({
      date: format(new Date(row.date), "dd MMM", { locale: tr }),
      hours: row.totalHours,
    }));
  }, [data]);

  // -- EVENTS --
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = () => {
    if (!selectedPersonnel || !startDate || !endDate) {
      toast.error("Lütfen personel ve tarih aralığını seçin.");
      return;
    }
    setSearchParams({
      operatorId: selectedPersonnel.id_dec,
      startDate,
      endDate,
    });
  };

  const selectPerson = (p: Personnel) => {
    setSelectedPersonnel(p);
    setSearchTerm(`${p.name} ${p.surname}`);
    setIsSearchOpen(false);
  };

  const handleExportExcel = () => {
    if (!data || data.length === 0) return;

    const exportData = data.map((row) => {
      const entry = formatTimeToUTC(row.firstEntry);
      const exit = formatTimeToUTC(row.lastExit);

      return {
        Tarih: format(new Date(row.date), "dd.MM.yyyy"),
        Gün: format(new Date(row.date), "eeee", { locale: tr }),
        "İlk Giriş": entry || "---",
        "Son Çıkış": exit || "---",
        Durum:
          (isLateEntry(entry) ? "Geç Giriş " : "") +
          (isEarlyExit(exit) ? "Erken Çıkış" : ""),
        "Toplam Süre (Saat)": row.totalHours,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Personel Hareket Raporu",
    );

    const fileName = `${selectedPersonnel?.name}_${selectedPersonnel?.surname}_Rapor_${startDate}_${endDate}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success("Excel dosyası oluşturuldu.");
  };

  const handleExportLateArrivals = () => {
    if (!lateArrivals || lateArrivals.length === 0) return;

    const exportData = lateArrivals.map((row) => ({
      "Sicil No": row.operatorId,
      "Ad Soyad": row.name,
      Departman: row.department,
      "Giriş Saati": formatTimeToUTC(row.firstEntry),
      Sınır: LATE_THRESHOLD,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Gec_Kalanlar");

    const fileName = `Gec_Kalanlar_${format(new Date(), "dd_MM_yyyy")}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success("Excel dosyası oluşturuldu.");
  };

  return (
    <div className="w-full mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/reports")}
            className="w-12 h-12 rounded-2xl bg-secondary hover:bg-accent border border-border flex items-center justify-center transition-all active:scale-90"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-foreground">
              Personel <span className="text-amber-500">Hareket Analizi</span>
            </h1>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
              Giriş-Çıkış ve Mesai Takibi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsLateArrivalsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl border border-emerald-500/20 transition-all font-bold text-xs uppercase tracking-widest text-emerald-500"
          >
            <Users size={16} />
            Kim Ne Zaman Geldi ?
          </button>
          <button
            onClick={handleExportExcel}
            disabled={!data || data.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-secondary hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed rounded-xl border border-border transition-all font-bold text-xs uppercase tracking-widest text-foreground"
          >
            <Download size={16} className="text-amber-500" />
            Excel Aktar
          </button>
        </div>
      </div>

      {/* Filters Area */}
      <div className="p-6 bg-card/50 backdrop-blur-xl border border-border rounded-[32px] shadow-xl flex flex-wrap items-end gap-6 relative z-10">
        <div
          className="flex-1 min-w-[300px] space-y-2 relative"
          ref={searchRef}
        >
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
            Personel Seçin
          </label>
          <div className="relative group">
            <div className="relative flex items-center bg-secondary/50 border border-border rounded-2xl px-4 py-3 focus-within:border-amber-500/50 transition-all">
              <User size={18} className="text-muted-foreground" />
              <input
                type="text"
                placeholder="İsim veya Sicil No..."
                className="bg-transparent border-none focus:ring-0 text-sm font-bold tracking-wide w-full ml-3 text-foreground"
                value={searchTerm}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setIsSearchOpen(true);
                  if (selectedPersonnel) setSelectedPersonnel(null);
                }}
              />
              {selectedPersonnel && (
                <button
                  onClick={() => {
                    setSelectedPersonnel(null);
                    setSearchTerm("");
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={16} />
                </button>
              )}
              {isLoadingPersonnel && (
                <Loader2
                  className="animate-spin text-amber-500 ml-2"
                  size={16}
                />
              )}
            </div>

            {isSearchOpen &&
              (searchTerm.length > 0 || personnelList.length > 0) && (
                <div className="absolute top-full left-0 w-full mt-2 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-100 max-h-[300px] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                  {personnelList.length > 0 ? (
                    personnelList.map((p) => (
                      <button
                        key={p.id_dec}
                        onClick={() => selectPerson(p)}
                        className={cn(
                          "w-full flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors text-left border-b border-border/50 last:border-0",
                          selectedPersonnel?.id_dec === p.id_dec &&
                            "bg-amber-500/10",
                        )}
                      >
                        <div className="flex flex-col">
                          <span className="font-black text-sm text-foreground uppercase tracking-tight">
                            {p.name} {p.surname}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-bold">
                            {p.id_dec} • {p.Department?.name}
                          </span>
                        </div>
                        {selectedPersonnel?.id_dec === p.id_dec && (
                          <CheckCircle2 size={18} className="text-amber-500" />
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="p-8 text-center text-muted-foreground text-sm italic">
                      Personel bulunamadı...
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>

        <div className="flex-1 min-w-[200px] space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
            Başlangıç
          </label>
          <div className="relative flex items-center bg-secondary/50 border border-border rounded-2xl px-4 py-3 text-foreground">
            <CalendarIcon size={18} className="text-muted-foreground" />
            <input
              type="date"
              className="bg-transparent border-none focus:ring-0 text-sm w-full ml-3 font-bold"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 min-w-[200px] space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
            Bitiş
          </label>
          <div className="relative flex items-center bg-secondary/50 border border-border rounded-2xl px-4 py-3 text-foreground">
            <CalendarIcon size={18} className="text-muted-foreground" />
            <input
              type="date"
              className="bg-transparent border-none focus:ring-0 text-sm w-full ml-3 font-bold"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={isLoading || isFetching || !selectedPersonnel}
          className="h-[50px] px-8 bg-amber-500 text-black font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
        >
          {isLoading || isFetching ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <Search size={20} />
          )}
          Sorgula
        </button>
      </div>

      {/* Content Area */}
      {data && data.length > 0 ? (
        <div className="space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 bg-secondary/20 border border-border rounded-[32px] relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-foreground/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Toplam Gün
              </span>
              <div className="text-4xl font-black mt-1 text-foreground">
                {data.length}
              </div>
            </div>
            <div className="p-8 bg-secondary/20 border border-border rounded-[32px] relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Ortalama Çalışma
              </span>
              <div className="text-4xl font-black mt-1 text-amber-500">
                {(
                  data.reduce((acc, curr) => acc + curr.totalHours, 0) /
                    data.length || 0
                ).toFixed(2)}
                s
              </div>
            </div>
            <div className="p-8 bg-secondary/20 border border-border rounded-[32px] relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-foreground/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Toplam Mesai
              </span>
              <div className="text-4xl font-black mt-1 text-foreground">
                {data
                  .reduce((acc, curr) => acc + curr.totalHours, 0)
                  .toFixed(1)}
                s
              </div>
            </div>
          </div>

          {/* Chart Section */}
          <div className="bg-card/30 backdrop-blur-md border border-border rounded-[40px] p-8 shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-foreground">
                    Çalışma Trendi
                  </h3>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                    Günlük Toplam Saat Analizi
                  </p>
                </div>
              </div>
            </div>

            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(255,255,255,0.05)"
                  />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6b7280", fontSize: 10, fontWeight: "bold" }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6b7280", fontSize: 10, fontWeight: "bold" }}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{
                      stroke: "#f59e0b",
                      strokeWidth: 2,
                      strokeDasharray: "5 5",
                    }}
                  />
                  <ReferenceLine
                    y={8}
                    stroke="#10b981"
                    strokeDasharray="3 3"
                    label={{
                      position: "right",
                      value: "8s Hedef",
                      fill: "#10b981",
                      fontSize: 10,
                      fontWeight: "bold",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="hours"
                    stroke="#f59e0b"
                    strokeWidth={4}
                    fillOpacity={1}
                    fill="url(#colorHours)"
                    animationDuration={2000}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-card/30 backdrop-blur-md border border-border rounded-[32px] overflow-hidden shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-secondary/50 border-b border-border">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Tarih
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    İlk Giriş (07:30)
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Son Çıkış (17:00)
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">
                    Toplam Süre
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-foreground font-bold">
                {data.map((row) => {
                  const entry = formatTimeToUTC(row.firstEntry);
                  const exit = formatTimeToUTC(row.lastExit);
                  const isLate = isLateEntry(entry);
                  const isEarly = isEarlyExit(exit);

                  return (
                    <tr
                      key={row.date}
                      className="hover:bg-secondary/20 transition-colors group"
                    >
                      <td className="px-8 py-5">
                        <div className="font-black text-sm uppercase">
                          {format(new Date(row.date), "dd MMMM yyyy", {
                            locale: tr,
                          })}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                          {format(new Date(row.date), "eeee", { locale: tr })}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col gap-1">
                          <div
                            className={cn(
                              "flex items-center gap-2 font-mono font-bold",
                              isLate ? "text-amber-500" : "text-emerald-500",
                            )}
                          >
                            <LogIn size={16} />
                            {entry || "---"}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col gap-1">
                          <div
                            className={cn(
                              "flex items-center gap-2 font-mono font-bold",
                              isEarly ? "text-red-400" : "text-blue-400",
                            )}
                          >
                            <LogOut size={16} />
                            {exit || "---"}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-500 rounded-xl font-black font-mono text-sm border border-amber-500/20 shadow-sm">
                          <Clock size={16} />
                          {row.totalHours}s
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="min-h-[400px] border-2 border-dashed border-border rounded-[40px] flex flex-col items-center justify-center text-center p-20 bg-secondary/5">
          <Filter size={40} className="text-muted-foreground/30 mb-6" />
          <h3 className="text-xl font-black uppercase tracking-tight text-foreground/40">
            Analiz Hazır
          </h3>
          <p className="text-sm text-muted-foreground/40 mt-2">
            Lütfen kriterleri seçerek sorgulama yapın.
          </p>
        </div>
      )}

      {/* --- LATE ARRIVALS MODAL --- */}
      {isLateArrivalsModalOpen && (
        <div className="fixed inset-0 z-999 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
            onClick={() => setIsLateArrivalsModalOpen(false)}
          />

          <div className="relative w-full max-w-4xl bg-card border border-border rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="p-8 border-b border-border flex items-center justify-between bg-secondary/10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                  <Users size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter text-foreground">
                    Kim{" "}
                    <span className="text-emerald-500">Ne Zaman Geldi ? </span>
                  </h2>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                    {format(new Date(), "dd MMMM yyyy", { locale: tr })} •
                    Sınır: {LATE_THRESHOLD}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportLateArrivals}
                  disabled={!lateArrivals || lateArrivals.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-accent rounded-xl border border-border transition-all font-bold text-[10px] uppercase tracking-widest"
                >
                  <Download size={14} className="text-emerald-500" />
                  Excel
                </button>
                <button
                  onClick={() => setIsLateArrivalsModalOpen(false)}
                  className="w-10 h-10 rounded-full bg-secondary hover:bg-accent flex items-center justify-center transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-8">
              {isLoadingLate ? (
                <div className="h-64 flex flex-col items-center justify-center gap-4">
                  <Loader2
                    className="animate-spin text-emerald-500"
                    size={40}
                  />
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Veriler taranıyor...
                  </p>
                </div>
              ) : lateArrivals && lateArrivals.length > 0 ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            Personel
                          </th>
                          <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            Departman
                          </th>
                          <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">
                            Giriş
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50 text-foreground">
                        {lateArrivals.map((row) => (
                          <tr key={row.operatorId} className="group">
                            <td className="py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                                  <User size={16} />
                                </div>
                                <div>
                                  <div className="font-black text-sm uppercase">
                                    {row.name}
                                  </div>
                                  <div className="text-[9px] text-muted-foreground font-bold">
                                    {row.operatorId}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 text-xs font-bold uppercase text-muted-foreground">
                              {row.department}
                            </td>
                            <td className="py-4 text-right">
                              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg font-black font-mono text-xs border border-emerald-500/20">
                                <LogIn size={14} />
                                {(() => {
                                  const d = new Date(row.firstEntry);
                                  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
                                })()}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center opacity-40">
                  <CheckCircle2 size={48} className="text-emerald-500 mb-4" />
                  <p className="font-black uppercase tracking-tight">
                    Harika! Herkes Vaktinde Gelmiş.
                  </p>
                  <p className="text-xs font-medium mt-1">
                    Bugün 07:45'ten sonra giriş yapan kimse bulunamadı.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonnelMovementReport;
