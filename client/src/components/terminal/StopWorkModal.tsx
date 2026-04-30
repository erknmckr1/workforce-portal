import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { X, AlertTriangle } from "lucide-react";
import { AxiosError } from "axios";
import apiClient from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { toast } from "sonner";
import type { MesStopReason } from "../../types/mes";

interface StopWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedJob: string | null;
  onJobDeselect: () => void;
}

const StopWorkModal = ({ isOpen, onClose, selectedJob, onJobDeselect }: StopWorkModalProps) => {
  const { areaName, section } = useParams<{ areaName: string; section: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: stopReasons, isLoading } = useQuery<MesStopReason[]>({
    queryKey: ["stopReasons", areaName, section],
    queryFn: async () => {
      const res = await apiClient.get(
        `/mes/stop-reasons?areaName=${areaName}&section=${section}`
      );
      return res.data;
    },
    enabled: isOpen && !!areaName && !!section,
  });

  const stopWorkMutation = useMutation({
    mutationFn: async (stopReasonId: string) => {
      const res = await apiClient.post("/mes/stop-work", {
        workLogId: selectedJob,
        operatorId: user?.id_dec,
        stopReasonId,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Sipariş başarıyla durduruldu!");
      onJobDeselect(); // Seçimi iptal et
      queryClient.invalidateQueries({ queryKey: ["workLogs", areaName] });
      onClose(); // Modalı kapat
    },
    onError: (error: AxiosError<{ message: string }>) => {
      toast.error(
        error.response?.data?.message || "Sipariş durdurulurken hata oluştu!"
      );
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-background border border-border rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-destructive/10 border-b border-border p-6 flex justify-between items-center">
          <div className="flex items-center gap-3 text-destructive">
            <AlertTriangle size={32} />
            <div>
              <h2 className="text-2xl font-black uppercase tracking-wider">İşi Durdur</h2>
              <p className="text-muted-foreground text-sm font-medium">Lütfen siparişi durdurma nedenini seçiniz</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-secondary rounded-xl"
          >
            <X size={28} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground animate-pulse text-xl font-medium">
              Duruş Nedenleri Yükleniyor...
            </div>
          ) : stopReasons && stopReasons.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-border p-2">
              {stopReasons.map((reason) => (
                <button
                  key={reason.stop_reason_id}
                  onClick={() => stopWorkMutation.mutate(reason.stop_reason_id)}
                  disabled={stopWorkMutation.isPending}
                  className="group relative bg-secondary hover:bg-destructive border border-border hover:border-destructive/50 text-foreground hover:text-destructive-foreground p-6 rounded-xl transition-all duration-300 shadow-sm active:scale-95 text-center flex flex-col items-center gap-2 overflow-hidden disabled:opacity-50 disabled:pointer-events-none"
                >
                  <div className="absolute inset-0 bg-linear-to-br from-destructive/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="font-bold text-lg relative z-10 leading-tight">
                    {reason.stop_reason_name}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-lg">
              Bu bölüm için kayıtlı duruş nedeni bulunamadı.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StopWorkModal;
