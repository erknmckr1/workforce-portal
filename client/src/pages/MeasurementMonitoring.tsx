import React, { useState, useMemo } from "react";
import { 
  Scale, 
  History, 
  User, 
  Hash, 
  Calendar, 
  Info, 
  AlertTriangle, 
  Search, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Filter
} from "lucide-react";
import apiClient from "../lib/api";
import type { MeasurementRecord } from "../types/mes";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MeasureLimits {
  lowerLimit: number;
  upperLimit: number;
  weight_50cm: number;
}

export default function MeasurementMonitoring() {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const formatWeight = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "-";
    const num = Number(val);
    if (isNaN(num)) return "-";
    return num % 1 === 0 ? `${num}g` : `${num.toFixed(3)}g`;
  };
  const [loading, setLoading] = useState(false);
  const [materialNo, setMaterialNo] = useState("");
  const [history, setHistory] = useState<MeasurementRecord[]>([]);
  const [limits, setLimits] = useState<MeasureLimits | null>(null);
  const [searchedMaterial, setSearchedMaterial] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
    }
  }, [history]);

  const [dateFilter, setDateFilter] = useState<string>("Tümü");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [selectedRowIds, setSelectedRowIds] = useState<number[]>([]);

  // Column Filters State
  const [columnFilters, setColumnFilters] = useState<{
    area_name: string;
    material_no: string;
    order_no: string;
    operator: string;
    entry_measurement: string;
    exit_measurement: string;
    entry_weight_50cm: string;
    exit_weight_50cm: string;
    gold_setting: string;
    weighed_quantity: string;
    weighed_weight: string;
    result_weight: string;
    gold_pure_scrap: string;
  }>({
    area_name: "",
    material_no: "",
    order_no: "",
    operator: "",
    entry_measurement: "",
    exit_measurement: "",
    entry_weight_50cm: "",
    exit_weight_50cm: "",
    gold_setting: "",
    weighed_quantity: "",
    weighed_weight: "",
    result_weight: "",
    gold_pure_scrap: "",
  });

  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const [globalFilter, setGlobalFilter] = useState("");

  const hasActiveColumnFilter = useMemo(() => {
    return globalFilter.trim() !== "" || Object.values(columnFilters).some((val) => val.trim() !== "");
  }, [columnFilters, globalFilter]);

  const clearAllColumnFilters = () => {
    setColumnFilters({
      area_name: "",
      material_no: "",
      order_no: "",
      operator: "",
      entry_measurement: "",
      exit_measurement: "",
      entry_weight_50cm: "",
      exit_weight_50cm: "",
      gold_setting: "",
      weighed_quantity: "",
      weighed_weight: "",
      result_weight: "",
      gold_pure_scrap: "",
    });
    setGlobalFilter("");
    setActiveFilterColumn(null);
  };

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 50; // Sayfa başına kayıt sınırı

  const fetchData = async (targetMatNo: string, pageNumber: number = 1) => {
    if (!targetMatNo.trim()) return;
    const formattedMatNo = targetMatNo.trim().toUpperCase();

    setLoading(true);
    setSearchedMaterial(formattedMatNo);
    setSelectedRowIds([]);
    try {
      // 1. Ölçüm geçmişini sayfalayarak çek
      const historyRes = await apiClient.get(
        `/mes/measurements/by-material?material_no=${formattedMatNo}&page=${pageNumber}&limit=${limit}`
      );
      
      const { items, totalPages: fetchedTotalPages, totalItems: fetchedTotalItems, currentPage: fetchedCurrentPage } = historyRes.data;
      
      setHistory(items || []);
      setTotalPages(fetchedTotalPages || 1);
      setTotalItems(fetchedTotalItems || 0);
      setCurrentPage(fetchedCurrentPage || 1);

      // 2. Tolerans limitlerini çek
      try {
        const limitsRes = await apiClient.get(`/mes/measure-limits/${formattedMatNo}`);
        setLimits(limitsRes.data);
      } catch (err) {
        console.warn("Tolerans limitleri alınamadı:", err);
        setLimits(null);
      }
    } catch (error) {
      console.error("Ölçüm verileri alınırken hata oluştu:", error);
      setHistory([]);
      setLimits(null);
      setTotalPages(1);
      setTotalItems(0);
      setCurrentPage(1);
      toast.error("Ölçüm kayıtları sorgulanırken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(materialNo, 1);
  };

  const handleReset = () => {
    setMaterialNo("");
    setHistory([]);
    setLimits(null);
    setSearchedMaterial("");
    setCurrentPage(1);
    setTotalPages(1);
    setTotalItems(0);
    setDateFilter("Tümü");
    setStartDate("");
    setEndDate("");
    setSelectedRowIds([]);
    clearAllColumnFilters();
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    fetchData(searchedMaterial, newPage);
  };

  const filteredHistory = useMemo(() => {
    return history.filter((row) => {
      // 1. Tarih Filtresi
      if (dateFilter !== "Tümü") {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;
        const rowTime = new Date(row.data_entry_date || row.createdAt).getTime();

        if (dateFilter === "Bugün" && (rowTime < todayStart || rowTime > todayEnd)) {
          return false;
        }
        if (dateFilter === "Dün") {
          const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
          const yesterdayEnd = todayStart - 1;
          if (rowTime < yesterdayStart || rowTime > yesterdayEnd) return false;
        }
        if (dateFilter === "Bu Hafta") {
          const day = now.getDay();
          const diff = now.getDate() - day + (day === 0 ? -6 : 1);
          const weekStart = new Date(now.setDate(diff));
          weekStart.setHours(0, 0, 0, 0);
          if (rowTime < weekStart.getTime()) return false;
        }
        if (dateFilter === "Bu Ay") {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
          if (rowTime < monthStart) return false;
        }
        if (dateFilter === "Özel") {
          const start = startDate ? new Date(startDate).getTime() : 0;
          const end = endDate ? new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1 : Infinity;
          if (rowTime < start || rowTime > end) return false;
        }
      }

      // 2. Sütun Bazlı Filtreler
      if (columnFilters.area_name && !row.area_name?.toLowerCase().includes(columnFilters.area_name.toLowerCase())) return false;
      if (columnFilters.material_no && !row.material_no?.toLowerCase().includes(columnFilters.material_no.toLowerCase())) return false;
      if (columnFilters.order_no && !row.order_no?.toLowerCase().includes(columnFilters.order_no.toLowerCase())) return false;
      if (columnFilters.operator) {
        const opText = row.OperatorDetail ? `${row.OperatorDetail.name} ${row.OperatorDetail.surname}` : row.operator;
        if (!opText.toLowerCase().includes(columnFilters.operator.toLowerCase())) return false;
      }
      if (columnFilters.entry_measurement && !row.entry_measurement?.toLowerCase().includes(columnFilters.entry_measurement.toLowerCase())) return false;
      if (columnFilters.exit_measurement && !row.exit_measurement?.toLowerCase().includes(columnFilters.exit_measurement.toLowerCase())) return false;
      if (columnFilters.entry_weight_50cm && String(row.entry_weight_50cm ?? "").indexOf(columnFilters.entry_weight_50cm) === -1) return false;
      if (columnFilters.exit_weight_50cm && String(row.exit_weight_50cm ?? "").indexOf(columnFilters.exit_weight_50cm) === -1) return false;
      if (columnFilters.gold_setting && String(row.gold_setting ?? "").indexOf(columnFilters.gold_setting) === -1) return false;
      if (columnFilters.weighed_quantity && String(row.weighed_quantity ?? "").indexOf(columnFilters.weighed_quantity) === -1) return false;
      if (columnFilters.weighed_weight && String(row.weighed_weight ?? "").indexOf(columnFilters.weighed_weight) === -1) return false;
      if (columnFilters.result_weight && String(row.result_weight ?? "").indexOf(columnFilters.result_weight) === -1) return false;
      if (columnFilters.gold_pure_scrap && String(row.gold_pure_scrap ?? "").indexOf(columnFilters.gold_pure_scrap) === -1) return false;

      // 3. Genel Tablo İçi Arama (Global Search)
      if (globalFilter.trim()) {
        const term = globalFilter.trim().toLowerCase();
        const opName = row.OperatorDetail ? `${row.OperatorDetail.name} ${row.OperatorDetail.surname}` : (row.operator || "");
        const match =
          (row.area_name && row.area_name.toLowerCase().includes(term)) ||
          (row.material_no && row.material_no.toLowerCase().includes(term)) ||
          (row.order_no && row.order_no.toLowerCase().includes(term)) ||
          opName.toLowerCase().includes(term) ||
          (row.entry_measurement && row.entry_measurement.toLowerCase().includes(term)) ||
          (row.exit_measurement && row.exit_measurement.toLowerCase().includes(term)) ||
          (row.description && row.description.toLowerCase().includes(term)) ||
          (row.entry_weight_50cm !== null && String(row.entry_weight_50cm).includes(term)) ||
          (row.exit_weight_50cm !== null && String(row.exit_weight_50cm).includes(term)) ||
          (row.gold_setting !== null && String(row.gold_setting).includes(term)) ||
          (row.weighed_quantity !== null && String(row.weighed_quantity).includes(term)) ||
          (row.weighed_weight !== null && String(row.weighed_weight).includes(term)) ||
          (row.result_weight !== null && String(row.result_weight).includes(term)) ||
          (row.gold_pure_scrap !== null && String(row.gold_pure_scrap).includes(term));

        if (!match) return false;
      }

      return true;
    });
  }, [history, dateFilter, startDate, endDate, columnFilters, globalFilter]);

  // İstatistik hesaplamaları
  const stats = useMemo(() => {
    if (filteredHistory.length === 0) return null;

    const totalWeight = filteredHistory.reduce((acc, row) => acc + (row.exit_weight_50cm || 0), 0);
    const avgWeight = totalWeight / filteredHistory.length;

    let outOfLimitsCount = 0;
    if (limits) {
      outOfLimitsCount = filteredHistory.filter(
        (row) =>
          row.exit_weight_50cm < limits.lowerLimit ||
          row.exit_weight_50cm > limits.upperLimit
      ).length;
    }

    return {
      count: filteredHistory.length,
      averageWeight: avgWeight.toFixed(2),
      outOfLimitsCount,
    };
  }, [filteredHistory, limits]);

  const selectedAvgWeight = useMemo(() => {
    const selectedRows = filteredHistory.filter(row => selectedRowIds.includes(row.id));
    if (selectedRows.length === 0) return null;
    const totalWeight = selectedRows.reduce((acc, row) => acc + (row.exit_weight_50cm || 0), 0);
    return (totalWeight / selectedRows.length).toFixed(2);
  }, [filteredHistory, selectedRowIds]);

  const renderHeaderCell = (label: string, field: keyof typeof columnFilters, align: "left" | "center" = "left") => {
    const filterVal = columnFilters[field];
    const isActive = filterVal.trim() !== "";
    const isOpen = activeFilterColumn === field;

    return (
      <div className={cn("relative flex items-center gap-1 group select-none", align === "center" && "justify-center")}>
        <span className="truncate">{label}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActiveFilterColumn(isOpen ? null : field);
          }}
          className={cn(
            "p-1 rounded-md transition-all cursor-pointer relative shrink-0",
            isActive
              ? "bg-primary text-primary-foreground font-bold shadow-xs"
              : "hover:bg-card text-muted-foreground/60 hover:text-foreground"
          )}
          title={`${label} filtrele`}
        >
          <Filter size={10} />
          {isActive && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full animate-ping" />
          )}
        </button>

        {/* POPOVER DROPDOWN */}
        {isOpen && (
          <div 
            className="absolute top-full mt-1.5 z-50 w-48 p-2.5 bg-card border border-border rounded-xl shadow-xl text-foreground font-normal normal-case animate-in fade-in zoom-in-95 duration-150"
            style={{ left: align === "center" ? "50%" : "0", transform: align === "center" ? "translateX(-50%)" : "none" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label} Filtrele</span>
              <button
                type="button"
                onClick={() => setActiveFilterColumn(null)}
                className="text-muted-foreground hover:text-foreground text-xs p-0.5 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>
            <input
              type="text"
              autoFocus
              placeholder={`${label}...`}
              value={filterVal}
              onChange={(e) => setColumnFilters((prev) => ({ ...prev, [field]: e.target.value }))}
              className="w-full h-8 px-2 bg-background border border-border rounded-md text-xs font-semibold outline-none focus:ring-1 focus:ring-primary shadow-inner mb-2"
            />
            <div className="flex justify-between items-center gap-1">
              {isActive ? (
                <button
                  type="button"
                  onClick={() => {
                    setColumnFilters((prev) => ({ ...prev, [field]: "" }));
                    setActiveFilterColumn(null);
                  }}
                  className="px-2 py-1 bg-destructive/10 hover:bg-destructive hover:text-destructive-foreground text-destructive text-[10px] font-bold rounded transition-colors cursor-pointer"
                >
                  Temizle
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => setActiveFilterColumn(null)}
                className="px-3 py-1 bg-primary text-primary-foreground text-[10px] font-bold rounded hover:bg-primary/90 transition-colors ml-auto cursor-pointer"
              >
                Tamam
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className="flex flex-col space-y-4 h-[calc(100vh-90px)] overflow-hidden p-1"
      onClick={() => activeFilterColumn && setActiveFilterColumn(null)}
    >
      
      {/* METRICS & LIMITS BAR */}
      {limits && searchedMaterial && (
        <div className="flex-none p-3 bg-secondary/15 border border-border rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 animate-in fade-in duration-300">
          <div className="p-2 bg-background border border-border/60 rounded-lg flex items-center gap-2 shadow-xs">
            <div className="p-1.5 rounded-lg bg-info/10 text-info">
              <Scale size={16} />
            </div>
            <div>
              <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">STANDART</div>
              <div className="text-xs font-bold text-foreground">{limits.weight_50cm} g</div>
            </div>
          </div>
          <div className="p-2 bg-background border border-border/60 rounded-lg flex items-center gap-2 shadow-xs">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
              <Scale size={16} />
            </div>
            <div>
              <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">ALT LİMİT</div>
              <div className="text-xs font-bold text-amber-500">{limits.lowerLimit} g</div>
            </div>
          </div>
          <div className="p-2 bg-background border border-border/60 rounded-lg flex items-center gap-2 shadow-xs">
            <div className="p-1.5 rounded-lg bg-destructive/10 text-destructive">
              <Scale size={16} />
            </div>
            <div>
              <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">ÜST LİMİT</div>
              <div className="text-xs font-bold text-destructive">{limits.upperLimit} g</div>
            </div>
          </div>
          
          {stats && (
            <div className="p-2 bg-background border border-border/60 rounded-lg flex items-center gap-2 shadow-xs">
              <div className={`p-1.5 rounded-lg ${stats.outOfLimitsCount > 0 ? "bg-destructive/10 text-destructive animate-pulse" : "bg-success/10 text-success"}`}>
                <AlertTriangle size={16} />
              </div>
              <div>
                <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">TOLERANS DIŞI (SAYFA)</div>
                <div className="text-xs font-bold text-foreground">
                  {stats.outOfLimitsCount} / {stats.count}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MAIN LAYOUT SPLIT */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
        
        {/* LEFT COLUMN: FILTERS (Collapsible) */}
        <div 
          className={cn(
            "bg-card border border-border rounded-3xl flex flex-col shadow-sm transition-all duration-300 h-full overflow-y-auto custom-scrollbar shrink-0",
            isSidebarCollapsed ? "lg:w-16 p-3 items-center gap-4" : "w-full lg:w-80 p-5 gap-4"
          )}
        >
          {isSidebarCollapsed ? (
            /* COLLAPSED SIDEBAR VIEW */
            <div className="flex flex-col items-center gap-4 w-full animate-in fade-in duration-200">
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(false)}
                title="Sorgu & Filtre Panelini Genişlet"
                className="w-10 h-10 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground rounded-xl transition-all shadow-xs flex items-center justify-center active:scale-95 border border-primary/20 cursor-pointer"
              >
                <PanelLeftOpen size={18} />
              </button>

              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(false)}
                title="Arama Yap"
                className="w-10 h-10 bg-secondary hover:bg-secondary/80 text-foreground rounded-xl transition-all flex items-center justify-center active:scale-95 border border-border cursor-pointer relative"
              >
                <Search size={16} />
                {searchedMaterial && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-card" />
                )}
              </button>

              {dateFilter !== "Tümü" && (
                <div 
                  className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center border border-amber-500/20"
                  title={`Filtre: ${dateFilter}`}
                >
                  <Filter size={16} />
                </div>
              )}

              {stats && (
                <div 
                  className="p-2 bg-secondary/30 rounded-xl text-center border border-border/50 text-[10px] font-black text-muted-foreground"
                  title={`Toplam Kayıt: ${stats.count}`}
                >
                  {stats.count}
                </div>
              )}
            </div>
          ) : (
            /* EXPANDED SIDEBAR VIEW */
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-foreground flex items-center gap-2 mb-0.5">
                    <Search size={14} className="text-primary" />
                    Sorgu & Filtreler
                  </h3>
                  <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Malzeme Arama Paneli</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed(true)}
                  title="Paneli Daralt (Tabloyu Genişlet)"
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all cursor-pointer border border-transparent hover:border-border"
                >
                  <PanelLeftClose size={18} />
                </button>
              </div>

              <form onSubmit={handleSearchSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">MALZEME KODU</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Örn: YZ003821-14"
                      value={materialNo}
                      onChange={(e) => setMaterialNo(e.target.value)}
                      className="w-full h-10 pl-8 pr-4 bg-background border border-border rounded-lg font-mono text-xs uppercase focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-inner"
                      required
                    />
                    <Hash
                      size={12}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleReset}
                    title="Aramayı Sıfırla"
                    className="h-10 px-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg transition-all shadow-sm flex items-center justify-center active:scale-95 border border-border cursor-pointer"
                  >
                    <RotateCcw size={14} />
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs uppercase tracking-widest rounded-lg transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <Search size={12} />
                    Sorgula
                  </button>
                </div>
              </form>

              {/* Tarih Filtreleme Seçenekleri */}
              {searchedMaterial && (
                <div className="space-y-3 pt-3 border-t border-border/50 animate-in fade-in duration-300">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Tarih Filtresi</label>
                    <select
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="w-full h-10 px-2 bg-background border border-border rounded-lg text-xs font-semibold focus:ring-2 focus:ring-primary focus:outline-none transition-all cursor-pointer shadow-xs"
                    >
                      <option value="Tümü">Tümü</option>
                      <option value="Bugün">Bugün</option>
                      <option value="Dün">Dün</option>
                      <option value="Bu Hafta">Bu Hafta</option>
                      <option value="Bu Ay">Bu Ay</option>
                      <option value="Özel">Özel Tarih Aralığı</option>
                    </select>
                  </div>

                  {dateFilter === "Özel" && (
                    <div className="space-y-2.5 animate-in slide-in-from-top duration-200">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Başlangıç Tarihi</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full h-10 px-2.5 bg-background border border-border rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-primary focus:outline-none transition-all shadow-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Bitiş Tarihi</label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full h-10 px-2.5 bg-background border border-border rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-primary focus:outline-none transition-all shadow-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Seçimi Temizle Butonu */}
              {selectedRowIds.length > 0 && (
                <button
                  onClick={() => setSelectedRowIds([])}
                  className="mt-2 w-full h-10 bg-primary/10 hover:bg-primary hover:text-primary-foreground text-primary font-black text-xs uppercase tracking-widest rounded-lg transition-all shadow-xs flex items-center justify-center gap-2 active:scale-95 border border-primary/20 cursor-pointer fade-in duration-200 animate-out fade-out"
                >
                  Seçimi Temizle ({selectedRowIds.length})
                </button>
              )}

              {/* Özet & İstatistikler Kartı */}
              {stats && searchedMaterial && (
                <div className="mt-2 p-3.5 bg-secondary/15 border border-border/60 rounded-2xl space-y-2.5 animate-in fade-in duration-300">
                  <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-1.5 mb-1.5 flex items-center gap-1.5">
                    <Scale size={12} className="text-primary" />
                    Ölçüm Özet Bilgileri
                  </div>
                  
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-semibold">Sayfadaki Toplam Kayıt:</span>
                    <span className="text-foreground font-black">{stats.count}</span>
                  </div>

                  <div className="flex justify-between items-start text-xs gap-4">
                    <span className="text-muted-foreground font-semibold">
                      {selectedRowIds.length > 0 ? "Seçilen Ortalama Gramaj:" : "Sayfa Ortalama Gramajı:"}
                    </span>
                    <span className={cn("text-right font-black", selectedRowIds.length > 0 ? "text-primary animate-pulse" : "text-foreground")}>
                      {selectedRowIds.length > 0 ? `${selectedAvgWeight} g` : `${stats.averageWeight} g`}
                      {selectedRowIds.length > 0 && (
                        <span className="block text-[9px] font-black text-primary leading-none mt-0.5">
                          ({selectedRowIds.length} satır)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT COLUMN: TABLE */}
        <div className="flex-1 min-w-0 bg-card border border-border rounded-3xl p-5 shadow-sm flex flex-col overflow-hidden h-full">
          
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                <History size={16} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight text-foreground leading-none">
                  Ölçüm Kayıtları Tablosu
                </h3>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mt-0.5">
                  {searchedMaterial ? `${searchedMaterial} Sorgu Sonuçları` : "Malzeme sorgusu bekleniyor"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {searchedMaterial && (
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Tabloda Hızlı Ara..."
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    className="w-44 h-8 pl-8 pr-7 bg-background border border-border rounded-lg text-xs font-semibold focus:w-56 focus:ring-1 focus:ring-primary outline-none transition-all shadow-inner"
                  />
                  {globalFilter && (
                    <button
                      type="button"
                      onClick={() => setGlobalFilter("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-0.5 rounded cursor-pointer"
                      title="Aramayı Temizle"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}

              {hasActiveColumnFilter && (
                <button
                  onClick={clearAllColumnFilters}
                  className="text-xs text-muted-foreground hover:text-foreground font-semibold flex items-center gap-1.5 transition-colors cursor-pointer animate-in fade-in"
                  title="Tüm sütun ve tablo filtrelerini temizle"
                >
                  <RotateCcw size={13} className="text-amber-500" />
                  <span className="text-[11px] underline underline-offset-4 decoration-amber-500/40 hover:decoration-amber-500">
                    Filtreleri Temizle
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="grow border border-border rounded-xl overflow-hidden flex flex-col bg-secondary/5 min-h-0">
            {/* Scrollable Table Area (Both vertical and horizontal scroll handled here) */}
            <div className="flex-1 overflow-auto custom-scrollbar relative min-h-0">
              <div className="min-w-365kucul flex flex-col">
                {/* TABLE HEADER (Sticky at the top of scroll container) */}
                <div className="grid gap-2 p-3 border-b border-border bg-secondary text-[10px] font-black uppercase tracking-wider text-muted-foreground shrink-0 select-none sticky top-0 z-10 shadow-xs" style={{ gridTemplateColumns: "100px 140px 110px 160px 100px 100px 100px 100px 80px 110px 120px 120px 120px" }}>
                  {renderHeaderCell("Bölüm", "area_name")}
                  {renderHeaderCell("Malzeme", "material_no")}
                  {renderHeaderCell("Sipariş", "order_no")}
                  {renderHeaderCell("Operatör", "operator")}
                  {renderHeaderCell("Giriş Ö.", "entry_measurement")}
                  {renderHeaderCell("Çıkış Ö.", "exit_measurement")}
                  {renderHeaderCell("Giriş (50)", "entry_weight_50cm", "center")}
                  {renderHeaderCell("Çıkış (50)", "exit_weight_50cm", "center")}
                  {renderHeaderCell("Ayar", "gold_setting", "center")}
                  {renderHeaderCell("Tartılan Ad.", "weighed_quantity", "center")}
                  {renderHeaderCell("Tartılan Gr.", "weighed_weight", "center")}
                  {renderHeaderCell("Sonuç Gr.", "result_weight", "center")}
                  {renderHeaderCell("Has Fire", "gold_pure_scrap", "center")}
                </div>

                {/* TABLE BODY (Grows inside the scrollable container) */}
                <div className="p-2 space-y-1.5">
                  {loading ? (
                    <div className="py-20 flex items-center justify-center text-muted-foreground/50 font-bold uppercase tracking-widest text-xs animate-pulse">
                      Ölçümler Yükleniyor...
                    </div>
                  ) : !searchedMaterial ? (
                    <div className="py-20 flex items-center justify-center text-muted-foreground/30 font-black uppercase tracking-widest text-xs flex-col gap-3">
                      <Search size={36} className="opacity-20" />
                      Sorgulamak istediğiniz malzeme kodunu sol tarafa girip "Sorgula" butonuna basın.
                    </div>
                  ) : filteredHistory.length > 0 ? (
                    filteredHistory.map((row) => {
                      const isSelected = selectedRowIds.includes(row.id);
                      const isOutOfRange = limits
                        ? row.exit_weight_50cm < limits.lowerLimit || row.exit_weight_50cm > limits.upperLimit
                        : false;

                      return (
                        <div
                          key={row.id}
                          onClick={() => {
                            setSelectedRowIds(prev => 
                              prev.includes(row.id) 
                                ? prev.filter(id => id !== row.id) 
                                : [...prev, row.id]
                            );
                          }}
                          className={cn(
                            "grid gap-2 p-3 rounded-lg text-[12px] font-mono font-bold border transition-all shadow-xs cursor-pointer select-none",
                            isSelected
                              ? "bg-primary/10 border-primary text-primary"
                              : isOutOfRange
                                ? "bg-destructive/5 border-destructive/30 hover:border-destructive/60 text-destructive"
                                : "bg-background border-border hover:border-primary/50 text-foreground"
                          )}
                          style={{ gridTemplateColumns: "100px 140px 110px 160px 100px 100px 100px 100px 80px 110px 120px 120px 120px" }}
                        >
                          {/* İstasyon Adı */}
                          <div className="flex items-center uppercase tracking-wider text-muted-foreground text-[10px] min-w-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/70 mr-1.5 shrink-0" />
                            <span className="truncate">{row.area_name}</span>
                          </div>
                          
                          {/* Malzeme Kodu */}
                          <div className="flex items-center text-primary min-w-0">
                            <span className="truncate">{row.material_no}</span>
                          </div>
                          
                          <div className="flex items-center gap-0.5 min-w-0">
                            <Hash size={9} className="opacity-40 animate-pulse shrink-0" />
                            <span className="truncate">{row.order_no}</span>
                          </div>
                          
                          <div className="flex items-center gap-0.5 min-w-0 opacity-80">
                            <User size={9} className="opacity-40 shrink-0" />
                            <span className="truncate">
                              {row.OperatorDetail 
                                ? `${row.OperatorDetail.name} ${row.OperatorDetail.surname}`
                                : row.operator}
                            </span>
                          </div>
                          
                          <div className="flex items-center truncate">
                            {row.entry_measurement || "-"}
                          </div>
                          
                          <div className="flex items-center truncate">
                            {row.exit_measurement || "-"}
                          </div>
                          
                          <div className="flex items-center justify-center text-amber-500">
                            {formatWeight(row.entry_weight_50cm)}
                          </div>
                          
                          <div className={cn("flex items-center justify-center", isOutOfRange ? "text-destructive font-black" : "text-amber-500")}>
                            {row.exit_weight_50cm ? formatWeight(row.exit_weight_50cm) : "-"}
                            {isOutOfRange && " ⚠️"}
                          </div>

                          {/* Fire Sütunları */}
                          <div className="flex items-center justify-center text-foreground/80">
                            {row.gold_setting ? `${row.gold_setting}K` : "-"}
                          </div>

                          <div className="flex items-center justify-center text-foreground/80">
                            {row.weighed_quantity || "-"}
                          </div>

                          <div className="flex items-center justify-center text-primary">
                            {formatWeight(row.weighed_weight)}
                          </div>

                          <div className="flex items-center justify-center text-primary">
                            {formatWeight(row.result_weight)}
                          </div>

                          <div className="flex items-center justify-center text-amber-500">
                            {formatWeight(row.gold_pure_scrap)}
                          </div>
                          
                          {/* Açıklama ve Tarih Alt Bilgisi */}
                          <div className="mt-1 pt-1.5 border-t border-border/30 text-[10px] text-muted-foreground flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1" style={{ gridColumn: "span 13 / span 13" }}>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Info size={10} className="mt-0.5 shrink-0" />
                              <span>{row.description || "Açıklama bulunmuyor."}</span>
                            </div>
                            <div className="flex items-center gap-1 opacity-70">
                              <Calendar size={10} />
                              <span>
                                {new Date(row.data_entry_date || row.createdAt).toLocaleString("tr-TR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-20 flex items-center justify-center text-muted-foreground/30 font-black uppercase tracking-widest text-xs flex-col gap-3">
                      <Scale size={36} className="opacity-20" />
                      "{searchedMaterial}" Malzemesi İçin Kayıtlı Ölçüm Bulunmamaktadır.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* PAGINATION FOOTER */}
            {searchedMaterial && filteredHistory.length > 0 && (
              <div className="shrink-0 flex items-center justify-between px-5 py-3 bg-secondary/20 border-t border-border select-none">
                <div className="text-[10px] font-bold text-muted-foreground">
                  {dateFilter !== "Tümü" ? (
                    <>
                      Filtrelenen: <span className="text-primary font-black">{filteredHistory.length}</span> kayıt (Toplam: {totalItems})
                    </>
                  ) : (
                    <>
                      Toplam <span className="text-primary font-black">{totalItems}</span> kayıt bulundu. Sayfa başına {limit} satır listeleniyor.
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || loading}
                    className="p-1.5 border border-border bg-background hover:bg-secondary rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed text-foreground cursor-pointer"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs font-mono font-black text-foreground">
                    Sayfa {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || loading}
                    className="p-1.5 border border-border bg-background hover:bg-secondary rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed text-foreground cursor-pointer"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
