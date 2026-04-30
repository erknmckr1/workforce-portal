import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "default" | "success";
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Onayla",
  cancelText = "İptal",
  variant = "default",
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isLoading && !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-[2rem] p-6 sm:p-8 border border-border/20 shadow-none bg-card z-100">
        <DialogHeader className="flex flex-col items-center text-center sm:text-center space-y-4 pt-2">
          <div className={cn(
            "w-20 h-20 rounded-[1.75rem] flex items-center justify-center shadow-inner",
            variant === "destructive" ? "bg-destructive/10 text-destructive border border-destructive/20" : 
            variant === "success" ? "bg-success/10 text-success border border-success/20" :
            "bg-primary/10 text-primary border border-primary/20"
          )}>
            {variant === "destructive" ? <AlertTriangle size={40} /> : 
             variant === "success" ? <CheckCircle size={40} /> : 
             <Info size={40} />}
          </div>
          <DialogTitle className="text-2xl font-black tracking-tighter">{title}</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground font-bold mt-2">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 w-full mt-8">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 h-14 rounded-[1.25rem] font-black text-lg bg-muted/50 hover:bg-muted text-muted-foreground transition-all active:scale-95"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              "flex-1 h-14 rounded-[1.25rem] font-black text-lg text-white shadow-xl transition-all active:scale-95",
              variant === "destructive"
                ? "bg-destructive hover:bg-destructive/90 shadow-destructive/20"
                : variant === "success"
                ? "bg-success hover:bg-success/90 shadow-success/20 text-white"
                : "bg-primary hover:bg-primary/90 shadow-primary/20"
            )}
          >
            {isLoading ? "İşleniyor..." : confirmText}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
