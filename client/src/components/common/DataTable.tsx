import React from "react";
import {
  Loader2,
  ListFilter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  header: React.ReactNode;
  accessor?: keyof T | ((row: T, index: number) => React.ReactNode);
  className?: string;
  headerClassName?: string;
  align?: "left" | "center" | "right";
  width?: string;
}

export interface DataTableProps<T> {
  // Başlık ve Üst Bar
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  iconClassName?: string;
  hideTotalBadge?: boolean;
  headerActions?: React.ReactNode;
  onRefresh?: () => void;
  isRefreshing?: boolean;

  // Veri ve Kolonlar
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor?: (item: T, index: number) => string | number;
  renderRow?: (item: T, index: number) => React.ReactNode;

  // Sayfalama (Pagination)
  page?: number;
  totalPages?: number;
  totalCount?: number;
  limit?: number;
  onPageChange?: (newPage: number) => void;
  onLimitChange?: (newLimit: number) => void;
  limitOptions?: number[];

  // Durumlar
  isLoading?: boolean;
  loadingMessage?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;

  // Yükseklik ve Boyutlandırma
  heightClassName?: string;
  className?: string;
}

export default function DataTable<T>({
  title,
  subtitle,
  icon,
  iconClassName,
  hideTotalBadge = false,
  headerActions,
  onRefresh,
  isRefreshing = false,

  columns,
  data,
  keyExtractor,
  renderRow,

  page = 1,
  totalPages = 1,
  totalCount = data.length,
  limit = 20,
  onPageChange,
  onLimitChange,
  limitOptions = [10, 20, 50, 100],

  isLoading = false,
  loadingMessage = "Kayıtlar Yükleniyor...",
  emptyTitle = "Henüz Kayıt Bulunamadı",
  emptyDescription = "Arama kriterlerinize uygun kayıt bulunamadı veya henüz hiçbir veri eklenmemiş.",
  emptyAction,

  heightClassName = "h-[580px] xl:h-[calc(100vh-270px)] min-h-[450px]",
  className,
}: DataTableProps<T>) {
  const showPagination = typeof totalCount === "number" && totalCount > 0;

  return (
    <div
      className={cn(
        "bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-3 overflow-hidden w-full",
        heightClassName,
        className
      )}
    >
      {/* ========================================================= */}
      {/* 1. ÜST BAR (BAŞLIK, SAYI ROZETİ VE AKSİYONLAR)            */}
      {/* ========================================================= */}
      {(title || onRefresh || headerActions) && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            {icon && (
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs",
                  iconClassName || "bg-secondary text-foreground border border-border"
                )}
              >
                {icon}
              </div>
            )}
            <div>
              {title && (
                <div className="text-sm sm:text-base font-black uppercase tracking-tight text-foreground flex items-center gap-2">
                  {title}
                  {!hideTotalBadge && typeof totalCount === "number" && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-secondary text-foreground font-bold border border-border">
                      {totalCount} Kayıt
                    </span>
                  )}
                </div>
              )}
              {subtitle && (
                <p className="text-[11px] text-muted-foreground font-medium">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {headerActions}
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing || isLoading}
                className="px-3 py-1.5 bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Kayıtları Yenile"
              >
                <RotateCcw
                  size={13}
                  className={isRefreshing || isLoading ? "animate-spin text-primary" : ""}
                />
                <span>Yenile</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. TABLO GÖVDESİ (SABİT ALAN, İÇİ SCROLL EDİLEBİLİR)      */}
      {/* ========================================================= */}
      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <Loader2 size={32} className="animate-spin text-foreground mb-3" />
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {loadingMessage}
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-xl my-auto">
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground mb-3 border border-border shadow-xs">
            <ListFilter size={24} />
          </div>
          <div className="text-sm font-bold text-foreground">{emptyTitle}</div>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">{emptyDescription}</p>
          {emptyAction && <div className="mt-4">{emptyAction}</div>}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto custom-scrollbar border border-border rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-secondary sticky top-0 z-10 border-b border-border shadow-xs">
              <tr className="text-foreground uppercase font-black tracking-wider text-[11px]">
                {columns.map((col, idx) => {
                  const alignClass =
                    col.align === "center"
                      ? "text-center"
                      : col.align === "right"
                      ? "text-right"
                      : "text-left";
                  return (
                    <th
                      key={idx}
                      style={{ width: col.width }}
                      className={cn("py-3.5 px-3 whitespace-nowrap", alignClass, col.headerClassName)}
                    >
                      {col.header}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((item, index) => {
                if (renderRow) {
                  return renderRow(item, index);
                }

                const key = keyExtractor ? keyExtractor(item, index) : index;
                return (
                  <tr
                    key={key}
                    className="hover:bg-muted/30 transition-colors font-medium text-foreground"
                  >
                    {columns.map((col, cIdx) => {
                      const alignClass =
                        col.align === "center"
                          ? "text-center"
                          : col.align === "right"
                          ? "text-right"
                          : "text-left";

                      let content: React.ReactNode = null;
                      if (typeof col.accessor === "function") {
                        content = col.accessor(item, index);
                      } else if (col.accessor) {
                        content = (item as any)[col.accessor];
                      }

                      return (
                        <td
                          key={cIdx}
                          className={cn("py-3 px-3", alignClass, col.className)}
                        >
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. SAYFALAMA TOOLBAR (PAGINATION BAR)                     */}
      {/* ========================================================= */}
      {showPagination && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border shrink-0 text-xs">
          {/* Sol: Gösterilen Kayıt Bilgisi */}
          <div className="text-muted-foreground font-medium">
            Toplam <strong className="text-foreground">{totalCount}</strong> kayıttan{" "}
            <strong className="text-foreground">
              {totalCount === 0 ? 0 : (page - 1) * limit + 1} -{" "}
              {Math.min(page * limit, totalCount)}
            </strong>{" "}
            arası
          </div>

          {/* Sağ: Sayfa Kontrolleri ve Limit Seçimi */}
          <div className="flex items-center gap-3">
            {/* Sayfa Başına Adet Seçimi */}
            {onLimitChange && (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-[11px]">Satır:</span>
                <select
                  value={limit}
                  onChange={(e) => onLimitChange(Number(e.target.value))}
                  className="bg-secondary text-foreground font-bold text-xs px-2 py-1 rounded-lg border border-border focus:outline-none cursor-pointer"
                >
                  {limitOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Sayfa Numarası */}
            <div className="font-bold text-foreground px-2">
              Sayfa {page} / {totalPages}
            </div>

            {/* Butonlar */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => onPageChange?.(1)}
                disabled={page <= 1 || isLoading}
                className="p-1.5 bg-secondary hover:bg-muted text-foreground rounded-lg border border-border disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="İlk Sayfa"
              >
                <ChevronsLeft size={16} />
              </button>
              <button
                onClick={() => onPageChange?.(Math.max(page - 1, 1))}
                disabled={page <= 1 || isLoading}
                className="p-1.5 bg-secondary hover:bg-muted text-foreground rounded-lg border border-border disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Önceki Sayfa"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => onPageChange?.(Math.min(page + 1, totalPages))}
                disabled={page >= totalPages || isLoading}
                className="p-1.5 bg-secondary hover:bg-muted text-foreground rounded-lg border border-border disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Sonraki Sayfa"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => onPageChange?.(totalPages)}
                disabled={page >= totalPages || isLoading}
                className="p-1.5 bg-secondary hover:bg-muted text-foreground rounded-lg border border-border disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Son Sayfa"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
