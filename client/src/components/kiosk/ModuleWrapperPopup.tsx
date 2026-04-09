import { X } from "lucide-react";
import { useModuleStore } from "@/store/moduleStore";
import { cn } from "@/lib/utils";
import { 
  KioskLogin, 
  KioskUserProfile, 
  KioskMainDashboard 
} from "./KioskComponents";

export function ModuleWrapperPopup() {
  const { isPopupOpen, closePopup, selectedFlow, setSelectedFlow, user } = useModuleStore();

  if (!isPopupOpen) return null;

  const rolesAllowedToApprove = [1, 2, 3, 7];
  const canApprove = user?.role_id ? rolesAllowedToApprove.includes(user.role_id) : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/90 p-4 lg:p-8">
      <div className="relative w-[98%] max-w-none h-full max-h-[900px] bg-background rounded-[2rem] shadow-xl flex flex-col overflow-hidden border border-border/50">
        <div className="flex items-center justify-between p-4 px-6 border-b border-border/50 bg-card z-10 shrink-0">
          <div className="flex items-center gap-4">
            {user && (
              <>
                <button
                  onClick={() => setSelectedFlow("Talep Oluştur")}
                  className={cn(
                    "px-6 py-3.5 rounded-2xl font-black uppercase tracking-wider text-xs",
                    selectedFlow === "Talep Oluştur"
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  Talep Oluştur
                </button>
                <button
                  onClick={() => setSelectedFlow("Taleplerim")}
                  className={cn(
                    "px-6 py-3.5 rounded-2xl font-black uppercase tracking-wider text-xs",
                    selectedFlow === "Taleplerim"
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  Taleplerim
                </button>
                {canApprove && (
                  <button
                    onClick={() => setSelectedFlow("Talepleri Onayla")}
                    className={cn(
                      "px-6 py-3.5 rounded-2xl font-black uppercase tracking-wider text-xs",
                      selectedFlow === "Talepleri Onayla"
                        ? "bg-orange-500 text-primary-foreground shadow-md shadow-orange-500/30"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    Talepleri Onayla
                  </button>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-6">
            {!user && <span className="font-black text-sm uppercase tracking-widest text-muted-foreground">KİOSK TERMİNALİ</span>}
            <button onClick={closePopup} className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive hover:text-primary-foreground border-2 border-destructive/20"><X size={24} /></button>
          </div>
        </div>
        <div className="flex-1 flex overflow-hidden">
          {user ? (
            <>
              <KioskUserProfile />
              <KioskMainDashboard />
            </>
          ) : (
            <KioskLogin />
          )}
        </div>
      </div>
    </div>
  );
}

