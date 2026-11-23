import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AlertTriangle, Info, CheckCircle, Loader2 } from "lucide-react";
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
      <DialogContent className="sm:max-w-md rounded-[2rem] p-6 sm:p-8 border border-border shadow-2xl bg-card z-100">
        <DialogHeader className="flex flex-col items-center text-center space-y-4 pt-2">
          <div
            className={cn(
              "w-20 h-20 rounded-[1.75rem] flex items-center justify-center shadow-inner",
              variant === "destructive"
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                : variant === "success"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
            )}
          >
            {variant === "destructive" ? (
              <AlertTriangle size={38} className="text-rose-600 dark:text-rose-400" />
            ) : variant === "success" ? (
              <CheckCircle size={38} className="text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Info size={38} className="text-blue-600 dark:text-blue-400" />
            )}
          </div>
          <DialogTitle className="text-2xl font-black tracking-tight text-foreground">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base text-muted-foreground font-semibold mt-2 leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 sm:gap-4 w-full mt-6 sm:mt-8">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 h-12 sm:h-13 rounded-2xl font-bold text-sm sm:text-base bg-secondary hover:bg-muted text-foreground/80 hover:text-foreground border border-border/80 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              "flex-1 h-12 sm:h-13 rounded-2xl font-bold text-sm sm:text-base text-white transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 shadow-lg disabled:opacity-50",
              variant === "destructive"
                ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/25 border border-rose-500/30"
                : variant === "success"
                ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25 border border-emerald-500/30"
                : "bg-blue-600 hover:bg-blue-700 shadow-blue-600/25 border border-blue-500/30"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>İşleniyor...</span>
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
