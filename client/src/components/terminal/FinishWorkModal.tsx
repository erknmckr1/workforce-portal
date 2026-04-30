import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { X, CheckCircle2 } from "lucide-react";
import apiClient from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { toast } from "sonner";
import { AxiosError } from "axios";
import type { MesRepairReason } from "../../types/mes";

interface FinishWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedJob: string | null;
  onJobDeselect: () => void;
}

const FinishWorkModal = ({
  isOpen,
  onClose,
  selectedJob,
  onJobDeselect,
}: FinishWorkModalProps) => {
  const { areaName, section } = useParams<{
    areaName: string;
    section: string;
  }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // Form State
  const [goodQty, setGoodQty] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [targetDept, setTargetDept] = useState<string>("");
  const [slots, setSlots] = useState<{ id: string; qty: string }[]>(
    Array(7).fill({ id: "", qty: "" }),
  );

  // Tamir Nedenlerini Çek (ID eşleştirmesi için)
  const { data: repairReasons } = useQuery<MesRepairReason[]>({
    queryKey: ["repairReasons", areaName, section],
    queryFn: async () => {
      const res = await apiClient.get(
        `/mes/repair-reasons?areaName=${areaName}&section=${section}`,
      );
      return res.data;
    },
    enabled: isOpen && !!areaName && !!section,
  });

  // Bitirme Mutasyonu
  const finishMutation = useMutation({
    mutationFn: async () => {
      // Sadece ID ve Qty girilmiş olanları filtrele
      const repairDetails = slots
        .filter((s) => s.id && s.qty)
        .map((s) => ({
          reasonId: s.id,
          reasonName:
            repairReasons?.find((r) => r.repair_reason_id === s.id)
              ?.repair_reason || "Bilinmiyor",
          qty: parseFloat(s.qty),
        }));

      return await apiClient.post("/mes/finish-work", {
        work_log_id: selectedJob,
        operator_id: user?.id_dec,
        produced_qty_gr: parseFloat(goodQty) || 0,
        finish_description: description,
        additional_data: {
          repair_details: repairDetails,
          target_department: targetDept,
        },
      });
    },
    onSuccess: () => {
      toast.success("Sipariş başarıyla tamamlandı!");
      onJobDeselect();
      queryClient.invalidateQueries({ queryKey: ["workLogs", areaName] });
      setGoodQty("");
      setDescription("");
      setTargetDept("");
      setSlots(Array(7).fill({ id: "", qty: "" }));
      onClose();
    },
    onError: (error: AxiosError<{ message: string }>) => {
      toast.error(
        error.response?.data?.message || "İş bitirilirken hata oluştu!",
      );
    },
  });

  const updateSlot = (index: number, field: "id" | "qty", value: string) => {
    const newSlots = [...slots];
    newSlots[index] = { ...newSlots[index], [field]: value };
    setSlots(newSlots);
  };

  const getReasonName = (id: string) => {
    if (!id) return null;
    return repairReasons?.find((r) => r.repair_reason_id === id)?.repair_reason;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-999 flex items-center justify-center  backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-[2.5rem] w-full max-w-[87%] shadow-2xl animate-in fade-in zoom-in duration-300 my-auto">
        {/* Header - Solid Midas Gold */}
        <div className="bg-mds p-10 rounded-t-[2.5rem] relative overflow-hidden border-b border-black/10">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <CheckCircle2 size={160} />
          </div>
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <h2 className="text-5xl font-black text-dark uppercase tracking-tight leading-none">
                Siparişi Bitir
              </h2>
              <p className="text-primary-dark font-bold mt-3 text-lg">
                Üretim sonlandırma ve tamir girişi ekranı
              </p>
            </div>
            <button
              onClick={onClose}
              className="bg-foreground/20 hover:bg-foreground/40 text-primary-foreground p-4 rounded-[1.25rem] transition-all active:scale-90"
            >
              <X size={36} />
            </button>
          </div>
        </div>

        <div className="p-8 space-y-10 text-foreground">
          {/* Top Section: Main Input & Description Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch min-h-[180px]">
            {/* Left: Main Input - Sağlam Ürün */}
            <div className="flex flex-col items-center justify-center gap-4 bg-secondary/30 p-8 rounded-[2rem] border border-border/50">
              <label className="text-primary font-black text-xl uppercase tracking-widest text-center">
                Sağlam Çıkan Ürün (gr)
              </label>
              <input
                type="number"
                value={goodQty}
                onChange={(e) => setGoodQty(e.target.value)}
                className="w-full bg-background text-foreground text-center text-5xl font-black py-4 rounded-2xl focus:ring-4 ring-primary/50 border border-border outline-none transition-all placeholder:text-muted-foreground/30"
                placeholder="0.00"
              />
            </div>

            {/* Right: Optional Description - Always visible for layout stability or only on input? 
                User said: "sağlam cıkan gram girildiği an acıklama alanı da gözükecek" 
                To avoid jumpy UI while keeping them side by side, I'll use opacity or a placeholder state.
            */}
            <div
              className={`transition-all duration-500 ${goodQty ? "opacity-100 translate-x-0" : "opacity-20 pointer-events-none translate-x-4 grayscale"}`}
            >
              <div className="h-full flex flex-col gap-2 bg-secondary/20 p-6 rounded-[2rem] border border-border/40">
                <label className="text-muted-foreground font-bold text-xs uppercase ml-1 tracking-widest">
                  Sipariş Notu / Açıklama (Opsiyonel)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    goodQty
                      ? "Üretimle ilgili eklemek istediğiniz bir not var mı?..."
                      : "Lütfen önce gramaj giriniz..."
                  }
                  disabled={!goodQty}
                  className="flex-1 w-full bg-background border border-border text-foreground p-4 rounded-xl outline-none focus:border-primary font-medium resize-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Repair Grid Section */}
          <div className="space-y-6">
            <div className="bg-secondary text-secondary-foreground font-black text-center py-3 rounded-2xl uppercase tracking-[0.3em] text-[10px] border border-border shadow-inner">
              Tamir Nedenleri
            </div>

            <div className="grid grid-cols-7 gap-3">
              {slots.map((slot, idx) => (
                <div key={idx} className="space-y-2">
                  {/* Reason ID Input */}
                  <div className="relative">
                    <span className="absolute -top-2 -left-2 bg-secondary text-secondary-foreground text-[10px] px-2 py-0.5 rounded-full border border-border z-10">
                      {idx + 1}. Neden
                    </span>
                    <input
                      type="text"
                      value={slot.id}
                      onChange={(e) => updateSlot(idx, "id", e.target.value)}
                      className="w-full bg-background border border-border text-foreground text-center text-2xl font-black py-6 rounded-xl focus:border-primary outline-none transition-all"
                      placeholder="ID"
                    />
                  </div>

                  {/* Qty Input */}
                  <div className="relative">
                    <span className="absolute -top-2 -left-2 bg-secondary text-secondary-foreground text-[10px] px-2 py-0.5 rounded-full border border-border z-10">
                      {idx + 1}. Gramaj
                    </span>
                    <input
                      type="number"
                      value={slot.qty}
                      onChange={(e) => updateSlot(idx, "qty", e.target.value)}
                      className="w-full bg-background border border-border text-primary text-center text-xl font-bold py-4 rounded-xl focus:border-primary outline-none transition-all"
                      placeholder="0"
                    />
                  </div>

                  {/* Name Badge */}
                  <div
                    className={`min-h-[40px] flex items-center justify-center p-2 rounded-lg text-[10px] font-black uppercase text-center leading-tight transition-all ${getReasonName(slot.id) ? "bg-info/20 text-info border border-info/30" : "bg-transparent text-transparent"}`}
                  >
                    {getReasonName(slot.id) || "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex flex-col md:flex-row gap-6 items-center justify-between border-t border-border pt-8">
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <label className="text-muted-foreground font-bold text-xs uppercase ml-1">
                Tamire Gidilecek Bölüm
              </label>
              <select
                value={targetDept}
                onChange={(e) => setTargetDept(e.target.value)}
                className="bg-background border border-border text-foreground p-4 rounded-xl outline-none focus:border-primary min-w-[250px] font-bold"
              >
                <option value="">Bölüm Seçiniz...</option>
                <option value="YALDIZ">YALDIZ</option>
                <option value="DÖKÜM">DÖKÜM</option>
                <option value="CILA">CİLA</option>
                <option value="MONTAJ">MONTAJ</option>
                <option value="TAMİR TEZGAHI">TAMİR TEZGAHI</option>
                <option value="MİNE">MİNE</option>
              </select>
            </div>

            <div className="flex gap-4 w-full md:w-auto">
              <button
                onClick={onClose}
                className="flex-1 md:flex-none px-12 py-5 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-black rounded-2xl transition-all active:scale-95 uppercase tracking-widest"
              >
                Vazgeç
              </button>
              <button
                onClick={() => finishMutation.mutate()}
                disabled={finishMutation.isPending || !goodQty}
                className="flex-1 md:flex-none px-12 py-5 bg-success hover:bg-success/90 disabled:opacity-50 text-primary-foreground font-black rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95 uppercase tracking-widest flex items-center gap-2"
              >
                {finishMutation.isPending ? (
                  "İşleniyor..."
                ) : (
                  <>
                    <CheckCircle2 size={24} />
                    Prosesi Bitir
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinishWorkModal;
