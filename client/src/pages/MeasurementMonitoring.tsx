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
  ChevronRight
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

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
    }
  }, [history]);

  const [dateFilter, setDateFilter] = useState<string>("Tümü");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [selectedRowIds, setSelectedRowIds] = useState<number[]>([]);

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
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    fetchData(searchedMaterial, newPage);
  };

  const filteredHistory = useMemo(() => {
    if (dateFilter === "Tümü") return history;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;

    return history.filter((row) => {
      const rowTime = new Date(row.data_entry_date || row.createdAt).getTime();

      if (dateFilter === "Bugün") {
        return rowTime >= todayStart && rowTime <= todayEnd;
      }

      if (dateFilter === "Dün") {
        const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
        const yesterdayEnd = todayStart - 1;
        return rowTime >= yesterdayStart && rowTime <= yesterdayEnd;
      }

      if (dateFilter === "Bu Hafta") {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const weekStart = new Date(now.setDate(diff));
        weekStart.setHours(0, 0, 0, 0);
        return rowTime >= weekStart.getTime();
      }

      if (dateFilter === "Bu Ay") {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        return rowTime >= monthStart;
      }

      if (dateFilter === "Özel") {
        const start = startDate ? new Date(startDate).getTime() : 0;
        const end = endDate ? new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1 : Infinity;
        return rowTime >= start && rowTime <= end;
      }

      return true;
    });
  }, [history, dateFilter, startDate, endDate]);

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

  return (
    <div className="flex flex-col space-y-4 h-[calc(100vh-90px)] overflow-hidden p-1">
      
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
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
        
        {/* LEFT COLUMN: FILTERS (Fixed / Independently scrollable if overflowed) */}
        <div className="lg:col-span-1 p-5 bg-card border border-border rounded-3xl flex flex-col gap-4 shadow-sm h-full overflow-y-auto custom-scrollbar shrink-0">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground flex items-center gap-2 mb-0.5">
              <Search size={14} className="text-primary" />
              Sorgu & Filtreler
            </h3>
            <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Malzeme Arama Paneli</p>
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
        </div>

        {/* RIGHT COLUMN: TABLE (Outer container fixed, internal rows scrollable) */}
        <div className="lg:col-span-3 bg-card border border-border rounded-3xl p-5 shadow-sm flex flex-col overflow-hidden h-full">
          
          <div className="flex justify-between items-center mb-4 shrink-0">
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
          </div>

          <div className="flex-grow border border-border rounded-xl overflow-hidden flex flex-col bg-secondary/5 min-h-0">
            {/* Scrollable Table Area (Both vertical and horizontal scroll handled here) */}
            <div className="flex-1 overflow-auto custom-scrollbar relative min-h-0">
              <div className="min-w-[1460px] flex flex-col">
                {/* TABLE HEADER (Sticky at the top of scroll container) */}
                <div className="grid gap-2 p-3 border-b border-border bg-secondary text-[10px] font-black uppercase tracking-wider text-muted-foreground shrink-0 select-none sticky top-0 z-10 shadow-xs" style={{ gridTemplateColumns: "100px 140px 110px 160px 100px 100px 100px 100px 80px 110px 120px 120px 120px" }}>
                  <div>Bölüm</div>
                  <div>Malzeme</div>
                  <div>Sipariş</div>
                  <div>Operatör</div>
                  <div>Giriş Ö.</div>
                  <div>Çıkış Ö.</div>
                  <div className="text-center">Giriş (50)</div>
                  <div className="text-center">Çıkış (50)</div>
                  <div className="text-center">Ayar</div>
                  <div className="text-center">Tartılan Ad.</div>
                  <div className="text-center">Tartılan Gr.</div>
                  <div className="text-center">Sonuç Gr.</div>
                  <div className="text-center">Has Fire</div>
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
