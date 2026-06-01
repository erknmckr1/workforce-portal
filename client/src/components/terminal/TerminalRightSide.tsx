import {
  Play,
  Square,
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
  Calculator,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { AxiosError } from "axios";
import apiClient from "../../lib/api";
import { useConfirm } from "@/providers/ConfirmProvider";
import { useAuthStore } from "../../store/authStore";
import { toast } from "sonner";

import type { Job } from "./TerminalJobTable";

interface TerminalRightSideProps {
  jobs: Job[];
  selectedJobs: string[];
  onJobDeselect: () => void;
  onOpenFinishModal: (opId: string) => void;
  onOpenStopModal: (opId: string) => void;
  onOpenProductImage: () => void;
  onOpenFireModal: (opId: string) => void;
  onOpenMeasurementModal: (opId: string) => void;
  isOnBreak: boolean;
  updateSelectedJobs: (jobIds: string[]) => void;
  requireOperatorAuth?: (options?: { skipBreakCheck?: boolean; actionType?: "break" | "job" }) => Promise<string>;
}

const TerminalRightSide = ({
  jobs,
  selectedJobs,
  onJobDeselect,
  updateSelectedJobs,
  onOpenFinishModal,
  onOpenStopModal,
  onOpenProductImage,
  onOpenFireModal,
  onOpenMeasurementModal,
  isOnBreak,
  requireOperatorAuth,
}: TerminalRightSideProps) => {
  const { areaName } = useParams<{ areaName: string }>();
  const queryClient = useQueryClient();
  const { confirm } = useConfirm();
  const { user } = useAuthStore();

  const handleGuardedAction = async (
    actionFn: (opId: string) => void,
    options?: { skipBreakCheck?: boolean },
  ) => {
    try {
      const opId = requireOperatorAuth
        ? await requireOperatorAuth(options)
        : user?.id_dec || "SYSTEM";
      actionFn(opId);
    } catch {
      console.log("Kullanıcı işlemi iptal etti veya ID girmedi.");
    }
  };

  const cancelWorkMutation = useMutation({
    mutationFn: async (workData: Record<string, unknown>) => {
      const res = await apiClient.post("/mes/cancel-work", workData);
      return res.data;
    },
    onSuccess: () => {
      toast.success("İş başarıyla iptal edildi!");
      onJobDeselect();
      queryClient.invalidateQueries({ queryKey: ["workLogs", areaName] });
    },
    onError: (error: AxiosError<{ message: string }>) => {
      toast.error(
        error.response?.data?.message || "İş iptal edilirken hata oluştu!",
      );
    },
  });

  const handleCancelWork = async () => {
    if (selectedJobs.length === 0) {
      toast.error("Lütfen işlem yapmak için en az bir iş seçin!");
      return;
    }

    const eligibleJobs = selectedJobs.filter(
      (jobId) => {
        const status = jobs.find((j) => j.id === jobId)?.status;
        return status === 1 || status === 2 || status === 9; // İptal edilebilecek durumlar
      }
    );

    if (eligibleJobs.length === 0) {
      toast.error("Seçili işler arasında iptal edilebilecek uygun bir iş bulunamadı.");
      return;
    }

    const isConfirmed = await confirm({
      title: "İş İptali",
      description: eligibleJobs.length < selectedJobs.length
        ? `Seçtiğiniz ${selectedJobs.length} işin ${selectedJobs.length - eligibleJobs.length} adedi iptal edilmeye uygun değil. Sadece uygun olan ${eligibleJobs.length} adet işi iptal etmek istediğinize emin misiniz? Bu işlem geri alınamaz!`
        : `${eligibleJobs.length} adet işi iptal etmek istediğinize emin misiniz? Bu işlem geri alınamaz!`,
      confirmText: "Evet, İptal Et",
      cancelText: "Vazgeç",
      variant: "destructive",
    });

    if (isConfirmed) {
      if (eligibleJobs.length < selectedJobs.length) {
        updateSelectedJobs(eligibleJobs);
      }
      handleGuardedAction(async (opId) => {
        try {
          for (const jobId of eligibleJobs) {
            await cancelWorkMutation.mutateAsync({
              workLogId: jobId,
              operatorId: opId,
              cancelReasonId: 1, // Genel iptal nedeni
            });
          }
          toast.success("Uygun işler başarıyla iptal edildi!");
          onJobDeselect();
        } catch {
          // Hata
        }
      });
    }
  };

  const restartWorkMutation = useMutation({
    mutationFn: async (workData: Record<string, unknown>) => {
      const res = await apiClient.post("/mes/restart-work", workData);
      return res.data;
    },
    onSuccess: () => {
      toast.success("İş başarıyla yeniden başlatıldı!");
      onJobDeselect();
      queryClient.invalidateQueries({ queryKey: ["workLogs", areaName] });
    },
    onError: (error: AxiosError<{ message: string }>) => {
      toast.error(
        error.response?.data?.message || "İş başlatılırken hata oluştu!",
      );
    },
  });

  const handleRestartWork = async () => {
    if (selectedJobs.length === 0) {
      toast.error("Lütfen işlem yapmak için en az bir iş seçin!");
      return;
    }

    const eligibleJobs = selectedJobs.filter(
      (jobId) => {
        const status = jobs.find((j) => j.id === jobId)?.status;
        return status === 2 || status === 9; // Yeniden başlatılabilecek durumlar
      }
    );

    if (eligibleJobs.length === 0) {
      toast.error("Seçili işler arasında yeniden başlatılabilecek (durdurulmuş) bir iş bulunamadı.");
      return;
    }

    const isConfirmed = await confirm({
      title: "İşi Yeniden Başlat",
      description: eligibleJobs.length < selectedJobs.length
        ? `Seçtiğiniz ${selectedJobs.length} işin ${selectedJobs.length - eligibleJobs.length} adedi geçerli durumda değil. Sadece durdurulmuş olan ${eligibleJobs.length} iş yeniden başlatılacaktır. Devam edilsin mi?`
        : `${eligibleJobs.length} adet işi yeniden başlatmak istediğinize emin misiniz?`,
      confirmText: "Evet, Başlat",
      cancelText: "Vazgeç",
      variant: "success",
    });

    if (isConfirmed) {
      if (eligibleJobs.length < selectedJobs.length) {
        updateSelectedJobs(eligibleJobs);
      }
      handleGuardedAction(async (opId) => {
        try {
          for (const jobId of eligibleJobs) {
            await restartWorkMutation.mutateAsync({
              workLogId: jobId,
              operatorId: opId,
            });
          }
          toast.success("Uygun işler başarıyla başlatıldı!");
          onJobDeselect();
        } catch {
          // Hata
        }
      });
    }
  };

  const finishWorkMutation = useMutation({
    mutationFn: async (workData: Record<string, unknown>) => {
      const res = await apiClient.post("/mes/finish-work", workData);
      return res.data;
    },
    onSuccess: () => {
      toast.success("İş başarıyla tamamlandı!");
      onJobDeselect();
      queryClient.invalidateQueries({ queryKey: ["workLogs", areaName] });
    },
    onError: (error: AxiosError<{ message: string }>) => {
      toast.error(
        error.response?.data?.message || "İş sonlandırılırken hata oluştu!",
      );
    },
  });

  const handleFinishWork = async () => {
    if (selectedJobs.length === 0) {
      toast.error("Lütfen işlem yapmak için en az bir iş seçin!");
      return;
    }

    const eligibleJobs = selectedJobs.filter(
      (jobId) => jobs.find((j) => j.id === jobId)?.status === 1
    );

    if (eligibleJobs.length === 0) {
      toast.error("Seçili işler arasında bitirilebilecek (aktif) bir iş bulunamadı.");
      return;
    }

    if (areaName === "kalite") {
      if (eligibleJobs.length > 1) {
        toast.error("Kalite ekranında sadece tekli bitirme yapılabilir.");
        return;
      }
      if (eligibleJobs.length < selectedJobs.length) {
        toast.info(`Geçersiz olanlar atlandı. ${eligibleJobs.length} adet uygun iş işleme alındı.`);
        updateSelectedJobs(eligibleJobs);
      }
      handleGuardedAction((opId) => onOpenFinishModal(opId));
    } else {
      const isConfirmed = await confirm({
        title: "İşi Bitir",
        description: eligibleJobs.length < selectedJobs.length
          ? `Seçtiğiniz ${selectedJobs.length} işin ${selectedJobs.length - eligibleJobs.length} adedi aktif değil. Sadece aktif olan ${eligibleJobs.length} iş tamamlanacaktır. Devam edilsin mi?`
          : `${eligibleJobs.length} adet işi tamamlamak istediğinize emin misiniz?`,
        confirmText: "Evet, Bitir",
        cancelText: "Vazgeç",
        variant: "success",
      });
      if (isConfirmed) {
        if (eligibleJobs.length < selectedJobs.length) {
          updateSelectedJobs(eligibleJobs);
        }
        handleGuardedAction(async (opId) => {
          try {
            for (const jobId of eligibleJobs) {
              await finishWorkMutation.mutateAsync({
                work_log_id: jobId,
                operator_id: opId,
              });
            }
            toast.success("Uygun işler başarıyla tamamlandı!");
            onJobDeselect();
          } catch {
            // Hata
          }
        });
      }
    }
  };

  const startSetupMutation = useMutation({
    mutationFn: async (workData: { workIds: string[]; operator_id: string }) => {
      const res = await apiClient.post("/mes/start-setup", workData);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Setup başarıyla başlatıldı!");
      onJobDeselect();
      queryClient.invalidateQueries({ queryKey: ["workLogs", areaName] });
    },
    onError: (error: AxiosError<{ message: string }>) => {
      toast.error(error.response?.data?.message || "Setup başlatılırken hata oluştu!");
    },
  });

  const finishSetupMutation = useMutation({
    mutationFn: async (workData: { workIds: string[]; operator_id: string }) => {
      const res = await apiClient.post("/mes/finish-setup", workData);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Setup başarıyla bitirildi!");
      onJobDeselect();
      queryClient.invalidateQueries({ queryKey: ["workLogs", areaName] });
    },
    onError: (error: AxiosError<{ message: string }>) => {
      toast.error(error.response?.data?.message || "Setup bitirilirken hata oluştu!");
    },
  });

  const startProcessMutation = useMutation({
    mutationFn: async (workData: { workIds: string[]; operator_id: string }) => {
      const res = await apiClient.post("/mes/start-process", workData);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Proses başarıyla başlatıldı!");
      onJobDeselect();
      queryClient.invalidateQueries({ queryKey: ["workLogs", areaName] });
    },
    onError: (error: AxiosError<{ message: string }>) => {
      toast.error(error.response?.data?.message || "Proses başlatılırken hata oluştu!");
    },
  });

  const handleStartSetup = async () => {
    if (selectedJobs.length === 0) {
      toast.error("Lütfen işlem yapmak için en az bir iş seçin!");
      return;
    }
    const eligibleJobs = selectedJobs.filter((jobId) => jobs.find((j) => j.id === jobId)?.status === 0);
    if (eligibleJobs.length === 0) {
      toast.error("Seçili işler arasında Setup başlatılabilecek (Beklemede) bir iş bulunamadı.");
      return;
    }
    handleGuardedAction(async (opId) => {
      await startSetupMutation.mutateAsync({ workIds: eligibleJobs, operator_id: opId });
    });
  };

  const handleFinishSetup = async () => {
    if (selectedJobs.length === 0) {
      toast.error("Lütfen işlem yapmak için en az bir iş seçin!");
      return;
    }
    const eligibleJobs = selectedJobs.filter((jobId) => jobs.find((j) => j.id === jobId)?.status === 5);
    if (eligibleJobs.length === 0) {
      toast.error("Seçili işler arasında Setup'ı bitirilecek bir iş bulunamadı.");
      return;
    }
    handleGuardedAction(async (opId) => {
      await finishSetupMutation.mutateAsync({ workIds: eligibleJobs, operator_id: opId });
    });
  };

  const handleStartProcess = async () => {
    if (selectedJobs.length === 0) {
      toast.error("Lütfen işlem yapmak için en az bir iş seçin!");
      return;
    }
    const eligibleJobs = selectedJobs.filter((jobId) => jobs.find((j) => j.id === jobId)?.status === 6);
    if (eligibleJobs.length === 0) {
      toast.error("Seçili işler arasında Proses başlatılabilecek bir iş bulunamadı.");
      return;
    }
    handleGuardedAction(async (opId) => {
      await startProcessMutation.mutateAsync({ workIds: eligibleJobs, operator_id: opId });
    });
  };

  return (
    <div className="w-[300px] bg-background border-l border-border p-4 flex flex-col justify-start overflow-y-auto custom-scrollbar">
      <div className="grid grid-cols-2 gap-4">
        {/* Çekiç - Makine Özel Setup Butonları */}
        {areaName === "cekic" && (
          <>
            <button
              onClick={handleStartSetup}
              disabled={isOnBreak}
              className={`group relative w-full bg-secondary hover:bg-amber-500 text-foreground hover:text-white font-black py-6 rounded-xl transition-all duration-300 border border-border hover:border-amber-500 active:scale-95 overflow-hidden text-center ${isOnBreak ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
            >
              <div className="absolute inset-0 bg-linear-to-br from-amber-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex flex-col items-center gap-2">
                <Play size={24} className="fill-current text-amber-500 group-hover:text-white" />
                <span className="text-[10px] uppercase tracking-[0.2em] leading-tight">Setup<br/>Başla</span>
              </div>
            </button>
            <button
              onClick={handleFinishSetup}
              disabled={isOnBreak}
              className={`group relative w-full bg-secondary hover:bg-emerald-500 text-foreground hover:text-white font-black py-6 rounded-xl transition-all duration-300 border border-border hover:border-emerald-500 active:scale-95 overflow-hidden text-center ${isOnBreak ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
            >
              <div className="absolute inset-0 bg-linear-to-br from-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex flex-col items-center gap-2">
                <CheckCircle2 size={24} className="text-emerald-500 group-hover:text-white" />
                <span className="text-[10px] uppercase tracking-[0.2em] leading-tight">Setup<br/>Bitir</span>
              </div>
            </button>
            <button
              onClick={handleStartProcess}
              disabled={isOnBreak}
              className={`group relative w-full bg-secondary hover:bg-blue-500 text-foreground hover:text-white font-black py-6 rounded-xl transition-all duration-300 border border-border hover:border-blue-500 active:scale-95 overflow-hidden text-center col-span-2 ${isOnBreak ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
            >
              <div className="absolute inset-0 bg-linear-to-br from-blue-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex flex-col items-center gap-2">
                <Play size={24} className="fill-current text-blue-500 group-hover:text-white" />
                <span className="text-[10px] uppercase tracking-[0.2em]">Prosese Başla</span>
              </div>
            </button>
          </>
        )}

        <button
          onClick={handleRestartWork}
          disabled={isOnBreak}
          className={`group relative w-full bg-secondary hover:bg-info text-foreground hover:text-info-foreground font-black py-6 rounded-xl transition-all duration-300 border border-border hover:border-info/50 active:scale-95 overflow-hidden text-center ${isOnBreak ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
        >
          <div className="absolute inset-0 bg-linear-to-br from-info/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex flex-col items-center gap-2">
            <Play size={24} className="fill-current text-blue-400 group-hover:text-info-foreground" />
            <span className="text-[10px] uppercase tracking-[0.2em] leading-tight">Yeniden<br/>Başlat</span>
          </div>
        </button>

        <button
          onClick={() => {
            if (selectedJobs.length === 0) {
              toast.error("Lütfen işlem yapmak için bir iş seçin!");
              return;
            }
            const eligibleJobs = selectedJobs.filter(
              (jobId) => jobs.find((j) => j.id === jobId)?.status === 1
            );
            if (eligibleJobs.length === 0) {
              toast.error("Seçili işler arasında durdurulabilecek (aktif) bir iş bulunamadı.");
              return;
            }
            if (eligibleJobs.length < selectedJobs.length) {
              toast.info(`Geçersiz olanlar atlandı. ${eligibleJobs.length} aktif iş durdurma işlemine alınacak.`);
              updateSelectedJobs(eligibleJobs);
            }
            handleGuardedAction((opId) => onOpenStopModal(opId));
          }}
          disabled={isOnBreak}
          className={`group relative w-full bg-secondary hover:bg-destructive text-foreground hover:text-destructive-foreground font-black py-6 rounded-xl transition-all duration-300 border border-border hover:border-destructive/50 active:scale-95 overflow-hidden text-center ${isOnBreak ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
        >
          <div className="absolute inset-0 bg-linear-to-br from-destructive/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex flex-col items-center gap-2">
            <Square size={24} className="fill-current text-red-500 group-hover:text-destructive-foreground" />
            <span className="text-[10px] uppercase tracking-[0.2em] leading-tight">Siparişi<br/>Durdur</span>
          </div>
        </button>

        <button
          onClick={handleFinishWork}
          disabled={isOnBreak}
          className={`group relative w-full bg-secondary hover:bg-success text-foreground hover:text-success-foreground font-black py-6 rounded-xl transition-all duration-300 border border-border hover:border-success/50 active:scale-95 overflow-hidden text-center ${isOnBreak ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
        >
          <div className="absolute inset-0 bg-linear-to-br from-success/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex flex-col items-center gap-2">
            <CheckCircle2 size={24} className="text-emerald-500 group-hover:text-success-foreground" />
            <span className="text-[10px] uppercase tracking-[0.2em] leading-tight">Prosesi<br/>Bitir</span>
          </div>
        </button>

        <button
          onClick={handleCancelWork}
          disabled={isOnBreak}
          className={`group relative w-full bg-secondary hover:bg-accent text-foreground hover:text-accent-foreground font-black py-6 rounded-xl shadow-lg transition-all duration-300 border border-border hover:border-accent active:scale-95 overflow-hidden text-center ${isOnBreak ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
        >
          <div className="relative flex flex-col items-center gap-2">
            <XCircle size={24} className="text-muted-foreground group-hover:text-accent-foreground" />
            <span className="text-[10px] uppercase tracking-[0.2em] leading-tight">Sipariş<br/>İptal</span>
          </div>
        </button>

        {areaName === "tezgah" && (
          <button
            onClick={onOpenProductImage}
            disabled={isOnBreak}
            className={`group relative w-full bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-foreground font-black py-6 rounded-xl transition-all duration-300 border border-amber-500/30 hover:border-amber-500 active:scale-95 overflow-hidden text-center shadow-[0_0_20px_rgba(245,158,11,0.1)] col-span-2 ${isOnBreak ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
          >
            <div className="absolute inset-0 bg-linear-to-br from-amber-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex flex-col items-center gap-2">
              <ImageIcon size={24} className="group-hover:scale-110 transition-transform" />
              <span className="text-[10px] uppercase tracking-[0.2em]">Ürün Görseli</span>
            </div>
          </button>
        )}

        {areaName === "taslama" && (
          <button
            onClick={() => handleGuardedAction((opId) => onOpenFireModal(opId))}
            disabled={isOnBreak}
            className={`group relative w-full bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-foreground font-black py-6 rounded-xl transition-all duration-300 border border-amber-500/30 hover:border-amber-500 active:scale-95 overflow-hidden text-center shadow-[0_0_20px_rgba(245,158,11,0.1)] col-span-2 ${isOnBreak ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
          >
            <div className="absolute inset-0 bg-linear-to-br from-amber-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex flex-col items-center gap-2">
              <Calculator size={24} className="group-hover:scale-110 transition-transform" />
              <span className="text-[10px] uppercase tracking-[0.2em]">Fire Girişi</span>
            </div>
          </button>
        )}

        {areaName === "buzlama" && (
          <button
            onClick={() => handleGuardedAction((opId) => onOpenMeasurementModal(opId))}
            disabled={isOnBreak}
            className={`group relative w-full bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-foreground font-black py-6 rounded-xl transition-all duration-300 border border-orange-500/30 hover:border-orange-500 active:scale-95 overflow-hidden text-center shadow-[0_0_20px_rgba(249,115,22,0.1)] col-span-2 ${isOnBreak ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
          >
            <div className="absolute inset-0 bg-linear-to-br from-orange-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex flex-col items-center gap-2">
              <Calculator size={24} className="group-hover:scale-110 transition-transform" />
              <span className="text-[10px] uppercase tracking-[0.2em]">Ölçüm V. Girişi</span>
            </div>
          </button>
        )}
      </div>
    </div>
  );
};

export default TerminalRightSide;
