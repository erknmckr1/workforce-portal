import { useState, useEffect, useCallback, memo } from "react";
import { useForm, type SubmitHandler, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  UserPlus,
  Edit2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  UserCircle,
  MapPin,
  Lock,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Personnel } from "@/hooks/usePersonnel";
import type { Lookups } from "@/hooks/useLookups";

// Zod Schema Definition - Simplified and explicit
const personnelSchema = z.object({
  id_dec: z.string().min(1, "ID numarası zorunludur."),
  id_hex: z.string().min(1, "Kart numarası zorunludur."),
  name: z.string().min(2, "İsim en az 2 karakter olmalıdır."),
  surname: z.string().min(2, "Soyisim en az 2 karakter olmalıdır."),
  nick_name: z.string().optional(),
  short_name: z.string().optional(),
  email: z.string().email("Geçerli bir e-posta giriniz.").or(z.literal("")).optional(),
  gender: z.string().min(1, "Cinsiyet seçimi zorunludur.").optional(),
  address: z.string().optional(),
  role_id: z.string().min(1, "Rol seçimi zorunludur.").or(z.number()),
  section: z.string().or(z.number()).optional(),
  department: z.string().or(z.number()).optional(),
  title: z.string().or(z.number()).optional(),
  password: z.string().optional(),
  leave_balance: z.number().optional(),
  auth1: z.string().optional(),
  auth2: z.string().optional(),
  route: z.string().optional(),
  stop_name: z.string().optional(),
});

type PersonnelFormValues = z.infer<typeof personnelSchema>;

const ErrorDisplay = memo(({ message }: { message?: string }) => {
  if (!message) return null;
  return (
    <div className="flex items-center gap-1.5 mt-1.5 text-xs font-bold text-destructive">
      <AlertCircle size={12} />
      {message}
    </div>
  );
});
ErrorDisplay.displayName = "ErrorDisplay";

interface PersonnelFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPersonnel: Personnel | null;
  lookups: Lookups;
  onSubmit: (data: Partial<Personnel> & { password?: string }) => Promise<void>;
  isPending: boolean;
}

