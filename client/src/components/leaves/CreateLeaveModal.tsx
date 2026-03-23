import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarDays,
  MapPin,
  Phone,
  Clock,
  FileText,
  UserCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLeaves, type LeaveRequest } from "@/hooks/useLeaves";
import { useAuthStore } from "@/store/authStore";

const leaveSchema = z.object({
  user_id: z.string().min(1, "Personel seçimi zorunludur."),
  leave_reason_id: z.string().min(1, "İzin nedeni zorunludur."),
  leave_duration_type_id: z.string().min(1, "İzin süresi zorunludur."),
  start_date: z.string().min(1, "Başlangıç tarihi zorunludur."),
  end_date: z.string().min(1, "Bitiş tarihi zorunludur."),
  description: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
}).refine((data) => {
  const start = new Date(data.start_date);
  const end = new Date(data.end_date);
  return end >= start;
}, {
  message: "Bitiş tarihi başlangıç tarihinden önce olamaz.",
  path: ["end_date"]
});

type LeaveFormValues = z.infer<typeof leaveSchema>;

interface CreateLeaveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUser?: { id_dec: string; name: string; surname: string }; // Optional pre-selected user (for HR)
}

export function CreateLeaveModal({
  open,
  onOpenChange,
  targetUser
}: CreateLeaveModalProps) {
  const { user } = useAuthStore();
  const { lookups, createLeave, isCreating } = useLeaves();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
    reset,
  } = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      user_id: targetUser?.id_dec || user?.id_dec || "",
      leave_reason_id: "",
      leave_duration_type_id: "1", // Default: Full Day
      start_date: "",
      end_date: "",
      description: "",
      phone: "",
      address: ""
    }
  });

  useEffect(() => {
    if (open) {
      if (targetUser) {
        setValue("user_id", targetUser.id_dec);
      } else if (user) {
        setValue("user_id", user.id_dec);
      }
    } else {
      reset();
    }
  }, [open, targetUser, user, setValue, reset]);

  const onFormSubmit = async (values: LeaveFormValues) => {
    try {
      const payload: LeaveRequest = {
        ...values,
        leave_reason_id: Number(values.leave_reason_id),
        leave_duration_type_id: Number(values.leave_duration_type_id),
      };

      await createLeave(payload);
      onOpenChange(false);
    } catch {
      // Error handled in hook (toast)
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl  p-0 overflow-hidden border border-border/20 shadow-none bg-card">
        <div className="p-8 lg:p-12 max-h-[92vh] overflow-y-auto custom-scrollbar">
          <DialogHeader className="mb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary">
                <CalendarDays size={32} />
              </div>
              <div className="text-left">
                <DialogTitle className="text-3xl font-black tracking-tight">Yeni İzin Talebi</DialogTitle>
                <DialogDescription className="text-muted-foreground font-bold text-sm uppercase tracking-widest leading-none mt-1">
                  Kayıt Formu
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Personnel Display (Read-only if self, or pre-selected) */}
              <div className="space-y-2 sm:col-span-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                  <UserCircle size={14} /> Personel Bilgisi
                </label>
                <div className="h-14 px-6 rounded-2xl bg-muted/40 border border-border/50 flex items-center font-bold text-foreground">
                  {targetUser ? `${targetUser.name} ${targetUser.surname} (${targetUser.id_dec})` : `${user?.name} ${user?.surname} (${user?.id_dec})`}
                </div>
              </div>

              {/* Leave Reason */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">İzin Nedeni *</label>
                <Controller
                  control={control}
                  name="leave_reason_id"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className={cn("h-14 rounded-2xl bg-muted/40 border-none font-bold", errors.leave_reason_id && "ring-2 ring-destructive")}>
                        <SelectValue placeholder="Nedeni seçin..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-xl">
                        {lookups.reasons.map(reason => (
                          <SelectItem key={reason.id} value={String(reason.id)} className="font-bold py-3">
                            {reason.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.leave_reason_id && <p className="text-xs text-destructive font-bold ml-1">{errors.leave_reason_id.message}</p>}
              </div>

              {/* Duration Type */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">İzin Türü *</label>
                <Controller
                  control={control}
                  name="leave_duration_type_id"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className={cn("h-14 rounded-2xl bg-muted/40 border-none font-bold", errors.leave_duration_type_id && "ring-2 ring-destructive")}>
                        <SelectValue placeholder="Tür seçin..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-xl">
                        {lookups.durationTypes.map(type => (
                          <SelectItem key={type.id} value={String(type.id)} className="font-bold py-3">
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.leave_duration_type_id && <p className="text-xs text-destructive font-bold ml-1">{errors.leave_duration_type_id.message}</p>}
              </div>

              {/* Start Date */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                  <Clock size={14} /> Başlangıç *
                </label>
                <Input
                  type="datetime-local"
                  className={cn("h-14 rounded-2xl bg-muted/40 border-none font-bold", errors.start_date && "ring-2 ring-destructive")}
                  {...register("start_date")}
                />
                {errors.start_date && <p className="text-xs text-destructive font-bold ml-1">{errors.start_date.message}</p>}
              </div>

              {/* End Date */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                  <Clock size={14} /> Bitiş (İşe Dönüş) *
                </label>
                <Input
                  type="datetime-local"
                  className={cn("h-14 rounded-2xl bg-muted/40 border-none font-bold", errors.end_date && "ring-2 ring-destructive")}
                  {...register("end_date")}
                />
                {errors.end_date && <p className="text-xs text-destructive font-bold ml-1">{errors.end_date.message}</p>}
              </div>

              {/* Description */}
              <div className="space-y-2 sm:col-span-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                  <FileText size={14} /> Açıklama
                </label>
                <Textarea
                  placeholder="İzin detaylarını buraya yazabilirsiniz..."
                  className="rounded-[1.5rem] bg-muted/40 border-none font-bold min-h-[100px] p-6 lg:p-8"
                  {...register("description")}
                />
              </div>

              {/* Contact Info Group */}
              <div className="space-y-4 sm:col-span-2 pt-4">
                <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-wider">
                  <div className="h-px flex-1 bg-primary/20" />
                  <span>İletişim Bilgileri (İzindeyken)</span>
                  <div className="h-px flex-1 bg-primary/20" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                      <Phone size={14} /> Telefon
                    </label>
                    <Input
                      placeholder="05xx ..."
                      className="h-14 rounded-2xl bg-muted/40 border-none font-bold"
                      {...register("phone")}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                      <MapPin size={14} /> Adres
                    </label>
                    <Input
                      placeholder="Şehir, İlçe ..."
                      className="h-14 rounded-2xl bg-muted/40 border-none font-bold"
                      {...register("address")}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-8 flex gap-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="h-16 flex-1 rounded-2xl font-bold text-lg hover:bg-muted"
              >
                İptal Et
              </Button>
              <Button
                disabled={isCreating}
                type="submit"
                className="h-16 flex-1 rounded-2xl bg-primary text-primary-foreground font-black text-xl shadow-lg shadow-primary/20"
              >
                {isCreating ? "Kaydediliyor..." : "Talebi Gönder"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
