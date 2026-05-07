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

interface TerminalRightSideProps {
  selectedJobs: string[];
  onJobDeselect: () => void;
  onOpenFinishModal: (opId: string) => void;
  onOpenStopModal: (opId: string) => void;
  onOpenProductImage: () => void;
  onOpenFireModal: (opId: string) => void;
  onOpenMeasurementModal: (opId: string) => void;
  isOnBreak: boolean;
  requireOperatorAuth?: () => Promise<string>;
}

const TerminalRightSide = ({
  selectedJobs,
  onJobDeselect,
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

  const handleGuardedAction = async (actionFn: (opId: string) => void) => {
    try {
      const opId = requireOperatorAuth ? await requireOperatorAuth() : user?.id_dec || "SYSTEM";
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

    const isConfirmed = await confirm({
      title: "İş İptali",
      description: `${selectedJobs.length} adet işi iptal etmek istediğinize emin misiniz? Bu işlem geri alınamaz!`,
      confirmText: "Evet, İptal Et",
      cancelText: "Vazgeç",
      variant: "destructive",
    });

    if (isConfirmed) {
      handleGuardedAction(async (opId) => {
        try {
          for (const jobId of selectedJobs) {
            await cancelWorkMutation.mutateAsync({
              workLogId: jobId,
              operatorId: opId,
              cancelReasonId: 1, // Genel iptal nedeni
            });
          }
          toast.success("Tüm işler iptal edildi!");
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
    const isConfirmed = await confirm({
      title: "İşi Yeniden Başlat",
      description: `${selectedJobs.length} adet işi yeniden başlatmak istediğinize emin misiniz?`,
      confirmText: "Evet, Başlat",
      cancelText: "Vazgeç",
      variant: "success",
    });
    if (isConfirmed) {
      handleGuardedAction(async (opId) => {
        try {
          for (const jobId of selectedJobs) {
            await restartWorkMutation.mutateAsync({
              workLogId: jobId,
              operatorId: opId,
            });
          }
          toast.success("Tüm işler başarıyla başlatıldı!");
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

    if (areaName === "kalite") {
      if (selectedJobs.length > 1) {
        toast.error("Kalite ekranında sadece tekli bitirme yapılabilir.");
        return;
      }
      handleGuardedAction((opId) => onOpenFinishModal(opId));
    } else {
      const isConfirmed = await confirm({
        title: "İşi Bitir",
        description: `${selectedJobs.length} adet işi tamamlamak istediğinize emin misiniz?`,
        confirmText: "Evet, Bitir",
        cancelText: "Vazgeç",
        variant: "success",
      });
      if (isConfirmed) {
        handleGuardedAction(async (opId) => {
          try {
            for (const jobId of selectedJobs) {
              await finishWorkMutation.mutateAsync({
                work_log_id: jobId,
                operator_id: opId,
              });
            }
            toast.success("Tüm işler başarıyla tamamlandı!");
          } catch {
            // Hata
          }
        });
      }
    }
  };

  return (
    <div className="w-[200px] bg-background border-l border-border p-4 flex flex-col justify-center gap-4 ">
      <button
        onClick={handleRestartWork}
        disabled={isOnBreak}
        className={`group relative w-full bg-secondary hover:bg-info text-foreground hover:text-info-foreground font-black py-6 rounded-xl transition-all duration-300 border border-border hover:border-info/50 active:scale-95 overflow-hidden text-center ${isOnBreak ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
      >
        <div className="absolute inset-0 bg-linear-to-br from-info/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative flex flex-col items-center gap-2">
          <Play
            size={24}
            className="fill-current text-blue-400 group-hover:text-info-foreground"
          />
          <span className="text-[10px] uppercase tracking-[0.2em]">
            Yeniden Başlat
          </span>
        </div>
      </button>

      <button
        onClick={() => handleGuardedAction((opId) => selectedJobs.length > 0 ? onOpenStopModal(opId) : toast.error("Lütfen işlem yapmak için bir iş seçin!"))}
        disabled={isOnBreak}
        className={`group relative w-full bg-secondary hover:bg-destructive text-foreground hover:text-destructive-foreground font-black py-6 rounded-xl transition-all duration-300 border border-border hover:border-destructive/50 active:scale-95 overflow-hidden text-center ${isOnBreak ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
      >
        <div className="absolute inset-0 bg-linear-to-br from-destructive/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative flex flex-col items-center gap-2">
          <Square
            size={24}
            className="fill-current text-red-500 group-hover:text-destructive-foreground"
          />
          <span className="text-[10px] uppercase tracking-[0.2em]">
            Siparişi Durdur
          </span>
        </div>
      </button>

      <button
        onClick={handleFinishWork}
        disabled={isOnBreak}
        className={`group relative w-full bg-secondary hover:bg-success text-foreground hover:text-success-foreground font-black py-6 rounded-xl transition-all duration-300 border border-border hover:border-success/50 active:scale-95 overflow-hidden text-center ${isOnBreak ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
      >
        <div className="absolute inset-0 bg-linear-to-br from-success/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative flex flex-col items-center gap-2">
          <CheckCircle2
            size={24}
            className="text-emerald-500 group-hover:text-success-foreground"
          />
          <span className="text-[10px] uppercase tracking-[0.2em]">
            Prosesi Bitir
          </span>
        </div>
      </button>

      <button
        onClick={handleCancelWork}
        disabled={isOnBreak}
        className={`group relative w-full bg-secondary hover:bg-accent text-foreground hover:text-accent-foreground font-black py-6 rounded-xl shadow-lg transition-all duration-300 border border-border hover:border-accent active:scale-95 overflow-hidden text-center ${isOnBreak ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
      >
        <div className="relative flex flex-col items-center gap-2">
          <XCircle
            size={24}
            className="text-muted-foreground group-hover:text-accent-foreground"
          />
          <span className="text-[10px] uppercase tracking-[0.2em]">
            Sipariş İptal
          </span>
        </div>
      </button>

      {areaName === "tezgah" && (
        <button
          onClick={onOpenProductImage}
          disabled={isOnBreak}
          className={`group relative w-full bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-foreground font-black py-6 rounded-xl transition-all duration-300 border border-amber-500/30 hover:border-amber-500 active:scale-95 overflow-hidden text-center shadow-[0_0_20px_rgba(245,158,11,0.1)] ${isOnBreak ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
        >
          <div className="absolute inset-0 bg-linear-to-br from-amber-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex flex-col items-center gap-2">
            <ImageIcon
              size={24}
              className="group-hover:scale-110 transition-transform"
            />
            <span className="text-[10px] uppercase tracking-[0.2em]">
              Ürün Görseli
            </span>
          </div>
        </button>
      )}

      {areaName === "taslama" && (
        <button
          onClick={() => handleGuardedAction((opId) => onOpenFireModal(opId))}
          disabled={isOnBreak}
          className={`group relative w-full bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-foreground font-black py-6 rounded-xl transition-all duration-300 border border-amber-500/30 hover:border-amber-500 active:scale-95 overflow-hidden text-center shadow-[0_0_20px_rgba(245,158,11,0.1)] ${isOnBreak ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
        >
          <div className="absolute inset-0 bg-linear-to-br from-amber-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex flex-col items-center gap-2">
            <Calculator
              size={24}
              className="group-hover:scale-110 transition-transform"
            />
            <span className="text-[10px] uppercase tracking-[0.2em]">
              Fire Girişi
            </span>
          </div>
        </button>
      )}

      {areaName === "buzlama" && (
        <button
          onClick={() => handleGuardedAction((opId) => onOpenMeasurementModal(opId))}
          disabled={isOnBreak}
          className={`group relative w-full bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-foreground font-black py-6 rounded-xl transition-all duration-300 border border-orange-500/30 hover:border-orange-500 active:scale-95 overflow-hidden text-center shadow-[0_0_20px_rgba(249,115,22,0.1)] ${isOnBreak ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
        >
          <div className="absolute inset-0 bg-linear-to-br from-orange-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex flex-col items-center gap-2">
            <Calculator
              size={24}
              className="group-hover:scale-110 transition-transform"
            />
            <span className="text-[10px] uppercase tracking-[0.2em]">
              Ölçüm V. Girişi
            </span>
          </div>
        </button>
      )}
    </div>
  );
};

export default TerminalRightSide;
