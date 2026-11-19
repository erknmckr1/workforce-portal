import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, X, Loader2, Upload, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import apiClient from "@/lib/api";
import { toast } from "sonner";
import {
  type ScrapRecord,
  type ScrapFormData,
  INITIAL_SCRAP_FORM,
  DEFAULT_LOCATIONS,
  KARAT_OPTIONS,
  COLOR_OPTIONS,
  DEFAULT_SCRAP_IMAGE,
  DEFAULT_SCRAP_REASONS,
} from "@/types/scrap";

export interface ScrapFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialRecord?: ScrapRecord | null;
}

export default function ScrapFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialRecord,
}: ScrapFormModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isFetchingSap, setIsFetchingSap] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<ScrapFormData>({
    defaultValues: INITIAL_SCRAP_FORM,
  });

  const scrapReason = watch("scrap_reason");
  const isScrap = watch("is_scrap");

  // Modal her açıldığında veya initialRecord değiştiğinde formu doldur/sıfırla
  useEffect(() => {
    if (!isOpen) return;

    if (initialRecord) {
      const isKnownReason = DEFAULT_SCRAP_REASONS.includes(
        initialRecord.scrap_reason || ""
      );
      reset({
        order_no: initialRecord.order_no || "",
        karat: initialRecord.karat || "",
        color: initialRecord.color || "Y",
        description: initialRecord.description || "",
        wire_code: initialRecord.wire_code || "",
        defect_note: initialRecord.defect_note || "",
        is_scrap: initialRecord.is_scrap,
        scrap_location: initialRecord.scrap_location || "ÖRME",
        scrap_reason: initialRecord.scrap_reason
          ? isKnownReason
            ? initialRecord.scrap_reason
            : "Diğer"
          : "Döküm Boşluğu / Porozite",
        custom_reason:
          initialRecord.scrap_reason && !isKnownReason
            ? initialRecord.scrap_reason
            : "",
      });
      setSelectedFile(null);
      setFilePreviewUrl(initialRecord.image_url || null);
    } else {
      reset(INITIAL_SCRAP_FORM);
      setSelectedFile(null);
      setFilePreviewUrl(null);
    }
  }, [isOpen, initialRecord, reset]);

  // SAP'den Sipariş Bilgisi Sorgula
  const handleFetchSapOrder = async (orderNo: string) => {
    const clean = orderNo.trim();
    if (!clean) return;
    setIsFetchingSap(true);
    try {
      const res = await apiClient.get(`/scrap-tracking/order/${clean}`);
      const data = res.data;
      if (data) {
        if (data.karat) setValue("karat", data.karat);
        if (data.color) setValue("color", data.color);
        if (data.description) setValue("description", data.description);
        toast.success(`Sipariş bilgileri SAP'den getirildi (${clean})`);
      }
    } catch {
      // Bulunamadıysa sessizce devam et
    } finally {
      setIsFetchingSap(false);
    }
  };

  // Dosya Seçildiğinde
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setFilePreviewUrl(URL.createObjectURL(file));
    }
  };

  // Form Gönderimi (Submit)
  const onSubmit = async (data: ScrapFormData) => {
    if (!data.order_no.trim()) {
      toast.error("Lütfen Sipariş Numarasını giriniz.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("order_no", data.order_no.trim());
      formData.append("karat", data.karat.trim());
      formData.append("color", data.color.trim());
      formData.append("description", data.description.trim());
      formData.append("wire_code", data.wire_code.trim());
      formData.append("defect_note", data.defect_note.trim());
      formData.append("is_scrap", String(data.is_scrap));
      formData.append("scrap_location", data.scrap_location.trim());

      const finalReason =
        data.scrap_reason === "Diğer"
          ? data.custom_reason.trim() || "Diğer"
          : data.scrap_reason;
      formData.append("scrap_reason", finalReason.trim());

      if (selectedFile) {
        formData.append("image", selectedFile);
      }

      if (initialRecord) {
        await apiClient.put(`/scrap-tracking/${initialRecord.id}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Hurda kaydı başarıyla güncellendi.");
      } else {
        await apiClient.post("/scrap-tracking", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Yeni hurda kaydı oluşturuldu.");
      }

      onSuccess();
      onClose();
    } catch (error: unknown) {
      console.error("Kaydetme hatası:", error);
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Kayıt kaydedilirken hata oluştu.");
    }
  };

  if (!isOpen) return null;

  const orderNoRegister = register("order_no", { required: true });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="font-black text-sm uppercase tracking-tight text-foreground">
                {initialRecord ? "Hurda Kaydını Düzenle" : "Yeni Hurda / Hata Kaydı"}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Üretim esnasında ayrılan parça veya hatalı yarı mamul bilgileri
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scroll Edilebilir Form İçeriği */}
          <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-4 flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sipariş No */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-foreground">
                  Sipariş No <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    {...orderNoRegister}
                    onBlur={(e) => {
                      orderNoRegister.onBlur(e);
                      handleFetchSapOrder(e.target.value);
                    }}
                    placeholder="Örn: 2111588 veya 4060992"
                    className="w-full h-11 px-3.5 bg-muted/30 border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:border-rose-500 transition-all font-mono"
                  />
                  {isFetchingSap && (
                    <Loader2
                      size={16}
                      className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-rose-500"
                    />
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground block">
                  Yazıp alandan çıktığınızda SAP'den ayar/renk/açıklama otomatik gelir.
                </span>
              </div>

              {/* Ayar */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-foreground">
                  Ayar (Karat)
                </label>
                <select
                  {...register("karat")}
                  className="w-full h-11 px-3.5 bg-muted/30 border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:border-rose-500 transition-all cursor-pointer"
                >
                  <option value="">Ayar Seçiniz (veya SAP'den gelir)</option>
                  {KARAT_OPTIONS.map((k) => (
                    <option key={k} value={k}>
                      {k} Ayar
                    </option>
                  ))}
                </select>
              </div>

              {/* Renk */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-foreground">
                  Renk
                </label>
                <select
                  {...register("color")}
                  className="w-full h-11 px-3.5 bg-muted/30 border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:border-rose-500 transition-all cursor-pointer"
                >
                  {COLOR_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tel Kodu */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-foreground">
                  Tel Kodu
                </label>
                <input
                  type="text"
                  {...register("wire_code")}
                  placeholder="Örn: YT003135 veya YT001025"
                  className="w-full h-11 px-3.5 bg-muted/30 border border-border rounded-xl text-xs font-mono font-bold text-foreground outline-none focus:border-rose-500 transition-all"
                />
              </div>
            </div>

            {/* Açıklama / Model Adı */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-foreground">
                Açıklama (Model / Zincir Adı)
              </label>
              <input
                type="text"
                {...register("description")}
                placeholder="Örn: IB EZME TONDO 50 TR"
                className="w-full h-11 px-3.5 bg-muted/30 border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:border-rose-500 transition-all"
              />
            </div>

            {/* Hata Sebebi / Not */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-foreground">
                Hata Detayı / Not
              </label>
              <textarea
                rows={2}
                {...register("defect_note")}
                placeholder="Örn: Halka ağzından güverse yapmış, astar geri çekiliyor..."
                className="w-full p-3 bg-muted/30 border border-border rounded-xl text-xs font-medium text-foreground outline-none focus:border-rose-500 transition-all resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Hurda Nedeni */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-foreground">
                  Hurda Nedeni <span className="text-rose-500">*</span>
                </label>
                <select
                  {...register("scrap_reason")}
                  className="w-full h-11 px-3.5 bg-muted/30 border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:border-rose-500 transition-all cursor-pointer"
                >
                  {DEFAULT_SCRAP_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              {/* Hurda Yeri (İstasyon) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-foreground">
                  Hurda Yeri (İstasyon)
                </label>
                <select
                  {...register("scrap_location")}
                  className="w-full h-11 px-3.5 bg-muted/30 border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:border-rose-500 transition-all cursor-pointer"
                >
                  {DEFAULT_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Eğer Diğer seçildiyse özel metin kutusu */}
            {scrapReason === "Diğer" && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-foreground">
                  Özel Hurda Nedeni Belirtiniz
                </label>
                <input
                  type="text"
                  {...register("custom_reason")}
                  placeholder="Örn: Özel kalıp patlaması, hatalı kaplama vb."
                  className="w-full h-11 px-3.5 bg-muted/30 border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:border-rose-500 transition-all"
                />
              </div>
            )}

            {/* Hurda Mı? Checkbox */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-foreground block">
                Hurda Durumu
              </label>
              <label className="flex items-center gap-3 h-11 px-4 bg-muted/30 border border-border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="checkbox"
                  {...register("is_scrap")}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer accent-rose-600"
                />
                <span className="text-xs font-black uppercase tracking-wide text-foreground">
                  {isScrap ? "Kesinleşen Hurda" : "İncelemede / Takip Edilecek"}
                </span>
              </label>
            </div>

            {/* Görsel Yükleme (MVP: Standart Stok Görsel Önizleme) */}
            <div className="space-y-2 pt-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-foreground flex items-center justify-between">
                <span>Hurda Görseli</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                accept="image/jpeg,image/png,image/webp,image/jpg"
                className="hidden"
              />

              {filePreviewUrl ? (
                <div className="relative p-3 bg-muted/30 border border-border rounded-2xl flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl overflow-hidden border border-border bg-black/5 shrink-0 shadow-xs">
                    <img src={filePreviewUrl} alt="Önizleme" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <span className="text-xs font-bold text-foreground block">
                      {selectedFile ? selectedFile.name : "Özel Yüklenen Görsel"}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      Özel görsel başarıyla seçildi
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer block"
                    >
                      Görseli Değiştir
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setFilePreviewUrl(null);
                    }}
                    className="p-2 hover:bg-muted text-muted-foreground hover:text-rose-500 rounded-lg cursor-pointer"
                    title="Görseli Kaldır (Stok Görsele Dön)"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <div className="p-3.5 bg-muted/30 border border-border rounded-2xl flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl overflow-hidden border border-border bg-black/10 shrink-0 shadow-xs relative">
                    <img
                      src={DEFAULT_SCRAP_IMAGE}
                      alt="Standart Stok Görsel"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground block">
                        Standart Stok Görsel
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        MVP
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Her kayıtta otomatik olarak mikroskop kalite kontrol hata görseli kullanılır.
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-500 hover:text-rose-600 hover:underline cursor-pointer pt-1"
                    >
                      <Upload size={13} />
                      <span>Farklı Fotoğraf Yükle (İsteğe Bağlı)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobilde ve Masaüstünde Sabit Kalan Alt Buton Barı (Scroll Olmaz) */}
          <div className="p-3.5 sm:p-4 border-t border-border bg-card/95 backdrop-blur-xs flex items-center justify-end gap-2.5 sm:gap-3 shrink-0 shadow-xs">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer text-center"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 sm:flex-initial px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              <span>{initialRecord ? "Güncelle" : "Kaydet"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
