import { useState, useRef, useEffect } from "react";
import {
  Layers,
  Play,
  Square,
  RotateCcw,
  Barcode,
  Hash,
  Activity,
  Clock,
  ListFilter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Scan,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface OperatorData {
  id_dec: string;
  name: string;
  surname: string;
  photo_url?: string | null;
  isOnBreak?: boolean;
}

interface PartiLogItem {
  id: number;
  parti_no: string;
  alt_parti: string;
  islem_id: string;
  islem_label: string | null;
  action_type: number | string;
  action_label: string | null;
  operator_id: string;
  operator_name: string | null;
  record_date: string;
  createdAt: string;
}

const ISLEMLER = [
  { id: "1", label: "Tambır" },
  { id: "2", label: "Çt1" },
  { id: "3", label: "Kurutma" },
  { id: "4", label: "Eritme" },
];

export const PARTI_ACTION_TYPES = {
  BASLA: 1,
  BITIR: 2,
  DURDUR: 3,
  IPTAL: 4,
} as const;

export default function PartiTakibi() {
  const queryClient = useQueryClient();

  // Form State
  const [operatorInput, setOperatorInput] = useState("");
  const [operator, setOperator] = useState<OperatorData | null>(null);
  const [isFetchingOperator, setIsFetchingOperator] = useState(false);

  const [partiNo, setPartiNo] = useState("");
  const [altParti, setAltParti] = useState("");
  const [selectedIslem, setSelectedIslem] = useState<string | null>(null);

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Refs
  const operatorInputRef = useRef<HTMLInputElement>(null);
  const partiInputRef = useRef<HTMLInputElement>(null);

  // İlk yüklemede Operatör ID'ye odaklan
  useEffect(() => {
    operatorInputRef.current?.focus();
  }, []);

  // 1. React Query: Parti Loglarını Sayfalı Çekme
  const {
    data: logsResponse,
    isLoading: isLoadingLogs,
    isFetching: isFetchingLogs,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ["partiLogs", page, limit],
    queryFn: async () => {
      const res = await apiClient.get("/mes/parti-logs", {
        params: { page, limit },
      });
      return res.data as {
        totalCount: number;
        totalPages: number;
        currentPage: number;
        limit: number;
        data: PartiLogItem[];
      };
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30, // 30 saniye boyunca taze kabul et
  });

  const logs = logsResponse?.data || [];
  const totalCount = logsResponse?.totalCount || 0;
  const totalPages = logsResponse?.totalPages || 1;

  // 2. React Query Mutation: Yeni Kayıt Ekleme
  const createLogMutation = useMutation({
    mutationFn: async (payload: {
      parti_no: string;
      alt_parti: string;
      islem_id: string;
      islem_label: string;
      action_type: number;
      action_label: string;
      operator_id: string;
      operator_name: string;
    }) => {
      const res = await apiClient.post("/mes/parti-logs", payload);
      return res.data;
    },
    onSuccess: (_, variables) => {
      if (variables.action_type === PARTI_ACTION_TYPES.BASLA) {
        toast.success(`[BAŞLADI] Parti: ${variables.parti_no} / Alt: ${variables.alt_parti} - ${variables.islem_label}`);
      } else {
        toast.success(`[BİTTİ] Parti: ${variables.parti_no} / Alt: ${variables.alt_parti} - ${variables.islem_label}`);
      }
      // Tabloyu tazele ve 1. sayfaya dön
      queryClient.invalidateQueries({ queryKey: ["partiLogs"] });
      setPage(1);
      resetForm(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Kayıt sırasında bir hata oluştu.");
    },
  });

  // Operatör ID sorgulama (NFC okutulduğunda Enter otomatik tetiklenir)
  const handleFetchOperator = async (idToSearch?: string) => {
    const searchId = (idToSearch || operatorInput).trim();
    if (!searchId) return;

    setIsFetchingOperator(true);
    try {
      const res = await apiClient.get(`/mes/operator/${searchId}`);
      if (res.data && res.data.id_dec) {
        setOperator(res.data);
        toast.success(`Operatör: ${res.data.name} ${res.data.surname}`);
        setTimeout(() => {
          partiInputRef.current?.focus();
        }, 80);
      } else {
        toast.error("Operatör bulunamadı.");
        setOperator(null);
        setOperatorInput("");
        setTimeout(() => operatorInputRef.current?.focus(), 80);
      }
    } catch {
      toast.error("Operatör bulunamadı.");
      setOperator(null);
      setOperatorInput("");
      setTimeout(() => operatorInputRef.current?.focus(), 80);
    } finally {
      setIsFetchingOperator(false);
    }
  };

  const handleOperatorKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleFetchOperator();
    }
  };

  const handlePartiKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && partiNo.trim()) {
      e.preventDefault();
    }
  };

  // Form Sıfırlama
  const resetForm = (resetOperator = false) => {
    setPartiNo("");
    setAltParti("");
    setSelectedIslem(null);
    if (resetOperator) {
      setOperator(null);
      setOperatorInput("");
      setTimeout(() => operatorInputRef.current?.focus(), 80);
    } else {
      setTimeout(() => partiInputRef.current?.focus(), 80);
    }
  };

  // Operasyon Kaydet (1: BAŞLA, 2: BİTİR)
  const handleOperationSubmit = (actionType: number) => {
    if (!operator) {
      toast.error("Önce operatör kimliğini okutun!");
      operatorInputRef.current?.focus();
      return;
    }
    if (!partiNo.trim()) {
      toast.error("Parti numarası giriniz!");
      partiInputRef.current?.focus();
      return;
    }
    if (!altParti.trim()) {
      toast.error("Lütfen alt parti seçiniz (1, 2, 3, 4)!");
      return;
    }
    if (!selectedIslem) {
      toast.error("Lütfen işlem seçiniz (1, 2, 3, 4)!");
      return;
    }

    const islemObj = ISLEMLER.find((i) => i.id === selectedIslem);
    const islemLabel = islemObj ? islemObj.label : `İşlem ${selectedIslem}`;
    const actionLabel = actionType === PARTI_ACTION_TYPES.BASLA ? "BAŞLADI" : "BİTTİ";

    createLogMutation.mutate({
      parti_no: partiNo.trim(),
      alt_parti: altParti.trim(),
      islem_id: selectedIslem,
      islem_label: islemLabel,
      action_type: actionType,
      action_label: actionLabel,
      operator_id: operator.id_dec,
      operator_name: `${operator.name} ${operator.surname}`.trim(),
    });
  };

  const isFormValid =
    !!operator &&
    partiNo.trim().length > 0 &&
    altParti.trim().length > 0 &&
    selectedIslem !== null;

  const isSubmitting = createLogMutation.isPending;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-6 w-full h-full items-start pb-10 xl:pb-0">
      
      {/* ========================================================= */}
      {/* 1. KİOSK FORM ALANI (Tablette Kompakt Üstte, Desktopta Orijinal Geniş Sol 5 Kolon) */}
      {/* ========================================================= */}
      <div className="xl:col-span-5 bg-card border border-border rounded-2xl p-4 sm:p-5 xl:p-6 shadow-xs flex flex-col gap-3.5 xl:gap-6">
        
        {/* BAŞLIK */}
        <div className="flex items-center justify-between border-b border-border pb-2.5 xl:pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-foreground text-background rounded-lg">
              <Layers size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase tracking-tight text-foreground">
                Parti Veri Girişi
              </h2>
              <p className="text-[11px] xl:text-xs text-muted-foreground font-medium">
                Operasyon başlatma veya tamamlama kaydı
              </p>
            </div>
          </div>
          {operator && (
            <button
              onClick={() => resetForm(true)}
              className="px-2.5 py-1.5 bg-secondary hover:bg-destructive hover:text-white text-muted-foreground rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
              title="Operatörü Sıfırla"
            >
              <RotateCcw size={13} />
              <span>Sıfırla</span>
            </button>
          )}
        </div>

        {/* 1. OPERATÖR NFC / KART OKUTMA */}
        <div className="space-y-1.5 xl:space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Scan size={14} className="text-indigo-500" />
            1. Operatör NFC / Kart
          </label>

          {!operator ? (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Barcode
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={16}
                />
                <input
                  ref={operatorInputRef}
                  type="text"
                  autoComplete="off"
                  placeholder="NFC KARTINI OKUTUN..."
                  value={operatorInput}
                  onChange={(e) => setOperatorInput(e.target.value)}
                  onKeyDown={handleOperatorKeyDown}
                  disabled={isFetchingOperator}
                  className="w-full pl-10 pr-3 py-2.5 bg-secondary/60 border border-border rounded-xl font-mono text-sm font-bold text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground focus:ring-1 focus:ring-foreground transition-all uppercase"
                />
              </div>
              <button
                onClick={() => handleFetchOperator()}
                disabled={isFetchingOperator || !operatorInput.trim()}
                className="px-4 py-2.5 bg-foreground text-background hover:opacity-90 disabled:opacity-40 rounded-xl font-bold text-xs tracking-wider uppercase transition-all cursor-pointer shrink-0"
              >
                {isFetchingOperator ? "..." : "Okut"}
              </button>
            </div>
          ) : (
            <div className="p-2.5 xl:p-3 bg-secondary/80 border border-border rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5 xl:gap-3">
                <div className="w-8 h-8 xl:w-9 xl:h-9 rounded-lg bg-foreground text-background font-bold text-xs xl:text-sm flex items-center justify-center">
                  {operator.name?.[0] || "O"}
                </div>
                <div className="text-xs sm:text-sm font-black text-foreground uppercase">
                  {operator.name} {operator.surname}
                </div>
              </div>
              <span className="text-[10px] xl:text-[11px] font-bold px-2 py-0.5 bg-emerald-600 text-white rounded-md">
                Aktif
              </span>
            </div>
          )}
        </div>

        {/* 2. PARTİ NO & 3. ALT PARTİ (Tablette yan yana kompakt, Desktopta alt alta orijinal) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-3.5 xl:gap-6">
          {/* 2. PARTİ NO */}
          <div className="space-y-1.5 xl:space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Hash size={14} />
                2. Parti No
              </label>
              {partiNo && (
                <button
                  type="button"
                  onClick={() => setPartiNo("")}
                  className="text-[10px] xl:text-[11px] font-bold text-muted-foreground hover:text-destructive px-1.5 py-0.5 cursor-pointer"
                >
                  Temizle
                </button>
              )}
            </div>

            <div className="w-full xl:max-w-xs">
              <input
                ref={partiInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                placeholder="Örn: 104250"
                value={partiNo}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setPartiNo(val);
                }}
                onKeyDown={handlePartiKeyDown}
                disabled={!operator}
                className={cn(
                  "w-full h-11 xl:h-auto px-3.5 py-2.5 bg-secondary/60 border border-border rounded-xl font-mono text-base font-black text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground focus:ring-1 focus:ring-foreground transition-all",
                  !operator && "opacity-40 cursor-not-allowed"
                )}
              />
            </div>
          </div>

          {/* 3. ALT PARTİ SEÇİMİ (1, 2, 3, 4) */}
          <div className="space-y-1.5 xl:space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Layers size={14} />
                3. Alt Parti Seçimi
              </label>
              {altParti && (
                <span className="text-[10px] xl:text-[11px] font-mono font-bold px-1.5 py-0.5 bg-secondary border border-border rounded text-foreground">
                  Seçilen: {altParti}
                </span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2 xl:gap-2.5">
              {["1", "2", "3", "4"].map((ap) => {
                const isSelected = altParti === ap;
                const isDisabled = !operator || !partiNo.trim();

                return (
                  <button
                    key={ap}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => setAltParti(ap)}
                    className={cn(
                      "h-11 xl:h-auto xl:py-4 px-3 rounded-xl border text-center font-black text-base xl:text-lg uppercase transition-all select-none cursor-pointer flex items-center justify-center active:scale-95 shadow-xs",
                      isDisabled && "opacity-40 cursor-not-allowed pointer-events-none",
                      isSelected
                        ? "bg-foreground text-background border-foreground shadow-md scale-[1.03]"
                        : "bg-secondary/60 border-border text-foreground hover:bg-secondary"
                    )}
                  >
                    {ap}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4. İŞLEM SEÇİMİ (Tambır, Çt1, Kurutma, Eritme) */}
        <div className="space-y-1.5 xl:space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Activity size={14} />
              4. İşlem Seçimi
            </label>
            {selectedIslem && (
              <span className="text-[10px] xl:text-[11px] font-mono font-bold px-2 py-0.5 bg-secondary border border-border rounded text-foreground">
                Seçilen: {ISLEMLER.find((i) => i.id === selectedIslem)?.label || selectedIslem}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 xl:gap-2.5">
            {ISLEMLER.map((islem) => {
              const isSelected = selectedIslem === islem.id;
              const isDisabled = !operator || !partiNo.trim() || !altParti.trim();

              return (
                <button
                  key={islem.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => setSelectedIslem(islem.id)}
                  className={cn(
                    "h-11 xl:h-auto xl:py-4 px-2 rounded-xl border text-center font-black text-xs sm:text-sm uppercase transition-all select-none cursor-pointer flex xl:flex-col items-center justify-center gap-1.5 xl:gap-1 active:scale-95 shadow-xs",
                    isDisabled && "opacity-40 cursor-not-allowed pointer-events-none",
                    isSelected
                      ? "bg-foreground text-background border-foreground shadow-md scale-[1.02] xl:scale-[1.03]"
                      : "bg-secondary/60 border-border text-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <span className="text-[11px] xl:text-xs font-mono opacity-60">#{islem.id}</span>
                  <span>{islem.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. OPERASYON BUTONLARI (BAŞLA / BİTİR) */}
        <div className="pt-2.5 xl:pt-3 border-t border-border flex items-center gap-3">
          {/* BAŞLA BUTONU (Solid Green) */}
          <button
            onClick={() => handleOperationSubmit(PARTI_ACTION_TYPES.BASLA)}
            disabled={!isFormValid || isSubmitting}
            className={cn(
              "flex-1 py-3.5 sm:py-4 xl:py-5 px-4 rounded-xl font-black text-base sm:text-lg uppercase tracking-wider flex items-center justify-center gap-2 xl:gap-2.5 transition-all select-none shadow-md",
              isFormValid && !isSubmitting
                ? "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95 shadow-emerald-950/20"
                : "bg-secondary text-muted-foreground/40 border border-border cursor-not-allowed"
            )}
          >
            <Play size={20} className="fill-current" />
            <span>{isSubmitting ? "KAYDEDİLİYOR..." : "BAŞLA"}</span>
          </button>

          {/* BİTİR BUTONU (Solid Red) */}
          <button
            onClick={() => handleOperationSubmit(PARTI_ACTION_TYPES.BITIR)}
            disabled={!isFormValid || isSubmitting}
            className={cn(
              "flex-1 py-3.5 sm:py-4 xl:py-5 px-4 rounded-xl font-black text-base sm:text-lg uppercase tracking-wider flex items-center justify-center gap-2 xl:gap-2.5 transition-all select-none shadow-md",
              isFormValid && !isSubmitting
                ? "bg-red-600 hover:bg-red-500 text-white cursor-pointer active:scale-95 shadow-red-950/20"
                : "bg-secondary text-muted-foreground/40 border border-border cursor-not-allowed"
            )}
          >
            <Square size={20} className="fill-current" />
            <span>{isSubmitting ? "KAYDEDİLİYOR..." : "BİTİR"}</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. GİRİLEN KAYITLAR TABLOSU (Tablette Altta, Desktopta Sağ 7 Kolon) */}
      {/* ========================================================= */}
      <div className="xl:col-span-7 bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-3 min-h-[420px] xl:h-[calc(100vh-6.5rem)] xl:min-h-[550px] overflow-hidden">
        
        {/* TABLO BAŞLIĞI */}
        <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-secondary text-foreground rounded-lg border border-border">
              <Clock size={16} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase tracking-tight text-foreground flex items-center gap-2">
                Girilen Parti Hareketleri
                <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-secondary text-foreground font-bold border border-border">
                  {totalCount} Kayıt
                </span>
              </h2>
              <p className="text-[11px] text-muted-foreground font-medium">
                Veritabanında kayıtlı parti işlemleri
              </p>
            </div>
          </div>

          <button
            onClick={() => refetchLogs()}
            disabled={isFetchingLogs}
            className="px-3 py-1.5 bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Kayıtları Yenile"
          >
            <RotateCcw size={13} className={isFetchingLogs ? "animate-spin" : ""} />
            <span>Yenile</span>
          </button>
        </div>

        {/* TABLO İÇERİĞİ (Scrollable Area) */}
        {isLoadingLogs ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <Loader2 size={32} className="animate-spin text-foreground mb-3" />
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Kayıtlar Yükleniyor...
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-xl my-auto">
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground mb-3 border border-border">
              <ListFilter size={24} />
            </div>
            <div className="text-sm font-bold text-foreground">
              Henüz Kayıt Bulunamadı
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Sol taraftaki formu doldurup <strong>BAŞLA</strong> veya <strong>BİTİR</strong> butonuna bastığınızda işlemler burada listelenecektir.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar border border-border rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-secondary sticky top-0 z-10 border-b border-border shadow-xs">
                <tr className="text-foreground uppercase font-black tracking-wider text-[11px]">
                  <th className="py-3.5 px-3">Tarih</th>
                  <th className="py-3.5 px-3">Saat</th>
                  <th className="py-3.5 px-3">Operatör</th>
                  <th className="py-3.5 px-3">Parti No</th>
                  <th className="py-3.5 px-3">Alt Parti</th>
                  <th className="py-3.5 px-3">İşlem</th>
                  <th className="py-3.5 px-3 text-right">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => {
                  const recDate = new Date(log.record_date || log.createdAt);
                  const dateStr = recDate.toLocaleDateString("tr-TR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  });
                  const timeStr = recDate.toLocaleTimeString("tr-TR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });

                  const actionTypeNum = Number(log.action_type);

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-muted/30 transition-colors font-medium"
                    >
                      <td className="py-3.5 px-3 font-mono text-muted-foreground font-bold whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-muted-foreground font-bold whitespace-nowrap">
                        {timeStr}
                      </td>
                      <td className="py-3.5 px-3 font-bold text-foreground whitespace-nowrap">
                        {log.operator_name || "Operatör"}
                      </td>
                      <td className="py-3.5 px-3 font-mono font-black text-foreground whitespace-nowrap">
                        #{log.parti_no}
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-foreground whitespace-nowrap">
                        {log.alt_parti}
                      </td>
                      <td className="py-3.5 px-3 font-bold text-foreground whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-secondary border border-border font-bold">
                          {log.islem_label || `İşlem ${log.islem_id}`}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        {actionTypeNum === PARTI_ACTION_TYPES.BASLA || String(log.action_type) === "BASLA" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-xs">
                            <Play size={10} className="fill-current" />
                            {log.action_label || "BAŞLADI"}
                          </span>
                        ) : actionTypeNum === PARTI_ACTION_TYPES.BITIR || String(log.action_type) === "BITIR" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-red-600 text-white shadow-xs">
                            <Square size={10} className="fill-current" />
                            {log.action_label || "BİTTİ"}
                          </span>
                        ) : actionTypeNum === PARTI_ACTION_TYPES.DURDUR ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-amber-600 text-white shadow-xs">
                            {log.action_label || "DURDURULDU"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-zinc-600 text-white shadow-xs">
                            {log.action_label || `Durum ${log.action_type}`}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ========================================================= */}
        {/* PAGINATION (SAYFALAMA ÇUBUĞU) */}
        {/* ========================================================= */}
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
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-[11px]">Satır:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-secondary text-foreground font-bold text-xs px-2 py-1 rounded-lg border border-border focus:outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Sayfa Numarası */}
            <div className="font-bold text-foreground px-2">
              Sayfa {page} / {totalPages}
            </div>

            {/* Butonlar */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page <= 1 || isFetchingLogs}
                className="p-1.5 bg-secondary hover:bg-muted text-foreground rounded-lg border border-border disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="İlk Sayfa"
              >
                <ChevronsLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1 || isFetchingLogs}
                className="p-1.5 bg-secondary hover:bg-muted text-foreground rounded-lg border border-border disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Önceki Sayfa"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages || isFetchingLogs}
                className="p-1.5 bg-secondary hover:bg-muted text-foreground rounded-lg border border-border disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Sonraki Sayfa"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages || isFetchingLogs}
                className="p-1.5 bg-secondary hover:bg-muted text-foreground rounded-lg border border-border disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Son Sayfa"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