export function PersonnelFormModal({
  open,
  onOpenChange,
  editingPersonnel,
  lookups,
  onSubmit,
  isPending
}: PersonnelFormModalProps) {
  const [step, setStep] = useState(1);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    trigger,
    reset,
    getValues,
    control
  } = useForm<PersonnelFormValues>({
    resolver: zodResolver(personnelSchema),
    mode: "onBlur",
    defaultValues: {
      id_dec: "", id_hex: "", name: "", surname: "",
      nick_name: "", short_name: "", email: "", gender: "Erkek",
      address: "", role_id: "", section: "", department: "",
      title: "", password: "", leave_balance: 0,
      auth1: "", auth2: "", route: "", stop_name: ""
    }
  });

  // Handle data reset/init
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep(1);

    if (editingPersonnel) {
      reset({
        id_dec: editingPersonnel.id_dec,
        id_hex: editingPersonnel.id_hex,
        name: editingPersonnel.name,
        surname: editingPersonnel.surname,
        nick_name: editingPersonnel.nick_name || "",
        short_name: editingPersonnel.short_name || "",
        email: editingPersonnel.email || "",
        gender: editingPersonnel.gender || "Erkek",
        address: editingPersonnel.address || "",
        role_id: String(editingPersonnel.role_id),
        section: editingPersonnel.section || editingPersonnel.Section?.id || "",
        department: editingPersonnel.department || editingPersonnel.Department?.id || "",
        title: editingPersonnel.title || editingPersonnel.JobTitle?.id || "",
        leave_balance: Number(editingPersonnel.leave_balance),
        auth1: editingPersonnel.auth1 || "",
        auth2: editingPersonnel.auth2 || "",
        route: editingPersonnel.route || "",
        stop_name: editingPersonnel.stop_name || "",
        password: ""
      });
    } else {
      reset({
        id_dec: "", id_hex: "", name: "", surname: "",
        nick_name: "", short_name: "", email: "", gender: "Erkek",
        address: "", role_id: "", section: "", department: "",
        title: "", password: "", leave_balance: 0,
        auth1: "", auth2: "", route: "", stop_name: ""
      });
    }
  }, [open, editingPersonnel, reset]);

  const cleanStr = useCallback((str: string) => {
    const trMap: Record<string, string> = { 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ı': 'i', 'ö': 'o', 'ç': 'c', 'İ': 'i', 'Ğ': 'g', 'Ü': 'u', 'Ş': 's', 'Ö': 'o', 'Ç': 'c' };
    return str.replace(/[ğüşıöçİĞÜŞÖÇ]/g, match => trMap[match] || match).toLowerCase();
  }, []);

  const createPassword = () => {
    if (editingPersonnel) return; // Güncelleme işlemi ise şifreye dokunma
    const nick_name = getValues("nick_name") || "";
    const id_dec = getValues("id_dec") || "";

    // Eğer nick_name veya id_dec boşsa rastgele şifre üretme
    if (nick_name && id_dec) {
      const password = `${nick_name}${id_dec.toString().slice(-4)}`;
      setValue("password", password, { shouldValidate: true });
    }
  }

  const handleDecBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const hex = !isNaN(parseInt(val)) ? parseInt(val).toString(16).toUpperCase() : "";
    setValue("id_hex", hex, { shouldValidate: true });
    createPassword();
  };

  const handleNameSurnameBlur = () => {
    if (editingPersonnel) return;

    const name = getValues("name");
    const surname = getValues("surname");

    if (name && surname) {
      const generatedNick = (cleanStr(name.charAt(0)) + cleanStr(surname)).replace(/\s/g, '');
      setValue("nick_name", generatedNick, { shouldValidate: true });
      setValue("short_name", `${name} ${surname.charAt(0)}.`, { shouldValidate: true });
      createPassword();
    }
  };

  const handleNext = async () => {
    let fields: (keyof PersonnelFormValues)[] = [];
    if (step === 1) fields = ["name", "surname", "id_dec", "id_hex"];
    else if (step === 2) fields = ["role_id"];

    const isValid = await trigger(fields);
    if (isValid) setStep(prev => prev + 1);
    else toast.error("Lütfen zorunlu alanları kontrol edin.");
  };

  const onFormSubmit: SubmitHandler<PersonnelFormValues> = (values) => {
    if (step !== 3) return; // Sadece son aşamada gönderilmesine izin ver

    const payload = {
      ...values,
      role_id: Number(values.role_id),
      section: values.section ? Number(values.section) : undefined,
      department: values.department ? Number(values.department) : undefined,
      title: values.title ? Number(values.title) : undefined
    } as Partial<Personnel> & { password?: string };

    onSubmit(payload);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;

      // Buton veya Textarea içerisindeysek Enter doğal işlevini yapsın (Geri dön, Devam et vb)
      if (target.tagName === 'BUTTON' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Tam bu noktada, e.preventDefault() diyerek formun veya inputların 'otomatik buton tıklatma / submit etme' huyunu öldürüyoruz.
      e.preventDefault();

      // Eğer enter basılan kutu DEC Kart NO ise işi burada yakalıyoruz:
      if (target.tagName === 'INPUT' && target.getAttribute('name') === 'id_dec') {
        const val = (target as HTMLInputElement).value;
        if (val) {
          const hex = !isNaN(parseInt(val)) ? parseInt(val).toString(16).toUpperCase() : "";
          setValue("id_dec", val, { shouldValidate: true });
          setValue("id_hex", hex, { shouldValidate: true });
          createPassword();
        }
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-5xl rounded-[3rem] p-0 overflow-hidden border border-border/20 shadow-none bg-card">
        <div className="p-8 lg:p-14 max-h-[92vh] overflow-y-auto custom-scrollbar">
          <DialogHeader className="mb-10 flex-row justify-between items-start space-y-0">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary">
                {editingPersonnel ? <Edit2 size={32} /> : <UserPlus size={32} />}
              </div>
              <div className="text-left">
                <DialogTitle className="text-3xl font-black tracking-tight">
                  {editingPersonnel ? "Bilgileri Güncelle" : "Yeni Personel Kaydı"}
                </DialogTitle>
                <p className="text-muted-foreground font-bold mt-1 text-sm uppercase tracking-widest leading-none">
                  {step === 1 ? "Bölüm 1: Kişisel Veriler" : step === 2 ? "Bölüm 2: Pozisyon & Konum" : "Bölüm 3: Hesap & Erişim"}
                </p>
              </div>
            </div>
          </DialogHeader>

          {/* Adım Göstergesi */}
          <div className="flex items-center justify-center gap-4 mb-10">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center group">
                <div
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center font-bold border-2",
                    step === s ? "bg-primary border-primary text-primary-foreground shadow-md" :
                      step > s ? "bg-green-500 border-green-500 text-card" : "bg-muted/50 border-border text-muted-foreground cursor-pointer hover:bg-muted"
                  )}
                  onClick={async () => {
                    if (s < step) setStep(s);
                    else if (s > step && (await trigger())) setStep(s);
                  }}
                >
                  {step > s ? <CheckCircle2 size={24} /> : s}
                </div>
                {s < 3 && (
                  <div className="mx-2 w-12 h-1 rounded-full overflow-hidden bg-muted/50">
                    <div className={cn("h-full bg-green-500", step > s ? "w-full" : "w-0")} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={(e) => e.preventDefault()} onKeyDown={handleKeyDown} className="space-y-10">
            {/* STEP 1: Temel Bilgiler */}
            {step === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2 text-left">
                    <UserCircle size={14} /> İsim *
                  </label>
                  <Input
                    placeholder="Ahmet"
                    className={cn("rounded-2xl h-14 bg-muted/40 border-none font-bold", errors.name && "ring-2 ring-destructive")}
                    {...register("name", { onBlur: handleNameSurnameBlur })}
                  />
                  <ErrorDisplay message={errors.name?.message} />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 text-left">Soyisim *</label>
                  <Input
                    placeholder="Yılmaz"
                    className={cn("rounded-2xl h-14 bg-muted/40 border-none font-bold", errors.surname && "ring-2 ring-destructive")}
                    {...register("surname", { onBlur: handleNameSurnameBlur })}
                  />
                  <ErrorDisplay message={errors.surname?.message} />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 text-left">Cinsiyet</label>
                  <Controller
                    control={control}
                    name="gender"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} defaultValue={field.value || "Erkek"} value={field.value || "Erkek"}>
                        <SelectTrigger className="w-full h-14 px-6 rounded-2xl bg-muted/40 border-none text-sm font-bold shadow-none p-0 flex items-center [&>span]:w-full [&>span]:text-left pl-6 focus:ring-0">
                          <SelectValue placeholder="Seçiniz..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-xl">
                          <SelectItem value="Erkek" className="font-bold py-3 cursor-pointer">Erkek</SelectItem>
                          <SelectItem value="Kadın" className="font-bold py-3 cursor-pointer">Kadın</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-primary ml-1 text-left">Kart No (DEC) *</label>
                  <Input
                    disabled={!!editingPersonnel}
                    placeholder="DEC"
                    className={cn("rounded-2xl h-14 bg-primary/5 border-2 border-primary/20 font-bold text-primary text-lg", errors.id_dec && "border-destructive")}
                    {...register("id_dec", { onBlur: handleDecBlur })}
                  />
                  <ErrorDisplay message={errors.id_dec?.message} />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 text-left">Kart No (HEX) *</label>
                  <Input
                    disabled={!!editingPersonnel}
                    placeholder="HEX"
                    className={cn("rounded-2xl h-14 bg-muted/20 border-none font-mono font-bold", errors.id_hex && "ring-2 ring-destructive")}
                    {...register("id_hex")}
                  />
                  <ErrorDisplay message={errors.id_hex?.message} />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 text-left">Kullanıcı Adı</label>
                  <Input disabled placeholder="ecakir" className="rounded-2xl h-14 bg-muted/40 border-none font-bold" {...register("nick_name")} />
                </div>
              </div>
            )}

            {/* STEP 2: İş & Lokasyon Bilgileri */}
            {step === 2 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 text-left">Görevi / Rolü *</label>
                  <Controller
                    control={control}
                    name="role_id"
                    render={({ field }) => (
                      <Select onValueChange={(val) => field.onChange(val)} value={field.value ? String(field.value) : undefined}>
                        <SelectTrigger className={cn("w-full h-14 px-6 rounded-2xl bg-muted/40 border-none text-sm font-bold shadow-none p-0 flex items-center [&>span]:w-full [&>span]:text-left pl-6 focus:ring-0", errors.role_id && "ring-2 ring-destructive")}>
                          <SelectValue placeholder="Seçiniz..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-xl max-h-[300px]">
                          {lookups.roles.map(r => (
                            <SelectItem key={r.id} value={String(r.id)} className="font-bold py-3 cursor-pointer">{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <ErrorDisplay message={errors.role_id?.message} />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 text-left">Bölüm (Section)</label>
                  <Controller
                    control={control}
                    name="section"
                    render={({ field }) => (
                      <Select onValueChange={(val) => field.onChange(val)} value={field.value ? String(field.value) : undefined}>
                        <SelectTrigger className="w-full h-14 px-6 rounded-2xl bg-muted/40 border-none text-sm font-bold shadow-none p-0 flex items-center [&>span]:w-full [&>span]:text-left pl-6 focus:ring-0">
                          <SelectValue placeholder="Seçiniz..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-xl max-h-[300px]">
                          {lookups.sections.map(s => (
                            <SelectItem key={s.id} value={String(s.id)} className="font-bold py-3 cursor-pointer">{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 text-left">İzin Hakedişi</label>
                  <div className="relative">
                    <Input type="number" step="0.5" className="rounded-2xl h-14 bg-muted/40 border-none font-bold pl-6 pr-14" {...register("leave_balance", { valueAsNumber: true })} />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">GÜN</span>
                  </div>
                </div>
                <div className="space-y-3 lg:col-span-2">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2 text-left">
                    <MapPin size={14} /> Servis Güzergahı & Durak
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <Input placeholder="Güzergah" className="rounded-2xl h-14 bg-muted/40 border-none font-bold" {...register("route")} />
                    <Input placeholder="Durak" className="rounded-2xl h-14 bg-muted/40 border-none font-bold" {...register("stop_name")} />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Hesap & Yetkiler */}
            {step === 3 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 text-left">E-Posta Adresi</label>
                  <Input
                    type="email"
                    placeholder="eposta@sirket.com"
                    className={cn("rounded-2xl h-14 bg-muted/40 border-none font-bold", errors.email && "ring-2 ring-destructive")}
                    {...register("email")}
                  />
                  <ErrorDisplay message={errors.email?.message} />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2 text-left">
                    <Lock size={14} /> Sistem Şifresi
                  </label>
                  <Input disabled type="password" placeholder={editingPersonnel ? "Değiştirmek için..." : "••••••"} className="rounded-2xl h-14 bg-muted/40 border-none font-bold" {...register("password")} />
                </div>
                <div className="space-y-3 lg:col-span-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 text-left">İzin Onaycıları (Hiyerarşi)</label>
                  <div className="grid grid-cols-2 gap-4">
                    <Input placeholder="1. Onaycı (ID No / İsim)" className="rounded-2xl h-14 bg-muted/40 border-none font-bold" {...register("auth1")} />
                    <Input placeholder="2. Onaycı (ID No / İsim)" className="rounded-2xl h-14 bg-muted/40 border-none font-bold" {...register("auth2")} />
                  </div>
                </div>
                <div className="md:col-span-2 lg:col-span-3 space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 text-left">Personel Ev Adresi</label>
                  <textarea
                    className="w-full h-32 p-6 rounded-[2rem] bg-muted/40 border-none text-sm font-bold resize-none"
                    placeholder="Açık adres..."
                    {...register("address")}
                  />
                </div>
              </div>
            )}

            <div className="pt-10 border-t border-border/50 flex items-center justify-between gap-6">
              <Button
                type="button"
                variant="ghost"
                onClick={() => step > 1 && setStep(prev => prev - 1)}
                className={cn("h-16 px-10 rounded-2xl font-bold text-lg flex items-center gap-3", step === 1 ? "opacity-0 pointer-events-none" : "hover:bg-muted")}
              >
                <ChevronLeft size={24} /> Geri Dön
              </Button>

              <div className="flex gap-4">
                {step < 3 ? (
                  <Button type="button" onClick={handleNext} className="h-16 px-12 rounded-2xl bg-primary text-primary-foreground font-bold text-xl shadow-lg flex items-center gap-4">
                    Devam Et <ChevronRight size={24} />
                  </Button>
                ) : (
                  <Button type="button" onClick={handleSubmit(onFormSubmit)} disabled={isPending} className="h-16 px-10 rounded-2xl bg-green-500 hover:bg-green-600 text-card font-bold text-xl shadow-lg flex items-center gap-4">
                    {isPending ? "Kaydediliyor..." : (editingPersonnel ? "Güncellemeyi Tamamla" : "Kaydı Onayla ve Bitir")} <CheckCircle2 size={24} />
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
