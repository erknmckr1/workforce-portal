import React, { useState, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Printer,
  RotateCcw,
  Settings2,
  Copy,
  Check,
  Package,
  Scale,
  Layers,
  Tag,
  Plus,
  Minus,
  Sliders,
  Sparkles,
  Loader2
} from "lucide-react";
import apiClient from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

type LabelPresetKey = "zebra_zd421_50x20" | "zebra_zd421_68x32" | "60x30" | "50x30" | "custom";
type QrContentMode = "mat_ayar" | "key_value" | "key_value_long" | "json" | "raw_space" | "raw_pipe";

interface PresetConfig {
  label: string;
  sublabel: string;
  widthMm: number;
  heightMm: number;
  leftOffsetMm: number;
  topOffsetMm: number;
  qrSizeMm: number;
}

const PRESETS: Record<Exclude<LabelPresetKey, "custom">, PresetConfig> = {
  zebra_zd421_50x20: {
    label: "Zebra ZD421 (50 x 20 mm)",
    sublabel: "50x20 mm Rulo (13mm Sol Ofset)",
    widthMm: 50,
    heightMm: 20,
    leftOffsetMm: 13,
    topOffsetMm: 1.5,
    qrSizeMm: 13.5,
  },
  zebra_zd421_68x32: {
    label: "Zebra ZD421 (68 x 32 mm)",
    sublabel: "68x32 mm Rulo (17mm Sol Ofset)",
    widthMm: 68,
    heightMm: 32,
    leftOffsetMm: 17,
    topOffsetMm: 1.5,
    qrSizeMm: 18,
  },
  "60x30": {
    label: "60 x 30 mm",
    sublabel: "Standart (0mm Ofset)",
    widthMm: 60,
    heightMm: 30,
    leftOffsetMm: 0,
    topOffsetMm: 0,
    qrSizeMm: 18,
  },
  "50x30": {
    label: "50 x 30 mm",
    sublabel: "Kompakt (27mm Ofset)",
    widthMm: 50,
    heightMm: 30,
    leftOffsetMm: 27,
    topOffsetMm: 1.5,
    qrSizeMm: 16,
  },
};

