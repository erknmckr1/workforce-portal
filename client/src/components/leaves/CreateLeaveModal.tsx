import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { CalendarDays, UserCircle } from "lucide-react";
import { type ILeave } from "@/hooks/useLeaves";
import { useAuthStore } from "@/store/authStore";
import { SharedLeaveForm } from "./SharedLeaveForm";

interface CreateLeaveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUser?: { id_dec: string; name: string; surname: string; phone?: string | null; address?: string | null }; // Optional pre-selected user
  editingLeave?: ILeave | null;
}

export function CreateLeaveModal({
  open,
  onOpenChange,
  targetUser,
  editingLeave
}: CreateLeaveModalProps) {
  const { user } = useAuthStore();

  const activeUserId = targetUser?.id_dec || user?.id_dec || "";
  const activeUserPhone = targetUser?.phone || (user as any)?.phone || "";
  const activeUserAddress = targetUser?.address || (user as any)?.address || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-5xl p-0 overflow-hidden border border-border/20 shadow-none bg-card">
        <div className="p-8 lg:p-12 max-h-[95vh] overflow-y-auto lg:overflow-visible custom-scrollbar">
          <DialogHeader className="mb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16! rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary">
                <CalendarDays size={32} />
              </div>
              <div className="text-left">
                <DialogTitle className="text-3xl font-black tracking-tight">
                  {editingLeave ? "İzin Talebi Düzenle" : "Yeni İzin Talebi"}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground font-bold text-sm uppercase tracking-widest leading-none mt-1">
                  {editingLeave ? `Talep No: #${editingLeave.id}` : "Kayıt Formu"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="mb-6 space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
              <UserCircle size={14} /> Personel Bilgisi
            </label>
            <div className="h-16! px-6 rounded-2xl bg-muted/40 border border-border/50 flex items-center font-bold text-foreground">
              {targetUser 
                ? `${targetUser.name} ${targetUser.surname} (${targetUser.id_dec})` 
                : `${user?.name} ${user?.surname} (${user?.id_dec})`}
            </div>
          </div>

          <SharedLeaveForm
            userId={activeUserId}
            defaultPhone={activeUserPhone}
            defaultAddress={activeUserAddress}
            editingLeave={editingLeave}
            onSuccess={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
            isKioskMode={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

