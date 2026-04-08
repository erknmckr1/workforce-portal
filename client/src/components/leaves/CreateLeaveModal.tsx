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
import { useLeaves, type LeaveRequest, type ILeave } from "@/hooks/useLeaves";
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
  editingLeave?: ILeave | null; // Pass a leave to switch to edit mode
}

const HOURS = Array.from({ length: 11 }, (_, i) => String(i + 7).padStart(2, "0")); // 07:00 - 17:00
const MINUTES = ["00", "15", "30", "45"];

export function CreateLeaveModal({
  open,
  onOpenChange,
  targetUser,
  editingLeave
}: CreateLeaveModalProps) {
  const { user } = useAuthStore();
  const { lookups, createLeave, isCreating, updateLeave, isUpdating } = useLeaves();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    watch,
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

  const start_date_val = watch("start_date");
  const end_date_val = watch("end_date");

  useEffect(() => {
    if (open) {
      if (editingLeave) {
        const formatForInput = (dateStr: string) => {
          const date = new Date(dateStr);
          const offset = date.getTimezoneOffset() * 60000;
          const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
          return localISOTime;
        };

        reset({
          user_id: String(editingLeave.user_id),
          leave_reason_id: String(editingLeave.leave_reason_id),
          leave_duration_type_id: String(editingLeave.leave_duration_type_id),
          start_date: formatForInput(editingLeave.start_date),
          end_date: formatForInput(editingLeave.end_date),
          description: editingLeave.description || "",
          phone: editingLeave.phone || "",
          address: editingLeave.address || ""
        });
      } else if (targetUser) {
        setValue("user_id", targetUser.id_dec);
      } else if (user) {
        setValue("user_id", user.id_dec);
      }
    } else {
      reset();
    }
  }, [open, targetUser, user, setValue, reset, editingLeave]);

  const updateDateTime = (field: "start_date" | "end_date", part: "date" | "hour" | "minute", val: string) => {
    const current = watch(field) || `${new Date().toISOString().split('T')[0]}T09:00`;
    const [date, time] = current.split("T");
    const [hour, minute] = (time || "09:00").split(":");

    let newDate = date;
    let newHour = hour;
    let newMinute = minute;

    if (part === "date") newDate = val;
    if (part === "hour") newHour = val;
    if (part === "minute") newMinute = val;

    setValue(field, `${newDate}T${newHour}:${newMinute}`, { shouldValidate: true });
  };

  const onFormSubmit = async (values: LeaveFormValues) => {
    try {
      const payload: LeaveRequest = {
        ...values,
        leave_reason_id: Number(values.leave_reason_id),
        leave_duration_type_id: Number(values.leave_duration_type_id),
      };

      if (editingLeave?.id) {
        await updateLeave({ id: editingLeave.id, data: { ...payload, user_id: values.user_id } });
      } else {
        await createLeave(payload);
      }
      onOpenChange(false);
    } catch {
      // Error handled in hook (toast)
    }
  };

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
                <DialogTitle className="text-3xl font-black tracking-tight">{editingLeave ? "İzin Talebi Düzenle" : "Yeni İzin Talebi"}</DialogTitle>
                <DialogDescription className="text-muted-foreground font-bold text-sm uppercase tracking-widest leading-none mt-1">
                  {editingLeave ? `Talep No: #${editingLeave.id}` : "Kayıt Formu"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit(onFormSubmit)} className="grid grid-cols-1 lg:grid-cols-5 gap-10">
            {/* Left Column: Main Info */}
            <div className="lg:col-span-3 space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                  <UserCircle size={14} /> Personel Bilgisi
                </label>
                <div className="h-16! px-6 rounded-2xl bg-muted/40 border border-border/50 flex items-center font-bold text-foreground">
                  {targetUser ? `${targetUser.name} ${targetUser.surname} (${targetUser.id_dec})` : `${user?.name} ${user?.surname} (${user?.id_dec})`}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">İzin Nedeni *</label>
                  <Controller
                    control={control}
                    name="leave_reason_id"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className={cn("h-16! rounded-2xl bg-muted/40 border-none font-bold", errors.leave_reason_id && "ring-2 ring-destructive")}>
                          <SelectValue placeholder="Seçin..." />
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

                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">İzin Türü *</label>
                  <Controller
                    control={control}
                    name="leave_duration_type_id"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className={cn("h-16! rounded-2xl bg-muted/40 border-none font-bold", errors.leave_duration_type_id && "ring-2 ring-destructive")}>
                          <SelectValue placeholder="Seçin..." />
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
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                  <Clock size={14} /> Başlangıç Tarihi ve Saati *
                </label>
                <div className="grid grid-cols-12 gap-3">
                  <Input
                    type="date"
                    className={cn("col-span-12 sm:col-span-6 h-16! rounded-2xl bg-muted/40 border-none font-bold", errors.start_date && "ring-2 ring-destructive")}
                    value={start_date_val?.split("T")[0] || ""}
                    onChange={(e) => updateDateTime("start_date", "date", e.target.value)}
                  />
                  <div className="col-span-12 sm:col-span-6 flex space-x-2">
                    <Select
                      value={(start_date_val?.split("T")[1] || "09:00").split(":")[0]}
                      onValueChange={(val) => updateDateTime("start_date", "hour", val)}
                    >
                      <SelectTrigger className="h-16! rounded-2xl bg-muted/40 border-none font-bold flex-1">
                        <SelectValue placeholder="Saat" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px] rounded-2xl border-none shadow-xl">
                        {HOURS.map(h => <SelectItem key={h} value={h} className="font-bold">{h}:00</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select
                      value={(start_date_val?.split("T")[1] || "09:00").split(":")[1]}
                      onValueChange={(val) => updateDateTime("start_date", "minute", val)}
                    >
                      <SelectTrigger className="h-16! rounded-2xl bg-muted/40 border-none font-bold flex-1">
                        <SelectValue placeholder="Dk" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-xl">
                        {MINUTES.map(m => <SelectItem key={m} value={m} className="font-bold">:{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {errors.start_date && <p className="text-xs text-destructive font-bold ml-1">{errors.start_date.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                  <Clock size={14} /> Bitiş (İşe Dönüş) Tarihi ve Saati *
                </label>
                <div className="grid grid-cols-12 gap-3">
                  <Input
                    type="date"
                    className={cn("col-span-12 sm:col-span-6 h-16! rounded-2xl bg-muted/40 border-none font-bold", errors.end_date && "ring-2 ring-destructive")}
                    value={end_date_val?.split("T")[0] || ""}
                    onChange={(e) => updateDateTime("end_date", "date", e.target.value)}
                  />
                  <div className="col-span-12 sm:col-span-6 flex space-x-2">
                    <Select
                      value={(end_date_val?.split("T")[1] || "17:00").split(":")[0]}
                      onValueChange={(val) => updateDateTime("end_date", "hour", val)}
                    >
                      <SelectTrigger className="h-16! rounded-2xl bg-muted/40 border-none font-bold flex-1">
                        <SelectValue placeholder="Saat" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px] rounded-2xl border-none shadow-xl">
                        {HOURS.map(h => <SelectItem key={h} value={h} className="font-bold">{h}:00</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select
                      value={(end_date_val?.split("T")[1] || "18:00").split(":")[1]}
                      onValueChange={(val) => updateDateTime("end_date", "minute", val)}
                    >
                      <SelectTrigger className="h-16! rounded-2xl bg-muted/40 border-none font-bold flex-1">
                        <SelectValue placeholder="Dk" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-xl">
                        {MINUTES.map(m => <SelectItem key={m} value={m} className="font-bold">:{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {errors.end_date && <p className="text-xs text-destructive font-bold ml-1">{errors.end_date.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                  <FileText size={14} /> Açıklama
                </label>
                <Textarea
                  placeholder="İzin detayları..."
                  className="rounded-[1.5rem] bg-muted/40 border-none font-bold min-h-[120px] p-6 lg:p-8"
                  {...register("description")}
                />
              </div>
            </div>

            {/* Right Column: Contact & Buttons */}
            <div className="lg:col-span-2 flex flex-col justify-between">
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-wider">
                  <div className="h-px flex-1 bg-primary/20" />
                  <span>İletişim Bilgileri</span>
                  <div className="h-px flex-1 bg-primary/20" />
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                      <Phone size={14} /> Telefon
                    </label>
                    <Input
                      placeholder="05xx ..."
                      className="h-16! rounded-2xl bg-muted/40 border-none font-bold"
                      {...register("phone")}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                      <MapPin size={14} /> Adres
                    </label>
                    <Input
                      placeholder="Şehir, İlçe ..."
                      className="h-16! rounded-2xl bg-muted/40 border-none font-bold"
                      {...register("address")}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-10 space-y-4">
                <Button
                  disabled={isCreating || isUpdating}
                  type="submit"
                  className="h-18 w-full rounded-2xl bg-primary text-primary-foreground font-black text-xl shadow-lg shadow-primary/20"
                >
                  {isCreating || isUpdating ? "Kaydediliyor..." : (editingLeave ? "Güncelle" : "Talebi Gönder")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="h-14 w-full rounded-2xl font-bold text-lg hover:bg-muted"
                >
                  Vazgeç
                </Button>
              </div>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
