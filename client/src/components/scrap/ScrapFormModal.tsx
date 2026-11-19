import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  AlertTriangle,
  X,
  Loader2,
  Upload,
  Trash2,
  Camera,
  SwitchCamera,
  RotateCcw,
  Check,
  Barcode,
  QrCode,
} from "lucide-react";
import Webcam from "react-webcam";
import { useForm } from "react-hook-form";
import apiClient from "@/lib/api";
import { toast } from "sonner";
import QrBarcodeScannerModal from "@/components/common/QrBarcodeScannerModal";
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

// Base64 Data URL'i File nesnesine dönüştürme yardımcısı
function base64ToFile(dataurl: string, filename: string): File {
  const arr = dataurl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
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
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Kamera State'leri
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const webcamRef = useRef<Webcam>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    getValues,
    formState: { isSubmitting },
  } = useForm<ScrapFormData>({
    defaultValues: INITIAL_SCRAP_FORM,
  });

  const scrapReason = watch("scrap_reason");
  const isScrap = watch("is_scrap");

  // Kamera Video Track'lerini Kesin Olarak Durdur (Kamera Donanım Işığını Söndürür)
  const stopWebcamTracks = useCallback(() => {
    try {
      const videoEl = webcamRef.current?.video;
      if (videoEl && videoEl.srcObject) {
        const stream = videoEl.srcObject as MediaStream;
        stream.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
        videoEl.srcObject = null;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream = (webcamRef.current as any)?.stream as MediaStream | undefined;
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
      }
    } catch (err) {
      console.warn("Webcam stream stop error:", err);
    }
  }, []);

  // Modal Kapatma (Tüm kameraları kapatır)
  const handleModalClose = useCallback(() => {
    stopWebcamTracks();
    setIsCameraOpen(false);
    setIsScannerOpen(false);
    onClose();
  }, [stopWebcamTracks, onClose]);

  // Modal her açıldığında veya initialRecord değiştiğinde formu doldur/sıfırla
  useEffect(() => {
    if (!isOpen) {
      stopWebcamTracks();
      setIsCameraOpen(false);
      setIsScannerOpen(false);
      return;
    }

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

    // Kamera durumunu sıfırla
    setIsCameraOpen(false);
    setCapturedImage(null);
    setCameraError(null);
  }, [isOpen, initialRecord, reset]);

  // Üretim Veritabanından (DB / SAP) Sipariş Bilgisi Sorgula
  const handleFetchSapOrder = async (orderNo: string) => {
    const clean = String(orderNo || "").replace(/^#/, "").trim();
    if (!clean) return;
    setIsFetchingSap(true);
    try {
      const res = await apiClient.get(`/scrap-tracking/order/${clean}`);
      const data = res.data;
      if (data) {
        setValue("order_no", data.order_id || clean);
        if (data.karat) setValue("karat", data.karat);
        if (data.color) setValue("color", data.color);
        if (data.description) setValue("description", data.description);
        if (data.wire_code || data.material_no) {
          setValue("wire_code", data.wire_code || data.material_no);
        }

        const summaryParts = [
          data.karat ? `${data.karat}K` : "",
          data.color ? data.color : "",
          data.description ? data.description : "",
          (data.wire_code || data.material_no) ? `[Tel: ${data.wire_code || data.material_no}]` : "",
        ].filter(Boolean);

        toast.success(
          `Sipariş veritabanından başarıyla getirildi: #${data.order_id || clean} ${
            summaryParts.length > 0 ? `(${summaryParts.join(" ")})` : ""
          }`
        );
      }
    } catch {
      toast.error(`Sipariş (#${clean}) veritabanında bulunamadı.`);
    } finally {
      setIsFetchingSap(false);
    }
  };

  // QR / Barkod Kamerasından Kod Okunduğunda
  const handleQrScan = (decodedText: string) => {
    let clean = (decodedText || "").trim();
    // Eğer QR içerik bir URL ise veya '=' içeriyorsa parametreyi ayıkla
    if (clean.includes("=")) {
      clean = clean.split("=").pop() || clean;
    }
    clean = clean.replace(/^#/, "").trim();
    if (clean) {
      setValue("order_no", clean);
      handleFetchSapOrder(clean);
    }
  };

  // Barkod Okutulduğunda (Enter Key)
  const handleOrderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault(); // Barkod okuyucu Enter bastığında formun erken submit olmasını önle!
      handleFetchSapOrder(e.currentTarget.value);
    }
  };

  // Dosya Seçildiğinde (Galeri veya Native Kamera)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setFilePreviewUrl(URL.createObjectURL(file));
      setIsCameraOpen(false);
      setCapturedImage(null);
    }
  };

  // Fotoğrafı Çek (Deklanşör)
  const handleCapturePhoto = useCallback(() => {
    if (webcamRef.current) {
      const screenshot = webcamRef.current.getScreenshot();
      if (screenshot) {
        setCapturedImage(screenshot);
      } else {
        toast.error("Fotoğraf alınamadı. Lütfen tekrar deneyiniz.");
      }
    }
  }, [webcamRef]);

  // Unmount anında kamerayı durdur
  useEffect(() => {
    return () => {
      stopWebcamTracks();
    };
  }, [stopWebcamTracks]);

  // Çekilen Fotoğrafı Onayla ve Forma Ata
  const handleConfirmPhoto = () => {
    stopWebcamTracks();
    if (capturedImage) {
      const file = base64ToFile(
        capturedImage,
        `hurda_kamera_${Date.now()}.jpg`
      );
      setSelectedFile(file);
      setFilePreviewUrl(capturedImage);
      setCapturedImage(null);
      setIsCameraOpen(false);
      setCameraError(null);
      toast.success("Kamera fotoğrafı başarıyla eklendi.");
    }
  };

  // Yeniden Çek
  const handleRetakePhoto = () => {
    setCapturedImage(null);
  };

  // Kamerayı Kapat
  const handleCloseCamera = () => {
    stopWebcamTracks();
    setIsCameraOpen(false);
    setCapturedImage(null);
    setCameraError(null);
  };

  // Kamera Değiştir (Ön / Arka)
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Form Gönderimi (Submit)
  const onSubmit = async (data: ScrapFormData) => {
    const values = getValues();
    const orderNo = (data.order_no || values.order_no || "").trim();
    if (!orderNo) {
      toast.error("Lütfen Sipariş Numarasını giriniz.");
      return;
    }

    const karat = (data.karat ?? values.karat ?? "").trim();
    const color = (data.color ?? values.color ?? "Y").trim();
    const description = (data.description ?? values.description ?? "").trim();
    const wireCode = (data.wire_code ?? values.wire_code ?? "").trim();
    const defectNote = (data.defect_note ?? values.defect_note ?? "").trim();
    const isScrapVal = data.is_scrap !== undefined ? data.is_scrap : values.is_scrap;
    const scrapLocation = (data.scrap_location ?? values.scrap_location ?? "ÖRME").trim();
    const scrapReasonVal = (data.scrap_reason ?? values.scrap_reason ?? "").trim();
    const customReasonVal = (data.custom_reason ?? values.custom_reason ?? "").trim();

    try {
      const formData = new FormData();
      formData.append("order_no", orderNo);
      formData.append("karat", karat);
      formData.append("color", color);
      formData.append("description", description);
      formData.append("wire_code", wireCode);
      formData.append("defect_note", defectNote);
      formData.append("is_scrap", String(isScrapVal));
      formData.append("scrap_location", scrapLocation);

      const finalReason =
        scrapReasonVal === "Diğer"
          ? customReasonVal || "Diğer"
          : scrapReasonVal;
      formData.append("scrap_reason", finalReason);

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
            onClick={handleModalClose}
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
              {/* Sipariş No / Barkod */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-foreground flex items-center justify-between">
                  <span>
                    Sipariş No / Barkod <span className="text-rose-500">*</span>
                  </span>
                </label>
                <div className="relative">
                  <Barcode
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                    size={16}
                  />
                  <input
                    type="text"
                    required
                    {...orderNoRegister}
                    onKeyDown={handleOrderKeyDown}
                    onBlur={(e) => {
                      orderNoRegister.onBlur(e);
                      handleFetchSapOrder(e.target.value);
                    }}
                    placeholder="Siparis No"
                    className="w-full h-11 pl-10 pr-28 sm:pr-32 bg-muted/30 border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:border-rose-500 transition-all font-mono"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    {/* Kamera ile QR / Barkod Okutma Butonu */}
                    <button
                      type="button"
                      onClick={() => setIsScannerOpen(true)}
                      className="h-7 px-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-lg transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                      title="Kamera ile QR / Barkod Oku"
                    >
                      <QrCode size={13} />
                      <span className="text-[10px] font-black uppercase tracking-wider">QR</span>
                    </button>

                    {isFetchingSap ? (
                      <Loader2
                        size={16}
                        className="animate-spin text-rose-500 mr-2"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const val = watch("order_no");
                          handleFetchSapOrder(val);
                        }}
                        className="h-7 px-2.5 text-[10px] font-black uppercase tracking-wider bg-secondary hover:bg-muted text-foreground border border-border rounded-lg transition-all cursor-pointer active:scale-95"
                        title="Veritabanından Siparişi Getir"
                      >
                        Sorgula
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Ayar (Disabled) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  Ayar (Karat)
                </label>
                <select
                  disabled
                  {...register("karat")}
                  className="w-full h-11 px-3.5 bg-muted/40 border border-border/80 rounded-xl text-xs font-bold text-foreground/80 outline-none cursor-not-allowed opacity-85 select-none"
                >
                  <option value="">Ayar Seçiniz</option>
                  {KARAT_OPTIONS.map((k) => (
                    <option key={k} value={k}>
                      {k} Ayar
                    </option>
                  ))}
                </select>
              </div>

              {/* Renk (Disabled) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  Renk
                </label>
                <select
                  disabled
                  {...register("color")}
                  className="w-full h-11 px-3.5 bg-muted/40 border border-border/80 rounded-xl text-xs font-bold text-foreground/80 outline-none cursor-not-allowed opacity-85 select-none"
                >
                  {COLOR_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tel Kodu (Disabled) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  Tel Kodu
                </label>
                <input
                  type="text"
                  disabled
                  {...register("wire_code")}
                  placeholder="Örn: YT003135"
                  className="w-full h-11 px-3.5 bg-muted/40 border border-border/80 rounded-xl text-xs font-mono font-bold text-foreground/80 outline-none cursor-not-allowed opacity-85 select-none"
                />
              </div>
            </div>

            {/* Açıklama / Model Adı (Disabled) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                Açıklama (Model / Zincir Adı)
              </label>
              <input
                type="text"
                disabled
                {...register("description")}
                placeholder="Örn: IB EZME TONDO 50 TR"
                className="w-full h-11 px-3.5 bg-muted/40 border border-border/80 rounded-xl text-xs font-bold text-foreground/80 outline-none cursor-not-allowed opacity-85 select-none"
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

            {/* Görsel Yükleme & Fotoğraf Çekme */}
            <div className="space-y-2 pt-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-foreground flex items-center justify-between">
                <span>Hurda Görseli</span>
              </label>

              {/* Gizli Dosya Seçici */}
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                accept="image/jpeg,image/png,image/webp,image/jpg"
                className="hidden"
              />

              {/* Gizli Native Kamera Seçici (Cihaz kamerası doğrudan açılır) */}
              <input
                ref={nativeCameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />

              {filePreviewUrl ? (
                <div className="relative p-3 bg-muted/30 border border-border rounded-2xl flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl overflow-hidden border border-border bg-black/5 shrink-0 shadow-xs">
                    <img src={filePreviewUrl} alt="Önizleme" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 space-y-1 min-w-0">
                    <span className="text-xs font-bold text-foreground block truncate">
                      {selectedFile ? selectedFile.name : "Özel Yüklenen Görsel"}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      Görsel başarıyla belirlendi
                    </span>
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setIsCameraOpen(true)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 hover:underline cursor-pointer"
                      >
                        <Camera size={12} />
                        <span>Fotoğraf Çek</span>
                      </button>
                      <span className="text-muted-foreground/40 text-[10px]">•</span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                      >
                        <Upload size={12} />
                        <span>Dosya Değiştir</span>
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setFilePreviewUrl(null);
                    }}
                    className="p-2 hover:bg-muted text-muted-foreground hover:text-rose-500 rounded-lg cursor-pointer shrink-0"
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
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground block">
                        Standart Stok Görsel
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        Varsayılan
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Varsayılan görsel kullanılır veya cihaz kamerasıyla anında fotoğraf çekebilirsiniz.
                    </p>
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setIsCameraOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs shadow-rose-600/20"
                      >
                        <Camera size={13} />
                        <span>Fotoğraf Çek</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-muted text-foreground text-xs font-bold transition-all cursor-pointer border border-border"
                      >
                        <Upload size={13} />
                        <span>Dosyadan Yükle</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobilde ve Masaüstünde Sabit Kalan Alt Buton Barı (Scroll Olmaz) */}
          <div className="p-3.5 sm:p-4 border-t border-border bg-card/95 backdrop-blur-xs flex items-center justify-end gap-2.5 sm:gap-3 shrink-0 shadow-xs">
            <button
              type="button"
              onClick={handleModalClose}
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

      {/* CANLI KAMERA VİZÖRÜ MODALI (OVERLAY) */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-card border border-border rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            {/* Kamera Başlığı */}
            <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2 text-foreground font-black text-xs uppercase tracking-wider">
                <Camera size={16} className="text-rose-500" />
                <span>
                  {capturedImage ? "Fotoğraf Önizleme" : "Cihaz Kamerası ile Fotoğraf Çek"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCloseCamera}
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Kamera Vizör Alanı */}
            <div className="relative aspect-4/3 w-full bg-black flex items-center justify-center overflow-hidden">
              {capturedImage ? (
                <img
                  src={capturedImage}
                  alt="Çekilen Fotoğraf"
                  className="w-full h-full object-contain"
                />
              ) : cameraError ? (
                <div className="p-6 text-center space-y-3">
                  <AlertTriangle size={32} className="mx-auto text-amber-500" />
                  <p className="text-xs text-muted-foreground max-w-xs">{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => nativeCameraInputRef.current?.click()}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md inline-flex items-center gap-1.5"
                  >
                    <Camera size={14} />
                    <span>Telefon Kamerasını Aç</span>
                  </button>
                </div>
              ) : (
                <>
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    screenshotQuality={0.92}
                    videoConstraints={{
                      facingMode: { ideal: facingMode },
                      width: { ideal: 1280 },
                      height: { ideal: 720 },
                    }}
                    className="w-full h-full object-cover"
                    onUserMediaError={(err) => {
                      console.error("Webcam media error:", err);
                      setCameraError(
                        "Kameraya erişilemedi. Tarayıcı izinlerini kontrol edebilir veya 'Telefon Kamerasını Aç' seçeneğini kullanabilirsiniz."
                      );
                    }}
                  />
                  {/* Odaklama Kılavuzu (Crosshair) */}
                  <div className="absolute inset-8 border border-white/20 rounded-2xl pointer-events-none flex items-center justify-center">
                    <div className="w-8 h-8 border-t-2 border-l-2 border-rose-500 absolute top-0 left-0 rounded-tl-lg" />
                    <div className="w-8 h-8 border-t-2 border-r-2 border-rose-500 absolute top-0 right-0 rounded-tr-lg" />
                    <div className="w-8 h-8 border-b-2 border-l-2 border-rose-500 absolute bottom-0 left-0 rounded-bl-lg" />
                    <div className="w-8 h-8 border-b-2 border-r-2 border-rose-500 absolute bottom-0 right-0 rounded-br-lg" />
                    <span className="text-[10px] font-bold text-white/80 bg-black/50 px-2.5 py-1 rounded-full uppercase tracking-wider backdrop-blur-xs">
                      Parçayı Ortaya Hizalayın
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Kamera Alt Kontrolleri */}
            <div className="p-4 border-t border-border bg-card/95 flex items-center justify-between gap-3">
              {capturedImage ? (
                <div className="w-full flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleRetakePhoto}
                    className="flex-1 py-2.5 px-4 bg-secondary hover:bg-muted text-foreground rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <RotateCcw size={14} />
                    <span>Yeniden Çek</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmPhoto}
                    className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md shadow-rose-600/20 cursor-pointer"
                  >
                    <Check size={14} />
                    <span>Fotoğrafı Kullan</span>
                  </button>
                </div>
              ) : (
                <div className="w-full flex items-center justify-between px-2">
                  {/* Ön / Arka Kamera Değiştir */}
                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    className="p-2.5 rounded-xl bg-secondary hover:bg-muted text-foreground transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                    title="Kamerayı Değiştir (Ön/Arka)"
                  >
                    <SwitchCamera size={16} />
                    <span className="hidden sm:inline">Kamera Çevir</span>
                  </button>

                  {/* Deklanşör (Shutter) Butonu */}
                  <button
                    type="button"
                    onClick={handleCapturePhoto}
                    disabled={Boolean(cameraError)}
                    className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 border-4 border-card hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    title="Fotoğraf Çek"
                  >
                    <Camera size={22} />
                  </button>

                  {/* Native Kamera Yedek Butonu */}
                  <button
                    type="button"
                    onClick={() => nativeCameraInputRef.current?.click()}
                    className="p-2.5 rounded-xl bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                    title="Telefonun Kendi Kamera Uygulamasını Aç"
                  >
                    <Upload size={15} />
                    <span className="hidden sm:inline">Cihazdan</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR / Barkod Kamera Tarayıcı Modalı */}
      <QrBarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleQrScan}
      />
    </div>
  );
}