export default function MesQrGeneratorPage() {
  const { user } = useAuthStore();

  // Form State
  const [materialNo, setMaterialNo] = useState("");
  const [ayar, setAyar] = useState("");
  const [inputWeight, setInputWeight] = useState("");
  const [netWeight, setNetWeight] = useState("");

  // Settings & Zebra ZD421 Calibration State (persistent in localStorage)
  const [selectedPreset, setSelectedPreset] = useState<LabelPresetKey>(() => {
    const p = localStorage.getItem("mes_qr_preset");
    if (!p || p === "zebra_zd421" || !(p in PRESETS)) return "zebra_zd421_50x20";
    return p as LabelPresetKey;
  });
  const [widthMm, setWidthMm] = useState<number>(() => {
    const v = localStorage.getItem("mes_qr_width");
    if (!v || v === "68" || v === "60") return PRESETS.zebra_zd421_50x20.widthMm;
    return parseFloat(v);
  });
  const [heightMm, setHeightMm] = useState<number>(() => {
    const v = localStorage.getItem("mes_qr_height");
    if (!v || v === "32" || v === "30") return PRESETS.zebra_zd421_50x20.heightMm;
    return parseFloat(v);
  });
  const [leftOffsetMm, setLeftOffsetMm] = useState<number>(() => {
    const v = localStorage.getItem("mes_qr_left_offset");
    if (!v || v === "17" || v === "19" || v === "24" || v === "27" || v === "28.5" || v === "15.5" || v === "0") return PRESETS.zebra_zd421_50x20.leftOffsetMm;
    return parseFloat(v);
  });
  const [topOffsetMm, setTopOffsetMm] = useState<number>(() => {
    const v = localStorage.getItem("mes_qr_top_offset");
    return v ? parseFloat(v) : PRESETS.zebra_zd421_50x20.topOffsetMm;
  });
  const [qrSizeMm, setQrSizeMm] = useState<number>(() => {
    const v = localStorage.getItem("mes_qr_size");
    if (!v || v === "18") return PRESETS.zebra_zd421_50x20.qrSizeMm;
    return parseFloat(v);
  });

  const [qrMode, setQrMode] = useState<QrContentMode>(() => {
    const saved = localStorage.getItem("mes_qr_mode") as QrContentMode;
    return saved || "mat_ayar";
  });
  const [autoClearAfterPrint, setAutoClearAfterPrint] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);

  const [printerName, setPrinterName] = useState<string>(() => {
    return localStorage.getItem("mes_qr_printer_name") || "MIDAS_BARKOD";
  });
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isAgentConnected, setIsAgentConnected] = useState<boolean | null>(null);

  // Yerel ajan (localhost:9199) durumunu kontrol et
  useEffect(() => {
    let isMounted = true;
    const checkAgent = async () => {
      try {
        const res = await fetch("http://127.0.0.1:9199/health", {
          signal: AbortSignal.timeout(1500),
        });
        if (isMounted) setIsAgentConnected(res.ok);
      } catch {
        if (isMounted) setIsAgentConnected(false);
      }
    };

    checkAgent();
    const interval = setInterval(checkAgent, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem("mes_qr_preset", selectedPreset);
    localStorage.setItem("mes_qr_width", String(widthMm));
    localStorage.setItem("mes_qr_height", String(heightMm));
    localStorage.setItem("mes_qr_left_offset", String(leftOffsetMm));
    localStorage.setItem("mes_qr_top_offset", String(topOffsetMm));
    localStorage.setItem("mes_qr_size", String(qrSizeMm));
    localStorage.setItem("mes_qr_printer_name", printerName);
    localStorage.setItem("mes_qr_mode", qrMode);
  }, [selectedPreset, widthMm, heightMm, leftOffsetMm, topOffsetMm, qrSizeMm, printerName, qrMode]);

  // Apply a preset
  const handleApplyPreset = (key: Exclude<LabelPresetKey, "custom">) => {
    setSelectedPreset(key);
    const p = PRESETS[key];
    setWidthMm(p.widthMm);
    setHeightMm(p.heightMm);
    setLeftOffsetMm(p.leftOffsetMm);
    setTopOffsetMm(p.topOffsetMm);
    setQrSizeMm(p.qrSizeMm);
    toast.success(`${p.label} şablonu uygulandı.`);
  };

  // Input refs for keyboard navigation (Enter key progression)
  const materialInputRef = useRef<HTMLInputElement>(null);
  const ayarInputRef = useRef<HTMLInputElement>(null);
  const brutInputRef = useRef<HTMLInputElement>(null);
  const netInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    materialInputRef.current?.focus();
  }, []);

  // Decimal input validator: permits only numeric digits and a single comma or dot
  const handleDecimalChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^[0-9]*[.,]?[0-9]*$/.test(val)) {
      setter(val);
    }
  };

  // Compute QR Value: Malzeme - Ayar veya seçilen format
  const qrValue = React.useMemo(() => {
    const mat = materialNo.trim();
    const ay = ayar.trim();
    const brut = inputWeight.trim();
    const net = netWeight.trim();

    // 1. Malzeme Kodu + Ayar (Varsayılan & Standart): MZ332421 14Y (arada tek boşluk)
    if (qrMode === "mat_ayar") {
      if (mat && ay) return `${mat} ${ay}`;
      if (mat) return mat;
      if (ay) return ay;
      return "MZ332421 14Y";
    }

    // 2. Standart Key-Value: MAT:MZ332948|AYAR:232|BRUT:5.06|NET:3.27
    if (qrMode === "key_value") {
      const parts: string[] = [];
      if (mat) parts.push(`MAT:${mat}`);
      if (ay) parts.push(`AYAR:${ay}`);
      if (brut) parts.push(`BRUT:${brut}`);
      if (net) parts.push(`NET:${net}`);
      return parts.length > 0 ? parts.join("|") : "MAT:MZ332948|AYAR:232|BRUT:5.06|NET:3.27";
    }

    // 2. Açık İsimli Key-Value: MALZEME:M7000001|AYAR:14|BRUT:5.06|NET:3.27
    if (qrMode === "key_value_long") {
      const parts: string[] = [];
      if (mat) parts.push(`MALZEME:${mat}`);
      if (ay) parts.push(`AYAR:${ay}`);
      if (brut) parts.push(`BRUT_GRAM:${brut}`);
      if (net) parts.push(`NET_GRAM:${net}`);
      return parts.length > 0 ? parts.join("|") : "MALZEME:M7000001|AYAR:14|BRUT_GRAM:5.06|NET_GRAM:3.27";
    }

    // 3. JSON Formatı: {"malzeme":"M7000001","ayar":"14","brut":"5.06","net":"3.27"}
    if (qrMode === "json") {
      return JSON.stringify({
        malzeme: mat || undefined,
        ayar: ay || undefined,
        brut: brut || undefined,
        net: net || undefined
      });
    }

    // 4. Sade / Pipe: M7000001|14|5.06|3.27
    if (qrMode === "raw_pipe") {
      const parts: string[] = [];
      if (mat) parts.push(mat);
      if (ay) parts.push(ay);
      if (brut) parts.push(brut);
      if (net) parts.push(net);
      return parts.length > 0 ? parts.join("|") : "M7000001|14|5.06|3.27";
    }

    // 5. Sade / Boşluklu: M7000001 14 5.06 3.27
    const parts: string[] = [];
    if (mat) parts.push(mat);
    if (ay) parts.push(ay);
    if (brut) parts.push(brut);
    if (net) parts.push(net);
    return parts.length > 0 ? parts.join(" ") : "M7000001 14 5.06 3.27";
  }, [materialNo, ayar, inputWeight, netWeight, qrMode]);

  // ZPL oluşturucu fonksiyon (Merkezi sunucu veya yerel ajan için birebir aynı kalibre edilmiş ZPL)
  const getZplCode = () => {
    const heightDots = Math.round(heightMm * 8);
    const leftDots = Math.round(leftOffsetMm * 8);
    const topDots = Math.round(topOffsetMm * 8);
    const mat = materialNo.trim();
    const ay = ayar.trim();
    const brut = inputWeight.trim();
    const net = netWeight.trim();
    const qr = qrValue;

    return [
      "^XA",
      "^MMT",
      "^MNY",
      "^CI28",
      "^PW550",
      `^LL${heightDots}`,
      `^LH${leftDots},${topDots}`,
      // 1. Satır: Malzeme No & Ayar (X=180)
      `^FO1,16^A0N,28,${mat.length > 8 ? 24 : 26}^FD${mat}^FS`,
      `^FO180,16^A0N,28,26^FD${ay}^FS`,
      // 2. Satır: Brüt g. & Değer (Sola yaklaştırıldı X=115, barkodla çakışmaz)
      `^FO1,68^A0N,24,20^FDBrüt g.^FS`,
      `^FO115,68^A0N,28,${brut.length > 6 ? 20 : 24}^FD${brut}^FS`,
      // 3. Satır: Net g. & Değer (Sola yaklaştırıldı X=115, barkodla çakışmaz)
      `^FO1,120^A0N,24,20^FDNet g.^FS`,
      `^FO115,120^A0N,28,${net.length > 6 ? 20 : 24}^FD${net}^FS`,
      // Sağ Bölüm: Karekod (Dikey Y=16, X=250)
      `^FO250,16^BQN,2,5^FDQA,${qr}^FS`,
      "^PQ1",
      "^XZ",
    ].join("\n");
  };

  // Handle Print: Tek tıkla doğrudan Zebra ZD421'e yazdırır (Penceresiz)
  const handlePrint = async () => {
    if (!materialNo.trim() && !ayar.trim() && !netWeight.trim() && !inputWeight.trim()) {
      toast.warning("Lütfen yazdırmadan önce en az bir bilgi giriniz.");
      return;
    }

    try {
      setIsPrinting(true);
      const zplContent = getZplCode();
      let printedViaAgent = false;

      // 1. Önce İstemcinin Yerel Yazdırma Ajanını dene (http://127.0.0.1:9199)
      try {
        const agentRes = await fetch("http://127.0.0.1:9199/print", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            printerName: printerName || "MIDAS_BARKOD",
            zpl: zplContent,
          }),
          signal: AbortSignal.timeout(2500),
        });
        if (agentRes.ok) {
          const agentData = await agentRes.json();
          if (agentData?.success) {
            printedViaAgent = true;
            setIsAgentConnected(true);
          }
        }
      } catch {
        // Yerel ajan yanıt vermedi
      }

      if (printedViaAgent) {
        toast.success("Etiket yerel Zebra yazıcıdan yazdırıldı! ⚡");
        // Merkezi sunucuya audit log kaydını arka planda kaydet
        apiClient
          .post("/mes/record-label-print", {
            materialNo: materialNo.trim(),
            ayar: ayar.trim(),
            inputWeight: inputWeight.trim(),
            netWeight: netWeight.trim(),
            qrValue: qrValue,
            copies: 1,
            status: "SUCCESS",
            operatorId: user?.id_dec,
            operatorName: user ? `${user.name} ${user.surname}`.trim() : undefined,
          })
          .catch(console.warn);

        if (autoClearAfterPrint) {
          handleReset();
        }
        return;
      }

      // 2. Yerel ajan yanıt vermediyse doğrudan merkezi sunucu üzerinden dene
      const res = await apiClient.post("/mes/print-thermal-label", {
        materialNo: materialNo.trim(),
        ayar: ayar.trim(),
        inputWeight: inputWeight.trim(),
        netWeight: netWeight.trim(),
        qrValue: qrValue,
        leftOffsetMm: leftOffsetMm,
        topOffsetMm: topOffsetMm,
        widthMm: widthMm,
        heightMm: heightMm,
        printerName: printerName || "MIDAS_BARKOD",
        operatorId: user?.id_dec,
        operatorName: user ? `${user.name} ${user.surname}`.trim() : undefined,
      });

      if (res.data?.success) {
        toast.success("Etiket yazdırıldı! ⚡");
        if (autoClearAfterPrint) {
          handleReset();
        }
      } else {
        toast.error("Yazdırma hatası: " + (res.data?.message || "Bilinmeyen hata"));
      }
    } catch (err: unknown) {
      console.error("Zebra direct print error:", err);
      toast.error(
        "Yazıcıya ulaşılamadı. Sunucuda çalışırken doğrudan yerel yazıcıya basmak için lütfen 'print-agent/start-agent.bat' servisini başlatın."
      );
    } finally {
      setIsPrinting(false);
    }
  };

  // Reference to always have latest handlePrint callback in global keydown listener
  const handlePrintRef = useRef(handlePrint);
  useEffect(() => {
    handlePrintRef.current = handlePrint;
  });

  // Global Ctrl+P ve Enter kısayollarını yakala (Tarayıcı penceresi açılmaz, doğrudan yazdırır)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        handlePrintRef.current();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Reset Form
  const handleReset = () => {
    setMaterialNo("");
    setAyar("");
    setInputWeight("");
    setNetWeight("");
    materialInputRef.current?.focus();
    toast.info("Form temizlendi.");
  };

  // Copy QR text
  const handleCopyQrText = () => {
    navigator.clipboard.writeText(qrValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("QR içerik metni panoya kopyalandı.");
  };

  // Form submit on Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handlePrint();
    }
  };

  return (
    <div className="flex flex-col space-y-6 max-w-6xl mx-auto pb-12" onKeyDown={handleKeyDown}>
      {/* Print Specific CSS */}
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 0mm !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            width: 100% !important;
            height: 100% !important;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-thermal-label,
          #printable-thermal-label * {
            visibility: visible !important;
          }
          #printable-thermal-label {
            position: fixed !important;
            left: ${leftOffsetMm}mm !important;
            top: ${topOffsetMm}mm !important;
            width: ${widthMm}mm !important;
            height: ${heightMm}mm !important;
            max-width: ${widthMm}mm !important;
            max-height: ${heightMm}mm !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 1.5mm 2.5mm !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
            overflow: hidden !important;
          }
          #printable-thermal-label .print-left-col {
            flex: 1 1 0% !important;
            min-width: 0 !important;
            height: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            padding-right: 2.5mm !important;
            overflow: hidden !important;
          }
          #printable-thermal-label .print-row-top {
            display: flex !important;
            flex-direction: row !important;
            justify-content: space-between !important;
            align-items: baseline !important;
            font-size: 8.5pt !important;
            font-weight: 900 !important;
            line-height: 1.1 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
          }
          #printable-thermal-label .print-mat-text {
            font-family: Consolas, monospace, monospace !important;
            font-weight: 900 !important;
            letter-spacing: -0.01em !important;
          }
          #printable-thermal-label .print-ayar-text {
            font-family: Consolas, monospace, monospace !important;
            font-weight: 900 !important;
          }
          #printable-thermal-label .print-row-gram {
            display: flex !important;
            flex-direction: row !important;
            justify-content: flex-start !important;
            gap: 2.5mm !important;
            align-items: center !important;
            font-size: 7.5pt !important;
            line-height: 1.1 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            border-top: 0.5px solid rgba(0,0,0,0.1) !important;
            padding-top: 0.6mm !important;
          }
          #printable-thermal-label .print-gram-label {
            min-width: 9.5mm !important;
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif !important;
            font-weight: 500 !important;
            color: #000000 !important;
          }
          #printable-thermal-label .print-gram-val {
            font-size: 8.5pt !important;
            font-weight: 900 !important;
            font-family: Consolas, monospace, monospace !important;
          }
          #printable-thermal-label .print-qr-col {
            flex: 0 0 ${qrSizeMm}mm !important;
            width: ${qrSizeMm}mm !important;
            height: ${qrSizeMm}mm !important;
            min-width: ${qrSizeMm}mm !important;
            max-width: ${qrSizeMm}mm !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            overflow: hidden !important;
            padding-left: 2mm !important;
            border-left: 0.5px solid rgba(0,0,0,0.1) !important;
          }
          #printable-thermal-label .print-qr-col svg {
            width: 100% !important;
            height: 100% !important;
            display: block !important;
          }
        }
      `}</style>

      {/* Etiket Ayarları Dialog (Modal - Sayfayı Aşağı İtmez) */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-lg rounded-3xl p-6 border-border/80 shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black uppercase tracking-tight text-foreground">
              <Settings2 size={18} className="text-emerald-500" />
              Zebra ZD421 (50x20 mm) & Kalibrasyon
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Zebra yazıcınızın 104x76mm fabrika ayarını değiştirmeden, 50x20mm etikete tam oturması için kenar boşluklarını ve boyutlarını kalibre edin.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-3">
            {/* Hızlı Boyut Şablonları */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Hızlı Şablonlar</span>
                <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                  <Sparkles size={11} /> Zebra ZD421 Uyumlu
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2 bg-muted/40 p-1.5 rounded-xl border border-border/60">
                {(["zebra_zd421_50x20", "zebra_zd421_68x32", "60x30", "50x30"] as (keyof typeof PRESETS)[]).map((key) => {
                  const p = PRESETS[key];
                  const isSelected = selectedPreset === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleApplyPreset(key)}
                      className={cn(
                        "py-2 px-2.5 rounded-lg transition-all text-left flex flex-col justify-center",
                        isSelected
                          ? "bg-primary text-primary-foreground shadow"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      )}
                    >
                      <span className="text-xs font-bold">{p.label}</span>
                      <span
                        className={cn(
                          "text-[10px]",
                          isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                        )}
                      >
                        {p.sublabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hassas Pozisyon & Boyut Kalibrasyonu (Stepper Controls) */}
            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/70 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Sliders size={14} className="text-primary" />
                  Hassas Kalibrasyon (Milimetre)
                </span>
                <button
                  type="button"
                  onClick={() => handleApplyPreset("zebra_zd421_50x20")}
                  className="text-[10px] font-bold text-muted-foreground hover:text-primary underline"
                >
                  Zebra (50x20)'ye Sıfırla
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {/* Sol Ofset */}
                <div className="bg-background/80 p-2.5 rounded-xl border border-border/60 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-foreground">Sol Boşluk (Ofset)</div>
                    <div className="text-[9px] text-muted-foreground">Sağa kaydırma</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      onClick={() => {
                        setLeftOffsetMm((v) => Math.max(0, Math.round((v - 1) * 10) / 10));
                        setSelectedPreset("custom");
                      }}
                    >
                      <Minus size={12} />
                    </Button>
                    <span className="w-12 text-center font-mono font-black text-xs text-foreground">
                      {leftOffsetMm} mm
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      onClick={() => {
                        setLeftOffsetMm((v) => Math.round((v + 1) * 10) / 10);
                        setSelectedPreset("custom");
                      }}
                    >
                      <Plus size={12} />
                    </Button>
                  </div>
                </div>

                {/* Üst Ofset */}
                <div className="bg-background/80 p-2.5 rounded-xl border border-border/60 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-foreground">Üst Boşluk (Ofset)</div>
                    <div className="text-[9px] text-muted-foreground">Aşağı kaydırma</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      onClick={() => {
                        setTopOffsetMm((v) => Math.max(0, Math.round((v - 0.5) * 10) / 10));
                        setSelectedPreset("custom");
                      }}
                    >
                      <Minus size={12} />
                    </Button>
                    <span className="w-12 text-center font-mono font-black text-xs text-foreground">
                      {topOffsetMm} mm
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      onClick={() => {
                        setTopOffsetMm((v) => Math.round((v + 0.5) * 10) / 10);
                        setSelectedPreset("custom");
                      }}
                    >
                      <Plus size={12} />
                    </Button>
                  </div>
                </div>

                {/* Etiket Genişliği */}
                <div className="bg-background/80 p-2.5 rounded-xl border border-border/60 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-foreground">Etiket Genişliği</div>
                    <div className="text-[9px] text-muted-foreground">Toplam alan eni</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      onClick={() => {
                        setWidthMm((v) => Math.max(30, v - 1));
                        setSelectedPreset("custom");
                      }}
                    >
                      <Minus size={12} />
                    </Button>
                    <span className="w-12 text-center font-mono font-black text-xs text-foreground">
                      {widthMm} mm
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      onClick={() => {
                        setWidthMm((v) => v + 1);
                        setSelectedPreset("custom");
                      }}
                    >
                      <Plus size={12} />
                    </Button>
                  </div>
                </div>

                {/* Etiket Yüksekliği */}
                <div className="bg-background/80 p-2.5 rounded-xl border border-border/60 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-foreground">Etiket Yüksekliği</div>
                    <div className="text-[9px] text-muted-foreground">Toplam alan boyu</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      onClick={() => {
                        setHeightMm((v) => Math.max(20, v - 1));
                        setSelectedPreset("custom");
                      }}
                    >
                      <Minus size={12} />
                    </Button>
                    <span className="w-12 text-center font-mono font-black text-xs text-foreground">
                      {heightMm} mm
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      onClick={() => {
                        setHeightMm((v) => v + 1);
                        setSelectedPreset("custom");
                      }}
                    >
                      <Plus size={12} />
                    </Button>
                  </div>
                </div>

                {/* Karekod Boyutu */}
                <div className="bg-background/80 p-2.5 rounded-xl border border-border/60 flex items-center justify-between sm:col-span-2">
                  <div>
                    <div className="text-[11px] font-bold text-foreground">Karekod (QR) Boyutu</div>
                    <div className="text-[9px] text-muted-foreground">Karekod kenar ölçüsü</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      onClick={() => {
                        setQrSizeMm((v) => Math.max(12, v - 1));
                        setSelectedPreset("custom");
                      }}
                    >
                      <Minus size={12} />
                    </Button>
                    <span className="w-12 text-center font-mono font-black text-xs text-foreground">
                      {qrSizeMm} mm
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      onClick={() => {
                        setQrSizeMm((v) => Math.min(30, v + 1));
                        setSelectedPreset("custom");
                      }}
                    >
                      <Plus size={12} />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* QR Kod İçerik Modu */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                Karekod İçerik Modu
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-muted/40 p-1.5 rounded-xl border border-border/60">
                <button
                  type="button"
                  onClick={() => setQrMode("mat_ayar")}
                  className={cn(
                    "py-2 px-2 text-xs font-bold rounded-lg transition-all text-center",
                    qrMode === "mat_ayar"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Malzeme Ayar (Örn: MZ332421 14Y)
                </button>
                <button
                  type="button"
                  onClick={() => setQrMode("key_value")}
                  className={cn(
                    "py-2 px-2 text-xs font-bold rounded-lg transition-all text-center",
                    qrMode === "key_value"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Key:Value (Kısa)
                </button>
                <button
                  type="button"
                  onClick={() => setQrMode("key_value_long")}
                  className={cn(
                    "py-2 px-2 text-xs font-bold rounded-lg transition-all text-center",
                    qrMode === "key_value_long"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Key:Value (Açık)
                </button>
                <button
                  type="button"
                  onClick={() => setQrMode("json")}
                  className={cn(
                    "py-2 px-2 text-xs font-bold rounded-lg transition-all text-center",
                    qrMode === "json"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  JSON Formatı
                </button>
                <button
                  type="button"
                  onClick={() => setQrMode("raw_space")}
                  className={cn(
                    "py-2 px-2 text-xs font-bold rounded-lg transition-all text-center",
                    qrMode === "raw_space"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Sade (Boşluk)
                </button>
                <button
                  type="button"
                  onClick={() => setQrMode("raw_pipe")}
                  className={cn(
                    "py-2 px-2 text-xs font-bold rounded-lg transition-all text-center",
                    qrMode === "raw_pipe"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Sade (Pipe |)
                </button>
              </div>
            </div>

            {/* Yazıcı & Otomatik Temizleme Ayarları */}
            <div className="pt-2 border-t border-border/60 space-y-2.5">
              <div className="bg-background/80 p-2.5 rounded-xl border border-border/60 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-foreground">Windows Yazıcı Adı</div>
                  <div className="text-[9px] text-muted-foreground">Doğrudan yazdırılacak Zebra yazıcı</div>
                </div>
                <Input
                  type="text"
                  value={printerName}
                  onChange={(e) => setPrinterName(e.target.value)}
                  className="h-8 w-44 rounded-lg font-mono text-xs font-bold text-right"
                  placeholder="MIDAS_BARKOD"
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none bg-muted/30 p-2.5 rounded-xl border border-border/60">
                <input
                  type="checkbox"
                  checked={autoClearAfterPrint}
                  onChange={(e) => setAutoClearAfterPrint(e.target.checked)}
                  className="rounded accent-primary w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-bold text-foreground">
                  Yazdırdıktan sonra formu temizle
                </span>
              </label>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                onClick={() => setShowSettings(false)}
                className="rounded-xl px-5 font-bold text-xs"
              >
                Tamam
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Grid: Form Left, Preview Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Column */}
        <div className="lg:col-span-6 bg-card rounded-[2.5rem] p-6 sm:p-8 border border-border/60 shadow-xl space-y-6">
          <div className="flex items-center justify-between min-h-8">
            <h2 className="text-lg font-black uppercase tracking-tight text-foreground">
              Etiket Bilgileri
            </h2>
          </div>

          <div className="space-y-5">
            {/* Row 1: Malzeme Numarası & Ayar (String) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Malzeme Numarası (String) */}
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Package size={14} className="text-primary" />
                  Malzeme Numarası (Metin)
                </label>
                <Input
                  ref={materialInputRef}
                  type="text"
                  value={materialNo}
                  onChange={(e) => setMaterialNo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      ayarInputRef.current?.focus();
                    }
                  }}
                  placeholder="Örn: MZ23232"
                  className="h-14 rounded-2xl bg-muted/30 border-border/60 text-base font-bold text-foreground focus-visible:ring-emerald-500/30"
                />
              </div>

              {/* Ayar (String) */}
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Tag size={14} className="text-amber-500" />
                  Ayar (Metin)
                </label>
                <Input
                  ref={ayarInputRef}
                  type="text"
                  value={ayar}
                  onChange={(e) => setAyar(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      brutInputRef.current?.focus();
                    }
                  }}
                  placeholder="Örn: 232"
                  className="h-14 rounded-2xl bg-muted/30 border-border/60 text-base font-bold text-foreground focus-visible:ring-emerald-500/30"
                />
              </div>
            </div>

            {/* Row 2: Brüt Gram & Net Gram (Decimal) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Brüt Gram (Decimal) */}
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Layers size={14} className="text-emerald-500" />
                  Brüt Gram (Ondalıklı)
                </label>
                <Input
                  ref={brutInputRef}
                  type="text"
                  inputMode="decimal"
                  value={inputWeight}
                  onChange={handleDecimalChange(setInputWeight)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      netInputRef.current?.focus();
                    }
                  }}
                  placeholder="Örn: 5.06"
                  className="h-14 rounded-2xl bg-muted/30 border-border/60 text-base font-bold font-mono text-foreground focus-visible:ring-emerald-500/30"
                />
              </div>

              {/* Net Gram (Decimal) */}
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Scale size={14} className="text-blue-500" />
                  Net Gram (Ondalıklı)
                </label>
                <Input
                  ref={netInputRef}
                  type="text"
                  inputMode="decimal"
                  value={netWeight}
                  onChange={handleDecimalChange(setNetWeight)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handlePrint();
                    }
                  }}
                  placeholder="Örn: 3.27"
                  className="h-14 rounded-2xl bg-muted/30 border-border/60 text-base font-bold font-mono text-foreground focus-visible:ring-emerald-500/30"
                />
              </div>
            </div>

            {/* Quick Actions inside Form */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                onClick={handlePrint}
                disabled={isPrinting}
                className="flex-1 h-14 rounded-2xl font-black text-sm uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 gap-2 transition-all cursor-pointer"
              >
                {isPrinting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Yazıcıya Gönderiliyor...
                  </>
                ) : (
                  <>
                    <Printer size={18} />
                    Etiketi Yazdır
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                title="Formu Temizle"
                className="h-14 px-6 rounded-2xl font-bold text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                <RotateCcw size={16} />
              </Button>
            </div>
          </div>

        </div>

        {/* Live Preview Column */}
        <div className="lg:col-span-6 bg-card rounded-[2.5rem] p-6 sm:p-8 border border-border/60 shadow-xl space-y-6 flex flex-col">
          <div className="flex items-center justify-between min-h-8">
            <h2 className="text-lg font-black uppercase tracking-tight text-foreground">
              Canlı Etiket Önizleme
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(true)}
                className="h-8 px-2.5 rounded-xl text-xs font-bold gap-1.5 border-border/60 hover:bg-muted text-foreground"
              >
                <Settings2 size={13} />
                Etiket Ayarları ({widthMm}x{heightMm} mm)
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyQrText}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                title="Karekod Metnini Kopyala"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </Button>
            </div>
          </div>

          {/* Sticker Preview Wrapper */}
          <div className="p-6 sm:p-8 bg-muted/30 rounded-[2rem] border border-border/60 flex flex-col items-center justify-center min-h-90 relative overflow-hidden flex-1">
            <div className="absolute inset-0 bg-radial from-primary/5 via-transparent to-transparent pointer-events-none" />

            {/* THE PRINTABLE & VISUAL THERMAL STICKER */}
            <div
              id="printable-thermal-label"
              className="bg-white text-black p-3 rounded-xl border border-neutral-300 shadow-2xl transition-all duration-300 flex items-center justify-between select-none relative gap-2.5"
              style={{
                fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                width: `${Math.min(420, Math.round(widthMm * 6.5))}px`,
                height: `${Math.round(heightMm * 6.5)}px`,
                maxWidth: "100%"
              }}
            >
              {/* Left Column: Text Rows */}
              <div className="print-left-col flex-1 flex flex-col justify-between h-full py-0.5 pr-2.5 text-left min-w-0 overflow-hidden">
                {/* Row 1: Malzeme No & Ayar */}
                <div className="print-row-top flex items-baseline justify-between font-black text-black">
                  <span
                    className="print-mat-text text-sm sm:text-base tracking-tight font-mono font-black truncate"
                    title={materialNo || "MZ23232"}
                  >
                    {materialNo.trim() || "MZ23232"}
                  </span>
                  <span className="print-ayar-text text-sm sm:text-base tracking-tight font-mono font-black text-neutral-900 shrink-0">
                    {ayar.trim() || "232"}
                  </span>
                </div>

                {/* Row 2: Brüt g. */}
                <div className="print-row-gram flex items-center justify-start gap-3 text-black border-t border-neutral-200/60 pt-1">
                  <span className="print-gram-label text-xs sm:text-sm font-medium text-neutral-800 min-w-[46px] shrink-0">
                    Brüt g.
                  </span>
                  <span className="print-gram-val font-mono font-black text-black text-xs sm:text-sm truncate">
                    {inputWeight.trim() || "5.06"}
                  </span>
                </div>

                {/* Row 3: Net g. */}
                <div className="print-row-gram flex items-center justify-start gap-3 text-black border-t border-neutral-200/60 pt-1">
                  <span className="print-gram-label text-xs sm:text-sm font-medium text-neutral-800 min-w-[46px] shrink-0">
                    Net g.
                  </span>
                  <span className="print-gram-val font-mono font-black text-black text-xs sm:text-sm truncate">
                    {netWeight.trim() || "3.27"}
                  </span>
                </div>
              </div>

              {/* Right Column: Karekod (QR Code) */}
              <div className="print-qr-col shrink-0 flex items-center justify-center pl-2 border-l border-neutral-200/60">
                <QRCodeSVG
                  value={qrValue}
                  size={Math.round(qrSizeMm * 6)}
                  level="M"
                  includeMargin={false}
                />
              </div>
            </div>

            {/* Quick status badge below */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-[11px] font-bold">
              <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-xl border border-border/60">
                <Printer size={13} className="text-emerald-500" />
                <span>Zebra ZD421: {widthMm}x{heightMm} mm (Sol Ofset: +{leftOffsetMm}mm)</span>
              </div>
              {isAgentConnected === true ? (
                <div
                  className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20"
                  title="Yerel Yazdırma Ajanı aktif. Sıfır pencere ile doğrudan USB yazıcıya basılır."
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Yerel Ajan: Aktif (9199)</span>
                </div>
              ) : isAgentConnected === false ? (
                <div
                  className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20"
                  title="192.168.3.5'te penceresiz doğrudan yazdırmak için print-agent/start-agent.bat dosyasını çalıştırın."
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Yerel Ajan: Kapalı (start-agent.bat)</span>
                </div>
              ) : null}
            </div>

            {/* Live QR string preview below */}
            <div className="mt-6 text-center max-w-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block mb-1">
                Karekodun Okutulduğunda Vereceği Değer:
              </span>
              <code className="text-[11px] font-mono bg-background px-3 py-1.5 rounded-xl border border-border/80 text-foreground break-all inline-block shadow-sm">
                {qrValue}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
