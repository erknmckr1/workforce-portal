import React, { useState } from "react";
import {
  X,
  Coffee,
  Clock,
  Timer,
  Utensils,
  Zap,
  Fingerprint,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface BreakModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  operator: {
    id_dec: string;
    full_name: string;
  } | null;
}

const BREAK_REASONS = [
  {
    id: "YEMEK",
    label: "Yemek Molası",
    sub: "Gıda & Dinlenme",
    icon: Utensils,
    code: "000001",
    activeColor: "bg-mds text-black",
  },
  {
    id: "OZEL",
    label: "Özel Ara",
    sub: "Kişisel İhtiyaç",
    icon: Coffee,
    code: "000003",
    activeColor: "bg-blue-600 text-white",
  },
  {
    id: "RAMAT",
    label: "Ramat",
    sub: "Altın Toplama",
    icon: Zap,
    code: "000005",
    activeColor: "bg-emerald-600 text-white",
  },
];

const BreakModal: React.FC<BreakModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  operator,
}) => {
  const [selectedReason, setSelectedReason] = useState(BREAK_REASONS[0]);
  const currentTime = new Date();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-150 flex items-center justify-center backdrop-blur-md p-4 overflow-hidden">
      <div className="bg-card border border-border rounded-[2.5rem] w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300 relative">
        {/* Header Section */}
        <div className="p-8 flex items-center justify-between border-b border-border bg-secondary/30 shrink-0">
          <div className="flex items-center gap-6">
            <div className="bg-mds p-4 rounded-2xl shadow-lg">
              <Clock size={32} className="text-black" />
            </div>
            <div>
              <h2 className="text-4xl font-black text-foreground uppercase tracking-tighter leading-none">
                Mola Yönetimi
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-secondary hover:bg-accent p-4 rounded-2xl transition-all active:scale-90 border border-border"
          >
            <X size={28} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex flex-1 p-10 gap-10 overflow-hidden">
          {/* Left Side - Selection Cards */}
          <div className="w-[380px] flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] mb-2 px-2">
              Mola Nedeni Seçiniz
            </span>
            {BREAK_REASONS.map((reason) => {
              const Icon = reason.icon;
              const isSelected = selectedReason.id === reason.id;

              return (
                <button
                  key={reason.id}
                  onClick={() => setSelectedReason(reason)}
                  className={cn(
                    "relative group p-6 rounded-[1.5rem] flex items-center gap-5 transition-all duration-300 border text-left",
                    isSelected
                      ? "bg-secondary border-mds/50 shadow-xl scale-[1.02]"
                      : "bg-background border-border hover:border-muted-foreground/30",
                  )}
                >
                  <div
                    className={cn(
                      "p-4 rounded-xl transition-all duration-300 shadow-md",
                      isSelected
                        ? reason.activeColor
                        : "bg-muted text-muted-foreground group-hover:scale-110",
                    )}
                  >
                    <Icon size={24} />
                  </div>
                  <div className="flex-1">
                    <div
                      className={cn(
                        "text-lg font-black uppercase tracking-tight",
                        isSelected
                          ? "text-foreground"
                          : "text-muted-foreground group-hover:text-foreground",
                      )}
                    >
                      {reason.label}
                    </div>
                    <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-1">
                      {reason.sub}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-mds animate-in slide-in-from-left duration-300">
                      <ChevronRight size={24} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Side - Info Card */}
          <div className="flex-1 flex flex-col">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] mb-4 px-2">
              Önizleme & Detaylar
            </span>
            <div className="flex-1 bg-secondary/20 rounded-[2rem] border border-border p-10 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
                <Fingerprint size={240} />
              </div>

              <div className="grid grid-cols-2 gap-10 relative z-10">
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-mds uppercase tracking-widest">
                    Operatör Bilgisi
                  </div>
                  <div className="text-xl font-black text-foreground uppercase tracking-tight">
                    {operator?.full_name}
                  </div>
                </div>
                <div className="space-y-2 text-right">
                  <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                    Sistem Zamanı
                  </div>
                  <div className="text-3xl font-black text-foreground tabular-nums tracking-tight">
                    {format(currentTime, "HH:mm:ss")}
                  </div>
                  <div className="text-xs font-bold text-muted-foreground/60">
                    {format(currentTime, "d MMMM yyyy", { locale: tr })}
                  </div>
                </div>
              </div>

              <div className="mt-auto flex items-center justify-center py-6">
                <Coffee
                  size={120}
                  className="text-muted-foreground/10 rotate-12 transition-all duration-700 hover:rotate-0"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="p-8 bg-secondary/50 border-t border-border flex items-center justify-center gap-6 shrink-0">
          <button
            onClick={onClose}
            className="h-16 px-12 rounded-2xl bg-secondary hover:bg-accent text-foreground font-black uppercase tracking-widest transition-all active:scale-95 border border-border"
          >
            Vazgeç
          </button>
          <button
            onClick={() => onConfirm(selectedReason.label)}
            className="h-16 px-16 rounded-2xl bg-mds hover:opacity-90 text-black font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl flex items-center gap-3 group"
          >
            <Timer
              size={24}
              className="group-hover:rotate-12 transition-transform"
            />
            Araya Çık
          </button>
        </div>
      </div>
    </div>
  );
};

export default BreakModal;
