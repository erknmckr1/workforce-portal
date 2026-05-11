import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import apiClient from "../lib/api";
import TerminalLeftSide from "../components/terminal/TerminalLeftSide";
import TerminalRightSide from "../components/terminal/TerminalRightSide";
import TerminalJobTable from "../components/terminal/TerminalJobTable";
import type { Job } from "../components/terminal/TerminalJobTable";
import TerminalHeader from "../components/terminal/TerminalHeader";
import TerminalLoginModal from "../components/terminal/TerminalLoginModal";
import FinishWorkModal from "../components/terminal/FinishWorkModal";
import StopWorkModal from "../components/terminal/StopWorkModal";
import FoodMenuModal from "../components/terminal/FoodMenuModal";
import BreakModal from "../components/terminal/BreakModal";
import ProductImageModal from "../components/terminal/ProductImageModal";
import FirePopup from "../components/terminal/FirePopup";
import MeasurementPopup from "../components/terminal/MeasurementPopup";
import OperatorIdModal from "../components/terminal/OperatorIdModal";
import { useAuthStore } from "../store/authStore";
import KioskPage from "./KioskPage";
import { useModuleStore } from "../store/moduleStore";
import type {
  MesProcess,
  SapOrder,
  WorkLog,
  OperatorBreak,
  MesMachine,
} from "../types/mes";
import { toast } from "sonner";
import { RotateCw } from "lucide-react";
import ShiftRunner from "../components/game/ShiftRunner";

