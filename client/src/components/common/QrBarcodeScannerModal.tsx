import { useEffect, useRef, useState, useCallback } from "react";
import {
  X,
  Flashlight,
  FlashlightOff,
  SwitchCamera,
  AlertCircle,
  Loader2,
  ScanLine,
  Upload,
} from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

interface QrBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
  title?: string;
  description?: string;
}

const SCANNER_ELEMENT_ID = "qr-barcode-reader-element";

export default function QrBarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
  title = "QR / Barkod Tara",
  description = "Kamerayı sipariş föyündeki QR kod veya barkoda tutun",
}: QrBarcodeScannerModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isRunningRef = useRef(false);
  const isCancelledRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Video track'lerini doğrudan donanım seviyesinde durdur (kamera LED'ini söndürür)
  const stopAllMediaTracks = useCallback(() => {
    try {
      const container = document.getElementById(SCANNER_ELEMENT_ID);
      const videoEl =
        container?.querySelector("video") ||
        (document.querySelector(`#${SCANNER_ELEMENT_ID} video`) as HTMLVideoElement | null);
      if (videoEl && (videoEl as HTMLVideoElement).srcObject) {
        const stream = (videoEl as HTMLVideoElement).srcObject as MediaStream;
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
            track.enabled = false;
          } catch {
            // ignore
          }
        });
        (videoEl as HTMLVideoElement).srcObject = null;
      }
    } catch (err) {
      console.warn("Direct video track stop error:", err);
    }
  }, []);

  // Aktif oturumu temizle (isCancelledRef'e dokunmaz)
  const cleanupCurrentSession = useCallback(async () => {
    stopAllMediaTracks();

    if (scannerRef.current) {
      const instance = scannerRef.current;
      scannerRef.current = null;
      isRunningRef.current = false;
      try {
        if (instance.isScanning) {
          await instance.stop();
        }
        instance.clear();
      } catch (err) {
        console.warn("Scanner stop/clear error:", err);
      }
    }

    stopAllMediaTracks();
  }, [stopAllMediaTracks]);

  // Güvenli şekilde kamerayı durdur ve temizle (İptal/Kapatma durumu)
  const stopScanner = useCallback(async () => {
    isCancelledRef.current = true;
    await cleanupCurrentSession();
  }, [cleanupCurrentSession]);

  // Modal Kapatma Handler'ı
  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  // Flaş Aç/Kapat
  const toggleTorch = async () => {
    if (!scannerRef.current || !isRunningRef.current || !hasTorch) return;
    try {
      const nextState = !isTorchOn;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (scannerRef.current as any).applyVideoConstraints({
        advanced: [{ torch: nextState }],
      });
      setIsTorchOn(nextState);
    } catch (err) {
      console.warn("Torch error:", err);
      setHasTorch(false);
    }
  };

  // Kamera Değiştir (Ön / Arka)
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Cihazdan Görsel Yükleyerek / Çekerek QR Okuma (Yedek Yöntem)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Temiz bir Html5Qrcode instance'ı ile görseli tara
      const html5QrCode = new Html5Qrcode(SCANNER_ELEMENT_ID, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ],
        verbose: false,
      });

      const decodedText = await html5QrCode.scanFile(file, true);
      html5QrCode.clear();

      if (decodedText) {
        if (navigator.vibrate) {
          try {
            navigator.vibrate(100);
          } catch {
            // ignore
          }
        }
        await stopScanner();
        onScan(decodedText);
        onClose();
      }
    } catch (err) {
      console.error("Görselden okuma hatası:", err);
      setIsLoading(false);
      setErrorMessage(
        "Seçilen fotoğrafta geçerli bir QR kod veya barkod bulunamadı. Lütfen daha net bir fotoğraf seçin."
      );
    }
  };

  // Tarayıcıyı Başlat
  const startScanner = useCallback(async () => {
    isCancelledRef.current = false;

    // Varsa önceki oturumu sonlandır
    await cleanupCurrentSession();

    setIsLoading(true);
    setErrorMessage(null);
    setIsTorchOn(false);
    setHasTorch(false);

    // HTTPS / Güvenli Bağlantı Kontrolü (Mobil tarayıcılar HTTP üzerinden kamerayı engeller)
    if (
      typeof window !== "undefined" &&
      !window.isSecureContext &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      setIsLoading(false);
      setErrorMessage(
        "Mobil tarayıcınız güvenlik sebebiyle HTTP üzerinden canlı kameraya izin vermiyor. Aşağıdaki 'Fotoğraf Çek / Yükle' butonunu kullanarak cihazınızın kamerasıyla barkodu okutabilirsiniz."
      );
      return;
    }

    // DOM elementinin hazır olmasını bekle
    await new Promise((r) => setTimeout(r, 150));

    if (isCancelledRef.current) return;

    const element = document.getElementById(SCANNER_ELEMENT_ID);
    if (!element) {
      setIsLoading(false);
      return;
    }

    try {
      const html5QrCode = new Html5Qrcode(SCANNER_ELEMENT_ID, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ],
        verbose: false,
      });

      scannerRef.current = html5QrCode;

      const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const edgeSize = Math.max(Math.floor(minEdge * 0.75), 200);
        return {
          width: Math.min(edgeSize, 320),
          height: Math.min(edgeSize, 320),
        };
      };

      // Kamera Cihazını Belirle (Masaüstü ve Mobil Uyumluluğu)
      let cameraConfig: string | { facingMode: string } = { facingMode };

      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          if (facingMode === "environment") {
            const backCam = devices.find((d) =>
              /back|rear|environment|arka|çevre/i.test(d.label)
            );
            cameraConfig = backCam ? backCam.id : devices[devices.length - 1].id;
          } else {
            const frontCam = devices.find((d) =>
              /front|user|ön/i.test(d.label)
            );
            cameraConfig = frontCam ? frontCam.id : devices[0].id;
          }
        }
      } catch (camErr) {
        console.warn("getCameras uyarısı, facingMode fallback:", camErr);
      }

      if (isCancelledRef.current) {
        await cleanupCurrentSession();
        return;
      }

      await html5QrCode.start(
        cameraConfig,
        {
          fps: 15,
          qrbox: qrboxFunction,
          aspectRatio: 1.0,
        },
        async (decodedText) => {
          // Başarılı okuma
          if (navigator.vibrate) {
            try {
              navigator.vibrate(100);
            } catch {
              // ignore
            }
          }
          await stopScanner();
          onScan(decodedText);
          onClose();
        },
        () => {
          // Frame-by-frame taranamayan kareler
        }
      );

      // Kullanıcı başlatma esnasında modalı kapattıysa anında geri durdur
      if (isCancelledRef.current) {
        await cleanupCurrentSession();
        return;
      }

      isRunningRef.current = true;
      setIsLoading(false);

      // Cihazın flaş yeteneği var mı kontrol et
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const capabilities = (html5QrCode as any).getRunningTrackCapabilities?.();
        if (capabilities && "torch" in capabilities) {
          setHasTorch(true);
        }
      } catch {
        setHasTorch(false);
      }
    } catch (err: unknown) {
      if (isCancelledRef.current) return;
      console.error("Kamera başlatma hatası:", err);
      isRunningRef.current = false;
      setIsLoading(false);
      const errMsg =
        err instanceof Error ? err.message : String(err || "Bilinmeyen hata");
      if (
        errMsg.toLowerCase().includes("permission") ||
        errMsg.toLowerCase().includes("notallowed")
      ) {
        setErrorMessage(
          "Kamera izni verilmedi. Lütfen tarayıcı ayarlarından kameraya izin verin veya aşağıdaki 'Fotoğraf Çek / Yükle' seçeneğini kullanın."
        );
      } else {
        setErrorMessage(
          "Canlı kamera başlatılamadı. Cihaz kameranız meşgul olabilir veya tarayıcı izin vermiyor olabilir. Aşağıdaki 'Fotoğraf Çek / Yükle' seçeneği ile devam edebilirsiniz."
        );
      }
    }
  }, [facingMode, onScan, onClose, stopScanner, cleanupCurrentSession]);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    const timer = setTimeout(() => {
      startScanner();
    }, 10);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen, facingMode, startScanner, stopScanner]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      {/* Gizli Dosya / Fotoğraf Input'u (Yedek) */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className="w-full max-w-md bg-card border border-border rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Başlık ve Kapat Butonu */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <ScanLine size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground">{title}</h3>
              <p className="text-[11px] text-muted-foreground">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-all cursor-pointer"
            title="Kapat"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tarayıcı Kamera Alanı */}
        <div className="relative p-4 flex flex-col items-center justify-center bg-black min-h-85">
          {/* html5-qrcode'un render olacağı div */}
          <div
            id={SCANNER_ELEMENT_ID}
            className="w-full max-w-[320px] aspect-square rounded-2xl overflow-hidden relative"
          />

          {/* Yükleniyor Göstergesi */}
          {isLoading && !errorMessage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white z-10 gap-3">
              <Loader2 size={32} className="animate-spin text-rose-500" />
              <p className="text-xs font-semibold text-muted-foreground">
                Kamera başlatılıyor...
              </p>
            </div>
          )}

          {/* Hata Durumu */}
          {errorMessage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 text-white z-10 p-6 text-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                <AlertCircle size={24} />
              </div>
              <p className="text-xs text-rose-300 font-medium leading-relaxed">
                {errorMessage}
              </p>
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <button
                  type="button"
                  onClick={startScanner}
                  className="px-4 py-2 bg-secondary hover:bg-muted text-foreground border border-border text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Tekrar Dene
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-rose-500/20 flex items-center gap-1.5"
                >
                  <Upload size={14} />
                  <span>Fotoğraf Çek / Yükle</span>
                </button>
              </div>
            </div>
          )}

          {/* Odaklama Çerçevesi (Vizör Efekti) */}
          {!isLoading && !errorMessage && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-60 h-60 relative">
                {/* 4 Köşe Ayracı */}
                <span className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-rose-500 rounded-tl-lg" />
                <span className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-rose-500 rounded-tr-lg" />
                <span className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-rose-500 rounded-bl-lg" />
                <span className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-rose-500 rounded-br-lg" />

                {/* Tarama Lazer Çizgisi */}
                <div className="w-full h-0.5 bg-linear-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-pulse absolute top-1/2 -translate-y-1/2" />
              </div>
            </div>
          )}
        </div>

        {/* Alt Araç Çubuğu (Flaş, Kamera Değiştir, Cihaz Kamerası, Kapat) */}
        <div className="p-3.5 bg-muted/20 border-t border-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isTorchOn
                    ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20"
                    : "bg-secondary text-foreground hover:bg-muted border border-border"
                }`}
                title="Flaş"
              >
                {isTorchOn ? <FlashlightOff size={14} /> : <Flashlight size={14} />}
                <span>{isTorchOn ? "Flaş Kapat" : "Flaş Aç"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleFacingMode}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-secondary text-foreground hover:bg-muted border border-border flex items-center gap-1.5 transition-all cursor-pointer"
              title="Kamera Değiştir"
            >
              <SwitchCamera size={14} />
              <span className="hidden sm:inline">Kamera</span>
            </button>

            {/* Cihazdan / Fotoğraftan Tara */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-secondary text-foreground hover:bg-muted border border-border flex items-center gap-1.5 transition-all cursor-pointer"
              title="Galeriden veya Cihaz Kamerasından Barkod Oku"
            >
              <Upload size={14} />
              <span className="hidden sm:inline">Fotoğraftan</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
          >
            İptal
          </button>
        </div>
      </div>
    </div>
  );
}
