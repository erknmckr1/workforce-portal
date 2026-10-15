import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, Clock, Calendar, AlertCircle } from "lucide-react";
import type { IVisitor } from "@/types/visitor";
import { format } from "date-fns";

interface VisitorExitDialogProps {
  open: boolean;
  visitor: IVisitor | null;
  onOpenChange: (open: boolean) => void;
  onConfirmExit: (visitorId: string | number, exitDate: string, exitTime: string) => void;
}

export default function VisitorExitDialog({
  open,
  visitor,
  onOpenChange,
  onConfirmExit,
}: VisitorExitDialogProps) {
  const [exitDate, setExitDate] = useState("");
  const [exitTime, setExitTime] = useState("");

  useEffect(() => {
    if (open && visitor) {
      const now = new Date();
      setExitDate(format(now, "yyyy-MM-dd"));
      setExitTime(format(now, "HH:mm"));
    }
  }, [open, visitor]);

  if (!visitor) return null;

  const handleConfirm = () => {
    onConfirmExit(visitor.id, exitDate, exitTime);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] sm:max-w-lg p-0 gap-0 rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border/70 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <LogOut size={22} />
            </div>
            <div className="space-y-0.5">
              <DialogTitle className="text-xl font-black text-foreground">
                Ziyaretçi Çıkış İşlemi
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold text-muted-foreground">
                Çıkış Tarihi & Saati Onaylama Formu
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4">
          {/* ZİYARETÇİ ÖZET BİLGİSİ */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-bold text-muted-foreground">Ziyaretçi:</span>
              <span className="font-black text-sm text-foreground">{visitor.fullName}</span>
            </div>
            {visitor.company && (
              <div className="flex justify-between items-center">
                <span className="font-bold text-muted-foreground">Firma:</span>
                <span className="font-semibold text-foreground">{visitor.company}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="font-bold text-muted-foreground">Görüşülen:</span>
              <span className="font-semibold text-foreground">{visitor.visitedPersonOrDept}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-border/40">
              <span className="font-bold text-muted-foreground">Giriş Zamanı:</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {visitor.entryDate} • {visitor.entryTime}
              </span>
            </div>
          </div>

          {/* DÜZENLENEBİLİR ÇIKIŞ TARİH VE SAATİ */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold">
              <AlertCircle size={14} className="text-amber-500" />
              <span>Gerekirse çıkış saatini geriye dönük düzenleyebilirsiniz.</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                  <Calendar size={13} className="text-muted-foreground" />
                  Çıkış Tarihi
                </Label>
                <Input
                  type="date"
                  value={exitDate}
                  onChange={(e) => setExitDate(e.target.value)}
                  className="h-11 rounded-xl bg-muted/30 border-border/70 font-bold text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                  <Clock size={13} className="text-muted-foreground" />
                  Çıkış Saati
                </Label>
                <Input
                  type="time"
                  value={exitTime}
                  onChange={(e) => setExitTime(e.target.value)}
                  className="h-11 rounded-xl bg-muted/30 border-border/70 font-bold text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 border-t border-border/70 bg-muted/20 flex flex-row items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 px-5 rounded-xl font-bold text-xs uppercase tracking-wider"
          >
            İptal
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            className="h-11 px-6 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-black text-xs uppercase tracking-wider shadow-md shadow-destructive/20"
          >
            <LogOut size={16} className="mr-2" />
            Çıkış Yap
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
