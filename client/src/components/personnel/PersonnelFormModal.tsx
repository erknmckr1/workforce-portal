import { useState, useEffect, useCallback, memo, useRef } from "react";
import { useForm, type SubmitHandler, Controller } from "react-hook-form";
import Webcam from "react-webcam";
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
  SelectValue,
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
  AlertCircle,
  Camera,
  Image as ImageIcon,
  X,
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
  email: z
    .string()
    .email("Geçerli bir e-posta giriniz.")
    .or(z.literal(""))
    .optional(),
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

const LazyLookupSelect = memo(
  ({
    value,
    onChange,
    items,
    placeholder,
    hasError,
  }: {
    value: string | undefined;
    onChange: (val: string) => void;
    items: { id: number | string; name: string }[];
    placeholder: string;
    hasError?: boolean;
  }) => {
    const [open, setOpen] = useState(false);
    const selectedItem = value
      ? items.find((i) => String(i.id) === value)
      : null;

    return (
      <Select value={value} onValueChange={onChange} onOpenChange={setOpen}>
        <SelectTrigger
          className={cn(
            "w-full h-14 px-6 rounded-2xl bg-muted/40 border-none text-sm font-bold shadow-none p-0 flex items-center [&>span]:w-full [&>span]:text-left pl-6 focus:ring-0",
            hasError && "ring-2 ring-destructive",
          )}
        >
          <SelectValue placeholder={placeholder}>
            {selectedItem ? selectedItem.name : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="rounded-2xl border-none shadow-xl max-h-[300px]">
          {open &&
            items.map((item) => (
              <SelectItem
                key={item.id}
                value={String(item.id)}
                className="font-bold py-3 cursor-pointer"
              >
                {item.name}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    );
  },
);
LazyLookupSelect.displayName = "LazyLookupSelect";

interface PersonnelFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPersonnel: Personnel | null;
  lookups: Lookups;
  onSubmit: (
    data: Partial<Personnel> & {
      password?: string;
      photo_data?: string | null;
    },
  ) => Promise<void>;
  isPending: boolean;
}

export function PersonnelFormModal({
  open,
  onOpenChange,
  editingPersonnel,
  lookups,
  onSubmit,
  isPending,
}: PersonnelFormModalProps) {
  const [step, setStep] = useState(1);
  const [photo, setPhoto] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const webcamRef = useRef<Webcam>(null);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setPhoto(imageSrc);
      setIsCameraOpen(false);
    }
  }, [webcamRef]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    trigger,
    reset,
    getValues,
    control,
  } = useForm<PersonnelFormValues>({
    resolver: zodResolver(personnelSchema),
    mode: "onBlur",
    defaultValues: {
      id_dec: "",
      id_hex: "",
      name: "",
      surname: "",
      nick_name: "",
      short_name: "",
      email: "",
      gender: "Erkek",
      address: "",
      role_id: "",
      section: "",
      department: "",
      title: "",
      password: "",
      leave_balance: 0,
      auth1: "",
      auth2: "",
      route: "",
      stop_name: "",
    },
  });

  // Handle data reset/init
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep(1);
    setIsCameraOpen(false);

    if (editingPersonnel) {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL.replace("/api", "");
      const photoPath = editingPersonnel.photo_url 
        ? `${apiBaseUrl}/photos/${editingPersonnel.photo_url}` 
        : null;
      setPhoto(photoPath);

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
        department:
          editingPersonnel.department || editingPersonnel.Department?.id || "",
        title: editingPersonnel.title || editingPersonnel.JobTitle?.id || "",
        leave_balance: Number(editingPersonnel.leave_balance),
        auth1: editingPersonnel.auth1 || "",
        auth2: editingPersonnel.auth2 || "",
        route: editingPersonnel.route || "",
        stop_name: editingPersonnel.stop_name || "",
        password: "",
      });
    } else {
      setPhoto(null);
      reset({
        id_dec: "",
        id_hex: "",
        name: "",
        surname: "",
        nick_name: "",
        short_name: "",
        email: "",
        gender: "Erkek",
        address: "",
        role_id: "",
        section: "",
        department: "",
        title: "",
        password: "",
        leave_balance: 0,
        auth1: "",
        auth2: "",
        route: "",
        stop_name: "",
      });
    }
  }, [open, editingPersonnel, reset]);

  const cleanStr = useCallback((str: string) => {
    const trMap: Record<string, string> = {
      ğ: "g",
      ü: "u",
      ş: "s",
      ı: "i",
      ö: "o",
      ç: "c",
      İ: "i",
      Ğ: "g",
      Ü: "u",
      Ş: "s",
      Ö: "o",
      Ç: "c",
    };
    return str
      .replace(/[ğüşıöçİĞÜŞÖÇ]/g, (match) => trMap[match] || match)
      .toLowerCase();
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
  };

  const handleDecBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const hex = !isNaN(parseInt(val))
      ? parseInt(val).toString(16).toUpperCase()
      : "";
    setValue("id_hex", hex, { shouldValidate: true });
    createPassword();
  };

  const handleNameSurnameBlur = () => {
    if (editingPersonnel) return;

    const name = getValues("name");
    const surname = getValues("surname");

    if (name && surname) {
      const generatedNick = (
        cleanStr(name.charAt(0)) + cleanStr(surname)
      ).replace(/\s/g, "");
      setValue("nick_name", generatedNick, { shouldValidate: true });
      setValue("short_name", `${name} ${surname.charAt(0)}.`, {
        shouldValidate: true,
      });
      createPassword();
    }
  };

  const handleNext = async () => {
    let fields: (keyof PersonnelFormValues)[] = [];
    if (step === 1) fields = ["name", "surname", "id_dec", "id_hex"];
    else if (step === 2) fields = ["role_id"];

    const isValid = await trigger(fields);
    if (isValid) setStep((prev) => prev + 1);
    else toast.error("Lütfen zorunlu alanları kontrol edin.");
  };

  const onFormSubmit: SubmitHandler<PersonnelFormValues> = (values) => {
    if (step !== 3) return; // Sadece son aşamada gönderilmesine izin ver

    const payload = {
      ...values,
      role_id: Number(values.role_id),
      section: values.section ? Number(values.section) : undefined,
      department: values.department ? Number(values.department) : undefined,
      title: values.title ? Number(values.title) : undefined,
      photo_data: photo,
    } as Partial<Personnel> & { password?: string; photo_data?: string | null };

    onSubmit(payload);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Enter") {
      const target = e.target as HTMLElement;

      if (target.tagName === "BUTTON" || target.tagName === "TEXTAREA") {
        return;
      }

      e.preventDefault();
      if (
        target.tagName === "INPUT" &&
        target.getAttribute("name") === "id_dec"
      ) {
        const val = (target as HTMLInputElement).value;
        if (val) {
          const hex = !isNaN(parseInt(val))
            ? parseInt(val).toString(16).toUpperCase()
            : "";
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
                {editingPersonnel ? (
                  <Edit2 size={32} />
                ) : (
                  <UserPlus size={32} />
                )}
              </div>
              <div className="text-left">
                <DialogTitle className="text-3xl font-black tracking-tight">
                  {editingPersonnel
                    ? "Bilgileri Güncelle"
                    : "Yeni Personel Kaydı"}
                </DialogTitle>
                <p className="text-muted-foreground font-bold mt-1 text-sm uppercase tracking-widest leading-none">
                  {step === 1
                    ? "Bölüm 1: Kişisel Veriler"
                    : step === 2
                      ? "Bölüm 2: Pozisyon & Konum"
                      : "Bölüm 3: Hesap & Erişim"}
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
                    step === s
                      ? "bg-primary border-primary text-primary-foreground shadow-md"
                      : step > s
                        ? "bg-green-500 border-green-500 text-card"
                        : "bg-muted/50 border-border text-muted-foreground cursor-pointer hover:bg-muted",
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
                    <div
                      className={cn(
                        "h-full bg-green-500",
                        step > s ? "w-full" : "w-0",
                      )}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => e.preventDefault()}
            onKeyDown={handleKeyDown}
            className="space-y-10"
          >
            {/* STEP 1: Temel Bilgiler */}
            {step === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-left">
                {/* YENİ: FOTOĞRAF ALANI */}
                <div className="lg:col-span-3 flex flex-col items-center sm:flex-row sm:items-start gap-6 border border-border/50 bg-muted/20 p-6 rounded-3xl mb-4">
                  <div className="w-32 h-32 shrink-0 rounded-[2rem] bg-muted flex flex-col items-center justify-center overflow-hidden relative shadow-inner border-2 border-dashed border-border/50">
                    {photo ? (
                      <>
                        <img
                          src={photo}
                          alt="Profil"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setPhoto(null)}
                          className="absolute top-2 right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <UserCircle
                        size={48}
                        className="text-muted-foreground/30"
                      />
                    )}
                  </div>

                  <div className="flex-1 space-y-4 text-center sm:text-left">
                    <div>
                      <h4 className="text-sm font-black text-foreground">
                        Profil Fotoğrafı{" "}
                        <span className="text-muted-foreground font-normal text-xs ml-1">
                          (İsteğe Bağlı)
                        </span>
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Personelin sisteme giriş yaparken veya kimlik kartında
                        kullanılmak üzere bir fotoğrafını kameradan çekebilir
                        veya dosyadan yükleyebilirsiniz.
                      </p>
                    </div>

                    {isCameraOpen ? (
                      <div className="flex flex-col items-center sm:items-start gap-3">
                        <div className="rounded-2xl overflow-hidden border-2 border-primary/20 shadow-xl max-w-sm">
                          <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            videoConstraints={{
                              width: 1280,
                              height: 720,
                              facingMode: "user",
                            }}
                            className="w-full h-auto object-cover"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            onClick={capture}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg rounded-xl h-9 px-4"
                          >
                            <Camera size={16} className="mr-2" /> Fotoğrafı Çek
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsCameraOpen(false)}
                            className="rounded-xl h-9"
                          >
                            Vazgeç
                          </Button>
                        </div>
                      </div>
                    ) : (
                      !photo && (
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-2">
                          <Button
                            type="button"
                            onClick={() => setIsCameraOpen(true)}
                            className="h-10 px-5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary shadow-none font-bold"
                          >
                            <Camera size={16} className="mr-2" /> Kamerayı Aç
                          </Button>
                          <div className="relative">
                            <Input
                              type="file"
                              accept="image/*"
                              className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full"
                              onChange={handleFileUpload}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              className="h-10 px-5 rounded-xl font-bold bg-card"
                            >
                              <ImageIcon
                                size={16}
                                className="mr-2 text-muted-foreground"
                              />{" "}
                              Bilgisayardan Seç
                            </Button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2 text-left">
                    <UserCircle size={14} /> İsim *
                  </label>
                  <Input
                    placeholder="Ahmet"
                    className={cn(
                      "rounded-2xl h-14 bg-muted/40 border-none font-bold",
                      errors.name && "ring-2 ring-destructive",
                    )}
                    {...register("name", { onBlur: handleNameSurnameBlur })}
                  />
                  <ErrorDisplay message={errors.name?.message} />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 text-left">
                    Soyisim *
                  </label>
                  <Input
                    placeholder="Yılmaz"
                    className={cn(
                      "rounded-2xl h-14 bg-muted/40 border-none font-bold",
                      errors.surname && "ring-2 ring-destructive",
                    )}
                    {...register("surname", { onBlur: handleNameSurnameBlur })}
                  />
                  <ErrorDisplay message={errors.surname?.message} />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 text-left">
                    Cinsiyet
                  </label>
                  <Controller
                    control={control}
                    name="gender"
                    render={({ field }) => (
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value || "Erkek"}
                        value={field.value || "Erkek"}
                      >
                        <SelectTrigger className="w-full h-14 px-6 rounded-2xl bg-muted/40 border-none text-sm font-bold shadow-none p-0 flex items-center [&>span]:w-full [&>span]:text-left pl-6 focus:ring-0">
                          <SelectValue placeholder="Seçiniz..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-xl">
                          <SelectItem
                            value="Erkek"
                            className="font-bold py-3 cursor-pointer"
                          >
                            Erkek
                          </SelectItem>
                          <SelectItem
                            value="Kadın"
                            className="font-bold py-3 cursor-pointer"
                          >
                            Kadın
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-primary ml-1 text-left">
                    Kart No (DEC) *
                  </label>
                  <Input
                    disabled={!!editingPersonnel}
                    placeholder="DEC"
                    className={cn(
                      "rounded-2xl h-14 bg-primary/5 border-2 border-primary/20 font-bold text-primary text-lg",
                      errors.id_dec && "border-destructive",
                    )}
                    {...register("id_dec", { onBlur: handleDecBlur })}
                  />
                  <ErrorDisplay message={errors.id_dec?.message} />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 text-left">
                    Kart No (HEX) *
                  </label>
                  <Input
                    disabled={!!editingPersonnel}
                    placeholder="HEX"
                    className={cn(
                      "rounded-2xl h-14 bg-muted/20 border-none font-mono font-bold",
                      errors.id_hex && "ring-2 ring-destructive",
                    )}
                    {...register("id_hex")}
                  />
                  <ErrorDisplay message={errors.id_hex?.message} />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 text-left">
                    Kullanıcı Adı
                  </label>
                  <Input
                    disabled
                    placeholder="ecakir"
                    className="rounded-2xl h-14 bg-muted/40 border-none font-bold"
                    {...register("nick_name")}
                  />
                </div>
              </div>
            )}

            {/* STEP 2: İş & Lokasyon Bilgileri */}
            {step === 2 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 text-left">
                    Görevi / Rolü *
                  </label>
                  <Controller
                    control={control}
                    name="role_id"
                    render={({ field }) => (
                      <LazyLookupSelect
                        value={field.value ? String(field.value) : undefined}
                        onChange={field.onChange}
                        items={lookups.roles}
                        placeholder="Seçiniz..."
                        hasError={!!errors.role_id}
                      />
                    )}
                  />
                  <ErrorDisplay message={errors.role_id?.message} />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 text-left">
                    Bölüm (Section)
                  </label>
                  <Controller
                    control={control}
                    name="section"
                    render={({ field }) => (
                      <LazyLookupSelect
                        value={field.value ? String(field.value) : undefined}
                        onChange={(val) => {
                          field.onChange(val);
                          // Bölüm seçildiğinde otomatik olarak 2. Onaycı (Manager) alanını doldur:
                          const selectedSection = lookups.sections.find(
                            (s) => String(s.id) === val,
                          );
                          if (selectedSection && selectedSection.manager_id) {
                            setValue("auth2", selectedSection.manager_id, {
                              shouldValidate: true,
                              shouldDirty: true,
                            });
                          } else {
                            setValue("auth2", ""); // O bölümün yöneticisi yoksa boşalt
                          }
                        }}
                        items={lookups.sections}
                        placeholder="Seçiniz..."
                      />
                    )}
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 text-left">
                    Birim (Part)
                  </label>
                  <Controller
                    control={control}
                    name="department"
                    render={({ field }) => (
                      <LazyLookupSelect
                        value={field.value ? String(field.value) : undefined}
                        onChange={(val) => {
                          field.onChange(val);
                          // Birim seçildiğinde otomatik olarak 1. Onaycı (Supervisor) alanını doldur:
                          const selectedDepartment = lookups.departments.find(
                            (d) => String(d.id) === val,
                          );
                          if (
                            selectedDepartment &&
                            selectedDepartment.supervisor_id
                          ) {
                            setValue(
                              "auth1",
                              selectedDepartment.supervisor_id,
                              { shouldValidate: true, shouldDirty: true },
                            );
                          } else {
                            setValue("auth1", ""); // O birimin şefi yoksa boşalt
                          }
                        }}
                        items={lookups.departments}
                        placeholder="Seçiniz..."
                      />
                    )}
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 text-left">
                    Ünvan / Görev (Title)
                  </label>
                  <Controller
                    control={control}
                    name="title"
                    render={({ field }) => (
                      <LazyLookupSelect
                        value={field.value ? String(field.value) : undefined}
                        onChange={field.onChange}
                        items={lookups.titles}
                        placeholder="Seçiniz..."
                      />
                    )}
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 text-left">
                    İzin Hakedişi
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.5"
                      className="rounded-2xl h-14 bg-muted/40 border-none font-bold pl-6 pr-14"
                      {...register("leave_balance", { valueAsNumber: true })}
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                      GÜN
                    </span>
                  </div>
                </div>
                <div className="space-y-3 lg:col-span-2">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2 text-left">
                    <MapPin size={14} /> Servis Güzergahı & Durak
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      placeholder="Güzergah"
                      className="rounded-2xl h-14 bg-muted/40 border-none font-bold"
                      {...register("route")}
                    />
                    <Input
                      placeholder="Durak"
                      className="rounded-2xl h-14 bg-muted/40 border-none font-bold"
                      {...register("stop_name")}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Hesap & Yetkiler */}
            {step === 3 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 text-left">
                    E-Posta Adresi
                  </label>
                  <Input
                    type="email"
                    placeholder="eposta@sirket.com"
                    className={cn(
                      "rounded-2xl h-14 bg-muted/40 border-none font-bold",
                      errors.email && "ring-2 ring-destructive",
                    )}
                    {...register("email")}
                  />
                  <ErrorDisplay message={errors.email?.message} />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2 text-left">
                    <Lock size={14} /> Sistem Şifresi
                  </label>
                  <Input
                    disabled
                    type="password"
                    placeholder={
                      editingPersonnel ? "Değiştirmek için..." : "••••••"
                    }
                    className="rounded-2xl h-14 bg-muted/40 border-none font-bold"
                    {...register("password")}
                  />
                </div>
                <div className="space-y-3 lg:col-span-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 text-left">
                    İzin Onaycıları (Hiyerarşi)
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      disabled
                      placeholder="1. Onaycı (ID No / İsim)"
                      className="rounded-2xl h-14 bg-muted/40 border-none font-bold"
                      {...register("auth1")}
                    />
                    <Input
                      disabled
                      placeholder="2. Onaycı (ID No / İsim)"
                      className="rounded-2xl h-14 bg-muted/40 border-none font-bold"
                      {...register("auth2")}
                    />
                  </div>
                </div>
                <div className="md:col-span-2 lg:col-span-3 space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1 text-left">
                    Personel Ev Adresi
                  </label>
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
                onClick={() => step > 1 && setStep((prev) => prev - 1)}
                className={cn(
                  "h-16 px-10 rounded-2xl font-bold text-lg flex items-center gap-3",
                  step === 1
                    ? "opacity-0 pointer-events-none"
                    : "hover:bg-muted",
                )}
              >
                <ChevronLeft size={24} /> Geri Dön
              </Button>

              <div className="flex gap-4">
                {step < 3 ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="h-16 px-12 rounded-2xl bg-primary text-primary-foreground font-bold text-xl shadow-lg flex items-center gap-4"
                  >
                    Devam Et <ChevronRight size={24} />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit(onFormSubmit)}
                    disabled={isPending}
                    className="h-16 px-10 rounded-2xl bg-green-500 hover:bg-green-600 text-card font-bold text-xl shadow-lg flex items-center gap-4"
                  >
                    {isPending
                      ? "Kaydediliyor..."
                      : editingPersonnel
                        ? "Güncellemeyi Tamamla"
                        : "Kaydı Onayla ve Bitir"}{" "}
                    <CheckCircle2 size={24} />
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
