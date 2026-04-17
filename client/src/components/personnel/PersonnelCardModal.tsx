import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { PersonnelCard } from "./PersonnelCard";
import { type Personnel } from "@/hooks/usePersonnel";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface PersonnelCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personnel: Personnel | null;
}

export function PersonnelCardModal({
  open,
  onOpenChange,
  personnel
}: PersonnelCardModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-fit p-0 overflow-hidden border-none bg-transparent shadow-none">
        <div className="flex flex-col items-center gap-6 p-4">
          {/* KART ÖNİZLEME ALANI */}
          <div className="scale-75 sm:scale-100 origin-center">
            <PersonnelCard personnel={personnel} />
          </div>

          {/* AKSİYONLAR - SADECE KAPAT */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-12 px-12 rounded-full bg-muted/20 hover:bg-muted/40 text-foreground border-border font-black backdrop-blur-md transition-all active:scale-95 flex items-center gap-2"
            >
              <X size={20} />
              Önizlemeyi Kapat
            </Button>
          </div>
        </div>

        <style>{`
          /* Modal arkasındaki koyu katmanı semantik değişkenle kontrol edelim */
          .fixed.inset-0 {
             backdrop-filter: blur(12px) brightness(0.4);
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
