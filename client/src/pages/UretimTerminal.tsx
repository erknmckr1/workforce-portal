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
import { useAuthStore } from "../store/authStore";
import KioskPage from "./KioskPage";
import { useModuleStore } from "../store/moduleStore";
import type { MesProcess, SapOrder, WorkLog } from "../types/mes";
import { toast } from "sonner";

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
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [isKioskOpen, setIsKioskOpen] = useState(false);
  const [isFoodMenuOpen, setIsFoodMenuOpen] = useState(false);
  const { closePopup } = useModuleStore();
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(
    null,
  );
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchOrderId, setSearchOrderId] = useState("");

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
      if (!selectedProcessId) {
        toast.error("LÜTFEN ÖNCE YAPACAĞINIZ İŞLEMİ (PROSES) SEÇİNİZ!");
        setSearchOrderId("");
        return;
      }

      // Önce SAP'den siparişi sorgula
      const result = await fetchOrder();

      if (result.data) {
        // Sipariş bulunduysa ve proses seçiliyse, OTOMATİK İŞ BAŞLAT
        const selectedProcess = processes?.find(
          (p) => p.process_id === selectedProcessId,
        );

        startWorkMutation.mutate({
          operator_id: user?.id_dec,
          order_no: searchOrderId,
          section_id: section,
          area_name: areaName,
          process_id: selectedProcessId,
          process_name: selectedProcess?.process_name,
        });
      } else {
        // Sipariş SAP'de yoksa
        toast.error("Böyle bir sipariş numarası bulunamadı!");
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

  const { data: workLogs } = useQuery<WorkLog[]>({
    queryKey: ["workLogs", areaName],
    queryFn: async () => {
      if (!areaName) return [];
      const res = await apiClient.get(`/mes/work-logs?areaName=${areaName}`);
      return res.data;
    },
    enabled: isAuthenticated && !!areaName,
  });

  //* Backend'den gelen WorkLog verisini Tablo formatına (Job) çeviriyoruz
  const activeJobs: Job[] =
    workLogs?.map((log: WorkLog) => ({
      id: String(log.id),
      operatorId: log.operator_id,
      operatorName: log.operator_id, // TODO: Operatör ismi eklenebilir
      orderId: log.order_no,
      oldCode: "-",
      processId: log.process_id,
      section: log.area_name,
      process: log.process_name,
      quantity: "-",
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
        selectedJob={selectedJob}
        onJobDeselect={() => setSelectedJob(null)}
      />

      <StopWorkModal
        isOpen={isStopModalOpen}
        onClose={() => setIsStopModalOpen(false)}
        selectedJob={selectedJob}
        onJobDeselect={() => setSelectedJob(null)}
      />
      <FoodMenuModal 
        isOpen={isFoodMenuOpen}
        onClose={() => setIsFoodMenuOpen(false)}
      />

      <TerminalHeader
        areaName={areaName}
        section={section}
        searchOrderId={searchOrderId}
        setSearchOrderId={setSearchOrderId}
        handleSearch={handleSearch}
        isSearching={isSearching}
        currentTime={currentTime}
      />

      {/* MAIN LAYOUT */}
      <div className="flex flex-1 overflow-hidden relative">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />

        <TerminalLeftSide
          operator={user}
          onLogout={handleLogout}
          onOpenKiosk={() => setIsKioskOpen(true)}
          onOpenFoodMenu={() => setIsFoodMenuOpen(true)}
        />

        <main className="flex-1 flex flex-col relative z-10">
          <div className="h-[65%] flex">
            <TerminalJobTable
              jobs={activeJobs}
              selectedJob={selectedJob}
              onSelectJob={setSelectedJob}
            />
            <TerminalRightSide
              selectedJob={selectedJob}
              onJobDeselect={() => setSelectedJob(null)}
              onOpenFinishModal={() => setIsFinishModalOpen(true)}
              onOpenStopModal={() => setIsStopModalOpen(true)}
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
                <div className="flex-1 flex items-center justify-center text-muted-foreground/50 font-bold text-xs uppercase tracking-tighter">
                  Mola Verisi Yok
                </div>
              </div>
            </div>

            <div className="w-[50%] p-4">
              <div className="w-full h-full bg-secondary/20 border border-border rounded-xl flex flex-col overflow-hidden">
                <div className="bg-secondary/80 p-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center border-b border-border">
                  İşlem (Proses) Seçimi
                </div>
                <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-border">
                  {isFetchingProcesses ? (
                    <div className="h-full flex items-center justify-center text-xs animate-pulse text-muted-foreground">
                      Prosesler yükleniyor...
                    </div>
                  ) : processes && processes.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {processes.map((proc) => (
                        <button
                          key={proc.process_id}
                          onClick={() => setSelectedProcessId(proc.process_id)}
                          className={`p-3 rounded-lg border text-left transition-all ${
                            selectedProcessId === proc.process_id
                              ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                              : "bg-background/50 border-border hover:border-primary/50 text-muted-foreground"
                          }`}
                        >
                          <div className="text-lg font-black leading-tight">
                            {proc.process_name}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground/40 font-bold text-sm italic">
                      Bu bölüm için proses bulunamadı.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default UretimTerminal;
