import React, { useState, useEffect, useMemo } from "react";
import { X, Scale, History, User, Hash, Calendar, Info, AlertTriangle, Search, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import apiClient from "../../lib/api";
import type { MeasurementRecord } from "../../types/mes";

interface MeasurementHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMaterialNo?: string;
}

interface MeasureLimits {
  lowerLimit: number;
  upperLimit: number;
  weight_50cm: number;
}

const MeasurementHistoryModal: React.FC<MeasurementHistoryModalProps> = ({
  isOpen,
  onClose,
  initialMaterialNo = "",
}) => {
  const [loading, setLoading] = useState(false);
  const [materialNo, setMaterialNo] = useState(initialMaterialNo);
  const [history, setHistory] = useState<MeasurementRecord[]>([]);
  const [limits, setLimits] = useState<MeasureLimits | null>(null);
  const [searchedMaterial, setSearchedMaterial] = useState("");

  const [dateFilter, setDateFilter] = useState<string>("Tümü");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 50; // Sayfa başına kayıt sınırı

  // Modal her açıldığında veya başlangıç parametreleri değiştiğinde state'leri sıfırla/doldur
  useEffect(() => {
    if (isOpen) {
      setMaterialNo(initialMaterialNo);
      setHistory([]);
      setLimits(null);
      setSearchedMaterial("");
      setCurrentPage(1);
      setTotalPages(1);
      setTotalItems(0);
      
      if (initialMaterialNo) {
        fetchData(initialMaterialNo, 1);
      }
    }
  }, [isOpen, initialMaterialNo]);

  const fetchData = async (targetMatNo: string, pageNumber: number = 1) => {
    if (!targetMatNo.trim()) return;
    const formattedMatNo = targetMatNo.trim().toUpperCase();

    setLoading(true);
    setSearchedMaterial(formattedMatNo);
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
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    fetchData(searchedMaterial, newPage);
  };

  // İstatistik hesaplamaları
  const stats = useMemo(() => {
    if (history.length === 0) return null;

    const totalWeight = history.reduce((acc, row) => acc + (row.exit_weight_50cm || 0), 0);
    const avgWeight = totalWeight / history.length;

    let outOfLimitsCount = 0;
    if (limits) {
      outOfLimitsCount = history.filter(
        (row) =>
          row.exit_weight_50cm < limits.lowerLimit ||
          row.exit_weight_50cm > limits.upperLimit
      ).length;
    }

    return {
      count: history.length,
      averageWeight: avgWeight.toFixed(2),
      outOfLimitsCount,
    };
  }, [history, limits]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-foreground/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-6xl h-[90vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* HEADER & SEARCH FORM */}
        <div className="flex-none p-6 border-b border-border bg-secondary/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 shadow-inner">
              <History size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-foreground">
                Ölçüm Kayıtları İzleme
              </h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
                Malzeme Kodu ile Sorgulama
              </p>
            </div>
          </div>

          {/* Entegre Arama Formu */}
          <form onSubmit={handleSearchSubmit} className="flex items-stretch sm:items-end gap-3 w-full sm:w-auto relative z-10">
            {/* Malzeme Kodu */}
            <div className="space-y-1.5 flex-1 sm:w-72">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Malzeme Kodu</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Örn: YZ003821-14"
                  value={materialNo}
                  onChange={(e) => setMaterialNo(e.target.value)}
                  className="w-full h-11 pl-9 pr-4 bg-background border border-border rounded-xl font-mono text-xs uppercase focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-inner"
                  required
                />
                <Hash
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60"
                />
              </div>
            </div>

            {/* Butonlar */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleReset}
                title="Aramayı Sıfırla"
                className="h-11 px-3.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-xl transition-all shadow-sm flex items-center justify-center active:scale-95 border border-border"
              >
                <RotateCcw size={16} />
              </button>
              <button
                type="submit"
                disabled={loading}
                className="h-11 px-5 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <Search size={14} />
                Sorgula
              </button>
            </div>
          </form>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 sm:relative sm:top-0 sm:right-0 p-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-xl transition-colors  z-10"
          >
            <X size={22} />
          </button>
        </div>

        {/* METRICS & LIMITS PANEL */}
        {limits && searchedMaterial && (
          <div className="flex-none p-4 bg-secondary/10 border-b border-border grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-background border border-border rounded-xl flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10 text-info">
                <Scale size={18} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">STANDART</div>
                <div className="text-sm font-bold text-foreground">{limits.weight_50cm} g</div>
              </div>
            </div>
            <div className="p-3 bg-background border border-border rounded-xl flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                <Scale size={18} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">ALT LİMİT</div>
                <div className="text-sm font-bold text-amber-500">{limits.lowerLimit} g</div>
              </div>
            </div>
            <div className="p-3 bg-background border border-border rounded-xl flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10 text-destructive">
                <Scale size={18} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">ÜST LİMİT</div>
                <div className="text-sm font-bold text-destructive">{limits.upperLimit} g</div>
              </div>
            </div>
            
            {stats && (
              <div className="p-3 bg-background border border-border rounded-xl flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stats.outOfLimitsCount > 0 ? "bg-destructive/10 text-destructive animate-pulse" : "bg-success/10 text-success"}`}>
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">TOLERANS DIŞI (SAYFA)</div>
                  <div className="text-sm font-bold text-foreground">
                    {stats.outOfLimitsCount} / {stats.count}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SUMMARY STATS (Limits Yoksa Gösterilir) */}
        {stats && !limits && searchedMaterial && (
          <div className="flex-none p-4 bg-secondary/10 border-b border-border flex gap-4">
            <div className="text-xs font-bold text-muted-foreground">
              Sayfadaki Kayıt: <span className="text-foreground">{stats.count}</span>
            </div>
            <div className="text-xs font-bold text-muted-foreground">
              Sayfa Ortalama Gramaj: <span className="text-foreground">{stats.averageWeight} g</span>
            </div>
          </div>
        )}

        {/* CONTENT */}
        <div className="flex-1 overflow-hidden flex flex-col p-6 bg-background">
          {/* Tarih Filtreleme Seçenekleri */}
          <div className="mb-4 p-3 bg-secondary/20 rounded-xl border border-border flex flex-wrap items-center gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Tarih Filtresi</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="h-10 px-3 bg-background border border-border rounded-lg text-xs font-semibold focus:ring-2 focus:ring-primary focus:outline-none transition-all cursor-pointer min-w-32"
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
              <>
                <div className="flex flex-col gap-1 animate-in slide-in-from-left duration-200">
                  <label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Başlangıç Tarihi</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-10 px-3 bg-background border border-border rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1 animate-in slide-in-from-left duration-200">
                  <label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Bitiş Tarihi</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-10 px-3 bg-background border border-border rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex-1 bg-secondary/10 border border-border rounded-2xl overflow-hidden flex flex-col shadow-inner">
            
            {/* TABLE HEADER */}
            <div className="grid grid-cols-12 gap-2 p-4 border-b border-border bg-secondary/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground flex-none">
              <div className="col-span-2">Bölüm</div>
              <div className="col-span-2">Malzeme Kodu</div>
              <div className="col-span-2">Sipariş No</div>
              <div className="col-span-2">Operatör</div>
              <div className="col-span-1">Giriş Ölçüsü</div>
              <div className="col-span-1">Çıkış Ölçüsü</div>
              <div className="col-span-1 text-center">Giriş (50cm)</div>
              <div className="col-span-1 text-center">Çıkış (50cm)</div>
            </div>

            {/* TABLE BODY */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
              {loading ? (
                <div className="h-full flex items-center justify-center text-muted-foreground/50 font-bold uppercase tracking-widest text-sm animate-pulse">
                  Ölçümler Yükleniyor...
                </div>
              ) : !searchedMaterial ? (
                <div className="h-full flex items-center justify-center text-muted-foreground/30 font-black uppercase tracking-widest text-sm flex-col gap-4">
                  <Search size={48} className="opacity-20" />
                  Sorgulamak istediğiniz malzeme kodunu girip "Sorgula" butonuna basın.
                </div>
              ) : filteredHistory.length > 0 ? (
                filteredHistory.map((row) => {
                  const isOutOfRange = limits
                    ? row.exit_weight_50cm < limits.lowerLimit || row.exit_weight_50cm > limits.upperLimit
                    : false;

                  return (
                    <div
                      key={row.id}
                      className={`grid grid-cols-12 gap-2 p-4 rounded-xl text-xs font-mono font-bold border transition-all ${
                        isOutOfRange
                          ? "bg-destructive/5 border-destructive/30 hover:border-destructive/60 text-destructive"
                          : "bg-background border-border hover:border-primary/50 text-foreground"
                      }`}
                    >
                      {/* İstasyon Adı */}
                      <div className="col-span-2 flex items-center uppercase tracking-wider text-muted-foreground text-[11px] truncate">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/70 mr-2" />
                        {row.area_name}
                      </div>
                      
                      {/* Malzeme Kodu */}
                      <div className="col-span-2 flex items-center text-primary truncate">
                        {row.material_no}
                      </div>
                      
                      <div className="col-span-2 flex items-center gap-1.5 truncate">
                        <Hash size={12} className="opacity-40" />
                        {row.order_no}
                      </div>
                      
                      <div className="col-span-2 flex items-center gap-1.5 truncate opacity-80">
                        <User size={12} className="opacity-40" />
                        {row.OperatorDetail 
                          ? `${row.OperatorDetail.name} ${row.OperatorDetail.surname}`
                          : row.operator}
                      </div>
                      
                      <div className="col-span-1 flex items-center">
                        {row.entry_measurement || "-"}
                      </div>
                      
                      <div className="col-span-1 flex items-center">
                        {row.exit_measurement || "-"}
                      </div>
                      
                      <div className="col-span-1 flex items-center justify-center text-amber-500">
                        {row.entry_weight_50cm ? `${row.entry_weight_50cm} g` : "-"}
                      </div>
                      
                      <div className={`col-span-1 flex items-center justify-center ${isOutOfRange ? "text-destructive font-black" : "text-amber-500"}`}>
                        {row.exit_weight_50cm ? `${row.exit_weight_50cm} g` : "-"}
                        {isOutOfRange && " ⚠️"}
                      </div>
                      
                      {/* Açıklama ve Tarih Alt Bilgisi */}
                      <div className="col-span-12 mt-2 pt-2 border-t border-border/30 text-[10px] text-muted-foreground flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Info size={10} className="mt-0.5" />
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
                <div className="h-full flex items-center justify-center text-muted-foreground/30 font-black uppercase tracking-widest text-sm flex-col gap-4">
                  <Scale size={48} className="opacity-20" />
                  "{searchedMaterial}" Malzemesi İçin Kayıtlı Ölçüm Bulunmamaktadır.
                </div>
              )}
            </div>

            {/* PAGINATION FOOTER */}
            {searchedMaterial && history.length > 0 && (
              <div className="flex-none flex items-center justify-between px-6 py-4 bg-secondary/30 border-t border-border">
                <div className="text-xs font-bold text-muted-foreground">
                  Toplam <span className="text-primary font-black">{totalItems}</span> kayıt bulundu. Sayfa başına {limit} satır listeleniyor.
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || loading}
                    className="p-2 border border-border bg-background hover:bg-secondary rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed text-foreground"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-mono font-black select-none text-foreground">
                    Sayfa {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || loading}
                    className="p-2 border border-border bg-background hover:bg-secondary rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed text-foreground"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default MeasurementHistoryModal;
