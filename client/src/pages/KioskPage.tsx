import { useEffect, useState } from "react";
import SurveysModal from "@/components/terminal/SurveysModal";
import { useActiveSurveys } from "@/hooks/useSurveys";
import { useModuleStore } from "@/store/moduleStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  KioskLogin,
  KioskUserProfile,
  KioskMainDashboard,
} from "@/components/kiosk/KioskComponents";

export default function KioskPage() {
  const { selectedFlow, setSelectedFlow, user } = useModuleStore();
  const [isSurveysOpen, setIsSurveysOpen] = useState(false);
  const { data: activeSurveys = [], refetch: refetchSurveys } = useActiveSurveys("KIOSK");

  // Sayfa yüklendiğinde veya değiştiğinde tab'ı temizleyebiliriz (opsiyonel)
  useEffect(() => {
    // Kiosk sayfasında her zaman Talep Oluştur ile başlasın istersek:
    // setSelectedFlow("Talep Oluştur");
  }, []);

  const rolesAllowedToApprove = [1, 2, 3, 7, 9];
  const canApprove = user?.role_id
    ? rolesAllowedToApprove.includes(user.role_id)
    : false;

  return (
    <div className="fixed inset-0 z-0 flex flex-col bg-background overflow-hidden">
      {/* Kiosk Header (Sayfa Modu) */}
      <div className="flex items-center justify-between p-4 px-8 border-b border-border/50 bg-card z-10 shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          
          <div className="mr-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black text-xs shadow-md shadow-primary/20">
              M
            </div>
            <span className="font-black text-sm uppercase tracking-widest text-foreground">
              <span className="text-primary">KIOSK</span>
            </span>
          </div>

          {user && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedFlow("Talep Oluştur")}
                className={cn(
                  "px-6 py-3 rounded-xl font-black uppercase tracking-wider text-[10px] transition-all",
                  selectedFlow === "Talep Oluştur"
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                Talep Oluştur
              </button>
              <button
                onClick={() => setSelectedFlow("Taleplerim")}
                className={cn(
                  "px-6 py-3 rounded-xl font-black uppercase tracking-wider text-[10px] transition-all",
                  selectedFlow === "Taleplerim"
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                Taleplerim
              </button>
              {canApprove && (
                <button
                  onClick={() => setSelectedFlow("Talepleri Onayla")}
                  className={cn(
                    "px-6 py-3 rounded-xl font-black uppercase tracking-wider text-[10px] transition-all",
                    selectedFlow === "Talepleri Onayla"
                      ? "bg-orange-600 text-primary-foreground shadow-lg shadow-orange-600/20"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  Talepleri Onayla
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {activeSurveys.length > 0 && (
            <button
              onClick={async () => {
                const { data: freshSurveys } = await refetchSurveys();
                if (!freshSurveys || freshSurveys.length === 0) {
                  toast.info("Şu anda yayında aktif bir anket bulunmamaktadır.");
                  return;
                }
                setIsSurveysOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-700 to-purple-800 hover:from-indigo-600 hover:to-purple-700 text-white font-black uppercase tracking-wider text-[11px] shadow-lg shadow-indigo-500/20 animate-pulse flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span>📋</span>
              <span>Şirket Anketleri</span>
            </button>
          )}
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none">
              Terminal Durumu
            </p>
            <p className="text-[11px] font-black text-emerald-500 uppercase">
              Aktif / Çevrimiçi
            </p>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden">
        {user ? (
          <>
            <KioskUserProfile />
            <div className="flex-1 bg-muted/5">
              <KioskMainDashboard />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-muted/5">
            <KioskLogin />
          </div>
        )}
      </div>
      <SurveysModal
        isOpen={isSurveysOpen}
        onClose={() => setIsSurveysOpen(false)}
        platform="KIOSK"
      />
    </div>
  );
}
