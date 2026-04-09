import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Clock, FileText, Phone, MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLeaves, type LeaveRequest, type ILeave } from "@/hooks/useLeaves";

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
  if (!data.start_date || !data.end_date) return true;
  const start = new Date(data.start_date);
  const end = new Date(data.end_date);
  return end >= start;
}, {
  message: "Bitiş tarihi başlangıç tarihinden önce olamaz.",
  path: ["end_date"]
});

type LeaveFormValues = z.infer<typeof leaveSchema>;

const HOURS = Array.from({ length: 11 }, (_, i) => String(i + 7).padStart(2, "0")); // 07:00 - 17:00
const MINUTES = ["00", "15", "30", "45"];

interface SharedLeaveFormProps {
  userId: string;
  defaultPhone?: string | null;
  defaultAddress?: string | null;
  editingLeave?: ILeave | null;
  isKioskMode?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function SharedLeaveForm({
  userId,
  defaultPhone,
  defaultAddress,
  editingLeave,
  isKioskMode = false,
  onSuccess,
  onCancel
}: SharedLeaveFormProps) {
  const { lookups, createLeave, updateLeave, isCreating, isUpdating } = useLeaves();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    watch,
    getValues,
    formState: { errors },
    reset,
  } = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      user_id: userId || "",
      leave_reason_id: "",
      leave_duration_type_id: "1",
      start_date: "",
      end_date: "",
      description: "",
      phone: defaultPhone || "",
      address: defaultAddress || ""
    }
  });

  const start_date_val = watch("start_date");
  const end_date_val = watch("end_date");

  useEffect(() => {
    if (editingLeave) {
      const formatForInput = (dateStr: string) => {
        const date = new Date(dateStr);
        const offset = date.getTimezoneOffset() * 60000;
        return (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
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
    } else {
      setValue("user_id", userId);
      if (defaultPhone) setValue("phone", defaultPhone);
      if (defaultAddress) setValue("address", defaultAddress);
    }
  }, [editingLeave, userId, defaultPhone, defaultAddress, setValue, reset]);

  const updateDateTime = (field: "start_date" | "end_date", part: "date" | "hour" | "minute", val: string) => {
    const current = getValues(field) || `${new Date().toISOString().split('T')[0]}T09:00`;
    const [date, time] = current.split("T");
    const [hour, minute] = (time || "09:00").split(":");
    let newDate = date, newHour = hour, newMinute = minute;
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
      
      if (!editingLeave && isKioskMode) {
        reset();
      }
      
      onSuccess?.();
    } catch {
      // Error is handled in the hook via toast
    }
  };

  const isSaving = isCreating || isUpdating;

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Sol Kolon */}
        <div className="lg:col-span-3 space-y-6">
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
                    <SelectContent className="rounded-2xl border-none shadow-xl z-110">
                      {lookups.reasons.map(reason => (
                        <SelectItem key={reason.id} value={String(reason.id)} className="font-bold py-3">{reason.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.leave_reason_id && <p className="text-[10px] text-destructive font-bold ml-1">{errors.leave_reason_id.message}</p>}
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
                    <SelectContent className="rounded-2xl border-none shadow-xl z-110">
                      {lookups.durationTypes.map(type => (
                        <SelectItem key={type.id} value={String(type.id)} className="font-bold py-3">{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2"><Clock size={14}/> Başlangıç Tarihi ve Saati *</label>
              <div className="grid grid-cols-12 gap-3">
                <Input type="date" className={cn("col-span-12 sm:col-span-6 h-16! rounded-2xl bg-muted/40 border-none font-bold", errors.start_date && "ring-2 ring-destructive")} value={start_date_val?.split("T")[0] || ""} onChange={(e) => updateDateTime("start_date", "date", e.target.value)} />
                <div className="col-span-12 sm:col-span-6 flex gap-2">
                  <Select value={(start_date_val?.split("T")[1] || "09:00").split(":")[0]} onValueChange={(val) => updateDateTime("start_date", "hour", val)}>
                    <SelectTrigger className="h-16! rounded-2xl bg-muted/40 border-none font-bold flex-1"><SelectValue placeholder="Saat" /></SelectTrigger>
                    <SelectContent className="max-h-[300px] rounded-2xl border-none shadow-xl z-110">
                      {HOURS.map(h => <SelectItem key={h} value={h} className="font-bold py-4 text-base cursor-pointer">{h}:00</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={(start_date_val?.split("T")[1] || "09:00").split(":")[1]} onValueChange={(val) => updateDateTime("start_date", "minute", val)}>
                    <SelectTrigger className="h-16! rounded-2xl bg-muted/40 border-none font-bold flex-1"><SelectValue placeholder="Dk" /></SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-xl z-110">
                      {MINUTES.map(m => <SelectItem key={m} value={m} className="font-bold py-4 text-base cursor-pointer">:{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {errors.start_date && <p className="text-[10px] text-destructive font-bold ml-1">{errors.start_date.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2"><Clock size={14}/> Bitiş (Dönüş) Tarihi ve Saati *</label>
              <div className="grid grid-cols-12 gap-3">
                <Input type="date" className={cn("col-span-12 sm:col-span-6 h-16! rounded-2xl bg-muted/40 border-none font-bold", errors.end_date && "ring-2 ring-destructive")} value={end_date_val?.split("T")[0] || ""} onChange={(e) => updateDateTime("end_date", "date", e.target.value)} />
                <div className="col-span-12 sm:col-span-6 flex gap-2">
                  <Select value={(end_date_val?.split("T")[1] || "17:00").split(":")[0]} onValueChange={(val) => updateDateTime("end_date", "hour", val)}>
                    <SelectTrigger className="h-16! rounded-2xl bg-muted/40 border-none font-bold flex-1"><SelectValue placeholder="Saat" /></SelectTrigger>
                    <SelectContent className="max-h-[300px] rounded-2xl border-none shadow-xl z-110">
                      {HOURS.map(h => <SelectItem key={h} value={h} className="font-bold py-4 text-base cursor-pointer">{h}:00</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={(end_date_val?.split("T")[1] || "17:00").split(":")[1]} onValueChange={(val) => updateDateTime("end_date", "minute", val)}>
                    <SelectTrigger className="h-16! rounded-2xl bg-muted/40 border-none font-bold flex-1"><SelectValue placeholder="Dk" /></SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-xl z-110">
                      {MINUTES.map(m => <SelectItem key={m} value={m} className="font-bold py-4 text-base cursor-pointer">:{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {errors.end_date && <p className="text-[10px] text-destructive font-bold ml-1">{errors.end_date.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2"><FileText size={14}/> Açıklama</label>
            <Textarea placeholder="Notunuzu buraya yazın..." className="rounded-[1.5rem] bg-muted/40 border-none font-bold min-h-[120px] p-6 lg:p-8 focus-visible:ring-primary/20" {...register("description")} />
          </div>
        </div>

        {/* Sağ Kolon */}
        <div className="lg:col-span-2 flex flex-col justify-between">
          <div className="space-y-6">
            {!isKioskMode && (
              <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-wider">
                <div className="h-px flex-1 bg-primary/20" />
                <span>İletişim Bilgileri</span>
                <div className="h-px flex-1 bg-primary/20" />
              </div>
            )}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2"><Phone size={14}/> Telefon</label>
                <Input placeholder="05xx..." className="h-16! rounded-2xl bg-muted/40 border-none font-bold text-lg" {...register("phone")} />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2"><MapPin size={14}/> Adres</label>
                <Input placeholder="Şehir, İlçe..." className="h-16! rounded-2xl bg-muted/40 border-none font-bold text-lg" {...register("address")} />
              </div>
            </div>
          </div>

          <div className="pt-10 space-y-4">
            <Button disabled={isSaving} type="submit" className="h-20 w-full rounded-2xl bg-primary text-primary-foreground font-black text-2xl shadow-lg shadow-primary/20 active:scale-95">
              {isSaving ? <Loader2 className="animate-spin" /> : (editingLeave ? "Güncelle" : "Talebi Gönder")}
            </Button>
            
            {!isKioskMode && onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel} className="h-14 w-full rounded-2xl font-bold text-lg hover:bg-muted">
                Vazgeç
              </Button>
            )}

            {isKioskMode && (
              <p className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-2">
                Lütfen tüm alanları kontrol ediniz.
              </p>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