const UretimTerminal = () => {
  const { section, areaName } = useParams<{
    section: string;
    areaName: string;
  }>();

  const {
    user,
    isAuthenticated,
    login: globalLogin,
    logout: globalLogout,
  } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [isKioskOpen, setIsKioskOpen] = useState(false);
  const [isFoodMenuOpen, setIsFoodMenuOpen] = useState(false);
  const [isBreakModalOpen, setIsBreakModalOpen] = useState(false);
  const [isProductImageModalOpen, setIsProductImageModalOpen] = useState(false);
  const [isFireModalOpen, setIsFireModalOpen] = useState(false);
  const [isMeasurementModalOpen, setIsMeasurementModalOpen] = useState(false);
  const { closePopup } = useModuleStore();
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(
    null,
  );
  const [selectedMachineName, setSelectedMachineName] = useState<string | null>(
    null,
  );
  const [isGameOpen, setIsGameOpen] = useState(false);
  const [activeOperatorId, setActiveOperatorId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchOrderId, setSearchOrderId] = useState("");

  const [operatorIdModalOpen, setOperatorIdModalOpen] = useState(false);
  const [pendingOperatorAction, setPendingOperatorAction] = useState<{
    resolve: (id: string) => void;
    reject: (reason?: unknown) => void;
    skipBreakCheck?: boolean;
  } | null>(null);

  // Ekran bireysel mi ortak mı kontrolü
  const requireOperatorAuth = async (options?: {
    skipBreakCheck?: boolean;
  }): Promise<string> => {
    if (areaName !== "buzlama" && areaName !== "kurutiras") {
      return user?.id_dec || "SYSTEM";
    }

    setOperatorIdModalOpen(true);
    return new Promise((resolve, reject) => {
      setPendingOperatorAction({
        resolve,
        reject,
        skipBreakCheck: options?.skipBreakCheck,
      });
    });
  };

  const handleOperatorIdSubmit = async (id: string) => {
    try {
      const res = await apiClient.get(`/mes/operator/${id}`);
      const operator = res.data;

      // Eğer mola kontrolünü atlamıyorsak ve kullanıcı moladaysa engelle
      if (operator.isOnBreak && !pendingOperatorAction?.skipBreakCheck) {
        toast.error(
          "Moladayken işlem yapamazsınız. Lütfen önce molanızı bitirin.",
        );
        return;
      }

      if (pendingOperatorAction) pendingOperatorAction.resolve(id);
      setPendingOperatorAction(null);
      setOperatorIdModalOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Geçersiz Operatör ID!");
    }
  };

  const handleOperatorIdClose = () => {
    if (pendingOperatorAction)
      pendingOperatorAction.reject(new Error("İşlem iptal edildi"));
    setPendingOperatorAction(null);
    setOperatorIdModalOpen(false);
  };

  const handleSelectJob = (jobId: string) => {
    if (areaName === "buzlama" || areaName === "kurutiras") {
      setSelectedJobs((prev) =>
        prev.includes(jobId)
          ? prev.filter((id) => id !== jobId)
          : [...prev, jobId],
      );
    } else {
      setSelectedJobs([jobId]);
    }
  };

  //! Mola Başlatma Mutasyonu
  const startBreakMutation = useMutation({
    mutationFn: async (breakData: {
      operator_id: string;
      break_reason: string;
      area_name?: string;
    }) => {
      const res = await apiClient.post("/mes/start-break", breakData);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Mola başlatıldı! Aktif işleriniz duraklatıldı.");
      setIsBreakModalOpen(false); // Modal'ı kapat
      queryClient.invalidateQueries({ queryKey: ["activeBreaks"] });
      queryClient.invalidateQueries({ queryKey: ["workLogs"] });
    },
    onError: (error: AxiosError<{ message: string }>) => {
      toast.error(error.response?.data?.message || "Mola başlatılamadı.");
    },
  });

  //! Moladan Dönüş Mutasyonu
  const endBreakMutation = useMutation({
    mutationFn: async (operatorId: string) => {
      const res = await apiClient.post("/mes/end-break", {
        operator_id: operatorId,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Moladan dönüldü! İşleriniz tekrar başlatıldı.");
      queryClient.invalidateQueries({ queryKey: ["activeBreaks"] });
      queryClient.invalidateQueries({ queryKey: ["workLogs"] });
    },
    onError: (error: AxiosError<{ message: string }>) => {
      toast.error(error.response?.data?.message || "Moladan dönülemedi.");
    },
  });

  // Saat güncelleme
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  //! SAP Sipariş Sorgulama (TanStack Query)
  const { isFetching: isSearching, refetch: fetchOrder } =
    useQuery<SapOrder | null>({
      queryKey: ["sap-order", searchOrderId],
      queryFn: async () => {
        if (!searchOrderId) return null;
        const res = await apiClient.get(`/mes/order/${searchOrderId}`);
        return res.data;
      },
      enabled: false, // fonksiyonu elle çağırmak için false yapıyoruz. searchOrderId değiştiğinde otomatik çalışmaz.
    });

  //! İş Başlatma (TanStack Query Mutation)
  const startWorkMutation = useMutation({
    mutationFn: async (workData: Record<string, unknown>) => {
      const res = await apiClient.post("/mes/start-work", workData);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success("İş başarıyla başlatıldı!");
      console.log(data);
      setSearchOrderId(""); // Barkod inputunu bir sonraki okutma için temizle

      // İşlem bitince aktif işler tablosunu otomatik yenile!
      queryClient.invalidateQueries({ queryKey: ["workLogs", areaName] });
    },
    onError: (error: AxiosError<{ message: string }>) => {
      toast.error(
        error.response?.data?.message || "İş başlatılırken hata oluştu!",
      );
      setSearchOrderId(""); // Hata olsa da inputu temizle
    },
  });

  const handleSearch = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchOrderId) {
      if (isOnBreak) {
        toast.error("Moladayken iş başlatamazsınız!");
        setSearchOrderId("");
        return;
      }
      if (!selectedProcessId) {
        toast.error("LÜTFEN ÖNCE YAPACAĞINIZ İŞLEMİ (PROSES) SEÇİNİZ!");
        setSearchOrderId("");
        return;
      }

      const selectedProcess = processes?.find(
        (p) => p.process_id === selectedProcessId,
      );

      // Makine seçimi zorunlu mu kontrolü (buzlama için zorunlu)
      const requiresMachine =
        machines &&
        machines.length > 0 &&
        machines.some((m) => m.process_name === selectedProcess?.process_name);
      if (requiresMachine && !selectedMachineName) {
        toast.error("BU İŞLEM İÇİN BİR MAKİNE SEÇMENİZ GEREKMEKTEDİR!");
        setSearchOrderId("");
        return;
      }

      try {
        // OPERATOR ID SORGUSU
        const operatorId = await requireOperatorAuth();

        // Önce SAP'den siparişi sorgula
        const result = await fetchOrder();

        if (result.data) {
          // Sipariş bulunduysa ve proses seçiliyse, OTOMATİK İŞ BAŞLAT
          startWorkMutation.mutate({
            operator_id: operatorId,
            order_no: searchOrderId,
            section_id: section,
            area_name: areaName,
            process_id: selectedProcessId,
            process_name: selectedProcess?.process_name,
            machine_name: selectedMachineName,
            material_no: result.data.MATERIAL_NO,
          });
        } else {
          // Sipariş SAP'de yoksa
          toast.error("Böyle bir sipariş numarası bulunamadı!");
          setSearchOrderId("");
        }
      } catch {
        // Kullanıcı pop-up'ı kapattı veya bir hata oldu
        console.log("İşlem iptal edildi");
        setSearchOrderId("");
      }
    }
  };

  const handleLoginSuccess = (userData: Parameters<typeof globalLogin>[0]) => {
    // Burada any yerine globalLogin'in beklediği parametre tipini kullanıyoruz
    globalLogin(userData);
  };

  const handleLogout = () => {
    globalLogout();
  };

  //! process listesini cekecek query
  const { isFetching: isFetchingProcesses, data: processes } = useQuery<
    MesProcess[]
  >({
    queryKey: ["processes", areaName],
    queryFn: async () => {
      if (!areaName) return [];
      const res = await apiClient.get(`/mes/processes?areaName=${areaName}`);
      return res.data;
    },
  });

  //! machine listesini cekecek query
  const { data: machines } = useQuery<MesMachine[]>({
    queryKey: ["machines", areaName],
    queryFn: async () => {
      if (!areaName) return [];
      const res = await apiClient.get(`/mes/machines?area_name=${areaName}`);
      return res.data;
    },
    enabled: !!areaName,
  });

  // Seçili prosese ait makineleri filtrele
  const selectedProcessDetails = processes?.find(
    (p) => p.process_id === selectedProcessId,
  );
  const filteredMachines =
    machines?.filter(
      (m) => m.process_name === selectedProcessDetails?.process_name,
    ) || [];

  const { data: workLogs } = useQuery<WorkLog[]>({
    queryKey: [
      "workLogs",
      areaName,
      (areaName === "buzlama" || areaName === "kurutiras") ? "ALL" : user?.id_dec,
    ],
    queryFn: async () => {
      if (!areaName) return [];
      const operatorParam =
        (areaName === "buzlama" || areaName === "kurutiras") ? "" : `&operatorId=${user?.id_dec}`;
      const res = await apiClient.get(
        `/mes/work-logs?areaName=${areaName}${operatorParam}`,
      );
      return res.data;
    },
    enabled: isAuthenticated && !!areaName,
  });

  //! Aktif Molaları Çekecek Query
  const { data: activeBreaks } = useQuery<OperatorBreak[]>({
    queryKey: ["activeBreaks", areaName],
    queryFn: async () => {
      const res = await apiClient.get(
        `/mes/active-breaks?areaName=${areaName}`,
      );
      return res.data;
    },
    refetchInterval: 30000, // 30 saniyede bir otomatik yenile
    enabled: isAuthenticated,
  });

  //! Aktif Operatör Bilgilerini Çekecek Query (Mola vb. durumlar için)
  const { data: activeOperatorInfo } = useQuery({
    queryKey: ["operator", activeOperatorId],
    queryFn: async () => {
      if (!activeOperatorId) return null;
      const res = await apiClient.get(`/mes/operator/${activeOperatorId}`);
      return res.data;
    },
    enabled: !!activeOperatorId,
  });

  //? Mevcut kullanıcının molada olup olmadığını saptıyoruz
  // Buzlama ve Kuru Tıraş terminalinde butonların mola yüzünden kilitlenmesini istemiyoruz, 
  // çünkü bir kişinin molaya çıkması diğerlerini engellememeli.
  const isOnBreak = (areaName === "buzlama" || areaName === "kurutiras")
    ? false 
    : !!activeBreaks?.some((b: OperatorBreak) => {
        return String(b.operator_id) === String(user?.id_dec);
      });

  //* Backend'den gelen WorkLog verisini Tablo formatına (Job) çeviriyoruz
  const activeJobs: Job[] =
    workLogs?.map((log: WorkLog) => ({
      id: String(log.id),
      operatorId: log.operator_id,
      operatorName: log.Operator
        ? `${log.Operator.name} ${log.Operator.surname}`
        : log.operator_id,
      orderId: log.order_no,
      oldCode: "-",
      processId: log.process_id,
      section: log.area_name,
      process: log.process_name,
      quantity: "-",
      materialNo: log.material_no,
      status: log.status,
      statusName: log.StatusDetail?.name || "Bilinmiyor",
      statusColor: log.StatusDetail?.color_code || "#6b7280", // Gri (Varsayılan)
    })) || [];

  return (
    <div className="h-screen w-screen bg-background text-foreground flex flex-col overflow-hidden font-sans select-none">
      {/* Kiosk Overlay */}
      {isKioskOpen && (
        <div className="fixed inset-0 z-100 animate-in fade-in duration-300">
          <KioskPage />
          {/* Kiosk'u kapatmak için bir çıkış butonu ekliyoruz */}
          <button
            onClick={() => {
              setIsKioskOpen(false);
              closePopup();
            }}
            className="fixed top-2 right-0 z-110 bg-destructive text-destructive-foreground px-6 py-3 rounded-xl font-black uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all"
          >
            Terminal'e Dön
          </button>
        </div>
      )}

      {/* Login Modal Overlay */}
      {!isAuthenticated && (
        <TerminalLoginModal onLoginSuccess={handleLoginSuccess} />
      )}

      <FinishWorkModal
        isOpen={isFinishModalOpen}
        onClose={() => setIsFinishModalOpen(false)}
        selectedJob={selectedJobs[0] || null}
        onJobDeselect={() => setSelectedJobs([])}
        operatorId={activeOperatorId || undefined}
      />

      <StopWorkModal
        isOpen={isStopModalOpen}
        onClose={() => setIsStopModalOpen(false)}
        selectedJobs={selectedJobs}
        onJobDeselect={() => setSelectedJobs([])}
        operatorId={activeOperatorId || undefined}
      />
      <FoodMenuModal
        isOpen={isFoodMenuOpen}
        onClose={() => setIsFoodMenuOpen(false)}
      />

      <BreakModal
        isOpen={isBreakModalOpen}
        onClose={() => setIsBreakModalOpen(false)}
        operator={
          activeOperatorInfo
            ? { 
                id_dec: activeOperatorInfo.id_dec, 
                full_name: `${activeOperatorInfo.name} ${activeOperatorInfo.surname}` 
              }
            : user
            ? { id_dec: user.id_dec, full_name: `${user.name} ${user.surname}` }
            : null
        }
        onConfirm={(reason) => {
          const targetOpId = activeOperatorId || user?.id_dec;
          if (targetOpId) {
            startBreakMutation.mutate({
              operator_id: targetOpId,
              break_reason: reason,
              area_name: areaName, // Hangi terminalden mola verildiği bilgisini gönderiyoruz
            });
          }
        }}
      />

      <TerminalHeader
        areaName={areaName}
        section={section}
        searchOrderId={searchOrderId}
        setSearchOrderId={setSearchOrderId}
        handleSearch={handleSearch}
        isSearching={isSearching}
        currentTime={currentTime}
        externalId={user?.external_id}
        isOnBreak={isOnBreak}
        onLogoClick={() => setIsGameOpen(true)}
      />

      {isGameOpen && (
        <ShiftRunner
          onClose={() => setIsGameOpen(false)}
          operatorId={user?.id_dec}
        />
      )}

      {/* MAIN LAYOUT */}
      <div className="flex flex-1 overflow-hidden relative">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />

        <TerminalLeftSide
          operator={user}
          onLogout={handleLogout}
          onOpenKiosk={() => setIsKioskOpen(true)}
          onOpenFoodMenu={() => setIsFoodMenuOpen(true)}
          onOpenBreak={async () => {
            try {
              const opId = await requireOperatorAuth();
              setActiveOperatorId(opId);
              setIsBreakModalOpen(true);
            } catch {
              console.log("Mola başlatma iptal edildi");
            }
          }}
          onEndBreak={async () => {
            try {
              const opId = await requireOperatorAuth({ skipBreakCheck: true });
              endBreakMutation.mutate(opId);
            } catch {
              console.log("Moladan dönüş iptal edildi");
            }
          }}
        />

        <main className="flex-1 flex flex-col relative z-10">
          <div className="h-[65%] flex">
            <TerminalJobTable
              jobs={activeJobs}
              selectedJobs={selectedJobs}
              onSelectJob={handleSelectJob}
            />
            <TerminalRightSide
              selectedJobs={selectedJobs}
              onJobDeselect={() => setSelectedJobs([])}
              onOpenFinishModal={(opId: string) => { setActiveOperatorId(opId || null); setIsFinishModalOpen(true); }}
              onOpenStopModal={(opId: string) => { setActiveOperatorId(opId || null); setIsStopModalOpen(true); }}
              onOpenProductImage={() => setIsProductImageModalOpen(true)}
              onOpenFireModal={(opId: string) => { setActiveOperatorId(opId || null); setIsFireModalOpen(true); }}
              onOpenMeasurementModal={(opId: string) => { setActiveOperatorId(opId || null); setIsMeasurementModalOpen(true); }}
              isOnBreak={isOnBreak}
              requireOperatorAuth={requireOperatorAuth}
            />
          </div>

          {/* BOTTOM SECTION */}
          <div className="h-[35%] flex bg-card border-t border-border">
            <div className="w-[50%] p-4 border-r border-border">
              <div className="w-full h-full bg-secondary/20 border border-border rounded-xl overflow-hidden flex flex-col">
                <div className="bg-secondary/80 p-2 flex text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  <div className="flex-1 px-2">Operator</div>
                  <div className="w-24 text-center">Süre</div>
                  <div className="w-24 text-center">Durum</div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {activeBreaks && activeBreaks.length > 0 ? (
                    activeBreaks.map((mola: OperatorBreak) => {
                      const startTime = new Date(mola.start_date);
                      const diffInMin = Math.floor(
                        (currentTime.getTime() - startTime.getTime()) / 60000,
                      );

                      return (
                        <div
                          key={mola.id}
                          className="flex items-center p-3 border-b border-border/50 hover:bg-secondary/30 transition-colors"
                        >
                          <div className="flex-1 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-mds/20 flex items-center justify-center text-mds font-black text-xs">
                              {mola.Operator?.name?.[0]}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-black uppercase">
                                {mola.Operator?.name} {mola.Operator?.surname}
                              </span>
                              <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">
                                {mola.break_reason}
                              </span>
                            </div>
                          </div>
                          <div className="w-24 text-center font-mono text-xs font-black text-amber-500 tabular-nums">
                            {diffInMin} DK
                          </div>
                          <div className="w-24 flex justify-center">
                            <div className="bg-amber-500/10 text-amber-500 text-[9px] font-black px-2 py-1 rounded uppercase tracking-tighter border border-amber-500/20 animate-pulse">
                              Molada
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground/30 py-8">
                      <RotateCw size={48} className="opacity-10" />
                      <span className="font-black text-xs uppercase tracking-widest">
                        Mola Verisi Yok
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="w-[50%] p-4">
              <div className="w-full h-full bg-secondary/20 border border-border rounded-xl flex flex-col overflow-hidden">
                <div className="bg-secondary/80 p-0 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center border-b border-border flex">
                  <div
                    className={`flex-1 py-2 ${filteredMachines.length > 0 ? "border-r border-border" : ""}`}
                  >
                    İşlem (Proses) Seçimi
                  </div>
                  {filteredMachines.length > 0 && (
                    <div className="flex-1 py-2 text-info">Makine Seçimi</div>
                  )}
                </div>

                <div className="flex-1 flex overflow-hidden">
                  <div
                    className={`flex-1 overflow-y-auto p-2  ${filteredMachines.length > 0 ? "border-r border-border" : ""}`}
                  >
                    {isFetchingProcesses ? (
                      <div className="h-full flex items-center justify-center text-xs animate-pulse text-muted-foreground">
                        Prosesler yükleniyor...
                      </div>
                    ) : processes && processes.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {processes.map((proc) => (
                          <button
                            key={proc.process_id}
                            disabled={isOnBreak}
                            onClick={() => {
                              setSelectedProcessId(proc.process_id);
                              setSelectedMachineName(null); // Proses değişince makineyi sıfırla
                            }}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              selectedProcessId === proc.process_id
                                ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                                : "bg-background/50 border-border hover:border-primary/50 text-muted-foreground"
                            } ${isOnBreak ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
                          >
                            <div className="text-xl font-black leading-tight">
                              {proc.process_name}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground/40 font-bold text-sm italic">
                        Proses bulunamadı.
                      </div>
                    )}
                  </div>

                  {/* MAKİNE LİSTESİ */}
                  {filteredMachines.length > 0 && (
                    <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-border">
                      <div className="grid grid-cols-2 gap-2">
                        {filteredMachines.map((mach) => (
                          <button
                            key={mach.id}
                            disabled={isOnBreak}
                            onClick={() =>
                              setSelectedMachineName(mach.machine_name)
                            }
                            className={`p-3 rounded-lg border text-center transition-all ${
                              selectedMachineName === mach.machine_name
                                ? "bg-info border-info text-info-foreground shadow-lg shadow-info/20 scale-[1.02]"
                                : "bg-background/50 border-border hover:border-info/50 text-muted-foreground"
                            } ${isOnBreak ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
                          >
                            <div className="text-xl font-black leading-tight">
                              {mach.machine_name}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <ProductImageModal
        isOpen={isProductImageModalOpen}
        onClose={() => setIsProductImageModalOpen(false)}
      />

      {isFireModalOpen && areaName && (
        <FirePopup
          areaName={areaName}
          onClose={() => setIsFireModalOpen(false)}
          operatorId={activeOperatorId || undefined}
        />
      )}

      {isMeasurementModalOpen && areaName && (
        <MeasurementPopup
          areaName={areaName}
          onClose={() => setIsMeasurementModalOpen(false)}
          operatorId={activeOperatorId || undefined}
        />
      )}

      <OperatorIdModal
        isOpen={operatorIdModalOpen}
        onClose={handleOperatorIdClose}
        onSubmit={handleOperatorIdSubmit}
      />
    </div>
  );
};

export default UretimTerminal;
