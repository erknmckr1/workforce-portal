import React, { useState, useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import {
  FileBarChart2,
  CalendarCheck,
  Users,
  Clock,
  Timer,
  Download,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Loader2,
  TrendingUp,
  Layers,
  HeartPulse,
  X,
  UserCheck,
} from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

// --- TYPES ---
interface KPISummary {
  totalRequests: number;
  totalDays: number;
  totalHours: number;
  currentlyOnLeave: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  cancelledCount: number;
  approvalRate: number;
  avgApprovalHours: number;
  revir: {
    total: number;
    sevkCount: number;
    istirahatCount: number;
    lostHours: number;
    sharePercentage: number;
  };
}

interface ReasonStat {
  id: number;
  code: string;
  label: string;
  count: number;
  totalDays: number;
  totalHours: number;
  percentage: number;
}

interface SectionStat {
  id: any;
  name: string;
  total: number;
  approved: number;
  revir: number;
  days: number;
  hours: number;
}

interface MonthlyTrendItem {
  month: string;
  label: string;
  total: number;
  revir: number;
  approved: number;
}

interface TableRecord {
  id: number;
  userId: string;
  employeeName: string;
  sectionName: string;
  departmentName: string;
  reasonId: number;
  reasonLabel: string;
  statusId: number;
  statusLabel: string;
  statusCode: string;
  durationType: string;
  startDate: string;
  endDate: string;
  totalDays: number | null;
  totalHours: number | null;
  description: string | null;
  createdAt: string;
  respondedAt: string | null;
}

interface FilterOption {
  id: number | string;
  name?: string;
  label?: string;
  code?: string;
}

interface ActiveLeaveItem {
  id: number;
  userId: string;
  employeeName: string;
  sectionId?: string | null;
  sectionName: string;
  departmentName: string;
  reasonId: number;
  reasonLabel: string;
  durationType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  totalHours: number;
  description?: string | null;
  email?: string | null;
  isRevir: boolean;
}

interface PendingLeaveItem {
  id: number;
  userId: string;
  employeeName: string;
  sectionId?: string | null;
  sectionName: string;
  departmentName: string;
  reasonId: number;
  reasonLabel: string;
  statusId: number;
  statusLabel: string;
  statusCode: string;
  durationType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  totalHours: number;
  description?: string | null;
  createdAt: string;
  auth1UserId?: string | null;
  auth2UserId?: string | null;
  isRevir: boolean;
}

interface KPIApiResponse {
  summary: KPISummary;
  activeLeaves?: ActiveLeaveItem[];
  pendingLeaves?: PendingLeaveItem[];
  byReason: ReasonStat[];
  bySection: SectionStat[];
  monthlyTrend: MonthlyTrendItem[];
  records: TableRecord[];
  filterOptions: {
    sections: FilterOption[];
    reasons: FilterOption[];
  };
}

type PeriodPreset = "today" | "week" | "month" | "year" | "all" | "custom";


// --- MULTI-SELECT DROPDOWN FILTER COMPONENT ---
interface MultiSelectItem {
  id: string | number;
  label: string;
  badge?: string;
  badgeColor?: string;
}

interface MultiSelectDropdownProps {
  label: string;
  items: MultiSelectItem[];
  selectedIds: (string | number)[] | null; // null means ALL selected
  onChange: (ids: (string | number)[] | null) => void;
  placeholder: string;
  allLabel: string;
  align?: "left" | "right";
  shortcuts?: Array<{
    label: string;
    ids: (string | number)[];
    icon?: React.ReactNode;
  }>;
}

function MultiSelectDropdown({
  label,
  items,
  selectedIds,
  onChange,
  allLabel,
  shortcuts,
  align = "left",
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const isAllSelected = selectedIds === null || (items.length > 0 && selectedIds.length === items.length);

  const selectedSet = React.useMemo(() => {
    if (selectedIds === null) {
      return new Set(items.map((i) => String(i.id)));
    }
    return new Set(selectedIds.map(String));
  }, [selectedIds, items]);

  const toggleItem = (id: string | number) => {
    const strId = String(id);
    let newIds: (string | number)[];
    if (selectedIds === null) {
      newIds = items.filter((i) => String(i.id) !== strId).map((i) => i.id);
    } else if (selectedSet.has(strId)) {
      newIds = selectedIds.filter((x) => String(x) !== strId);
    } else {
      newIds = [...selectedIds, id];
    }

    if (newIds.length === items.length) {
      onChange(null); // All selected
    } else {
      onChange(newIds);
    }
  };

  const handleSelectAll = () => {
    if (isAllSelected) {
      onChange([]); // Deselect all
    } else {
      onChange(null); // Select all
    }
  };

  const filteredItems = React.useMemo(() => {
    if (!searchTerm.trim()) return items;
    const s = searchTerm.toLowerCase();
    return items.filter((i) => i.label.toLowerCase().includes(s));
  }, [items, searchTerm]);

  const triggerText = React.useMemo(() => {
    if (isAllSelected) {
      return `${allLabel} (${items.length})`;
    }
    const count = selectedSet.size;
    if (count === 0) return "Hiçbiri Seçilmedi (0)";
    if (count === 1) {
      const selectedItem = items.find((i) => selectedSet.has(String(i.id)));
      return selectedItem ? selectedItem.label : "1 Seçili";
    }
    if (count === 2) {
      const names = items
        .filter((i) => selectedSet.has(String(i.id)))
        .map((i) => i.label)
        .join(", ");
      return names;
    }
    return `${count} Seçili (${count}/${items.length})`;
  }, [isAllSelected, items, selectedSet, allLabel]);

  return (
    <div className={`relative ${isOpen ? "z-[100]" : "z-10"}`} ref={dropdownRef}>
      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
        {label}
      </label>

      {/* Trigger Butonu */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 bg-background border rounded-xl px-3 py-2 text-xs font-semibold text-foreground transition-all text-left ${
          isOpen
            ? "border-indigo-500 ring-2 ring-indigo-500/30"
            : !isAllSelected
            ? "border-indigo-500/60 bg-indigo-500/5 shadow-sm"
            : "border-border/70 hover:border-border"
        }`}
      >
        <span className="truncate">{triggerText}</span>
        <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
          {!isAllSelected && (
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          )}
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${isOpen ? "rotate-180 text-indigo-500" : ""}`}
          />
        </div>
      </button>

      {/* Popover Açılır Menü */}
      {isOpen && (
        <div
          className={`absolute z-[110] top-full mt-1.5 w-full min-w-[280px] sm:min-w-[340px] max-w-[calc(100vw-32px)] bg-white dark:bg-zinc-900 text-popover-foreground border border-border/90 rounded-2xl shadow-2xl p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-150 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {/* Arama Alanı */}
          {items.length > 6 && (
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Listede ara..."
                className="w-full pl-8 pr-2.5 py-1.5 bg-muted/40 border border-border/60 rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* Hızlı Kısayollar */}
          {shortcuts && shortcuts.length > 0 && (
            <div className="flex items-center flex-wrap gap-1 pb-1 border-b border-border/40">
              {shortcuts.map((sc) => (
                <button
                  key={sc.label}
                  type="button"
                  onClick={() => {
                    onChange(sc.ids.length === items.length ? null : sc.ids);
                  }}
                  className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-muted/60 hover:bg-indigo-500/10 hover:text-indigo-500 border border-border/40 transition-colors flex items-center gap-1"
                >
                  {sc.icon}
                  <span>{sc.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Tümünü Seç Satırı */}
          <div
            onClick={handleSelectAll}
            className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-muted/40 hover:bg-muted/70 cursor-pointer text-xs font-bold transition-colors select-none"
          >
            <span>Tümünü Seç ({items.length})</span>
            <div
              className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                isAllSelected
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : selectedSet.size > 0
                  ? "border-indigo-500 bg-indigo-500/20 text-indigo-500"
                  : "border-border bg-background"
              }`}
            >
              {isAllSelected ? (
                <Check size={12} strokeWidth={3} />
              ) : selectedSet.size > 0 ? (
                <div className="w-2 h-0.5 bg-indigo-500 rounded-full" />
              ) : null}
            </div>
          </div>

          {/* Liste Öğeleri (Checkboxlar sağ tarafta!) */}
          <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-0.5 pr-0.5">
            {filteredItems.map((item) => {
              const isChecked = selectedSet.has(String(item.id));
              return (
                <div
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`flex items-center justify-between px-2 py-1.5 rounded-xl cursor-pointer text-xs transition-colors select-none ${
                    isChecked
                      ? "bg-indigo-500/10 text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  <span className="truncate pr-2 flex items-center gap-1.5">
                    {item.label}
                    {item.badge && (
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${item.badgeColor || "bg-rose-500/10 text-rose-500 border border-rose-500/20"}`}>
                        {item.badge}
                      </span>
                    )}
                  </span>

                  {/* Sağ Taraftaki Checkbox */}
                  <div
                    className={`w-4 h-4 rounded-md border shrink-0 flex items-center justify-center transition-all ${
                      isChecked
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                        : "border-border/80 bg-background hover:border-indigo-400"
                    }`}
                  >
                    {isChecked && <Check size={12} strokeWidth={3} />}
                  </div>
                </div>
              );
            })}
            {filteredItems.length === 0 && (
              <div className="py-4 text-center text-xs text-muted-foreground">
                Eşleşen sonuç bulunamadı.
              </div>
            )}
          </div>

          {/* Alt Bilgi & Kapat */}
          <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <span>
              <strong>{selectedSet.size}</strong> / {items.length} seçildi
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] shadow-sm transition-colors"
            >
              Tamam
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// --- DASHBOARD SKELETON (İLK YÜKLEME) ---
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 5 KPI Kartı İskeleti */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-32 rounded-3xl bg-muted/30 border border-border/40 p-5 space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-3 w-20 bg-muted/60 rounded" />
              <div className="w-8 h-8 rounded-2xl bg-muted/60" />
            </div>
            <div className="h-7 w-24 bg-muted/60 rounded-lg" />
            <div className="h-3 w-32 bg-muted/40 rounded" />
          </div>
        ))}
      </div>

      {/* Grafikler İskeleti */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-[350px] rounded-3xl bg-muted/30 border border-border/40 p-6 space-y-4">
          <div className="h-4 w-48 bg-muted/60 rounded" />
          <div className="h-[250px] w-full bg-muted/20 rounded-2xl" />
        </div>
        <div className="h-[350px] rounded-3xl bg-muted/30 border border-border/40 p-6 space-y-4">
          <div className="h-4 w-40 bg-muted/60 rounded" />
          <div className="space-y-4 pt-4">
            {[1, 2, 3, 4, 5].map((j) => (
              <div key={j} className="h-8 bg-muted/20 rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      {/* Bölüm Dağılımı İskeleti */}
      <div className="h-56 rounded-3xl bg-muted/30 border border-border/40 p-6 space-y-3">
        <div className="h-4 w-44 bg-muted/60 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          {[1, 2, 3, 4, 5, 6].map((k) => (
            <div key={k} className="h-20 bg-muted/20 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

// --- AKTİF İZİNLİLER ÇEKMECESİ (DRAWER) ---
interface ActiveLeavesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  leaves: ActiveLeaveItem[];
}

function ActiveLeavesDrawer({ isOpen, onClose, leaves }: ActiveLeavesDrawerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Otomatik odaklanma ve arama sıfırlama
  React.useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // ESC tuşuyla çekmeceyi kapatma
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Sıfır gecikmeli lokal bellek içi arama (Tüm sayfayı yeniden render ETMEZ)
  const filteredLeaves = useMemo(() => {
    if (!searchTerm.trim()) return leaves;
    const q = searchTerm.toLowerCase().trim();
    return leaves.filter(
      (person) =>
        (person.employeeName && person.employeeName.toLowerCase().includes(q)) ||
        (person.userId && person.userId.toLowerCase().includes(q)) ||
        (person.sectionName && person.sectionName.toLowerCase().includes(q)) ||
        (person.reasonLabel && person.reasonLabel.toLowerCase().includes(q))
    );
  }, [leaves, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex justify-end">
      {/* Backdrop / Arka Plan Karartması */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Çekmece Paneli (Slide-in from right) */}
      <div className="relative w-full max-w-lg bg-card text-card-foreground border-l border-border/80 shadow-2xl h-full flex flex-col z-[160] animate-in slide-in-from-right duration-300">
        {/* Çekmece Başlığı */}
        <div className="p-5 border-b border-border/60 bg-muted/20 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center">
                <Users size={16} />
              </div>
              <h3 className="text-base font-black text-foreground tracking-tight">
                Bugün Kimler İzinli?
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-600 text-white shadow-xs">
                {filteredLeaves.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              Şu an fabrikada olmayan aktif onaylı izin ve revir istirahatleri
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl border border-border/60 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-all cursor-pointer"
            title="Kapat (ESC)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Arama Alanı (Anlık & Hızlı) */}
        <div className="p-4 border-b border-border/40 bg-background/50">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Personel adı, sicil no veya bölüm ara..."
              className="w-full pl-9 pr-8 py-2 bg-muted/40 border border-border/70 rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  inputRef.current?.focus();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-md hover:bg-muted/80 transition-colors"
                title="Aramayı Temizle"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Personel Listesi */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
          {filteredLeaves.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-2 text-muted-foreground">
              <div className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center text-muted-foreground mb-1">
                <UserCheck size={24} />
              </div>
              <div className="text-sm font-bold text-foreground">
                {searchTerm ? "Aramaya uygun izinli bulunamadı" : "Bugün İzinli Personel Yok"}
              </div>
              <p className="text-xs max-w-xs">
                {searchTerm
                  ? "Farklı bir arama terimi deneyebilir veya aramayı temizleyebilirsiniz."
                  : "Şu anda işletme dışında onaylı izin veya revir istirahatinde olan personel bulunmamaktadır."}
              </p>
            </div>
          ) : (
            filteredLeaves.map((person) => {
              const sDate = person.startDate ? new Date(person.startDate) : null;
              const eDate = person.endDate ? new Date(person.endDate) : null;
              const isRevir = person.isRevir;

              return (
                <div
                  key={person.id}
                  className="p-4 rounded-2xl bg-card border border-border/70 hover:border-emerald-500/40 hover:shadow-sm transition-all space-y-2.5"
                >
                  {/* Üst Satır: İsim, Sicil ve Neden Rozeti */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 truncate">
                      <div className="text-xs font-black text-foreground truncate" title={person.employeeName}>
                        {person.employeeName}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1.5">
                        <span>Sicil: {person.userId}</span>
                        <span>•</span>
                        <span className="text-foreground font-bold">{person.sectionName}</span>
                      </div>
                    </div>

                    {/* İzin Nedeni Rozeti */}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                        isRevir
                          ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                          : person.reasonId === 1
                          ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                          : "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"
                      }`}
                    >
                      {person.reasonLabel}
                    </span>
                  </div>

                  {/* Tarih ve Süre Bilgisi */}
                  <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40 text-[11px] grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[9px] text-muted-foreground uppercase font-bold">Başlangıç</div>
                      <div className="font-semibold text-foreground">
                        {sDate ? format(sDate, "dd MMM yyyy HH:mm", { locale: tr }) : "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-muted-foreground uppercase font-bold">İşe Dönüş / Bitiş</div>
                      <div className="font-bold text-emerald-600 dark:text-emerald-400">
                        {eDate ? format(eDate, "dd MMM yyyy HH:mm", { locale: tr }) : "-"}
                      </div>
                    </div>
                  </div>

                  {/* Süre Tipi ve Açıklama */}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                    <span className="font-semibold">
                      Toplam: <strong>{person.totalDays} Gün</strong> ({person.totalHours} Saat) • {person.durationType}
                    </span>
                    {person.description && (
                      <span className="truncate max-w-[150px] italic text-[9px]" title={person.description}>
                        "{person.description}"
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Çekmece Alt Bilgi */}
        <div className="p-4 border-t border-border/60 bg-muted/20 flex items-center justify-between text-xs font-bold text-muted-foreground">
          <span>Toplam {filteredLeaves.length} aktif kayıt</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-bold transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

// --- ONAY BEKLEYEN TALEPLER ÇEKMECESİ (DRAWER) ---
interface PendingLeavesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  leaves: PendingLeaveItem[];
}

function PendingLeavesDrawer({ isOpen, onClose, leaves }: PendingLeavesDrawerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Otomatik odaklanma ve arama sıfırlama
  React.useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // ESC tuşuyla çekmeceyi kapatma
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Sıfır gecikmeli lokal bellek içi arama (Tüm sayfayı yeniden render ETMEZ)
  const filteredLeaves = useMemo(() => {
    if (!searchTerm.trim()) return leaves;
    const q = searchTerm.toLowerCase().trim();
    return leaves.filter(
      (item) =>
        (item.employeeName && item.employeeName.toLowerCase().includes(q)) ||
        (item.userId && item.userId.toLowerCase().includes(q)) ||
        (item.sectionName && item.sectionName.toLowerCase().includes(q)) ||
        (item.reasonLabel && item.reasonLabel.toLowerCase().includes(q)) ||
        (item.statusLabel && item.statusLabel.toLowerCase().includes(q))
    );
  }, [leaves, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex justify-end">
      {/* Backdrop / Arka Plan Karartması */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Çekmece Paneli (Slide-in from right) */}
      <div className="relative w-full max-w-lg bg-card text-card-foreground border-l border-border/80 shadow-2xl h-full flex flex-col z-[160] animate-in slide-in-from-right duration-300">
        {/* Çekmece Başlığı */}
        <div className="p-5 border-b border-border/60 bg-muted/20 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center">
                <Clock size={16} />
              </div>
              <h3 className="text-base font-black text-foreground tracking-tight">
                Onay Bekleyen Talepler
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-600 text-white shadow-xs">
                {filteredLeaves.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              Yönetici onayı bekleyen aktif izin talepleri (En eskiden en yeniye)
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl border border-border/60 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-all cursor-pointer"
            title="Kapat (ESC)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Arama Alanı (Anlık & Hızlı) */}
        <div className="p-4 border-b border-border/40 bg-background/50">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Personel adı, sicil no, bölüm veya durum ara..."
              className="w-full pl-9 pr-8 py-2 bg-muted/40 border border-border/70 rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  inputRef.current?.focus();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-md hover:bg-muted/80 transition-colors"
                title="Aramayı Temizle"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Personel Listesi */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
          {filteredLeaves.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-2 text-muted-foreground">
              <div className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center text-muted-foreground mb-1">
                <CheckCircle2 size={24} className="text-emerald-500" />
              </div>
              <div className="text-sm font-bold text-foreground">
                {searchTerm ? "Aramaya uygun bekleyen talep bulunamadı" : "Onay Bekleyen Talep Yok"}
              </div>
              <p className="text-xs max-w-xs">
                {searchTerm
                  ? "Farklı bir arama terimi deneyebilir veya aramayı temizleyebilirsiniz."
                  : "Harika! Şu anda yönetici onayı bekleyen herhangi bir izin talebi bulunmamaktadır."}
              </p>
            </div>
          ) : (
            filteredLeaves.map((item) => {
              const sDate = item.startDate ? new Date(item.startDate) : null;
              const eDate = item.endDate ? new Date(item.endDate) : null;
              const cDate = item.createdAt ? new Date(item.createdAt) : null;
              const isRevir = item.isRevir;

              // Ne kadar süredir bekliyor?
              const waitHours = cDate ? Math.max(0, Math.round((Date.now() - cDate.getTime()) / (1000 * 60 * 60))) : 0;
              const waitDays = Math.floor(waitHours / 24);

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-card border border-border/70 hover:border-amber-500/40 hover:shadow-sm transition-all space-y-2.5"
                >
                  {/* Üst Satır: İsim, Sicil ve Onay Durumu Rozeti */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 truncate">
                      <div className="text-xs font-black text-foreground truncate" title={item.employeeName}>
                        {item.employeeName}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1.5">
                        <span>Sicil: {item.userId}</span>
                        <span>•</span>
                        <span className="text-foreground font-bold">{item.sectionName}</span>
                      </div>
                    </div>

                    {/* Onay Durumu & İzin Nedeni Rozetleri */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          item.statusId === 1
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            : "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20"
                        }`}
                      >
                        {item.statusLabel}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                          isRevir
                            ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                            : "bg-muted text-muted-foreground border border-border/60"
                        }`}
                      >
                        {item.reasonLabel}
                      </span>
                    </div>
                  </div>

                  {/* Tarih ve Bekleme Bilgisi */}
                  <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40 text-[11px] grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[9px] text-muted-foreground uppercase font-bold">Talep Edilen İzin</div>
                      <div className="font-semibold text-foreground">
                        {sDate ? format(sDate, "dd MMM yyyy", { locale: tr }) : "-"} → {eDate ? format(eDate, "dd MMM yyyy", { locale: tr }) : "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-muted-foreground uppercase font-bold">Bekleme Süresi</div>
                      <div className="font-bold text-amber-600 dark:text-amber-400">
                        {waitDays > 0 ? `${waitDays} gün ${waitHours % 24} saat` : `${waitHours} saat önce`}
                      </div>
                    </div>
                  </div>

                  {/* Süre Tipi ve Açıklama */}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                    <span className="font-semibold">
                      Toplam: <strong>{item.totalDays} Gün</strong> ({item.totalHours} Saat) • {item.durationType}
                    </span>
                    {item.description && (
                      <span className="truncate max-w-[150px] italic text-[9px]" title={item.description}>
                        "{item.description}"
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Çekmece Alt Bilgi */}
        <div className="p-4 border-t border-border/60 bg-muted/20 flex items-center justify-between text-xs font-bold text-muted-foreground">
          <span>Toplam {filteredLeaves.length} bekleyen talep</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-bold transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LeaveKPIsPage() {
  // --- STATE ---
  const [period, setPeriod] = useState<PeriodPreset>("year");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  // Multi-select filter states (null = ALL selected by default)
  const [selectedSectionIds, setSelectedSectionIds] = useState<(string | number)[] | null>(null);
  const [selectedReasonIds, setSelectedReasonIds] = useState<(string | number)[] | null>(null);

  // Cache filter options so options persist even if 0 results return
  const [cachedSections, setCachedSections] = useState<FilterOption[]>([]);
  const [cachedReasons, setCachedReasons] = useState<FilterOption[]>([]);

  // Drawer States
  const [isActiveLeavesDrawerOpen, setIsActiveLeavesDrawerOpen] = useState(false);
  const [isPendingLeavesDrawerOpen, setIsPendingLeavesDrawerOpen] = useState(false);

  // Table filters & pagination
  const [tableSearch, setTableSearch] = useState("");
  const [tableStatusFilter, setTableStatusFilter] = useState<"ALL" | "APPROVED" | "PENDING" | "REJECTED" | "REVIR">("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Section Slider Pagination (3x3 grid = 9 cards per page)
  const [sectionPage, setSectionPage] = useState(1);
  const sectionPageSize = 9;

  // Compute startDate & endDate strings based on period
  const queryDates = useMemo(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (period === "today") {
      const todayStr = fmt(now);
      return { startDate: todayStr, endDate: todayStr };
    }
    if (period === "week") {
      const start = new Date(now);
      const day = start.getDay() || 7;
      start.setDate(start.getDate() - day + 1); // Monday
      return { startDate: fmt(start), endDate: fmt(now) };
    }
    if (period === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: fmt(start), endDate: fmt(now) };
    }
    if (period === "year") {
      const start = new Date(now.getFullYear(), 0, 1);
      return { startDate: fmt(start), endDate: fmt(now) };
    }
    if (period === "custom") {
      return {
        startDate: customStartDate || undefined,
        endDate: customEndDate || undefined,
      };
    }
    // "all"
    return { startDate: undefined, endDate: undefined };
  }, [period, customStartDate, customEndDate]);

  // --- QUERY ---
  const { data, isLoading, isFetching, refetch } = useQuery<KPIApiResponse>({
    queryKey: [
      "leaveKPIs",
      queryDates.startDate,
      queryDates.endDate,
      selectedSectionIds,
      selectedReasonIds,
    ],
    queryFn: async () => {
      const params: any = {};
      if (queryDates.startDate) params.startDate = queryDates.startDate;
      if (queryDates.endDate) params.endDate = queryDates.endDate;

      if (selectedSectionIds !== null) {
        params.sectionIds = selectedSectionIds.length === 0 ? "NONE" : selectedSectionIds.join(",");
      }

      if (selectedReasonIds !== null) {
        params.reasonIds = selectedReasonIds.length === 0 ? "-1" : selectedReasonIds.join(",");
      }

      const res = await apiClient.get("/leave/kpis", { params });
      return res.data;
    },
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });

  // Keep cached sections and reasons updated
  React.useEffect(() => {
    if (data?.filterOptions?.sections?.length) {
      setCachedSections(data.filterOptions.sections);
    }
    if (data?.filterOptions?.reasons?.length) {
      setCachedReasons(data.filterOptions.reasons);
    }
  }, [data?.filterOptions]);

  const summary = data?.summary;

  // Filter table records by search and status
  const filteredRecords = useMemo(() => {
    if (!data?.records) return [];
    return data.records.filter((r) => {
      // Search
      const searchLower = tableSearch.toLowerCase();
      const matchesSearch =
        !tableSearch ||
        r.employeeName.toLowerCase().includes(searchLower) ||
        r.userId.toLowerCase().includes(searchLower) ||
        r.sectionName.toLowerCase().includes(searchLower) ||
        r.reasonLabel.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;

      // Status Filter
      if (tableStatusFilter === "APPROVED") return r.statusId === 3;
      if (tableStatusFilter === "PENDING") return r.statusId === 1 || r.statusId === 2;
      if (tableStatusFilter === "REJECTED") return r.statusId === 5;
      if (tableStatusFilter === "REVIR") return r.reasonId === 8 || r.reasonId === 9;

      return true;
    });
  }, [data?.records, tableSearch, tableStatusFilter]);

  // Paginated records
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage]);

  // Section slider pagination calculations
  const allSectionsList = useMemo(() => data?.bySection || [], [data?.bySection]);
  const totalSectionPages = Math.max(1, Math.ceil(allSectionsList.length / sectionPageSize));
  const paginatedSections = useMemo(() => {
    const start = (sectionPage - 1) * sectionPageSize;
    return allSectionsList.slice(start, start + sectionPageSize);
  }, [allSectionsList, sectionPage]);

  // Reason slider pagination calculations (5 reasons per slide)
  const [reasonPage, setReasonPage] = useState(1);
  const reasonPageSize = 5;
  const allReasonsList = useMemo(() => data?.byReason || [], [data?.byReason]);
  const totalReasonPages = Math.max(1, Math.ceil(allReasonsList.length / reasonPageSize));
  const paginatedReasons = useMemo(() => {
    const start = (reasonPage - 1) * reasonPageSize;
    return allReasonsList.slice(start, start + reasonPageSize);
  }, [allReasonsList, reasonPage]);

  // Cross-filtering handler for Reason Distribution Card
  const handleToggleReasonSelection = (reasonId: number) => {
    const strId = String(reasonId);
    if (selectedReasonIds === null) {
      // İk başta hepsi seçiliydi -> Tıklanan tek nedeni izole et
      setSelectedReasonIds([reasonId]);
    } else {
      const isAlreadySelected = selectedReasonIds.map(String).includes(strId);
      if (isAlreadySelected) {
        // İkinci tıklama: seçimi kaldır
        const newIds = selectedReasonIds.filter((x) => String(x) !== strId);
        if (newIds.length === 0) {
          // Hiçbiri kalmadıysa hepsini seçili duruma döndür
          setSelectedReasonIds(null);
        } else {
          setSelectedReasonIds(newIds);
        }
      } else {
        // Yeni bir neden daha ekle (Çoklu seçim)
        const newIds = [...selectedReasonIds, reasonId];
        const allCount = (cachedReasons.length ? cachedReasons : data?.filterOptions?.reasons || []).length;
        if (allCount > 0 && newIds.length === allCount) {
          setSelectedReasonIds(null);
        } else {
          setSelectedReasonIds(newIds);
        }
      }
    }
  };

  // Cross-filtering handler for Section Distribution Card
  const handleToggleSectionSelection = (sectionId: string | number) => {
    const strId = String(sectionId);
    if (selectedSectionIds === null) {
      // İlk başta hepsi seçiliydi -> Tıklanan tek bölümü izole et
      setSelectedSectionIds([sectionId]);
    } else {
      const isAlreadySelected = selectedSectionIds.map(String).includes(strId);
      if (isAlreadySelected) {
        // İkinci tıklama: seçimi kaldır
        const newIds = selectedSectionIds.filter((x) => String(x) !== strId);
        if (newIds.length === 0) {
          // Hiçbiri kalmadıysa hepsini seçili duruma döndür
          setSelectedSectionIds(null);
        } else {
          setSelectedSectionIds(newIds);
        }
      } else {
        // Yeni bir bölüm daha ekle (Çoklu seçim)
        const newIds = [...selectedSectionIds, sectionId];
        const allCount = (cachedSections.length ? cachedSections : data?.filterOptions?.sections || []).length;
        if (allCount > 0 && newIds.length === allCount) {
          setSelectedSectionIds(null);
        } else {
          setSelectedSectionIds(newIds);
        }
      }
    }
  };


  // Reset table pagination on filter change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [tableSearch, tableStatusFilter, period, selectedSectionIds, selectedReasonIds, customStartDate, customEndDate]);

  // Keep slider pages within valid bounds if data changes
  React.useEffect(() => {
    if (reasonPage > totalReasonPages) {
      setReasonPage(Math.max(1, totalReasonPages));
    }
  }, [totalReasonPages, reasonPage]);

  React.useEffect(() => {
    if (sectionPage > totalSectionPages) {
      setSectionPage(Math.max(1, totalSectionPages));
    }
  }, [totalSectionPages, sectionPage]);

  // Excel Export Handler
  const handleExportExcel = () => {
    if (!data || !filteredRecords.length) {
      toast.error("Dışa aktarılacak veri bulunamadı.");
      return;
    }

    try {
      // 1. Özet Sayfası
      const summaryRows = [
        ["METRİK", "DEĞER"],
        ["Toplam İzin Talebi", summary?.totalRequests || 0],
        ["Toplam İzin Günü", summary?.totalDays || 0],
        ["Toplam İzin Saati", summary?.totalHours || 0],
        ["Şu An İzinli Personel", summary?.currentlyOnLeave || 0],
        ["Onay Bekleyenler", summary?.pendingCount || 0],
        ["Onaylanan Talepler", summary?.approvedCount || 0],
        ["Reddedilen Talepler", summary?.rejectedCount || 0],
        ["İptal Edilen Talepler", summary?.cancelledCount || 0],
        ["Onay Başarı Oranı", `%${summary?.approvalRate || 0}`],
        ["Ortalama Onay Süresi (Saat)", summary?.avgApprovalHours || 0],
        ["--- REVİR METRİKLERİ ---", ""],
        ["Toplam Revir Sevk / İstirahat", summary?.revir.total || 0],
        ["Doktor Sevk Sayısı", summary?.revir.sevkCount || 0],
        ["Doktor İstirahat Sayısı", summary?.revir.istirahatCount || 0],
        ["Revir Kaynaklı Kayıp Saat", summary?.revir.lostHours || 0],
        ["Toplam İzinler İçindeki Revir Payı", `%${summary?.revir.sharePercentage || 0}`],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);

      // 2. Detaylı Kayıtlar Sayfası
      const detailRows = filteredRecords.map((r) => ({
        "İzin ID": r.id,
        "Personel Sicil / ID": r.userId,
        "Personel Adı Soyadı": r.employeeName,
        "Bölüm": r.sectionName,
        "Departman": r.departmentName,
        "İzin Nedeni": r.reasonLabel,
        "Durum": r.statusLabel,
        "Süre Tipi": r.durationType,
        "Başlangıç Tarihi": r.startDate ? format(new Date(r.startDate), "dd.MM.yyyy HH:mm") : "",
        "Bitiş Tarihi": r.endDate ? format(new Date(r.endDate), "dd.MM.yyyy HH:mm") : "",
        "Toplam Gün": r.totalDays || 0,
        "Toplam Saat": r.totalHours || 0,
        "Açıklama": r.description || "",
        "Talep Tarihi": r.createdAt ? format(new Date(r.createdAt), "dd.MM.yyyy HH:mm") : "",
        "Onaylanma Tarihi": r.respondedAt ? format(new Date(r.respondedAt), "dd.MM.yyyy HH:mm") : "",
      }));
      const wsDetails = XLSX.utils.json_to_sheet(detailRows);

      // 3. Bölüm Dağılımı Sayfası
      const sectionRows = (data.bySection || []).map((s) => ({
        "Bölüm": s.name,
        "Toplam Talep": s.total,
        "Onaylanan": s.approved,
        "Revir Sevk/İstirahat": s.revir,
        "Toplam Gün": s.days,
        "Toplam Saat": s.hours,
      }));
      const wsSections = XLSX.utils.json_to_sheet(sectionRows);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsSummary, "Genel Özet");
      XLSX.utils.book_append_sheet(wb, wsDetails, "İzin Kayıtları");
      XLSX.utils.book_append_sheet(wb, wsSections, "Bölüm Dağılımı");

      const dateTag = format(new Date(), "yyyyMMdd_HHmm");
      XLSX.writeFile(wb, `Izin_Ve_Revir_Analizi_${dateTag}.xlsx`);
      toast.success("Excel raporu başarıyla indirildi.");
    } catch (err) {
      console.error(err);
      toast.error("Excel oluşturulurken bir hata meydana geldi.");
    }
  };

  // Safe formatting helper
  const fmtDate = (dStr: string | null) => {
    if (!dStr) return "-";
    try {
      return format(new Date(dStr), "dd MMM yyyy HH:mm", { locale: tr });
    } catch {
      return dStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. ÜST FİLTRE VE EYLEM ÇUBUĞU */}
      <div className="relative z-40 bg-card/70 backdrop-blur-xl border border-border/60 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
        {/* Canlı Yükleme Göstergesi (Top Progress Bar) */}
        {isFetching && (
          <div className="absolute top-0 left-0 right-0 h-1.5 z-50 rounded-t-3xl overflow-hidden bg-indigo-500/10 pointer-events-none">
            <div className="h-full bg-gradient-to-r from-indigo-500 via-rose-500 to-amber-500 animate-pulse w-full" />
          </div>
        )}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Periyot Hızlı Seçiciler */}
          <div className="flex items-center flex-wrap gap-1.5 p-1 bg-muted/40 rounded-2xl border border-border/40 w-fit">
            {[
              { id: "today", label: "Bugün" },
              { id: "week", label: "Bu Hafta" },
              { id: "month", label: "Bu Ay" },
              { id: "year", label: "Bu Yıl (2026)" },
              { id: "all", label: "Tüm Zamanlar" },
              { id: "custom", label: "Özel Aralık" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as PeriodPreset)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  period === p.id
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Aksiyon Butonları (Yenile & Excel & Loading) */}
          <div className="flex items-center gap-2.5">
            {isFetching && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-bold animate-pulse">
                <Loader2 size={13} className="animate-spin text-indigo-500" />
                <span className="hidden sm:inline">Hesaplanıyor...</span>
              </div>
            )}

            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-muted/50 hover:bg-muted border border-border/60 text-xs font-bold transition-colors"
              title="Verileri Yenile"
            >
              <RefreshCw size={14} className={isFetching ? "animate-spin text-indigo-500" : ""} />
              <span>Yenile</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition-all"
            >
              <Download size={14} />
              <span>Excel'e Aktar</span>
            </button>
          </div>
        </div>

        {/* İkincil Filtreler (Özel Tarih, Bölüm, Neden) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-border/40">
          {/* Özel Tarih Başlangıç */}
          {period === "custom" && (
            <>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Başlangıç Tarihi
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full bg-background border border-border/70 rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Bitiş Tarihi
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full bg-background border border-border/70 rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
            </>
          )}

          {/* Bölüm Çoklu Seçim Filtresi (Sağda Checkboxlar) */}
          <MultiSelectDropdown
            label="Bölüm Filtresi"
            items={(cachedSections.length ? cachedSections : data?.filterOptions?.sections || []).map((s) => ({
              id: s.id,
              label: s.name || `Bölüm #${s.id}`,
            }))}
            selectedIds={selectedSectionIds}
            onChange={setSelectedSectionIds}
            placeholder="Bölüm Seçin..."
            allLabel="Tüm Bölümler"
          />

          {/* İzin Türü Çoklu Seçim Filtresi (Sağda Checkboxlar) */}
          <MultiSelectDropdown
            label="İzin Türü / Kategori"
            items={(cachedReasons.length ? cachedReasons : data?.filterOptions?.reasons || []).map((r) => {
              const isRevir = r.id === 8 || r.id === 9;
              return {
                id: r.id,
                label: r.label || `Neden #${r.id}`,
                badge: isRevir ? "REVİR" : undefined,
                badgeColor: isRevir ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" : undefined,
              };
            })}
            selectedIds={selectedReasonIds}
            onChange={setSelectedReasonIds}
            placeholder="İzin Türü Seçin..."
            allLabel="Tüm İzin Türleri"
            align="right"
            shortcuts={[
              {
                label: "Tümünü Seç",
                ids: (cachedReasons.length ? cachedReasons : data?.filterOptions?.reasons || []).map((r) => r.id),
              },
              {
                label: "🏥 Sadece Revir",
                ids: [8, 9],
              },
              {
                label: "🏖️ Yıllık İzin",
                ids: [1],
              },
            ]}
          />
        </div>
      </div>

      {/* İÇERİK ALANI (İlk yüklemede skeleton, sonrasında kesintisiz sabit görünüm) */}
      {isLoading && !data ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6 relative">
          {/* 2. TOP KPI KARTLARI (5'Lİ GRID) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KART 1: Toplam İzin */}
        <div className="bg-card/80 backdrop-blur-xl border border-indigo-500/20 rounded-3xl p-5 shadow-sm relative overflow-hidden group hover:border-indigo-500/40 transition-all flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Toplam İzin
            </span>
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center">
              <CalendarCheck size={18} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-black tracking-tight text-foreground">
              {summary ? summary.totalRequests.toLocaleString("tr-TR") : "-"}
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              {summary ? `${summary.totalDays.toLocaleString("tr-TR")} Gün / ${summary.totalHours.toLocaleString("tr-TR")} Saat` : "-"}
            </div>
          </div>
        </div>

        {/* KART 2: Şu An İzinli (Tıklanabilir -> Sağdan Açılır Çekmece) */}
        <div 
          onClick={() => setIsActiveLeavesDrawerOpen(true)}
          className="bg-card/80 backdrop-blur-xl border border-emerald-500/30 hover:border-emerald-500 rounded-3xl p-5 shadow-sm relative group transition-colors cursor-pointer select-none flex flex-col justify-between"
          title="Bugün izinli olan personelleri sağdan açılır listede görmek için tıklayın"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                Şu An İzinli
              </span>
              <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center">
                <Users size={18} />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black tracking-tight text-foreground">
                  {summary ? summary.currentlyOnLeave : "-"}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Personel
                </span>
              </div>
            </div>
          </div>

          {/* Tıklanabilir Aksiyon Satırı */}
          <div className="pt-2.5 mt-3 border-t border-border/50 flex items-center justify-between text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <span className="text-muted-foreground font-semibold text-[10px] truncate max-w-[110px]" title="Bugün fabrikada olmayanlar">
              Fabrikada Yok
            </span>
            <span className="inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform shrink-0">
              <span>Listeyi Gör</span>
              <ChevronRight size={12} />
            </span>
          </div>
        </div>

        {/* KART 3: Onay Bekleyen & Oran (Tıklanabilir -> Sağdan Açılır Çekmece) */}
        <div 
          onClick={() => setIsPendingLeavesDrawerOpen(true)}
          className="bg-card/80 backdrop-blur-xl border border-amber-500/30 hover:border-amber-500 rounded-3xl p-5 shadow-sm relative group transition-colors cursor-pointer select-none flex flex-col justify-between"
          title="Onay bekleyen izin taleplerini sağdan açılır listede görmek için tıklayın"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                Onay Süreci
              </span>
              <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center">
                <Clock size={18} />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black tracking-tight text-foreground">
                  {summary ? `${summary.pendingCount}` : "-"}
                </span>
                <span className="text-xs font-bold text-muted-foreground">Bekleyen</span>
              </div>
            </div>
          </div>

          {/* Tıklanabilir Aksiyon Satırı */}
          <div className="pt-2.5 mt-3 border-t border-border/50 flex items-center justify-between text-[11px] font-bold text-amber-600 dark:text-amber-400">
            <span className="text-muted-foreground font-semibold text-[10px] truncate max-w-[110px]">
              {summary ? `%${summary.approvalRate} Onay Oranı` : "-"}
            </span>
            <span className="inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform shrink-0">
              <span>Listeyi Gör</span>
              <ChevronRight size={12} />
            </span>
          </div>
        </div>

        {/* KART 4: Revir Sevk & İstirahat (Kilit Gösterge!) */}
        <div className="bg-card/80 backdrop-blur-xl border border-rose-500/20 rounded-3xl p-5 shadow-sm relative overflow-hidden group hover:border-rose-500/40 transition-all flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition-colors" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span>Revir İşlemleri</span>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-500 text-white">
                REVİR
              </span>
            </span>
            <div className="w-9 h-9 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center">
              <HeartPulse size={18} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight text-foreground">
                {summary ? summary.revir.total.toLocaleString("tr-TR") : "-"}
              </span>
              <span className="text-xs font-bold text-rose-500">
                {summary ? `%${summary.revir.sharePercentage} Pay` : ""}
              </span>
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              {summary
                ? `${summary.revir.sevkCount} Sevk, ${summary.revir.istirahatCount} İst. (${summary.revir.lostHours}s Kayıp)`
                : "-"}
            </div>
          </div>
        </div>

        {/* KART 5: Ortalama Onay Süresi */}
        <div className="bg-card/80 backdrop-blur-xl border border-blue-500/20 rounded-3xl p-5 shadow-sm relative overflow-hidden group hover:border-blue-500/40 transition-all flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Ort. Onay Süresi
            </span>
            <div className="w-9 h-9 rounded-2xl bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center">
              <Timer size={18} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-black tracking-tight text-foreground">
              {summary ? `${summary.avgApprovalHours} Saat` : "-"}
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              Yönetici ilk onayına kadar geçen süre
            </div>
          </div>
        </div>
      </div>

      {/* 3. GRAFİKLER & GÖRSEL ANALİTİK (2 KOLONLU) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GRAFİK 1: Aylık Trend (2 Kolon) */}
        <div className="lg:col-span-2 bg-card/70 backdrop-blur-xl border border-border/60 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-foreground uppercase tracking-tight flex items-center gap-2">
                <TrendingUp size={18} className="text-indigo-500" />
                <span>İzin & Revir Süreç Trendi</span>
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                Aylık toplam izin talepleri ile revir sevklerinin karşılaştırmalı seyri
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-indigo-500" />
                <span className="text-muted-foreground">Toplam İzin</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-500" />
                <span className="text-muted-foreground">Revir Sevk/İst.</span>
              </div>
            </div>
          </div>

          <div className="h-[280px] w-full pt-2">
            {data?.monthlyTrend && data.monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data.monthlyTrend.slice(-12)}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorRevir" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    tickLine={false}
                    axisLine={{ opacity: 0.2 }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    tickLine={false}
                    axisLine={{ opacity: 0.2 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderRadius: "16px",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#fff",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Toplam İzin"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorTotal)"
                  />
                  <Area
                    type="monotone"
                    dataKey="revir"
                    name="Revir Sevk/İst."
                    stroke="#f43f5e"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRevir)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Trend verisi bulunamadı.
              </div>
            )}
          </div>
        </div>

        {/* GRAFİK 2: İzin Nedenleri Dağılımı (1 Kolon - Tıklanabilir Çapraz Filtreleme) */}
        <div className="bg-card/70 backdrop-blur-xl border border-border/60 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-foreground uppercase tracking-tight flex items-center gap-2">
                  <Layers size={18} className="text-amber-500" />
                  <span>İzin Nedenleri Dağılımı</span>
                </h3>
                {selectedReasonIds !== null && (
                  <button
                    type="button"
                    onClick={() => setSelectedReasonIds(null)}
                    className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition-all cursor-pointer"
                    title="Neden filtresini temizle ve tümünü göster"
                  >
                    <X size={10} strokeWidth={3} />
                    <span>Filtreyi Temizle ({selectedReasonIds.length})</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-medium">
                {selectedReasonIds !== null
                  ? `${selectedReasonIds.length} neden seçildi • Kaldırmak veya eklemek için tıklayın`
                  : "Filtrelemek için satırlara tıklayabilirsiniz (Çoklu seçim)"}
              </p>
            </div>

            {/* Slider Kontrolleri */}
            {totalReasonPages > 1 && (
              <div className="flex items-center gap-1 shrink-0 pt-0.5">
                <span className="text-[10px] font-bold text-muted-foreground mr-1">
                  Sayfa {reasonPage}/{totalReasonPages}
                </span>
                <button
                  type="button"
                  onClick={() => setReasonPage((p) => Math.max(1, p - 1))}
                  disabled={reasonPage === 1}
                  aria-label="Önceki Nedenler"
                  title="Önceki Nedenler"
                  className="w-7 h-7 rounded-lg border border-border/60 bg-muted/40 hover:bg-muted flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setReasonPage((p) => Math.min(totalReasonPages, p + 1))}
                  disabled={reasonPage === totalReasonPages}
                  aria-label="Sonraki Nedenler"
                  title="Sonraki Nedenler"
                  className="w-7 h-7 rounded-lg border border-border/60 bg-muted/40 hover:bg-muted flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Tıklanabilir Neden Satırları */}
          <div className="space-y-2 my-auto min-h-[220px] flex flex-col justify-center">
            {paginatedReasons.map((r) => {
              const isRevir = r.id === 8 || r.id === 9;
              const isFilteringActive = selectedReasonIds !== null;
              const isSelected = isFilteringActive && selectedReasonIds.map(String).includes(String(r.id));

              return (
                <div
                  key={r.id}
                  onClick={() => handleToggleReasonSelection(r.id)}
                  title={
                    isSelected
                      ? `"${r.label}" filtresini kaldırmak için tıklayın`
                      : `"${r.label}" iznini filtreye eklemek için tıklayın`
                  }
                  className={`group p-2.5 rounded-2xl cursor-pointer transition-all space-y-1.5 border ${
                    isSelected
                      ? "bg-indigo-500/15 dark:bg-indigo-500/25 border-indigo-500/80 shadow-xs ring-1 ring-indigo-500/30"
                      : isFilteringActive
                      ? "bg-muted/10 border-border/30 opacity-60 hover:opacity-100 hover:bg-muted/40 hover:border-border/60"
                      : "bg-muted/20 hover:bg-muted/50 border-border/40 hover:border-border/80"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold flex items-center gap-2 truncate max-w-[70%]" title={r.label}>
                      {/* Checkbox / Durum Kutusu */}
                      <div
                        className={`w-4 h-4 rounded-md border shrink-0 flex items-center justify-center transition-all ${
                          isSelected
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                            : isFilteringActive
                            ? "border-border/70 bg-background/50 group-hover:border-indigo-400"
                            : "border-border/60 bg-background/40 group-hover:border-indigo-400"
                        }`}
                      >
                        {isSelected ? (
                          <Check size={11} strokeWidth={3} />
                        ) : null}
                      </div>

                      <span className={`truncate ${isSelected ? "text-foreground font-black" : "text-foreground font-bold"}`}>
                        {r.label}
                      </span>

                      {isRevir && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-500/10 text-rose-500 border border-rose-500/20 shrink-0">
                          REVİR
                        </span>
                      )}
                    </span>
                    <span className={`shrink-0 text-[11px] ${isSelected ? "font-black text-indigo-600 dark:text-indigo-400" : "font-bold text-muted-foreground"}`}>
                      {r.count.toLocaleString("tr-TR")} ({r.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isSelected
                          ? isRevir
                            ? "bg-rose-500"
                            : "bg-indigo-600 dark:bg-indigo-500"
                          : isFilteringActive
                          ? "bg-muted-foreground/30"
                          : isRevir
                          ? "bg-rose-500/80"
                          : "bg-indigo-500/80"
                      }`}
                      style={{ width: `${Math.min(100, r.percentage)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-border/40 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>
              Toplam <strong>{allReasonsList.length}</strong> Farklı Neden ({allReasonsList.length > 0 ? (reasonPage - 1) * reasonPageSize + 1 : 0}-{Math.min(reasonPage * reasonPageSize, allReasonsList.length)})
            </span>
            <span className="text-rose-500 font-bold">Revir: %{summary?.revir.sharePercentage || 0}</span>
          </div>
        </div>
      </div>

      {/* 4. BÖLÜM BAZLI YOĞUNLUK KARTI (3x3 Grid Slider - Tıklanabilir Çapraz Filtreleme) */}
      <div className="bg-card/70 backdrop-blur-xl border border-border/60 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-foreground uppercase tracking-tight flex items-center gap-2">
                <Building2 size={18} className="text-indigo-500" />
                <span>Bölüm Bazlı İzin & Revir Dağılımı</span>
              </h3>
              {selectedSectionIds !== null && (
                <button
                  type="button"
                  onClick={() => setSelectedSectionIds(null)}
                  className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition-all cursor-pointer"
                  title="Bölüm filtresini temizle ve tümünü göster"
                >
                  <X size={10} strokeWidth={3} />
                  <span>Filtreyi Temizle ({selectedSectionIds.length})</span>
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              {selectedSectionIds !== null
                ? `${selectedSectionIds.length} bölüm seçildi • Filtreye eklemek veya çıkarmak için kartlara tıklayın`
                : "Fabrika bölümlerine göre izin talepleri, onayları ve revir sevk sayıları (Filtrelemek için tıklayın)"}
            </p>
          </div>

          {/* Slider Sayfalama ve Kontrol Butonları */}
          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 rounded-2xl border border-border/60 text-xs font-bold text-muted-foreground">
              <span>Toplam {allSectionsList.length} Bölüm</span>
              <span className="text-border/80">|</span>
              <span className="text-foreground">
                Sayfa {sectionPage} / {totalSectionPages}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setSectionPage((p) => Math.max(1, p - 1))}
                disabled={sectionPage === 1}
                aria-label="Önceki Bölümler"
                title="Önceki Bölümler"
                className="w-8 h-8 rounded-xl border border-border/60 bg-muted/40 hover:bg-muted flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setSectionPage((p) => Math.min(totalSectionPages, p + 1))}
                disabled={sectionPage === totalSectionPages}
                aria-label="Sonraki Bölümler"
                title="Sonraki Bölümler"
                className="w-8 h-8 rounded-xl border border-border/60 bg-muted/40 hover:bg-muted flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* 3x3 Grid (Tıklanabilir Çapraz Filtreleme) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {paginatedSections.map((sec, idx) => {
            const isSectionFilteringActive = selectedSectionIds !== null;
            const isSectionSelected = isSectionFilteringActive && selectedSectionIds.map(String).includes(String(sec.id));

            return (
              <div
                key={sec.id || idx}
                onClick={() => handleToggleSectionSelection(sec.id)}
                title={
                  isSectionSelected
                    ? `"${sec.name}" filtresini kaldırmak için tıklayın`
                    : `"${sec.name}" bölümüne göre filtrelemek için tıklayın`
                }
                className={`p-3.5 rounded-2xl cursor-pointer transition-all space-y-2 group select-none border ${
                  isSectionSelected
                    ? "bg-indigo-500/15 dark:bg-indigo-500/25 border-indigo-500/80 shadow-xs ring-1 ring-indigo-500/30"
                    : isSectionFilteringActive
                    ? "bg-muted/15 border-border/30 opacity-60 hover:opacity-100 hover:bg-muted/40 hover:border-border/60"
                    : "bg-muted/30 hover:bg-muted/60 border-border/40 hover:border-indigo-500/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 truncate max-w-[70%]">
                    {/* Checkbox Kutusu */}
                    <div
                      className={`w-4 h-4 rounded-md border shrink-0 flex items-center justify-center transition-all ${
                        isSectionSelected
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                          : isSectionFilteringActive
                          ? "border-border/70 bg-background/50 group-hover:border-indigo-400"
                          : "border-border/60 bg-background/40 group-hover:border-indigo-400"
                      }`}
                    >
                      {isSectionSelected ? <Check size={11} strokeWidth={3} /> : null}
                    </div>

                    <span
                      className={`text-xs truncate ${
                        isSectionSelected ? "font-black text-foreground" : "font-bold text-foreground"
                      }`}
                      title={sec.name}
                    >
                      {sec.name}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 transition-colors ${
                      isSectionSelected
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"
                    }`}
                  >
                    {sec.total} Talep
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1 text-[11px] pt-1 border-t border-border/30">
                  <div>
                    <div className="text-[9px] text-muted-foreground uppercase font-bold">Onaylı</div>
                    <div className="font-bold text-emerald-600 dark:text-emerald-400">{sec.approved}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-muted-foreground uppercase font-bold">Revir</div>
                    <div className="font-bold text-rose-500">{sec.revir}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-muted-foreground uppercase font-bold">Kayıp Saat</div>
                    <div className="font-bold text-muted-foreground">{sec.hours}s</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. DETAYLI VERİ TABLOSU */}
      <div className="bg-card/70 backdrop-blur-xl border border-border/60 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-foreground uppercase tracking-tight flex items-center gap-2">
              <FileBarChart2 size={18} className="text-indigo-500" />
              <span>İzin ve Devamsızlık Kayıt Listesi</span>
            </h3>
            <p className="text-xs text-muted-foreground font-medium">
              Filtrelenmiş son kayıtlar ({filteredRecords.length} sonuç)
            </p>
          </div>

          {/* Tablo İçi Arama ve Durum Sekmeleri */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Arama Kutusu */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Personel veya Bölüm Ara..."
                className="pl-8 pr-3 py-1.5 bg-background border border-border/70 rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-full sm:w-56"
              />
            </div>

            {/* Durum Sekmeleri */}
            <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl border border-border/40">
              {[
                { id: "ALL", label: "Tümü" },
                { id: "APPROVED", label: "Onaylı" },
                { id: "PENDING", label: "Bekleyen" },
                { id: "REVIR", label: "Revir" },
                { id: "REJECTED", label: "Red" },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setTableStatusFilter(st.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    tableStatusFilter === st.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tablo Konteyneri */}
        <div className="overflow-x-auto border border-border/60 rounded-2xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border/60 text-[10px] font-black uppercase text-muted-foreground tracking-wider">
              <tr>
                <th className="py-3 px-4">Personel</th>
                <th className="py-3 px-4">Bölüm / Departman</th>
                <th className="py-3 px-4">İzin Nedeni</th>
                <th className="py-3 px-4">Süre</th>
                <th className="py-3 px-4">Tarih Aralığı</th>
                <th className="py-3 px-4">Durum</th>
                <th className="py-3 px-4">Talep Tarihi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-medium">
              {paginatedRecords.length > 0 ? (
                paginatedRecords.map((r) => {
                  const isRevir = r.reasonId === 8 || r.reasonId === 9;
                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      {/* Personel */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-foreground">
                          {r.employeeName}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          Sicil: {r.userId}
                        </div>
                      </td>

                      {/* Bölüm */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">
                          {r.sectionName}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {r.departmentName}
                        </div>
                      </td>

                      {/* İzin Nedeni */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            isRevir
                              ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                              : r.reasonId === 1
                              ? "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          {isRevir && <HeartPulse size={12} />}
                          {r.reasonLabel}
                        </span>
                      </td>

                      {/* Süre */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-foreground">
                          {r.totalDays ? `${r.totalDays} Gün` : "-"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {r.totalHours ? `${r.totalHours} Saat` : r.durationType}
                        </div>
                      </td>

                      {/* Tarih Aralığı */}
                      <td className="py-3 px-4">
                        <div className="text-foreground">
                          {fmtDate(r.startDate)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {fmtDate(r.endDate)}
                        </div>
                      </td>

                      {/* Durum */}
                      <td className="py-3 px-4">
                        {r.statusId === 3 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 size={12} />
                            {r.statusLabel}
                          </span>
                        ) : r.statusId === 1 || r.statusId === 2 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Clock size={12} />
                            {r.statusLabel}
                          </span>
                        ) : r.statusId === 5 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            <XCircle size={12} />
                            {r.statusLabel}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border">
                            {r.statusLabel}
                          </span>
                        )}
                      </td>

                      {/* Talep Tarihi */}
                      <td className="py-3 px-4 text-muted-foreground text-[11px]">
                        {fmtDate(r.createdAt)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-muted-foreground text-xs"
                  >
                    Kayıt bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Sayfalama Kontrolleri */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">
              Sayfa <strong>{currentPage}</strong> / <strong>{totalPages}</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-xl border border-border/60 bg-muted/40 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-xl border border-border/60 bg-muted/40 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
        </div>
      )}

      {/* SAĞDAN SOLA AÇILIR ÇEKMECELER (DRAWERS) */}
      <ActiveLeavesDrawer
        isOpen={isActiveLeavesDrawerOpen}
        onClose={() => setIsActiveLeavesDrawerOpen(false)}
        leaves={data?.activeLeaves || []}
      />

      <PendingLeavesDrawer
        isOpen={isPendingLeavesDrawerOpen}
        onClose={() => setIsPendingLeavesDrawerOpen(false)}
        leaves={data?.pendingLeaves || []}
      />
    </div>
  );
}
